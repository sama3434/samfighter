#!/bin/sh
# Serve the game locally. ES modules will not load over file://, so the game
# needs a server even though it has no build step.
#
#   ./serve.sh          -> http://localhost:8123
#   ./serve.sh 8124     -> a second port, for a second worktree
PORT="${1:-8123}"
cd "$(dirname "$0")" || exit 1
echo "SAM FIGHTER  ->  http://localhost:$PORT"
echo "tests        ->  http://localhost:$PORT/tests/"
exec python3 -m http.server "$PORT"
