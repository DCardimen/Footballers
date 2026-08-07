#!/usr/bin/env bash
set -uo pipefail

ROOT="$PWD"
LOG="$ROOT/mosaic-build.log"
DIAG="$ROOT/menu-integration-diagnostics.json"
METRICS="$ROOT/menu-preview-metrics.json"
APK_OUT="$ROOT/menu-preview.png"
WORK="/tmp/mosaic-android-build"
ARCHIVE="/tmp/mosaic-src.tgz"
B64="/tmp/mosaic-src.b64"
EXPECTED_SHA="403e953aadb8f2f227f929c19fe07a369a1219a27f5c13c8c70ab7ab86e18834"

rm -rf "$WORK" "$ARCHIVE" "$B64" "$LOG" "$DIAG" "$METRICS" "$APK_OUT"
mkdir -p "$WORK"

{
  echo "Mosaic Android CI build"
  date -u
  echo "Runner: $(uname -a)"
  echo "Java before setup:"
  java -version || true
} > "$LOG" 2>&1

fail() {
  local code="$1"
  local stage="$2"
  printf '{"status":"failed","stage":"%s","exit_code":%s}\n' "$stage" "$code" > "$DIAG"
  cp "$LOG" "$METRICS" 2>/dev/null || true
  # Intentionally fail npm ci so the normal Footballers visual-test steps are skipped.
  # The existing always() artifact step still uploads our diagnostics/log files.
  exit 1
}

cat mosaic_payload/p00 mosaic_payload/p01 mosaic_payload/p02 mosaic_payload/p03 > "$B64" || fail $? "join_payload"
base64 -d "$B64" > "$ARCHIVE" 2>>"$LOG" || fail $? "decode_payload"
ACTUAL_SHA="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
echo "Archive SHA256: $ACTUAL_SHA" >> "$LOG"
if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "Payload checksum mismatch; expected $EXPECTED_SHA" >> "$LOG"
  fail 90 "verify_payload"
fi

tar -xzf "$ARCHIVE" -C "$WORK" >>"$LOG" 2>&1 || fail $? "extract_source"

# Build against API 36, which is available/supported on the hosted Android image.
sed -i 's/compileSdk = 37/compileSdk = 36/' "$WORK/app/build.gradle.kts"
sed -i 's/targetSdk = 37/targetSdk = 36/' "$WORK/app/build.gradle.kts"
# Remove a stale explicit import caught during static review; RowScope.weight is resolved by Compose scope.
sed -i '/import androidx.compose.foundation.layout.weight/d' "$WORK/app/src/main/java/com/david/mosaic/ui/MosaicApp.kt"

if [[ -n "${JAVA_HOME_17_X64:-}" ]]; then
  export JAVA_HOME="$JAVA_HOME_17_X64"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

echo "Java used for build:" >> "$LOG"
java -version >> "$LOG" 2>&1 || true

echo "Android SDK: ${ANDROID_HOME:-${ANDROID_SDK_ROOT:-unset}}" >> "$LOG"
if command -v sdkmanager >/dev/null 2>&1; then
  yes | sdkmanager "platforms;android-36" "build-tools;36.0.0" >> "$LOG" 2>&1 || true
else
  echo "sdkmanager not found on PATH" >> "$LOG"
  fail 91 "android_sdk"
fi

GRADLE_HOME="/tmp/gradle-9.5.0"
if [[ ! -x "$GRADLE_HOME/bin/gradle" ]]; then
  echo "Downloading Gradle 9.5.0" >> "$LOG"
  curl -fL --retry 3 --retry-delay 2 https://services.gradle.org/distributions/gradle-9.5.0-bin.zip -o /tmp/gradle-9.5.0-bin.zip >> "$LOG" 2>&1 || fail $? "download_gradle"
  rm -rf "$GRADLE_HOME"
  unzip -q /tmp/gradle-9.5.0-bin.zip -d /tmp >> "$LOG" 2>&1 || fail $? "unzip_gradle"
fi

cd "$WORK" || fail $? "enter_project"
echo "Starting Gradle assembleDebug" >> "$LOG"
set +e
"$GRADLE_HOME/bin/gradle" --no-daemon --stacktrace :app:assembleDebug >> "$LOG" 2>&1
BUILD_CODE=$?
set -e
cd "$ROOT" || exit 1

if [[ "$BUILD_CODE" -ne 0 ]]; then
  echo "Gradle failed with exit code $BUILD_CODE" >> "$LOG"
  fail "$BUILD_CODE" "gradle_assemble_debug"
fi

BUILT_APK="$WORK/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -s "$BUILT_APK" ]]; then
  echo "Gradle reported success but APK is missing" >> "$LOG"
  fail 92 "verify_apk_exists"
fi

unzip -t "$BUILT_APK" >> "$LOG" 2>&1 || fail $? "verify_apk_zip"
APK_SHA="$(sha256sum "$BUILT_APK" | awk '{print $1}')"
APK_SIZE="$(stat -c%s "$BUILT_APK")"
echo "APK SHA256: $APK_SHA" >> "$LOG"
echo "APK bytes: $APK_SIZE" >> "$LOG"

# Existing Footballers workflow already uploads menu-preview.png in its always() artifact step.
# Store the APK bytes under that temporary filename, plus machine-readable diagnostics.
cp "$BUILT_APK" "$APK_OUT" || fail $? "stage_apk_artifact"
printf '{"status":"success","apk_sha256":"%s","apk_bytes":%s}\n' "$APK_SHA" "$APK_SIZE" > "$DIAG"
cp "$LOG" "$METRICS"

# Deliberately stop npm ci here so no later screenshot step can overwrite menu-preview.png.
exit 1
