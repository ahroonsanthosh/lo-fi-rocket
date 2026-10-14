# Comparison with RASAero II and 21 flown rockets

**Date:** 2026-10-14. **Plan:** 0075. **Decision:** D-114. **Data:** `rasaero-comparison-data.md`, written by `packages/formats/src/rasaero-comparison.test.ts` (opt-in, `RASAERO=1`).

## 1. In short

- **What was compared.** RASAero II 1.0.2.0 ships 24 example designs. 21 of them carry the apogee their rocket really reached (altimeter or GPS) in the file's notes. Each design was read by our new `.CDX1` importer and flown three ways: our displayed mode, our OpenRocket-equivalent mode, and our simulator on RASAero's own drag curve.
- **Our trajectory engine agrees with RASAero's.** Flown on RASAero's drag curve, our apogee is within 1.4 % of RASAero's on every design below Mach 0.95 (mean −0.3 %). The motor, mass, rail, atmosphere, gravity and integration are therefore not where the two differ.
- **Our drag is too low for real amateur rockets.** On the 21 flown rockets:

  | Apogee against the measured one | Below Mach 0.95 (11 flights)    | Above (10 flights)               |
  | ------------------------------- | ------------------------------- | -------------------------------- |
  | RASAero II                      | +0.4 % mean, −8.0 to +11.5      | +3.9 % mean, −4.3 to +9.7        |
  | Ours on RASAero's drag curve    | +0.1 % mean, −8.2 to +11.9      | −2.5 % mean                      |
  | Ours, OpenRocket-equivalent     | +9.9 % mean, +2.1 to +21.1      | +18.0 % mean                     |
  | **Ours, displayed**             | **+18.9 % mean, +8.5 to +26.7** | **+29.0 % mean, +12.0 to +60.2** |

  Every one of the 21 rockets flew lower than our displayed mode predicts. The apogee is on the safe side for an altitude limit. It is on the unsafe side for an ejection delay chosen from our predicted coast: the charge would fire after the real apogee.

- **Why.** Term by term, our body friction agrees with RASAero's within 8 % and our base drag within 0.003. The difference is three terms that our source, Niskanen's thesis, simplifies or leaves out (section 4): the fin friction's Reynolds number, the fin and junction drag, and the rail guides. Two of the three have a sourced alternative in `reference/` (the USAF DATCOM); the third needs a source we do not have.
- **Nothing was changed in the model.** The sourced alternatives conflict with Niskanen's method by more than a test tolerance, which CLAUDE.md 11 (a) leaves to the owner. Section 7 lists the decisions, with the effect of each measured on these flights.

## 2. Why "within 0.01 %" cannot be shown against flights

The measured apogees are not known to 0.01 %. One file records four instruments on the same flight (Kinsel, A-601 rocket):

| Instrument                       | Apogee (ft) |
| -------------------------------- | ----------- |
| GPS                              | 42 771      |
| Adept barometric altimeter       | 42 231      |
| ARTS II barometric altimeter     | 40 113      |
| ARTS II integrated accelerometer | 44 924      |

They span 11 %. Barometric altimeters read the pressure against a standard atmosphere, not the day's. Accelerometers integrate their own errors. The wind, the launch angle actually flown, the motor's lot and the paint finish all change a real flight. RASAero's own results scatter by about ±6 % rms around these flights, which is the practical floor.

0.01 % is the right standard for things that have an exact answer: the importer's geometry and mass (section 5), the atmosphere tables, closed-form trajectories and the step-size convergence. Those are tested to that level elsewhere.

## 3. How it was run

- **RASAero II under Wine.** RASAero is Windows freeware, but it runs in this project's Linux container under Wine 9.0 with wine-mono 8.1.0 on a virtual display. Our own driver script clicks through its windows (`reference/rasaero/run-rasaero.sh`). The re-runs give the apogees its authors saved on Windows within 0.0008 %, and the maximum velocities within 0.0002 %.
- **Reproducing it.**
  - `reference/rasaero/fetch-examples.sh` downloads the installer from rasaero.com, checks its SHA-256 and extracts the examples without running anything.
  - `install-wine.sh` and `run-rasaero.sh` produce RASAero's own outputs. These are the Run Test drag breakdown (manual pp. 89 to 92), the Aero Plots CSV and the flight CSV.
  - None of RASAero's files are committed (D-114).
