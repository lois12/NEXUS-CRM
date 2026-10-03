"""
VPS connection config for deploy scripts.
Set environment variables or create .deploy.env file in project root.
"""
import os
from pathlib import Path

# Load .deploy.env if it exists
_env_file = Path(__file__).parent / '.deploy.env'
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            os.environ.setdefault(key.strip(), value.strip())

VPS_HOST = os.environ.get('VPS_HOST', '')
VPS_USER = os.environ.get('VPS_USER', 'root')
VPS_PASS = os.environ.get('VPS_PASS', '')

if not VPS_HOST:
    raise SystemExit('VPS_HOST is not set. Set it in .deploy.env or as environment variable.')
if not VPS_PASS:
    raise SystemExit('VPS_PASS is not set. Set it in .deploy.env or as environment variable.')