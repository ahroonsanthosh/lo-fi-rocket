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
fetch apogee-rocksim-engine-file-format.pdf "https://www.thrustcurve.org/thirdparty/RockSim%20Engine%20File%20Format.pdf" c47a04f4d58f26219d70b2529654e6a4ed376310bb8a312c103be25647f85f95
fetch thrustcurve-api/motorstats.html "https://www.thrustcurve.org/info/motorstats.html" 8cfaacf3319bef69d2a7f1dff46f4ad2566a2496f2c21b53cca9a8612e6a1ec8
fetch thrustcurve-api/glossary.html "https://www.thrustcurve.org/info/glossary.html" 1702cc6e5b957f49af6f60090490c2fc0b9e4edfd83c93a719287f1e3855e287
fetch thrustcurve-api/swagger.json "https://www.thrustcurve.org/api/v1/swagger.json" 566009abab4e993283230061c98d47737df139649a70c887b9b6435c5ca04f8d
fetch nist-sp811-2008.pdf "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication811e2008.pdf" 788dd8f0bcb0ec06e40c300690266742532a7e760a93be57764b77ed0ef3482f
fetch blackman-vigna-2018-scrambled-linear-prngs-arxiv-1805.01407v3.pdf "https://arxiv.org/pdf/1805.01407" 3aee2f264786742812e651595898fb3c06e184abf589c56c14cc7c7b205668f5
fetch nasa-tn-d-1958-ntrs-19630012011.pdf "https://ntrs.nasa.gov/api/citations/19630012011/downloads/19630012011.pdf" c919984d93036c9fbe0b6116258e9adb706e5078ffbab0b645adf5a61c455cf3
fetch naca-rm-e50d28-ntrs-19930086134.pdf "https://ntrs.nasa.gov/api/citations/19930086134/downloads/19930086134.pdf" 0e261cf3321ad38440ae669bc3a878dc8ed1500759b00a02af3131c4e6d3c2c8
fetch naca-tn-2944-ntrs-19930083685.pdf "https://ntrs.nasa.gov/api/citations/19930083685/downloads/19930083685.pdf" f433811076e476b6912f5d43de9871e546bf333de534cf6e020f7899f7f7c773
fetch nasa-tn-d-3182-ntrs-19660004864.pdf "https://ntrs.nasa.gov/api/citations/19660004864/downloads/19660004864.pdf" 240e99bb1723d6c07b40158010c10ca0fc23a874f516293f1a1fa40465e5405c
fetch nasa-tm-x-1661-ntrs-19680027037.pdf "https://ntrs.nasa.gov/api/citations/19680027037/downloads/19680027037.pdf" 92bcda5932377170e5c60bbdf18f62a30cb14f14183d0f08b435dba7fad70c16
fetch naca-rm-l8a05-ntrs-19930085317.pdf "https://ntrs.nasa.gov/api/citations/19930085317/downloads/19930085317.pdf" eb3a607b5705d20084b5ede71802a8118d37590707a5e0ea793a97cf6743f192
echo "All reference documents verified."
