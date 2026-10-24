#!/usr/bin/env bash
# Test bed only (not shipped): the same app and Electron version as the Windows release, built for Linux x64 so the
# packaged app can be cold-started here with the network blocked (unshare -n). The shipped targets are Windows and
# Android TV.
# Usage: packaging/tests/build-linux-testbed.sh <electron-v33.2.1-linux-x64.zip> <out-dir>
set -euo pipefail
ZIP="$1"; OUT="$2"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "3b66a507ece29684a105b0f9609db50c88235333ddad696d01eefebefd4b1aab  $ZIP" | sha256sum -c -
rm -rf "$OUT"; mkdir -p "$OUT"
( cd "$ROOT" && npx vite build --base=/ --outDir "$OUT/.web" --emptyOutDir >/dev/null )
rm -rf "$OUT/.web/demo"
unzip -q "$ZIP" -d "$OUT/app"
rm -f "$OUT/app/resources/default_app.asar"
mkdir -p "$OUT/app/resources/app"
cp "$ROOT/packaging/desktop/main.js" "$ROOT/packaging/desktop/package.json" "$OUT/app/resources/app/"
mv "$OUT/.web" "$OUT/app/resources/app/web"
echo "Built $OUT/app"
