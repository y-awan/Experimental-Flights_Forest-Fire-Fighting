"""
run_controller_sim.py  (test harness — does NOT modify drone_controller.py)

Drives the existing DroneController state machine against an ArduPilot SITL
simulator, without needing Google Cloud Pub/Sub.

It reuses the real DroneController class from drone_controller.py, but:
  * points MAVLink at the SITL bridge port (default udp:127.0.0.1:14552),
    leaving 14550 free for QGroundControl;
  * replaces the Pub/Sub listener with direct state-machine transitions,
    exactly like the pubsub_callback would issue (via normalize_command +
    the same command_map).

Usage:
    ~/ardupilot-venv/bin/python run_controller_sim.py                 # START_MISSION
    ~/ardupilot-venv/bin/python run_controller_sim.py --command RTL
    ~/ardupilot-venv/bin/python run_controller_sim.py --mavlink udp:127.0.0.1:14552
"""

import argparse
import asyncio
import logging

import drone_controller as dc
from command_protocol import normalize_command

# Same mapping the real pubsub_callback uses.
COMMAND_MAP = {
    "START_MISSION": "ST_INIT",
    "ABORT": "ST_SAFETY_LAND",
    "RTL": "ST_RETURN",
    "SURVEY": "ST_SURVEY",
}


async def run(mavlink_conn: str, command: str):
    # Point the controller's MAVLink at the sim bridge port before connecting.
    dc.MAVLINK_CONNECTION = mavlink_conn

    ctrl = dc.DroneController()
    ctrl.loop = asyncio.get_running_loop()

    logging.info("Connecting DroneController to %s ...", mavlink_conn)
    ctrl.connect_mavlink()  # blocks until heartbeat

    # Translate the requested command the same way pubsub_callback would.
    normalized = normalize_command(command)
    next_state = COMMAND_MAP.get(normalized)
    if not next_state:
        logging.error("Command %r (-> %r) is not a known command. "
                      "Known: %s", command, normalized, list(COMMAND_MAP))
        return

    logging.info("Issuing command %r -> normalized %r -> state %s",
                 command, normalized, next_state)

    async def kick():
        # Give telemetry a moment to populate, then drive the transition.
        await asyncio.sleep(2)
        await ctrl.transition(next_state)

    # Run the real telemetry loop concurrently with the command, just like main().
    await asyncio.gather(
        ctrl.monitor_telemetry(),
        kick(),
    )


def main():
    p = argparse.ArgumentParser(description="Drive DroneController against SITL.")
    p.add_argument("--mavlink", default="udp:127.0.0.1:14552",
                   help="MAVLink connection string (default: udp:127.0.0.1:14552)")
    p.add_argument("--command", default="START_MISSION",
                   help="Command to issue (START_MISSION, SURVEY, RTL, ABORT, or an alias)")
    args = p.parse_args()

    try:
        asyncio.run(run(args.mavlink, args.command))
    except KeyboardInterrupt:
        logging.info("Test harness shut down.")


if __name__ == "__main__":
    main()
