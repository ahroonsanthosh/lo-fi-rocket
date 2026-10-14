#!/usr/bin/env bash
# Plan 0075 (D-114): our own driver; it clicks through RASAero II's windows, nothing of RASAero is in it.
# Drive RASAero II (running under Wine on Xvfb :99, no window manager) as a black box.
# Usage: run-rasaero.sh <input.CDX1> <outdir>
# Produces in <outdir>: <name>.CDX1 (copy), runtest_a0.txt (Tools > Run Test, alpha 0),
# flight.csv (Flight Simulation > Rerun Selected > View Data > Export To CSV, 0.01 s),
# aero.csv (Aero Plots > File > Export > To CSV File), and screenshots.
# All click coordinates assume windows open at (4,30) because there is no window manager.
set -u
R="$(cd "$(dirname "$0")" && pwd)"
export DISPLAY="${DISPLAY:-:99}" WINEPREFIX=$R/wine/prefix WINEARCH=win32 WINEDEBUG=-all
APPDIR="$WINEPREFIX/drive_c/Program Files/RASAero II"
# Absolute paths: the launch below runs from RASAero's own folder.
mkdir -p "$2"; IN="$(readlink -f "$1")"; OUT="$(cd "$2" && pwd)"
NAME=$(basename "$IN" | sed 's/\.[Cc][Dd][Xx]1$//; s/[^A-Za-z0-9_-]/_/g')
[ "$IN" -ef "$OUT/$NAME.CDX1" ] || cp "$IN" "$OUT/$NAME.CDX1"
winpath() { echo "Z:$(readlink -f "$1" | sed 's#/#\\#g')"; }
log() { echo "[$(date +%T)] $*" | tee -a "$OUT/run.log"; }
shot() { import -window root "$OUT/shot_$1.png" 2>/dev/null; }
pause() { timeout "$1" tail -f /dev/null; }
wait_win() { # wait_win <regex> <timeout_s> -> prints window id
  local t=0; while [ $t -lt $(( $2 * 2 )) ]; do
    local w; w=$(xdotool search --onlyvisible --name "$1" 2>/dev/null | tail -1)
    [ -n "$w" ] && { echo "$w"; return 0; }; pause 0.5; t=$((t+1)); done; return 1; }
wait_file() { # wait for file to exist, stop growing for 3 s, and the app to go idle
  local f=$1 t=0 last=-1 same=0; while [ $t -lt "$2" ]; do
    if [ -s "$f" ]; then local s; s=$(stat -c %s "$f")
      if [ "$s" = "$last" ]; then same=$((same+1)); [ $same -ge 3 ] && { wait_idle 60; return 0; }; else same=0; fi; last=$s; fi
    pause 1; t=$((t+1)); done; return 1; }
wait_idle() { # wait until the RASAero process stops using CPU
  local pid; pid=$(pgrep -f 'RASAero II.exe' | head -1); local prev=-1 t=0
  while [ $t -lt "$1" ]; do local cur; cur=$(awk '{print $14+$15}' /proc/$pid/stat 2>/dev/null)
    [ "$cur" = "$prev" ] && return 0; prev=$cur; pause 1; t=$((t+1)); done; return 1; }
dismiss_popups() { # press Enter on any unexpected message box (e.g. stability warnings)
  for w in $(xdotool search --onlyvisible --name '.' 2>/dev/null); do
    n=$(xdotool getwindowname "$w" 2>/dev/null)
    case "$n" in "RASAero II"*|"Flight"|"Aero Plots"|"Run Test"|"CSV_Time Increment"|"Default IME"|"") ;;
      *) log "popup: [$n] -> Enter"; import -window root "$OUT/shot_popup_$(date +%s).png"; xdotool windowactivate --sync "$w" 2>/dev/null; xdotool key --window "$w" Return; pause 1;; esac; done; }
