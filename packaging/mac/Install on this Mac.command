#!/bin/bash
# Sinor Marine Vessel Systems Simulator: installs the offline app on this Mac (Apple Silicon) and starts it.
# It uses only Apple's own built-in tools (ditto, xattr, codesign). Nothing is downloaded and nothing leaves this Mac.
#  1. Unpacks "Sinor Marine Simulator.zip" (next to this file) into Applications.
#  2. Clears the "downloaded from the internet" flag, so macOS does not block the app.
#  3. Signs the app for this Mac only (ad hoc), which Apple Silicon needs to run it.
#  4. Starts the simulator.
set -e
cd "$(dirname "$0")"
NAME="Sinor Marine Simulator.app"
if [ "$(uname -m)" != "arm64" ]; then
  echo "This Mac has an Intel processor. This app is built for Apple Silicon (M1, M2, M3, M4) Macs."
  read -r -p "Press Return to close." _; exit 1
fi
if [ -d "$NAME" ]; then SRC="$PWD/$NAME"; else
  [ -f "Sinor Marine Simulator.zip" ] || { echo "Sinor Marine Simulator.zip was not found next to this file."; read -r -p "Press Return to close." _; exit 1; }
  TMP="$(mktemp -d)"; echo "Unpacking..."; ditto -x -k "Sinor Marine Simulator.zip" "$TMP"; SRC="$TMP/$NAME"
fi
DEST=/Applications
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
osascript -e 'quit app "Sinor Marine Simulator"' >/dev/null 2>&1 || true
rm -rf "$DEST/$NAME"
ditto "$SRC" "$DEST/$NAME"
[ -n "${TMP:-}" ] && rm -rf "$TMP"
echo "Preparing the app for this Mac..."
xattr -cr "$DEST/$NAME"
codesign --force --deep --sign - "$DEST/$NAME"
codesign --verify --deep "$DEST/$NAME" && echo "Installed: $DEST/$NAME"
open "$DEST/$NAME"
echo "Done. From now on start it from Launchpad or Applications: Sinor Marine Simulator."
