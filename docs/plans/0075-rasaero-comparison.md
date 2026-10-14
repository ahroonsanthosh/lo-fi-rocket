# Plan 0075: comparison with RASAero II, and the `.CDX1` importer

## 1. The owner's instruction and what it changes

CLAUDE.md section 6.7 keeps RASAero II out of automated comparison because it "is Windows-only and cannot be run headlessly". On 2026-10-14 the owner asked for "extensive and exhaustive testing against our source, rasaero and openrocket", then: "you will find a way to compare to rasaero yourself".

A feasibility study found the premise no longer holds (D-114):

- **Running it.** RASAero II 1.0.2.0 runs in this container under Wine 9.0 and wine-mono 8.1.0 on a virtual display, driven by a script. Each design takes about 65 s and gives three outputs: the Run Test aerodynamics, the Aero Plots CSV and the flight CSV.
- **Fidelity under Wine.** On the 24 example designs RASAero ships, the re-runs give the apogees the authors saved on Windows within 0.0008 %, and the maximum velocities within 0.0002 %.

What stays from section 6.7:

- **Its methods.** Nothing of RASAero is reproduced or reverse-engineered, and no constant is tuned to match it.
- **Its files.** Its program, installer and example files are not committed. A harness downloads them from rasaero.com when it runs, checking their SHA-256.
- **The repository.** Only our own inputs and the numeric comparison are committed.

## 2. Part 1: the `.CDX1` importer (section 6.7 item 3)

The format is plain XML (`<RASAeroDocument>`, `FileVersion` 2), in inches, pounds, feet, °F and mph. The 24 shipped examples cover these parts:

- **Nose cone.** Conical, tangent ogive or Von Kármán; the manual adds power law, LV-Haack, parabolic and elliptical. A blunt tip radius is possible.
- **Body tube.** With launch lug, rail guide and launch shoe, and fins.
- **Fin can.** A sleeve over the body's aft end, with its own fins and a shoulder.
- **Boat tail.**
- **Booster.** The second stage of a two-stage rocket.
- **Settings.** The surface finish, as one of eight named sand-roughness classes (manual Table 1). The launch site, the recovery devices and the simulations: motor, launch weight and CG, and RASAero's own results.

The mapping, each choice listed with the result where it approximates (rule 3):

- **Geometry.**
  - **Exact.**
    - Nose shapes: Von Kármán is Haack 0, LV-Haack is Haack 1/3, parabolic is parabolic 1, elliptical is ellipsoid.
    - Body tube, boat tail (a transition), fin can (its shoulder a transition from the body's diameter, then a tube).
    - Fins at "distance from the base of the tube".
  - **Approximated.** Hexagonal and hexagonal blunt-base fin sections become the double wedge and the wedge. A blunt nose tip becomes pointed.
- **Masses.** A RASAero file has no part masses, only the launch weight and CG with the motor.
  - **As-built.** The design's as-built mass and CG (D-089) are those less the matched motor's loaded mass at its place.
  - **Parts.** Nominal thin walls carry the inertias, listed as an approximation.
- **Rail guides.** RASAero computes the drag of two guides of the given diameter and height (manual p. 19), so the import has two solid buttons of that size, at a third and two thirds of the main tube (their place is not in the file; listed).
- **Launch lug and shoe.**
  - A launch lug of the given diameter and length, with a nominal thin wall (listed).
  - A launch shoe's frontal area becomes two buttons of that area (listed).
- **Surface finish.** The equivalent sand roughness of the named class, read as R_s (Niskanen's roughness height is the same quantity, Hoerner's admissible roughness).
- **Launch site.**
  - Elevation, rail length and angle are read as given.
  - The temperature is read as given, and the pressure is the standard atmosphere's at the elevation, as RASAero documents (manual p. 79). A given barometric pressure is the sea-level value: it is reduced to the elevation.
  - Wind as given, from the launch direction (a headwind).
- **Recovery.** Each enabled device: diameter, C_D and event (apogee, or altitude on the descent).
- **Boosters** (manual pp. 39 to 46). Each is a stage below the ones before it:
  - **Outline.** Its tube, fins and guides, with a conical transition of the file's length from the stage above's diameter to its own.
  - **A nested stage above** (its aft end inside the booster's front) keeps its parts, so that it flies on alone as it is. The booster's outline starts where they end, its aft end where the file puts it (listed).
  - **Masses.** A booster's lift-off weight and CG in the file are the whole stack's: RASAero's own flight output starts the AeroPac example at the booster's 61 lb and 77.5 in, then continues with the sustainer's 22.79 lb. Each stage's parts are scaled to its weight less the stages above and its motor (GEO-17 per stage).
  - **Staging** (manual p. 103). The booster separates its separation delay after its burnout; the stage above lights its ignition delay after that.
  - A booster the file's simulation does not include is left out, as RASAero leaves it out.
- **Motor.** Matched by designation and manufacturer in the library. RASAero's nozzle exit diameter is not used: the base drag takes the motor's own diameter (listed).
- **RASAero's own results.** Its apogee, maximum velocity and time to apogee are kept as the file's recorded prediction, and the measured apogee in the comments when it is written there ("Barometric Altitude = 3964 ft"), so that the app can show both against its own.

## 3. Part 2: the comparison

Three sets:

1. **The shipped examples.** For each example, our result in the displayed mode against:
   - RASAero's stored prediction, and our Wine re-run's;
   - the measured apogee (17 single-stage flights with measured apogees).

   Each is reported by Mach regime. The same RASP thrust curves are used (RASAero's `rasp.eng`, read by our `.eng` reader, MOT-1).

2. **The reference rockets R1 to R5.** Written as `.CDX1` and run in RASAero, compared with ours and OpenRocket's (three-way).
3. **ARCAS.** Built from TN D-4013 figure 1, run in RASAero, and compared with the wind tunnel CP and C_D. This is a three-way check against measured data.

Each difference is explained in the report from the methods' published descriptions (RASAero's manual, Niskanen, the DATCOM), not by tuning.

## 4. Tests

- **Importer.** Each example file reads and simulates. The geometry is checked by hand on CalIsp1 and on a fin can (Blister). The as-built mass and CG reproduce the file's launch weight and CG with the motor, to float precision.
- **Comparison.** An opt-in test (`RASAERO=1`, skipped without the downloaded files) writes `docs/reports/rasaero-comparison-data.md`; `docs/reports/rasaero-comparison.md` explains it.

## 5. Status (2026-10-14)

- **Done.**
  - The importer, with boosters, and its tests (`cdx1.test.ts`, on files written for the tests).
  - The app's File menu entry.
  - The harness: `reference/rasaero/fetch-examples.sh`, `install-wine.sh` and `run-rasaero.sh`, each re-run from scratch.
  - The opt-in comparison and its report.
- **Found.** Our displayed apogee is above every one of the 21 measured flights: +18.9 % mean below Mach 0.95, +29.0 % above. On RASAero's own drag curve our simulator is within 1.4 % of RASAero below Mach 0.95, so the cause is the drag model.
- **Owner decisions** (report section 7). The changes they would allow are separate plans:
  - the fin friction's Reynolds length;
  - the body form factor;
  - the rail guide and interference drag sources;
  - the thrust at altitude;
  - a note on the apogee.
- **Not yet done.**
  - Sets 2 (R1 to R5 written as `.CDX1`) and 3 (ARCAS).
  - RASAero's "Rogers Modified Barrowman" CP option, which this app does not have. Two examples use it.
