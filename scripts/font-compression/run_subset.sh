#!/bin/bash
set -e

if [ -x ".venv/bin/python" ]; then
    .venv/bin/python main.py "$@"
else
    python3 main.py "$@"
fi
