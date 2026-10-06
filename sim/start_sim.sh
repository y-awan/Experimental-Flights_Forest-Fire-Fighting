#!/usr/bin/env bash
#
# start_sim.sh — Start the Fire Fighting Drone ArduPilot SITL simulator in Docker.
#
# This runs the same simulator on any machine with Docker + an ArduPilot checkout.
# It builds the image on first run, then starts a container that streams MAVLink
# to the host on UDP 14550 (QGroundControl) and 14552 (run_controller_sim.py).
#
# Prerequisites (see sim/README.md for install details):
#   - Docker (Docker Desktop, or Colima on macOS)
#   - An ArduPilot source checkout with its Dockerfile
#
# Configuration via environment variables (all optional; sensible defaults shown):
#   ARDUPILOT_DIR   Path to your ardupilot checkout      (default: ~/ardupilot)
#   SITL_LOCATION   lat,lon,alt,heading start position   (default: Atlanta, GA)
#   SITL_SPEEDUP    sim speed multiplier                 (default: 1)
#
# Usage:
#   ./sim/start_sim.sh            # build if needed, then start the sim
#   ./sim/start_sim.sh stop       # stop and remove the sim container
#   ./sim/start_sim.sh status     # show what's running
#   ./sim/start_sim.sh --rebuild  # force-rebuild the image, then start
#
set -euo pipefail

# --- Resolve docker (works whether it's on PATH, Colima, or Docker Desktop) ---
DOCKER="$(command -v docker || true)"
if [ -z "$DOCKER" ]; then
    echo "ERROR: 'docker' not found on PATH. Install Docker Desktop or Colima (see sim/README.md)." >&2
    exit 1
fi

ARDUPILOT_DIR="${ARDUPILOT_DIR:-$HOME/ardupilot}"
IMAGE="${IMAGE:-drone-comms/ardupilot-sitl:copter-4.5}"
CONTAINER="${CONTAINER:-ardupilot-sitl}"
VEHICLE="ArduCopter"
SITL_LOCATION="${SITL_LOCATION:-33.7756,-84.3963,300,0}"   # Atlanta, GA (lat,lon,alt,heading)
SITL_SPEEDUP="${SITL_SPEEDUP:-1}"

cmd="${1:-start}"

case "$cmd" in
  stop)
    echo "==> Stopping and removing '$CONTAINER'"
    "$DOCKER" rm -f "$CONTAINER" >/dev/null 2>&1 || true
    echo "Done."
    exit 0
    ;;
  status)
    echo "=== Docker daemon ==="; "$DOCKER" info >/dev/null 2>&1 && echo "reachable" || echo "NOT reachable (start Docker Desktop / 'colima start')"
    echo "=== Sim container ==="; "$DOCKER" ps --filter "name=$CONTAINER" --format '{{.Names}} | {{.Status}} | {{.Ports}}' 2>/dev/null || true
    echo "=== UDP 14550 ==="; (lsof -nP -iUDP:14550 2>/dev/null | grep -v COMMAND) || echo "nothing on 14550 (or lsof unavailable)"
    exit 0
    ;;
  --rebuild) REBUILD=1 ;;
  start)     REBUILD=0 ;;
  *) echo "Usage: $0 [start|stop|status|--rebuild]" >&2; exit 2 ;;
esac

echo "==> 1/4 Checking Docker is running"
if ! "$DOCKER" info >/dev/null 2>&1; then
    echo "    ERROR: Docker daemon not reachable." >&2
    echo "    - Docker Desktop: launch the app and wait for it to be ready." >&2
    echo "    - Colima (macOS):  run 'colima start'." >&2
    exit 1
fi
echo "    Docker OK."

echo "==> 2/4 Ensuring the SITL image '$IMAGE' exists"
if [ "${REBUILD:-0}" = "1" ] || ! "$DOCKER" image inspect "$IMAGE" >/dev/null 2>&1; then
    if [ ! -f "$ARDUPILOT_DIR/Dockerfile" ]; then
        echo "    ERROR: no Dockerfile at '$ARDUPILOT_DIR/Dockerfile'." >&2
        echo "    Clone ArduPilot first, or set ARDUPILOT_DIR to your checkout:" >&2
        echo "      git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git ~/ardupilot" >&2
        exit 1
    fi
    echo "    Building $IMAGE from $ARDUPILOT_DIR/Dockerfile (first build is slow, ~10-20 min)..."
    ( cd "$ARDUPILOT_DIR" && "$DOCKER" build . -t "$IMAGE" )
else
    echo "    Image already present (skipping build)."
fi

echo "==> 3/4 Removing any old '$CONTAINER' container"
"$DOCKER" rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "==> 4/4 Starting SITL ($VEHICLE) -> host UDP 14550 (QGC) + 14552 (run_controller_sim.py)"
# Forward to the host; publishing container UDP ports is the opposite direction.
# Desktop/Colima provide host.docker.internal. Native Linux needs host-gateway.
HOST_ARGS=(--name "$CONTAINER")
if [ "$(uname -s)" = "Linux" ]; then
    HOST_ARGS+=(--add-host=host.docker.internal:host-gateway)
fi
exec "$DOCKER" run --rm -it \
    "${HOST_ARGS[@]}" \
    "$IMAGE" \
    ./Tools/autotest/sim_vehicle.py -v "$VEHICLE" \
        -w --no-rebuild \
        --speedup "$SITL_SPEEDUP" \
        --custom-location="$SITL_LOCATION" \
        --out=udp:host.docker.internal:14550 \
        --out=udp:host.docker.internal:14552
