# Independent physics review

Branch reviewed: `claude/inspiring-tesla-xxp0hh` at 109d117 (identical to `main` at the time of review). Date: 2026-10-12.

The reviewer did not write this code and set out to find mistakes. No project file was changed; everything produced by the review is in `docs/review/`.

**Out of scope.** Another session is rewriting these areas, so they were not reviewed:

- transonic and supersonic aerodynamics (BAR-12, DRAG-15 to DRAG-17, AERO-6, AERO-7)
- fin flutter
- large-angle forces
- in-flight stability

**Severity scale.**

| Severity | Meaning |
| --- | --- |
| critical | could give a wrong safety-relevant result |
| major | wrong result elsewhere |
| minor | quality or documentation |

**Finding IDs** are prefixed by area:

| Prefix | Area |
| --- | --- |
| U | units and atmosphere |
| G | geometry and mass |
| B | Barrowman CP and stability |
| M | motors |
| F | flight, integrators, events, recovery, wind, Monte Carlo |
| R | independent recalculation |

The reviewer re-read the code at the cited lines for every critical and major finding. Findings marked "(confirmed by re-reading)" were checked a second time at the code level by a different reviewer, not only by the probe that found them.

**Source page numbering.** Page numbers are the source's printed page numbers. To get the PDF page:

- Niskanen 2009: add 10.
- USSA 1976: add 16 in Part 1, and 15 in the tables.

## Summary

| Area                              | Critical | Major | Minor |
| --------------------------------- | -------- | ----- | ----- |
| Units and atmosphere              | 0        | 3     | 13    |
| Geometry, mass, CG, inertia       | 1        | 1     | 6     |
| Barrowman CP and stability        | 1        | 0     | 4     |
| Motors and burn                   | 1        | 3     | 14    |
| Flight, integrators, events, MC   | see F section | | |
| Independent recalculation         | 0        | 0     | 4     |

The core equations are correct. Every in-scope register entry was compared symbol by symbol with the cited page. No sign, constant or exponent error was found in:

- the 1976 atmosphere
- the unit conversions
- the nose and transition profiles
- the mass, CG and inertia integrals
- subsonic Barrowman CP as given by Niskanen
- the motor rules (MOT-1 to MOT-6)

The independent recalculation of R1 to R4 reproduces the app's numbers:

- mass and CG to 0.0005 %
- CP to rounding

Both match OpenRocket to within 0.04 %.

The problems are elsewhere:

- inputs that are inconsistent or out of range and are accepted without a message (rule 3)
- missing consistency checks between components
- defaults in the app that put wrong numbers into the physics
- missing warnings when recovery will not happen
- stale documentation

---

## Units and U.S. Standard Atmosphere 1976

### U-1 (major): a temperature override shifts the whole profile up to 86 km

**Where:** `packages/physics/src/atmosphere/ussa1976.ts:127-154` (`buildLayers`) and `:217-222` (`layersFor`).

**What the code does.** Every layer base temperature is re-chained from the overridden sea-level temperature, so an offset at the pad becomes the same offset in the stratosphere. The reviewer computed these independently:

| Override at sea level | Altitude | Standard T | Overridden T | Speed of sound vs standard | Density vs standard |
| --- | --- | --- | --- | --- | --- |
| 313.15 K | 15 km | 216.65 K | 241.65 K | ×1.056 | ×1.097 |
| 313.15 K | 25 km | 221.55 K | 246.55 K | ×1.055 | ×1.290 |
| 253.15 K | 15 km | 216.65 K | 181.65 K | ×0.916 | ×0.827 |
| 253.15 K | 25 km | 221.55 K | 186.55 K | ×0.918 | ×0.611 |

**What the sources say.** Niskanen §4.1.1 p. 55 says only that the values "are simply assigned to the first layer of the atmospheric model". It says nothing about the higher layers.

**Documentation and tests:**

- `docs/known-limitations.md:191` says the override shifts "the whole first atmospheric layer". That is not what the code does.
- Plan 0001 (line 88) said this needed its own source and plan. No decision records it.
- No test checks an override above 11 km.

**Suggested fix.** Under CLAUDE.md rule 4, put the choice to the owner. The options are:

- shift layer 0 only, or
- keep the whole-profile shift, with a decision record and a warning above 11 km.

Then add a test above 11 km.

### U-2 (major): the temperature and pressure overrides have no plausibility range

**Where:** `ussa1976.ts:181-188`. The only checks are T > 0 and P > 0.

**What happens with implausible values:**

