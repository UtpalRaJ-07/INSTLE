#!/bin/bash
# Capture review screenshots of the local preview using the locally installed
# Chrome. No new dependency is added for this.
#
# Usage: scripts/capture-screenshots.sh [base-url] [output-dir]
#
# Chrome's CLI screenshot captures the viewport, not the full scroll height, so a
# tall window is used to capture more of each page. This is a review aid, not a
# substitute for looking at the pages in a real browser.

set -uo pipefail

BASE="${1:-http://127.0.0.1:3215}"
OUT="${2:-docs/implementation/screenshots}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at $CHROME" >&2
  exit 1
fi

mkdir -p "$OUT"

shot() {
  local name="$1"
  local url="$2"
  local width="$3"
  local height="$4"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --virtual-time-budget=4000 \
    --window-size="${width},${height}" \
    --screenshot="${OUT}/${name}.png" "$url" >/dev/null 2>&1
  if [ -f "${OUT}/${name}.png" ]; then
    echo "captured ${name}.png"
  else
    echo "FAILED ${name}" >&2
  fi
}

PAGES=(
  "home:/"
  "buy:/buy"
  "sell:/sell"
  "rent:/rent"
  "rent-out:/rent-out"
  "commercial:/commercial"
  "areas:/areas"
  "guides:/guides"
  "guide-30-days:/guides/can-a-broker-guarantee-a-property-sale-in-30-days"
  "how-it-works:/how-it-works"
  "about:/about"
  "owner-utpal-raj-kb:/about/utpal-raj-kb"
  "contact:/contact"
  "not-found:/this-page-does-not-exist"
)

for pair in "${PAGES[@]}"; do
  name="${pair%%:*}"
  path="${pair#*:}"
  shot "desktop-${name}" "${BASE}${path}" 1440 2200
  shot "mobile-${name}" "${BASE}${path}" 390 1600
done

echo
echo "Screenshots written to ${OUT}"
