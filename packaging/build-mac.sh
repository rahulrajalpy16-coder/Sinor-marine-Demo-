#!/usr/bin/env bash
# Builds the offline macOS app (Apple Silicon: M1, M2, M3, M4) of the Sinor Marine simulator.
# Usage: packaging/build-mac.sh <electron-v33.2.1-darwin-arm64.zip> <out-dir>
# The Electron runtime zip must match the SHA-256 in Electron's SHASUMS256.txt for that release.
# Output: <out-dir>/Sinor Marine Simulator.app. Changing Electron's bundle invalidates its code signature, and Apple
# Silicon Macs refuse to run code with a broken signature, so the app is signed ad hoc once on the Mac itself with
# Apple's own built-in tools: "Prepare Mac (run once).command" (packaging/mac/) does that and clears the download
# quarantine. Ship the .app inside a zip made with `zip -ry`, because the Electron framework relies on symlinks.
set -euo pipefail
ZIP="$1"; OUT="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPECT=15615ce68c1a31b0db186af8607c00a30e3f64e63642aab735b4997d0fab7631
echo "$EXPECT  $ZIP" | sha256sum -c -
VERSION="$(node -p "require('$ROOT/packaging/desktop/package.json').version")"
APP="$OUT/Sinor Marine Simulator.app"
rm -rf "$OUT"; mkdir -p "$OUT"
( cd "$ROOT" && npx vite build --base=/ --outDir "$OUT/.web" --emptyOutDir >/dev/null )
rm -rf "$OUT/.web/demo"   # the advert video ships separately, not inside the app
unzip -q "$ZIP" -d "$OUT/.electron"
mv "$OUT/.electron/Electron.app" "$APP"
rm -rf "$OUT/.electron"
RES="$APP/Contents/Resources"
rm -f "$RES/default_app.asar"
mkdir -p "$RES/app"
cp "$ROOT/packaging/desktop/main.js" "$ROOT/packaging/desktop/package.json" "$RES/app/"
mv "$OUT/.web" "$RES/app/web"
# Brand the bundle: name, identifier, version and icon. The executable keeps its name (Electron), because the helper
# apps inside the framework are found by that name.
python3 -I - "$APP" "$VERSION" "$ROOT/public/brand/sinor-icon-512.png" <<'PY'
import plistlib, sys
from PIL import Image
app, version, icon = sys.argv[1:4]
p = f"{app}/Contents/Info.plist"
with open(p, "rb") as f:
    info = plistlib.load(f)
info.update({
    "CFBundleName": "Sinor Marine Simulator",
    "CFBundleDisplayName": "Sinor Marine Simulator",
    "CFBundleIdentifier": "com.sinormarine.vesselsimulator",
    "CFBundleShortVersionString": version,
    "CFBundleVersion": version,
    "CFBundleIconFile": "sinor.icns",
    "NSHumanReadableCopyright": "Sinor Marine Services Middle East FZCO",
    "LSApplicationCategoryType": "public.app-category.education",
    "NSHighResolutionCapable": True,
    "LSMinimumSystemVersion": info.get("LSMinimumSystemVersion", "11.0"),
})
with open(p, "wb") as f:
    plistlib.dump(info, f)
img = Image.open(icon).convert("RGBA")
img.save(f"{app}/Contents/Resources/sinor.icns", sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512)])
PY
rm -f "$RES/electron.icns"
# English only: drop the other interface languages of the runtime (keeps the download under 100 MB).
find "$APP" -type d -name '*.lproj' ! -name 'en.lproj' ! -name 'en_GB.lproj' ! -name 'Base.lproj' -prune -exec rm -rf {} +
echo "Built $APP ($VERSION)"
