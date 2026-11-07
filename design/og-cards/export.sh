#!/usr/bin/env bash
# Render every card in index.html to an exact 1200x630 PNG in ./out using headless Chrome.
# Usage: design/og-cards/export.sh   (needs Google Chrome and python3)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT="${PORT:-4179}"
OUT="$DIR/out"
mkdir -p "$OUT"

# Serve over http so relative asset paths and Google Fonts load normally.
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR" >/dev/null 2>&1 &
SERVER=$!
disown "$SERVER"
# Throwaway Chrome profile so headless runs never attach to (or wait on) a running Chrome.
PROFILE="$(mktemp -d)"
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$PROFILE"' EXIT
sleep 1

TIMEOUT="${TIMEOUT:-30}" # seconds per card

CARDS=(
  "default:og-default.png"
  "tv:og-tv.png"
  "league:og-league.png"
  "games-training:og-games-training.png"
  "games-battle:og-games-battle.png"
  "league-results:og-league-results.png"
  "games-results:og-games-results.png"
  "rider:og-rider.png"
  "curator:og-data-curator.png"
)

for entry in "${CARDS[@]}"; do
  id="${entry%%:*}"; file="${entry#*:}"
  rm -f "$OUT/$file"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
    --window-size=1200,630 --virtual-time-budget=4000 \
    --screenshot="$OUT/$file" "http://127.0.0.1:$PORT/index.html?only=$id" >/dev/null 2>&1 &
  CHROME_PID=$!
  for _ in $(seq "$TIMEOUT"); do
    kill -0 "$CHROME_PID" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$CHROME_PID" 2>/dev/null; then
    kill -9 "$CHROME_PID" 2>/dev/null || true
    pkill -9 -f -- "--user-data-dir=$PROFILE" 2>/dev/null || true
  fi
  wait "$CHROME_PID" 2>/dev/null || true
  if [[ -s "$OUT/$file" ]]; then
    echo "ok    $OUT/$file"
  else
    echo "FAIL  $id (no image after ${TIMEOUT}s)" >&2
    FAILED=1
  fi
done

exit "${FAILED:-0}"
