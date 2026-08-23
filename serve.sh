#!/bin/sh
# Serve the game locally. ES modules will not load over file://, so the game
# needs a server even though it has no build step.
#
#   ./serve.sh          -> http://localhost:8123
#   ./serve.sh 8124     -> a second port, for a second worktree
#
# Uses serve.py rather than `python3 -m http.server` so that no-store headers
# are sent: without them a reload can run a new entry point against cached
# copies of the modules it imports.
PORT="${1:-8123}"
DIR="$(dirname "$0")"
exec python3 "$DIR/serve.py" "$PORT" "$DIR"
