#!/bin/bash
# --- DriftSync launcher: double-click in Finder to start the app ---

# Run from this script's own folder, so .env and focusguard.db are found
cd "$(dirname "$0")" || exit 1

# Use a local virtual environment if one exists, otherwise the system Python 3
if [ -x ".venv/bin/python3" ]; then
    PY=".venv/bin/python3"
elif [ -x "venv/bin/python3" ]; then
    PY="venv/bin/python3"
else
    PY="python3"
fi

# Start the app (same as: python3 desktop_app.py)
"$PY" desktop_app.py

# Keep the window open if the app crashed, so the error can be read
if [ $? -ne 0 ]; then
    echo ""
    read -n 1 -s -r -p "DriftSync stopped with an error. Press any key to close..."
fi
