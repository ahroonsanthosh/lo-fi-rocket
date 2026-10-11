#!/bin/bash
# Re-download every reference document into reference/docs/ from its recorded
# URL and verify it against the SHA-256 pinned in reference/SOURCES.md.
# Usage: ./fetch-docs.sh            (downloads missing files, verifies all)
#        ./fetch-docs.sh --force    (re-downloads everything)
set -euo pipefail
cd "$(dirname "$0")/docs"
FORCE="${1:-}"
fetch() {
  local file="$1" url="$2" sha="$3"
  if [ "$FORCE" = "--force" ] || [ ! -f "$file" ]; then
    echo "Downloading $file"
    curl -sS -L -A "Mozilla/5.0" -o "$file" "$url"
  fi
  echo "$sha  $file" | sha256sum -c -
}
fetch ussa1976-nasa-ntrs-19770009539.pdf "https://ntrs.nasa.gov/api/citations/19770009539/downloads/19770009539.pdf" 23eb6b68346d4abc6071fc598872d51c40cf8c613d1a5d1006c6261bcd09dcea
fetch niskanen-2009-openrocket-thesis.pdf "https://github.com/openrocket/openrocket/releases/download/Development_of_an_Open_Source_model_rocket_simulation-thesis-v20090520/Development_of_an_Open_Source_model_rocket_simulation-thesis-v20090520.pdf" b948abf452c2f1c2ac63f0e0acfcb12dda2af856f8a7b51b22e0afca76d78d0c
fetch barrowman-1967-practical-calculation-ntrs-20010047838.pdf "https://ntrs.nasa.gov/api/citations/20010047838/downloads/20010047838.pdf" 09d62b014a706c700e1b596c8cc58c60e87d613da4ce963db3f72361ef0187eb
fetch barrowman-1966-theoretical-prediction-cp-apogee-reprint.pdf "https://www.apogeerockets.com/downloads/PDFs/barrowman_report.pdf" 321c9eaac9b3b89664b9170d0e4f1bf021d4087bad5561c7f6e7e98818fe7a7e
fetch si-brochure-9-en.pdf "https://www.bipm.org/documents/20126/41483022/SI-Brochure-9-EN.pdf" 5442eea2c680caf77a9d96879205a97f57c7c270b98a0bd0126c18fefe47e02c
fetch naca-rm-a53d02-ntrs-19930087740.pdf "https://ntrs.nasa.gov/api/citations/19930087740/downloads/19930087740.pdf" 76ded4490acbe271b94f49d7cc2e588724feb034425186f97d0f722427819247
fetch nasa-tr-r-100-ntrs-19630004995.pdf "https://ntrs.nasa.gov/api/citations/19630004995/downloads/19630004995.pdf" 44c9ac6046b83db16d156cbc26a608d632fbb844854eff568d50ad6ec99be51e
fetch nasa-tn-d-4013-ntrs-19670020050.pdf "https://ntrs.nasa.gov/api/citations/19670020050/downloads/19670020050.pdf" 44dc62a4131cf31b88fab20566f2a4b934a16be17388e099192d25236f08324a
fetch nasa-tn-d-4014-ntrs-19670020031.pdf "https://ntrs.nasa.gov/api/citations/19670020031/downloads/19670020031.pdf" d698b06798ad806a4fd6463f02f4c9e2624cd944d7a7902f2c015dbb5a351064
mkdir -p thrustcurve-api
fetch thrustcurve-api/api.html "https://www.thrustcurve.org/info/api.html" 221e4814360f7f7c1b27f2b2747dff67d9ab5452d644ee5e38865a8594aa8f6f
fetch thrustcurve-api/raspformat.html "https://www.thrustcurve.org/info/raspformat.html" 69573e9fc644c467fd2c8f5e4d0b2af99831a5a4bc554d15b56027ee640c626e
fetch thrustcurve-api/rocksimformat.html "https://www.thrustcurve.org/info/rocksimformat.html" 0bff975b363f7226b8c0cee920e1bafd2f26eec78ff096478b4813d72083d67a
fetch thrustcurve-api/swagger.json "https://www.thrustcurve.org/api/v1/swagger.json" 566009abab4e993283230061c98d47737df139649a70c887b9b6435c5ca04f8d
echo "All reference documents verified."