| Input | Result |
| --- | --- |
| Sea-level override of 150 K | Accepted; gives 78.5 K at 20 km. |
| Sea-level override of 50 K | Throws `NonFiniteResultError: pressure produced a non-finite value (NaN)` at 11 km, with no mention of the override. |
| Site at 9 000 m with 10 K | Returns T_M = 0.28 K and a speed of sound of 10.6 m/s at 10.5 km, with no error. |
| Site at 3 000 m with 1 K | Implies a sea-level pressure of 5.5e11 Pa. |
| Pressures of 1e9 Pa and 1e-300 Pa | Accepted. |
| Full flight with a 20 K override | Completes with no warning: apogee 15 m against about 35 m. |

This breaks CLAUDE.md rule 3 and §8.

**Suggested fix:**

- Define a plausibility range with a source.
- Before simulating, check that T_M > 0 at every layer top.
- Report failures with an `InvalidInputError` that names the override.

### U-3 (major): the app pre-fills sea-level values as values "at the pad" (confirmed by re-reading)

**Where:**

- `packages/app/src/components/LaunchEditor.tsx:63-69` sets 288.15 K and 101 325 Pa when the override box is ticked, whatever the pad altitude.
- `packages/formats/src/design/to-physics.ts:214-221` then passes them as `at: { altitude: site.altitude }`.

**Effect.** At a 1 500 m pad the standard values are 278.40 K and 84 559.7 Pa, so the pre-fill makes pad density 15.8 % too high. A user who ticks the box and edits only the temperature keeps the wrong pressure without knowing it. On the R1 test probe, apogee is 35.22 m with the standard atmosphere and 34.49 m with the default override.

**Suggested fix.** Pre-fill from the standard atmosphere at the pad altitude. Refresh the values, or warn, when the pad altitude changes.

### U-4 (minor): leaving the −5 000 to 86 000 m range aborts the flight with no time or context

**Where:** `simulate.ts:273` does not catch the atmosphere error, and `validateLaunch` checks only that the pad altitude is finite.

**What happens:**

- A pad at 85 990 m throws "geometric altitude is invalid: received 86000.10067698236".
- A pad at −6 000 m throws the same kind of error.
- In both cases the partial trajectory is lost.

The altitude field uses `rule="any"`, although `docs/known-limitations.md:27` promises it rejects out-of-range values.

**Suggested fix.** Validate the pad altitude at the boundary, and end the flight with an event that names the time and altitude.

### U-5 (minor): UNIT-4 does not reject temperatures below absolute zero

`docs/equations.md:31` says it does. In fact:

- `celsiusToKelvin(-300)` returns −26.85 K.
- `fahrenheitToKelvin(-1000)` returns −300.18 K.

There is no test for either. **Fix:** reject the input, or correct the register.

### U-6 (minor): the Fahrenheit conversion is not exact at 212 °F

`convert.ts:327` claims "exact at 212 °F", but the function returns 373.15000000000003. The test at `convert.test.ts:180` uses `toBeCloseTo`, which hides this. **Fix:** correct the comment, or assert the exact value.

### U-7 (minor): the constant comments misquote USSA76 Table 2 and hide misprints in the standard

**Where:** `ussa1976.ts:52,60`.

**What the standard actually prints:**

- Table 2 (p. 2) prints R\* as "8.31432 × 10⁻³" and r₀ as "6.356766 × 10⁶ km". The comments quote both as × 10³.
- p. 4 prints β as "1.458 × 10⁶", with no minus sign.

The values used in the code are correct, from pp. 3, 4, 8 and 19.

**Fix.** Record the misprints in a decision, as D-021 does for the Sutherland constant, and quote the pages accurately.

### U-8 (minor): the worked arithmetic in `ussa1976.test.ts` contains errors

| Line | Comment shows | Correct value | Consequence |
| --- | --- | --- | --- |
| 64 | 284.04272 | 284.04373 | |
| 67 | 0.22335863 | 0.22335957 | The product shown gives 22 631.97, not the asserted 22 632.064. |
| 74 | 0.24190372 | 0.24190850 | The product shown gives 5 474.78, not the asserted 5 474.889. |
| 172 | exponent with the wrong sign | −17.0816 | |

The asserted values are right. The working shown could not have produced them, which weakens the CLAUDE.md §7.1 claim that they were worked by hand. **Fix:** correct the working.

### U-9 (minor): gaps in the atmosphere tests

- The kinetic-temperature column of Table I is never compared (86 km prints 186.87 K).
- The 85 km viscosity test only checks a 0.05 % band.
- The `seaLevelEquivalent` branch that rejects a sea-level T at or below 0 K is never exercised.
- No test uses a negative site altitude.
- No test covers an override above 11 km.

### U-10 (minor): stale statements in `docs/known-limitations.md`

| Line | Statement | Reality |
| --- | --- | --- |
| 35 | Overrides are "a later task". | They are implemented. |
| 36 | Results carry a "1976 standard" label. | The app has no such label. |
| 27 | The altitude field rejects out-of-range values. | It does not (U-4). |
| 41 | The tables are uncorrected for M/M₀. | The 86 km row on p. 68 is corrected. |
| 191 | The override shifts the "whole first layer". | It shifts every layer (U-1). |

