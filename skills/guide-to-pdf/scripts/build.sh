#!/bin/zsh
# Render a sheet-paginated HTML guide to PDF and verify it.
#
#   ./build.sh <guide.html> <out.pdf>
#
# Chrome does the rendering. ffmpeg, poppler and the rest are not involved.
set -e

SRC="${1:?source html required}"
OUT="${2:?output pdf required}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[[ -x "$CHROME" ]] || { echo "Chrome not found at $CHROME"; exit 1; }
[[ -f "$SRC" ]] || { echo "no such file: $SRC"; exit 1; }

SRC_ABS="$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")"

echo "==> rendering $OUT"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=12000 --print-to-pdf="$OUT" "file://$SRC_ABS" 2>/dev/null

python3 - "$OUT" <<'PY'
import re, sys
d=open(sys.argv[1],'rb').read()
pages=len(re.findall(rb'/Type\s*/Page[^s]', d))
links=len(re.findall(rb'/Subtype\s*/Link', d))
box=set(re.findall(rb'/MediaBox\s*\[([^\]]*)\]', d))
uris=sorted(set(re.findall(rb'/URI\s*\(([^)]*)\)', d)))
print(f"    {pages} pages, {round(len(d)/1024)} KB, MediaBox {box}")
print(f"    {links} clickable links")
for u in uris: print("      ", u.decode('latin-1'))
PY
echo "==> now run check.py on it. Do not ship a PDF you have not looked at."
