# Plan 0001: Units system and U.S. Standard Atmosphere 1976

**Status:** approved 2026-10-11 with the answers recorded at the end of this file. Part A (units) and Part B (atmosphere) are implemented. Every value in Part B was verified against `reference/docs/ussa1976-nasa-ntrs-19770009539.pdf` on 2026-10-11; the verification record follows.

## Verification record for Part B (printed page numbers; PDF page = printed + 16 in Part 1, printed + 15 in the tables)

- Constants: Table 2 p. 2 (k, N_A, R* = 8.31432 × 10³, g₀ = 9.80665 m/s², g₀′ = 9.80665 m²/(s²·m′), P₀ = 1.013250 × 10⁵ Pa, T₀ = 288.15 K, β = 1.458 × 10⁻⁶, γ = 1.40, σ); r₀ = 6 356 766 m on p. 4 and p. 8; M₀ = 28.9644 kg/kmol on p. 9. **Correction:** Sutherland's constant is printed as 110 K in Table 2 and on p. 4 but as 110.4 K on p. 19; 110.4 K is used (D-021). The plan's recollection of all other constants was exact.
- Layer table: Table 4 p. 3, exactly as planned (H_b 0, 11, 20, 32, 47, 51, 71, top 84.8520 km′; L_M,b −6.5, 0, +1.0, +2.8, 0, −2.8, −2.0 K/km′).
- Equations: eq. (17) g(Z) p. 8 (not implemented, D-012); eqs. (18) and (19) p. 8 with Γ = g₀/g₀′ = 1 m′/m; eq. (22) T_M = T·M₀/M p. 9; eq. (23) p. 10; eqs. (33a) and (33b) p. 12; eq. (42) p. 15; eq. (50) p. 18; eqs. (51) and (52) p. 19. Equation numbers as planned.
- Domain: Table I begins at Z = −5 000 m (p. 51); p. 12 confirms eq. (33a) with b = 0 down to −5 km′. Lower bound −5 000 m geometric adopted (owner's answer 4).
- Table 8 (M/M₀, 80 to 86 km): transcribed from a 300 dpi crop of p. 9, Z-indexed column, 13 entries; p. 10 confirms 0.9995788 at 86 km and T = 186.8673 K there.
- Sea-level values: Table 10 p. 20 (ρ₀ = 1.2250, C_s = 340.294, μ₀ = 1.7894 × 10⁻⁵, η₀ = 1.4607 × 10⁻⁵, M₀ = 28.9644).
- Published rows: Table I pp. 51, 53, 57, 59, 61, 63, 65, 67, 68 and geopotential pp. 58, 62, 64, 66; Table III pp. 101, 105, 107, 113, 115. All transcribed from 200 dpi crops; each row's page is in `ussa1976.tables.test.ts`.
  **Phase:** 1 (physics core). This is the first physics task.

## Part A: Units system

### Files

| File                                          | Purpose                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/physics/src/units/quantity.ts`      | The `Quantity<Unit>` brand and the generic `defineQuantity` helper         |
| `packages/physics/src/units/si.ts`            | One branded type and constructor per SI quantity we use                    |
| `packages/physics/src/units/convert.ts`       | Boundary conversions that are definitional (SI prefixes, degrees, Celsius) |
| `packages/physics/src/units/*.test.ts`        | Runtime tests                                                              |
| `packages/physics/src/units/si.types.test.ts` | Compile-time tests, run by `pnpm typecheck`                                |
| `docs/conventions.md`                         | Copy the approved brand design into the Units section                      |
| `docs/equations.md`                           | `UNIT-1` to `UNIT-4` entries for the conversions                           |

### Design

```ts
declare const unitBrand: unique symbol;
/** A float64 that carries its SI unit in the type system. */
export type Quantity<Unit extends string> = number & { readonly [unitBrand]: Unit };

export type Metres = Quantity<'m'>;
export type Kilograms = Quantity<'kg'>;
// ... one per unit below

export function metres(value: number): Metres; // throws InvalidInputError if not finite
```

- Branded types are `number` intersected with a phantom unit tag. A `Metres` is usable as a `number` (so `Math.sqrt`, `<`, and `+` work), but a `number` is not usable as a `Metres`, and `Metres` is not usable as `Kilograms`. Passing the wrong quantity to a function is a compile error.
- Each constructor (`metres(x)`, `kilograms(x)`, ...) is the only way to make a quantity. It rejects `NaN` and `±Infinity` with `InvalidInputError` naming the quantity. It does not reject negatives or zero: sign and range are the consuming function's business ("fin root chord must be greater than 0 m" is checked by the fin code, not by `metres`).
- Arithmetic produces plain `number`. A function re-brands its result through the constructor when it returns it, which also performs the finiteness check that CLAUDE.md section 8 requires. So the brand is enforced at every function boundary, and the inside of a function is ordinary float64 arithmetic.
- Quantities in Phase 1: `Metres`, `SquareMetres`, `CubicMetres`, `Kilograms`, `KilogramsPerCubicMetre`, `Seconds`, `MetresPerSecond`, `MetresPerSecondSquared`, `Newtons`, `NewtonSeconds`, `Kelvin`, `Pascals`, `Radians`, `RadiansPerSecond`, `KilogramSquareMetres` (moment of inertia), `PascalSeconds` (dynamic viscosity), `SquareMetresPerSecond` (kinematic viscosity), `Mach`, `Dimensionless`. New ones are added when a function needs them, never speculatively.

**Honest limitation of this design.** TypeScript cannot check units through arithmetic. `metres(1) + seconds(1)` compiles and yields a `number`. The brand catches the far more common mistake, which is passing a millimetre value or the wrong quantity into a function. If you want arithmetic checked too, the alternative is a set of helpers (`add(a, b)` for same-unit, `mul`, `div` with unit algebra encoded in types). That is heavier to write and read, and TypeScript's type-level unit algebra gets unreadable past two factors. My recommendation is boundary-only branding, revisited if a unit bug ever gets past it.

### Conversions in Phase 1

Only definitional conversions, which need no measured data:

| ID       | Conversion               | Rule                | Source                          |
| -------- | ------------------------ | ------------------- | ------------------------------- |
| `UNIT-1` | millimetres → metres     | `x / 1000`          | SI prefix definition            |
| `UNIT-2` | grams → kilograms        | `x / 1000`          | SI prefix definition            |
| `UNIT-3` | degrees → radians        | `x * Math.PI / 180` | definition of the degree        |
| `UNIT-4` | degrees Celsius → kelvin | `x + 273.15`        | definition of the Celsius scale |

Division by the exactly representable 1000 is correctly rounded; multiplying by `1e-3` is not (two roundings). Imperial conversions (inch, foot, pound, pound-force, °F) are not needed until the UI (Phase 3) and will need an approved source for the exact factors.

**Question 1.** The SI prefix, degree and Celsius definitions are in the SI Brochure (BIPM, 9th edition, 2019). It is not on the approved source list. Please either approve it as the source for `UNIT-*` entries, or tell me to treat these four as definitional with no citation.

### Tests for Part A

Compile-time (in `si.types.test.ts`, using `// @ts-expect-error` so `tsc` fails if the error disappears):

- `const m: Metres = 1;` must not compile.
- `const m: Metres = kilograms(1);` must not compile.
- `takesMetres(millimetres(1))` must not compile (there is no `Millimetres` quantity on purpose; the parser calls `millimetresToMetres`).
- `const n: number = metres(1);` must compile.

Runtime:

- Each constructor returns a value `Object.is`-identical to its input for every finite double, including `-0` and the largest and smallest doubles (fast-check property over `fc.double({ noNaN: true, noDefaultInfinity: true })`).
- Each constructor throws `InvalidInputError` for `NaN`, `Infinity`, `-Infinity`, with `parameter` set to the quantity name.
- `millimetresToMetres(1500)` is exactly `1.5`; `gramsToKilograms(62.5)` is exactly `0.0625` (both exactly representable). Working: 1500 / 1000 = 1.5 = 3 · 2⁻¹.
- `degreesToRadians(180)` is `Math.PI` exactly; `degreesToRadians(90)` is `Math.PI / 2` exactly (power-of-two division is exact).
- `celsiusToKelvin(15)` is `288.15` within 1 ulp, and `celsiusToKelvin(-273.15)` is `0` within 1e-13.
- Property: for all finite `x` with `|x| < 1e300`, `millimetresToMetres(x) * 1000` is within 1 ulp of `x`.

## Part B: U.S. Standard Atmosphere 1976

### Scope of this task

The pure standard model only: given a geometric altitude, return the standard temperature, pressure, density, speed of sound, and viscosity. Launch-site temperature and pressure overrides (CLAUDE.md 6.4) are a separate, later task because how an override propagates with altitude is a modelling decision that needs its own source and plan.

### Files

| File                                               | Purpose                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `packages/physics/src/atmosphere/ussa1976.ts`      | Constants, layer table, and the model                      |
| `packages/physics/src/atmosphere/ussa1976.test.ts` | Hand calculations, published-table comparisons, properties |
| `packages/physics/golden/ussa1976.json`            | Golden outputs at 1 km steps, compared bit-exactly         |
| `docs/equations.md`                                | `ATM-1` to `ATM-9`                                         |
| `docs/known-limitations.md`                        | Atmosphere section                                         |

### Source access problem

I could not read the standard from inside this environment: the network policy blocks `ntrs.nasa.gov` and `ngdc.noaa.gov`, and the text I could get through a fetch service was unusable OCR of the scanned PDF. Everything below is from my knowledge of the document and I have marked what I could and could not cross-check. **Before any test expectation is written, every number below must be checked against the printed document.**

**Question 2.** Please drop a copy of the 1976 document into `reference/ussa1976.pdf` (I can read PDFs page by page) or confirm the values below from your copy. If neither is possible, tell me whether a secondary transcription is acceptable, and which.

What I could cross-check: the layer table (geopotential bases, lapse rates, base temperatures) and the base pressures to six significant figures agree with an independent transcription and with my own recomputation from the constants (see the hand calculations below). What I could not cross-check: equation numbers, the exact wording of the validity statements, Table 8 (molecular-weight ratio), and the individual rows of the printed Tables I and II.

### Adopted constants (document Part 1, Table 2; values to verify)

| Symbol | Value         | Unit         | Note                                                                                |
| ------ | ------------- | ------------ | ----------------------------------------------------------------------------------- |
| g₀     | 9.80665       | m/s²         | sea-level standard gravity                                                          |
| r₀     | 6 356 766     | m            | effective Earth radius for the geopotential conversion                              |
| P₀     | 101 325       | Pa           |                                                                                     |
| T₀     | 288.15        | K            |                                                                                     |
| M₀     | 28.9644       | kg/kmol      | sea-level mean molecular weight                                                     |
| R\*    | 8.31432 × 10³ | N·m/(kmol·K) | the 1976 value, not CODATA; deliberately kept so results match the published tables |
| γ      | 1.40          |              | ratio of specific heats                                                             |
| β      | 1.458 × 10⁻⁶  | kg/(s·m·K^½) | Sutherland viscosity constant                                                       |
| S      | 110.4         | K            | Sutherland temperature                                                              |

### Layer table (document Part 1, Table 4; cross-checked)

Geopotential altitude H in metres (the document writes km′), lapse rate L in K/m, base molecular-scale temperature T in K.

| b   | H_b                                | L_M,b   | T_M,b   |
| --- | ---------------------------------- | ------- | ------- |
| 0   | 0                                  | −0.0065 | 288.15  |
| 1   | 11 000                             | 0       | 216.65  |
| 2   | 20 000                             | +0.0010 | 216.65  |
| 3   | 32 000                             | +0.0028 | 228.65  |
| 4   | 47 000                             | 0       | 270.65  |
| 5   | 51 000                             | −0.0028 | 270.65  |
| 6   | 71 000                             | −0.0020 | 214.65  |
| 7   | 84 852 (top, = 86 000 m geometric) |         | 186.946 |

Base pressures P_b are **computed** at module load by chaining the pressure equations from P₀, not transcribed from the tables. The tables are used in tests to check them. This keeps the code free of copied digits.

### Equations (numbers are my recollection; verify)

| ID      | Equation                                                          | Where             | Validity                        |
| ------- | ----------------------------------------------------------------- | ----------------- | ------------------------------- |
| `ATM-1` | H = r₀ Z / (r₀ + Z)                                               | Part 1, eq. (18)  | all Z in domain                 |
| `ATM-2` | Z = r₀ H / (r₀ − H)                                               | Part 1, eq. (19)  | inverse of ATM-1                |
| `ATM-3` | T_M = T_M,b + L_M,b (H − H_b)                                     | Part 1, eq. (23)  | 0 to 84 852 m′                  |
| `ATM-4` | P = P_b [T_M,b / (T_M,b + L_M,b (H − H_b))]^(g₀ M₀ / (R\* L_M,b)) | Part 1, eq. (33a) | layers with L ≠ 0               |
| `ATM-5` | P = P_b exp[−g₀ M₀ (H − H_b) / (R\* T_M,b)]                       | Part 1, eq. (33b) | layers with L = 0               |
| `ATM-6` | ρ = P M₀ / (R\* T_M)                                              | Part 1, eq. (42)  | 0 to 86 km (M = M₀ below 80 km) |
| `ATM-7` | c = (γ R\* T_M / M₀)^½                                            | Part 1, eq. (50)  | 0 to 86 km                      |
| `ATM-8` | μ = β T^(3/2) / (T + S)                                           | Part 1, eq. (51)  | below 86 km                     |
| `ATM-9` | ν = μ / ρ                                                         | Part 1, eq. (52)  | below 86 km                     |

Gravity g(Z) = g₀ [r₀/(r₀+Z)]² (eq. 17) is part of the standard but I propose **not** exposing it from the atmosphere module. The flight simulator's gravity model is a Phase 2 decision and there should be exactly one place that defines gravity. **Question 3:** agree?

### Domain and the two edges

- **Upper edge, 86 000 m geometric.** Above this the standard switches to a different formulation (kinetic temperature, diffusive separation). Out of scope; `InvalidInputError` above 86 000 m.
- **Lower edge.** The standard's printed tables extend below sea level (I recall −5 000 m; verify). Launch sites below sea level exist (Death Valley, Dead Sea), so I propose the domain [−5 000 m, 86 000 m], using the layer-0 formulas below 0 exactly as the tables do. **Question 4:** confirm the lower bound from your copy, or restrict to 0 m.
- **80 to 86 km, molecular-weight ratio.** Between 80 and 86 km the standard lets the mean molecular weight M fall slightly below M₀ (Table 8, 13 values at 500 m steps, ratio ending near 0.99958 at 86 km). This changes the kinetic temperature T = T_M · M/M₀ by at most about 0.08 K at 86 km; pressure and density are unaffected because they use T_M. Only viscosity (ATM-8) sees T. Options: (a) implement Table 8 with linear interpolation, which requires the printed table; (b) use T = T_M throughout and record the ≤ 0.08 K discrepancy as a known limitation. **Question 5:** I recommend (a) if you can provide the document, otherwise (b). No rocket this software targets will reach 80 km, but a documented limitation beats a silent one either way.

### Public interface

```ts
export interface StandardAtmosphereState {
  readonly geometricAltitude: Metres;
  readonly geopotentialAltitude: Metres;
  readonly molecularScaleTemperature: Kelvin;
  readonly temperature: Kelvin; // equals molecularScaleTemperature below 80 km
  readonly pressure: Pascals;
  readonly density: KilogramsPerCubicMetre;
  readonly speedOfSound: MetresPerSecond;
  readonly dynamicViscosity: PascalSeconds;
  readonly kinematicViscosity: SquareMetresPerSecond;
}
export function standardAtmosphere1976(geometricAltitude: Metres): StandardAtmosphereState;
export function geometricToGeopotential(z: Metres): Metres;
export function geopotentialToGeometric(h: Metres): Metres;
```

Every field is checked finite before return (`NonFiniteResultError`). Out-of-domain altitude throws `InvalidInputError` with the domain in the message.

### Numerical tolerance (to be documented on the function)

The computation is at most seven chained evaluations of `pow` or `exp` on float64. Expected relative error against an exact evaluation of the same formulas: below 1 × 10⁻¹³. Against the printed tables the limit is the tables' own rounding: pressure and density are printed to 5 or 6 significant figures, temperature to 3 decimals, speed of sound to 3 decimals.

### Tests for Part B

**B1. Hand calculations** (working shown in the test; computed independently with Python `decimal` and float64, not with the code under test):

1. Sea-level density. ρ₀ = P₀ M₀ / (R\* T₀) = 101325 × 28.9644 / (8314.32 × 288.15) = 2 934 817.83 / 2 395 771.308 = 1.224 999 kg/m³. Published: 1.2250.
2. Sea-level speed of sound. γ R\* T₀ / M₀ = 1.40 × 8314.32 × 288.15 / 28.9644 = 115 800.08 m²/s²; square root = 340.294 m/s. Published: 340.294.
3. Sea-level viscosity. T₀^1.5 = 4891.341; T₀ + S = 398.55; μ₀ = 1.458 × 10⁻⁶ × 4891.341 / 398.55 = 1.7894 × 10⁻⁵ Pa·s. Published: 1.7894 × 10⁻⁵.
4. Tropopause pressure (layer 0 → 1, ATM-4). Exponent g₀ M₀ / (R\* L) = 9.80665 × 28.9644 / (8314.32 × −0.0065) = −5.255 876. T₀/T₁ = 288.15/216.65 = 1.330 025 4; ln = 0.285 198 0; × exponent = −1.498 973; exp = 0.223 358 6; P₁ = 22 632.06 Pa. Published: 22 632.1.
5. Isothermal layer (ATM-5) at H = 15 000 m′. Argument = −9.80665 × 28.9644 × 4000 / (8314.32 × 216.65) = −0.630 753 7; exp = 0.532 190 6; P = 22 632.06 × 0.532 190 6 = 12 044.57 Pa.
6. Geopotential conversion (ATM-1) at Z = 86 000 m: H = 6 356 766 × 86 000 / 6 442 766 = 84 852.05 m′, which is the layer-7 top. Round trip through ATM-2 returns 86 000 within 1 × 10⁻¹⁰ m.
7. Z = 10 000 m geometric: H = 9 984.29 m′; T = 288.15 − 0.0065 × 9 984.29 = 223.252 K; P = 101325 × (288.15/223.252)^(−5.255 876) = 26 499.9 Pa; ρ = 0.413 51 kg/m³. These match the commonly quoted 10 km values and will be checked against Table I.
8. All six remaining layer-base pressures by chaining 4 and 5: 5 474.889, 868.0187, 110.9063, 66.938 87, 3.956 420 Pa, and 0.373 384 Pa at the 84 852 m′ top. Published to six figures: 5474.89, 868.019, 110.906, 66.9389, 3.95642 (cross-checked), 0.37338 (verify).

**B2. Published-table comparison.** One test row per altitude, each quoting the table (I or II), the printed values, and the printed precision. Altitudes: −5 000 (if in domain), 0, 500, 1 000, 2 000, 5 000, 10 000, 11 000, 15 000, 20 000, 25 000, 30 000, 32 000, 40 000, 47 000, 50 000, 51 000, 60 000, 70 000, 71 000, 80 000, 84 000, 86 000 m geometric, plus the seven layer bases in geopotential altitude. Tolerance: half a unit in the last printed digit, plus 1 × 10⁻¹² relative for float64. **The values go in only after they are read from the document (Question 2).**

**B3. Properties** (fast-check over the altitude domain, fixed seed):

- Every output is finite and strictly positive (except altitudes).
- Pressure and density strictly decrease with geometric altitude: for Z₁ < Z₂, P(Z₁) > P(Z₂) and ρ(Z₁) > ρ(Z₂).
- Temperature is continuous across every layer boundary: |T(H_b − 10⁻³) − T(H_b + 10⁻³)| < 10⁻⁴ K; likewise pressure within 10⁻⁶ relative.
- Ideal-gas consistency: ρ R\* T_M / M₀ equals P within 10⁻¹² relative at every altitude.
- Hydrostatic consistency (independent of the closed-form pressure formulas): the central difference dP/dH over ±1 m equals −ρ g₀ within 10⁻⁶ relative at every altitude. This checks that ATM-4, ATM-5 and ATM-6 are mutually consistent with the hydrostatic equation they were derived from.
- Geopotential round trip: Z → H → Z within 10⁻⁹ relative.
- Determinism: two calls with the same altitude give `Object.is`-identical fields.
- Out-of-domain altitudes (including NaN and infinities arriving through a forged brand) throw `InvalidInputError`; nothing is ever returned for them.

**B4. Golden regression.** `packages/physics/golden/ussa1976.json`: all fields at every 1 000 m from the lower bound to 86 000 m, written once by the implementation after B1 to B3 pass, committed, and compared bit-exactly from then on (CLAUDE.md 7.6).

### Known-limitations entries to add

- Standard atmosphere is an idealised mean; real conditions differ by several percent in density. Site overrides come in a later task.
- Domain [lower bound, 86 000 m]; outside throws.
- Molecular-weight treatment above 80 km per Question 5.
- Humidity is not modelled (the standard is dry air).

## Order of work after approval

1. Units (Part A) with tests, one commit.
2. Atmosphere constants, layer table and geopotential conversion with tests, one commit.
3. Temperature, pressure, density with hand-calculation and property tests, one commit.
4. Speed of sound and viscosity, one commit.
5. Published-table tests and golden file, one commit.
6. Docs updates ride with each commit.

## Questions needing your answer

1. Source for the four definitional conversions: approve the SI Brochure, or treat as needing no citation?
2. How do I get the 1976 document: PDF in `reference/`, your confirmation of the values, or an approved secondary transcription?
3. Keep gravity out of the atmosphere module (recommended)?
4. Lower bound of the domain: −5 000 m (recommended, if the tables confirm it) or 0 m?
5. Molecular-weight ratio above 80 km: implement Table 8 (recommended if the document is available) or document the ≤ 0.08 K discrepancy?
6. Branded types enforced at function boundaries only (recommended), or also helper functions for checked arithmetic?

## Approval record (2026-10-11)

1. SI Brochure (BIPM, 9th edition, 2019) approved as the source for `UNIT-*`; cite it anyway.
2. The owner has a copy of the 1976 document for `reference/`. Every value in Part B is to be verified against a specific page, with the page number recorded next to each value, before it becomes a test expectation. As of this revision the file is not in the repository (not in the working tree, not on any remote branch).
3. Gravity stays out of the atmosphere module. The standard's own g₀ = 9.80665 m/s² stays inside the atmosphere constants under the name `seaLevelGravityG0`; see `docs/conventions.md`, "Gravity: two different constants".
4. Lower bound −5 000 m, provided the document's tables confirm it.
5. Implement Table 8 (molecular-weight ratio, 80 to 86 km).
6. Branding at function boundaries only (D-010).
