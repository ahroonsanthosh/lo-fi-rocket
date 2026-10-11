# Reference sources

Everything in `reference/` with its provenance. Downloaded 2026-10-11 from inside the Claude Code cloud session unless stated otherwise. Hashes are SHA-256 of the file as stored here.

## Source documents (`reference/docs/`)

### 1. U.S. Standard Atmosphere, 1976

- **Citation:** National Oceanic and Atmospheric Administration, National Aeronautics and Space Administration, United States Air Force. _U.S. Standard Atmosphere, 1976_. NOAA-S/T 76-1562, NASA-TM-X-74335. Washington, D.C., October 1976.
- **File:** `docs/ussa1976-nasa-ntrs-19770009539.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19770009539/downloads/19770009539.pdf (NASA Technical Reports Server, record 19770009539)
- **Downloaded:** 2026-10-11
- **SHA-256:** `23eb6b68346d4abc6071fc598872d51c40cf8c613d1a5d1006c6261bcd09dcea`
- **Pages:** 243 PDF pages (the NTRS accession stamp on the cover says 241 p; the scan adds two cover pages). Scanned, not text-searchable: read pages as images.
- **Verified:** cover page shows "U.S. STANDARD ATMOSPHERE, 1976" with the NTRS stamp "(NASA-TM-X-74335) U.S. STANDARD ATMOSPHERE, 1976 (National Aeronautics and Space Administration) 241 p" and the three sponsoring agencies; page 2 is the title page; page 3 is the "Special Recognition" page naming COESA. Government publication, public domain.

### 2. Niskanen (2009), Development of an Open Source model rocket simulation software

- **Citation:** Niskanen, Sampo. _Development of an Open Source model rocket simulation software_. Master's thesis, Helsinki University of Technology, Faculty of Information and Natural Sciences, Espoo, 20 May 2009.
- **File:** `docs/niskanen-2009-openrocket-thesis.pdf`
- **URL:** https://github.com/openrocket/openrocket/releases/download/Development_of_an_Open_Source_model_rocket_simulation-thesis-v20090520/Development_of_an_Open_Source_model_rocket_simulation-thesis-v20090520.pdf (the OpenRocket project's own GitHub, linked from https://openrocket.info/documentation.html). The OpenRocket wiki also links http://openrocket.sourceforge.net/thesis.pdf, which refused automated download (HTTP 403 from a bot check). No record was found in the Aalto University repository, which was unreachable from this session.
- **Downloaded:** 2026-10-11
- **SHA-256:** `b948abf452c2f1c2ac63f0e0acfcb12dda2af856f8a7b51b22e0afca76d78d0c`
- **Pages:** 126
- **Verified:** PDF metadata title "Development of an Open Source model rocket simulation software", author "Sampo Niskanen", created 18 May 2009 by LaTeX. Page 1 is the HUT title page with the supervisor (Professor Rolf Stenberg) and date "Espoo, 20.5.2009"; page 2 is the Finnish abstract page. Licence stated by the OpenRocket wiki: Creative Commons BY-NC-ND.
- **Note:** this is the original 2009 thesis, not the later "OpenRocket Technical Documentation" (version 13.05) that updates it; the technical documentation is not an approved source.

### 3. Barrowman (1967), The Practical Calculation of the Aerodynamic Characteristics of Slender Finned Vehicles

- **Citation:** Barrowman, James S. _The Practical Calculation of the Aerodynamic Characteristics of Slender Finned Vehicles_. M.S. dissertation, School of Engineering and Architecture, The Catholic University of America, Washington, D.C., March 1967. Reissued by NASA as NASA/TM-2001-209983.
- **File:** `docs/barrowman-1967-practical-calculation-ntrs-20010047838.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/20010047838/downloads/20010047838.pdf (NASA Technical Reports Server, record 20010047838, distribution: public)
- **Downloaded:** 2026-10-11
- **SHA-256:** `09d62b014a706c700e1b596c8cc58c60e87d613da4ce963db3f72361ef0187eb`
- **Pages:** 103 (front matter numbered i to x plus 93 body pages, matching the library catalogue entry "x, 93 p.")
- **Verified:** page 1 is the title page with the full title, "by James. S. Barrowman", the dissertation statement for the Catholic University of America M.S. in Aerospace Engineering, "March 1967", "Washington, D.C."; page 2 is the approval page (Dr. Shu J. Ying, Dr. Hsing-Ping Pao); page 3 the acknowledgments mentioning Goddard Space Flight Center. Scanned.

### 4. Barrowman and Barrowman (1966), The Theoretical Prediction of the Center of Pressure

