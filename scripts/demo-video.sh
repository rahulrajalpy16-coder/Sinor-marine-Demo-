#!/usr/bin/env bash
# Records the demo clips (scripts/demo-video.mjs) and joins them into one phone-friendly MP4.
# Usage: scripts/demo-video.sh <outDir> [baseUrl]   (serve the built app first, e.g. npx vite preview --port 4173)
set -euo pipefail
out=${1:-demo-video}
base=${2:-http://localhost:4173}
node "$(dirname "$0")/demo-video.mjs" "$out" "$base"
ffmpeg -y -loglevel error -i "$out/1-desktop.webm" -i "$out/2-phone.webm" -filter_complex \
  "[0:v]fps=25,scale=1280:720,setsar=1[a];[1:v]fps=25,scale=-2:720,pad=1280:720:(ow-iw)/2:0:color=0x020a12,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "$out/sinor-marine-web-demo.mp4"
echo "$out/sinor-marine-web-demo.mp4"
