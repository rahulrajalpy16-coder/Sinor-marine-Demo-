#!/usr/bin/env bash
# Builds the offline Android / Android TV APK with the Debian/Ubuntu Android tools
# (apt: aapt apksigner zipalign dalvik-exchange android-sdk-platform-23; JDK 17+).
# Usage: packaging/build-android.sh <keystore> <out.apk>   (keystore password in $SINOR_KS_PASS)
set -euo pipefail
KS="$1"; OUT="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/packaging/android"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
W="$(mktemp -d)"
( cd "$ROOT" && npx vite build --base=/ --outDir "$W/assets/web" --emptyOutDir >/dev/null )
rm -rf "$W/assets/web/demo"
mkdir -p "$W/gen" "$W/obj"
aapt package -f -m -J "$W/gen" -M "$SRC/AndroidManifest.xml" -S "$SRC/res" -I "$JAR"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d "$W/obj" \
  $(find "$SRC/src" "$W/gen" -name '*.java')
dalvik-exchange --dex --output="$W/classes.dex" "$W/obj"
aapt package -f -M "$SRC/AndroidManifest.xml" -S "$SRC/res" -A "$W/assets" -I "$JAR" -F "$W/unsigned.apk"
( cd "$W" && aapt add unsigned.apk classes.dex >/dev/null )
zipalign -f -p 4 "$W/unsigned.apk" "$W/aligned.apk"
apksigner sign --ks "$KS" --ks-pass "env:SINOR_KS_PASS" --out "$OUT" "$W/aligned.apk"
apksigner verify --print-certs "$OUT" | head -3
rm -rf "$W"
echo "Built $OUT"