### U-11 (minor): `docs/audit.md:81` names the wrong test file

It cites the wrong file for the 57 atmosphere table rows. They are in `ussa1976.tables.test.ts`.

### U-12 (minor): the app re-implements the unit conversions

`packages/app/src/units/display.ts` does its own conversions instead of calling UNIT-1 to UNIT-11:

- The mm and g specs compute `x*(1/1000)`. For about 15 % of inputs this differs from `x/1000` by 1 ulp, which breaks the project's own "x / 1000" rule.
- The °C and °F conversions are written inline, so the code users actually run is not the registered implementation.

### U-13 (minor): the temperature field's error message gives the wrong unit

The positive rule is checked in kelvin, but `QuantityField.tsx:26` reports "must be greater than 0 °C".

### U-14 (minor): geometric and geopotential altitude share the `Metres` brand

Passing H where Z is expected compiles. At 10 km that is a 15.7 m altitude error. CLAUDE.md §5 asks for branded types so unit mistakes fail to compile, and m′ is a distinct unit in the source. **Fix:** add a `GeopotentialMetres` brand.

### U-15 (minor): SI Brochure citations use the 2019 titles

The stored file is V4.01 (2026), where §4 and Table 8 are both titled "Non-SI units". The quoted content is correct; only the titles need updating.

### U-16 (informational): a more direct citation exists for UNIT-11

NIST SP 811 p. 48 prints T/K = (t/°F + 459.67)/1.8 directly. UNIT-11 can cite that line instead of deriving it through UNIT-4.

---

## Geometry, mass, CG and inertia

### G-1 (critical): a nose shoulder wall thicker than the shoulder radius gives negative or wrong mass with no error (confirmed by re-reading)

**Where:** `packages/physics/src/geometry/components.ts:193-200`. The code checks only that the shoulder length, radius and wall are positive, then calls `hollowCylinder(s.radius, s.radius - s.wallThickness, ...)`. The inner radius can go negative and is then squared, so the output looks valid. `finiteResult` does not catch it because the numbers are finite.

**Evidence.** Conical nose, 0.1 m long, 0.025 m base radius, 2 mm shell, with a shoulder of 20 mm radius and 30 mm length:

| Shoulder wall | Mass | Notes |
| --- | --- | --- |
| 15 mm | 0.0502 kg | correct |
| 30 mm | 0.0432 kg | less than a solid shoulder |
| 50 mm | −0.0322 kg | cgX 0; I_rot −2.6e-5 kg·m²; I_long −5.6e-4 kg·m² |

On the whole of R1, a 60 mm wall on a 24 mm shoulder gives:

| | Mass | CG |
| --- | --- | --- |
| With the bad wall | 0.1374 kg | 0.3567 m |
| Correct | 0.1483 kg | 0.3359 m |

That is a CG error of 0.42 calibers.

**Related gaps:**

- A shoulder radius larger than the nose base radius is also accepted.
- `packages/formats/src/design/validate.ts:165-171` and the app editor require only that the wall is positive.
- `docs/audit.md:89` claims every physics function validates its inputs.

**Suggested fix:**

- Require the shoulder wall to be smaller than the shoulder radius, as tubes already do at `components.ts:224`.
- Require the shoulder radius to be no larger than the nose base radius.
- Add a property test that every component's mass is positive for random valid inputs (see B-4).

### G-2 (major): a wall at or above the radius silently becomes a solid part

**Where:**

- `revolution.ts:67-71` clamps the inner radius to zero.
- `components.ts:189-191` and `:213-214` check only that the thickness is positive.

**Evidence:**

- A conical nose with a 25 mm radius gives exactly the solid-nose mass (0.06545 kg) for walls of 25 mm, 50 mm and 1 m.
- A transition with a 50 mm wall returns the solid frustum.
- A fin thickness of 0.5 m on a 0.1 m chord is accepted (a 5.4 kg fin set).

**Documentation.** `docs/known-limitations.md:81` promises a warning when the wall exceeds a quarter of the base radius. No such warning exists; the app rule is only "positive" (`ComponentEditor.tsx:50-62`).

**Suggested fix:**

- Reject a wall at or above the base radius.
- Add the promised warning, or remove the promise.
- Bound the fin thickness against the chord.

### G-3 (minor): the longitudinal inertia is silently clamped

**Where:** `revolution.ts:102`, which computes `Math.max(0, iy - m x̄²)`. This clamps a negative result without reporting it (rule 3).

**Fix.** Allow negatives only at the level of rounding, and throw otherwise.

### G-4 (minor): rail button validation gaps

