#!/bin/zsh
# ACW reel builder: render -> capture -> encode.
#
#   ./build.sh <reel-dir> <out-dir> "<Base Name>" [theme ...]
#
# reel-dir  folder holding Main.dc.html, make-render.py, capture.mjs, logo.png, paper-texture.svg
# out-dir   where the .mp4 files land
# themes    any of: workbench dark paint      (default: workbench dark)
#
# Output: "<out-dir>/<Base Name> - ACW <label>.mp4"  at 1080x1920, 30fps, H.264.
set -e

REEL="${1:?reel-dir required}"
OUT="${2:?out-dir required}"
NAME="${3:?base name required}"
shift 3
THEMES=("$@")
[[ ${#THEMES[@]} -eq 0 ]] && THEMES=(workbench dark)

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=9222
TMP="$(mktemp -d)"
PROFILE="$TMP/chrome-profile"

label() { case "$1" in workbench) echo workshop ;; *) echo "$1" ;; esac }

cleanup() { pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true; sleep 1; rm -rf "$TMP" 2>/dev/null || true; }
trap cleanup EXIT

[[ -x "$CHROME" ]] || { echo "Chrome not found at $CHROME"; exit 1; }
[[ -f "$REEL/Main.dc.html" ]] || { echo "no Main.dc.html in $REEL"; exit 1; }
mkdir -p "$OUT"

echo "==> starting headless Chrome"
pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
sleep 1
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --remote-debugging-port=$PORT --user-data-dir="$PROFILE" \
  --window-size=1080,1920 about:blank >/dev/null 2>&1 &
for i in {1..20}; do
  curl -sf "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://127.0.0.1:$PORT/json/version" >/dev/null || { echo "Chrome debug port never came up"; exit 1; }

cd "$REEL"
for T in "${THEMES[@]}"; do
  L="$(label "$T")"
  echo "==> $T: building render page"
  python3 make-render.py "$T" "render-$T.html"

  echo "==> $T: capturing frames"
  node capture.mjs "file://$REEL/render-$T.html" "$TMP/f_$T"

  echo "==> $T: encoding"
  ffmpeg -v error -y -framerate 30 -i "$TMP/f_$T/%05d.png" \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart \
    "$OUT/$NAME - ACW $L.mp4"

  rm -rf "$TMP/f_$T"
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$NAME - ACW $L.mp4")
  echo "    done: $NAME - ACW $L.mp4  (${D}s)"
done

echo "==> all reels written to $OUT"