- **Citation:** Barrowman, James S. and Barrowman, Judith A. _The Theoretical Prediction of the Center of Pressure_. NARAM-8 Research and Development Project, National Association of Rocketry, 18 August 1966.
- **Status: NOT OBTAINED.** No copy was found on an original-publisher, government, university or author-hosted site. The only online copies are a vendor reprint, https://www.apogeerockets.com/downloads/PDFs/barrowman_report.pdf (its first page states it is "reprinted here on the Apogee Components web site with permission of James S. Barrowman"), and mirrors of that reprint. The physical report is held by The Museum of Flight archives, Seattle (collection "James S. and Judith A. Barrowman Report", https://archives.museumofflight.org/repositories/2/resources/579), available by appointment. Awaiting the project owner's decision; see the Prompt 0 report.

### 5. RASP `.eng` and RockSim `.rse` motor file formats

- **Files:** `docs/thrustcurve-api/raspformat.html`, `docs/thrustcurve-api/rocksimformat.html`
- **URLs:** https://www.thrustcurve.org/info/raspformat.html and https://www.thrustcurve.org/info/rocksimformat.html
- **Downloaded:** 2026-10-11
- **SHA-256:** `69573e9fc644c467fd2c8f5e4d0b2af99831a5a4bc554d15b56027ee640c626e` (RASP), `0bff975b363f7226b8c0cee920e1bafd2f26eec78ff096478b4813d72083d67a` (RockSim)
- **Verified:** saved pages carry the ThrustCurve.org page titles "RASP Motor File Format" and "RockSim Motor File Format" (check with a browser or `grep '<title>'`).
- **Provenance note:** neither format has a formal standards document. The RASP format originated with the RASP simulator and the RockSim format with Apogee Components' RockSim; ThrustCurve.org, which the project owner named as the source for these formats and whose API the app will use, publishes the de facto specifications. These pages are used as the specification. Flagged in the Prompt 0 report as a judgment call.

### 6. BIPM SI Brochure, 9th edition (2019)

- **Citation:** Bureau International des Poids et Mesures. _The International System of Units (SI)_, 9th edition, 2019, version 4.01 (June 2026). ISBN 978-92-822-2272-0. https://doi.org/10.59161/AUEZ1291
- **File:** `docs/si-brochure-9-en.pdf`
- **URL:** https://www.bipm.org/documents/20126/41483022/SI-Brochure-9-EN.pdf
- **Downloaded:** 2026-10-11
- **SHA-256:** `5442eea2c680caf77a9d96879205a97f57c7c270b98a0bd0126c18fefe47e02c`
- **Pages:** 102
- **Verified:** page 1 is the BIPM title page "The International System of Units (SI), 9th edition 2019, V4.01 June 2026"; page 2 states the Creative Commons Attribution 4.0 licence and the ISBN. PDF metadata title "SI Brochure - 9th ed./version 4.01 EN", author BIPM.

### 7. ThrustCurve.org API documentation

- **Files:** `docs/thrustcurve-api/api.html` (the API guide), `docs/thrustcurve-api/swagger.json` (the OpenAPI definition served by the API)
- **URLs:** https://www.thrustcurve.org/info/api.html and https://www.thrustcurve.org/api/v1/swagger.json
- **Downloaded:** 2026-10-11
- **SHA-256:** `221e4814360f7f7c1b27f2b2747dff67d9ab5452d644ee5e38865a8594aa8f6f` (api.html), `566009abab4e993283230061c98d47737df139649a70c887b9b6435c5ca04f8d` (swagger.json)
- **Verified:** the OpenAPI document defines the `/api/v1/search.json`, `/api/v1/download.json` and related endpoints used below; the guide page is the publisher's own description of the same API.

## Reference motors (`reference/motors/`)

All files were fetched from the ThrustCurve.org API `POST /api/v1/download.json` with `format: "RASP", data: "file"`, which returns the stored simulator file verbatim (base64). The `source` field is ThrustCurve's classification of the data file: `cert` = digitised from the certification organisation's published data, `mfr` = manufacturer data, `user` = contributed. Where a motor had several RASP files the certification-sourced one was taken; where it had only one, that one. `_download-meta.json` holds the raw API metadata for each file.