**Where:** `components.ts:330-372`.

- A count of 1.5 is accepted: the loop runs twice and returns two buttons.
- A count above 1 with no separation stacks every button at the same x.
- An inner diameter larger than the outer diameter is accepted.

### G-5 (minor): one- and two-fin sets use equal pitch and yaw inertia

**Where:** `components.ts:313-319`. The longitudinal inertia is the mean of the two transverse inertias, and the simulator uses equal pitch and yaw inertia (DYN-9).

**Evidence.** The reviewer's independent check for R1's fin shape:

| Fins | I_yy (kg·m²) | I_zz (kg·m²) | Value used (mean) |
| --- | --- | --- | --- |
| 1 | 6.17e-6 | 5.13e-5 | 2.874e-5 |
| 2 | 1.23e-5 | 1.026e-4 | 5.748e-5 |

So for two fins the true inertia differs by about 8× between the axes.

**Also:**

- A single fin, rail buttons and launch lugs move the CG off the axis; this is ignored.
- `docs/known-limitations.md:86` mentions the ½ factor but not that one and two fins are accepted.

**Fix.** Document the error, or reject fewer than three fins in the 6DOF simulation.

### G-6 (minor): the secant ogive loses precision at very small κ

**Where:** `profiles.ts:93-108`. The formula subtracts two nearly equal large numbers.

| κ | Result | Error |
| --- | --- | --- |
| 1e-9 | r(L) | 1.8e-6 relative |
| 1e-12 | r(L) = 0.0269775 against 0.027 | 8.3e-4 relative |
| 1e-12 | r(1e-4) = 0 | |

There is no lower bound on κ.

**Fix.** Rewrite in the cancellation-free form (ρ² − (a−x)² − c²)/(√(ρ² − (a−x)²) + c), or set a documented lower bound on κ.

### G-7 (minor): steep-ended transition shells lose their inner radius at the narrow end

Elliptical, power-series and Haack transition shells get an inner radius of zero at the narrow end, although the outer radius there is the full small radius. For example, a 20 to 30 mm elliptical transition with a 2 mm wall has an inner radius of 0 at x = 1e-6 m. The mass effect is well under 1 %.

`docs/known-limitations.md:77` describes this behaviour only near a nose tip, not for transitions.

### G-8 (minor): there is no mass or CG override

CLAUDE.md §6.1 requires "mass (from material density or user-entered override)". No component has a mass or CG override. `.ork` files with overrides are rejected loudly (`ork.ts:283`), which is correct, but `docs/audit.md:66` marks §6.1 as done without mentioning the gap.

If overrides are added:

- a mass override must scale the inertia;
- a CG override must apply the parallel-axis shift.

---

## Subsonic Barrowman CP and stability

### B-1 (critical): no checks that components fit together, so stability can be overstated silently (confirmed by re-reading)

**Where:** `packages/physics/src/stability/barrowman.ts:542-601`.

- The fin set's `bodyRadius` is a free input (`components.ts:93`).
- The app sets it once, when the fin set is created (`packages/app/src/state/reducer.ts:192`).
- After that it is a separate editable field (`ComponentEditor.tsx:106`) and never follows the body tube.

**Evidence.** R1 in OpenRocket-equivalent mode, base CP 0.4872 m:

| Change | CP | Error | Notes |
| --- | --- | --- | --- |
| Nose base radius set to 12.5 mm on the 25 mm tube, no transition | 0.5268 m | +0.79 cal | Unsafe direction. The diameter step should add a forward C_Nα term; eq. (3.19) assumes a continuous body. |
| Fin `bodyRadius` set to 1 m (as if the tube were enlarged after adding fins) | 0.5052 m | +0.36 cal | K_T(B) becomes 1.5 instead of 1.238. |
| Fins placed 5 m behind the 0.6 m rocket | 4.47 m | | Accepted. |
| Fins at x = −1 m | −0.84 m | | Accepted. |

A nose starting at x = 0.3 m is also accepted.

**Source.** Eq. (3.56), p. 34, defines r_t as "the body radius at the fin position".

**Suggested fix:**

- Derive r_t from the body tube under the fin root, or reject a mismatch.
- Detect radius steps between consecutive external components, and reject them or add the step as a transition term.
- Require fins and rail buttons to sit on a body tube.
- Require the nose to start at x = 0.

### B-2 (minor): stale statements about the fin CP and β

**What the documentation says.** These places say that Mach 0.5 and above throws, or that the shift from eqs. (3.35) and (3.36) is "Phase 2":

- `docs/equations.md:82` (BAR-5)
- `docs/known-limitations.md:124`
- the comment at `barrowman.ts:390-391`