- **Our side.**
  - The importer reads each file (section 5), and its motor comes from RASAero's own `rasp.eng`.
  - The site, rail, wind and recovery are the file's.
  - The mass and CG at lift-off are the file's, exactly.
  - The flights use the displayed mode, the OpenRocket-equivalent mode, and the displayed mode with RASAero's power-off drag curve in place of our drag model (an imported drag curve, D-047).

## 4. Where the drag differs, term by term

RASAero's Run Test lists its drag by part and kind. For CalIsp1 at Mach 0.3 (C_D on the body's cross-section):

| Term                            | RASAero II | Ours (displayed) | Note                                          |
| ------------------------------- | ---------- | ---------------- | --------------------------------------------- |
| Body friction                   | 0.202      | 0.210            | agree (4 %)                                   |
| Body pressure                   | 0.011      | 0.000            | section 4.3                                   |
| Base                            | 0.063      | 0.062            | agree; Niskanen's eq. (3.94) would give 0.132 |
| Fin friction and pressure       | 0.040      | 0.051            | section 4.1                                   |
| Fin interference                | 0.039      | none             | section 4.2                                   |
| Fin base (blunt trailing edges) | 0.000      | 0.000            | hexagonal section: sharp edges                |
| Protuberances (two rail guides) | 0.090      | 0.030            | section 4.4                                   |
| **Total**                       | **0.445**  | **0.353**        | ours 21 % low                                 |

At Mach 0.3 our C_D is 9 to 41 % below RASAero's on 21 of the 23 single-stage designs, and 4 and 10 % above on IonDrive and Full Metal Jacket 2. Term by term (data file, last table):

- **Body friction:** ours is −7.5 to +4.0 % of RASAero's.
- **Base, DATCOM method (D-069):** ours is within 0.003 of RASAero's.
- **Fin terms:** RASAero's fin friction, pressure, interference and fin base together are 1.1 to 3.3 times our fin friction and pressure.
- **Rail guides and launch shoes:** RASAero's protuberance drag is 3.0 to 3.5 times ours for rail guides and about 10 times for launch shoes. They are 9 to 40 % of RASAero's total drag.
- **Body pressure:** RASAero has 0.009 to 0.047. Ours is zero for tangent ogive and Haack noses below Mach 0.8 (Niskanen eqs. 3.86 and 3.87, a smooth joint); it comes only from conical noses, shoulders and boat tails.

What RASAero computes inside is not known and is not reverse-engineered (CLAUDE.md 6.7). The explanations below rest on the published methods only.

### 4.1 Fin friction: the Reynolds number's length

- **Niskanen's method, which we follow.** One skin friction coefficient serves the whole rocket, at "the rocket's Reynolds number" (Niskanen p. 43, eqs. 3.78 and 3.85), whose length is the rocket's. A fin's boundary layer, though, starts at the fin's leading edge.
- **The DATCOM's method.** It computes each lifting surface's friction at the Reynolds number of its own reference length, which "for a wing (or wing panel ...)" is "the length of the mean aerodynamic chord" (section 4.1.5.1, eq. 4.1.5.1-a).
- **The effect.** On CalIsp1 the fin chord is a tenth of the rocket's length. Eq. (3.78) then gives C_f = 4.36 × 10⁻³ instead of 2.85 × 10⁻³, 1.53 times more. The fin friction would be 0.078, against RASAero's fin friction plus interference of 0.079.
- **On the 11 subsonic flights,** the DATCOM's length lowers our apogee error from +18.9 % to +15.5 % mean (prototype; not adopted, section 7).

### 4.2 Fin-body interference

