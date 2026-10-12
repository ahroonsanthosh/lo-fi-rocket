# Prompt 5 final report (2026-10-12)

Branch `claude/inspiring-tesla-xxp0hh`, plans 0019 to 0023, commits from 648c1d1 to the one carrying this file. Everything below was done under autonomous mode (CLAUDE.md section 11); nothing was tuned to a reference. The `main` branch the owner intends to create did not exist when this was written, so the work stayed on the designated branch.

## 1. Wind tunnel validation by Mach regime (CLAUDE.md 6.7 item 1)

Full tables, method and uncertainties: `docs/reports/wind-tunnel-validation.md` (printed by `packages/formats/src/wind-tunnel.validation.test.ts`). Data: NASA TN D-4013 and TN D-4014 (ARCAS half-scale model, sting mounted, held out) and NACA RM A53D02 (fin-stabilised body, free flight), digitised in `reference/digitised/wind-tunnel-validation.json` with two passes where the comparison depends on them.

| Regime                 | CP (ARCAS), rms / worst, % of body length            | Forebody drag (ARCAS, thick double-wedge fins as 'rounded')                     | Total drag (NACA, thin sharp fins as 'square')      |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| subsonic (< 0.8)       | 2.6 / 3.5                                            | +17 % mean (rms 17 %, worst 19 %)                                               | +23 % (one point, Mach 0.6)                         |
| transonic (0.8 to 1.2) | 5.0 / 7.3                                            | rms 19 %, worst +40 % at Mach 0.9 (rise too early), within 10 % from Mach 1.0   | rms 37 %, worst +45 % at Mach 0.91 (rise too early) |
| supersonic (1.2 to 5)  | 18 / 27, conservative (predicted CP too far forward) | over-predicted 1.1× at Mach 1.5 to 2.1× at Mach 4.6 (the fin leading-edge term) | rms 8.7 %, mean −0.1 %, worst 16 %                  |
| hypersonic (> 5)       | no data                                              | no data                                                                         | rms 23 %, mean +20 % (outside the thesis's scope)   |

What the comparison established, with the cause in each case:

- The transonic fin force interpolation (BAR-12) was chosen among three candidates against the ARCAS CP: cubic Hermite, rms 5.0 % of body length against 5.6 (linear) and 5.7 (quadratic); the residual is systematic (the measured CP moves 16 % aft across the band, the model 6 %) and not an interpolation question (D-056).
- The supersonic CP error grows with Mach because the body normal force is Mach independent in the sources while the fin term falls as 1/β; the thesis reports the same (p. 91). The direction is conservative.
- The supersonic drag error is the fin section: Niskanen's fin pressure drag has rounded, square and airfoil sections only; the thick double-wedge ARCAS fins modelled as 'rounded' contribute more drag than the whole measured forebody above Mach 3, while the thin sharp NACA fins are within 10 %.
- The transonic drag rise begins too early in both models (the rounded-leading-edge law and the nose rise of eq. 3.87).
- Proposal (CLAUDE.md 6.7): approve the public USAF Stability and Control DATCOM for the supersonic body normal force and the sharp-section fin wave drag, validated afterwards against the same held-out data (D-057). It would also cover the large-angle fin force (D-059).

## 2. Reference comparison including R5 (CLAUDE.md 7.4; Phase 2 tolerances apogee 5 %, maximum velocity 3 %)

OpenRocket 24.12 figures from `reference/rockets/values.csv`; ours in the OpenRocket-equivalent modes, RK4 at 0.002 s (`simulate.openrocket.test.ts`, `docs/reports/phase-2-acceptance.md`).

| Rocket, wind | Apogee ours (m) | OpenRocket | Diff   | Max velocity ours (m/s) | OpenRocket | Diff   | Max Mach |
| ------------ | --------------- | ---------- | ------ | ----------------------- | ---------- | ------ | -------- |
| R1, 0 m/s    | 168.87          | 167.045    | +1.1 % | 62.26                   | 61.972     | +0.5 % | 0.18     |
| R1, 5 m/s    | 160.96          | 160.329    | +0.4 % | 61.34                   | 61.160     | +0.3 % | 0.18     |
| R2, 0 m/s    | 804.80          | 820.806    | −2.0 % | 244.60                  | 245.821    | −0.5 % | 0.72     |
| R2, 5 m/s    | 797.43          | 813.612    | −2.0 % | 244.12                  | 245.364    | −0.5 % | 0.72     |
| R3, 0 m/s    | 812.79          | 832.929    | −2.4 % | 233.19                  | 233.975    | −0.3 % | 0.69     |
| R3, 5 m/s    | 806.71          | 826.785    | −2.4 % | 232.77                  | 233.568    | −0.3 % | 0.69     |
| R4, 0 m/s    | 691.99          | 692.685    | −0.1 % | 136.12                  | 136.122    | −0.0 % | 0.40     |
| R4, 5 m/s    | 672.53          | 674.261    | −0.3 % | 135.51                  | 135.558    | −0.0 % | 0.40     |
| R5, 0 m/s    | 1599.29         | 1560.531   | +2.5 % | 372.46                  | 369.487    | +0.8 % | 1.10     |
| R5, 5 m/s    | 1593.64         | 1555.050   | +2.5 % | 372.20                  | 369.220    | +0.8 % | 1.10     |

Every figure is within tolerance; rail exit within 0.3 %, ground-hit speed within 0.01 %, time to apogee within 2 %, flight time within 2.5 % for all five. R5 needed the transonic nose drag (D-055), the fin interpolation (D-056) and the supersonic roll damping (D-058); its transonic part lasts about 0.5 s.

## 3. Ballistic descents (Part B item 4) and golden series (item 5)

`simulate.ballistic.test.ts`: without wind every rocket falls exactly tail-first and the six-degree-of-freedom run ends at the 90° limit at apogee with the ascent intact (D-046); with 5 m/s of wind every rocket weathercocks, noses over and lands nose-first at its terminal speed (38.8, 64.1, 69.3, 82.0, 99.2 m/s for R1 to R5; 42 to 148 m downwind), within 1 % of the three-degree-of-freedom fall, whose ground-hit speed never exceeds the terminal speed of the force balance and reaches it within 1.2 % on the long falls. The still-air tail-first fall needs the large-angle fin law (D-059). Golden time series for R1 to R5 with both winds are in `packages/formats/golden/flights/` and compared exactly by `simulate.golden.test.ts`.

## 4. Every decision made in Prompt 5

| Decision | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-053    | The owner's Part A answers recorded (TR R-100 as model data with two digitisations; ARCAS held out; Box–Muller statistical verification accepted; SciPy tableau cross-check; deployment speed as a labelled rule of thumb; NIST SP 811; WGS 84 as the gravity source; pull requests into `main` once it exists).                                                                                                                                                                                                   |
| D-054    | WGS 84 gravity waits for NIMA TR8350.2: every download from this environment failed; nothing implemented from memory.                                                                                                                                                                                                                                                                                                                                                                                              |
| D-055    | TR R-100 Figure 12 digitised twice (uncertainty 0.005, parabolic family to 0.016); the panel (b) curve identities of both passes were reversed and are corrected from the report's text and panel (a); conventions of the nose data model (linear in Mach, last value held, parameter interpolation with Stoney's cone as the endpoint, the (3.87) join from the first shared data point, the low-speed value kept where the data lie below it, the x^1/4 and ellipsoid rise fitted from Mach 1.2 with a warning). |
| D-056    | Transonic fin normal force: cubic Hermite between (3.40) at 0.8 and (3.49) at 1.2, chosen among three candidates against the held-out ARCAS CP (rms 5.0 against 5.6 and 5.7 % of body length).                                                                                                                                                                                                                                                                                                                     |
| D-057    | Wind tunnel validation conventions (forebody drag for the sting-mounted model, nearest fin sections, regimes) and the reported errors; DATCOM proposed.                                                                                                                                                                                                                                                                                                                                                            |
| D-058    | Supersonic roll damping from eq. (3.72) with exact trapezoid strip integrals; linear in Mach across the band (no source form, no data).                                                                                                                                                                                                                                                                                                                                                                            |
| D-059    | Large-angle fin force not implemented (Hoerner absent); three sourced alternatives, DATCOM recommended; ballistic and golden findings recorded.                                                                                                                                                                                                                                                                                                                                                                    |

