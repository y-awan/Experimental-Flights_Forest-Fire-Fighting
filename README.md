# Experimental_Flights-Drone_CommsTeam

A repository for all drone-to-app communications and camera software, including servers and other related scripts.

This repo holds the ground/companion-computer software for the Experimental Flights forest fire-fighting drone. It covers three main data paths:

- **Commands** flow from the mobile app down to the drone (via Google Cloud Pub/Sub → the drone controller → MAVLink/ArduPilot).
- **Telemetry** flows up from the drone to the app (via MAVLink → the telemetry server → Pub/Sub → Cloud Function → Firestore → app).
- **Video** streams from the drone's camera to the cloud (via FFmpeg → NGINX-RTMP/HLS → Google Cloud Storage).

## System Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │                Mobile App                   │
                        └───────────────┬───────────────▲─────────────┘
                             commands   │               │  telemetry
                                        ▼               │
                            ┌─────────────────────┐ ┌─────────────────┐
                            │  Pub/Sub (commands) │ │ Firestore / CF  │
                            └──────────┬──────────┘ └─────────▲───────┘
                                       │                      │
                                       ▼            Pub/Sub (telemetry)
                            ┌────────────────────┐  ┌─────────┴────────┐
                            │  drone_controller  │  │ telemetry-server │
                            │  (state machine)   │  │  (FastAPI/WS)    │
                            └──────────┬─────────┘  └─────────▲────────┘
                                       │  MAVLink               │ MAVLink
                                       ▼                        │
                            ┌─────────────────────────────────────────┐
                            │   Pixhawk / ArduPilot flight controller   │
                            │      (on Raspberry Pi companion computer) │
                            └───────────────────────────────────────────┘

  Camera path:  Pixhawk/Pi camera → FFmpeg → NGINX-RTMP/HLS → GCS bucket → app
```

## Repository Layout

| Path | Description |
|------|-------------|
| `drone_controller.py` | Command-driven flight state machine. Listens for commands on Pub/Sub and drives ArduPilot over MAVLink. |
| `command_protocol.py` | Command-normalization helper. Maps free-form command aliases to a canonical vocabulary. |
| `run_controller_sim.py` | Test harness that drives `DroneController` against an ArduPilot SITL simulator without needing Pub/Sub. |
| `telemetry-server/` | FastAPI telemetry server. Bridges MAVLink telemetry to WebSocket clients and Google Cloud Pub/Sub. |
| `RTMP-setup/` | Scripts to stand up an NGINX-RTMP/HLS server and stream camera video to Google Cloud Storage. |
| `test-telemetry/` | Standalone/experimental telemetry servers used during development, including a dummy-data generator. |
| `FireFightingDrone-WebApp-main/` | Django web app for managing drones (listings, map, auth). See its own `README.md`. |

---

## Command Pipeline

### `command_protocol.py`

Shared helper that maps incoming command strings (aliases, spellings, casing) to a small canonical vocabulary before the controller looks them up in its state machine:

| Canonical token | Controller state | Example aliases |
|-----------------|------------------|-----------------|
| `START_MISSION` | `ST_INIT` | `start`, `launch`, `takeoff`, `arm`, `go` |
| `ABORT` | `ST_SAFETY_LAND` | `emergency`, `land`, `stop`, `kill` |
| `RTL` | `ST_RETURN` | `return`, `return_to_launch`, `go_home`, `home` |
| `SURVEY` | `ST_SURVEY` | `orbit`, `circle`, `scan` |

Unknown input is returned upper-cased and stripped, so the caller's command map produces no match (a safe no-op). Run it directly (`python3 command_protocol.py`) for a quick self-check of the alias mapping.

### `drone_controller.py`

The main flight controller. It:

- Connects to ArduPilot over MAVLink (default `udp:127.0.0.1:14550`).
- Subscribes to a Pub/Sub command subscription (`drone-commands-sub`) and normalizes each incoming command via `command_protocol.normalize_command`.
- Runs an async state machine with a concurrent high-rate telemetry monitor.

State machine flow:

```
ST_IDLE → ST_INIT (arm + takeoff to 15m) → ST_MOVE (fly to target)
        → ST_SURVEY (20m orbit)
ABORT   → ST_SAFETY_LAND (LAND mode)
RTL     → ST_RETURN (RTL mode)
```

Configuration is via environment variables and module constants:

- `GCP_PROJECT_ID` — Google Cloud project ID.
- `SUBSCRIPTION_ID` — Pub/Sub subscription (`drone-commands-sub`).
- `MAVLINK_CONNECTION` — MAVLink endpoint (`udp:127.0.0.1:14550`).
- `TGT1`, `POS_TOLERANCE` — target NED coordinates and arrival tolerance.

Run:

```bash
export GCP_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
python3 drone_controller.py
```

### `run_controller_sim.py`

A test harness that reuses the real `DroneController` class but replaces the Pub/Sub listener with a direct state-machine transition, so you can drive the controller against an ArduPilot SITL simulator without Google Cloud. It points MAVLink at the SITL bridge port (default `udp:127.0.0.1:14552`), leaving `14550` free for QGroundControl.

```bash
# Default: START_MISSION
python run_controller_sim.py

