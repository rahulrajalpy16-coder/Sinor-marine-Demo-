#!/usr/bin/env bash
# Builds the portable Windows x64 folder of the Sinor Marine simulator (no installer, runs from a pendrive).
# Usage: packaging/build-windows.sh <electron-v33.2.1-win32-x64.zip> <out-dir>
# The Electron runtime zip must match the SHA-256 in Electron's SHASUMS256.txt for that release.
set -euo pipefail
ZIP="$1"; OUT="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPECT=c325a6d905c67107e166267813ea2151ae7fd316c0a88de0081db0b9851a9946
echo "$EXPECT  $ZIP" | sha256sum -c -
rm -rf "$OUT"; mkdir -p "$OUT"
( cd "$ROOT" && npx vite build --base=/ --outDir "$OUT/.web" --emptyOutDir >/dev/null )
rm -rf "$OUT/.web/demo"   # the advert video ships separately, not inside the app
unzip -q "$ZIP" -d "$OUT/app"
rm -f "$OUT/app/resources/default_app.asar"
mkdir -p "$OUT/app/resources/app"
cp "$ROOT/packaging/desktop/main.js" "$ROOT/packaging/desktop/package.json" "$OUT/app/resources/app/"
mv "$OUT/.web" "$OUT/app/resources/app/web"
mv "$OUT/app/electron.exe" "$OUT/app/Sinor Marine Simulator.exe"
# Brand the executable (icon and version information) with rcedit under wine, when available.
if [ -n "${RCEDIT:-}" ] && command -v wine >/dev/null; then
  WINEDEBUG=-all xvfb-run -a wine "$RCEDIT" "$OUT/app/Sinor Marine Simulator.exe" --set-icon "$ROOT/packaging/desktop/sinor.ico" \
    --set-version-string ProductName "Sinor Marine Vessel Systems Simulator" --set-version-string FileDescription "Sinor Marine Vessel Systems Simulator" \
    --set-version-string CompanyName "Sinor Marine Services Middle East FZCO" --set-version-string LegalCopyright "Sinor Marine Services Middle East FZCO" \
    --set-file-version 1.0.0 --set-product-version 1.0.0 || echo "rcedit failed: executable keeps the default icon"
fi
echo "Built $OUT/app"
