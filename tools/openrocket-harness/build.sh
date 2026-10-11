#!/bin/bash
# Build and run the OpenRocket reference harness.
# Downloads the pinned OpenRocket release jar if it is missing, verifies its
# SHA-256, compiles the harness against it, and runs it headlessly.
#
# Usage: ./build.sh [output-dir]   (default: ../../reference/rockets; time step 0.001 s)
set -euo pipefail
cd "$(dirname "$0")"

OR_VERSION="24.12"
OR_URL="https://github.com/openrocket/openrocket/releases/download/release-${OR_VERSION}/OpenRocket-${OR_VERSION}.jar"
OR_SHA256="4959b72f52f5f607941e9722abbb7b7f0c4a38ebbbf84204a329db9f31c4f897"
JAR="lib/OpenRocket-${OR_VERSION}.jar"
OUT_DIR="${1:-../../reference/rockets}"

mkdir -p lib out
if [ ! -f "$JAR" ]; then
  echo "Downloading OpenRocket ${OR_VERSION} ..."
  curl -sS -L -A "Mozilla/5.0" -o "$JAR" "$OR_URL"
fi
echo "${OR_SHA256}  ${JAR}" | sha256sum -c -

javac -Xlint:deprecation -d out -cp "$JAR" src/ReferenceHarness.java
java -Djava.awt.headless=true \
     -Dlogback.configurationFile=resources/logback.xml \
     -Dopenrocket.bypass.presets=true -Dopenrocket.bypass.motors=true \
     -cp "out:$JAR" ReferenceHarness "$OUT_DIR" "../../reference/motors"