**What the code does.** `finSetTerm` applies BAR-10 at every Mach number. R1's CP at M = 0.6, 0.7 and 0.8 is 0.49015, 0.49276 and 0.49611 m, with no error.

**Also stale:**

- BAR-1 (`equations.md:78`) names `prandtlBeta` as its implementation, but `finSetTerm` computes β inline (`barrowman.ts:431`) and never calls it.
- The `barrowman.ts` header lists only BAR-1 to BAR-9.

### B-3 (minor, needs the owner's confirmation): the source conflict on fin-body interference is not recorded

**The two sources:**

- **Niskanen eq. (3.56), p. 34:** K_T(B) = 1 + r/(s + r). The code matches this.
- **Barrowman 1967 eq. (3-96), printed p. 31 (PDF p. 41):** a longer slender-body expression.

**Evaluating Barrowman's version.** Two reviewers independently found that, as printed in the scan, it gives a non-physical value below 1 (0.33 for R1). A term has probably dropped out in printing. With the π/4 factor one reviewer believes is missing (not verifiable from `reference/`), it gives:

| Rocket | Barrowman (π/4 added) | Niskanen |
| --- | --- | --- |
| R1 | 1.196 | 1.238 |
| R2 | 1.301 | 1.351 |

**Effect.** On R1 the CP moves about 1.7 mm forward (0.035 cal). That is within the 2 % CP tolerance, so criterion 11(a) is not strictly triggered.

**Related term.** Barrowman's eq. (3-98) (body lift carried over from the fins) is left out, per Niskanen p. 34. The register already records that omission (BAR-8). If it were included, the combined factor would be (1 + 1/τ)², which is 1.53 to 1.67 for these rockets. That would move the CP well aft, in the non-conservative direction.

**Suggested fix.** Add a decision recording that Niskanen eq. (3.56) is used and that Barrowman 1967 differs, with the reason. Ask the owner to confirm. Get a clean copy of Barrowman p. 31.

### B-4 (minor): weak tests in geometry and stability

**A vacuous property test.** The CLAUDE.md §7.3 property "adding a fin set never moves the CP forward" (`barrowman.test.ts:336-365`) filters its inputs with `fc.pre(fin CP ≥ current CP)`. That makes it true by the definition of a weighted mean, so it tests nothing. It also never tries a negative sweep.

**A claimed test that does not exist.** `docs/audit.md:82` claims a "mass never negative" property test. The only one is for motors (`motor.test.ts:224`); there is none for components, which is why G-1 went unnoticed.

**Never tested:**

- `finSetTerm` and `centreOfPressure` with 1, 2 or 5 to 8 fins
- swept fins, or tip longer than root, in `finSetTerm`
- the secant ogive against eq. (A.4) directly
- the inertia of fins, shoulders, rail buttons, lugs and hollow non-conical noses
- the solid mass properties of the elliptical, parabolic, power-series and LV-Haack shapes

The reviewer checked all of these independently and they are correct today, but nothing would catch a regression.

**A loose tolerance.** The reference CG test allows 1 % while the observed match is 0.0004 %, so it would not catch a regression of up to 1 %.

No test was found that derives its expected value from the code under test.

---

## Motors, thrust curves, mass and CG during burn

### M-4 (critical): with a plugged motor, or an ejection after landing, an ejection-triggered parachute never deploys and there is no warning (confirmed by re-reading)

**Where:**

- `packages/physics/src/flight/simulate.ts:539-548` schedules the ejection event only when `ejectionDelay !== undefined`.
- `packages/formats/src/design/to-physics.ts:307-312` warns only when the design has no recovery devices at all (`design.recovery.length === 0`).

**Effect.** A design with a parachute set to deploy on the ejection charge, flown on a plugged motor, comes out ballistic. The landing speed is terminal velocity, and nothing tells the user that the parachute never opened. The same happens if the ejection time falls after landing.

**Why critical.** The user believes the design has working recovery.

**Suggested fix.** After every run, warn for each recovery device that never deployed, naming its trigger and the reason. Also warn before simulating when an ejection-triggered device is paired with a plugged motor.

### M-1 (major): the RockSim linear-in-time mass rule ignores the file's `burn-time`, and nothing compares the two

**Where:**

- `packages/physics/src/motor/motor.ts:317-318`
- `packages/formats/src/rse.ts:69` and `:214`
- `packages/formats/src/motor-definition.ts:345-346`

**Source.** Apogee RockSim engine file guide, p. 1. It says `burn-time` is "Used for simulation and integration" and gives m(t) = initMass − (propMass / burnTime)·t. MOT-4 quotes the same formula.

**What the code does.** It uses tb = the time of the last data point. `burnTimeAttribute` is stored as "informational" and never checked.

**Evidence:**