Niskanen leaves interference drag out: "the interference drag and fin-tip vortices will be ignored as small compared to the other sources" (p. 41). RASAero lists a fin interference term about equal to its fin friction on every design. Hoerner's _Fluid-Dynamic Drag_, chapter 8, gives the junction drag of a wing on a body. It is approved source 4, but it is not in `reference/` (D-053). Without it no sourced value is available.

### 4.3 Body form factor and pressure

- **Niskanen.** The body's friction is multiplied by (1 + 1/(2 f_B)) (eq. 3.85).
- **The DATCOM.** Eq. 4.2.3.1-a uses 1 + 60/(l/d)³ + 0.0025 (l/d), about 3 % more for a fineness ratio of 19.
- **RASAero.** It lists a body pressure term of 5 to 10 % of the body friction.
- **On the 11 subsonic flights,** the DATCOM factor lowers our error from +18.9 % to +17.7 % mean. Together with section 4.1 it gives +14.3 %.

### 4.4 Rail guides

Three models disagree by a factor of about 30:

| Model                                             | C_D on the guide's frontal area | Source                                               |
| ------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| OpenRocket 24.12 (our comparison mode, DRAG-23)   | about 0.1 to 0.15               | measured as a black box (D-108)                      |
| Niskanen's rail pin (our displayed mode, DRAG-12) | about 0.87 at Mach 0.3          | p. 52: a launch lug with length = diameter           |
| RASAero II (from its Run Test output)             | about 2.6                       | not published; "particularly accurate" (manual p. 4) |

- **What decides it.** No measured rail guide drag is in `reference/`.
- **The size of the term.** On these designs RASAero's rail guides and shoes are 9 to 40 % of its total drag (Raven: 0.283 of 1.039; Proteus 6, with 1.5 in guides: 0.234 of 0.589 at Mach 0.6).
- **What it takes.** A sourced model needs Hoerner chapter 8 or wind tunnel data.

### 4.5 Above Mach 1

Two further effects apply to the supersonic and high-altitude flights. With RASAero's power-off drag curve, our apogee falls 5 to 23 % short of RASAero's on the highest flights (Qu8k to 120 000 ft, Proteus 6, AeroPac).

- **Thrust at altitude.** RASAero's "thrust of the rocket motor is varied with altitude using the entered thrust curve, the altitude of the rocket, and the exit diameter of the rocket motor nozzle" (manual p. 4): the pressure thrust grows as the outside pressure falls. Our model, like OpenRocket's and Niskanen's, uses the static test's thrust at every altitude. The effect grows with altitude and nozzle size. A source for the thrust equation (a propulsion text) would be a new approved source.
- **Power-on drag.** RASAero uses a lower drag while the motor burns. Our displayed mode removes the motor's area from the base while it thrusts (Niskanen p. 51), which has the same effect. The imported curve has only RASAero's power-off drag.

**Kinsel (Mach 2.5) is the outlier.** Our displayed apogee is +60 % and the maximum velocity +28 %, while on RASAero's drag the apogee is −7 %. Its long P-motor burn at high Mach magnifies the low drag. Its hexagonal fins are imported as a double wedge, whose supersonic wave drag differs from a hexagon's (listed, moderate).

## 5. The importer, checked exactly

On files written for the tests (`cdx1.test.ts`; RASAero's own are not committed):

- **Geometry.** It is in inches as the manual defines it. Fins sit at their distance from the tube's aft end. A fin can is a sleeve with its shoulder. A booster's transition starts behind a nested stage.
- **Mass.** It reproduces the file's lift-off weight and CG to 12 digits. In a two-stage file, the stack has the booster's figures and the sustainer alone its own: RASAero's flight output confirms that the booster's weight and CG are the whole stack's (AeroPac: 61 lb at 77.5 in at lift-off, then the sustainer's 22.79 lb).
- **Staging.** The booster separates its delay after its burnout, and the sustainer lights its delay after that (manual p. 103).

Every approximation is listed with its effect (rule 3):

- hexagonal fins as a double wedge;
- the place of the rail guides;
- nominal part masses scaled to the file's;
- a blunt nose tip as pointed;
- the nozzle exit diameter not used;
- a barometric pressure taken as the standard day's.

