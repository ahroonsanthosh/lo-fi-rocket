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
- **File:** `docs/barrowman-1966-theoretical-prediction-cp-apogee-reprint.pdf`
- **Provenance: permissioned reprint.** No original-publisher, government or university copy exists online. This is the Apogee Components reprint, whose first page states "This report was reprinted here on the Apogee Components web site with permission of James S. Barrowman." Accepted by the project owner on 2026-10-11 on that basis (Prompt 1, Part B2, item 1).
- **URL:** https://www.apogeerockets.com/downloads/PDFs/barrowman_report.pdf
- **Downloaded:** 2026-10-11
- **SHA-256:** `321c9eaac9b3b89664b9170d0e4f1bf021d4087bad5561c7f6e7e98818fe7a7e`
- **Pages:** 43 (scan; PDF metadata author "Tim Van Milligan", the Apogee reprint's producer)
- **Verified:** page 1 carries the title, both authors, "NARAM-8 R&D Project" and the permission statement. The physical original is held by The Museum of Flight archives, Seattle (collection "James S. and Judith A. Barrowman Report").

### 5. RASP `.eng` and RockSim `.rse` motor file formats

- **RASP file:** `docs/thrustcurve-api/raspformat.html`, from https://www.thrustcurve.org/info/raspformat.html, downloaded 2026-10-11, SHA-256 `69573e9fc644c467fd2c8f5e4d0b2af99831a5a4bc554d15b56027ee640c626e`. Verified: the saved page carries the ThrustCurve.org title "RASP File Format" and the header-line and data-point rules quoted in `docs/plans/0004-eng-reader.md`.
- **RockSim file:** `docs/apogee-rocksim-engine-file-format.pdf`, Apogee Components, _RockSim & EngEdit – Engine File (.rse) Format Guide_ (3 pages; PDF metadata author Aakash Patwardhan, created 8 May 2025), from https://www.thrustcurve.org/thirdparty/RockSim%20Engine%20File%20Format.pdf (linked as "Apogee has published a brief description" on https://www.thrustcurve.org/info/contribute.html), downloaded 2026-10-12, SHA-256 `c47a04f4d58f26219d70b2529654e6a4ed376310bb8a312c103be25647f85f95`. Verified: page 1 carries the title and the attribute table (`mfg`, `code`, `type`, `dia`, `len`, `initWt`, `propWt`, `burn-time`, `Itot`, `avgThrust`, `peakThrust`, `delays`, `auto-calc-mass`, `auto-calc-cg`, `<data>` points `t`, `f`, `m`, `cg`), the auto-calculation rules (m(t) = initMass − (propMass / burnTime)·t; CG fixed at the engine centre) and the unit conventions (length mm, mass "g or kg", thrust N, time s).
- **Correction (2026-10-12):** the Prompt 0 record listed `docs/thrustcurve-api/rocksimformat.html` from https://www.thrustcurve.org/info/rocksimformat.html as the RockSim specification, "verified" by its page title. That file was in fact ThrustCurve's "Page Not Found" page (HTTP 404; the saved page's title was "Page Not Found"); the verification claim was wrong. The file has been deleted and the Apogee guide above replaces it.
- **ThrustCurve.org motor statistics and glossary:** `docs/thrustcurve-api/motorstats.html` (https://www.thrustcurve.org/info/motorstats.html, SHA-256 `8cfaacf3319bef69d2a7f1dff46f4ad2566a2496f2c21b53cca9a8612e6a1ec8`) and `docs/thrustcurve-api/glossary.html` (https://www.thrustcurve.org/info/glossary.html, SHA-256 `1702cc6e5b957f49af6f60090490c2fc0b9e4edfd83c93a719287f1e3855e287`), downloaded 2026-10-12. They define the quantities the API and the `.rse` attributes carry: total impulse (thrust × time over the burn, N·s), average thrust (total impulse over the normalised burn time), burn time (ends of the curve below 5 % of the maximum excluded, per NFPA 1125) and specific impulse ("the total impulse over the weight of the propellant", expressed in seconds). Used by the `.rse` reader's unit check (D-029). Judgment call: these pages are the publisher's documentation of the API's data fields, so they are taken as part of source 5; recorded here so the owner can object.
- **Provenance note:** neither format has a formal standards document. The RASP format originated with the RASP simulator and the RockSim format with Apogee Components' RockSim; ThrustCurve.org, which the project owner named as the source for these formats and whose API the app will use, publishes the RASP description and hosts Apogee's RockSim guide. Flagged in the Prompt 0 report as a judgment call.

### 6. BIPM SI Brochure, 9th edition (2019)

- **Citation:** Bureau International des Poids et Mesures. _The International System of Units (SI)_, 9th edition, 2019, version 4.01 (June 2026). ISBN 978-92-822-2272-0. https://doi.org/10.59161/AUEZ1291
- **File:** `docs/si-brochure-9-en.pdf`
- **URL:** https://www.bipm.org/documents/20126/41483022/SI-Brochure-9-EN.pdf
- **Downloaded:** 2026-10-11
- **SHA-256:** `5442eea2c680caf77a9d96879205a97f57c7c270b98a0bd0126c18fefe47e02c`
- **Pages:** 102
- **Verified:** page 1 is the BIPM title page "The International System of Units (SI), 9th edition 2019, V4.01 June 2026"; page 2 states the Creative Commons Attribution 4.0 licence and the ISBN. PDF metadata title "SI Brochure - 9th ed./version 4.01 EN", author BIPM.
- **Also used for:** the standard acceleration due to gravity g_n = 980.665 cm/s² = 9.80665 m/s², Appendix 1, 3rd CGPM (1901), declaration 3, printed page 154 (PDF page 44); used only to convert a specific impulse in seconds to an impulse per propellant mass in the `.rse` unit check (D-029), never as the simulator's gravity.

### 7. ThrustCurve.org API documentation

- **Files:** `docs/thrustcurve-api/api.html` (the API guide), `docs/thrustcurve-api/swagger.json` (the OpenAPI definition served by the API)
- **URLs:** https://www.thrustcurve.org/info/api.html and https://www.thrustcurve.org/api/v1/swagger.json
- **Downloaded:** 2026-10-11
- **SHA-256:** `221e4814360f7f7c1b27f2b2747dff67d9ab5452d644ee5e38865a8594aa8f6f` (api.html), `566009abab4e993283230061c98d47737df139649a70c887b9b6435c5ca04f8d` (swagger.json)
- **Verified:** the OpenAPI document defines the `/api/v1/search.json`, `/api/v1/download.json` and related endpoints used below; the guide page is the publisher's own description of the same API.

### 8. Wind tunnel and free-flight validation data (CLAUDE.md section 6.7), and NASA TR R-100 as model data

Status after Prompt 5 (D-053): **NASA TR R-100 is used as model data** (its Figure 12 curves of nose pressure drag against Mach number at fineness ratio 3 are transcribed in `reference/digitised/`, twice, with the disagreement recorded). It is a work of the United States Government (NASA, 1961) and in the public domain; the NTRS record carries no copyright notice. **NASA TN D-4013 and TN D-4014 are held out as validation-only data** and are never used to build or tune the model. NACA RM A53D02 is validation data.

Measured data only, never a source of equations. All four are U.S. government works; the NASA NTRS record for each carries the copyright determination `GOV_PUBLIC_USE_PERMITTED` and distribution `PUBLIC`, which is why they are committed to this repository.

| File                                       | Citation                                                                                                                                                                                                   | NTRS record and URL                                                                    | Pages | SHA-256                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `docs/naca-rm-a53d02-ntrs-19930087740.pdf` | James, Carlton S. and Carros, Robert J. _Experimental Investigation of the Zero-lift Drag of a Fin-stabilized Body of Fineness Ratio 10 at Mach Numbers Between 0.6 and 10_. NACA RM A53D02, 11 June 1953. | 19930087740, https://ntrs.nasa.gov/api/citations/19930087740/downloads/19930087740.pdf | 40    | `76ded4490acbe271b94f49d7cc2e588724feb034425186f97d0f722427819247` |
| `docs/nasa-tr-r-100-ntrs-19630004995.pdf`  | Stoney, William E., Jr. _Collection of Zero-lift Drag Data on Bodies of Revolution from Free-flight Investigations_. NASA TR R-100, 1961.                                                                  | 19630004995, https://ntrs.nasa.gov/api/citations/19630004995/downloads/19630004995.pdf | 194   | `44c9ac6046b83db16d156cbc26a608d632fbb844854eff568d50ad6ec99be51e` |
| `docs/nasa-tn-d-4013-ntrs-19670020050.pdf` | Ferris, James C. _Static Stability Investigation of a Single-Stage Sounding Rocket at Mach Numbers from 0.60 to 1.20_. NASA TN D-4013, July 1967.                                                          | 19670020050, https://ntrs.nasa.gov/api/citations/19670020050/downloads/19670020050.pdf | 64    | `44dc62a4131cf31b88fab20566f2a4b934a16be17388e099192d25236f08324a` |
| `docs/nasa-tn-d-4014-ntrs-19670020031.pdf` | Babb, C. Donald and Fuller, Dennis E. _Static Stability Investigation of a Sounding-Rocket Vehicle at Mach Numbers from 1.50 to 4.63_. NASA TN D-4014, June 1967.                                          | 19670020031, https://ntrs.nasa.gov/api/citations/19670020031/downloads/19670020031.pdf | 79    | `d698b06798ad806a4fd6463f02f4c9e2624cd944d7a7902f2c015dbb5a351064` |

Downloaded 2026-10-11 from NASA NTRS (the RASAero website lists the same reports; NTRS copies were preferred as the government archive). Titles, report numbers, authors and dates were taken from the NTRS records and the first pages. Detailed verification of title pages is done when Phase 2 builds test cases from them.

### 9. NIST Special Publication 811 (2008), Guide for the Use of the International System of Units (SI)

- **Citation:** Thompson, Ambler and Taylor, Barry N. _Guide for the Use of the International System of Units (SI)_. NIST Special Publication 811, 2008 edition. National Institute of Standards and Technology, Gaithersburg, MD, March 2008. U.S. Government work, not subject to copyright.
- **File:** `docs/nist-sp811-2008.pdf`
- **URL:** https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication811e2008.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `788dd8f0bcb0ec06e40c300690266742532a7e760a93be57764b77ed0ef3482f`
- **Pages:** 85 (PDF page = printed page + 12 in Appendix B)
- **Verified:** Appendix B.2 (printed p. 40) states that a factor in boldface is exact; B.8 lists inch 2.54 E−02 m (p. 50), foot 3.048 E−01 m (p. 49), pound (avoirdupois) 4.535 924 E−01 kg with footnote 22 "the exact conversion factor is 4.535 923 7 E−01" (p. 53), ounce (avoirdupois) 2.834 952 E−02 kg (p. 52), pound-force 4.448 222 E+00 N with footnote 23 "the exact conversion factor is 4.448 221 615 260 5 E+00" (p. 53), mile per hour 4.4704 E−01 m/s (p. 52), foot per second 3.048 E−01 m/s (p. 49), degree Fahrenheit (p. 48, 5/9 of a degree Celsius) and B.6 (printed p. 42) on the 1959 definition of the international foot as exactly 0.3048 m.
- **Used for:** the exact definitions of the inch, foot, pound, ounce, pound-force, mile per hour, foot per second and degree Fahrenheit behind the UI units toggle (UNIT-5 to UNIT-11, decision D-040). Approved by the owner implicitly through CLAUDE.md section 9 ("a units toggle"); recorded as an open question in `docs/progress.md` in case the owner prefers another source.

### 10. Blackman and Vigna (2018), Scrambled Linear Pseudorandom Number Generators

- **Citation:** Blackman, David and Vigna, Sebastiano. _Scrambled Linear Pseudorandom Number Generators_. arXiv:1805.01407v3 [cs.DS], 28 March 2022 (also ACM Transactions on Mathematical Software 47(4), 2021). Distributed by the authors under the arXiv licence; the reference code is in the public domain (CC0).
- **File:** `docs/blackman-vigna-2018-scrambled-linear-prngs-arxiv-1805.01407v3.pdf`
- **URL:** https://arxiv.org/pdf/1805.01407
- **Downloaded:** 2026-10-12
- **SHA-256:** `3aee2f264786742812e651595898fb3c06e184abf589c56c14cc7c7b205668f5`
- **Pages:** 32
- **Verified:** page 1 is the arXiv title page "Scrambled Linear Pseudorandom Number Generators, David Blackman, Sebastiano Vigna"; the reference code of xoshiro128** (Figure 1 and §5) gives the output rotl(s[1] × 5, 7) × 9 and the state update t = s[1] << 9; s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11); §7 recommends seeding the state from a SplitMix generator.
- **Used for:** RNG-1, the seeded generator behind wind turbulence (plan 0016) and Monte Carlo dispersion (plan 0017). Not a physics source; recorded under section 11 as the best-documented choice (D-050).

### 11. NACA Technical Note 4197 (Martin, 1958), Summary of Flutter Experiences as a Guide to the Preliminary Design of Lifting Surfaces on Missiles

- **Citation:** Martin, Dennis J. _Summary of Flutter Experiences as a Guide to the Preliminary Design of Lifting Surfaces on Missiles_. NACA Technical Note 4197, Langley Aeronautical Laboratory, February 1958. U.S. Government work (NTRS: "GOV_PUBLIC_USE_PERMITTED").
- **File:** `docs/naca-tn-4197-ntrs-19930085030.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19930085030/downloads/19930085030.pdf (NTRS document 19930085030)
- **Downloaded:** 2026-10-12
- **SHA-256:** `cd46997b270a6463c1a0dd3656af30b990dfbf14f3d72578bf622c45d29cecea`
- **Pages:** 23 (printed page = PDF page − 2 for the text; the appendix equations (1) to (18) are on printed pp. 11 to 14, PDF pp. 13 to 16)
- **Verified:** the appendix derives the bending-torsion flutter criterion from the Theodorsen and Garrick expression: eq. (3) at the three-quarter span, (4) r_α² = 4I/(mc²), (5) κ = πρc²/(4m), (6) ω_α = (π/2L)√(JG/I), (7) and (8) the taper function f₁ ≈ 1 + 1.87(1 − λ)^1.6, (10) J ≈ ct³/6, (12) G_E = 6JG/(ct³), (13) and (14) f₂ = (1 + 3λ)/(2(1 + λ)), (15) the criterion for constant thickness ratio, (16) with the aspect-ratio correction A/(A + 2), the stated approximation 1/(f₁²f₂²) ≈ (λ + 1)/2, (17) ρa² = γp, ε = 0.25 assumed, and (18) (V_f/a)² = G_E / [39.3 A³/((t/c)³(A + 2)) · (λ + 1)/2 · (p/p₀)] with G_E in pounds per square inch and p₀ the standard sea-level pressure (printed pp. 11 to 14).
- **Used for:** the fin flutter velocity (FLUT-1), approved by the owner in the completion prompt (Part A item 3).

### 12. NGA.STND.0036 (2014), Department of Defense World Geodetic System 1984

- **Citation:** National Geospatial-Intelligence Agency, Office of Geomatics. _Department of Defense World Geodetic System 1984: Its Definition and Relationships with Local Geodetic Systems_. NGA.STND.0036_1.0.0_WGS84, version 1.0.0, 2014-07-08 (formerly NIMA TR8350.2, 3rd edition). U.S. Government work.
- **File:** `docs/nga-stnd-0036-wgs84-2014.pdf`
- **URL:** https://earth-info.nga.mil/php/download.php?file=coord-wgs84 (NGA Office of Geomatics; the DTIC copy of TR8350.2 was unreachable, DTIC being "Under Maintenance" on 2026-10-12)
- **Downloaded:** 2026-10-12
- **SHA-256:** `5edc1cf7411d4df01cae5205ee19f661265c45a55cca60b9351f6ae5abade512`
- **Pages:** 207 (printed chapter-page numbers; chapter 4 begins at PDF p. 37)
- **Verified:** Table 3.1 (printed p. 3-5, PDF p. 32) a = 6378137.0 m, 1/f = 298.257223563; Table 3.5 "WGS 84 Ellipsoid Derived Geometric Constants" (printed p. 3-8, PDF p. 35) e² = 6.694379990141 × 10⁻³; Table 3.6 "WGS 84 Derived Physical Constants" (printed p. 3-9, PDF p. 36) γ_e = 9.7803253359 m/s², γ_p = 9.8321849379 m/s², k = 1.931852652458 × 10⁻³, m = 3.449786506841 × 10⁻³; section 4.2 eq. (4-1) (printed p. 4-1, PDF p. 37) γ = γ_e (1 + k sin²φ)/√(1 − e² sin²φ), k = bγ_p/(aγ_e) − 1; section 4.3 eq. (4-3) (printed p. 4-3, PDF p. 39) γ_h = γ [1 − (2/a)(1 + f + m − 2f sin²φ) h + (3/a²) h²], m = ω²a²b/GM, "when the geodetic height (h) is small", with the ellipsoidal method recommended "at moderate and high geodetic heights".
- **Used for:** GRAV-2 and GRAV-3 (D-060). The pre-approved substitute (Moritz, Geodetic Reference System 1980) was not needed; its constants give the OpenRocket value at 45° (D-060).

### 13. USAF Stability and Control DATCOM (1978 revision), sections 4.1 to 4.3

- **Citation:** Finck, R. D. (McDonnell Douglas Corporation), with D. E. Hoak et al. _USAF Stability and Control DATCOM_. Air Force Flight Dynamics Laboratory, Wright-Patterson Air Force Base, April 1978 revision (AFWAL-TR-83-3048, DTIC accession ADB072483). U.S. Government work. DTIC cover sheet: "NEW LIMITATION CHANGE TO Approved for public release, distribution unlimited" (authority AFWAL-DOOS W-PAFB letter), superseding the 1982 limitation printed in block 16 of the report documentation page.
- **Files:** `docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf` (PDF pages 495 to 920 of the DTIC scan: sections 4.1.3 to 4.2.2) and `docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf` (pages 921 to 1350: sections 4.2.3 to 4.5), extracted with `pdfseparate`/`pdfunite` because the full 119 MB scan exceeds GitHub's file limit; page numbers in citations are the full scan's PDF pages and the printed section-page numbers (for example 4.2.3.1-5).
- **URL:** DTIC https://apps.dtic.mil/sti/pdfs/ADB072483.pdf was "Under Maintenance" on 2026-10-12 (every request returned the maintenance page); the identical DTIC file was obtained from the Internet Archive's DTIC mirror item `DTIC_ADB072483`, https://archive.org/download/DTIC_ADB072483/DTIC_ADB072483.pdf, whose metadata lists the file as the original with MD5 `6481c0738615dddb6a0ca1df5b381d87` and SHA-1 `129019714888e00f30105ec47237f87b9e0c457b`. To be re-verified against DTIC when it returns.
- **Downloaded:** 2026-10-12
- **SHA-256 (full scan, 3134 pages):** `9b7b5e0f12bcabdf7f9e0054590977b2c79fdb51a319ff3982b0909495afbbfa` (MD5 matches the archive metadata)
- **SHA-256 (extracts):** `4d00a99b45a03c6dbf7b1f5c79af673c3007a66ce2f24fb671a808047f66e870` (pp. 495 to 920), `b22197f617b35da1c05ac01f35d1042e87456fb2e30683036b15654d5fe2fc83` (pp. 921 to 1350)
- **Verified:** the cover sheet and the report documentation page (PDF pp. 1 to 6: title, author, AFWAL-TR-83-3048, abstract); section 4.2.1.1 Body lift-curve slope (PDF p. 815 ff., "Revised June 1969"): subsonic eq. 4.2.1.1-a, transonic fairing, supersonic design charts 4.2.1.1-21a/b and the increments 4.2.1.1-22a/b; section 4.2.2.1 Body pitching-moment-curve slope (PDF p. 885 ff., "Revised February 1972"): eq. 4.2.2.1-c and -d, charts 4.2.2.1-23a/b; section 4.2.3.1 Body zero-lift drag (PDF p. 939 ff.): the transonic procedure (steps 1 to 6, eq. 4.2.3.1-c to -e, PDF pp. 942 to 943), figures 4.2.3.1-24 to -26 (PDF pp. 962 to 964); section 4.1.5.1 Wing zero-lift drag (PDF p. 722 ff.): eq. 4.1.5.1-a/-b, the transonic procedure (PDF pp. 728 ff.). The pages used by each register entry are cited there.
- **Used for:** approved by the owner in the completion prompt (Part A item 2, D-059) for transonic and supersonic body and fin aerodynamics and large-angle forces.

### 14. Missile DATCOM User Manual, 2014 revision

- **Citation:** Rosema, Christopher; Doyle, Joshua (U.S. Army AMRDEC); Blake, William B. (AFRL). _Missile Data Compendium (DATCOM) User Manual, 2014 Revision_. AFRL-RQ-WP-TR-2014-0281, Air Force Research Laboratory, December 2014 (DTIC accession AD1000581). "Approved for public release; distribution unlimited", cleared by 88 ABW Public Affairs (notice page).
- **File:** `docs/missile-datcom-user-manual-2014-dtic-ad1000581.pdf`
- **URL:** DTIC unreachable on 2026-10-12; obtained from the Internet Archive DTIC mirror item `DTIC_AD1000581` (MD5 `6bc20165a4a5970de1665921d29db5b4` as downloaded).
- **Downloaded:** 2026-10-12
- **SHA-256:** `20157ba7c1ee56b87115d239d36363eabf433d52c60fd0e8fbac8d9032b8d3c0`
- **Pages:** 116
- **Verified:** title, notice and signature pages (PDF pp. 1 to 2).
- **Used for:** background on the methods Missile DATCOM applies (a user manual; it gives no equations itself), consulted but not a source of equations.

### 15. The USAF Stability and Control Digital DATCOM, Volume II, Implementation of DATCOM Methods (1979)

- **Citation:** Williams, J. E. and Vukelich, S. R. (McDonnell Douglas Astronautics Company). _The USAF Stability and Control Digital DATCOM. Volume II. Implementation of Datcom Methods_. AFFDL-TR-79-3032, Volume II, Air Force Flight Dynamics Laboratory, April 1979 (DTIC accession ADA086558).
- **File:** `docs/digital-datcom-vol2-dtic-ada086558.pdf`
- **URL:** DTIC unreachable on 2026-10-12; obtained from the Internet Archive DTIC mirror item `DTIC_ADA086558` (MD5 `845a91e08092a6f2bccc4d231513e785` as downloaded).
- **Downloaded:** 2026-10-12
- **SHA-256:** `c4d06a551f298ea227bad797d496af206437dcbb9fd3ccb939e13697991fbb79`
- **Pages:** 161
- **Verified:** front matter (PDF pp. 1 to 3): "Approved for public release; distribution unlimited" on the cover and in block 10 of the report documentation page; "releasable to the National Technical Information Service (NTIS) ... available to the general public, including foreign nations".
- **Used for:** confirming how the DATCOM charts are tabulated in the Digital DATCOM where a chart reading needed a cross-check; not a source of equations.

### 16. NASA TN D-1958 (1963), Blue Scout 1/15-scale model at transonic speeds

- **Citation:** NASA Technical Note D-1958, _Transonic Aerodynamic Characteristics of Several Variations of a 1/15-Scale Model of the Blue Scout_ (Langley Research Center, 1963). NTRS document 19630012011.
- **File:** `docs/nasa-tn-d-1958-ntrs-19630012011.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19630012011/downloads/19630012011.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `c919984d93036c9fbe0b6116258e9adb706e5078ffbab0b645adf5a61c455cf3`
- **Verified:** symbols (PDF p. 5): coefficients on 0.0388 sq ft and 2.668 in, moments about 66.3 % of the overall length; tests (PDF p. 6): Langley 8-foot transonic pressure tunnel, Mach 0.60 to 1.03, Reynolds number 3.18e6 to 4.12e6 per foot, transition fixed 3.56 in from the apex, axial force adjusted to free-stream static pressure at the base; configuration list (PDF p. 4): D = body with fins, no base flare; figure 1(a) (PDF pp. 9 to 10), figure 5(c) and (d) (PDF pp. 21 to 22), figure 8(a) (PDF p. 31).
- **Used for:** held-out validation data (D-061): CP, normal-force slope and forebody axial force at Mach 0.6 to 1.03. Never used to build or tune the model.

### 17. NACA RM E50D28 (Luidens and Simon, 1950), the half-scale RM-10 with fins at Mach 1.49 to 1.98

- **Citation:** Luidens, R. W. and Simon, P. C. _Aerodynamic Characteristics of NACA RM-10 Missile in 8- by 6-Foot Supersonic Wind Tunnel at Mach Numbers from 1.49 to 1.98. II: Presentation and Analysis of Force Measurements_. NACA RM E50D28, 1950. NTRS document 19930086134.
- **File:** `docs/naca-rm-e50d28-ntrs-19930086134.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19930086134/downloads/19930086134.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `0e261cf3321ad38440ae669bc3a878dc8ed1500759b00a02af3131c4e6d3c2c8`
- **Verified:** summary (PDF p. 3): body alone, two fins and four fins at Mach 1.49, 1.59, 1.78, 1.98, Reynolds number about 30e6 on the length, drag independent of Mach, pressure 30 %, base 20 %, friction 50 % of the drag; apparatus (PDF pp. 6 to 7): Reynolds numbers 29.1, 29.2, 29.5, 31.1e6, sting-to-base diameter ratio 0.66 with negligible interference; figure 2 (PDF p. 19) geometry; figures 7(c), 8(c), 8(d) (PDF pp. 31, 34, 35).
- **Used for:** held-out validation data (D-061): CP and total drag with four fins at Mach 1.49 to 1.98.

### 18. NACA TN 2944 (Evans, 1953), compilation of RM-10 zero-lift drag from several tunnels and free flight

- **Citation:** Evans, A. J. _The Zero-Lift Drag of a Slender Body of Revolution (NACA RM-10 Research Model) as Determined from Tests in Several Wind Tunnels and in Flight at Supersonic Speeds_. NACA TN 2944, 1953. NTRS document 19930083685.
- **File:** `docs/naca-tn-2944-ntrs-19930083685.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19930083685/downloads/19930083685.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `f433811076e476b6912f5d43de9871e546bf333de534cf6e020f7899f7f7c773`
- **Verified:** summary (PDF p. 3): flight Mach 0.8 to 2.5 with fins, tunnel 1.5 to 2.4 with and without fins, unexplained differences between tunnel results with fins and flight; Table I (PDF p. 19) configurations (73.25 in flight models, magnesium alloy, polished, fins); figure 1 (PDF p. 20) geometry with 0.0504 L fin chord; figure 9(b) (PDF p. 34); figure 10 (PDF p. 35) Reynolds numbers; figure 13 (PDF p. 41).
- **Used for:** held-out validation data (D-061): free-flight total and base drag of the 73.25 in RM-10 models at Mach 0.9 to 2.5.

### 19. NASA TN D-3182 (Yuska, 1966), sounding rocket second stage with thick wedge fins at Mach 1.79 to 3.47

- **Citation:** Yuska, J. A. _Static Aerodynamic Characteristics of a Rocket Vehicle with Thick Wedge Fins and Sweptback Leading and Trailing Edges_. NASA TN D-3182, Lewis Research Center, January 1966. NTRS document 19660004864.
- **File:** `docs/nasa-tn-d-3182-ntrs-19660004864.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19660004864/downloads/19660004864.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `240e99bb1723d6c07b40158010c10ca0fc23a874f516293f1a1fa40465e5405c`
- **Verified:** summary and introduction (PDF pp. 3 to 4): three one-fifth scale models, Mach 1.79 to 3.47, approximately three-quarter-power nose, thick wedge fins; Tables I and II (PDF p. 8): tests and Reynolds numbers per foot; figure 1 (PDF p. 9) with the nose coordinate table and the fin section B; figures 4 and 5 (PDF pp. 14 to 15).
- **Used for:** held-out validation data (D-061): CP, normal-force slope and axial force of model A at Mach 1.79 to 3.47 (1.79 to 2.0 inside the validated range).

### 20. NASA TM X-1661 (1968), nose shape and fin geometry effects on a high-fineness-ratio sounding rocket at Mach 2.01

- **Citation:** _Effects of Nose Shape and Fin Geometry on Static Stability of a High-Fineness-Ratio Sounding Rocket_. NASA TM X-1661, 1968. NTRS document 19680027037.
- **File:** `docs/nasa-tm-x-1661-ntrs-19680027037.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19680027037/downloads/19680027037.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `92bcda5932377170e5c60bbdf18f62a30cb14f14183d0f08b435dba7fad70c16`
- **Verified:** summary and model description (PDF pp. 3 to 6): half-scale ARCAS variants, configurations 1 (l/d 18.20) and 2 (23.77), Mach 2.01, Reynolds number 9.8e6 per metre, conical, ogive and spherical noses, basic and high aspect ratio fins; figure 2(a) (PDF p. 10); figure 4 (PDF p. 16).
- **Used for:** held-out validation data (D-061): aerodynamic centre and axial force of the basic ARCAS configuration at Mach 2.01.

### 21. NACA RM L8A05 (1948), free-flight drag of fin-stabilised parabolic bodies

- **Citation:** _Flight Tests to Determine the Drag of Fin-Stabilized Parabolic Bodies at Transonic and Supersonic Speeds_. NACA RM L8A05, Langley Pilotless Aircraft Research Division, 1948. NTRS document 19930085317.
- **File:** `docs/naca-rm-l8a05-ntrs-19930085317.pdf`
- **URL:** https://ntrs.nasa.gov/api/citations/19930085317/downloads/19930085317.pdf
- **Downloaded:** 2026-10-12
- **SHA-256:** `eb3a607b5705d20084b5ede71802a8118d37590707a5e0ea793a97cf6743f192`
- **Verified:** summary and models (PDF pp. 3 to 4): fineness ratios 7.87 (Mach 0.58 to 1.19) and 12 (1.16 to 2.58), three untapered 60° swept fins of circular-arc section (t/c 10 % normal to the leading edge), wooden models, drag on the maximum frontal area; figure 1(a) (PDF p. 9) with the profile equation; figure 6 (PDF p. 21) Reynolds numbers; figure 8(a) (PDF p. 24).
- **Used for:** held-out validation data (D-061): free-flight total drag of the fineness-ratio 7.87 model A at Mach 0.62 to 1.17.

## Copyright status and the fetch script

This repository is private (checked 2026-10-11), so all documents are committed. If it is ever made public, the third-party copyrighted files must be removed from git: the Niskanen thesis (CC BY-NC-ND), the SI Brochure (CC BY 4.0, redistribution permitted but kept with the others for simplicity), the Barrowman 1967 thesis (a university dissertation reissued by NASA; copyright not confirmed as public domain), the Barrowman 1966 reprint (permissioned reprint), and the ThrustCurve.org pages. `fetch-docs.sh` re-downloads every document from its recorded URL and verifies it against the SHA-256 above, so the files can be restored without being in git. The U.S. government documents (USSA 1976, NACA RM A53D02, NASA TR R-100, TN D-4013, TN D-4014, NIST SP 811, NACA TN 4197, NGA.STND.0036, the DATCOM documents, TN D-1958, RM E50D28, TN 2944, TN D-3182, TM X-1661, RM L8A05) may stay committed; the arXiv paper is redistributable under its arXiv licence.

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

### 22. RASAero II Users Manual and RASAero II 1.0.2.0 (Rogers and Cooper)

- **Citation:** Rogers, Charles E.; Cooper, David. _RASAero II Users Manual_ (154 pp., PDF dated 2019-05-19) and RASAero II 1.0.2.0 (freeware), Rogers Aeroscience, https://www.rasaero.com.
- **Files:** not in `reference/docs/`: both are copyrighted and not redistributed. The manual is at `https://www.rasaero.com/dloads/RASAero II Users Manual.pdf` (SHA-256 `f43769678ddef8bbffb48f0bd1c6dbcd1e4a50f8659d6db8e968e9d20b4e6709`). `reference/rasaero/fetch-examples.sh` downloads the installer (SHA-256 `932e6ad7ad20d89f96594d0324dddc2a30a63324ddbb0c043dbce9a0bb56bef6`) and extracts its example designs and `rasp.eng` locally.
- **Downloaded:** 2026-10-14
- **Used for:** the meaning of the `.CDX1` fields (inches, pounds, feet, °F, mph; fin location from the tube's aft end, p. 13; two rail guides, p. 19; staging delays, p. 103; the Run Test output, pp. 89 to 92) and as a black-box comparison (D-114). Not a source of equations: nothing of RASAero's methods is reproduced, and no constant is tuned to its results (CLAUDE.md 6.7).

### RockSim `.rse` versions

Fetched 2026-10-12 from the same endpoint with `format: "RockSim"`. ThrustCurve holds no RockSim file for the H123W. `_download-meta-rse.json` holds the raw API metadata. Observed in all seven files (plan 0007): masses in grams (`initWt`, `propWt` equal to the RASP header values × 1000), a `<data>` column `m` running from `propWt` to 0 (propellant remaining, proportional to the impulse delivered so far, to 0.02 g) and a constant `cg` within 0.5 mm of half the length.

| File                 | Data file (simfile id, source, licence)  | SHA-256                                                            |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `Estes_C6.rse`       | 5f4294d20002e9000000036d, user, unstated | `14937c1ae15e1dd7fde5bec6a6d5a0664e5a0e8ff16fafb2e209f9760f4ba70a` |
| `Estes_D12.rse`      | 5f4294d20002e90000000370, user, unstated | `0cb0d288a118fcf7f37f76e7848dfef41178ac54b845e4c2b5151a5373636d2d` |
| `Estes_E16.rse`      | 5f923e8e1bca580004171651, user, PD       | `9dbd772e70437b84e07ec2f27ab1ce18b49b7cae72f6f814b758072143aeeb99` |
| `AeroTech_F39T.rse`  | 5f4294d20002e90000000385, user, unstated | `cf99deb83ba29469173a3cb5c60ba00a179860775ceb5f28693f6b029803fe60` |
| `AeroTech_G80T.rse`  | 5f9241441bca580004171726, user, PD       | `6763107b3e587078fc9143256aa4f3eab3f730fc900ccf9b02da51c21d0b07c1` |
| `AeroTech_H128W.rse` | 5f4294d20002e90000000397, user, unstated | `57a4ee1593205a43b56f9fdcd57ee72c327fdd60c0ab44014a60829b61abe5f3` |
| `AeroTech_H238T.rse` | 6ab556c184e29c0002a65271, user, PD       | `b36af96979cf20a3958c6cb932623027cfb5a79882747a8ee8aa6d2596252f95` |

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