- A file with `burn-time="1"` and a last point at 2 s is accepted. At t = 1 s the code leaves 0.005 kg of propellant; the guide's formula gives 0.
- A file with `burn-time="3"` and a curve ending at 1 s is also accepted without a message.
- The bundled files are not affected (G80T: 1.7 against 1.701).

**Suggested fix.** Use `burn-time` in the rule, or reject a file where `burn-time` and the last point disagree beyond a stated tolerance. Record the choice in D-029.

### M-2 (major): mass profiles are not checked against the declared masses or the burn

**Where:**

- `motor.ts:136-197` (`validateMotor`)
- `packages/formats/src/motors/csv-thrust-curve.ts:136-150`
- `packages/formats/src/design/validate.ts:338-365`

**What is checked.** Only that 0 ≤ m ≤ m_prop, that m never increases, and that the first time is 0. Nothing requires m(0) = m_prop, m(end) = 0, or that the profile spans the burn.

**Evidence.** A CSV motor with total mass 0.030 kg and propellant 0.010 kg:

- A profile running 0.005 → 0.001 kg gives a motor mass of 0.025 kg at t = 0 and 0.021 kg after burnout, with no message.
- A profile running to 3 s against a 1 s burn keeps losing mass during the coast while `burning` is false.
- A profile that reaches 0 at 0.5 s while thrust continues to 1 s is accepted.

