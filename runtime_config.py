"""Read optional machine-local settings. The public repository ships no settings."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL_FILE = ROOT / 'local-config.json'
LOCAL = json.loads(LOCAL_FILE.read_text(encoding='utf-8-sig')) if LOCAL_FILE.is_file() else {}


def option(name):
    return os.environ.get('STATION_SIM_' + name.upper(), str(LOCAL.get(name) or '')).strip()


def local_path(name):
    value = option(name)
    return Path(value).expanduser().resolve() if value else None
