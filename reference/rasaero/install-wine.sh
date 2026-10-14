#!/bin/bash
# Plan 0075 (D-114): install RASAero II 1.0.2.0 into a private Wine prefix (wine/), to re-run its
# example designs headlessly with run-rasaero.sh. Run fetch-examples.sh first. Needs Wine 9.0
# (32-bit prefix) and Xvfb; wine-mono 8.1.0 provides the .NET runtime RASAero II needs.
set -euo pipefail
cd "$(dirname "$0")"
export WINEPREFIX="$PWD/wine/prefix" WINEARCH=win32 WINEDEBUG=-all DISPLAY="${DISPLAY:-:99}"
MONO="download/wine-mono-8.1.0-x86.msi"
MONO_SHA="0ed3ec533aef79b2f312155931cf7b1080009ac0c5b4c2bcfeb678ac948e0810"
if [ ! -f "$MONO" ]; then
  curl -sS -L -o "$MONO" "https://dl.winehq.org/wine/wine-mono/8.1.0/wine-mono-8.1.0-x86.msi"
fi
echo "$MONO_SHA  $MONO" | sha256sum -c -
pgrep -x Xvfb >/dev/null || { Xvfb "$DISPLAY" -screen 0 1600x1000x24 -nolisten tcp & sleep 2; }
mkdir -p wine
wineboot -i >/dev/null 2>&1
wine msiexec /i "$MONO" /qn
MSI=$(find download/msi -name '*.msi' | head -1)
wine msiexec /i "$MSI" /qn
echo "Installed: $(ls "$WINEPREFIX/drive_c/Program Files/RASAero II/"*.exe)"