save_dialog() { # type a Windows path into the Wine file-save dialog and press Enter
  pause 2; xdotool mousemove 380 440 click --repeat 3 1; xdotool key ctrl+a
  xdotool type --delay 3 "$1"; xdotool key Return; }

wineserver -k 2>/dev/null; pause 1
log "launch $NAME"
( cd "$APPDIR" && setsid wine "RASAero II.exe" "$(winpath "$OUT/$NAME.CDX1")" >"$OUT/wine.log" 2>&1 & )
MAIN=$(wait_win '^RASAero II' 90) || { log "FAIL: main window"; shot fail_main; exit 1; }
pause 3; wait_idle 30; dismiss_popups; shot 1_main

# 1. Tools > Run Test (alpha 0) -> runtest_a0.txt
xdotool mousemove 79 42 click 1; pause 1; xdotool mousemove 118 64 click 1
if RT=$(wait_win '^Run Test$' 15); then
  xdotool mousemove 238 210 click 1; xdotool key End shift+Home Delete   # Ctrl+A does not select in this TextBox
  xdotool type --delay 3 "$(winpath "$OUT")\\runtest_a0.txt"
  shot 2_runtest; xdotool mousemove 232 292 click 1
  wait_file "$OUT/runtest_a0.txt" 120 && log "runtest ok $(stat -c %s "$OUT/runtest_a0.txt") bytes" || log "FAIL: runtest file"
  dismiss_popups; xdotool mousemove 87 292 click 1; pause 1
else log "FAIL: Run Test window"; shot fail_runtest; fi

# 2. Aero Plots > File > Export > To CSV File
xdotool windowraise "$MAIN"; pause 1
xdotool mousemove 406 71 click 1
pause 2; wait_idle 120
if AP=$(xdotool search --name '^Aero Plots$' | tail -1) && [ -n "$AP" ]; then
  xdotool windowraise "$AP"; pause 2
  xdotool mousemove 30 42 click 1; pause 1; xdotool mousemove 70 65 click 1; pause 1; xdotool mousemove 260 67 click 1
  save_dialog "$(winpath "$OUT")\\aero.csv"
  wait_file "$OUT/aero.csv" 120 && log "aero csv ok $(wc -l <"$OUT/aero.csv") lines" || log "FAIL: aero csv"
  shot 5_aero
  xdotool mousemove 400 400 click 1; xdotool key alt+F4; pause 2   # close Aero Plots (modal)
else log "FAIL: Aero Plots window"; shot fail_aero; fi


# 3. Flight Simulation > Rerun Selected Simulation > View Data > Export To CSV
xdotool windowraise "$MAIN"; pause 0.5
xdotool mousemove 508 71 click 1
if FL=$(wait_win '^Flight$' 15); then
  xdotool windowsize "$FL" 1550 500; pause 1
  xdotool mousemove 135 107 click 1; pause 0.5           # select first simulation row
  xdotool mousemove 128 42 click 1; pause 1; xdotool mousemove 200 64 click 1
  pause 2; wait_idle 300; dismiss_popups; wait_idle 60; shot 3_flight
  xdotool mousemove 895 107 click 1; pause 3; wait_idle 120; dismiss_popups
  N=$(xdotool search --onlyvisible --name '^Flight$' | wc -l); log "flight windows: $N"
  shot 4_viewdata
  xdotool mousemove 32 42 click 1; pause 1; xdotool mousemove 70 65 click 1; pause 1; xdotool mousemove 200 67 click 1
  if wait_win '^CSV_Time Increment$' 10 >/dev/null; then
    xdotool mousemove 98 189 click 1
    save_dialog "$(winpath "$OUT")\\flight.csv"
    wait_file "$OUT/flight.csv" 120 && log "flight csv ok $(wc -l <"$OUT/flight.csv") lines" || log "FAIL: flight csv"
  else log "FAIL: CSV time increment window"; shot fail_csvinc; fi
else log "FAIL: Flight window"; shot fail_flight; fi

wait_idle 60; pause 2; wineserver -k 2>/dev/null
log "done $NAME"
