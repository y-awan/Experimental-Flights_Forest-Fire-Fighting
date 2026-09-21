# Running the Drone Simulator (SITL)

This sets up ArduPilot SITL (Software-In-The-Loop) so you can test the comms
stack and fly a simulated drone in QGroundControl — no physical hardware needed.
It works the same on macOS, Linux, and Windows because the simulator runs inside
**Docker**.

---

## What you get

A container running ArduCopter SITL that streams MAVLink to your host:

| Port          | Consumer |
|---------------|----------|
| `udp:14550`   | QGroundControl |
| `udp:14552`   | `run_controller_sim.py` (the project's state-machine harness) |

A single SITL instance feeds both, so QGC and the controller can run at once.

---

## Prerequisites (one-time, per machine)

### 1. Docker

- **macOS:** either [Docker Desktop](https://www.docker.com/products/docker-desktop/),
  or [Colima](https://github.com/abiosoft/colima) via Homebrew:
  ```bash
  brew install colima docker
  colima start          # starts the Docker runtime
  ```
- **Windows / Linux:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  (or Docker Engine on Linux) and make sure the daemon is running.

Verify with:
```bash
docker info      # should print server info, not an error
```

### 2. An ArduPilot checkout (used to build the sim image)

The simulator image is **built locally from ArduPilot's Dockerfile** — it is not
published to a registry, so everyone builds it once on their own machine.

```bash
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git ~/ardupilot
```

If you cloned without submodules, run: `cd ~/ardupilot && git submodule update --init --recursive`.

> Put it at `~/ardupilot` (the default), or anywhere and set `ARDUPILOT_DIR` when
> you run the script (see below).

---

## Start the simulator

From the repo root:

```bash
./sim/start_sim.sh
```

What it does:
1. Checks the Docker daemon is running.
2. Builds the SITL image if it isn't already built (**first build ~10–20 min**;
   later runs skip straight to launch).
3. Starts the container streaming MAVLink to `udp:14550` and `udp:14552`.

Leave that terminal open — it *is* the running simulator. `Ctrl-C` stops it.

Other commands:
```bash
./sim/start_sim.sh status    # is Docker up? is the container up? what's on 14550?
./sim/start_sim.sh stop      # stop + remove the container
./sim/start_sim.sh --rebuild # force a fresh image build
```

Optional configuration (environment variables):
```bash
# Custom ArduPilot location, start position, or sim speed:
ARDUPILOT_DIR=/path/to/ardupilot \
SITL_LOCATION=33.7756,-84.3963,300,0 \
SITL_SPEEDUP=1 \
./sim/start_sim.sh
```

---

## Connect QGroundControl

1. Install and open [QGroundControl](http://qgroundcontrol.com/).
2. **Q logo → Application Settings → Comm Links.**
3. Delete any stale links from earlier experiments.
4. Easiest: **General → AutoConnect → enable UDP** — QGC grabs `14550` itself.
   Or add one manually: **Add → Type UDP → Port 14550 → OK → Connect.**

You should see one drone on the ground at the start location, ready for takeoff.

---

## Drive it from the project controller

With the sim up, the project harness talks to it on `14552`:

```bash
python run_controller_sim.py --mavlink udp:127.0.0.1:14552 --command START_MISSION
```

---

## Troubleshooting: "QGC says disconnected"

Clicking **Connect** in QGC only means it's *listening*. It stays disconnected
until a simulator is actually streaming MAVLink. Walk the chain top to bottom:

```bash
docker info                                   # 1. is the Docker daemon up?
docker ps --format '{{.Names}} {{.Status}}'   # 2. is the sim container running?
lsof -nP -iUDP:14550                          # 3. is anything on 14550? (macOS/Linux)
```

- **`docker info` errors** → the daemon is down. Start Docker Desktop, or run
  `colima start` (macOS/Colima). This is the most common cause.
- **No container listed** → the sim isn't running. Run `./sim/start_sim.sh`.
- **Nothing on 14550** → SITL isn't streaming there yet; check the sim terminal
  for errors (still building? crashed on a flag?).
- **All three OK but QGC still disconnected** → make sure the QGC link is UDP
  **14550** and no stale link points at a dead port.

---

## Why Docker instead of a native build?

On some setups (e.g. very new macOS + Apple clang) the native ArduPilot build
fails to link:

```
ld: pointer not aligned in '__ZN12AP_FWVersion5fwverE'
```

Running SITL in Docker sidesteps the host toolchain entirely and gives everyone
the same known-good Linux build, so the simulator behaves identically across the
team's machines. If ArduPilot builds natively on your machine, you can instead
run `sim_vehicle.py` directly with matching `--out` flags — but Docker is the
supported path here.