# Issue a specific command
python run_controller_sim.py --command RTL

# Override the MAVLink endpoint
python run_controller_sim.py --mavlink udp:127.0.0.1:14552
```

---

## Telemetry Server (`telemetry-server/`)

A FastAPI-based server that runs on the Raspberry Pi companion computer. It connects to the Pixhawk over MAVLink, aggregates telemetry, broadcasts to WebSocket clients, and publishes structured telemetry packets to a Google Cloud Pub/Sub topic.

**Architecture:** `Pixhawk → Raspberry Pi → FastAPI Telemetry Server → Google Pub/Sub → Cloud Function → Firestore → Mobile App`

Key components:

- `telemetry-server.py` — Main FastAPI app: MAVLink I/O, WebSockets, and REST endpoints for arm/disarm/mode/takeoff.
- `data_handler.py` — Telemetry parsing, snapshot caching, history buffer, rate-limited broadcasting, and Pub/Sub publishing.
- `gcp_publisher.py` — Publishes telemetry payloads to Pub/Sub.
- `requirements.txt` — Python dependencies (`fastapi`, `uvicorn`, `pymavlink`, `websockets`, `google-cloud-pubsub`).
- `setup.sh` — Installs dependencies and opens the firewall port on the Pi.
- `HTTPS_VERSION/` — HTTPS variant of the server and dashboard.
- `OVERVIEW.txt` / `README.txt` — Detailed developer guide.

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve `index.html` dashboard |
| `/api/telemetry` | GET | Latest telemetry snapshot |
| `/api/telemetry/history` | GET | Last N telemetry entries |
| `/api/arm` | POST | Send ARM command |
| `/api/disarm` | POST | Send DISARM command |
| `/api/mode/{mode}` | POST | Set flight mode |
| `/api/takeoff/{altitude}` | POST | Arm and take off to target altitude |
| `/ws/telemetry` | WebSocket | Real-time telemetry stream |

### Running on the Raspberry Pi

```bash
# 1. Install dependencies
chmod +x setup.sh
sudo ./setup.sh          # or: pip install -r requirements.txt

# 2. Authenticate Pub/Sub
export GOOGLE_APPLICATION_CREDENTIALS="/home/pi/PubSubKey.json"
export GCP_PROJECT_ID="your-project-id"
export GCP_TOPIC_ID="drone-telemetry"

# 3. Run the server
python3 telemetry-server.py

# 4. Access the dashboard
#    http://<raspberrypi_ip>:8000/
#    WebSocket stream: ws://<raspberrypi_ip>:8000/ws/telemetry
```

---

## Camera Streaming (`RTMP-setup/`)

Scripts to set up video streaming from the drone's camera through an NGINX-RTMP/HLS server and up to Google Cloud Storage. Targeted at Ubuntu 22.04+.

- `NGINX-setup.sh` — Installs and configures NGINX, sets firewall rules.
- `RTMP-setup.sh` — Installs the RTMP module and configures RTMP + optional HLS/DASH in `nginx.conf`. **Run as a non-root user with sudo, not as root.**
- `start_stream.sh` — Captures webcam/camera video with FFmpeg, encodes to HLS, and launches the uploader.
- `upload_stream.py` — Watches the HLS output directory and uploads `.ts`/`.m3u8` segments to a GCS bucket.
- `README.txt` — Quick-start commands.

### Setup

```bash
chmod +x NGINX-setup.sh RTMP-setup.sh
./NGINX-setup.sh
./RTMP-setup.sh
```

### Streaming

```bash
# Requires FFmpeg and Google Cloud Storage credentials
./start_stream.sh
```

Configure the bucket, project ID, and credentials path at the top of `start_stream.sh` and `upload_stream.py` before running.

---

## Development / Experimental (`test-telemetry/`)

Standalone telemetry servers used during development. Not part of the production pipeline.

- `task1.py` — Early single-file FastAPI telemetry server (MAVLink → WebSocket broadcast).
- `dummy.py` — FastAPI telemetry API that can run against real MAVLink or generate simulated dummy telemetry (`USE_DUMMY_DATA = True`). Useful for front-end development without a drone.

```bash
# Run the dummy telemetry generator (must run from inside test-telemetry/)
cd test-telemetry
uvicorn dummy:app --host 0.0.0.0 --port 8000 --reload
```

---

## Web App (`FireFightingDrone-WebApp-main/`)

A Django-based Drone Management System (user auth, drone listings, map view, favorites). It has its own detailed documentation — see `FireFightingDrone-WebApp-main/FireFightingDrone-WebApp-main/README.md`.

```bash
source venv/bin/activate
python3 manage.py migrate
python3 manage.py runserver
# http://localhost:8000/
```

---

## Prerequisites

- Python 3
- [pymavlink](https://github.com/ArduPilot/pymavlink) and an ArduPilot flight controller or SITL simulator
- A Google Cloud project with Pub/Sub topics/subscriptions and (for video) a Cloud Storage bucket
- FFmpeg and NGINX (for the camera streaming path)

> Store Google Cloud credentials and project IDs in environment variables or an `.env` file. Do not commit service-account keys to the repository.

## Team

Experimental Flights Comms Team — Georgia Tech VIP Program
