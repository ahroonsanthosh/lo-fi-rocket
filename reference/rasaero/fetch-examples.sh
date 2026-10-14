#!/bin/bash
# Plan 0075 (D-114): download RASAero II 1.0.2.0's installer from rasaero.com, check its SHA-256,
# and extract the example designs and RASP motor file it ships, without installing or running it.
# RASAero II is freeware by Charles E. Rogers and David Cooper; its files are not redistributed
# here, only fetched for the local comparison. Needs curl, unzip and msiextract (msitools).
# Usage: ./fetch-examples.sh   ->   download/RASAero II/Examples/*.CDX1 and download/RASAero II/rasp.eng
set -euo pipefail
cd "$(dirname "$0")"
URL="https://www.rasaero.com/dloads/RASAero_II_Setup_Version_1.0.2.0.zip"
ZIP="download/RASAero_II_Setup_Version_1.0.2.0.zip"
SHA="932e6ad7ad20d89f96594d0324dddc2a30a63324ddbb0c043dbce9a0bb56bef6"
mkdir -p download
if [ ! -f "$ZIP" ]; then
  echo "Downloading $URL"
  curl -sS -L -A "Mozilla/5.0" -o "$ZIP" "$URL"
fi
echo "$SHA  $ZIP" | sha256sum -c -
rm -rf download/msi download/extracted
mkdir -p download/msi download/extracted
unzip -q -o "$ZIP" -d download/msi
MSI=$(find download/msi -name '*.msi' | head -1)
(cd download/extracted && msiextract "../../$MSI" >/dev/null)
DATA=$(find download/extracted -type d -name 'RASAero II' -path '*Personal Data*' | head -1)
rm -rf "download/RASAero II"
mkdir -p "download/RASAero II/Examples"
cp "$DATA"/Examples/*.CDX1 "download/RASAero II/Examples/"
cp "$DATA/rasp.eng" "download/RASAero II/"
echo "$(ls "download/RASAero II/Examples" | wc -l) example designs in download/RASAero II/Examples"