**Stability.** On the 21 single-stage designs that use RASAero's standard Barrowman method, our CP at Mach 0.3 is within 0.07 to 0.22 % of the rocket's length of RASAero's, and our C_Nα is 0.6 to 1.8 % higher (CalIsp1: 46.33 in against 46.25 in, 13.06 against 12.91 per radian). Kinsel and Qu8k use RASAero's "Rogers Modified Barrowman" option, which adds the body's interference factor and viscous crossflow (manual p. 4). There its C_Nα is 31 to 33 % above ours and its CP within 1.5 % of length.

## 6. OpenRocket

Our OpenRocket-equivalent mode reproduces OpenRocket 24.12's flights within 1.2 % on R1 to R5 (D-108). On these 21 flights it is +9.9 % below Mach 0.95 and +18.0 % above, closer than our displayed mode. It is closer through two errors that partly cancel:

- **Base drag.** Its base drag, Niskanen's eq. (3.94), is twice the DATCOM's and RASAero's on every design (0.132 against 0.063 on CalIsp1).
- **Rail guides.** Its rail guide drag is 6 to 10 times below Niskanen's and 20 to 30 times below RASAero's.

The missing fin friction and interference are the same as ours. This is recorded for the OpenRocket developers in `openrocket-issues.md` item 6. OpenRocket itself was not run on these designs; the figures are our replica's.

## 7. Decisions for the owner

| #   | Question                                                                                                                | Options                                                                                                                                                                           | Effect on the 11 subsonic flights (displayed mode, mean error) | Recommendation                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Fin friction: the rocket's Reynolds number (Niskanen eq. 3.85) or each fin set's own mean chord (DATCOM eq. 4.1.5.1-a)? | (a) keep Niskanen; (b) DATCOM in the displayed mode, Niskanen kept in the OpenRocket-equivalent mode                                                                              | +18.9 % → +15.5 %                                              | (b): the fin's boundary layer starts at its own leading edge; both are approved sources                                                                            |
| 2   | Body form factor: Niskanen's (1 + 1/(2 f_B)) or the DATCOM's eq. 4.2.3.1-a?                                             | (a) keep; (b) DATCOM in the displayed mode                                                                                                                                        | +18.9 % → +17.7 % (with 1: +14.3 %)                            | (b), with 1                                                                                                                                                        |
| 3   | Rail guide drag: a source for a measured or sheltered-protuberance model                                                | (a) supply Hoerner, _Fluid-Dynamic Drag_, chapter 8 (approved source 4, not in `reference/`); (b) supply measured rail guide drag data; (c) keep Niskanen's rail pin              | up to a quarter of the drag on designs with large guides       | (a), the approved source; this item and item 4 are most of the remaining gap                                                                                       |
| 4   | Fin-body interference drag                                                                                              | (a) Hoerner chapter 8 (as item 3); (b) keep it ignored as Niskanen does                                                                                                           | unknown until sourced                                          | (a)                                                                                                                                                                |
| 5   | Thrust at altitude from the nozzle exit area                                                                            | (a) approve a propulsion text (for example Sutton and Biblarz, _Rocket Propulsion Elements_, chapter 3) and add the nozzle exit diameter to the motor; (b) keep the static thrust | high-altitude flights only                                     | (a) for Phase 5, the liquid engine goal needs it too                                                                                                               |
| 6   | Until the drag is fixed: tell the user the apogee is likely high                                                        | (a) a note on every flight's apogee, with these figures; (b) nothing beyond `known-limitations.md`                                                                                | none (honesty)                                                 | (a). It was prototyped as a warning, but the example rocket is reviewed to show no warnings (review screenshot 13), so its place in the screen is the owner's call |

## 8. Limits of this comparison

- **The examples are RASAero's own showcase.** Its authors chose them, and their measured altitudes are of mixed quality (barometric, GPS, accelerometer). They are the only flight data available with full designs. They are independent of our model: nothing was fitted to them.
- **Our side of the import is approximate.** The import's approximations (section 5) apply to our side only.
- **Three designs have no measured apogee:** CancerDescending, IonDrive and Proteus 6.
