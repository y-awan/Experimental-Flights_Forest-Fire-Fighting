import asyncio
import json
import logging
import math
import os
import sys
import time
from google.cloud import pubsub_v1
from pymavlink import mavutil
from command_protocol import normalize_command

# --- Configuration ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-project-id")
SUBSCRIPTION_ID = "drone-commands-sub"
MAVLINK_CONNECTION = "udp:127.0.0.1:14550"

# Target Coordinates (Local NED offsets in meters)
TGT1 = {"x": 10.0, "y": 10.0, "z": -15.0} 
POS_TOLERANCE = 1.5 

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class DroneController:
    def __init__(self):
        self.state = "ST_IDLE"
        self.mav = None
        self.loop = None
        self.target_alt = 15.0
        self.current_telemetry = {"alt": 0, "battery": 100, "x": 0, "y": 0}
        self.pos_tolerance = POS_TOLERANCE

    def connect_mavlink(self):
        try:
            logging.info(f"Connecting to MAVLink: {MAVLINK_CONNECTION}")
            self.mav = mavutil.mavlink_connection(MAVLINK_CONNECTION)
            self.mav.wait_heartbeat()
            logging.info("Heartbeat received! System ID: %d", self.mav.target_system)

        except Exception as e:
            logging.error(f"MAVLink Connection Failed: {e}")
            sys.exit(1)

    # --- Command Helpers ---
    def send_command(self, cmd, *args):
        """Standard MAV_CMD_LONG sender with 7-parameter padding."""
        params = list(args) + [0] * (7 - len(args))
        self.mav.mav.command_long_send(
            self.mav.target_system, self.mav.target_component,
            cmd, 0, *params
        )

    def send_movement_command(self, north, east, alt):
        """Sends the drone to a local coordinate (NED)."""
        self.mav.mav.set_position_target_local_ned_send(
            0, self.mav.target_system, self.mav.target_component,
            mavutil.mavlink.MAV_FRAME_LOCAL_NED,
            0b0000111111111000, # Mask: Use only Position
            north, east, -alt,  # NED 'Down' is negative altitude
            0, 0, 0, 0, 0, 0, 0, 0
        )

    def set_mode(self, mode):
        m_id = self.mav.mode_mapping().get(mode.upper())
        if m_id is not None:
            self.mav.mav.set_mode_send(self.mav.target_system, 1, m_id)

    # --- State Machine Transitions ---
    async def transition(self, next_state):
        if self.state == next_state: return
        logging.info(f"STATE TRANSITION: {self.state} -> {next_state}")
        self.state = next_state

        if next_state == "ST_INIT":
            await self.handle_init()
        
        elif next_state == "ST_MOVE":
            logging.info("Routing to Target 1...")
            self.send_movement_command(TGT1['x'], TGT1['y'], 15)

        elif next_state == "ST_SURVEY":
            logging.info("Starting Circle Survey (20m Orbit)")
            # MAV_CMD_DO_ORBIT: Radius=20, Velocity=5, Yaw=0 (Face Center)
            self.send_command(mavutil.mavlink.MAV_CMD_DO_ORBIT, 20, 5, 0, 0, 0, 0, 0)

        elif next_state == "ST_RETURN":
            logging.info("Returning to Launch (RTL)...")
            self.set_mode("RTL")

        elif next_state == "ST_SAFETY_LAND":
            logging.warning("Emergency Landing Triggered!")
            self.set_mode("LAND")

    # --- Logic Handlers ---
    async def handle_init(self):
        """Persistent Arming and Takeoff Sequence."""
        while self.mav.flightmode != "GUIDED":
            self.set_mode("GUIDED")
            self.mav.recv_match(type='HEARTBEAT', blocking=False)
            await asyncio.sleep(1)

        logging.info("GUIDED confirmed. Attempting to ARM...")
        while not self.mav.motors_armed():
            self.send_command(mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM, 1, 21196)
            self.mav.recv_match(type='HEARTBEAT', blocking=False)
            await asyncio.sleep(1)

        logging.info("ARMED! Taking off to 15m...")
        self.send_command(mavutil.mavlink.MAV_CMD_NAV_TAKEOFF, 0, 0, 0, 0, 0, 0, 15)

    async def monitor_telemetry(self):
        """High-speed telemetry loop with AGL and Armed checks."""
        while True:
            while True:
                msg = self.mav.recv_match(blocking=False)
                if not msg:
                    break 
                
                m_type = msg.get_type()
                
                # Use GLOBAL_POSITION_INT for the critical 'relative_alt' field
                if m_type == "GLOBAL_POSITION_INT":
                    # relative_alt is in millimeters, convert to meters
                    self.current_telemetry["alt"] = msg.relative_alt / 1000.0
                
                elif m_type == "LOCAL_POSITION_NED":
                    self.current_telemetry["x"] = msg.x
                    self.current_telemetry["y"] = msg.y

            # --- LOGIC UPDATES ---
            
            # Only transition to MOVE if we are in INIT AND the motors are actually spinning
            if self.state == "ST_INIT":
                if self.mav.motors_armed() and self.current_telemetry["alt"] >= 14.9:
                    logging.info(f"Takeoff Complete! Height AGL: {self.current_telemetry['alt']:.2f}m")
                    await self.transition("ST_MOVE")

            elif self.state == "ST_MOVE":
                dx = TGT1['x'] - self.current_telemetry['x']
                dy = TGT1['y'] - self.current_telemetry['y']
                dist = math.sqrt(dx**2 + dy**2)
                if dist < self.pos_tolerance:
                    logging.info(f"Arrived at Target. Distance: {dist:.2f}m")
                    await self.transition("ST_SURVEY")

            await asyncio.sleep(0.1)

    # --- Pub/Sub Pipeline ---
    def pubsub_callback(self, message):
        try:
            data = json.loads(message.data.decode("utf-8"))
            cmd = data.get("command", "").upper()
            normalized = normalize_command(cmd)
            
            command_map = {
                "START_MISSION": "ST_INIT",
                "ABORT": "ST_SAFETY_LAND",
                "RTL": "ST_RETURN",
                "SURVEY": "ST_SURVEY",
            }

            next_state = command_map.get(normalized)
            if next_state:
                # Thread-safe way to push a transition into the event loop
                self.loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(self.transition(next_state))
                )
            message.ack()
        except Exception as e:
            logging.error(f"Error in Pub/Sub Callback: {e}")

    def listen_pubsub(self):
        subscriber = pubsub_v1.SubscriberClient()
        path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)
        streaming_pull_future = subscriber.subscribe(path, callback=self.pubsub_callback)
        logging.info(f"Listening for commands on {path}...")
        try:
            streaming_pull_future.result()
        except Exception as e:
            streaming_pull_future.cancel()

async def main():
    ctrl = DroneController()
    ctrl.loop = asyncio.get_running_loop()
    ctrl.connect_mavlink()
    
    # Run Telemetry and PubSub listener concurrently
    await asyncio.gather(
        ctrl.monitor_telemetry(),
        ctrl.loop.run_in_executor(None, ctrl.listen_pubsub)
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Controller shut down.")