Conventions recorded inside those decisions and not elsewhere: the regime warnings carry no Mach number (one line per flight) and name the validation status; `designFlightWarnings` has a `supersonic` code; the candidate interpolations stay selectable for the record only.

## 5. Updated audit summary: what the app can and cannot be trusted for

| Use                                                                            | Status                           | Basis                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stability (CG, CP, margin) at subsonic speed                                   | trusted                          | CG within 0.0004 % and CP within 0.035 % of OpenRocket (R1 to R5); CP within 3.5 % of body length of wind tunnel data below Mach 0.8                                                                                             |
| Apogee, velocities, rail exit, descent for subsonic flights                    | trusted within the stated bounds | apogee within 2.5 %, maximum velocity within 0.8 %, rail exit 0.3 %, ground hit 0.01 % of OpenRocket for R1 to R4; drag over- rather than under-predicted (15 to 20 %) for polished bodies against wind tunnel data              |
| Transonic flights (Mach 0.8 to 1.2)                                            | usable with the warning          | R5 within 2.5 % of OpenRocket; against wind tunnel data the drag rise comes too early (apogee on the low side for rockets peaking at Mach 0.8 to 0.95) and the CP is within 7 % of body length; every result carries the warning |
| Supersonic stability margin                                                    | a lower bound                    | CP conservative by 5 % of body length at Mach 1.5 and 27 % at Mach 4.6 (ARCAS); the warning says so                                                                                                                              |
| Supersonic drag and apogee                                                     | fin-section dependent            | thin sharp fins within 10 % (NACA); thick fins with the rounded section over-predicted up to twofold at Mach 4; sharp wedge sections not representable (DATCOM proposed)                                                         |
| Hypersonic (> Mach 5)                                                          | not validated                    | outside the thesis's scope; one data set, +20 % mean                                                                                                                                                                             |
| Ballistic descent in still air                                                 | not simulated past the turn-over | D-046, D-059: the apogee and the ascent are valid                                                                                                                                                                                |
| Ballistic descent in wind, deployment at apogee, descent under canopy          | trusted                          | lands at the terminal speed; ground-hit speed within 0.01 % of OpenRocket with a canopy                                                                                                                                          |
| Rolling rockets (fin cant)                                                     | not available                    | roll forcing not implemented; roll damping across all regimes (D-058)                                                                                                                                                            |
| Gravity latitude dependence                                                    | not available                    | WGS 84 document awaited (D-054); the sea-level parameter is user-set                                                                                                                                                             |
| Monte Carlo dispersion, wind profiles, turbulence, liquid-engine mass profiles | as documented in `docs/audit.md` | unchanged by Prompt 5                                                                                                                                                                                                            |

Every limitation record is in `docs/known-limitations.md` (34 records); the audit tables in `docs/audit.md` carry a dated update section.

## 6. Open for the owner

1. Large-angle fin force: approve a source (D-059; DATCOM recommended).
2. DATCOM for the supersonic body normal force and the sharp-section fin wave drag (D-057).
3. NIMA TR8350.2 in `reference/docs/` for the gravity formula (D-054).
4. `.CDX1` sample files; altimeter data (on hold as instructed).
5. The `main` branch: once it exists, work moves to new branches with pull requests.
