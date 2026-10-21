#!/usr/bin/env bash
# Builds the Sinor Marine exhibition advertisement end to end (several hours on a software renderer).
# Usage: scripts/video/make-advert.sh <workDir> <kokoro.onnx> <voices.bin> [logo.png|svg]
# Serve the built app first: npx vite build && npx vite preview --port 4173
set -euo pipefail
w=$1; here=$(dirname "$0")
mkdir -p "$w/vo" "$w/ov" "$w/out"
python3 "$here/voice.py" "$here/narration.json" "$2" "$3" "$w/vo"
node "$here/overlays.mjs" "$here/narration.json" "$w/ov" ${4:-}
# One session at a time: parallel software rendering is slower overall.
for s in hero app phone; do node "$here/capture.mjs" "$s" "$w/cap" "$w/vo/durations.json"; done
# STOCK=<dir> adds the brand clips (logo.mp4, twin.mp4, network.mp4 at 1080p30, see assemble.py).
# APP_FAST=a:b:k speeds up waiting in the walkthrough (app seconds a..b, k times); APP_JOIN=dpall uses a re-captured last part.
python3 "$here/assemble.py" "$w/cap" "$w/vo" "$w/ov" "$here/narration.json" "$here/music.py" "$w/out/sinor-marine-exhibition-demo.mp4"
