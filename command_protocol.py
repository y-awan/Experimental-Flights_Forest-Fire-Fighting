"""
command_protocol.py

Shared command-normalization helper used by drone_controller.py.

The controller receives free-form command strings (from Pub/Sub or a local
test harness) and needs them mapped to a small, canonical vocabulary before
they are looked up in its state-machine command_map:

    START_MISSION -> ST_INIT
    ABORT         -> ST_SAFETY_LAND
    RTL           -> ST_RETURN
    SURVEY        -> ST_SURVEY

normalize_command() accepts common aliases / spellings and returns one of the
canonical tokens above. Unknown input is returned upper-cased and stripped so
the caller's command_map simply produces no match (a safe no-op).
"""

# Canonical command tokens the controller understands.
CANONICAL = ("START_MISSION", "ABORT", "RTL", "SURVEY")

# Aliases -> canonical token. Keys are compared in a normalized form
# (upper-cased, spaces/hyphens collapsed to underscores).
_ALIASES = {
    # Start / launch the mission
    "START": "START_MISSION",
    "START_MISSION": "START_MISSION",
    "MISSION_START": "START_MISSION",
    "LAUNCH": "START_MISSION",
    "TAKEOFF": "START_MISSION",
    "TAKE_OFF": "START_MISSION",
    "GO": "START_MISSION",
    "ARM": "START_MISSION",

    # Abort / emergency land
    "ABORT": "ABORT",
    "EMERGENCY": "ABORT",
    "EMERGENCY_LAND": "ABORT",
    "LAND": "ABORT",
    "STOP": "ABORT",
    "KILL": "ABORT",

    # Return to launch
    "RTL": "RTL",
    "RETURN": "RTL",
    "RETURN_TO_LAUNCH": "RTL",
    "RETURN_HOME": "RTL",
    "GO_HOME": "RTL",
    "HOME": "RTL",

    # Survey / orbit
    "SURVEY": "SURVEY",
    "ORBIT": "SURVEY",
    "CIRCLE": "SURVEY",
    "SCAN": "SURVEY",
}


def _canonical_key(command: str) -> str:
    """Upper-case, trim, and collapse spaces/hyphens to underscores."""
    if command is None:
        return ""
    key = str(command).strip().upper()
    for ch in (" ", "-", "."):
        key = key.replace(ch, "_")
    while "__" in key:
        key = key.replace("__", "_")
    return key.strip("_")


def normalize_command(command: str) -> str:
    """
    Map an incoming command string to a canonical command token.

    Returns one of CANONICAL when the input is recognised, otherwise the
    cleaned/upper-cased input (which the controller's command_map will treat
    as an unknown, no-op command).
    """
    key = _canonical_key(command)
    if not key:
        return ""
    return _ALIASES.get(key, key)


if __name__ == "__main__":
    # Quick self-check.
    samples = [
        "start", "Start Mission", "take-off", "GO",
        "abort", "emergency land", "LAND",
        "rtl", "return to launch", "go home",
        "survey", "orbit", "unknown_cmd", "",
    ]
    for s in samples:
        print(f"{s!r:24} -> {normalize_command(s)!r}")
