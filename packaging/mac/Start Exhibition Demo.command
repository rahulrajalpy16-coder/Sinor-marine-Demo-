#!/bin/bash
# Starts the exhibition demo full screen; it loops on its own. Press Esc (or Exit demo) to leave the demo, Cmd+Q to quit.
for d in /Applications "$HOME/Applications"; do
  if [ -d "$d/Sinor Marine Simulator.app" ]; then
    osascript -e 'quit app "Sinor Marine Simulator"' >/dev/null 2>&1 || true
    sleep 1
    open -a "$d/Sinor Marine Simulator.app" --args --demo --no-intro
    exit 0
  fi
done
echo "Sinor Marine Simulator is not installed yet. Run \"Install on this Mac.command\" first."
read -r -p "Press Return to close." _