| File                 | Motor (ThrustCurve common name, designation)                                                 | Class, diameter | Certification | ThrustCurve motor page                             | Data file (simfile id, source, licence)                                       | SHA-256                                                            |
| -------------------- | -------------------------------------------------------------------------------------------- | --------------- | ------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Estes_C6.eng`       | Estes C6                                                                                     | C, 18 mm        | NAR           | https://www.thrustcurve.org/motors/Estes/C6/       | 69eb2379c7d63000021d8c29, cert, unstated                                      | `79a06a45ab643ca0effb535fb7ecb8fb5d6a5eee7dc474a21d314fffbb3c49ac` |
| `Estes_D12.eng`      | Estes D12                                                                                    | D, 24 mm        | NAR           | https://www.thrustcurve.org/motors/Estes/D12/      | 5f4294d20002e900000004ea, user (made from NAR published data, 2000), unstated | `a39e5118880b08261650905901772f9019bc60d25dbaeefb593f4fbe529c4f05` |
| `Estes_E16.eng`      | Estes E16                                                                                    | E, 29 mm        | NAR           | https://www.thrustcurve.org/motors/Estes/E16/      | 5f4294d20002e900000007e6, cert, unstated                                      | `fa899e050defa15f38e70de2561473cf585f86c24c90a05a42e68bb1ed82ff95` |
| `AeroTech_F39T.eng`  | AeroTech F39T                                                                                | F, 24 mm        | NAR           | https://www.thrustcurve.org/motors/AeroTech/F39T/  | 5f4294d20002e90000000287, cert, unstated                                      | `92a29f8af663de9962da3eff4057768c3e31d1c69e5e08195142d845555c00c5` |
| `AeroTech_G80T.eng`  | AeroTech G80T (file header designation `G80NBT`, the current "New Blue Thunder" formulation) | G, 29 mm        | NAR           | https://www.thrustcurve.org/motors/AeroTech/G80T/  | 5f4294d20002e900000007dd, cert, unstated                                      | `95cc224985c6c0aa8a074c09f2b0ae47240a9eb77898754c2ed49d75e548240a` |
| `AeroTech_H128W.eng` | AeroTech H128W                                                                               | H, 29 mm        | TRA           | https://www.thrustcurve.org/motors/AeroTech/H128W/ | 5f4294d20002e9000000000d, cert (TMT test stand data 1997), public domain      | `feb3cbb6cac33995551d4b2d4e9520eec44cd7cd13799113d9980e7bb35208c4` |
| `AeroTech_H238T.eng` | AeroTech H238T                                                                               | H, 29 mm        | TRA           | https://www.thrustcurve.org/motors/AeroTech/H238T/ | 5f4294d20002e90000000017, cert (TMT test stand data 1997), public domain      | `4cb830751f14397b9f36ef09784eab3a5cef047fb57bc6eab48f22462575db02` |
| `AeroTech_H123W.eng` | AeroTech H123W                                                                               | H, 38 mm        | TRA           | https://www.thrustcurve.org/motors/AeroTech/H123W/ | 5f4294d20002e90000000009, cert (TMT test stand data 1999), public domain      | `91528fe6a4b62b6764f5f92bfc986bddb20b0d019b7985317391483b5db1063c` |

Downloaded 2026-10-11. Eight motors, C to H, 18 mm to 38 mm. The 38 mm H123W was added because the reference scratch-build rocket uses a 38 mm mount. The G80T file has three certification-sourced versions on ThrustCurve (the pre-2006 116 N·s motor, a 2007 NAR S&T digitisation with a non-standard header, and the current formulation); the current one was taken, and its header designation reads `G80NBT`.

## OpenRocket (`tools/openrocket-harness/`)

- **Software:** OpenRocket 24.12, the latest stable release (tags `release-24.12.RC.01` and `release-24.12.beta.01` are pre-releases; no later stable tag exists as of 2026-10-11).
- **URL:** https://github.com/openrocket/openrocket/releases/download/release-24.12/OpenRocket-24.12.jar
- **Downloaded:** 2026-10-11
- **SHA-256:** `4959b72f52f5f607941e9722abbb7b7f0c4a38ebbbf84204a329db9f31c4f897` (the project publishes no checksum for this asset; this hash is pinned in `tools/openrocket-harness/build.sh`, which refuses to run against any other jar)
- **Size:** 83 149 098 bytes. Not committed to git; `build.sh` downloads it.
- **Verified:** jar manifest `Implementation-Version: 24.12`, `Implementation-Vendor-Id: info.openrocket`; `build.properties` inside the jar says `build.version=24.12`.
- **Licence:** GPLv3. The harness that links to it is GPLv3 and lives only in `tools/openrocket-harness/` (see `docs/decisions.md`, D-013).
- **Source consulted:** the OpenRocket repository at tag `release-24.12` (commit 133b558) was cloned read-only outside this repository solely to learn the public API used by the harness (how OpenRocket's own tests bootstrap it headlessly). No OpenRocket source is copied into this repository.

## Reference rockets (`reference/rockets/`)

Generated by the harness; see `reference/rockets/README.md` for the designs, `settings.md` for every pinned OpenRocket setting, `values.csv` for the results, and `hand-checks.md` for the independent check.