**Tests that bless these profiles:** `motor.test.ts:141-145` (ends at 0.0001 kg) and `motor.test.ts:261-262` (runs to 2 s against the D12's 1.65 s burn).

**Why it matters.** The profile feeds liftoff mass, thrust-to-weight, rail exit velocity and burnout stability. Accepting a bad one silently breaks CLAUDE.md rule 3.

**Suggested fix.** Add endpoint and time-span checks with tolerances, and update the two tests.

### M-3 (major): the app's default ejection delay is the first one listed, which is 0 s for the Estes motors (confirmed by re-reading)

**Where:** `packages/app/src/components/MotorPanel.tsx:78` uses `m.delays[0]`. The ThrustCurve download path (`:456`) feeds the same default.

**Evidence:**

- C6 and D12 list `0-3-5-7`.
- E16 lists `0-4-6-8`.

So by default an ejection-triggered parachute deploys at burnout, near maximum velocity.

**Mitigation already present.** The deployment-velocity warning fires (`to-physics.ts:290-295`). The model result is still not what the user intended.

**Suggested fix.** Make the user choose a delay, or default to the longest and say so. Label a 0 s delay as "booster / no delay".

### M-5 (minor): ThrustCurve downloads that are RockSim-only fail in the motor panel

**Where:** `MotorPanel.tsx:456` calls `parseEng(motor.fileText)`. When no RASP file exists, `downloadMotor` returns the `.rse` XML instead (`client.ts:241-283`).

**Effect.** The panel throws an `EngParseError` ("exactly 7 fields") and the motor is not applied, although it was already cached. `library.ts:60-67` guards the same call; the panel does not.

### M-6 (minor): `.rse` and CSV curves can end with nonzero thrust or contain zero-thrust spans

**Where:**

- `rse.ts:278-290` has no check on the final thrust or on internal zeros.
- `csv-thrust-curve.ts:124-131`
- `motor.ts:200-206`

**Evidence.** An `.rse` file with points (0,0), (0.5,20), (1,20) is accepted: `thrustAt(1)` = 20 N and I = 15 N·s, so a truncated curve goes through silently. A trailing zero-thrust span delays burnout, and therefore the ejection charge, by the length of the span.

**Source.** The RASP format page (`reference/docs/thrustcurve-api/raspformat.html`) rejects both cases.

**Documentation.** `docs/known-limitations.md:292` says "Thrust is zero exactly at the final point", which is false for these inputs.

**Fix.** Reject such curves, or warn.

### M-7 (minor): the `.rse` `m`-column tolerance clashes with `validateMotor`, and negative values are clamped silently

**Where:** `rse.ts:306-311` allows 1 % at each end, and `rse.ts:353-354` applies `Math.max(0, remaining)`.

**Evidence:**

- A column starting at 10.05 g when `propWt` is 10 g passes the reader, then `validateMotor` refuses it with a confusing message.
- A column ending at −0.05 g is set to 0 with no message.
- A column ending at +0.09 g leaves that propellant on board for the rest of the flight.
- A column starting below `propWt` lowers the liftoff mass without a message.

### M-8 (minor): `.rse` `Itot` is never checked against the curve

**Where:** `rse.ts:243`. Apogee guide p. 1 lists `Itot` as required, for "Simulation validation".

**Evidence.** `Itot="20"` is accepted against a curve that integrates to 10 N·s. The reference files agree with their `Itot` within 0.02 %, so a check with a stated tolerance would pass them.

**Also.** The guide marks `type`, `Itot`, `avgThrust` and `peakThrust` as required, but the reader treats them as optional. That leniency is not documented.

### M-9 (minor): the reader rejects the guide's own "Minimal Valid File"

**Where:** `rse.ts:262` accepts only `<eng-data>` elements, and `rse.ts:393-405` require an `engine-database` / `engine-list` wrapper.

**Evidence.** The Apogee guide's example puts `<point>` elements directly inside a bare `<engine>`. Parsed as printed, it throws `RseUnsupportedError`.

**Tests.** `rse.test.ts` rewrites `<point` to `<eng-data` before testing, and calls `eng-data` the "documented element name". It is not documented in `reference/`; it appears only in the ThrustCurve files.

**Fix.** Accept both forms and record where each comes from in D-029.

### M-10 (minor): a file with neither a `cg` column nor `auto-calc-cg` is accepted

**Where:** `motor-definition.ts:318-356`.

The Apogee guide, p. 1, requires one or the other. The code enforces the equivalent rule for mass but not for CG.

### M-11 (minor): a zero-impulse motor is valid under the linear-in-time and mass-profile rules

**Where:** `motor.ts:129-135` requires I > 0 only for the impulse-proportional rule.

**Evidence.** Points (0,0), (1,0) with `auto-calc-mass="1"` are accepted.

**Fix.** Require I > 0 for every rule.

### M-12 (minor): a deployment during the burn silently cuts the thrust, and a negative ejection delay is accepted from files

**Where:**

- `simulate.ts:284-285` sets thrust to 0 in the descent phase.
- `simulate.ts:539-541` and `validate.ts:406-409` do not check the sign of `ejectionDelay`. Only the UI rejects negatives (`MotorPanel.tsx:228`).

**Effect.** A launch-triggered device, an apogee reached while still burning, or a negative delay sets thrust to 0 while propellant mass keeps falling, with no message.

### M-13 (minor, documentation): D-029 describes a check the code does not make

D-029 says the ThrustCurve download passes `massUnit: 'g'` as a cross-check. `client.ts:267` passes `{}`. As a result, a ThrustCurve RockSim file without `Isp` cannot be downloaded; the error message is clear.

### M-14 (minor, documentation): `reference/SOURCES.md:136` misstates the `.rse` masses

It says `initWt` and `propWt` equal the RASP header values × 1000. That is false for:

| Motor | `.rse` (g) | RASP header (kg) |
| --- | --- | --- |
| F39T | 60 | 0.059 |
| H128W | 214.5 / 92.2 | 0.2016 / 0.09408 |
| H238T | 196 / 83.4 | 0.18816 / 0.08064 |

The H128W `.rse` is a different data set altogether: 155.764 N·s over 1.5 s, against 177.772 N·s over 1.293 s in the `.eng`.

### M-15 (minor, documentation): a known-limitations entry cites Niskanen for something the page does not say

`docs/known-limitations.md:266` cites "Niskanen §4.2.3 p. 64 (motors as cylinders)". Page 64 says only that component masses and inertias come from "standard formulae". It does not mention motors or cylinders. The cylinder model is the project's own convention (plan 0004, GEO-12), and the citation should say so.

### M-16 (minor): the ThrustCurve client silently takes the first motor in a multi-entry RASP file

**Where:** `client.ts:262-266`.

The RASP page says ThrustCurve parses multi-motor files, so downloaded files can hold several entries. The file-import path at least tells the user; the download path does not. There is also no cross-check of the parsed file against the search summary (`totImpulseNs`, `totalWeightG`, `propWeightG`).

### M-17 (minor): RASP reader details

- `eng.ts:201-207`: the comment says a blank line is tolerated only after the final point, but blank lines are accepted anywhere in the data.
- `eng.ts:165`: a file with bare-CR line endings reports a misleading "no motor entry found".
- `eng.ts:217-219`: comments after a finished entry are attached to the next motor.

### M-18 (minor): test quality for motors

- `eng.test.ts:134-145` is titled "by hand" but asserts only 16 < I < 18, although the exact value, 16.839 N·s, is known.
- `motor.test.ts:305-307` ("CG with another rule") passes for an unrelated reason: any profile combined with a non-profile rule is rejected, so the CG is never exercised.
- `motor.test.ts:136-153` and `:254-264` assert inconsistent profiles as valid (see M-2).
- The property tests (`:224-248`) cover only the D12 curve and two rules. There are none on random curves or on the mass-profile rule.

Never tested:

- a nonzero final thrust in an `.rse` file
- `burn-time` or `Itot` disagreeing with the curve
- `m` values inside the tolerance band
- the panel's RockSim download path
- a plugged motor with an ejection-triggered parachute

---

## Independent recalculation (`independent_recalc.py`)

`docs/review/independent_recalc.py` is pure Python and imports no project code. Run it with `python3 docs/review/independent_recalc.py`; its output is saved in `independent_recalc_output.txt`.

**Method:**

- Rocket dimensions come from `reference/rockets/README.md`, and motors from the `.eng` headers.
- Nose profiles follow Niskanen Appendix A, eqs. A.1, A.2, A.5, A.9 and A.10 (pp. 100-103).
- The noses are integrated with 40 000 exact frustum slices.
- CP uses Niskanen eqs. 3.19, 3.28 to 3.32, 3.37 to 3.39 and 3.54 to 3.56 (pp. 22-34), with β = √(1 − M²) applied to the fins at M = 0.3.
- The app's values were captured with a temporary test file that was then deleted.

**Results.** Each cell gives independent / app / OpenRocket; "×3" means all three agree to the digits shown. CP is the unreduced value, without the roll bracket, which is what OpenRocket uses.

| Rocket | Liftoff mass (kg) | Liftoff CG (m) | Burnout mass (kg) | Burnout CG (m) | CP (m) | Stability (cal) |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | 0.190904 ×3 | 0.387022 ×3 | 0.169804 ×3 | 0.364906 ×3 | 0.487227 / 0.487227 / 0.487149 | 2.0041 / 2.0041 / 2.0025 |
| R2 | 0.414486 / 0.414485 / 0.414484 | 0.484546 / 0.484547 / 0.484548 | 0.345486 / 0.345485 / 0.345484 | 0.443894 / 0.443896 / 0.443897 | 0.571233 / 0.571233 / 0.571037 | 1.6053 / 1.6053 / 1.6016 |
| R3 | 0.171874 / 0.171874 / 0.171873 | 0.356247 / 0.356247 / 0.356248 | 0.149174 / 0.149174 / 0.149173 | 0.332089 / 0.332090 / 0.332091 | 0.449197 / 0.449197 / 0.449111 | 3.6595 / 3.6594 / 3.6560 |
| R4 | 1.365941 / 1.365937 / 1.365936 | 0.625036 / 0.625038 / 0.625038 | 1.239605 / 1.239601 / 1.239600 | 0.594669 / 0.594670 / 0.594671 | 0.807973 / 0.807973 / 0.807795 | 2.7718 / 2.7717 / 2.7690 |

The stability the app actually displays uses the worst roll angle. Independent / app values: R1 1.8374 / 1.8374, R2 1.2664 / 1.2663, R3 3.2880 / 3.2880, R4 2.6814 / 2.6814.

No component differs by more than 0.5 % between any two of the three calculations. The author's `reference/rockets/hand-check-r1.py`, compared only after the fact, agrees.

### R-1 (minor, documentation): the cause given for the CP gap to OpenRocket does not fit the numbers

**Where:** `reference/rockets/hand-checks.md:51`.

**Evidence.** The app and the independent CP both sit 0.08 to 0.20 mm aft of OpenRocket in every rocket. Solving eq. (3.29) for the fin C_Nα that reproduces OpenRocket's CP, with the nose and boat-tail terms fixed, gives a fin value lower by:

| Rocket | Fin C_Nα lower by |
| --- | --- |
| R1 | 0.163 % |
| R2 | 0.186 % |
| R3 | 0.157 % |
| R4 | 0.189 % |

That is a consistent offset in the fin term. The document blames "for example a numerically integrated nose cone", but R1's nose is a cone, whose CP of 2L/3 is exact under any integration.

**Impact.** Negligible: at most 0.004 cal of stability.

**Fix.** Say the gap is equivalent to a 0.16 to 0.19 % lower fin C_Nα in OpenRocket, with the cause not identified. Do not tune to it.

### R-2 (minor): nose shell walls use a first-order offset

**Where:** GEO-9 and D-024.

**Evidence:**

- The exact inward offset gives nose masses 0.004 % above the app's for R2 and R4.
- The app's first-order offset, r − t√(1 + r′²), matches OpenRocket to 0.0001 %.
- A wall measured radially instead would be off by −0.8 %, so measuring normal to the surface is the right convention.

**Fix.** Optionally state the 0.004 % bound in the GEO-9 validity column.

### R-3: see B-3 (interference factor source conflict)

### R-4 (minor, observation): R2's displayed stability is well below OpenRocket's

**What the user sees.** The app shows 1.27 cal for R2, against OpenRocket's 1.60 cal. Both are correct for what they compute: the app shows the worst roll angle, per Niskanen eq. (3.54) and D-016.

**Why it matters.** A user comparing the two may conclude one program is wrong. The app errs on the safe side.

**Fix.** Make sure the stability panel labels the figure as the worst-roll value, and shows the OpenRocket-equivalent number alongside it.

---

FLIGHT_SECTION_PLACEHOLDER
