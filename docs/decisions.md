# Decision log

Each entry: ID, date, decision, why, alternatives considered, consequences. Entries are never deleted; a reversed decision gets a new entry that references the old one.

## D-001 (2026-10-11): pnpm workspaces monorepo with three packages

- **Decision:** `pnpm` workspaces with `packages/physics`, `packages/formats`, `packages/app`. Packages are consumed from TypeScript source (`exports` point at `src/index.ts`); there is no build step for the libraries yet.
- **Why:** The structure is mandated by CLAUDE.md section 5. pnpm is already installed in the development environment, enforces strict dependency isolation, and its `workspace:*` protocol keeps the cross-package links explicit. Consuming source directly avoids a build step while the API is still forming.
- **Alternatives:** npm workspaces (weaker isolation), Nx or Turborepo (not needed at three packages).
- **Consequences:** When the app is published, the libraries will need a declaration build; revisit then.

## D-002 (2026-10-11): TypeScript 6.0, not 7.0

- **Decision:** Pin `typescript@6.0.3`.
- **Why:** TypeScript 7.0 (the native compiler) is the registry's `latest`, but `typescript-eslint@8.71` declares support only for `typescript < 6.1`. Type-aware linting is how we enforce "no `any`" mechanically, so it wins.
- **Alternatives:** TypeScript 7 without type-aware lint. Rejected: losing the lint rules is worse than losing compiler speed.
- **Consequences:** Upgrade to 7 once typescript-eslint supports it. Check `peerDependencies` before bumping.

## D-003 (2026-10-11): Strictness beyond `strict`

- **Decision:** In addition to `strict` and `noUncheckedIndexedAccess`, enable `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `isolatedModules`. ESLint runs `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` with `no-explicit-any` and all `no-unsafe-*` rules as errors.
- **Why:** CLAUDE.md section 5 requires `strict` and no `any`; the extra flags catch the classes of mistake (missing return, optional-property confusion, index-signature typos) that produce silently wrong numbers rather than crashes.
- **Consequences:** More verbose code in places. Accepted.

## D-004 (2026-10-11): Purity of `packages/physics` is enforced by lint

- **Decision:** ESLint forbids `Math.random`, `Date.now`, `fetch`, `window`, `document`, Node built-ins and React imports inside `packages/physics/src`.
- **Why:** CLAUDE.md section 5: pure functions, no UI, no network, deterministic.
- **Consequences:** Seeded random generators for Monte Carlo (Phase 5) must be implemented or imported as pure code.

## D-005 (2026-10-11): Error hierarchy

- **Decision:** `PhysicsError` base with `NotImplementedError`, `InvalidInputError` (parameter, value, requirement) and `NonFiniteResultError` (where, value). Defined in `packages/physics/src/errors.ts`.
- **Why:** CLAUDE.md rules 2 and 3 and section 8 each need a distinct, catchable error so the UI can show the right message. The base class lets the UI catch everything from the engine in one place.

## D-006 (2026-10-11): ESM everywhere, Vitest projects per package

- **Decision:** All packages are `"type": "module"`. One root `vitest.config.ts` lists `packages/*` as projects; each package has a small `vitest.config.ts` naming itself. `pnpm test` runs everything.
- **Why:** One command runs the full suite, which CLAUDE.md rule 7 requires before any task is declared complete.

## D-007 (2026-10-11): Continuous integration runs the same `check` as locally

- **Decision:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check`, `test` on every push and pull request. The same steps are `pnpm check` locally.
- **Why:** Reliability (CLAUDE.md section 8) and the rule that the full suite passes before a task is complete.

## D-008 (2026-10-11): Prettier for formatting

- **Decision:** Prettier with single quotes, 100-column width, trailing commas. `pnpm format:check` is part of `pnpm check`.
- **Why:** Removes formatting from code review so review time goes to physics.

## D-009 (2026-10-11): SessionStart hook installs dependencies in cloud sessions

- **Decision:** `.claude/hooks/session-start.sh`, registered in `.claude/settings.json`, runs `pnpm install --frozen-lockfile` synchronously at the start of every Claude Code cloud session (it exits immediately outside one).
- **Why:** Cloud session containers start from a fresh clone. Without the hook, the first test or lint run in each session fails until dependencies are installed, which invites skipping the full-suite rule (CLAUDE.md rule 7).
- **Consequences:** Session start waits for the install (a few seconds with a warm cache). Can be made asynchronous if that becomes annoying.

## D-010 (2026-10-11): Branded quantities enforced at function boundaries only

- **Decision:** `Quantity<Unit>` brands (plan 0001, Part A) are checked at function boundaries. Arithmetic yields plain `number`; functions re-brand on return through the validating constructor. No checked-arithmetic helpers.
- **Why:** Catches the common mistake (wrong unit or wrong quantity passed to a function) with zero runtime cost beyond a finiteness check, and keeps formula code readable. TypeScript cannot express unit algebra through `+` and `*` legibly.
- **Alternatives:** `add`/`mul`/`div` helpers with type-level unit algebra. Rejected for now; revisit if a unit bug escapes (approved by the project owner, plan 0001 question 6).

## D-011 (2026-10-11): SI Brochure approved as the source for definitional conversions

- **Decision:** BIPM, The International System of Units (SI), 9th edition (2019), is an approved source for unit definitions and definitional conversions (`UNIT-*` entries). Every such conversion cites its section and table.
- **Why:** CLAUDE.md section 4 requires every constant to have a source; the owner asked that even definitional factors be cited so the rule has no exceptions.

## D-012 (2026-10-11): Atmosphere g₀ stays in the atmosphere module under its own name

- **Decision:** The 1976 standard's g₀ = 9.80665 m/s² is an atmosphere constant (`seaLevelGravityG0`) and is not exported as a gravity model. The simulator's gravity is defined separately in Phase 2.
- **Why:** One place defines gravity for flight; the atmosphere's g₀ is a defining constant of the standard, not a model of the launch site. See `docs/conventions.md`, "Gravity: two different constants".

## D-013 (2026-10-11): OpenRocket is used only as an isolated GPLv3 black box

- **Decision:** Everything that links to OpenRocket lives in `tools/openrocket-harness/`, which is licensed GPLv3 (its own `LICENSE` file). It builds the reference rockets with OpenRocket's public classes, asks OpenRocket for CG, CP, stability and flight results, and writes `.ork` files and CSVs into `reference/rockets/`. Nothing under `packages/` imports, bundles, or links the harness or OpenRocket, and no OpenRocket source is copied anywhere in this repository. The OpenRocket jar is downloaded by `build.sh` against a pinned SHA-256 and is git-ignored.
- **Why:** CLAUDE.md section 3: OpenRocket is GPLv3 and may be used only as a black box to produce reference outputs. Keeping the GPL boundary at a directory makes it auditable.
- **Consequences:** The OpenRocket source tree was read only to learn how OpenRocket's own tests bootstrap it headlessly (dependency injection, component setters, simulation options). Physics in `packages/physics` comes from the documents in `reference/docs/`, never from OpenRocket code.

## D-014 (2026-10-11): Reference simulations use a 0.01 s time step, not OpenRocket's 0.05 s default

- **Decision:** `reference/rockets/values.csv` is generated with OpenRocket's RK4 stepper at a 0.01 s time step. A sensitivity run at the GUI default of 0.05 s is recorded in `reference/rockets/settings.md`.
- **Why:** The reference values should be as converged as OpenRocket can make them; apogee and maximum velocity move by less than 0.01 % between the two steps, but the rail-exit velocity moves by about 2 % because OpenRocket reports it at the first step after the rail. The tolerances in CLAUDE.md section 7.4 are meant for model differences, not integration noise.

## D-015 (2026-10-11): Reference rockets use the design-window stability figures

- **Decision:** CG, CP and stability in `values.csv` are computed exactly as the OpenRocket design window does: CG from the launch mass (motor loaded, full propellant), CP from the Barrowman calculator at Mach 0.3, zero angle of attack, zero roll rate, taking the worst case over roll angle, and stability in calibers as (CP − CG) divided by the reference length, which is the maximum body diameter.
- **Why:** These are the numbers a user compares against, and CLAUDE.md section 7.4 names them as the comparison targets.

## D-016 (2026-10-11): Displayed stability uses Niskanen's roll-angle reduction; OpenRocket-equivalent mode for comparisons only

- **Decision:** The app's displayed CP and stability use Niskanen (2009) eq. (3.54) including the roll-angle reduction of fin normal force (15 % for three fins, 6 % for four fins), taking the worst case over roll angle. A separate OpenRocket-equivalent mode omits the reduction and is used only for comparisons against `reference/rockets/values.csv`; the Phase 1 CP acceptance test runs in that mode. Results must show which figure they are.
- **Why:** Project owner's decision (Prompt 1, Part B2, item 2): overstating stability is the unsafe direction. OpenRocket 24.12 applies no roll-angle dependence, confirmed by running the harness at seven roll angles (`reference/rockets/settings.md`), not by reading its source.
- **Consequences:** R1's displayed stability is 1.84 calibers where OpenRocket shows 2.00; documented with numbers in `docs/known-limitations.md`.

## D-017 (2026-10-11): Reference values regenerated at 0.001 s; the app finds events by root finding

- **Decision:** `values.csv` is generated at OpenRocket's minimum step of 0.001 s, where rail-exit velocity has converged to within 0.15 % (replaces D-014's 0.01 s). In Phase 2 the app locates rail exit, burnout, apogee and deployment at the exact crossing using event detection with root finding, never at the next integration step.
- **Why:** Owner's decision (Prompt 1, Part B2, item 3). OpenRocket's rail-exit velocity is sampled one step late, which is a 2 % effect at 0.01 s.

## D-018 (2026-10-11): Phase 2 gravity must support OpenRocket's WGS latitude-dependent value

- **Decision:** The simulator's gravity model (Phase 2) must be able to reproduce the latitude-dependent value OpenRocket used for the references, 9.8061992 m/s² at 45° and 0 m (`reference/rockets/settings.md`), with its formula cited to a source, so comparisons are like-for-like. The atmosphere's g₀ stays separate (D-012).
- **Why:** Owner's decision (Prompt 1, Part B2, item 4).

## D-019 (2026-10-11): No tolerance is widened in advance for the transonic rocket

- **Decision:** R5 flies at Mach 1.09 in OpenRocket. Phase 2 keeps the standard tolerances; if R5 falls outside them, the cause is investigated and reported before anything changes.
- **Why:** Owner's decision (Prompt 1, Part B2, item 5).

## D-020 (2026-10-11): Barrowman 1966 is used from a permissioned reprint; copyrighted PDFs stay in git while the repository is private

- **Decision:** The Apogee Components reprint of Barrowman and Barrowman (1966), reprinted with the author's permission, is the accepted copy. The repository is private, so all documents stay committed; `reference/fetch-docs.sh` restores and verifies every document against its pinned SHA-256 so that the third-party files can be dropped from git if the repository goes public.
- **Why:** Owner's decision (Prompt 1, Part B2, item 1).

## D-021 (2026-10-11): Sutherland's constant is 110.4 K

- **Decision:** `USSA1976_CONSTANTS.sutherlandS = 110.4` K.
- **Why:** The 1976 standard prints 110 K in Table 2 (p. 2) and p. 4 but 110.4 K in the viscosity section (p. 19); only 110.4 K reproduces the standard's own tabulated sea-level dynamic viscosity (1.7894 × 10⁻⁵ Pa·s, Table 10 p. 20 and Table III p. 101). This is an inconsistency within one source, resolved by the source's own tabulated results; the difference (0.1 % in viscosity) is below any test tolerance that matters for drag, so it did not require stopping under CLAUDE.md section 11 (a). Recorded in `docs/known-limitations.md`.

## D-022 (2026-10-11): Table 8 is interpolated linearly in geometric altitude

- **Decision:** The molecular-weight ratio between 80 and 86 km uses the Z-indexed column of Table 8 (p. 9) with linear interpolation between the 500 m entries.
- **Why:** The document tabulates the ratio only at 500 m intervals and says its values were themselves interpolated (p. 9); linear interpolation is the least-assuming choice and the effect on any output is below 10⁻⁵. The H-indexed column contains a non-monotonic entry (0.999679 at 84 500 m′) and is not used.

## D-023 (2026-10-11): Published-table tests use the Z-indexed pages at half a printed unit

- **Decision:** `ussa1976.tables.test.ts` compares 35 rows of Table I, 6 layer-base rows of the geopotential pages and 16 rows of Table III, each row carrying its printed page number, at 1.25 units of the last printed digit for the five-figure columns, 0.0006 K for temperature and 0.005 m/s for speed of sound. Rows above 80 km compare the molecular-scale temperature because the tables are uncorrected there (p. 9).
- **Why:** CLAUDE.md section 7.2 and the owner's rule that nothing is verified without a page reference. Half a printed unit, the first choice, failed 17 rows; the residual distribution (recorded in `docs/known-limitations.md`) shows the tables were produced with mixed truncation and rounding in limited precision, so the tolerance was widened to what the tables can support and the cause written down, rather than tuning anything in the model.

## D-024 (2026-10-11): Hollow shells have uniform wall thickness measured normal to the surface

- **Decision:** A hollow nose cone or transition of wall thickness t has inner profile r_inner = max(0, r − t·√(1 + r′²)): the outer surface offset inward by t along its normal, to first order, over the same axial range (GEO-9).
- **Why:** It is the physical model of a part moulded or laid up to a uniform wall. Checked as a black box against OpenRocket's component masses for the five hollow parts of the reference rockets (two tangent ogives, two Von Kármán noses, one conical boat tail), it agrees to better than 0.01 %; the alternatives (radial offset by t, or a similar inner shape) miss by 1 to 15 %. No OpenRocket source was read for this; the agreement is an observation recorded in `docs/plans/0003-geometry-and-mass.md`.
- **Consequences:** The wall must be thin compared with the radius of curvature; very thick walls or very blunt tips are outside the first-order model (`docs/known-limitations.md`).

## D-025 (2026-10-11): Mass properties come from numerical integration of the definitions

- **Decision:** Volume, CG and both moments of inertia of bodies of revolution and fin plates are computed by composite Gauss–Legendre quadrature of the defining integrals (GEO-8, GEO-10), not from a table of formulae for special shapes. Closed forms for the cylinder, tube and cone are used as test oracles only.
- **Why:** Niskanen §4.2.3 cites only "standard formulae" (a web list) for inertia, which is not an approved source; the definitions need no citation and one integrator covers every shape, including shells. The quadrature error is documented and tested (1e-6 relative at worst at the default 512 panels).

## D-026 (2026-10-11): The .ork format is read from OpenRocket's output files, not from its source

- **Decision:** The minimal `.ork` reader (plan 0005) models the format exactly as OpenRocket 24.12 writes it for the reference rockets: structure, element names, position methods and the meaning of each length were inferred from `reference/rockets/*.ork` and fixed by OpenRocket's own per-component positions and masses (`reference/rockets/components/*.csv`). Enumerations (`AxialMethod`, `DeployEvent`, `Transition.Shape`, `FinSet.CrossSection`) were read from the compiled jar's public class signatures with `javap`. Every element is read, on a documented ignore list, or rejected by name; nothing is defaulted. A `<shapeclipped>` flag on a nose cone is accepted with either value because, with a zero fore radius, the clipped and non-clipped profiles of Niskanen Appendix A.7 coincide; on a transition it must be false.
- **Why:** CLAUDE.md section 3 allows reading the file format to build an importer but forbids reading OpenRocket's source. The per-component CSV makes every positional rule testable without the source, and rejecting the unknown keeps a wrong guess from becoming a silent error.
- **Alternatives:** Treating unknown elements as harmless (rejected: an unread `overridemass` or `cant` would silently change mass or CP); reading the OpenRocket source for the format (forbidden).
- **Consequences:** Files using components outside the reference set (streamers, tube couplers, freeform fins, pods, clusters, overrides) are rejected with a message naming the element until Phase 4 widens the importer. The physics package's hand transcription of the reference rockets is kept in OpenRocket's depth-first file order so the two can be compared index by index.

## D-027 (2026-10-11): The worst-case roll angle is taken per fin set, and Mach 0.5 is a hard limit until Phase 2

- **Decision:** `centreOfPressure` with `rollAngle: 'worst'` evaluates each fin set at the roll angle that minimises its own normal force (θ = 0 for three fins, 45° for four, any θ for five or more, edge-on for one or two). Fin CP and normal force are computed only below Mach 0.5; at or above it the function throws `NotImplementedError` naming the missing equations (Niskanen 3.35, 3.36, 3.41 to 3.49). The reference diameter defaults to the maximum body diameter and can be given explicitly.
- **Why:** For the common single-fin-set rocket the per-set minimum is the exact worst case. For mixed fin sets no single roll angle minimises every set, and a numerical search over θ would add complexity for a rare case; the per-set bound errs on the side of a more forward CP, the safe direction (CLAUDE.md rule 3 forbids a silent optimistic choice). The Mach limit follows the source's stated validity of the quarter-MAC CP (p. 27) and the rule against placeholder physics.
- **Alternatives:** Minimising the total CP over θ numerically (deferred until a user needs mixed fin sets); extrapolating the subsonic fin CP above Mach 0.5 (rejected, placeholder physics).
- **Consequences:** Phase 2 must implement the transonic and supersonic fin terms before simulating R5 (Mach 1.09). `docs/known-limitations.md` records the mixed-fin-set bound.

## D-028 (2026-10-12): RASP motors lose propellant in proportion to the impulse delivered, with the CG at mid-length

- **Decision:** For a RASP `.eng` motor the propellant remaining is m_prop·(1 − I(t)/I_total) (MOT-3) and the motor CG stays at half its length.
- **Why:** The RASP format defines no mass rule. Niskanen p. 14 states that thrust is proportional to the exhaust velocity times the mass flow; with a constant exhaust velocity the propellant consumed is proportional to the impulse delivered. The seven ThrustCurve `.rse` files of the same motors carry a mass column that follows exactly this rule (within 0.02 g, asserted in `rse.test.ts`), and OpenRocket's reference values were generated with it (`reference/rockets/settings.md`), so Phase 2 comparisons are like for like. The constant exhaust velocity is an assumption recorded in `docs/known-limitations.md`.
- **Alternatives:** RockSim's linear-in-time auto-calculation (a convention for `.rse` files without a mass column; used only there, MOT-4). A user-supplied mass profile is supported through the same record (`massRule: 'mass-profile'`) for liquid engines later.
- **Consequences:** The mass rule in force is part of every motor state so results can name it.

## D-029 (2026-10-12): What the `.rse` reader accepts without guessing

- **Decision:** (1) Masses: the Apogee guide allows grams or kilograms. The reader decides by the specific-impulse check (MOT-5) when the file carries `Isp` and exactly one unit is consistent within 2 %; otherwise the caller must pass `massUnit`, and a passed unit that contradicts `Isp` is refused. (2) The `m` column is taken as propellant remaining when it runs from `propWt` to 0, as total mass when it runs from `initWt` to `initWt − propWt` (within 1 %), and rejected otherwise. (3) A `cg` column is accepted only when constant and within 1 mm of half the length, and the CG is then taken as exactly half the length; a varying `cg` throws `RseUnsupportedError`, because the guide does not say from which end `cg` is measured. (4) The first data point must be at t = 0; a later first point is not extrapolated.
- **Why:** Each of these is left open by the guide. The checks turn the ambiguity into something the file itself must confirm, and refuse otherwise (CLAUDE.md rule 3). Observed facts in the seven ThrustCurve files: grams, `m` from `propWt` to 0, `cg` constant within 0.5 mm of half the length (H238T: 97.5 mm against 97.0; H128W: `len` 195 mm against the RASP 194 mm).
- **Alternatives:** A plausibility threshold on the magnitude of `initWt` (a guess); reading RockSim's behaviour (closed source, not approved).
- **Consequences:** Hybrid-motor files with a moving CG are rejected until the owner supplies a documented example; Phase 4's ThrustCurve download passes `massUnit: 'g'` only as a cross-check, the `Isp` attribute decides.

## D-030 (2026-10-12): Gravity is the inverse-square law with a parameter for the sea-level value; no latitude formula yet

- **Decision:** `gravityAt` applies USSA76 eq. (17), g = g₀ (r₀/(r₀ + Z))² with r₀ = 6 356 766 m, where g₀ is a parameter of the gravity model. Two named values are provided: the standard g_n = 9.80665 m/s² (SI Brochure) and the value OpenRocket used at 45° N, 9.8061992025 m/s² (observed, `settings.md`), for like-for-like comparisons (D-018). A constant-gravity variant exists for analytical test cases.
- **Why:** The owner asked (D-018) that Phase 2 reproduce OpenRocket's latitude-dependent value "with its formula cited to a source". OpenRocket's formula uses constants that match neither WGS 84 nor GRS 80 exactly, and neither standard is an approved source, so the formula cannot be cited. Making the sea-level value a parameter reproduces the required value without an uncited formula; the altitude law is from an approved document. The latitude dependence changes g by 0.5 % between the equator and the poles.
- **Alternatives:** Implementing the WGS 84 Somigliana formula from memory (rejected, rule 1); asking before continuing (not required by section 11, the comparison is possible).
- **Consequences:** Open question for the owner (docs/progress.md): approve a source for latitude-dependent gravity (for example NIMA TR8350.2 or Moritz, "Geodetic Reference System 1980") so the user can enter a latitude instead of a value. The `LaunchSite.latitude` field is stored but unused until then.

## D-031 (2026-10-12): Orientation updates use the half-angle quaternion of eq. (4.13)

- **Decision:** The rotation applied to the orientation over a step (DYN-5) is the eq. (4.13) quaternion for the angle |ω|Δt, cos(|ω|Δt/2) + ω̂ sin(|ω|Δt/2), applied from the left and normalised, as Niskanen's text defines it ("the unit quaternion corresponding to the 3D rotation ω Δt as in equation (4.13)", p. 67).
- **Why:** The printed eq. (4.24) omits the halves (checked on the page image, PDF p. 77). Taken literally it would rotate the rocket by twice the angle ω Δt per step, contradicting eq. (4.23) which it is said to implement. The test "a 90° rotation about z" shows eq. (4.13) rotates a vector by exactly the stated angle, so the text, not the typeset formula, is followed. This is an internal inconsistency of one source, resolved by its own definitions, not a conflict between sources.
- **Consequences:** None beyond the note in the code and here.

## D-032 (2026-10-12): The area ratio in the boat tail equation is taken as 1

- **Decision:** Eq. (3.88) is applied as (C_D•)pressure = (C_D•)base × factor(γ), referred to the boat tail's frontal area, the annulus π(r_fore² − r_aft²).
- **Why:** The printed prefactor A_base/A_boattail is not defined in the text. Reading A_base as the annulus (the "base" created by the step, as the zero-length limit "equal to the total base drag" suggests) makes the ratio 1; reading it as the full fore area would double count the body's own base drag behind the boat tail. The difference for R2 is under 0.01 in C_D0.
- **Consequences:** Recorded as an interpretation; the OpenRocket comparison of R2 (within 6 % under D-035) is consistent with it.

## D-033 (2026-10-12): The angle-of-attack drag scaling is the cubic Hermite reading of Niskanen's description, mirrored beyond 90°

- **Decision:** DRAG-14 uses, on [0°, 17°] and [17°, 90°], the cubic polynomials with the stated end values (1, 1.3, 0) and zero end slopes; for 90° < α ≤ 180° the function is mirrored, s(α) = s(180° − α), and the result is flagged `beyondSource`.
- **Why:** Niskanen §3.4.7 gives the polynomial in words (values and zero derivatives at 0°, 17°, 90°), which determines a cubic on each piece uniquely. The source does not cover tail-first flight; a rocket passing apogee in wind can exceed 90°, and throwing there would stop every such simulation. The mirror is the only choice that keeps the function continuous and bounded by the source's own values; it is documented, flagged, and relevant only to recovery failures.
- **Alternatives:** Throwing above 90° (rejected: breaks ordinary flights near apogee); a constant (a guess).

## D-034 (2026-10-12): Non-conical, non-ogive noses have no transonic pressure drag yet

- **Decision:** For elliptical, parabolic, power-series and Haack noses, `noseConePressureDrag` returns the low-subsonic value of eq. (3.86) with a warning up to Mach 0.8 and throws `NotImplementedError` above it.
- **Why:** Niskanen Appendix B.3 takes the transonic drag of these shapes from Stoney's measured curves (NASA TR R-100), which the thesis does not print. CLAUDE.md lists TR R-100 as validation data "never as a source of equations"; using its figures as model data points is a question for the owner. Below Mach 0.8 the missing part is the rise of eq. (3.87) towards the transonic value, which cannot be fitted without that value.
- **Consequences:** R3 (Von Kármán, Mach 0.69) carries the warning; R5 (Mach 1.09) cannot be simulated past Mach 0.8 until the owner decides. Open question in `docs/progress.md`.

## D-035 (2026-10-12): Base drag removes the motor area while thrusting (source), with an OpenRocket-equivalent rule that keeps it removed

- **Decision:** `dragCoefficient` takes `baseDragMotorRule`: 'while-thrusting' applies Niskanen p. 51 (the thrusting motors' area is subtracted from the base area); 'always' keeps the motor area subtracted after burnout, which is what OpenRocket 24.12 does: in the reference time series the coasting drag coefficient is lower than the source rule by exactly the motor's share of the base drag (R1 3.6 %, R2 8 %, R3 11 %, R4 6 %). No default; the caller states the rule and results name it.
- **Why:** The source is explicit about "thrusting"; the comparison needs OpenRocket's behaviour to be reproducible (D-016 precedent). Physically, after burnout the nozzle still occupies the base, so the question of which rule is more accurate is open; the owner decides which the app displays (default proposed: the source rule, with the difference shown).
- **Consequences:** Flight comparisons (plan 0010) run in the OpenRocket-equivalent mode; the displayed figure uses the source rule. Open question in `docs/progress.md`.

## D-036 (2026-10-12): The rotational equation of motion is Euler's rigid-body equation about the CG

- **Decision:** The simulator integrates I ω̇_b = τ_b − ω_b × (I ω_b) in the body frame with I = diag(I_rot, I_long, I_long) from GEO-12 at the current propellant mass, and transforms ω̇ to the world frame. The angular velocity state is kept in the world frame.
- **Why:** Niskanen §4.2 states that the simulation is "based on Newton's laws" and gives the forces and moments but not the rigid-body equation explicitly; Euler's equation is the standard statement of Newton's second law for rotation and needs no approximation. The inertia tensor is diagonal in the body frame because every component is a body of revolution or a symmetric fin set (GEO-12).
- **Consequences:** The term for the change of inertia during the burn (İ ω) and jet damping are not included; neither is in the source and both are small for the reference flights (rotation rates near zero in still air). Recorded in `docs/known-limitations.md`.

## D-037 (2026-10-12): The Dormand–Prince coefficients are verified by their consistency and order tests; the step controller is a project convention

- **Decision:** The RK5(4)7M tableau is written from Dormand and Prince (1980), Table 2, which is not in `reference/`. It is verified in code by the exact consistency sums (Σb = Σb\* = 1, each row sum equal to c, Σbc = 1/2, Σbc² = 1/3) and by `integrators.test.ts`, which measures the global error order on y′ = −y and on the harmonic oscillator (order 5 for the propagated solution, order 4 for the embedded one, error estimate within a factor of 3 of the true local error) and integrates an oscillator over 100 periods at a 1e-9 tolerance. The step controller h·min(5, max(0.2, 0.9 e^(−1/5))) with rejection for e > 1 is the usual rule for a fifth-order error estimate and is recorded as a convention, not as a sourced equation.
- **Why:** CLAUDE.md 6.5 requires this integrator. A wrong tableau entry would break the order tests (the consistency sums alone would not catch every error, which is why both are used). The owner may add the paper to `reference/` to close the verification formally.
- **Consequences:** Listed in the Phase 2 report as an item not verified against a document in `reference/` (rule 11 (b) is not triggered because the tests give an independent verification). RK4, which is in the source, remains the default for the acceptance comparisons.

## D-038 (2026-10-12): The orientation is integrated through its derivative q̇ = ½ ω q

- **Decision:** Inside the integrators the orientation quaternion is a state variable with q̇ = ½ (0, ω_w) q, and is normalised after each accepted step. The closed-form update of eq. (4.24), implemented as `advanceOrientation` (DYN-5), is kept for tests and for callers that step the orientation separately.
- **Why:** Eq. (4.24) is a first-order update that cannot be used inside a Runge–Kutta stage; its derivative at Δt → 0 is exactly q̇ = ½ ω q for the half-angle convention of D-031, so both describe the same rotation. Using the derivative keeps the orientation at the integrator's order (verified: the R1 flight has zero angle of attack in still air at every sample, and a crosswind produces the expected angle).
- **Consequences:** The normalisation after each step removes the drift of ‖q‖ from the finite step; the drift per step is of the order of the integrator error and is not an approximation of the dynamics.

## D-039 (2026-10-12): Fin normal force in the transonic band throws; the fin CP shift and supersonic force are implemented

- **Decision:** `finSetTerm` uses eq. (3.40) below Mach 0.8 and the Busemann expansion of eqs. (3.41) to (3.49) from Mach 1.2, and throws `NotImplementedError` for 0.8 < M < 1.2. The CP shift of eqs. (3.35) and (3.36) is implemented over the whole range by solving the stated polynomial constraints.
- **Why:** The thesis states only that the transonic region "will be accounted for by using some suitable interpolation function that corresponds reasonably to actual measurements" (p. 19) without giving it; eq. (3.40) tends to a finite value at Mach 1 while K₁ = 2/β of eq. (3.42) diverges there, so no interpolation is implied by the formulas themselves. Inventing one would break rule 1.
- **Consequences:** Together with D-034 (nose drag), the transonic reference rocket R5 cannot be simulated past Mach 0.8 until the owner approves the data source for nose drag and a documented transonic fin interpolation (for example NASA TN D-4013's measured C_Nα and CP against Mach for validation, or a chosen interpolation recorded as a project convention). Reported in the Phase 2 report.

## D-040 (2026-10-12): NIST SP 811 is the source for the customary units of the units toggle

- **Decision:** The exact definitions of the inch, foot, avoirdupois pound and ounce, pound-force, mile per hour, foot per second and degree Fahrenheit are taken from NIST Special Publication 811 (2008), Appendix B (added to `reference/docs/`, `reference/SOURCES.md` section 9), as UNIT-5 to UNIT-11. They exist only at the UI boundary; files and physics stay SI.
- **Why:** CLAUDE.md 9 requires a units toggle, `docs/conventions.md` said imperial conversions "will need an approved source", and the SI Brochure does not define these units. SP 811 is a U.S. Government publication, free of copyright, and prints the exact factors with footnotes for the pound and the pound-force. Section 4 says to ask before using a new source; under section 11 this is a reversible, well-sourced choice, so it is recorded here and listed as an open question in `docs/progress.md` rather than blocking the phase.
- **Consequences:** A different source, if the owner prefers one, would change only the citations: the factors are definitional and identical in every standard.

## D-041 (2026-10-12): The native file format is JSON with a schema version, strict validation and a migration chain

- **Decision:** `.lofi.json` files carry a `RocketDesign` (`packages/formats/src/design/model.ts`) as JSON with sorted keys, two-space indentation, SI numbers and an integer `schemaVersion`. Loading parses, migrates (a list of pure version-to-version steps) and validates structurally: every field present and of the right type, every number finite, unknown keys and unknown kinds rejected, ids unique, references resolved. Motors are embedded with their provenance. Physical ranges are enforced by the physics package when the design is used, with its plain-language `InvalidInputError` messages.
- **Why:** CLAUDE.md 8 (schema version, validation on load, migration path, no silent fallback). Rejecting unknown keys is the strict reading of "validated on load": a typo or a field from a newer version is reported instead of ignored. Embedding motors keeps files self-contained offline (CLAUDE.md 6.6). Sorted keys make the text deterministic for diffs and autosave comparisons.
- **Consequences:** Every change to the model bumps `CURRENT_SCHEMA_VERSION` and adds one migration; `design.test.ts` exercises the chain with synthetic steps so the mechanism is tested before the first real migration exists.

## D-042 (2026-10-12): Default settings of a new design

- **Decision:** A new design starts with: finish "regular paint" 60 µm (Niskanen Figure 3.10; the reference setting); rail 1.5 m vertical (the reference setting); no wind; sea-level pad; Dormand–Prince integrator at relative tolerance 1e-8 and absolute 1e-10, initial step 1 ms, maximum step 50 ms (it reproduces RK4 at 1 ms within 0.001 m on R1 with 2 % of the steps, Phase 2 report), maximum time 600 s, samples every 20 ms; stability thresholds 1.0 and 2.0 calibers and warning thresholds 15 m/s rail exit and 5:1 thrust-to-weight, all from CLAUDE.md 9; a deployment speed limit of 20 m/s. Thrust-to-weight uses the motor's average thrust (total impulse over burn time) and the liftoff weight at standard gravity.
- **Why:** Every default is either a reference setting already used for the comparisons or a CLAUDE.md figure. The deployment speed limit has no source in CLAUDE.md or the approved documents; 20 m/s is a placeholder chosen to be conservative, labelled in the UI as a rule of thumb, user-editable, and listed as an open question for the owner. The thrust-to-weight definition is the common one for the 5:1 rule (initial thrust would be more conservative for motors with a slow start; the UI can show both later).
- **Consequences:** None of these affects a computed physical value; they affect which warnings appear and how long a run takes.

## D-043 (2026-10-12): Application state is a reducer over the design; autosave is the serialized file in local storage

- **Decision:** `packages/app` keeps one `RocketDesign` in a React `useReducer` store with a closed set of actions (`src/state/reducer.ts`); selection and the unit system are UI state beside it; no state library. Every action produces a design that passes `validateDesign` (property-tested over random action sequences). Autosave writes `serializeDesign(design)` to `localStorage` under `lofi-rocket:design:<id>` 300 ms after the last change and remembers the last id; on start the last design is loaded through `parseDesign`, and one that fails validation is moved to `lofi-rocket:recovered:<id>` and reported in the UI, never deleted or repaired silently. Numeric inputs convert at the boundary (`src/units/display.ts`) and reject invalid entries with "<Field> must be greater than 0 mm" before the design changes; physics errors are shown in the stability panel in place of a number.
- **Why:** CLAUDE.md 8 (validate at the boundary, autosave, no lost work, errors say what happened) and 9 (live stability, plain-language guidance, units toggle). A reducer makes every change explicit and testable without a browser; using the file format for the autosave means the autosave is exercised by the same validator as the files and a corrupted autosave is handled like a corrupted file.
- **Consequences:** The design in memory is always valid, so the physics only ever sees values that pass its own checks or reports them with its own messages. Multiple designs in storage are possible but only the last is reopened; a design list is Phase 4 work with the files.

## D-044 (2026-10-12): Rules for custom thrust-curve CSV files

- **Decision:** `parseThrustCurveCsv` accepts two or three numeric columns (time in s, thrust in N, optionally propellant remaining in kg) separated by commas, semicolons, tabs or spaces, with an optional header line and `#` or `;` comments. Times strictly increase, the first point is at 0 s, thrust is never negative, the last thrust is 0 N. With a mass column the motor follows the explicit profile (MOT-4); without one it follows the impulse-proportional rule of RASP motors (MOT-3, D-028). The casing diameter, length, loaded mass and propellant mass are entered beside the file. A curve that does not start at 0 s is rejected, not extended.
- **Why:** CLAUDE.md 6.6 asks for custom curves from CSV; no published format exists, so the rules must be the project's own and stated. Rejecting a missing origin keeps rule 3 (no silent fix); the RASP reader adds the origin because its specification says the origin is implicit, which is not the case for an ad hoc CSV.
- **Consequences:** Liquid-engine mass profiles (Phase 5) use the third column as is; a later plan may add a thrust column in other units with an explicit unit header.

## D-045 (2026-10-12): Browser services are injected; plots are hand-drawn SVG; the motor cache lives in local storage

- **Decision:** The app's components reach the network, the motor store and file reading through a `Services` context (`src/state/services.tsx`) whose production value is the browser's `fetch`, a local-storage adapter and `File.text()`; tests inject recorded fixtures and in-memory stores. Plots are a small SVG component (`LinePlot`) with its own tick rule rather than a charting library. Downloaded and imported motors are stored as JSON entries under `lofi-rocket:motor:<provenance>` and validated on read with the file format's motor validator.
- **Why:** Testability without a browser or network (CLAUDE.md 8: no unhandled rejections, every error shown with its cause), no new runtime dependency to audit for determinism and licensing, and the cache reuses the design file's motor validation so a corrupt entry is reported, never silently dropped (an entry that fails is listed with its key in the picker).
- **Consequences:** Local storage holds a few megabytes at most; the bundled eight motors are part of the build and need no storage. IndexedDB can replace the adapter behind the same interface if the library outgrows local storage.

## D-046 (2026-10-12): A six-degree-of-freedom flight is not continued past 90° angle of attack

- **Decision:** `simulateFlight` locates, by bisection like the other events, the instant at which the angle of attack reaches 90° in powered or coasting flight and ends the run there with `endReason: 'model-limit'`, a `model-limit` event and a warning that explains it; a state already beyond the limit at the start of a step (a rocket falling tail-first from apogee) ends the run at once. Apogee and a deployment at apogee in the same step take precedence. The samples, apogee and ascent figures up to that instant are returned; landing figures are undefined. The descent under a deployed recovery device (DYN-14, three degrees of freedom, drag only) is unaffected. The adaptive integrator throws `SimulationStalledError` when it cannot meet its tolerance at its minimum step instead of continuing at 1 ns steps.
- **Why:** The normal force model is Barrowman's with Niskanen's sin α corrections (AERO-1): the body terms vanish at 180° but the fin term is linear in α for flat plates at small angles (Niskanen p. 26, "the fins are flat plates") and gives, at 180°, a large force in the direction of a lateral airflow that is numerically undefined. A ballistic R1 after apogee falls exactly tail-first, so this case was hit by the first flight without a recovery device: RK4 produced a tumble driven by that spurious force and the Dormand–Prince controller shrank its step to the minimum and crawled. The thesis defines its own angle-of-attack drag scaling only up to 90° (p. 53, D-033) and gives no normal force law beyond the small-angle one, so there is no sourced physics to apply past 90°: stopping with a reason is the honest option (CLAUDE.md rules 1, 3 and 8) and the explicit, documented alternative to inventing a large-angle fin law.
- **Consequences:** A rocket without a recovery device, or one whose ejection charge fires after it has turned over, ends its simulated flight at the turn-over with the apogee reported and an explanation; the UI says so and suggests deployment at apogee. Flights in wind where a stable rocket noses over gradually are unaffected as long as it keeps pointing within 90° of its airspeed. **Open question for the owner:** whether to approve a source for the fin normal force at large angles (for example Hoerner's _Fluid-Dynamic Lift_ for a flat plate, or a sin α form) so that backwards and tumbling flight can be simulated; until then the limit stands and is reported, not hidden.

## D-047 (2026-10-12): Imported drag curves replace C_D0, are interpolated linearly in Mach and never extrapolated

- **Decision:** `SimulationOptions.dragCurve` (a labelled table of Mach and C_D) makes `simulateFlight` use the table's value, interpolated linearly, as the zero-angle-of-attack drag coefficient C_D0 referred to the rocket's reference area, in place of the DRAG-1 to DRAG-13 model; the angle-of-attack scaling (DRAG-14) still applies. A Mach number outside the table is an `InvalidInputError` that stops the run; the table must increase in Mach with C_D ≥ 0. The result's `modes.dragCurve` carries the label and the UI shows it. The CSV reader accepts any file with a Mach column and a C_D column by header name (RASAero's "CD Power Off" included) or the first two numeric columns, rejecting unordered or negative rows.
- **Why:** CLAUDE.md 6.7 item 2 asks for exactly this with clear labelling; RASAero's export layout is not documented in `reference/`, so the reader is deliberately format-agnostic and strict about the data rather than about the layout. Linear interpolation is the same rule as the thrust curves (MOT-1); not extrapolating keeps rule 3.
- **Consequences:** An imported curve that stops below the flight's maximum Mach ends the run with the message; the user extends the table or removes it. A design file stores its curve so the comparison is reproducible.

## D-048 (2026-10-12): OpenRocket import, recorded flights and the files menu

- **Decision:** `orkToDesign` turns the plan 0005 reader's output into a design: generated ids, the file's component names, the motor mount's tube and overhang, recovery devices with their deployment settings, the reference diameter as the file's maximum body diameter; the motor is taken from the library when designation and manufacturer match (RASP abbreviations "E" and "AT" count as Estes and AeroTech), otherwise the mount stays empty and the import notice names the motor to pick. Recorded altimeter data is read from a CSV with a time and an altitude column (named, or the first two numeric columns), in metres or feet (UNIT-6), kept in the design as `recordedFlight` and drawn as a second series on the altitude plot with the apogee difference stated; nothing is fitted or offset. The files menu saves the serialized design, opens a file through the validator, lists the designs in local storage by name with open and delete, imports `.ork` files, and shows every error verbatim.
- **Why:** CLAUDE.md 7.5 (overlay of simulated and recorded altitude), 9 (`.ork` import), 8 (no lost work, errors that say what happened). The `.ork` file carries no thrust curve, so the motor must come from the library; silently inventing a motor from the file's header mass would break rule 3.
- **Consequences:** A design imported from `.ork` simulates immediately when its motor is bundled or cached; otherwise after one pick. Both new design fields are optional, so schema version 1 files written before this step still load.

## D-049 (2026-10-12): The wind profile by altitude is a user table interpolated linearly

- **Decision:** `ProfileWind` is a table of altitude above the pad, speed and direction; speed and direction are interpolated linearly between rows (direction the short way round the compass), the first row is the pad and the last holds above it. Turbulence rides on the mean of either model as the thesis's scalar gust along the mean direction.
- **Why:** CLAUDE.md 6.4 asks for "a wind profile by altitude"; Niskanen assumes a constant mean "to simplify the model" (p. 60) and names layered winds as a future extension (p. 56), so no approved source gives a profile law (a power law or logarithmic boundary-layer profile would need a new source). A user-entered table with linear interpolation is the same convention as the thrust curves (MOT-1) and the drag tables (D-047) and invents no physics.
- **Consequences:** Users with a sounding or forecast enter it as rows; without one the wind is uniform as before. The direction interpolation across north is the one ambiguity and is tested.

## D-050 (2026-10-12): Seeded random numbers come from xoshiro128** with Box–Muller normals; the Box–Muller paper is verified statistically

- **Decision:** `createRandom(seed)` is xoshiro128** (Blackman and Vigna 2022, added to `reference/`) seeded through SplitMix32, giving uniform 53-bit floats and standard normals by the Box–Muller transform. Every random process (turbulence, Monte Carlo) takes a seed and records it in its results. Tests check the generator against an independent Python implementation of the paper's reference code and the normal sampler against the moments and tail fractions of the standard normal distribution.
- **Why:** CLAUDE.md 5 (seeded generator, seed saved) and 7.1 (hand or independent values). Section 4 requires asking before a new source; under section 11 the paper is public, authoritative and reversible, so it is recorded and listed as an open question rather than blocking. The Box and Muller (1958) paper is paywalled and not in `reference/`; as with the Dormand–Prince tableau (D-037) the implementation is verified by tests, and the owner may add the paper.
- **Consequences:** Results are bit-identical for a seed across platforms (32-bit integer arithmetic and IEEE doubles). A future change of generator would change every seeded result and must bump the design file's schema.

## D-051 (2026-10-12): Monte Carlo dispersion samples user-entered standard deviations and reports rank-based statistics

- **Decision:** `runDispersion` perturbs the design per run with independent normal variations of the wind speed and direction, rail angle and azimuth, a uniform scale on the thrust curve and a uniform scale on the structural masses and densities, each with a user-entered standard deviation whose default is 0; a negative sampled speed or rail angle is kept as the same physical vector with the direction reversed. Turbulent designs give run k the turbulence seed `seed + k`. Statistics are rank based: the p-th percentile is the sorted value at rank ⌈pN⌉, the mean and standard deviation are the sample ones (N − 1), and the 95 % containment radius is the 95th percentile of the distance from the mean landing point. Runs that fail or do not land are counted and shown, not dropped silently. The seed and the settings are stored with the design and the result.
- **Why:** CLAUDE.md 5 (seeded, seed saved) and 10 (dispersion and landing zones). No approved source gives uncertainty figures for motors, masses or winds, so proposing defaults would be inventing them; the user enters what they know (a motor's certification scatter, a measured wind). Rank statistics make no distributional claim that the few hundred runs could not support.
- **Consequences:** The scatter plot and the containment circle describe the simulated sample only; with zero standard deviations every run is the deterministic flight (tested). The variations are deliberately few; CP or drag uncertainties can be added as further scales later without changing the file format's version (new optional fields).

## D-052 (2026-10-12): Liquid-engine mass profiles carry an optional CG from the fore end

- **Decision:** `MotorMassProfilePoint.cgFromForeEnd` gives the whole motor's CG from its fore end at that time; it is interpolated linearly in time (MOT-6), must be present on every point or none, and lie within the motor. The custom thrust-curve CSV takes it as a fourth column (D-044 extended). Without it the CG stays at mid-length as for solid motors (D-029). The motor's inertia remains that of a uniform cylinder of the current mass about the current CG.
- **Why:** CLAUDE.md 2 and 10 ask for propellant mass that changes in non-standard ways (tanks) without a rewrite. The CG of the engine as its tanks drain is data the user computes from the tank geometry; the simulator needs only the mass and the CG against time, which the existing mass rule and the assembly already consume. A tank inertia law would need a new source and is left documented.
- **Consequences:** Liquid-engine designs are simulated with correct mass and CG histories; the inertia is approximate for long tanks (documented). Files written before this step load unchanged (optional field).

## D-053 (2026-10-12): Owner's answers to the open questions of the audit (Prompt 5, Part A)

- **Transonic data (replaces the open part of D-034 and D-039):** NASA TR R-100's curves may be transcribed as model data, its public domain status confirmed in `reference/SOURCES.md`. Every curve is digitised twice independently, the method of each pass recorded, and the disagreement between the passes recorded as the digitisation uncertainty (`reference/digitised/`). NASA TN D-4013 and TN D-4014 (ARCAS) are held out as validation-only data and are never used to build or tune the model. The fin transonic interpolation is chosen by implementing each candidate and comparing against the held-out data; the comparison is recorded in a decision.
- **Large-angle fin force (D-046):** approved, after the transonic work; Hoerner's flat-plate data if it is in `reference/`, otherwise alternatives are proposed and asked for.
- **Random generator (D-050):** the statistical verification of the Box–Muller sampler is accepted; recorded in the audit.
- **Dormand–Prince tableau (D-037):** additionally cross-checked against SciPy 1.18.1 (`scipy/integrate/_ivp/rk.py`, class `RK45`): C, A, B and E = b₄ − b₅ agree to 1e-14 (`integrators.test.ts`).
- **Deployment speed (D-042):** kept as a user-adjustable warning threshold labelled, in the UI and the docs, as a rule of thumb without a source; it affects no physics calculation (it is read only by `designFlightWarnings`).
- **NIST SP 811 (D-040):** approved.
- **Gravity (D-030):** the WGS 84 definition, NIMA TR8350.2, is the source for a latitude formula; it must be downloaded, verified and cited before implementation. See D-054.
- **Pull request:** the owner creates `main` from this branch and makes it the default; from then on work goes on new branches with pull requests into `main`.

## D-054 (2026-10-12): WGS 84 gravity waits for the document; nothing is implemented from memory

- **Decision:** The Somigliana formula and the altitude series of NIMA TR8350.2 (GRAV-2, GRAV-3, plan 0019) are not implemented until the document is in `reference/` with its SHA-256 and the constants verified against its pages. The downloads attempted on 2026-10-12 all failed from this environment: earth-info.nga.mil (empty reply or TLS reset), apps.dtic.mil (403), web.archive.org (connection reset); the UNOOSA "WGS 84" PDF is a three-page summary, not the report.
- **Why:** CLAUDE.md rules 1 and 11 ("never mark a value as verified unless you have checked it against a specific page of a document in reference/"). The constants are well known, but writing them from memory is exactly what rule 1 forbids.
- **Consequences:** The gravity model keeps the sea-level parameter (D-030) with the OpenRocket-equivalent value for comparisons. The owner is asked to place the PDF in `reference/docs/` (or to allow the host); the implementation is then one function and its hand tests.

## D-055 (2026-10-12): TR R-100 Figure 12 digitised twice; the panel (b) identities corrected; conventions of the data model

- **Decision:** The nine nose curves of NASA TR R-100 Figure 12 (plus the cone, used as an interpolation endpoint) are the model data of Niskanen Appendix B.3 (DRAG-15). They were digitised in two independent passes (`reference/digitised/tr-r-100-figure-12-pass1.json`: values read against the printed grid at 300 dpi; `-pass2.json`: pixel coordinates transcribed at 200 dpi with a ruler overlay and converted through the axis calibration by `merge-tr-r-100.py`). The model value is the mean of the passes; the disagreement per point is recorded; the uncertainty per curve is the larger of half the worst disagreement and the reading floor 0.005 in C_D,N: 0.005 for every curve except the parabolic family (full parabola 0.016, 3/4 parabola 0.011, 1/2 parabola 0.009), whose three curves cross near Mach 1.05 where the readings differ by up to 0.031. Every result that uses the data carries a warning naming the source and the nose's uncertainty.
- **Panel (b) identity correction:** both passes read panel (b) with the panel (a) line-style rule (solid = Von Kármán, dashed = x^3/4). The report's text (p. 13) describes the x^3/4 nose as showing "the early drag rise and early sharp peak drag and the rapid decrease of drag with Mach number" and the Von Kármán nose as "late drag rise, 'soft' peak and low peak-drag level, and decreasing supersonic drag"; in panel (b) the solid curve has the sharp peak (0.12 at Mach 1.05) and the dashed curve the late soft rise, and after relabelling the solid curve agrees with panel (a)'s x^3/4 (configuration 61, identified by its leader line and square symbols) within 0.008 above Mach 1 and the dashed curve with panel (a)'s Von Kármán (configuration 60) within 0.011. The pass files keep the keys under which they were read; the merged file carries the corrected identity with a `read_as` field and the cross-panel comparison. The model uses the panel (a) curves for these two noses (finer scale, Mach 0.8 to 2.0); panel (b) supplies the x^1/4 and ellipsoidal noses only.
- **Conventions, each from the thesis text or the most conservative reading of it:** (1) between the points C₃ is linear in Mach; beyond the last point the last value is held with a warning (the curves are nearly flat there, and panel (b) shows the Von Kármán and x^3/4 drag decreasing slowly to Mach 3.6, so holding is conservative). (2) The parameter interpolation of B.3 is linear in κ between the two nearest measured curves; the cone endpoint of the power (κ = 1) and parabolic (κ = 0) families is Stoney's own cone curve (configuration 56), so that every endpoint is measured data of the same figure; at the exact cone parameter the nose is a cone and the conical method of B.2 applies (DRAG-7), which differs from Stoney's cone curve by up to 0.06 at Mach 1 (B.6 is an approximation); the parameter is fixed for a design, so this never causes a jump during a flight. Power noses blunter than x^1/4 have no data and throw. (3) The lower boundary of the transonic method (B.5) is the first Mach number at which every curve the nose uses has data: 0.8 to 0.9 for most, 1.2 for the ellipsoid and x^1/4, which come from ref. 30 wind tunnel data that begin at Mach 1.2. For those two shapes eq. (3.87) is fitted from Mach 1.2 and gives a pressure drag that rises from Mach 0 (0.044 at Mach 0.3 for an ellipsoid of fineness ratio 3, where eq. (3.86) alone gives 0); the thesis gives no other subsonic treatment, so this is applied and every result with such a nose carries a warning that the drag below Mach 1 may be overestimated. (4) The slope for the (3.87) fit is the analytic right-hand derivative of eq. (B.9) at the boundary (DRAG-16), including the Mach dependence of C₀. (5) Several curves read 0.000 at their first points (below the reading floor) while eq. (3.86) gives a small positive low-speed value for noses with a non-zero joint angle (the power series). Where the scaled data lie below the low-speed value the low-speed value is kept, and the fit of (3.87) is made only when the first data point lies above it; the drag is then continuous and never decreases with Mach below the data (the property eq. 3.87 has by construction).
- **Why:** D-053 (owner's approval of TR R-100 as model data with two digitisations and a recorded uncertainty). The identity correction follows the report's own text and its panel (a), where the configuration leaders are unambiguous; recording both the misread keys and the correction keeps the provenance honest. Each convention is the thesis's own instruction where it gives one and the conservative choice (higher drag, continuity, explicit warnings) where it does not.
- **Consequences:** Every nose shape now has a pressure drag model across all Mach regimes, with the reading uncertainty in the warnings; R5's Von Kármán nose no longer stops the simulation (the fins still do until plan 0021). The ARCAS validation (plan 0021) tests the model, including these conventions, against held-out data. A later re-digitisation at higher resolution would replace the merged file and the arrays together; the formats test keeps them equal.

## D-056 (2026-10-12): The transonic fin normal force is the cubic Hermite interpolation between eq. (3.40) at Mach 0.8 and eq. (3.49) at Mach 1.2, chosen against the held-out ARCAS data

- **Decision:** `finSetTerm` interpolates (C_Nα)₁ across 0.8 < M < 1.2 with the cubic that matches the values and the slopes of the subsonic formula (3.40) at 0.8 and of the supersonic formula (3.49) at 1.2 (BAR-12, `DEFAULT_TRANSONIC_FIN_INTERPOLATION = 'cubic-hermite'`). Two other candidates remain selectable for the record (`transonicFinInterpolation`): a straight line between the end values, and the parabola matching the subsonic value and slope and the supersonic value. The comparison against the digitised x_cp of NASA TN D-4013 figure 11 (nine Mach numbers from 0.8 to 1.2, two-pass digitisation, uncertainty ±0.6 % of body length) gave root mean square errors of 5.03 % (cubic), 5.61 % (linear) and 5.69 % (quadratic) of body length, worst 7.3, 6.9 and 7.4 %; the full table is in `docs/reports/wind-tunnel-validation.md`.
- **Why:** D-053 ("implement each candidate, compare each against the held-out data, choose the most accurate"). The thesis requires an interpolation and gives none (p. 19); the candidates are the three simplest joins of the two formulas it does give. The cubic is also the only candidate with a continuous derivative at both ends, which keeps the pitch moment smooth through the band in a flight. The margin between the candidates (0.7 % of body length in rms) is close to the digitisation uncertainty, so the choice is recorded as the best of three rather than a validated law; the residual is systematic (the measured CP moves 16 % of body length aft between Mach 0.85 and 1.1, the model 6 %), which no interpolation of the two end formulas can reproduce.
- **Consequences:** Flights through the transonic band no longer stop at the fins (D-039 resolved); the supersonic roll damping (eq. 3.72) remains unimplemented, so a rolling rocket still stops at Mach 0.8 until plan 0022. The transonic warning stays on every result in the band. The ARCAS data remain held out; a re-digitisation or a new validation set would re-run the same comparison.

## D-057 (2026-10-12): Wind tunnel validation conventions and the reported errors

- **Decision:** The validation (`packages/formats/src/wind-tunnel.validation.test.ts`, `docs/reports/wind-tunnel-validation.md`) compares, by Mach regime (subsonic < 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 5, hypersonic above 5): the CP in percent body length against TN D-4013 and TN D-4014; the forebody axial force (our C_D0 without the base term) against TN D-4013's C_A,corr and TN D-4014's C_A − C_A,c, because the sting-mounted models' base is corrected to free-stream pressure; and the total C_D0 against the free-flight NACA RM A53D02 points at the Reynolds number of each round. The geometry is transcribed from the drawings with the choices listed in `reference/digitised/wind-tunnel-validation.json`; the sharp wedge fin sections of both models are not representable and the nearest sections are used (ARCAS 'rounded' as the thesis did; NACA both 'square' and 'rounded'). The test pins the observed errors as regression values, not as acceptance criteria.
- **Results:** CP subsonic within 3.5 % of body length, transonic rms 5.0 % (worst 7.3 %), supersonic conservative by 5 % at Mach 1.5 growing to 27 % at Mach 4.63. ARCAS forebody drag +14 to +19 % subsonic, rms 19 % transonic (rise too early, +40 % at Mach 0.9), over-predicted 1.1 to 2.1 times supersonic, driven by the rounded-leading-edge fin term. NACA total drag (thin sharp fins): supersonic rms 8.7 % (mean −0.1 %), transonic +25 to +45 %, subsonic +23 % (one point), hypersonic +20 %.
- **Why:** CLAUDE.md 6.7 item 1 and 7.4 ("do not tune constants to fit"); the sting correction is the reports' own definition of their coefficients; the fin-section choice follows the thesis's precedent and is reported both ways where it matters.
- **Consequences:** Limitation records for the supersonic CP, the fin sections and the transonic drag rise; the report proposes USAF DATCOM as an additional source for the supersonic body normal force and the sharp-section fin wave drag, for the owner's approval. Nothing was changed in the model as a result of the comparison.

## D-058 (2026-10-12): Supersonic roll damping from eq. (3.72) with the exact trapezoid strip integrals; linear in Mach across the transonic band

- **Decision:** `rollDampingMoment` uses Niskanen eq. (3.69) below Mach 0.8, eq. (3.72) from Mach 1.2 with the strip pressure coefficient (3.41) at the inclination (3.62), the strip sum integrated exactly for a trapezoid (I_n = ∫ c(y)(r_t + y)ⁿ dy by the binomial expansion; I₂ equals the thesis's closed form (3.70), tested), the sign following the roll rate; between 0.8 and 1.2 the moment is linear in Mach between the two formulas evaluated at the current roll rate, airspeed and dynamic pressure (AERO-6, AERO-7).
- **Why:** The thesis describes the supersonic form (p. 39) but gives neither its closed form nor a transonic form. The exact integration is mathematics applied to the stated sum, with the thesis's own (3.70) as the check. For the band no data exist to choose an interpolation (the ARCAS reports measure no roll damping), so the simplest continuous convention is used and recorded; the roll damping of an uncanted rocket only brings a small roll rate back to zero, so the choice cannot move a flight result noticeably (R5's roll rate stays at the numerical noise level).
- **Consequences:** No regime stops a flight any more. R5 flies through the band and matches OpenRocket within the Phase 2 tolerances (`docs/reports/phase-2-acceptance.md`, section 7). Roll forcing (canted fins) stays unimplemented.

## D-059 (2026-10-12): The large-angle fin force stays unimplemented (Hoerner is not in `reference/`); alternatives proposed; ballistic descents and golden series recorded

- **Decision:** D-053 approved Hoerner's flat-plate data as the source for the fin normal force beyond the small-angle law "if it is available in `reference/`". Neither _Fluid-Dynamic Drag_ (1965) nor _Fluid-Dynamic Lift_ (Hoerner and Borst, 1975) is there (the thesis cites only the first, for nose and fin drag), so nothing is implemented and the 90° model limit of D-046 stands. Alternatives, each needing the owner's approval as a source: (1) Hoerner, _Fluid-Dynamic Drag_, chapter III (drag of plates normal and inclined to the flow; the cross-flow form C_N = C_D,90 sin²α) and Hoerner and Borst, _Fluid-Dynamic Lift_, chapter on plates and low-aspect-ratio wings at high angles (the sin α cos α normal force with a stated C_D,90 of about 1.17 for a flat plate), both copyrighted and self-published; (2) Allen and Perkins, _A Study of Effects of Viscosity on Flow over Slender Inclined Bodies of Revolution_, NACA Report 1048 (1951), public domain on NTRS, the cross-flow method for bodies (not fins); (3) the _USAF Stability and Control DATCOM_ (public), sections 4.1.3.3 and 4.1.3.4 (wing normal force at high angles of attack) and 4.2.1.2 (body normal force with cross-flow drag), which cover both bodies and low-aspect-ratio surfaces across Mach regimes and are already proposed in `docs/reports/wind-tunnel-validation.md`. Recommendation: DATCOM, one source for both open items, validated afterwards against the held-out ARCAS data at the higher angles of attack the reports also measured (to 21°).
- **Ballistic descents (Prompt 5 Part B item 4):** every reference rocket without a recovery device was flown with and without wind (`simulate.ballistic.test.ts`). Without wind a rocket falls exactly tail-first from apogee and the six-degree-of-freedom run ends at the limit at the apogee itself (angle of attack 180°), the ascent intact. With 5 m/s of wind every rocket weathercocks at apogee, noses over inside the model's range and lands nose-first at its terminal speed (38.8, 64.1, 69.3, 82.0 and 99.2 m/s for R1 to R5), 42 to 148 m downwind, within 1 % of the three-degree-of-freedom fall. The three-degree-of-freedom cross-check always lands; its ground-hit speed never exceeds the terminal speed of the force balance m g = ½ ρ v² C_D0 A_ref and reaches it within 1.2 % on the long falls (R2, R3, R5) while the short falls (R1 from 169 m, R4 from 690 m) land still decelerating (8 and 10 % below terminal, 0.16 to 0.19 g). This is the physical behaviour expected; the one gap is the still-air tail-first fall, which needs the large-angle law above.
- **Golden flight series (CLAUDE.md 7.6):** `packages/formats/golden/flights/*.json` hold, for R1 to R5 with winds 0 and 5 m/s in the OpenRocket-equivalent modes at 0.002 s, the summary, the events and a sample every second with full double precision; `simulate.golden.test.ts` compares them exactly and regenerates them only with `UPDATE_GOLDEN=1`. Bit-exactness is per JavaScript engine (Math functions); a change flagged by a Node upgrade is to be examined and explained, not accepted silently.
- **Why:** CLAUDE.md rules 1 and 4 (no large-angle law without a source; ask when the approved one is missing); 7.6 (golden outputs); the owner's Part B items 4 and 5.
- **Consequences:** Ballistic and late-ejection flights in still air end at the turn-over with the apogee reported (D-046); in wind they are complete. Any physics change that moves a golden sample fails the test and must be explained in its commit message.

## D-060 (2026-10-12): WGS 84 gravity from NGA.STND.0036; OpenRocket's constant is the GRS 80 value

- **Decision:** With a launch latitude the gravity model is the WGS 84 ellipsoidal gravity formula (GRAV-2, Somigliana's closed form, NGA.STND.0036 eq. 4-1) with the height series of eq. (4-3) (GRAV-3), the altitude above mean sea level standing in for the geodetic height (the geoid undulation, under 100 m everywhere, changes the series by under 3·10⁻⁸). Without a latitude the standard 9.80665 m/s² with the inverse-square law stays (D-030). The document was obtained from NGA's own site (the DTIC copy of TR8350.2 was unreachable: DTIC "Under Maintenance"), so the pre-approved substitute (Moritz, GRS 80) was not needed.
- **The OpenRocket value:** at 45° the WGS 84 formula gives 9.806197769 m/s², not the 9.8061992025 m/s² OpenRocket used for the reference flights. The latter is exactly the GRS 80 closed formula (γ_e = 9.7803267715, k = 0.001931851353, e² = 0.00669438002290): 9.8061992025 to ten digits. The two systems differ in γ_e by 1.4 µm/s² (0.15 ppm). The OpenRocket-equivalent comparison mode keeps its observed constant (GRAV-C) and the comparisons are unchanged; the displayed mode uses WGS 84 when a latitude is entered.
- **Why:** Part A item 4 of the completion prompt; CLAUDE.md rule 1 (the document is in `reference/`, its pages cited). The series' validity is the document's own statement ("when the geodetic height is small"; the ellipsoidal method is recommended at moderate and high heights); the h² term keeps the error of order (h/a)³, under 3·10⁻⁸ at 20 km.
- **Consequences:** A 1.4 µm/s² difference cannot move any flight figure beyond the fourth decimal. Designs without a latitude are unchanged (the golden series stay bit-identical). The launch editor gains the latitude field behind a checkbox.

## D-061 (2026-10-12): Held-out validation set for version 1.0; the ARCAS CP data are no longer independent

- **Decision:** The transonic fin interpolation was chosen against the ARCAS CP data of TN D-4013 figure 11 (D-056), so those data (and TN D-4014 figure 7, the same model) are no longer independent of the model and no longer count towards the version 1.0 accuracy targets; they stay in `wind-tunnel-validation.json` and their report, labelled as such. The ARCAS axial-force data and the NACA RM A53D02 drag data were not used for any choice and remain held out. Six further NTRS datasets were added as the held-out set (plan 0024, `reference/digitised/held-out-v1.json`): NASA TN D-1958 (Blue Scout, CP, C_N_alpha and forebody C_A at Mach 0.6 to 1.03), NACA RM E50D28 (RM-10 with fins, CP and C_D at 1.49 to 1.98), NACA TN 2944 (RM-10 free-flight C_D at 0.9 to 2.49), NASA TN D-3182 (wedge-finned sounding rocket, CP, C_N_alpha and C_A at 1.79 to 3.47), NASA TM X-1661 (the ARCAS model at Mach 2.01) and NACA RM L8A05 (fin-stabilised parabolic body, free-flight C_D at 0.62 to 1.17). Each was digitised in two passes with the calibration and the disagreement recorded; the model geometries are transcribed in `held-out-models.ts` with every modelling choice recorded in the data file. The comparison (`held-out.validation.test.ts`, `docs/reports/held-out-validation.md`) reports CP in percent of body length (predicted minus measured; negative = conservative) and C_D relative errors by regime (subsonic < 0.8, transonic 0.8 to 1.2, supersonic 1.2 to 2.01, "outside" above), the drag-rise Mach by a point-based rule (a quarter of the rise to the transonic peak above the value at the start of the band) and the summary against the targets. Sting-mounted data are compared as the reports define them: the Blue Scout C_A is adjusted by the report to free-stream base pressure and is compared with the forebody drag; the RM-10 tunnel drag includes the base; TN D-3182's C_A is compared with the total because the extracted text does not state a base adjustment (the forebody value is shown beside it).
- **Why:** The completion prompt's definition of done requires accuracy on data never used to build, choose or tune anything, and at least three further datasets covering Mach 0.5 to 2.0 and dense in 0.8 to 1.2. The RM-10 series fills the supersonic interior (1.2 to 2.0) that the earlier set lacked; the Blue Scout and L8A05 give the subsonic and transonic ends. No further transonic CP dataset with a representable geometry was found (NASA TM 74058 has pivoted, raked fins), so the CP coverage between Mach 1.03 and 1.2 rests on the non-independent ARCAS data and is recorded as a limitation.
- **Baseline (before Part C):** CP subsonic rms 0.4 % L (n = 2), transonic 2.9 % (worst 4.5, conservative), supersonic 7.2 % (worst 10.6, conservative; RM-10 within 2.9 %, TN D-3182 and X-1661 8 to 11 % forward of measured, as for ARCAS); C_D over-predicted everywhere: subsonic rms 49 %, transonic 63 %, supersonic 31 %; the drag rise placed 0.12 to 0.14 Mach too early on the two dense free-flight sets. These are the gaps Part C works through in order.
- **Consequences:** The held-out set is frozen: any Part C change is judged against it after the fact, never fitted to it. The ARCAS CP rows no longer appear in the target table. The digitisation uncertainty is below every CP target and below the C_D targets except where noted in `docs/known-limitations.md`.

## D-062 (2026-10-12): The early transonic drag rise came from the fin leading-edge term on sharp sections; fin wave drag now from the DATCOM (4.1.5.1 B and C)

- **Decision:** (1) A sharp-nosed ('airfoil') fin section carries no leading-edge pressure drag: the DATCOM refers that drag to the leading-edge frontal area 2 r_LE b/cos Λ (figure 4.1.5.1-30, eq. 4.1.5.1-n), which is zero for a sharp edge; Niskanen's eq. (3.89), Hoerner's cylinder drag rising from Mach 0, stays for the 'rounded' section (r_LE = t/2, the same quantity on the same area N t s) and the stagnation term for 'square'. (2) Fins of 'airfoil' and 'rounded' section get the DATCOM wave drag (DRAG-18, DRAG-19, `datcom-fin-wave-drag.ts`): the transonic similarity chart of figure 4.1.5.1-29, digitised twice, used to Mach 1.2 with its ordinate held beyond ξ = 1.4 (as the DATCOM sample problem does at ξ = 1.45); the supersonic linear-theory formulas 4.1.5.1-k and -l from Mach 1.4 with K = 16/3 (biconvex, the section assumed for both; 'double-wedge' K is implemented for Part C item 4); a linear fairing in Mach between 1.2 and 1.4, the DATCOM's own "fairing due to possible mismatch between transonic and supersonic estimates" (sketch (a), p. 4.2.3.1-5). 'Square' fins (a blunt flat plate, no section in the K table) keep Niskanen's terms unchanged. (3) The swept-wing construction: the DATCOM gives the swept wing's drag-divergence Mach number and peak Mach number as the unswept ones divided by √cos Λ_c/4 (eqs. 4.1.5.1-d, -f) and the peak drag as the unswept peak times (cos Λ_c/4)^2.5 (eq. -e), then says to construct the swept curve "using the values determined in step 4 and the straight-wing curve to aid in fairing"; the construction used is the unswept curve stretched in Mach by 1/√cos Λ_c/4 and scaled by (cos Λ_c/4)^2.5, which honours the three equations exactly and needs no further judgement. (4) The fin aspect ratio for the chart is 2 s²/S_fin (the fin pair as a wing), the thickness ratio t/c the thickness over the mean aerodynamic chord, the wave drag referred to the planform area N S_fin (the DATCOM's S_w).
- **Why:** Plan 0025: the per-term breakdown of the held-out free-flight bodies showed the fin leading-edge term as the only one rising between Mach 0.6 and 0.9 (RM-10: 0.023 to 0.110 on A_ref while the measured drag stays at 0.17); the DATCOM is the approved source for transonic and supersonic fin aerodynamics (completion prompt Part A). Two digitisation passes of figure 4.1.5.1-29 agree within 0.09 to 0.40 in the ordinate (the steep rise), but the DATCOM's own sample-problem readings of the chart (p. 4.1.5.1-9) lie about 0.1 further along ξ than the printed curves in the rise (0.58 against 0.30 at ξ = −1.11 for A (t/c)^(1/3) = 1.568); the printed chart is the source and is used; the sample is kept as a bracketing check in the test. The discrepancy moves the predicted rise by about 0.03 Mach for t/c = 0.06.
- **Results (held-out, D-061):** the drag rise now sits at 0.952 against the measured 0.972 (RM-10 flight), 0.942 against 0.996 (L8A05, 0.055 outside the 0.05 target), 0.917 against 0.894 (Blue Scout); RM-10 tunnel drag rms 6.5 % (was 23.8 %), RM-10 flight 12.2 % (was 41.5 %) with the fairing to the two-dimensional formula overshooting by 14 % at Mach 1.4 to 1.5; L8A05 still +35 % and the Blue Scout ('square' fins, unchanged) +20 %: the remaining subsonic excess is in the base drag of boat-tailed bodies and the blunt-plate fin terms (Part C items 4 and 7). ARCAS ('rounded'): transonic drag rms 19.1 % (unchanged, the shape now right from Mach 0.95), supersonic 76 % (was 70 %: the two-dimensional formula adds to the leading-edge term). No reference rocket changed (all have square fins); the golden series are unchanged.
- **Consequences:** Every fin of airfoil or rounded section carries the wave drag term with the chart uncertainty in the warnings; the transonic warning text is updated in Part D. Part C item 4 revisits the section types (double wedge, blunt-plate leading edge from figure 4.1.5.1-30); item 7 the base drag.

## D-063 (2026-10-12): Fixed-step RK4 is checked every step against the linearised dynamics and stops with the safe step; it is an advanced setting; every event gets a sample

- **Decision:** (1) Before every fixed-step RK4 step the simulator evaluates the linearised roll, pitch and drag rates at the current state from the model's own laws (DYN-17), the largest step for which each eigenvalue lies inside the RK4 stability region (DYN-16, the stability polynomial of the thesis's RK4 equations) and applies a factor 0.9 for the change of the rates within the step; if the user's step exceeds that safe step the run stops with `IntegrationUnstableError`, which names the mode, the rate and the step to use (or the Dormand–Prince integrator). (2) The pitch oscillation's numerical amplitude loss per step, 1 − |R(i h ω_n)|, stops the run above 10 % and attaches a warning above 1 % (the loss is RK4's, not the rocket's; on the reference rockets a 1 % loss leaves apogee and velocities unchanged but distorts the oscillation history). (3) The app labels RK4 "fixed step (advanced)", keeps Dormand–Prince as the default and shows the stop message with the suggested step. (4) A sample is recorded at the liftoff event so that every event has a stored sample. The thresholds 0.9, 10 % and 1 % are numerical conventions of this project (like the step-size rule of D-037), not physics.
- **Why:** Plan 0026. The roll damping rate C_r/I_rot (AERO-5) reaches 330 s⁻¹ on R2 at maximum dynamic pressure, outside the RK4 real-axis limit 2.7853/h = 278 s⁻¹ at h = 0.01 s; the growth factor R(−3.3) = 2.1 per step matches the viewer session's divergence. The Phase 2 convergence check flew only R1 in still air and compared apogees, so the latent instability (excited only by wind, a rail angle or round-off) was invisible. The owner asked for a derived safe step with a cited method: the stability polynomial follows exactly from eqs. (4.20) to (4.21), and the rates from the model's force and moment laws, so no new source is needed.
- **Results:** `docs/reports/rk4-step-check.md`: on the five reference rockets, in the OpenRocket-equivalent still-air setting and in the displayed mode with wind on a 5° rail, every RK4 run at 0.02, 0.01, 0.005, 0.002 and 0.001 s either agrees with Dormand–Prince within 0.1 % (observed within 0.01 m and 0.03 m/s) or stops: R2 at 0.02 and 0.01 s (roll, safe 0.0075 s), R3 at 0.02 s (roll, safe 0.0136 s), R5 at 0.02 s (pitch accuracy, safe 0.015 s); R5 at 0.01 s carries the 1 % warning. No reference comparison changed; the golden series are unchanged (the liftoff sample at t = 0.002 s is not a whole-second sample).
- **Consequences:** An RK4 run that reaches the result is inside the linear stability region at every step; nonlinear effects (the quadratic pitch damping at large rates, the 90° model limit) remain covered by the model-limit stop and the non-finite checks. The check costs one extra derivative evaluation per RK4 step. The Dormand–Prince integrator is unaffected.

## D-064 (2026-10-12): The nose-cylinder body term above Mach 0.8 comes from the DATCOM charts, faired from Niskanen's slender-body term

- **Decision:** For the body formed by the nose cone and the contiguous same-radius tubes behind it, the normal-force derivative and centre of pressure above Mach 0.8 come from the DATCOM ogive-cylinder and cone-cylinder charts (BAR-13, BAR-14; figures 4.2.1.1-21a/b and 4.2.2.1-23a/b, digitised twice): Niskanen's Mach-independent term (BAR-2, BAR-3) applies to Mach 0.8, the chart from its first point at β/f_N = 0.4, and a linear fairing in Mach between them realises the DATCOM's "faired out smoothly in the transonic range" where the charts give nothing. Nose shapes map to the charts as the DATCOM says (parabolic as ogive; 3/4-power as cone with the centre of pressure 5 % of body length forward); elliptical and Haack noses, which the DATCOM does not cover, use the ogive charts with a warning. Transitions, flares and boattails keep Niskanen's terms. Every validity statement of the DATCOM (Mach, f_N, f_A/f_N ranges, chart ends) is a warning on the result, with the reading uncertainty.
- **Why:** Completion prompt Part C item 2. The DATCOM charts are the approved source's empirical supersonic body data; the fairing is its own instruction. The DATCOM sample problem (p. 4.2.1.1-5, cone-cylinder read as 3.52 per rad by extrapolation) is reproduced within 0.15 per rad from the digitised table.
- **Results:** Held-out (D-061): the supersonic body force sits forward of the fins, so the predicted CP moves forward where the measured CP lies aft: TN D-3182 −15.0 % L rms (was −11.4), TM X-1661 −14.2 (was −10.6), RM-10 1.5 (was 1.8); the Blue Scout transonic rms grows from 2.5 to 4.7 % L through the fairing (worst 8.0 at Mach 1.0). ARCAS (D-056 data): supersonic rms 17.0 (was 18.2), worst 19.8 (was 26.6). The step is sourced and kept; the remaining and now larger gap is the fins' supersonic force and the lift carried over onto the body, Part C item 3, after which the combination is judged on the ARCAS data (already non-independent) with the six held-out sets untouched.
- **Consequences:** R5 (Von Kármán nose, Mach 1.09) carries the fairing warning and the "nearest shape" warning; its golden series change by 0.0007 m in apogee with wind (none in still air). All five reference rockets stay within the Phase 2 tolerances.

## D-065 (2026-10-12): Supersonic fin normal force, body carry-over and its position from the DATCOM; Niskanen's fin term kept as an option

- **Decision:** The default supersonic fin method is the DATCOM's (BAR-15 to BAR-17, plan 0028): figure 4.1.3.2-56 for the fin pair as a wing, with the sonic-leading-edge thickness correction of figure 4.1.3.2-60; the body carry-over K_B(W) from slender-body theory or figures 4.3.1.2-11a/b; its a.c. from figures 4.3.2.2-36b or -37. The DATCOM charts start at Mach 1.4 (their step 1), so BAR-12 fairs from Niskanen at Mach 0.8 to the DATCOM value at 1.4. Niskanen's eq. (3.49) remains selectable (`supersonicFinMethod: 'niskanen'`) and is used, with a warning, wherever a planform falls outside the digitised charts.
- **Conservative choices where the source leaves a choice:** figure 11a only when the body behind the fin root trailing edge is at least β d long (the carry-over region of sketch (e), p. 4.3.1.2-5, ends one Mach-line crossing of the body behind the root); otherwise 11b, which gives the smaller carry-over. Figure 4.3.2.2-37: the most forward curve of each panel for every sweep (differences at most 0.07 c_r). Outside the digitised range of figure 11 the carry-over is left out (warning); beyond β d/c_r = 2.8 on figure 37 the 2.8 value is used (a forward bound, warning). Fins with the 'airfoil' cross-section are taken as circular-arc sections for the thickness correction (tan(δ⊥/2) = t/(c̄ cos Λ_LE)); blunt ('square', 'rounded') leading edges are outside figure 4.1.3.2-60, get no correction and carry a warning near the sonic leading edge, because their fin force may be overstated.
- **Why:** Completion prompt Part C item 3. On the held-out sets the DATCOM method meets the transonic and supersonic CP targets (transonic rms 4.1 % L, worst 6.1; supersonic rms 3.7, worst 5.1) where Niskanen's did not (5.4 and 9.9 rms); on ARCAS the supersonic rms falls from 17.0 to 2.0 % L. The cause of the old forward CP was the fins: Niskanen's eq. (3.48) takes one surface's Busemann pressure (half the linear-theory slope in the two-dimensional limit) and no carry-over onto the body.
- **Consequences:** The only error outside its rms target that is non-conservative is none: RM-10's +3.6 % L is inside the 4 % supersonic target. Total C_Nα is now over-predicted on ARCAS (up to +39 %) and under-predicted on TN D-3182 (about −18 %); it is not a v1.0 target and is recorded in the limitations. The reference rockets' OpenRocket comparisons are unchanged; R5's golden series changed by 0.004 m in apogee with wind. Flights above Mach 2 now carry an "outside the validated range" warning.

## D-066 (2026-10-12): Wedge and double-wedge fin sections; the rounded leading edge from the DATCOM correlation

- **Decision:** Two fin sections are added: 'wedge' (sharp leading edge, blunt trailing edge of the full thickness) and 'double-wedge' (sharp edges, ridge at mid-chord). Neither carries a leading-edge pressure term (the DATCOM refers that drag to the leading-edge radius, zero for a sharp edge, D-062); the wedge keeps the square trailing-edge base term; the supersonic wave drag uses K = 4 (double wedge, DATCOM table) and K = 1 for the single wedge, the forward-face term of the table's double-wedge expression c/x_t + c/(c − x_t) at x_t = c, whose rear faces become the blunt base. The transonic chart, drawn for the biconvex family, is taken in the ratio K/(16/3) so that it meets the supersonic formula. The 'rounded' leading edge uses the DATCOM correlation of figure 4.1.5.1-30 (DRAG-20) instead of the thesis's eq. (3.89) × cos²Γ; the two agree within 0.02 on the unswept edge from Mach 0.5 to 2, and the DATCOM states its range (Mach 0.5 to 8, sweep to 75°, warned outside). 'Square' keeps Niskanen's stagnation term: the DATCOM has no flat-faced-edge method. The validation models take the section their drawings show: Blue Scout and TN D-3182 'wedge', ARCAS 'double-wedge', RM A53D02 'wedge' (reported beside 'square').
- **Why:** Completion prompt Part C item 4. The held-out drag excess of the wedge-finned models was the blunt-plate leading-edge term charged on sharp edges (Blue Scout +43 % at Mach 0.6, TN D-3182 +53 %).
- **Alternatives considered:** the transonic chart unscaled for the wedges (the held-out Blue Scout forebody comes 4 % closer, but the chart would then not meet the supersonic formula at the fairing; rejected on consistency, not on the data).
- **Results:** plan 0029. Held-out C_D rms: subsonic 34.7 %, transonic 36.8 %, supersonic 14.6 % (from 38.3, 36.8, 19.0); CP unchanged within 0.3 % L. All sharp-wedge models are now 17 % to 28 % low in supersonic drag; the circular-arc RM-10 stays within 5 %. Reference rockets and golden series unchanged.

## D-067 (2026-10-12): Minimum in-flight stability margin over powered flight and coast

- **Decision:** The simulator reports the smallest stability margin of powered flight (rail exit to burnout) and of coast (burnout to apogee), each with its time, Mach number and angle of attack, using the CP at the actual Mach number and angle of attack and the CG at that moment, taken at every accepted step. A margin below the threshold (default 1.0 caliber; the app passes the design's "unstable below" value) adds a warning. The near-apogee part of coast is included, as the prompt asks for coast; the report notes that the angle of attack grows there as the dynamic pressure falls.
- **Why:** Completion prompt Part C item 5. The static liftoff and burnout margins at Mach 0.3 and zero angle of attack do not show the effect of Mach number on the fins and body (BAR-10 to BAR-17) or of body lift at angle of attack.
- **Results:** `docs/reports/in-flight-stability.md`: with a 2 m/s wind on a 5° rail the lowest margins are R1 1.71 (powered) and 1.87 (coast) calibers, R2 1.17 and 1.18, R3 2.86 and 1.85, R4 2.24 and 2.59, R5 2.01 and 1.10. The powered minima are just off the rail (3° to 7° angle of attack at low speed), the coast minima near apogee (13° to 20°).
- **Consequences:** The summary gains `minimumStability`; samples are unchanged; the golden series are unchanged (the field is not part of them).

## D-068 (2026-10-12): Fin flutter speed from NACA TN 4197 eq. (16) along the flight; material moduli from its figure 3 only

- **Decision:** The flutter speed is TN 4197's eq. (16) with eq. (17) (FLUT-2), evaluated at every accepted step of powered flight and coast with the local pressure and speed of sound; the summary gives the lowest V_f/V per fin set and a ratio below 1 is a warning. A is the exposed panel's L/c₀.₅₀ and t/c is taken on the mid-span chord c₀.₅₀ (the report assumes constant t/c; a constant-thickness fin has its largest chord at the root, so the mid-span value sits between root and tip). Material shear moduli are those marked on TN 4197 figure 3: magnesium, aluminium, titanium as marked; wood and steel at the lower end of their ranges (lower G, lower V_f). Fibreglass, carbon fibre and balsa have no value in an approved source: the user enters G_E, and a fin set without one is reported as not checked.
- **Why:** Completion prompt Part C item 6 ("material shear moduli (sourced)").
- **Open question for the owner:** a sourced shear modulus for fibreglass (G10/FR-4) and carbon laminates would let R3, R5 and most high-power designs be checked by default (they need 0.18 and 0.42 GPa respectively).
- **Results:** R1 V_f/V 3.41, R2 1.10, R4 2.37 (plywood as wood); R3 and R5 not evaluated.

## D-069 (2026-10-12): Body base drag from the DATCOM (eq. 4.2.3.1-b and figure 4.2.3.1-24) by default; Niskanen's in the OpenRocket-equivalent mode

- **Decision:** The default base drag is the DATCOM's (DRAG-21, DRAG-22) to Mach 1.295, faired to Niskanen's eq. (3.94) at Mach 1.5 and eq. (3.94) above. Niskanen's eq. (3.94) remains selectable (`baseDragMethod: 'niskanen'`) and is what the OpenRocket-equivalent mode uses, as OpenRocket does.
- **Why:** Completion prompt Part C item 7. The subsonic over-prediction was the base term: eq. (3.94) charges a blunt cylinder's base pressure on every base. On the held-out data the DATCOM method brings subsonic C_D from 34.7 % to 7.1 % rms (target 7 %) and transonic from 36.8 % to 21.3 %; the free-flight NACA RM A53D02 (cylindrical base) improves from +23/+35 % to −4/+6 %.
- **Conflict recorded for the owner (CLAUDE.md 11 (a)):** the Blue Scout's directly measured base axial force (sting-mounted, wedge fins with blunt bases at the base) agrees with eq. (3.94) (+9 %) and not with the DATCOM (−58 %). The DATCOM states that fins and stings change the base pressure and gives no correction. The free-flight evidence was taken as deciding; if the owner prefers eq. (3.94) for cylindrical bases, it is one option away.
- **Consequences:** displayed-mode apogees rise by up to 4.6 % on the reference rockets (R5), within the Phase 2 tolerance against OpenRocket; the OpenRocket-equivalent comparisons and the golden series (which use that mode) are unchanged. The supersonic base charts of the DATCOM are future work.

## D-070 (2026-10-12): Fin and body normal force from 0 to 180° from the DATCOM in the displayed mode; the 90° limit stays in the OpenRocket-equivalent mode

- **Decision:** The displayed mode (`largeAngleMethod: 'datcom'`, the default) uses the large-angle model of plan 0033 (HA-1 to HA-10):
  - **Bodies:** Jorgensen's method from DATCOM 4.2.1.2 Method 3 and 4.2.2.2 Method 2.
  - **Fins:** the subsonic wing normal force from DATCOM 4.1.3.3, with maximum lift from 4.1.3.4 Method 3 and the centre of pressure from 4.1.4.3 Method 1.
  - **Combination:** fins and body combine by eq. 4.3.1.3-a without the body-vortex term.
  - **Reverse flow:** 90 to 180° uses α′ = 180° − α on the reversed wing.

  The OpenRocket-equivalent mode (`'linear'`) keeps the small-angle model and the 90° limit of D-046, so the OpenRocket comparisons and the golden series are unchanged. In the displayed mode a flight is continued past 90° below Mach 1. At Mach 1 and above the 90° limit remains, because the DATCOM's supersonic high-angle charts (4.1.3.3 C) are not implemented. (Superseded by D-103: above Mach 1 the flight continues too, with a listed approximation.)

- **Choices inside the method** (plan 0033 gives the reasons):
  1. **Body potential term.** Below 90° each nose and transition keeps its validated zero-angle slope times sin 2α cos(α/2)/2. The DATCOM says "the lift-curve slope at zero angle of attack is used for the potential-flow term", and the per-component slopes sum to Jorgensen's 2S_b/S at CP ℓ_B − V_B/S_b. Beyond 90°, eq. 4.2.1.2-c and eq. 4.2.2.2-c are used as printed.
  2. **Viscous term.** η c_dc replaces Niskanen's K = 1.1 on the same planform areas and centroids.
  3. **Interference.** The fin set's linear slope (interference, roll, carry-over) multiplies the DATCOM wing's normal-force shape.
  4. **Δy.** Computed from the section shape by the DATCOM's own definition (p. 4.1.3.2-19). The position of maximum thickness selects figure 23a or 23b. Single wedges (maximum thickness at the trailing edge) are not covered: such a rocket keeps the small-angle model and the 90° limit, with a warning naming the reason. (Superseded by D-102: a single wedge reads the 23b family, listed as an approximation.)
  5. **Fin charts above Mach 0.6.** From Mach 0.6 to 1 the fin charts are read at Mach 0.6 with the actual C_Nα. This is the DATCOM's transonic guidance (4.1.3.3 B), and a warning is given beyond the stall.
  6. **Values below the drawn range.** ΔC_Naa and the figure 23(a)/24b increments below tan α/tan α_CLmax = 0.2 are held at the 0.2 curve. They multiply sin²α or sin α there.
  7. **Step 5 of 4.1.4.3.** Read as linear in α.
  8. **Reverse flow.** The reversed wing's leading edge is the old trailing edge. A forward-swept reversed edge is evaluated as unswept, with a warning. The carry-over CP is mirrored along the root chord.
  9. **Figures 23a, 23b, 22a and 25b.** Each label set applies where its curves are drawn. Where a curve is not drawn, the nearest drawn curve is used and a warning is given when it matters (beyond the stall). In figure 23(a) the near-vertical rises through stability index 0 are hidden under the gridline and are interpolated linearly. Δ₃ for a stability index within ±0.3 of 0 is therefore uncertain by up to about ±0.2 root chords. None of the reference rockets is in that band.
- **Conservative in-flight margin:** the reported in-flight stability margin (plan 0030) uses the more forward of the two models' CPs at each sample, and covers nose-forward flight only (α ≤ 90°). The reason is the following comparison.
  - **Measured:** NASA TN D-1958 figure 7 shows Blue Scout's CP moving forward by about 0.13 body lengths between 0 and 6° at Mach 0.6. _Corrected by D-109: those values are figure 7(a), configurations B and C with the fins off; the fins-on configuration D (figure 7(b), PDF page 29) moves forward by only about 0.03 (0.805, 0.80, 0.79, 0.77 at 0, 2, 4, 6°)._
  - **Small-angle model:** 0.062 body lengths. Its body lift is K sin²α with K = 1.1.
  - **DATCOM model:** 0.054 body lengths, evaluated with the fins as square-edged for this comparison only.
  - **Consequence:** both models under-predict the forward shift (_reversed by D-109: both over-predict it, which is conservative, and the DATCOM model is the closer; the choice below stays on the safe side_), and the DATCOM's smaller cross-flow factor (η c_dc ≈ 0.84 against 1.1) and its low-aspect-ratio fin lift make it the less conservative of the two at moderate angles. The dynamics use the DATCOM model, the approved large-angle source (D-053), and the reported margin uses whichever CP is more forward.
  - **Effect on the reference rockets:** the powered-flight minima are identical to item 5's. The coast minima are 0.05 to 0.36 calibers higher than before, because the trajectory near apogee differs (smaller angles of attack).
- **Why:** completion prompt Part C item 8; D-053 named the DATCOM as the source. The 90° limit was the last place where a flight ended because of a missing model rather than physics.
- **Validation:**
  - **DATCOM sample problems:** the wing normal-force table (pp. 4.1.3.3-16 to -18) is reproduced within 0.045 at every angle, and the maximum lift (p. 4.1.3.4-9) within 0.02 in C_Lmax and 0.5° in α_CLmax.
  - **Unchanged static results:** the held-out and wind-tunnel CP and C_Nα are static (α → 0) and do not change.
  - **Reference rockets (displayed mode):** within the Phase 2 tolerances against OpenRocket. Apogee is −3.6 to +3.5 %; D-070 alone moves the in-wind apogees by at most 0.8 %.
  - **Ballistic flip test (item 9):** with a 0.1° launch tilt every reference rocket turns nose-down 2.5 to 4.4 s after apogee and lands nose-first. Exactly vertical, R1 keeps the tail-first equilibrium to the ground, and R2 to R5 leave it from round-off. Tail-first is an unstable equilibrium: the CP stays aft of the CG in reverse flow.
- **Open for the owner (CLAUDE.md 11 (a)):**
  - **Which model to trust at moderate angles.** The two approved models differ in the in-flight CP at 10 to 20° by up to 0.8 calibers (R2). Measured data at angle (Blue Scout, ±6° only) favour neither fully. The conservative reporting above is the interim choice.
  - **Wind-tunnel data at higher angles.** The ARCAS reports (TN D-4013) go to 21° and could be digitised for a direct check.
- **Consequences:**
  - Ballistic and late-ejection flights in still air now run to the ground in the displayed mode. Warnings explain the unverified range above 60° and any chart limits that were reached.
  - Flights that tumbled above Mach 1 ended at 90° with an explanation until D-103; single-wedge and high-aspect-ratio fins did until D-102.
  - The body-vortex term of 4.3.1.3, the supersonic high-angle charts and Jorgensen's axial force (4.2.3.2, in place of the mirrored axial-drag scaling of D-033) are future work.

## D-071 (2026-10-12): The 3D viewer draws the simulator's stored output in the flight frame itself; its few drawing conventions, recorded here

- **Decision:** `packages/viewer` (plan 0034) computes no physics. The three.js scene is the flight frame of docs/conventions.md (x east, y north, z up, metres, camera up +z): no stored value is permuted or scaled, the stored body-to-world quaternion is the rocket object's rotation, and the stored position (the CG, which the simulator integrates) carries the model by the stored CG offset. Every number on screen is the stored value of the step nearest to the replay time, labelled with that step's time; the pose is blended between the two neighbouring stored steps for the drawing only. The conventions that are drawing choices, not physics: (1) an event's marker is the stored step within 1e-9 s of the event time (the simulator records a sample at every event except liftoff, and the timed events' samples carry the integrated time, which drifts from the scheduled time by the float64 time sum, about 1e-12 s); an event without such a step (liftoff, detected inside a rail step) is drawn at the nearest step and labelled "nearest step"; (2) launch lugs and rail buttons, which have no angular position in the design, are drawn at +z (90° from fin 1); internal components are not drawn; (3) the grid spacing is 1, 2 or 5 × 10ⁿ m over the horizontal travel (at least 10 m) or a quarter of the apogee; (4) the Monte Carlo view draws the stored landing points and the stored 95 % containment circle (D-051) and, in addition, the principal-axes standard-deviation ellipse of the stored points (sample covariance, 1σ and 2σ), labelled as descriptive and computed by the viewer with no distribution assumed; (5) a Monte Carlo run is replayed by re-running the simulator on the identical perturbed design (`perturbDesign` then `simulateFlight`, the two calls `flyRun` makes), because `DispersionRun` stores no time series; (6) the ground wind drawn is the design's input (the result stores no wind).
- **Why:** The owner's requirement that the viewer be a visualisation and not a second model; CLAUDE.md section 5 (SI inside, conversion at the display boundary through the app's formatter) and section 1 rule 3 (no silent fallback: the inexact event step is flagged on the marker and in the event list; NaN values of the descent are shown as "not available in this phase", never as a number).
- **Consequences:** Three requests for later are recorded in plan 0034 (a wind record and an optional time series in the results, and an ellipse in the dispersion summary), none of which changes a result. Found while testing: RK4 at a 0.01 s fixed step is unstable for R2 (the flight blows up into a `NonFiniteResultError` in the pitch damping moment or ends early at the model limit) while 0.002 s and the adaptive Dormand–Prince integrator fly it normally; the app's default is Dormand–Prince, so users are not affected unless they pick RK4 with a coarse step. Reported in docs/progress.md as an open question for the physics owner; nothing in `packages/physics` was changed.

## D-072 (2026-10-12): Every Monte Carlo result carries the build that produced it; a replayed run is checked against it and against its stored landing point

- **Decision:** The app stamps every Monte Carlo result with its build provenance: the app version (`packages/app/package.json`) and a SHA-256 over the non-test sources of `packages/physics/src` and `packages/formats/src` (path and content in sorted order; formats is included because the design-to-physics adapter and the perturbation live there). The Vite and Vitest configurations compute it in Node at build time and inject it as `__LOFI_BUILD__`; the runner attaches it to each dispersion outcome, the panel shows it ("Produced by"). When a run is replayed (the simulator re-run on the identical perturbed design, D-071), the viewer compares (1) the stored provenance with the running build, and (2) the replayed landing point with the stored one, exactly, taking the replayed point from the summary by the same expressions `flyRun` uses (east = d sin ψ, north = d cos ψ), so a faithful replay is bit-identical and no tolerance is needed. Either difference, or landed against not landed, shows a warning that the replay may not match the original result, naming each reason with both builds or both points; the batch's figures stay the stored ones. A faithful replay shows a one-line note that it matched exactly. A failed replay of a batch from another build says so in its error.
- **Why:** The owner's request before merging plan 0034, and CLAUDE.md section 1 rule 3 (never silently fall back): a replay under a different physics is a different model, and the user must be told. Exact comparison because the simulator is deterministic (CLAUDE.md section 5); any tolerance would hide a real change. Bit-exactness also depends on the JavaScript engine (D-059), which the landing comparison catches even when the provenance agrees.
- **Consequences:** Monte Carlo results are held in memory only today; nothing saves or exports them. When a save path is added, the provenance must be saved with the result so that the check applies to saved results too. The hash changes with any edit to a physics or formats source file, including comments, so a warning may appear for a change that cannot move a result; this errs on the side of telling the user.

## D-073 (2026-10-12): Component mass and CG overrides, as OpenRocket applies them; overrides that cover subcomponents are rejected

- **Decision:** A placed component may carry `massOverride: { mass?, cg? }` (physics `PlacedComponent`, design file `components[i].massOverride`, `.ork` `<overridemass>` and `<overridecg>`). The mass is the component's total over all its instances (every fin of a fin set, every rail button). The CG is measured along x from the component's forward end (`position`). A mass override replaces the computed mass and scales the component's own moments of inertia by the same ratio; a CG override moves the component's CG and keeps its own moments of inertia about the CG; the rocket inertia then follows from GEO-12's parallel axis sum. A mass of 0 kg is allowed (the component then adds nothing); negative or non-finite values are rejected. An `.ork` override with `<overridesubcomponentsmass>`, `<overridesubcomponentscg>` or `<overridesubcomponents>` true on a component that has subcomponents is rejected with a message; `<overridecd>` is rejected.
- **Why:** CLAUDE.md 6.1 requires "mass (from material density or user-entered override)" (review finding G-8), and the owner's `.ork` file (a Wildman Blackhawk 29) was rejected for a nose cone `<overridemass>`. There is no literature source for an override; it is a definition, and the definition chosen is OpenRocket's, observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/OverrideProbe.java`. Its output, `reference/rockets/override-probe/values.txt`, shows for a nose cone override (cases 1 to 3): the whole-structure mass, CG and both inertias agree with this rule to about 1e-9 (the printed precision). Cases 4 and 10 show that a body tube, fin set or rail button override is the total for the component. With the subcomponents flag set, OpenRocket's structure mass leaves the children out but its inertias still include them unscaled (cases 5, 7, 8), which is not a consistent rigid body; reproducing it would copy an inconsistency, and inventing a different rule would not match the file's author's expectation, so the case is refused by name.
- **Alternatives:** Keep rejecting every override (rejected: CLAUDE.md 6.1 and the owner's file); keep the inertia unchanged under a mass override (rejected: a heavier part of the same shape has proportionally more inertia, and OpenRocket scales it too); scale the subcomponents to the overridden total (rejected for now: no reference behaviour to check it against).
- **Consequences:** `.ork` files with plain mass or CG overrides import. The app's component editor has no override fields yet (ui lane issue); a design file with an override keeps it, and every mass, CG, stability and flight figure uses it. Files that override subcomponents together still fail with a message telling the user to override each component instead.

## D-074 (2026-10-12): Components must fit together before a CP, mass or flight is computed (review finding B-1)

- **Decision:** `validateComponentFit` (physics `geometry/fit.ts`) runs at the start of `centreOfPressure` and `simulateFlight`. It rejects, with `InvalidInputError` naming the parts: an external body (nose cones, body tubes, transitions) that does not start at x = 0; a nose cone that is not the first body part; a gap or overlap between consecutive body parts; a step in radius between them (the message says to add a transition); a fin set whose root leading edge is off the body; a rail button off the body; and a fin set or rail button `bodyRadius` outside the body radii under the root chord (or at the button). Lengths are compared within 1 µm. A fin root chord may cross a joint between body parts and may run past the base. A component list with no body part (a fin set studied alone) is not checked.
- **Why:** Niskanen eq. (3.29) p. 25 sums the body terms of eqs. (3.19) to (3.22), which assume one continuous body, and eq. (3.56) p. 34 uses r_t, "the body radius at the fin position". Nothing in the formulas enforces either, and the review showed a 12.5 mm nose on a 25 mm tube moving the CP 0.79 calibers aft (the unsafe direction), a fin `bodyRadius` left at 1 m moving it 0.36 calibers aft, and fins placed 5 m behind or 1 m ahead of the rocket accepted. CLAUDE.md rule 3: report, never compute silently. Rejecting is chosen over deriving r_t from the body because the field is the user's input and a mismatch means the design is not what the user thinks it is.
- **Alternatives:** Require the whole root chord on one body tube (rejected: the ARCAS model of TN D-4013/D-4014 has fins across the cylinder-to-boattail joint and the NACA RM-10 model has fins on a boattail that run past the base; both are validation cases); model a radius step as a shoulder or a step term (rejected: no approved source gives one; a transition is the sourced way to join two radii); derive `bodyRadius` silently (rejected: rule 3).
- **Consequences:** The app shows these messages where it shows other design errors. When the user edits a body tube radius, the fins keep their old `bodyRadius` until the app updates them (ui lane issue #11); until then the design reports the mismatch instead of a wrong CP. The radius bound under a fin uses the end radii of each body part under the chord (every profile of Appendix A is monotonic between its ends), so a fin `bodyRadius` anywhere within a boat tail's range is accepted.

## D-3D-1 (2026-10-13): The replay's scenery and effects are illustrative; the ground is drawn at the rocket's tail at rest and kept flat over the flight

- **Decision:** Plan 3d-0001. The viewer draws a sky, procedural terrain with trees, a launch pad, an exhaust flame, a smoke trail, parachute canopies, the ground track and a drop line. None of them is a flight value and none feeds one; the stored output is drawn exactly as in D-071. The drawing conventions: (1) the stored z = 0 is the CG at rest, so the ground is drawn at the rocket's lowest point at rest less 2 % of its length (before, half the rocket stood below the ground); stored positions, markers and readouts are unchanged; (2) the procedural terrain is exactly flat (height 0 above the drawn ground) within max(250 m, 1.4 × horizontal travel + 30 m, apogee / 2) of the pad, because the simulator assumes flat ground, and hills rise only outside it; it is generated from a fixed seed, so it is deterministic; (3) the flame shows while the stored thrust, blended between the neighbouring stored steps, is above zero, its length growing with √(thrust / max thrust); (4) smoke is emitted from the tail of the drawn pose at times of positive blended thrust and drifts with the design's ground wind input (the result stores no wind; a wind profile's lowest layer is used, as for the wind arrow); (5) a canopy is drawn for each stored deployment event whose detail names a recovery device of the design ("<name> deployed"), with that device's diameter as the rim diameter, above the rocket against the air-relative velocity (blended stored velocity minus the ground wind input), inflating over 0.6 s; a deployment of an unknown device is not drawn, since its size is not known; (6) the rail is drawn as a bar beside the body on the side of the rail buttons (body +z, D-071 (2)); (7) event markers keep about 9 pixels on screen; (8) on a software renderer or when frames average slower than 70 ms, the viewer drops to a low-detail mode (lower resolution, no shadows, a quarter of the trees, no close-up inset). The note under the canvas says that the scenery, smoke, flame and canopy shapes are illustrative and that the simulation assumes flat ground at the pad.
- **Why:** The owner asked for a far more realistic replay (a terrain view with the trajectory, the smoke drifting with the wind, the ground track, a snapshot of altitude and distance, a close-up of the rocket). CLAUDE.md section 1 rule 8 (be honest about limitations) is why the illustrative parts are labelled and why the procedural terrain never rises under the flight.
- **Consequences:** Any later effect must be a function of the replay time and stored values only, so that a seek draws what playing draws; `packages/viewer/src/scene/effects.ts` is written that way and tested.

## D-3D-2 (2026-10-13): Real-world scenery from free, keyless map tiles, chosen by the user and drawn relative to the pad, with the terrain's departure from flat ground reported

- **Decision:** The user may place the launch site on a map (click, place search, browser location or typed coordinates). The site is for the scenery only and changes no simulation input; it is remembered in the browser (`localStorage`, key `lofi-viewer-site-v1`). No request is made until the user opens the site picker; the tiles are kept in Cache Storage (`lofi-map-tiles-v1`) for offline use. Sources, all free with no key and sending CORS headers: imagery from Esri World Imagery (default), EOX Sentinel-2 cloudless 2016 (CC BY 4.0) or OpenStreetMap; elevation from AWS Terrain Tiles (Terrarium encoding, metres = R·256 + G + B/256 − 32768); place search from OpenStreetMap Nominatim, one request per search the user makes. Each source's attribution is shown on the map and on the 3D view. The terrain is a grid over a square of half-size max(8 km, 4 × the flat radius) up to 40 km, finest at the pad (u ↦ sign(u)|u|^1.7), drawn at z = drawn ground + (elevation − elevation at the pad); a sharper imagery mosaic covers max(400 m, 1.6 × the flat radius). The local projection uses the Mercator scale at the pad's latitude (relative error about d·tan φ / R, 0.016 % at 10 km and 45°). The app reports the terrain elevation at the pad next to the design's pad altitude (and suggests setting the pad altitude when they differ by more than 50 m) and, when the terrain under the stored positions departs from the pad's height by more than 2 m, warns that the simulation assumes flat ground so the landing point and time do not account for it. A tile that cannot be loaded fails the load with a message naming the source; the illustrative scenery stays and the message is shown.
- **Why:** The owner asked for map integration at no cost and for the scenery to be as real as possible. The real terrain is drawn as it is, not flattened, because flattening would misrepresent the site; the honest course is to report the difference from the simulator's flat ground (CLAUDE.md section 1 rules 3 and 8).
- **Consequences:** These are third-party services under their own terms; if a provider changes its terms or access, its entry in `IMAGERY_SOURCES` (`packages/viewer/src/map/tiles.ts`) is the one place to change. A terrain-following ground in the simulator itself would be a physics change for the physics lane, not something the viewer may do.

## D-075 (2026-10-13): A recovery device that would open while the motor burns is refused

- **Decision:** `simulateFlight` refuses, with `InvalidInputError` and a plain message, any recovery device set to open at launch with a delay shorter than the motor's burn time. "At launch" with a delay at or after burnout, a timer deployment, is flown as before. After every flight, a rocket that never left the rail is reported in a warning.
- **Why:** Issue #32. The descent model (DYN-14, Niskanen §4.2.5 pp. 67 to 68) has the canopy drag and gravity only. A device opening at t = 0 switched the flight to that model on the pad: the thrust was dropped, the rocket never left the rail, the run went to the time limit, and the summary showed NaN. Flight with a canopy open under thrust needs the thrust, the rocket's own aerodynamics and the canopy drag together, and no approved source treats it. CLAUDE.md rule 3: report it, never produce a result that looks valid.
- **Alternatives:** Keep thrust in the descent model (rejected: an unsourced combination of models, and the attitude under thrust with an open canopy is not modelled); defer the deployment to burnout (rejected: a silent change of the user's input).
- **Consequences:** OpenRocket designs that use "launch" with no delay import, but cannot be simulated until the device is changed; the message says how. Nothing else changes: the five reference rockets deploy at apogee.

## D-076 (2026-10-13): Components inside a nose cone are read and positioned as OpenRocket does; parts that need a body radius are refused there

- **Decision:** The `.ork` reader reads mass components, parachutes, bulkheads and centering rings inside a nose cone. Their axial methods are resolved against the nose cone's own length, the aft shoulder excluded, with the same rules as inside a body tube. Fin sets, launch lugs, rail buttons and inner tubes inside a nose cone are refused by name.
- **Why:** The owner's Blackhawk 29 `.ork` was rejected for `<subcomponents>` in its nose cone. Where OpenRocket places such parts is a definition, not physics, so it was observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/NoseChildProbe.java`: nine files (four axial methods, with and without a 40 mm shoulder, and one with a parachute and a bulkhead) saved and reloaded by OpenRocket 24.12, output in `reference/rockets/nose-child-probe/values.txt`. "Bottom" is the cone's aft end in every case; positions agree exactly, and the structure mass and CG to 5e-6 (OpenRocket integrates the ogive shell numerically). Fins, lugs, rail buttons and inner tubes use the parent's radius, which varies along a nose cone, so reading them with the base radius would give a wrong geometry without saying so (CLAUDE.md 1 rule 3).
- **Alternatives:** Accept every child type with the base radius (rejected: silently wrong for the radius-dependent parts); keep refusing all nose children (rejected: common in real designs, a nose weight above all).
- **Consequences:** Designs with nose weights, nose bulkheads or a parachute packed in the nose import. Bulkheads and rings with an automatic radius stay refused everywhere, as before.

## D-077 (2026-10-13): .ork motor configurations, per-configuration deployment and fin cross-sections, as OpenRocket opens them

- **Decision:** A file with several motor configurations is read in the one marked `default="true"`, the configuration OpenRocket opens with, and the import says so; with several and none (or more than one) marked, the file is refused by name. The motor mount's motor and ignition, and each parachute's `<deploymentconfiguration>`, are those of that configuration; a parachute without an entry for it uses its own deployment elements. A mount with no motor in that configuration imports with no motor and a notice. Rounded and airfoil fin cross-sections are read (the drag model has them, plan 0009); the fin mass stays the slab, area × thickness × density, with a notice on import.
- **Why:** Thirteen of OpenRocket's seventeen example designs have several motor configurations; every one was refused. Which configuration and which deployment settings OpenRocket uses were observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/ConfigProbe.java`, output in `reference/rockets/config-probe/values.txt`: the selected configuration after reloading is the one marked default, and its parachute takes the per-configuration settings. The same probe shows OpenRocket making rounded fins 0.99 and airfoil fins 0.85 of the slab mass. No approved source gives those factors (CLAUDE.md 1 rules 1 and 2), and the slab is the conservative choice: heavier fins put the CG further aft and lower the margin.
- **Alternatives:** Import every configuration (rejected for now: the design holds one motor); use OpenRocket's volume factors (rejected: unsourced; recorded so it can be revisited if the owner approves them as a definition).
- **Consequences:** Most single-stage files open in the configuration the user last chose in OpenRocket. Rounded or airfoil fins weigh 1 % or 15 % more than in OpenRocket, which the import states; a fin mass override corrects it.

## D-078 (2026-10-13): .ork automatic values, zero-thickness and capped shoulders, and files with no default configuration, as OpenRocket opens them

- **Decision:** A value written "auto <number>" is the number (OpenRocket's resolved automatic value); a bare "auto" is refused. A shoulder of zero wall thickness is read as no shoulder. A capped shoulder adds a disc of the shoulder's wall thickness and inner radius (shoulder radius minus wall) at the shoulder's far end, of the component's material; a mass or CG override on such a component is refused. A file with several motor configurations and none marked default is imported with no motor, every parachute on its own deployment elements, and a notice. `<insideappearance>` is cosmetic and ignored.
- **Why:** These were the next blockers on OpenRocket's example designs after D-077. Observed as a black box (CLAUDE.md 3): `tools/openrocket-harness/src/ShoulderProbe.java` (reference/rockets/shoulder-probe/values.txt): the "auto 0.031" radius loads as 0.031 m; a zero-thickness shoulder has no mass, capped or not; the cap adds π(0.023 − 0.002)² × 0.002 × 1050 = 0.0029094 kg centred 0.001 m inside the shoulder's end, matching OpenRocket's mass and CG to 1e-6. `tools/openrocket-harness/src/SelProbe.java` on OpenRocket's example "Base drag hack (short-wide)" (three configurations, none marked): OpenRocket opens it in its own empty configuration, index −1. A cap under a component override cannot be split from the override, so it is refused rather than guessed.
- **Alternatives:** Refuse files with no default configuration (rejected: OpenRocket opens them); pick the first configuration (rejected: not what OpenRocket does).
- **Consequences:** Nose cones with capped or zero-thickness shoulders and files with automatic sizes import with OpenRocket's masses.

## D-079 (2026-10-13): .ork parachute mass from materials, the automatic parachute C_D, shock cords, tube couplers and engine blocks

- **Decision:** Without an override, a parachute's mass is its canopy disc, π (d/2)² × the surface density, plus its lines, count × length × the line density. An automatic parachute C_D is OpenRocket's 0.8, stated on import as OpenRocket's default. A shock cord is a mass of cord length × line density packed as a cylinder; a tube coupler is a thin tube read as a non-mount inner tube; an engine block is a ring whose inner radius is its outer radius minus its thickness. All are read in body tubes and nose cones.
- **Why:** These were the next blockers on OpenRocket's example designs (eleven files had material-based parachutes and automatic C_D). Each was observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/PartsProbe.java`; every mass and CG agrees with OpenRocket's to the printed precision (reference/rockets/parts-probe/values.txt, worked by hand in the tests). For the automatic C_D, CLAUDE.md 1 rule 2 forbids unsourced constants; the owner chose to use OpenRocket's default, labelled as such (2026-10-13, "openrocket default").
- **Alternatives:** Refuse an automatic C_D (rejected by the owner); ask for the C_D on import (possible later in the app).
- **Consequences:** Typical model rocket files with material-based parachutes, shock cords, couplers and engine blocks import with OpenRocket's masses. A parachute on the automatic C_D carries a notice that 0.8 is OpenRocket's default.

## D-080 (2026-10-13): .ork automatic ring, bulkhead and coupler radii; parts inside a tube coupler; radially offset masses

- **Decision:** A bare "auto" outer radius of a centering ring, bulkhead, engine block or tube coupler is the inner radius of what holds it: a body tube's radius less its wall; a hollow nose cone's radius less its wall at whichever end of the part it is smaller; a tube coupler's outer radius less its wall. Inside a filled nose cone it is refused. A centering ring's automatic inner radius is the outer radius of the largest inner tube its span overlaps, else 0. Parts inside a tube coupler are positioned against the coupler and read as inside a nose cone (mass components, parachutes, rings, bulkheads, shock cords, couplers, engine blocks). A radially offset mass component is placed on the axis at the same axial position, with a notice.
- **Why:** These were the next blockers on OpenRocket's example designs after D-079. Observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/AutoRingProbe.java` (reference/rockets/auto-ring-probe/values.txt): every radius, position, mass and CG agrees with OpenRocket to the printed precision, the nose case worked by hand from the tangent ogive (0.0071612 and 0.0229730 m). The physics model is axisymmetric (docs/conventions.md); a radial offset cannot be represented, and the axial position, which sets the CG along the rocket, is kept; the import names the offset rather than hiding it (CLAUDE.md 1 rule 3).
- **Alternatives:** Refuse radially offset masses (rejected: common for nose weights, and the axial CG is what stability uses); integrate the nose inner surface normal to the wall (rejected: OpenRocket subtracts the wall radially here, matched exactly).
- **Consequences:** Rings and bulkheads sized automatically in OpenRocket import with its radii; payload sections built in couplers import.

## D-081 (2026-10-13): .ork fin tabs, parts inside inner tubes, reloadable and plugged motors

- **Decision:** A fin tab is read into the fin set as a thin rectangular plate per fin inside the body (GEO-14, mass and inertia only, no aerodynamic force), its forward edge from the root leading edge taken from the tab's reference (front, centre or end). Parts inside an inner tube (an engine block in a motor tube) are read against the tube, an automatic outer radius there being the tube's inner radius; a zero-thickness engine block, massless in OpenRocket, adds nothing. Motor types "reload" and "hybrid" are accepted (catalogue information; the motor is matched by name). A delay of "none" is a plugged motor. The `<designer>` element is ignored.
- **Why:** These were the next blockers on OpenRocket's example designs after D-080. Observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/TabProbe.java` (reference/rockets/tab-probe/values.txt): the tab's mass, 3 × 0.06 × 0.012 × 0.003 × 600 = 0.003888 kg, its front edge (0.01, 0.03, 0.05 m) and the fin set's CG agree with OpenRocket. OpenRocket leaves the tab out of the fin set's inertias; GEO-14 includes it, which is the physically complete choice and changes no CG or mass. With this step three of the seventeen example designs import and fly; "A simple model rocket" in its default configuration reaches 330.2 m in the displayed mode against OpenRocket's stored 316.6 m (+4.3 %, within the 5 % tolerance of CLAUDE.md 7.4; the displayed mode's DATCOM base drag is already +2.4 % on R1, D-069).
- **Alternatives:** Model the tab as a separate mass component (rejected: its inertia would be that of a cylinder on the axis).
- **Consequences:** Through-the-wall fins import with their tabs; motor mounts with engine blocks import; reloadable and plugged motors import.

## D-082 (2026-10-13): The .ork reader lists every unsupported feature of a file at once

- **Decision:** The reader records an unsupported feature in a component and goes on to the next component, then refuses the file with one `OrkUnsupportedFeaturesError` (an `OrkUnsupportedError`) listing every feature found, each with its component's path without the file's container elements. Malformed input still stops at once. The message no longer names the internal plan file: "… is not supported yet."
- **Why:** The owner found the import refusing one feature per attempt ("the whole system doesn't handle .ork files well"). Nothing is imported partly: any unsupported feature still refuses the file, so no design is built from an incomplete reading (CLAUDE.md 1 rule 3).
- **Alternatives:** Import the supported parts and drop the rest (rejected: a design missing parts gives a wrong CG, CP and flight without saying so).
- **Consequences:** A user sees the full list of what to change or what is not yet supported, in one attempt.

## D-083 (2026-10-13): Always simulate; approximate with a stated method and report the confidence (the owner's rule change)

- **Decision:** CLAUDE.md section 1 rules 2 and 3 and the version-1 non-goals are changed by the owner. Every design a user builds or imports produces a result. A part, setting or flight condition the models do not cover exactly is simulated with the best documented approximation (the most conservative where there is a choice), and each approximation is listed in the result with what was not modelled, the method used, its expected effect and an impact (minor, moderate, major), from which an overall confidence (high, medium, low) is given. Invalid inputs (a negative length) are still reported plainly with what to fix. The design keeps what the user built; the simulator approximates what it cannot yet model and says so, so that a part's approximation disappears when its model is added and swapping parts never breaks a design.
- **Why:** The owner's goal: "I can simulate any design I want: any kit, any sizes, any weights, any files … the system can't break every time we swap something out." The previous rule 3 ("never silently fall back … report it explicitly") was applied as "refuse", so the importer and parts of the physics refused designs (none of OpenRocket's seventeen example designs opened on 2026-10-13 before plans 0048 to 0054). The accuracy goal is kept: nothing is hidden, and the confidence rating says how far to trust a result.
- **Alternatives:** Keep refusing until each model exists (rejected by the owner: the app cannot be used for real designs meanwhile); approximate silently (rejected: CLAUDE.md 1 rule 8, be honest about limitations).
- **Consequences:** `NotImplementedError` stops and import refusals are replaced, one at a time, by documented approximations listed in results (plan 0055). Multi-stage, clustered and podded designs are simulated with their approximations; full staging and pod flight paths stay non-goals.

## D-084 (2026-10-13): The .ork reader approximates what it cannot model inside the rocket, and lists it

- **Decision:** Under D-083, the reader no longer refuses a part inside the rocket, or a setting of a part, that the app cannot model exactly. It imports it with an approximation (subject, what, method, effect, impact) carried by the part, or by the design when no part holds it, which every result then lists:
  - A part inside a body tube, nose cone, coupler or inner tube that cannot be read stands in as a mass at its position when the file gives one (`<overridemass>` or `<mass>`), else is left out. Impact: major for lifting or drag-making parts (fins, lugs, buttons, pods) and recovery devices (parachutes, streamers: the descent is flown without them); moderate when left out with no mass; minor otherwise. A part holding a motor mount is not stood in (a cluster: the flight would lose its motor) and a problem inside a part, such as its motor mount, is not hidden by the part's stand-in: both stay refusals.
  - A setting the reader does not know is skipped and listed as major, because what it would change is not known.
  - Canted fins fly straight, no roll forcing (minor, until plan 0055 step 6); fillets are left out (minor); an unknown fin cross-section flies as square (moderate); any radial offset of an inner part is put on the axis (minor; D-080 extended).
  - A drag coefficient override is not applied, the computed drag is used (moderate). A component override covering parts inside it is not applied (moderate; refused under D-073). A stage override is not applied yet: major for mass or CG, because OpenRocket makes it the stage's total or adds it as a point mass (reference/rockets/stage-override-probe/values.txt), moderate for drag.
  - The automatic parachute C_D of 0.8 (D-079) is listed as moderate instead of a notice. A parachute deployed at an event the app does not model (a stage separation) deploys at apogee (major). A parachute's override "including subcomponents" is its own, as OpenRocket gives a parachute no children.
  - A clipped transition of a shape other than conical flies unclipped (moderate); a clipped cone is the same cone.
  - Modelled exactly, from OpenRocket observed as a black box: a launch lug of n instances is n lugs `<instanceseparation>` apart, its mass override their total at the override CG from the first lug's front (reference/rockets/lug-probe/values.txt: positions 0.30, 0.35, 0.40 m, n times the mass and drag of one, 0.01 kg at 0.32 m); transition shoulders are tubes beyond each end with a cap disc when capped, the nose cone rule of D-078 (reference/rockets/transition-shoulder-probe/values.txt: 0.013286086 kg, CG 0.012013217 m, matched). A mass or CG override on a transition with shoulders is refused, as for capped shoulders.
  - Rail button screws are left out (minor): OpenRocket counts each as a half-ellipsoid of the button's outer radius and the screw height, mass only (lug-probe cases 3 and 4: 0.4197 g for two 9.7 mm Delrin buttons with 3 mm screws), and the listed effect gives that mass.
  - The import notice says how many approximations there are and how many are major.
- **Why:** The owner's goal (D-083): any file imports and flies. These were the refusals of parts inside the rocket and of part settings. The impact ratings take the cautious side where unknown; the black-box probes make two items exact instead of approximated.
- **Alternatives:** Drop unreadable parts silently (rejected: rule 3); keep refusing until each model exists (rejected by the owner, D-083); apply stage overrides by scaling every part's mass at import (rejected for now: it spreads one figure over every part of the user's design; a design-level measured-mass override is the next step).
- **Consequences:** Files that were refused for these features import, with their approximations shown under the results and a confidence rating. Still refused, for the next step (plan 0056 part 2): parts outside the body (pods, booster sets, more than one stage), flipped nose cones, unknown nose shapes, a bare "auto" radius on an outer part, non-bulk materials on outer parts, motor clusters, more than one motor mount, ignition delays and events, other reference lengths and other format versions.

## D-085 (2026-10-13): .ork fin cant is in degrees

- **Decision:** The reader takes `<cant>` in degrees. The cant approximation of D-084 states the file's value as written.
- **Why:** D-084 converted it as radians, so OpenRocket's example "Simulation scripting" was listed with a 57.3° cant for a 1° one. Observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/CantProbe.java`: a fin set canted 2° is written `<cant>2.0</cant>` and read back as 0.034906585 rad (reference/rockets/cant-probe/values.txt). The cant enters only the listed text until roll forcing is modelled (plan 0055 step 6), so no result changed.
- **Alternatives:** none; the probe settles it.
- **Consequences:** Canted fins are listed with their real angle.

## D-086 (2026-10-13): Motor clusters: n motors igniting together, inertia with their offsets, and OpenRocket's base drag rule in the comparison mode

- **Decision:** A motor mount may hold a cluster: n identical motors, each at an offset (y, z) from the rocket's axis, igniting together. The thrust is n times one motor's, along the axis; the mass n times; the inertias by GEO-15, which keeps each motor's offset in both the roll and the pitch inertia (the pitch term averaged over the two transverse axes). The base drag removes the area of all n thrusting motors (N09 p. 51) in the displayed mode, and of one motor in the OpenRocket-equivalent mode, which is what OpenRocket 24.12 does. A layout off the axis, or without three-fold symmetry, is listed (major, minor). The `.ork` reader turns OpenRocket's layouts into offsets, places the n tubes on the axis (listed as minor) with their contents once per tube, and spreads a mass override over them as their total; an unknown layout flies as one motor (major).
- **Why:** Plan 0055 step 3. Observed as a black box (CLAUDE.md 3) with `tools/openrocket-harness/src/ClusterProbe.java` (reference/rockets/cluster-probe/values.txt): the layouts' unit points, scaled by the tube diameter and `<clusterscale>` and turned by `<clusterrotation>` degrees; masses n times; the motors' roll inertia n I₁ + m Σd², matched by GEO-15; OpenRocket's pitch inertia leaves the offsets out (5.67858e-5 against GEO-15's 7.00983e-5 kg·m² for three D12s), the physically incomplete figure, which GEO-15 does not copy (as GEO-14, D-081); a tube mass override is the tubes' total. In OpenRocket's flight data the drag coefficient with three D12s equals that with one at the same Mach, so it removes one motor's area: with that rule the three-motor apogee is 276.676 m against OpenRocket's 273.974 m (+1.0 %, maximum velocity +0.4 %), as close as one motor (+0.5 %); with all three removed it was +3.5 %.
- **Alternatives:** Apply the off-centre thrust moment (rejected for now: the CG would also move off the axis, which the axisymmetric model cannot hold; no OpenRocket layout is off-centre); copy OpenRocket's pitch inertia (rejected: physically incomplete; the effect is under 0.1 % of the rocket's pitch inertia here).
- **Consequences:** Clustered designs import and fly; the design file's motor mount carries `cluster`. OpenRocket's "Clustered motors" example imports; "Airstart timing" still needs ignition delays (multi-stage step).

## D-087 (2026-10-13): Elliptical and freeform fins by Niskanen's general-planform method

- **Decision:** A fin set may have an elliptical or freeform planform (`shape`). Every planform quantity comes from one function, `finPlanform`: Niskanen's MAC integrals (3.30) to (3.32) with the CP at the quarter of the MAC, the chord filled across a jagged edge while the normal force keeps the true area, the mid-chord and leading-edge angles averaged over the span, and the roll damping strip sums (BAR-18); the mass from the planform's exact moments (GEO-16). The trapezoid's quantities are its existing closed forms, so no trapezoid result changes. The methods written for trapezoids only (DATCOM supersonic fin and carry-over, BAR-12 with DATCOM, the DATCOM fin wave drag's quarter-chord sweep, the large-angle method and its reversed planform, TN 4197 flutter) use the equivalent trapezoid of the same span, root chord, area and CP, listed as minor.
- **Why:** Plan 0055 step 2: elliptical and freeform fins were stood in as nothing (D-084), so such rockets flew without fins. Niskanen gives the method for any planform (§3.2.2: "equations (3.30)–(3.32) may also be directly applied to elliptical or free-form fins"; the averaged mid-chord angle p. 29; Γ_L "the average leading edge angle" p. 50). A freeform outline of a trapezoid reproduces the trapezoid's mass, normal force, CP (Mach 0.3 to 2.5) and drag to 1e-11, and R1's apogee to 1e-9.
- **Alternatives:** An equivalent trapezoid for everything (rejected: the source covers general planforms); DATCOM's non-straight-tapered wing charts (not in the approved sources yet).
- **Consequences:** The physics flies elliptical and freeform fins. The `.ork` import and the app's display of such fins follow in plan 0059.

## D-088 (2026-10-13): Elliptical and freeform fin sets imported, saved and shown; fin tabs saved

- **Decision:** The `.ork` reader reads `<ellipticalfinset>` (root chord and height) and `<freeformfinset>` (its points) into fin sets with a shape (D-087); the design file accepts a fin set's `shape` and `tab`; the app draws any fin outline and lets the user choose trapezoidal or elliptical, keeping an imported freeform outline until the user turns it into its equivalent trapezoid. An elliptical fin is the true half ellipse, not OpenRocket's 31-point polygon (0.18 % more area).
- **Why:** Plan 0055 step 2. Observed as a black box with `tools/openrocket-harness/src/FinShapeProbe.java`: the imported shapes give OpenRocket's CP within 0.016 % (elliptical) and 0.13 % (freeform), and the freeform mass and CG exactly. The design file had no `tab` field since D-081, so a design imported with fin tabs failed to load ("unknown field tab"): found while adding `shape`, fixed here.
- **Alternatives:** Copy OpenRocket's 31-point ellipse (rejected: the ellipse is what the user drew; the difference is within every tolerance).
- **Consequences:** Rockets with elliptical or freeform fins import and fly with their fins. Fin sets on nose cones (OpenRocket's "Pods--airframes and winglets") are still stood in.

## D-089 (2026-10-13): The rocket's as-built mass and CG

- **Decision:** A design may carry `asBuilt`: the empty rocket's weighed mass and/or balance point, motor out. Every part's mass properties are scaled by M/M₀ and moved by C − X̄₀ (GEO-17), applied where the design becomes physics parts, so the stability, the masses, the flight and the Monte Carlo runs use it; the Monte Carlo structural mass scale now also scales the as-built mass and a part's own mass override, which it had left fixed. The `.ork` reader turns a stage mass or CG override into it as OpenRocket applies the override: covering the parts, the total and the CG; not covering them, a point mass added at the stage's CG or the overridden CG, spread here over the parts at the same total and CG (minor: the pitch inertia differs from a point mass); a CG override alone not covering the parts does nothing in OpenRocket and nothing here. A stage CG override for the stage alone beside a total mass, not observed in OpenRocket, is listed (moderate). The app's airframe view offers the two figures, each starting from the computed one.
- **Why:** The owner's "any weights" (D-083): builders weigh their rockets, and OpenRocket files carry that weight as a stage override, which D-084 could only list as not applied (major). Observed as a black box (reference/rockets/stage-override-probe/values.txt): the imported designs reproduce OpenRocket's structure mass and CG in all seven cases to 1e-6.
- **Alternatives:** Put the difference in one added mass part (rejected: its position would move the CG unless placed at the CG, where a point mass gives the wrong inertia either way; scaling keeps the parts' distribution); copy OpenRocket's inertias (rejected: they do not follow the override's mass, D-073).
- **Consequences:** "Dual parachute deployment" and other files with a weighed stage import without a major approximation; users can enter their weighed rocket.

## D-090 (2026-10-13): Claude through a local MCP server on the user's own plan; the site hardened against hostile input

- **Decision:** Claude joins as the modelling partner through route A of plan 0061 only: a local MCP server run by Claude Code or installed in Claude Desktop as an extension, on the user's own Claude plan, with nothing hosted by the project. No "log in with Claude" in the site, no remote connector (route B) and no API key in the browser (route C) for now. Before the server, the site is hardened (plan 0061 step 1):
  - Every reader refuses an input over 64 MiB before reading it (`MAX_INPUT_BYTES`); the app checks the file size before reading it into memory.
  - An `.ork` archive is decompressed as a stream fed 16 KiB at a time and abandoned once its entry passes 256 MiB (`MAX_UNZIPPED_BYTES`), so a zip bomb is caught by what it produces, not what it declares; no decompressed chunk can exceed about 16 MiB (deflate's maximum ratio is about 1032:1). The stored simulations, which the reader never uses, are cut out, and the rest must be under 16 MiB (`MAX_XML_CHARACTERS`).
  - An XML document with a document type or entity declaration is refused before parsing ("billion laughs" and outside-entity attacks); OpenRocket and RockSim files never have one.
  - The built site carries a Content-Security-Policy meta tag: its own scripts and workers only, no inline script, no plugins, no base change, no form submission, and network access only to the six outside services the code uses (ThrustCurve.org, OpenStreetMap Nominatim, three map tile hosts, the AWS terrain tiles). A unit test checks every host in the source is listed; every end-to-end test fails on a policy violation.
  - The launch-site panel says plainly which outside services see the searched place and the viewed area, and that nothing about the rocket is sent.
  - CI runs with read-only repository permissions; CodeQL runs on every pull request and weekly. GitHub's dependency review needs the repository's dependency graph, which only the owner can switch on (Settings > Advanced Security > Dependency graph); its workflow is added once it is on.
- **Why:** The owner (2026-10-13): Claude integration "using private memberships", "security must be vital, with ill intent accounted for and the user protected, where no cost should incur, except usage being used on their subscription", and API usage only "strictly with their input"; the owner chose "Local, Claude Code + Desktop" when asked. Facts checked against Anthropic's documentation on 2026-10-13:
  - Claude Code adds a local server with `claude mcp add --transport stdio <name> -- <command>` (code.claude.com/docs/en/mcp).
  - Claude Desktop installs a local server packaged as an `.mcpb` extension from Settings > Extensions (claude.com/docs/connectors/custom/add-unlisted).
  - A remote custom connector needs a public HTTPS server speaking Streamable HTTP, which GitHub Pages cannot host.
  - "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users" (code.claude.com/docs/en/legal-and-compliance).
  - The TypeScript SDK runs in a browser only with `dangerouslyAllowBrowser`, because a key there can be extracted.
  - The repository is public, so CodeQL costs nothing; if it became private it would need GitHub Advanced Security and would stop rather than bill.
- **Alternatives:** Route B, a remote connector usable from claude.ai on the web and phone (deferred: it needs a host account in the owner's name and a public server to defend); route C, the user's own API key in the page (deferred: API billing rather than the subscription, and the key is exposed to any script on the page); a size limit on the declared zip entry size only (rejected: a hostile archive can understate it).
- **Consequences:** Files that real users have open as before (the five reference files and OpenRocket's examples are far inside every limit; a file whose design part alone is over 16 MiB is refused with a plain message). The development server runs without the policy, because it injects inline scripts. A meta tag cannot set `frame-ancestors`, so another site can frame the page (docs/known-limitations.md). Plan 0061 step 2, the MCP server, is next.

## D-091 (2026-10-13): Multi-stage designs drop the spent stage at separation

- **Decision:** A multi-stage design flies as one body whose motors ignite in turn (Niskanen Table 4.2, p. 69: at launch, at another motor's burnout or ejection charge, with a delay); when an upper stage ignites, the spent lower stage separates and its mass, inertia and aerodynamics leave the vehicle. The booster's own flight after separation is not simulated in version 1. CLAUDE.md's version-1 non-goal now reads "booster and pod flight paths" instead of "separation events", changed by the owner's answer.
- **Why:** The owner chose "Yes, drop the spent stage (Recommended)" on 2026-10-13, option (b) of the open question in `docs/progress.md`. Carrying the spent stage to apogee (option a) would show the apogee far low; OpenRocket separates the stage.
- **Alternatives:** Option (a), the stack as one body to apogee (kept only as the first step of the implementation, never as the result); simulating the booster's descent too (a later step: it needs a second flight path in the results).
- **Consequences:** Plan 0055 step 3 part 2 implements staging; until it is merged, multi-stage `.ork` files remain refused with that reason. The separation approximations (instantaneous separation, no separation impulse, no stage interference) will be listed with the results (rule 3).

## D-092 (2026-10-14): The local MCP server records every value Claude did not give

- **Decision:** `packages/mcp` (plan 0062) is a local MCP server on the official SDK (`@modelcontextprotocol/sdk` 1.31.0 and `zod` 4.6.5, both pinned exactly and more than two weeks old when adopted). Its tools build, check and fly designs in memory, with no file, command or network access.
  - A part field Claude does not give takes the app's editing default (`defaultComponent`, moved from the app to `packages/formats` unchanged) and is recorded on the part as an approximation "… not given". The impact is major for outline fields of the nose, transitions, body tubes and fins, minor for lugs and rail buttons, and moderate otherwise. Giving the field clears it.
  - A position not given is listed (moderate), except for outline parts, which stack aft of the outline. Fins go flush with the aft end.
  - A fin set's or rail buttons' body radius, and a launch lug's offset, are worked out from the body tube at the part's position. They are listed only when no body tube is there.
  - An optional field given as `null` is left out: that is how a solid nose cone is said.
  - A missing ejection delay is listed (moderate, treated as plugged), and so is a missing motor overhang (minor, 0) and a missing parachute drag coefficient (moderate, 0.8, Niskanen p. 67).
  - Launch settings not given are reported with every result and review, not listed as approximations. The app does not list them either, and they are conditions of the day, not the design.
  - Quantities may be strings with units, converted by the physics package's sourced functions. UNIT-12 (the SI prefixes centi, milli, hecto and kilo; g/cm³) and UNIT-13 (km/h) were added from the SI Brochure, Tables 7 and 8 (pp. 138 and 140).
  - The tool field table is checked against `COMPONENT_FIELDS`, which `validate.ts` now exports and uses itself.
  - The bundled motor files moved from the app into `packages/formats` as text, byte-identical to `reference/motors` (test).
- **Why:** Plan 0061 route A (D-090). CLAUDE.md 1 rule 3 says nothing is defaulted unless it appears in the list. A design built by an assistant from a partial specification is exactly where silent defaults would hide, so every one is made visible to Claude (the review's "must" items) and to the user (the confidence rating). Converting units in the server removes Claude's arithmetic from the chain.
- **Alternatives:**
  - Require every field (rejected: Claude would then invent the missing values itself, invisibly).
  - Hand-written JSON schemas per kind in the tool definitions (rejected for now: several thousand tokens of every user's context on each request; the `about` tool gives the same reference once).
  - Implementing the MCP protocol by hand (rejected: the official SDK is the reference implementation and handles version negotiation).
- **Consequences:**
  - The example rocket built part by part through the tools reproduces `exampleDesign()` and its flight bit for bit (test).
  - Imported `.ork` files fly as the formats package flies them (test).
  - Distribution (a single bundled file and a Claude Desktop `.mcpb`) and ThrustCurve search follow in plan 0062's next pull requests.
  - CodeQL found that the readers' number pattern `\d+\.?\d*` backtracks quadratically on long digit runs (a 50 000-digit field took 5.4 s), reachable now from the server's inputs. Every copy (the `.eng`, CSV, `.rse`/`.ork`, unit and display readers) became the equivalent `\d+(?:\.\d*)?`, which runs in linear time (0.3 ms); a test keeps it so.

## D-093 (2026-10-14): The MCP server's one network use, and Monte Carlo per call

- **Decision:**
  - Two tools reach the network, both read-only and both marked as such to the client (`openWorldHint`): `search_thrustcurve` and `add_thrustcurve_motor`. They use the formats package's tested ThrustCurve.org client (plan 0013) through a transport that:
    - refuses any URL outside `https://www.thrustcurve.org/api/v1/` before a request is made;
    - sends no redirects (`redirect: 'error'`), times out after 20 s, and stops reading an answer at 4 Mi characters;
    - allows 200 requests per session.
      Search asks only for motors with data files, with the diameter in millimetres as the API defines it. A downloaded motor joins the session's library as `thrustcurve:<motorId>` with its listed delays, held in memory, never on disk.
  - `monte_carlo` runs the app's dispersion (plan 0017) on the design's record or the call's settings, at most 200 runs per call. A seed is always used and returned: the given one, the design's, or a fresh one (CLAUDE.md 5).
- **Why:** Plan 0062. "Any rocket" needs the whole motor catalogue, not the eight bundled motors. The bound on requests and answers keeps a runaway loop or a hostile answer from costing the user or the service anything. A flight with its descent takes about 0.3 s here, so 200 runs take about a minute, which is as long as a tool call should block.
- **Alternatives:**
  - Fetching any URL Claude gives (rejected: it would make the server a general network tool, which prompt injection could abuse).
  - Caching downloads on disk (rejected for now: the server writes no files; the app keeps its own cache).
  - 1000 runs per call, as first planned (rejected after timing it).
- **Consequences:** A test drives search, download and flight with recorded answers in the API's documented form, and the downloaded D12 flies exactly as the bundled one. With no transport (tests, offline), the two tools say the catalogue is not available.

## D-094 (2026-10-14): How the MCP server reaches users

- **Decision:**
  - **The files.** The server is built into one self-contained Node file, `lo-fi-rocket-mcp.mjs` (Vite 8 server build, every dependency bundled; 1.6 MB, of which the SDK, zod, ajv, the XML readers and fflate are the outside code). It is also wrapped as a Claude Desktop extension, `lo-fi-rocket.mcpb`: a zip of `manifest.json` (manifest version 0.3) and `server/index.mjs`, run as `node ${__dirname}/server/index.mjs`. The zip is written with a fixed date, so the same sources give the same file.
  - **Publishing.** The deploy workflow publishes both on the GitHub Pages site beside the app, with `SHA256SUMS`. A static page, `claude.html`, linked from the File menu, explains both ways to connect and how to check the download. The page has its own strict Content-Security-Policy: no script at all.
  - **Checks.** CI builds both and runs a smoke test:
    - the file runs with plain `node`, answers the MCP handshake, lists its 22 tools and flies the example;
    - the extension's manifest passes `validateManifest` of `@anthropic-ai/mcpb` 2.1.2 (the package Claude Desktop uses to load extensions, dev dependency only);
    - the extension runs from its unpacked folder with its own command line, as Claude Desktop runs it;
    - the checksums match.
- **Why:** Plan 0061 route A (D-090) needs something a user can install without a package registry account, a build step or a server. GitHub Pages already serves the app at no cost. The `.mcpb` format and its manifest fields were taken from `@anthropic-ai/mcpb` 2.1.2: its README, its JSON schemas, and its `${__dirname}` substitution in `dist/shared/config.js`. Claude Desktop ships Node.js, so its users install nothing else.
- **Alternatives:**
  - Publishing to npm for `npx -y` (deferred: it needs an npm account in the owner's name).
  - `mcpb pack`, the official packer (not needed for a single file; the official validator checks the result instead).
  - Code signing of the extension (deferred: it needs a certificate the owner would hold).
- **Consequences:** The extension is unsigned, so Claude Desktop may say so when installing it, and users who want certainty compare the published SHA-256. Each merge to `main` publishes new files; there is no separate release channel yet.

## D-095 (2026-10-14): Designs travel in links, in the address fragment

- **Decision:** A link `…/lo-fi-rocket/#design=v1.<data>` opens a design in the web app (plan 0063), and the MCP server's `design_link` tool makes one.
  - **Encoding.** `<data>` is the design file text, deflated (fflate, level 9) and written in base64url (RFC 4648 §5, no padding). `v1.` names the encoding.
  - **Decoding** is bounded as every other reader (D-090): at most 512 Ki characters of base64url only, then a decompression fed in 16 KiB slices and abandoned past 4 MiB of output, then `parseDesign` with its migration and validation.
  - **Opening.** The app opens the design with a fresh id and stores it at once, then removes the fragment from the address, so a link never overwrites a stored design and a reload opens the stored copy. A notice names the design and says it came from a link.
  - **A bad link** opens the autosave instead, with a notice saying why.
- **Why:** Plan 0061 step 3. A design built with Claude should open in the app with one click, approximations and "not given" notes intact, without a server. The fragment is never sent to a server (RFC 3986 §3.5), so GitHub Pages never sees the design.
- **Alternatives:**
  - A query string (rejected: it is sent to the server and kept in its logs).
  - Uncompressed JSON (rejected: the example design is about 3 kB deflated and several times that as text).
  - Opening the linked design in place of the open one without storing it (rejected: a reload would lose it).
- **Consequences:**
  - The example and all five reference rockets round-trip exactly (tests).
  - A 64 MiB deflate bomb in a link stops at 4 MiB within the time limit (test).
  - The end-to-end test opens a link in the built app and checks that the address is cleared and the design survives a reload.

## D-096 (2026-10-14): Staged flight in the engine: motors ignite in turn, separated stages leave

- **Decision:** `FlightVehicle` may carry `stages` (plan 0064 part 1).
  - **Contents:** the stage of each part and recovery device (0 is the top stage); the motors, each with its stage and its ignition event; and each stage's separation event and delay.
  - **Ignition.** A motor ignites at launch, at another motor's burnout or at another motor's ejection charge, each with a delay (Niskanen Table 4.2 p. 69).
  - **Separation.** A stage separates at the ignition of the stage above it, at its own motor's burnout or ejection charge, at launch, or never, with a delay. Its parts, motors and recovery devices then leave the vehicle with every stage below it, at once. The state of motion carries on; the attached parts' mass properties, aerodynamics, reference diameter (unless fixed by the user), length and base motor are recomputed.
  - **Mass.** It combines every attached motor (`combineRocketMotors`, GEO-12): unignited ones loaded, burning ones by their mass rule, spent ones at their burnout mass.
  - **Phases and events.**
    - Ignition returns a coasting rocket to powered flight.
    - `ignition` and `separation` are new events; `burnout` and `ejection-charge` occur per motor.
    - The summary's burnout is the last motor's. Its ejection charge is the top stage's, since a lower stage's charge is a staging charge meant to fire while climbing.
    - A recovery device on the ejection charge opens at its own stage's charge.
  - **Listed approximations.** Three are listed with every staged result (all minor): instantaneous separation with no impulse, the separated stages' own flight not simulated, and interstage aerodynamic interference not represented.
- **Why:** The owner's decision D-091. Table 4.2 gives the ignition events. The thesis has no separation event, so the separation set follows OpenRocket's file format (`upperignition`, `burnout`, `ejection`, `launch`, `never`), which the importer will read in part 2. What OpenRocket does at separation will be measured as a black box there.
- **Alternatives:**
  - Carrying the spent stage to apogee (option (a) of the open question, rejected by the owner).
  - Simulating the booster's descent (a later step: a second flight path in the results).
- **Consequences:**
  - Without `stages` every result is bit-identical (the golden tests pass unchanged).
  - A vehicle with one stage and one launch motor flies exactly as the unstaged vehicle, aerodynamics on (test).
  - Two-stage flights in vacuum match the piecewise closed form to 1e-4 m. This covers ignition at burnout, at an ejection charge with a delay after a coast, separation at burnout before ignition, and no separation (tests).
  - The mass never rises during a flight, over random delays (property test).

## D-097 (2026-10-14): Staged designs in the file (schema 2), and OpenRocket's ignition events

- **Decision:** The design file moves to schema 2 (plan 0064 part 2a). The migration from 1 is the identity: every new field is optional, so a version-1 file is the same one-stage design.
  - **Stages.** `stages` lists the stages, top first, each with a name and, for every stage but the top one, a separation event and delay. A part (`components[].stage`) and a recovery device (`recovery[].stage`) name their stage; absent means 0.
  - **Motors.** `additionalMotorMounts` holds motor mounts beyond `motorMount`, such as one per further stage. A motor belongs to the stage of its mount's part, so a mount can never disagree with its part. No two mounts share a part.
  - **Ignition.** `MotorMount.ignition` is OpenRocket's event set: `automatic`, `launch`, `burnout`, `ejection`, `never`, with a delay; absent means automatic with no delay. As observed in OpenRocket 24.12 (reference/rockets/staging-probe/values.txt, parts 1 to 3), "automatic" is launch for a motor in the bottom stage and otherwise the ejection charge of the stage directly below; `burnout` and `ejection` are those of the stage directly below. With no motor there the motor never lights, as in OpenRocket (`staged-gap-middle`), and the design warnings say so (code `ignition`).
  - **Separation.** The engine now has OpenRocket's nine events: the upper stage's ignition, the stage's own ignition, burnout or ejection charge, launch, apogee, climbing or descending through an altitude above the pad, and never.
  - **Edge cases, said in the results.** A motor that was due to light and did not, and a stage that was due to separate and did not, are each a warning with the reason. When no motor lights at launch the flight ends at once on the pad (end reason `no-ignition`), where OpenRocket aborts (`staged-gap-bottom`).
  - **Figures.** The design's mass, CG and stability are the whole stack's: liftoff with every motor loaded, burnout with every motor spent. Thrust-to-weight counts the motors lit at launch over the whole stack's weight.
  - **Path.** A design with no `stages`, one motor and a launch ignition at 0 s keeps the unstaged path, so every existing result is bit-identical.
- **Why:** The owner's goal (any design, any file) and D-091. Deriving a motor's stage from its part removes a way for a file to contradict itself. OpenRocket's "automatic" is defined only in its interface text, so it was measured as a black box (CLAUDE.md 3) on its own examples and on two built cases with an empty stage.
- **Alternatives:**
  - Replacing `motorMount` with a list (a real migration touching every reader of the field; deferred).
  - A motor mount inside each stage entry (a mount could then name a part of another stage).
  - Resolving "automatic" when the file is written (the meaning would not follow later edits to the stages).
- **Consequences:**
  - Stage editing in the app and the MCP server is part 3.
  - The `.ork` stages import with the OpenRocket comparison is part 2b.
  - The per-configuration stability of a staged rocket (the sustainer alone at its ignition and burnout) is not yet shown; the in-flight margin check covers the flight.

## D-098 (2026-10-14): Staged `.ork` files: how each stage is read

- **Decision:** The `.ork` reader reads every stage (plan 0064 part 2b). Each rule follows OpenRocket 24.12 as measured by `StagingProbe` (reference/rockets/staging-probe/values.txt, parts 1 to 6).
  - **Positions.** Each stage's external parts stack from the end of the stage above. A stage positioned any other way is refused by name.
  - **Motor mounts.** Every mount with a motor is read, in file order; the design's `motorMount` is the first, the rest are `additionalMotorMounts`. Each motor's ignition comes from the configuration's `<ignitionconfiguration>`, else the mount's own elements.
  - **Separations.** Each stage's separation comes from its `<separationconfiguration>`, else its own elements.
  - **Event words.** These are the file's own (part 4): `ejectioncharge` is the ejection charge; `upperignition`, `altitudeascending` and `altitudedescending` are the upper stage's ignition and the two altitude events.
  - **Unknown or missing events** are read as automatic ignition, or separation at the upper stage's ignition, and listed as major.
  - **Altitudes at or below the pad.** A separation altitude at or below the pad is exactly launch (climbing) or never (descending).
  - **Stage overrides.** A one-stage file keeps D-089 (the design's as-built mass and CG). In a staged file a stage override scales and moves that stage's parts alone (GEO-17), so they leave with it at separation. Its CG is measured from the stage's front (part 6: 0.380318 m, as OpenRocket).
  - **Stages switched off** in the configuration used (part 5) are left out of the flight, with a notice.
    - Off at the top or the bottom of the stack, they leave the stage list: the sustainer with its booster off flies alone and lights at launch, as in OpenRocket.
    - Off between stages that fly, the stage stays as an empty stage, so the stage above waits for its charge and never lights, as in OpenRocket. The stages below move up to close the gap, since the model needs one continuous body (Niskanen eq. 3.29). That is listed as major: OpenRocket keeps the gap, with its CG further aft and extra drag.
  - **One-stage files import unchanged.** No stage fields are written, and an ignition is written only when it is not automatic at once.
- **Why:** Rule 3 and the owner's goal (any file): the reader refused every staged file, every ignition delay and every second motor mount. OpenRocket's behaviour is defined only by its program, so each rule was measured, not read from its source (CLAUDE.md 3).
- **Results:** The probe's two staged rockets, imported and flown in the OpenRocket-equivalent mode, are within CLAUDE.md 7.4's tolerances. Separation and ignition times agree within 1 ms.

  | Rocket       | Apogee                                  | Max velocity                              |
  | ------------ | --------------------------------------- | ----------------------------------------- |
  | `staged-bp`  | 450.509 m against 438.304 m (+2.78 %)   | 99.349 m/s against 97.202 m/s (+2.21 %)   |
  | `staged-hpr` | 1139.892 m against 1126.746 m (+1.17 %) | 298.803 m/s against 304.574 m/s (−1.89 %) |

- **Alternatives:**
  - Keeping the gap of a switched-off middle stage (the engine refuses a body with a gap, plainly; closing it and listing it simulates the design).
  - Applying a staged file's stage override to the whole design (the booster's mass would stay with the sustainer after separation).
- **Consequences:**
  - OpenRocket's "Two stage high power rocket" and "Three stage low power rocket" import. Their motors (H148R, I59WN-P, I357T, B6) are not in the bundled library, so they fly once those motors are chosen; their files stay in OpenRocket and their recorded figures are in values.txt part 1.

## D-099 (2026-10-14): Staging through the MCP server

- **Decision:** Claude builds staged rockets with the same tools as one-stage ones (plan 0064 part 3a).
  - **Stages.** `set_stages` lists the stages, top first; every stage but the top one needs a separation event. A delay left out is 0 s and recorded as "not given" (minor), as every value the user did not give (D-092). One stage makes the design a one-stage rocket; while parts still name a lower stage, this is refused with the validator's message.
  - **Parts and devices.** Each part and recovery device takes a stage (0 when left out, the top stage, so one-stage use is unchanged).
  - **Motors.** A motor belongs to its mount part's stage (D-097). `set_motor` replaces the motor of that stage, so a one-stage design keeps its one mount as before; `add: true` adds a mount beside it (an air start). The ignition is optional: automatic when left out, which is OpenRocket's rule and the right one for a one-stage rocket, so it is not a "not given" note. The resolved ignition is shown with each motor, so Claude reports what will happen.
  - **Review.** A motor whose ignition event can never come is a "must" in `review_design`.
- **Why:** The owner's goal (any design) and D-091; the tools stay one per task, and every default stays visible.
- **Consequences:**
  - 24 tools (the bundle's smoke test).
  - `update_part` no longer drops a part's stage (it rebuilt parts without it since schema 2).

## D-100 (2026-10-14): Editing stages in the app, and each configuration's stability

- **Decision:**
  - **Editing.** The app edits stages through pure operations in the formats package (`stages.ts`):
    - add a stage below the bottom one, separating when the stage above lights (the usual setting, shown and editable);
    - remove the bottom stage only when it holds no part or device, saying what it still holds rather than moving or deleting anything;
    - move a part to a stage;
    - set one stage's motor mount, keeping the others.
  - **One stage keeps no stage fields.** Back at one stage, the design drops every stage field, so its file is as before staging.
  - **Stability per configuration.** `designStageStability` gives each configuration the rocket flies in:
    - stages 0 to k together, from the whole stack to the top stage alone;
    - the CP of the attached parts (BAR-9, with the design's reference diameter if fixed);
    - the CG with the configuration's bottom stage's motors loaded and spent, the motors above loaded.
  - **The gauges.** The liftoff gauge is unchanged (the whole stack, loaded). For a staged rocket, the burnout gauge shows the top stage alone at its burnout.
- **Why:** The whole stack with every motor spent never flies, so a burnout margin from it would mislead. The configurations are the states that do fly, and the flight's own in-flight margin check still covers the moments between them. Refusing to remove a stage that holds parts keeps every edit reversible and visible.
- **Consequences:**
  - A motor that can never light (for example the sustainer once a booster stage without a motor is added) is a danger in the checks before any flight, once, not repeated by the flight check. A motor too wide for its tube is checked for every stage's mount.
  - The motor view edits one stage at a time.
  - A second motor in one stage (an air start) comes from a file or the MCP server; the app shows the stage's first mount.

## D-101 (2026-10-14): Random designs, and the fixes they found

- **Decision:**
  - **The test.** A property test flies random sensible designs (plan 0065): any nose, one or two stages, any fins, any bundled motor, a parachute, any ordinary pad and wind. Each must survive a file and fly to a finite result without being refused.
  - **Float64 edge cases.** Where a model's formula divides by a quantity that can reach the subnormal numbers (a roll rate decaying to nothing, the first instant off a still rail, a rail tilted by next to nothing), the formula's finite limit is computed instead of ∞ × 0:
    - the rotation axis and `normalise` scale by an exact power of two first;
    - the roll damping is 0 when the dynamic pressure has underflowed to 0 (below 1e-150 N·m in truth).
  - **Rejected trial steps.** A Dormand–Prince trial step whose stages leave a model's range is a rejected step (error ∞), shrunk and retried. If no step works down to the minimum, the model's own error is reported.
  - **0 kg parts.** A mass item or packed parachute of 0 kg is allowed and adds nothing.
- **Why:**
  - Rule 3 and section 8: these designs are ordinary (a calm day, a parachute opening on the way down), yet 25 of 60 failed with messages about internal quantities. That is the program failing, not the design.
  - None of the fixes changes a result where the old code gave one: the golden outputs are bit-identical.
- **Alternatives:**
  - Clamping small values to 0 (a silent change of the state; the exact scaling and the formula's limit are exact).
  - A smaller maximum step for every flight (slower everywhere, and still not a guarantee).
  - Resetting the step after each event (helps at deployments only).
- **Consequences:**
  - 300 random designs fly. 79 of them end at the model limit (unstable or tumbling designs past 90°, D-046): the large-angle flight after that is the next gap (task 5).

## D-102 (2026-10-14): Wedge and high-aspect-ratio fins fly past 90° with a listed approximation

- **Decision:** In the displayed mode the large-angle model (D-070) no longer refuses two kinds of fin set.
  - **A single wedge** (thickest at the trailing edge, outside both DATCOM maximum-lift families) reads the 23b family, whose maximum thickness (35 to 50 % of the chord) is the nearer. Δy is the wedge's own. In reverse flow the wedge leads with its square base and reads 23a exactly, as before.
  - **A high aspect ratio** (A ≥ 4/((C₁ + 1) cos Λ_LE), eq. 4.1.3.4-c) uses the low-aspect-ratio method beyond its range, every chart held at its drawn end with a note, as for any design (D-070 item 9).
  - **Listed.** The result's approximations name the fin set, what is approximated (its normal force beyond the stall, and past 90° when the rocket tumbles), the reason and the effect, impact minor. The chart notes become warnings beyond the stall. (D-103 rates it by the flight: minor below the stall, moderate past it.)
  - **The OpenRocket-equivalent mode** is unchanged: small-angle model, 90° limit, nothing listed.
- **Why:**
  - Rule 3 (D-083): a sensible design must be simulated. The refusal ended the flight at 90°, so a wedge-finned or high-aspect-ratio rocket had no descent, landing point or landing speed. These fin sets caused all 79 model-limit endings among 300 random designs (plan 0065).
  - There is no approved method for either case. The DATCOM has no family for a trailing-edge maximum, and its high-aspect-ratio method needs section maximum-lift data that a flat fin does not have. These readings are the nearest documented ones.
- **Evidence** (plan 0066 section 4):
  - **Random designs:** all 300 now land (291) or reach the time limit (9).
  - **Below the stall:** of 125 affected designs that reached apogee in both models, 118 agree with the small-angle model within 0.5 %. The 7 that differ (−11 % to +17 %) are unstable, overstable or fly at large angles on the climb, where the two approved models already differ (D-070).
  - **The wedge's stand-in:** 23a and 23b give the same α_CLmax and C_Lmax within 0.4 % for typical fins, and 8 % apart (23b lower) for a strongly swept one.
  - **Reference designs:** no reference design has such fins, so the golden outputs and the OpenRocket comparisons are unchanged.
- **Alternatives:**
  - Keep the small-angle model and the 90° stop (a refusal, against rule 3).
  - Use the small-angle model past 90° for these fin sets (the thesis scales its normal force only to 90°, Niskanen §3.4.7, so that would be an undocumented extension too).
  - Read 23a for a wedge (thickest at the leading edge, the farther family).
- **Consequences:**
  - Only flights that tumbled above Mach 1 still ended at the model limit in the displayed mode, until D-103.
  - Rockets with such fins now fly the DATCOM model at every angle, like every other rocket in the displayed mode. Their reported in-flight margin is still the more forward CP of the two models (D-070).

## D-103 (2026-10-14): Tumbling above Mach 1 continues with a listed approximation; the D-102 listing is rated by the flight

- **Decision:**
  - **Supersonic reverse flow.** In the displayed mode, a flight whose angle of attack passes 90° at Mach 1 or above now continues (plan 0067). Beyond 90° the fins keep the force they have at Mach 1 and above below 90°: Niskanen's eq. (3.49), linear in α. It is applied to the reversed fin, as HA-10 does below Mach 1:
    - α′ = 180° − α, times the fin set's own slope at α′, so the normal force is continuous at 90°;
    - the CP is that of the reversed planform (BAR-10), mirrored along the root chord, and the carry-over CP is mirrored too;
    - the body keeps its supersonic reverse-flow model (Jorgensen, D-070).
  - **Listed when used.** A flight that did this lists one approximation on the rocket, impact major: the fin force while tumbling or flying backward above Mach 1, with no sourced method behind it. The aerodynamics warning becomes a flight note.
  - **The D-102 listing rated by the flight.** The wedge or high-aspect-ratio listing is minor while the flight stays below the fins' stall. It becomes moderate once an approximated fin set went past its stall, which the flight knows from the chart notes the model gives only there.
  - **The OpenRocket-equivalent mode** keeps the 90° limit (D-046), the only model-limit end left.
- **Why:**
  - Rule 3 (D-083): this was the last angle-of-attack refusal in the displayed mode.
  - **Why not the sourced method.** DATCOM 4.1.3.3 C (pp. 4.1.3.3-29 to -33) needs seven charts and three procedures by leading-edge and shock condition, and covers 0 to 90° only. It would also change the supersonic force below 90°, including R5's. It stays future work (`docs/future-work.md` item 6); this decision extends the present model consistently.
  - **The ratings.** Major, because the small-angle force over-predicts the fin force near 90° and no source bounds the error. The D-102 listing was minor in every flight, but the rule for minor is "under about 1 % on the key results", which is not shown for a flight that went past the stall of an approximated fin.
- **Evidence:**
  - R1 with 0.1 kg of tail ballast (−1.26 calibers) on a constant 1200 N motor tumbles at Mach 2.35. It now lands in the displayed mode with the approximation listed, and still ends at 90° in the OpenRocket-equivalent mode.
  - At Mach 2 and 120° the fin CP is 0.0631803 m behind the fin's root leading edge, against 0.0590419 m at 60° (BAR-10 by hand on R1's reversed and forward planforms).
  - The golden outputs and the OpenRocket comparisons are unchanged: no reference flight tumbles above Mach 1.
- **Alternatives:**
  - Keep the stop (a refusal).
  - Read the subsonic DATCOM charts at Mach 0.6 above Mach 1, as D-070 does from 0.6 to 1. That has no source either, and the DATCOM's own transonic guidance (4.1.3.3 B) builds the curves from the Mach 1.4 method, not the 0.6 one.
- **Consequences:** in the displayed mode every flight runs to landing or the time limit. The CP jumps at 90° above Mach 1 (forward and reversed planforms differ); the adaptive step handles it, as it does burnout.

## D-104 (2026-10-14): A flipped nose cone is read as a transition to a point

- **Decision:**
  - **The reader.** An `.ork` nose cone with `<isflipped>true` is read as a transition of the same shape, shape parameter, length and wall, from its base radius (`<aftradius>` in the file) to 0. Its base shoulder (`<aftshoulder…>` in the file) reaches forward from the base, as a fore shoulder on a transition (D-084), with its cap at its fore end. Parts inside it are read as in a nose cone, against the reversed profile.
  - **The physics.** GEO-7 accepts an aft radius of 0. The narrowing profile is then the nose profile reversed, the function boat tails already use. Nothing else needed changing: the Barrowman CP becomes V/A_fore, and the base drag has a zero area.
  - **The app.** The transition's aft radius field accepts 0.
- **Why:** rule 3 (D-083). OpenRocket's flipped cone is a tail cone, and the reader refused the whole file for it. OpenRocket gives a flipped cone and a transition to 0 the same mass, CG, CP and C_Nα for all six shapes (FlippedNoseProbe, `reference/rockets/flipped-nose-probe/values.txt`), so this is exact, not an approximation.
- **Evidence:**
  - Our tail is our own nose cone reversed (mass within 1e-9).
  - Against OpenRocket, the conical tail is within 2.3e-7 in mass (the quadrature, D-025). The curved shells are within 0.022 % in mass and 0.0021 % in CG, least good on the blunt tips of the ellipsoid and the power 0.5 series: the first-order wall offset of D-024, as for nose cones.
  - The rocket CG is within 0.003 % and the CP within 0.023 % (tolerances 1 % and 2 %).
  - The base shoulder gives OpenRocket's part mass and CG to 3e-5 and 3e-6.
  - Parts inside a flipped cone are placed as OpenRocket places them: "top" from the cone's front, "bottom" with the part's aft end at the point.
- **Open, found here (not changed by this decision):** in the displayed mode a boat tail's pressure drag is Niskanen's eq. (3.88), a fraction of his base drag coefficient (3.94), while the remaining base uses the DATCOM (D-069), which is lower. A tail cone therefore adds drag there instead of removing it: on R1 with an 80 mm ogive tail at Mach 0.3, +0.092 boat tail against −0.060 base. The DATCOM's own subsonic method (4.2.3.1-a) carries the after-body pressure in its fineness-ratio term and gives a closed body no base drag. Which combination to use is a choice between approved sources. It is to be quantified on the reference rockets and put to the owner if it moves a result beyond its tolerance (CLAUDE.md 1 rule 4). The OpenRocket-equivalent mode is consistent (eq. 3.94 throughout). (Resolved by D-105: kept, on the measured evidence.)
- **Consequences:** flipped nose cones no longer refuse a file. The probe's thirteen files and values are kept as references.

## D-105 (2026-10-14): The boat-tail drag stays Niskanen's eq. (3.88) on eq. (3.94), beside the DATCOM base

- **Decision:** No change. In both modes a boat tail's pressure drag remains eq. (3.88) applied to Niskanen's base drag coefficient (3.94). In the displayed mode the body base remains the DATCOM's (D-069). The side effect is documented in `docs/known-limitations.md`: a short boat tail or tail cone can be charged more than the base drag it removes.
- **Why:**
  - **The alternative.** Option (b) of plan 0069 takes the same fraction of the DATCOM's own blunt-base drag. It is the more consistent construction, and it brings R2 closer to OpenRocket (−0.78 % to −0.13 % in apogee).
  - **The measured data.** It moves the one measured case in `reference/` whose boat tail is short enough for eq. (3.88) to charge it (γ < 3) away from the truth; RM-10 and L8A05 have long boat tails (γ ≈ 12 and 9) that both options leave at 0. The ARCAS forebody drag (TN D-4013, sting mounted, boat tail γ = 1.867) is under-predicted by 8 % rms subsonic and 29 % transonic now; option (b) makes it 20 % and 37 %.
  - **Each piece has its own support.** The DATCOM base has measured support for cylindrical bases (D-069), and the larger boat-tail term has ARCAS. Measurement outranks agreement with OpenRocket, a model.
  - **Not a stop-and-ask item.** The difference is inside tolerance on the reference rockets (R2 +0.66 %, the others have no boat tail), so this is decided here (CLAUDE.md 11).
- **Alternatives:** option (b) above; the DATCOM's own subsonic body method (4.2.3.1-a), whose fineness-ratio term carries the after-body pressure. That would replace Niskanen's body pressure terms as a whole, a larger change for which there is no measured case that favours it.
- **Also corrected (plan 0069 section 5):** two lines of `docs/known-limitations.md` named the wrong side as safe for altitude limits. An under-predicted apogee is the unsafe side for an altitude limit; an over-predicted apogee is the safe side, though an ejection delay chosen from it may fire after apogee.
- **Consequences:** none in the results. The open item of D-104 is closed. More measured boat-tail data, if added to `reference/`, would reopen it.

## D-106 (2026-10-14): Pod sets are parts repeated around the axis, each counted once per pod

- **Decision:** a placed part may carry `instances: { count, radialOffset }` (GEO-18): n copies equally spaced around the axis at that distance, the parts of a pod set.
  - **Outside the main body.** Such parts are not part of the main body's stacking, continuity, caliber, length, base or DATCOM body assembly. Each pod set (parts sharing a count and offset) is a body of its own, checked for fit like the main one except that it need not start at the nose tip.
  - **Mass.** n m at the part's CG. The roll inertia gains n m r², the pitch inertia n m r²/2.
  - **Normal force.** Every term × n: the Barrowman terms, the body lift, the DATCOM large-angle terms. The main body's reverse-flow potential term does not include the pods.
  - **Drag.** Every pressure and fin term × n on the part's own area; the pods' surfaces in the friction; each pod set's base on its own geometry, by the method in use.
  - **Damping.** Each pod body's pitch damping and its fins' × n. The pod fins' roll damping is taken about their own pod's axis.
  - **Listed in every result.** The flow between the pods and the body (moderate); a single pod's CG off the axis (moderate); the mean inertia of two pods (minor).
- **Why:** rule 3 and CLAUDE.md section 2 ask that podded designs be simulated. The pod probe (`reference/rockets/pod-probe/values.txt`) shows OpenRocket computes each pod part on its own, scaled by the count, so this model reproduces it without its source.
- **Evidence:**
  - **Static figures.** The mass and CG match OpenRocket exactly, and the C_Nα exactly (23.414484 with finned pods). The CP is within R1's own 0.016 %.
  - **Inertias.** The roll inertia the pods add matches exactly (0.23 % with pod fins). The pitch inertia matches exactly for three pods. For two, OpenRocket reports Iyy = Izz without the pods' offset, whereas the true pitch and yaw inertias differ by 2 m r²; our value is their mean.
  - **Drag at Mach 0.3.** The base drag matches exactly and the pressure drag within 1e-4. The friction is within R1's own +1.4 %, and the total within 0.65 %.
  - **Flights on a D12-5.** Apogee is +1.1 to +1.7 % and maximum velocity +0.6 to +0.8 %, the pods no worse than R1's airframe alone.
- **Alternatives:** stand the pods in as masses, as the reader did (no drag or normal force: a large error); model pods as extra fins (not what they are).
- **Consequences:**
  - The physics simulates pod sets. The design model, the `.ork` reader and the app follow in plan 0070 step 3, motors in pods in step 4, booster sets in step 5.
  - Results without pods are unchanged: the golden outputs and the OpenRocket comparisons are bit-identical.

## D-107 (2026-10-14): Pod sets in the design file and the `.ork` reader, placed as OpenRocket places them

- **Decision:**
  - **Design file.** A part may carry `pod: { count, radialOffset }`, the physics' `instances` (D-106). Schema version 3; a version-2 file migrates unchanged, as it has no pods. The count is a whole number of 1 or more, the offset 0 m or more.
  - **Where a pod set is read.** On a body tube, the only part OpenRocket lets hold one (`reference/rockets/pod-probe/positions.txt`). Its parts are stacked from its front like a stage's, each tagged with the count and offset.
  - **Its front** is read like any child of the tube; its length is the sum of its parts' lengths.
  - **The distance of each pod's axis from the rocket's**, from `<radiusoffset method>`, with R the tube's radius and r_pod the largest radius of the pod's body parts:
    - "coaxial": 0, whatever the value;
    - "surface": R + r_pod, whatever the value;
    - "free": |v|;
    - "relative": |R + v + r_pod|. A negative distance is the same ring of pods turned half a turn.
  - **A parachute or streamer in a pod** is one per pod: its recovery device is repeated n times, named "(pod k of n)".
  - **Not read yet.** A motor in a pod is refused until plan 0070 step 4 models it, so that it is never lost. A pod set inside a pod is left out and listed as major.
  - **The app** says on each pod part how many pods hold it, and in its editor how far out they are.
- **Why:** rule 3; the probe fixes every rule above exactly. The front and distance of every probe file match OpenRocket to 1e-12. The three rockets of D-106 read from their files give OpenRocket's mass and CG within 1e-6, its C_Nα to rounding and its CP within 0.05 %. With the parachute in the pods, the mass, CG and descent show one parachute per pod: 4.623 m/s computed for two against OpenRocket's 4.623, and 6.538 for one.
- **Alternatives:** a pod set as a separate design object holding its parts (a larger schema change, for no gain while the parts carry their own count and offset); the pods' radius from the first or last part (the probe's mixed pods rule both out).
- **Consequences:**
  - A file with pod sets now imports and simulates, unless a pod holds a motor.
  - Two pod sets with the same count and distance are one body to the fit check, so pods one behind the other at the same distance are refused there (a gap).
  - The side view and the 3D view still draw pod parts on the axis. That work belongs to the UI and 3D lanes, through issues.

## D-108 (2026-10-14): The comparison mode keeps OpenRocket's whole base and computes rail buttons as OpenRocket does

- **Decision:** in the OpenRocket-equivalent mode:
  - **Base.** The base drag keeps the whole base, thrusting or coasting (`baseDragMotorRule: 'never'`); the motor's area is not removed. This replaces D-035's `'always'` and D-086's one motor of a cluster in that mode.
  - **Rail buttons.** Their drag is OpenRocket 24.12's, measured as a black box (DRAG-23, `railButtonDragMethod: 'openrocket'`).
  - **The displayed mode is unchanged:** the source's base rule (the thrusting motors' area removed, N09 p. 51) and Niskanen's rail pins (DRAG-12).
- **Why:** plan 0071.
  - **OpenRocket's base.** OpenRocket 24.12's base term is the whole base, both in its static calculation and in its flight data: identical thrusting and coasting, and identical with motors in the core, the pods or both. D-035's reading, a coasting drag lower than ours by the motor's share, came from other differences that happened to cancel. The largest was our rail button drag, 6 to 10 times OpenRocket's.
  - **Owner's choice.** The owner chose option (c) of plan 0071: copy OpenRocket's rail button drag in the comparison mode.
  - **Evidence for the table.** The structure is exact in the probe, and the table reproduces OpenRocket within 0.82 % on 80 buttons held out of it.
- **Results:**
  - **Flights.** The comparison mode's flights now agree with OpenRocket within 1.2 % in apogee on R1 to R5 (−0.16 to −0.51 % without wind; before −2.42 to +2.48 %) and 0.41 % in maximum velocity.
  - **Static drag.** It agrees within 0.4 to 0.7 % on R2 to R5. R1 is 1.2 % above because of its launch lug.
  - **The one difference left above tolerance:** `staged-hpr`'s maximum velocity (−4.3 %), wholly from OpenRocket's tangent ogive nose drag below Mach 1 (plan 0071 section 6), which is not copied.
- **Alternatives:**
  - (a) Keep `'always'` with a corrected explanation: rejected, since it hides two real differences behind each other.
  - (b) A sourced boundary-layer protuberance model in both modes: not chosen now; it needs a source (Hoerner chapter 8, or the Missile DATCOM protuberance method) and remains the way to improve the displayed mode.
  - Fitting a closed form to OpenRocket's figures: no form tried was exact (best 3 to 6 %), so the measured table is used.
- **Consequences:**
  - The comparison mode's results change, the displayed mode's do not. The golden R1 comparison apogee goes from 168.866 to 166.187 m (OpenRocket 167.045 m).
  - The displayed mode's rail button drag stays Niskanen's, 6 to 10 times OpenRocket's. Which is closer to reality is open: no measured rail button data is in `reference/` (known limitations).
  - OpenRocket's nose pressure drag differences are recorded for the validation campaign and the list of OpenRocket issues.

## D-109 (2026-10-14): Validation corrections: TN D-3182 model A's fins and drag basis; Blue Scout's CP at angle of attack

- **Decision:**
  - TN D-3182 model A's fins are modelled to the drawing: span and sweep 4.95 in, a 1.37 in mean trailing edge (a 10° included-angle wedge).
  - Its C_A is compared with our forebody drag, as the report defines it.
  - Blue Scout's measured CP at angle of attack is taken from the fins-on configuration D (figure 7(b)). D-070's comparison is corrected and its choice kept.
  - The stale validation statements in `docs/known-limitations.md` are replaced with current figures (plan 0072).
- **Why:** plan 0072. Each finding was checked against the report page:
  - TN D-3182 figure 1, Table I and page 2.
  - TN D-1958 figures 7(a) and 7(b), PDF pages 28 and 29.
- **Results:**
  - **TN D-3182.** CP rms is 4.1 % of body length (was 5.7 %), C_Nα −12 % (was −17 %), forebody drag −16.7 % mean (was −21 % against the total). Held-out supersonic CP rms is 3.1 % (was 3.8 %), C_D rms 15.0 % (was 16.4 %).
  - **Blue Scout.** It moves its CP forward by about 0.03 body lengths to 6°. Both models over-predict that (conservative), the DATCOM model less.
- **Consequences:** no physics change. The supersonic regime warning quotes the new figures. The open measured gaps (drag just above Mach 1, wedge-fin drag) are recorded in the known limitations, with their safety direction.

## D-110 (2026-10-14): Each part's surface finish, read from `.ork` files and summed in the skin friction

- **Decision:**
  - A part may have its own surface finish, a roughness height, when it differs from the design's (design file schema 4).
  - With parts of several finishes the skin friction is the sum over the surfaces, each with its own C_fc. Eqs. (3.78) to (3.84) give it at the surface's own R_s, with the rocket's length in eqs. (3.79) and (3.80). Eq. (3.85)'s body and fin factors apply to each surface.
  - The DATCOM base drag takes the body's wetted-area mean C_f.
  - A roughness of 0 is a smooth surface (eq. 3.78 alone).
  - The `.ork` reader reads every nose cone's, body tube's, transition's and fin set's `<finish>`. Each name is mapped to OpenRocket's own roughness height:
    - rough 500 µm;
    - rough unfinished 250 µm;
    - unfinished 150 µm;
    - regular paint 60 µm;
    - smooth paint 20 µm;
    - optimum paint 5 µm;
    - aircraft sheet-metal 2 µm;
    - finished/polished 0.5 µm;
    - mirror 0 µm.
  - The design's finish is the one most of those parts have; a part with another finish keeps its own.
  - A part that names no finish has OpenRocket's default, regular paint.
  - A name the app does not know is flown as regular paint and listed (moderate).
- **Why:**
  - **The gap.** The validation campaign found the finish ignored without a listing (rule 3), moving the apogee −13 % to +14 % on the six rockets that had another finish (plan 0073). Two of OpenRocket's own example files mix finishes.
  - **The thesis.** It gives one roughness for the whole rocket. The friction force is additive over the surfaces (eq. 3.77), so applying its C_f method to each surface at its own finish is the same method, not a new equation. With one finish it is eq. (3.85) exactly, and the code then takes the old path, so every existing result is unchanged to the bit.
  - **OpenRocket.** OpenRocket 24.12 computes each part's friction at its own finish (`FinishProbe`, `reference/rockets/finish-probe/values.txt`). The roughness heights are its definitions of its own file values, read as the file format, and five of them are Niskanen's Table 3.2 or Figure 3.10 values.
- **Results:**
  - Our friction on the 14 probe rockets (nine finishes, mixed, and each part rough in turn) at Mach 0.1 to 1.5 is 1.24 to 1.46 % above OpenRocket's. That is the regular-paint offset within ±0.11 %, and the offset is the friction form factor (campaign item 7).
  - The reference rockets and golden outputs are unchanged (all regular paint).
- **Consequences:**
  - The MCP part editor now keeps a part's own finish, and its pod set, which it had dropped (plan 0070).
  - The app cannot yet set a finish, for the design or a part (plan 0073 part 1b).

## D-111 (2026-10-14): Streamers, by Niskanen's Appendix C

- **Decision:**
  - A recovery device is a parachute or a streamer, in the physics and in the design file (schema 5). A streamer is a strip of length l and width w of a material of surface density ρ_m.
  - Its drag is C_D on the strip area w l. C_D is Niskanen's eq. (C.6) (STREAM-1) unless the user gives one.
  - The OpenRocket-equivalent mode caps the automatic C_D at 0.4, as OpenRocket 24.12 does; the displayed mode does not.
  - A streamer whose C_D comes from eq. (C.6) and whose strip lies outside the measured ones is listed (moderate). The measured strips are about 0.2 to 1 m long and 0.02 to 0.09 m wide (Figure C.1, read from the plot) and 10 to 80 g/m² (Table C.1).
  - **`.ork` reader.** It reads `<streamer>`. Its packed mass, without an override, is the strip area times the material's surface density. `<cd>auto</cd>` means eq. (C.6).
  - **App and MCP.** The app adds and edits streamers; the 3D view does not draw them yet. The MCP's `set_recovery` takes a `streamer` and surface densities in kg/m², g/m² or oz/yd².
- **Why:**
  - **The gap.** The validation campaign found a streamer stood in as "left out: the file gives no mass for it". That was wrong, and the rocket fell ballistically (49 against 23 m/s at the ground). Streamers are the usual recovery of small model rockets.
  - **The source.** The thesis's Appendix C is the approved source. Its equation reproduces Table C.2's five estimates to their printed digits.
  - **OpenRocket.** OpenRocket 24.12 implements eq. (C.6) exactly below its 0.4 cap: ten strips, `FinishProbe` part 3. The cap is OpenRocket's own and is not in the thesis. It only binds for strips shorter than about 0.1 m, far outside the measured ones, so the displayed mode follows the thesis and lists such a strip.
  - **Imperial unit.** The oz/yd² factor is NIST SP 811 B.8 p. 52 (3.390 575 E−02 kg/m²), from the exact ounce and yard.
- **Results:**
  - On the ten probe strips the mass, structure mass and CG agree with OpenRocket to 1e-6, and the C_D exactly (or at the cap).
  - The example rocket on a 0.6 × 0.06 m, 80 g/m² streamer lands at its closed-form terminal speed within 1 %: √(C_D A ratio) = 4.16 times the parachute's.
- **Consequences:** none for any existing design or golden output: they all use parachutes.

## D-112 (2026-10-14): Rail buttons past the body's end, the RK4 step advice, and the airfoil fin mass rating

- **Decision:**
  - **Rail buttons past the body's end.** When an `.ork` file places rail buttons past the end of their body, the import moves the set forward until its last button sits one button diameter inside the end. If the set is longer than the body, its spacing is shortened between one diameter inside each end. This is listed (minor). A button typed past the body's end in the app is still an input error with what to fix.
  - **RK4 step advice.** The RK4 refusal and warning advise a time step rounded down to two significant figures, never up.
  - **Airfoil fin mass.** The slab mass of airfoil fins (D-077) is rated moderate; rounded fins stay minor.
- **Why:**
  - **Rail buttons.** OpenRocket accepts such files and counts the buttons where they are; the validation campaign met one, and the stability refused it (rule 3). Moving the set is the smallest change that puts every button on a body the models cover. Its effect, a few grams counted a little further forward, is minor.
  - **RK4 step.** The campaign saw a refusal advise "at most 0.0020 s", the very step it refused, because the safe 0.00199 s was rounded up.
  - **Airfoil fins.** The campaign measured the airfoil slab at up to 8.5 % of the structure mass, moving its CG up to 3.4 % aft, which is more than "minor" describes.
- **Consequences:** a design with airfoil fins and nothing else approximated now reports medium confidence instead of high.

## D-113 (2026-10-14): Fin fillets, by plane geometry (GEO-19)

- **Decision:**
  - **The model.** A fin set may have fillets along both sides of each fin's root, of a radius and their own material (design file schema 6). Their mass, CG and inertias come from the exact plane geometry of GEO-19 along the root chord, and they add no aerodynamic force.
  - **`.ork` reader.** It reads `<filletradius>` and `<filletmaterial>` instead of listing the fillets. A file with fillets but no fillet material takes OpenRocket's default, cardboard at 680 kg/m³, and lists it (minor).
  - **MCP.** It sets them as a fin set's `fillet` field.
- **Why:**
  - **The gap.** The validation campaign found fillets left out and listed as minor. On one rocket they were 15 % of the fin mass: the structure mass was 2.5 % low and its CG 2.8 % forward, which overstates the stability margin (the unsafe side).
  - **What OpenRocket does** (`FilletProbe`, 17 cases).
    - Its fillet volume is the region between a radial plane, the body circle and a tangent arc, along the root chord, two per fin, to 7 digits, for every planform.
    - The fin thickness does not enter.
    - Its drag and CP are unchanged by fillets.
  - **Inertias.** Our inertias are those of the geometry. OpenRocket keeps the fins' unit inertia and scales it by the new mass, a small difference in the fin set's inertia.
- **Results:**
  - Against the 17 probe cases, the fin set mass is within 1e-7 and its CG within 1e-9 m. For elliptical fins it is the fillet's own mass, because OpenRocket's elliptical plate is a polygon 0.18 % short of the ellipse (D-087).
  - The fillet's cross-section polar moment agrees with a numerical integral to 8 digits.
- **Consequences:** none for existing designs, which have no fillets.

## D-114 (2026-10-14): RASAero II as a black-box comparison, and the `.CDX1` importer

- **Decision:**
  - **The owner's instruction overrides CLAUDE.md 6.7 in one point.** RASAero II is run as an automated reference simulator. Section 6.7 forbade it because RASAero "is Windows-only and cannot be run headlessly". On 2026-10-14 the owner asked for "extensive and exhaustive testing against our source, rasaero and openrocket", then: "you will find a way to compare to rasaero yourself".
  - **How.** RASAero II 1.0.2.0 runs under Wine 9.0 and wine-mono 8.1.0 on a virtual display, driven by our own script (`reference/rasaero/`). Its re-runs of its 24 example designs give the apogees its authors saved on Windows within 0.0008 %.
  - **What stays from section 6.7.**
    - Nothing of RASAero's methods is reproduced or reverse-engineered, and no constant is tuned to its results.
    - Its program and files are not committed: a script downloads them with a pinned SHA-256.
  - **The `.CDX1` importer** (section 6.7 item 3, plan 0075) reads RASAero's design files:
    - **Geometry.** Nose, body tube, fin can, boat tail and boosters, by the manual's definitions.
    - **Masses.** The file's lift-off weight and CG are reproduced exactly: per stage, as the stack's for a booster (confirmed by RASAero's own flight output).
    - **Staging and site.** The staging delays, recovery, launch site and motor (matched in the library).
    - **Approximations,** listed (rule 3):
      - hexagonal fins as a double wedge;
      - the rail guides' place;
      - nominal part masses scaled to the file's;
      - a blunt nose tip as pointed;
      - the nozzle exit diameter not used;
      - a nested stage's overlap.
- **Why:** the owner's instruction; a black box in the container is the only way to compare without the authors' cooperation.
- **Results** (`docs/reports/rasaero-comparison.md`):
  - **The trajectory.** Our simulator flown on RASAero's own drag curve matches RASAero's apogee within 1.4 % below Mach 0.95. The trajectory, mass, motor and atmosphere handling agree.
  - **The drag.** At Mach 0.3 our displayed C_D is 9 to 41 % below RASAero's on 21 of the 23 single-stage designs, and 4 and 10 % above on the other two (IonDrive, Full Metal Jacket 2).
  - **Against the 21 flights with measured apogees.** Our displayed apogee is +18.9 % mean below Mach 0.95 and +29.0 % above; every flight was lower than predicted. RASAero's is +0.4 % and +3.9 %.
  - **Term by term.** The body friction and base agree. The difference is the fin friction's Reynolds length (Niskanen eq. 3.85 against DATCOM eq. 4.1.5.1-a), fin-body interference (ignored by Niskanen p. 41), the body form factor, and the rail guides (3 times ours).
- **Not decided here (CLAUDE.md 11 (a) and (b)):** the drag model changes. Two have a source in `reference/` but conflict with Niskanen by more than a test tolerance; two need a source not in `reference/` (Hoerner chapter 8). They are put to the owner in the report's section 7, with the measured effect of each. Nothing in the model was changed.
- **Consequences:**
  - The app imports `.CDX1` files (File menu, "Import RASAero"), and shows RASAero's predicted apogee and the flown one when the file gives them.
  - `known-limitations.md` records the apogee over-prediction against flights.
  - `openrocket-issues.md` item 6 records the same finding for OpenRocket, from our OpenRocket-equivalent mode.

## D-115 (2026-10-14): The DATCOM body form factor in the displayed mode; the fin friction at the fin chord made selectable

- **Decision (plan 0076):**
  - **Body form factor.** The displayed mode multiplies the body's skin friction by the DATCOM's 1 + 60/f_B³ + 0.0025 f_B (eq. 4.2.3.1-a, DRAG-25) instead of Niskanen's 1 + 1/(2 f_B) (eq. 3.85). The OpenRocket-equivalent mode keeps Niskanen's, as OpenRocket does. `dragCoefficient`'s default is the displayed mode's, as for the base drag (D-069); tests that mean the comparison mode name `bodyFormFactor: 'niskanen'` beside `baseDragMethod: 'niskanen'`.
  - **Fin friction at the fin chord.** Each fin set's C_fc at the Reynolds number of its own mean aerodynamic chord (the DATCOM's reference length for a lifting surface, eq. 4.1.5.1-a; DRAG-24) is implemented and selectable (`finFrictionLength: 'fin-chord'`), but the default stays the rocket's Reynolds number (eq. 3.85).
- **Why:**
  - **The owner's instruction.** "Fix any obvious gaps", and differing from OpenRocket and RASAero is accepted where we are more accurate, with the reasoning (2026-10-14).
  - **The rule set in plan 0076 before measuring.** A change is adopted only if it is not worse on either independent measured dataset: the 21 flown rockets of D-114, and the held-out wind tunnel and free-flight drag of D-061.

    | Displayed mode                | Flights below Mach 0.95 (mean apogee error) | Held-out C_D rms: subsonic | transonic | supersonic |
    | ----------------------------- | ------------------------------------------- | -------------------------- | --------- | ---------- |
    | Niskanen eq. (3.85) (before)  | +18.9 %                                     | 7.1 %                      | 21.3 %    | 15.0 %     |
    | DATCOM body form factor       | +17.7 % (above Mach 0.95: +29.0 → +26.7 %)  | 6.1 % (target 7 %, met)    | 21.2 %    | 14.9 %     |
    | Fin friction at the fin chord | +15.5 %                                     | 6.4 %                      | 19.9 %    | 15.5 %     |
    | Both                          | +14.3 %                                     | 8.2 %                      | 20.2 %    | 15.6 %     |

  - **The body form factor** is better on both datasets in every regime and is adopted.
  - **The fin chord** is better on the flights and in two regimes of the held-out data, but worse in the supersonic one; with the form factor it overshoots the subsonic held-out drag. It is not adopted by the rule.
- **Conflict recorded for the owner (CLAUDE.md 11 (a)).** Niskanen and the DATCOM differ in both terms by more than a test tolerance.
  - **The form factor** is adopted on the evidence above, as D-069 adopted the DATCOM's base drag. Niskanen's is one option away.
  - **The fin chord** is the owner's decision. The physical case for it is that a fin's boundary layer starts at the fin's own leading edge. The case against it here is the held-out supersonic data.
- **Consequences:**
  - **Displayed-mode figures fall slightly.** The example rocket's apogee goes from 172.94 to 172.41 m (−0.31 %) and its maximum velocity from 63.0 to 62.9 m/s.
  - **Unchanged:** the OpenRocket-equivalent mode and every golden output (they use it).
  - **Found on the way.** An MCP test built its expected flight from a design whose parts all had the id "y", so its motor mount resolved to the nose cone. It now gives each part its own id. Design files already refuse duplicate ids.

## D-116 (2026-10-14): Writing designs as RASAero II files; R1 to R5 in three simulators

- **Decision (plan 0077):**
  - **The writer.** `exportCdx1` writes a one-stage design as a `.CDX1` file, the inverse of the importer: a nose cone, one body tube, one trapezoidal fin set, an optional boat tail, rail guides, a lug, the finish as RASAero's nearest class, the site, up to two parachutes, the motor, and the lift-off weight and CG.
  - **Refusals.** What RASAero cannot hold is refused with what to change: stages, pods, a step in diameter, non-trapezoidal fins, a nose shape RASAero lacks, no motor. What is mapped is listed.
  - **Where it is offered.** The app's File menu ("Export RASAero") and the MCP's `export_design` (`format: "cdx1"`).
- **Field names.** Section names no example file uses ("Double Wedge", "Single Wedge", "Biconvex", "Subsonic NACA") were confirmed from RASAero's own program's string table. That is format discovery, the same as reading its files (CLAUDE.md 3 allows reading a file format to build an importer); nothing of its methods was read.
- **The three-way comparison.** Our motor files go into RASAero's motor list under names of their own, so all three programs fly the same thrust curves; RASAero's manual allows adding motors (p. 93). Each exported file is read back, so our simulator flies RASAero's exact inputs.
- **Results** (`docs/reports/rasaero-comparison.md` section 9):
  - **CP.** Ours agrees with RASAero's within 1.3 mm on all five rockets.
  - **R1 (launch lug).** The three programs agree within 3 %.
  - **R2 to R5 (rail buttons).** RASAero's apogee is 10 to 27 % below OpenRocket's. Its rail guide drag, about 3 times Niskanen's and 20 to 30 times OpenRocket's, explains 43 to 84 % of the C_D gap. It decides the most on minimum-diameter rockets, where two guides have up to a quarter of the body's frontal area.
- **Also fixed.** `run-rasaero.sh` failed with a relative output folder: it wrote Wine's log there after changing into RASAero's folder. It now resolves both paths first.
- **Not done:** ARCAS in RASAero (plan 0077 section 4). Its RASAero model would carry its authors' modelling choices more than their methods.

## D-3D-3 (2026-10-14): The replay's sky, ground and trees are photographic (CC0), drawn without a post-processing pass

- **Decision:** Plan 3d-0002, after the owner found 3d-0001 not lifelike enough. All new assets are CC0 from Poly Haven, listed with their sources and processing in `packages/viewer/assets/ASSETS.md` (scripts in `packages/viewer/scripts/`, not part of the build), about 3.2 MB, loaded only when the 3D replay is shown and shared by every scene of the page. (1) Sky: the photograph "Kloofendal 48d Partly Cloudy (Pure Sky)" is the visible sky, shown as photographed (not tone-mapped again); its HDR, with the sun's disc clamped out and a grass-coloured bounce below the horizon (a pure-sky HDRI holds a mirror image there), lights the scene (PMREM); the directional sun stands where the photograph's sun is (u = 0.5952, elevation 47.8°, measured from the HDR), the photograph turned so the sun is in the south-east (−45° from east) and the default cameras see the rocket side-lit; the haze and the fog take the photograph's colour just above the horizon (#979cab). (2) Ground: the photo scans give brightness detail and a grass palette gives the colour, because the field scan's mean colour is a dry orange (linear 0.17, 0.12, 0.03); the field scan (15 m per tile) is mixed with a turned copy at 2.7 times the scale; close-up blades (2 m) fade out from 12 m to 60 m; from 30 m to 600 m the scan's detail fades into a patchwork of greener, lusher and drier grass at 40 m to 700 m so no repeat shows; a quarter of the scan's own colour shows close up; rocky scan (90 m) on the hills; a scorched patch at the pad. (3) Trees: billboards of offline renders of photo-scanned models (`fir_tree_01` split into three firs, `island_tree_02`, `tree_small_02`), an albedo and a normal image each, lit in the scene per pixel by the same sun and sky; the bake's albedo is scaled by 3.2 (mean luminance 0.035 to 0.11); broadleaf scans (3.4 to 4.6 m young trees) are drawn 2.2 to 3.2 times, firs 0.75 to 1.15 times; still only outside the flat radius (D-3D-1). (4) No post-processing composer: rendering straight to the screen keeps the photograph and the fog matched pixel for pixel and costs far less; the flame's glow is an additive halo instead of bloom. If the assets fail to load, the plain scenery stays and the app says so.
- **Why:** A photograph is the most reliable way to make a sky, a field or a tree read as real; CC0 means no licence terms to carry. Matching the sun light to the photograph's sun is what keeps the picture coherent.
- **Consequences:** The assets are binary files in the repository (3.2 MB). Replacing one means rerunning its script and updating `ASSETS.md` and, for the sky, the constants in `scene/sky.ts`.

## D-3D-4 (2026-10-14): The rocket, its motor and its launcher are drawn from the design; the user picks a paint scheme

- **Decision:** (1) Motor: one case per motor of the mount (a cluster's offsets included), from the motor definition's diameter and length, its aft end at `designMotor`'s aft end (the mount's aft end plus the overhang); Estes, Quest and Apogee motors (by the manufacturer's name) have a paper case and a clay nozzle flush with the case, others an aluminium case and a graphite nozzle protruding 0.2 d (drawing proportions); one flame per nozzle, exit radius 0.3 d. A single motor on the axis opens the aft face of the aftmost body part to the motor mount (radius 1.04 × the motor's), with the mount tube's inner wall down to a recessed motor. (2) Fins: lofted with the design's cross-section, drawn as square (full thickness), rounded (semicircles of radius t/2 at both edges), airfoil (the NACA 00xx thickness form scaled to t at 30 % chord), wedge (sharp leading edge to full thickness at the trailing edge) or double-wedge (full thickness at mid-chord); square keeps the flat plate. These are drawing shapes for the section names, not aerodynamic data. (3) Rail buttons turned to their base, shaft and flange dimensions; launch lugs hollow, with their bore. (4) Launcher: a design with a launch lug gets a steel rod through the lug, 90 % of the lug's bore; one with rail buttons gets a 1010 (25.4 mm) aluminium T-slot rail for buttons up to 12 mm across or a 1515 (38.1 mm) above, its face 0.5 mm above the buttons' base; neither gets a 1010 beside the body; plus a tripod, a blast deflector and igniter leads that hang from each nozzle until the stored liftoff (or rail exit) and then lie on the deflector. (5) The ground is now drawn 2 cm (deflector gap) plus 12 cm (launcher base height) below the rocket's lowest point at rest, superseding D-3D-1 (1)'s 2 % of the length. (6) Paint: the design stores no colours, so the viewer offers schemes (gloss red, white and black; gloss black and orange; carbon fibre; bare fibreglass; unpainted kraft tube and balsa; grey primer), remembered in the browser (`lofi-viewer-paint-v1`); textured finishes are generated in code and keep their real size round the body (carbon weave 25 mm, glass weave 30 mm, kraft seam pitch 60 mm, balsa 80 mm).
- **Why:** The owner asked for the rocket "matched to specs". Every dimension drawn comes from the design or the motor file; the few that are not in the design (nozzle shape, rod size, rail size, colours) are recorded here as drawing choices.

## D-3D-5 (2026-10-14): Real-world terrain reaches the horizon with the Earth's curvature and four imagery levels

- **Decision:** The map terrain (D-3D-2) is one polar grid about the pad, finest at the pad, out to 120 km, so real mountains stand on the horizon; z = drawn ground + (elevation − elevation at the pad) − r²/2R with R = 6371 km (the small-angle drop, within 0.01 % to 120 km; 7.85 m at 10 km, 1130 m at 120 km), so the far ground falls below the horizon as it does. Imagery comes in up to four levels, finest first, each sampled where it holds the point and blended over its last 4 %: half-sizes max(400 m, 1.6 flat radii) at up to 6 × 6 tiles, four times that at 4 × 4, max(8 km, 4 flat radii) up to 40 km at 6 × 6, and 120 km at 4 × 4; a level no sharper than the next is skipped. Elevation: a fine grid over the outer level (up to 6 × 6 tiles, zoom ≤ 15) and a coarse one to 120 km (4 × 4), blended over the fine grid's last 10 %. Close to the camera (8 m to 45 m) the grass scan adds brightness detail so the imagery is not a smear; the imagery's saturation is lifted by 18 % against satellite haze. The haze hides the ground towards 132 km. About 100 imagery tiles and 50 elevation tiles per site, cached as before. The flat-ground warning (D-3D-2) is unchanged and still measured under the stored positions.
- **Why:** The owner's reference shows real mountains around the field; a horizon that ends at the edge of a square, or that does not curve away, reads as a model.

## D-3D-6 (2026-10-14): The 3D scene is built after the figures paint and drawn only when something changes; stacked labels are merged

- **Decision:** (1) Issue #61: the replay's event list and readouts come from the stored result directly (`eventMarkers`, `readoutsNearest`), so they render with the flight's figures; the three.js scene is built in the next task, with a "Preparing the 3D view…" note meanwhile. Measured in a GPU-less Chromium on the example flight: the figures are painted 275 ms after "Simulate flight" (as on `main`), the 3D view about 1 s after. (2) Frames are drawn only when the replay time moves, the camera moves, the view resizes or the scenery changes; a paused replay costs nothing. One frame adds at most 0.25 s of wall-clock time to the replay (`MAX_FRAME_STEP`): the first drawing of new shaders can stall a GPU-less page for seconds, and that stall must not jump a replay started just after it (seen in CI: 1.7 s of flight after half a second at half speed). (3) A software renderer starts in the low-detail mode (half resolution, no shadows, a quarter of the trees, no inset); slow frames switch to it as before. (4) Issue #29: labels whose anchors fall within 90 × 18 pixels of an earlier kept label are folded into it ("Launch 0.000 s · Liftoff 0.036 s · Landing 31.276 s"), events in time order first, then the pad and the wind; distance-scale and compass labels are only hidden when they collide.
- **Why:** The flight's numbers must never wait for a picture; labels on top of each other cannot be read.

## D-117 (2026-10-14): ThrustCurve.org searches keep motors with data files by their own count; a new motor's delay is chosen, never reset silently

- **Decision:**
  - **Search (issue #8).** The `hasDataFiles` criterion is no longer sent. The API documents it (swagger.json, SearchRequest), but the live service answered it with 0 matches whatever the other criteria. Each result's `dataFiles` count selects the motors that can be flown; the rest are counted and said, never listed. This supersedes D-093's "Search asks only for motors with data files" for both the app and the MCP server, which gets a `without_data` count.
  - **Delay (issue #10).** When the motor changes, the delay is kept if the new motor offers it, else the nearest offered delay is taken (ties to the longer). With none before, the shortest above 0 s is taken. Each change, a plugged motor and a file without delays are said under the delay field.
- **Why:** CLAUDE.md 1 rule 3: nothing changes without appearing to the user. The delay decides when the parachute comes out; a silent 0 s turns a normal flight into a deployment at full speed. On a tie the longer delay is the gentler one: before apogee the rocket is slowed by gravity and drag together, so at equal times from apogee it is faster before than after.
- **Alternatives:**
  - Keep sending `hasDataFiles` and fall back when the answer is empty (rejected: two requests, and an empty answer is also a real "no motor").
  - Take the delay nearest the coast time to apogee (OpenRocket's optimum delay; rejected for now: it needs a flight per motor, and the user still chooses).
- **Consequences:** No physics changes; no golden output changes. The other open review findings follow in their own pull requests (plan 0078 section 4).

## D-118 (2026-10-14): The MCP server builds and flies a pasted design in one call; what was left out is listed after, not asked first

- **Decision:** Plan 0079, on the owner's request ("i dont like the way you have to fill in everything, i want the claude mcp to bypass everything if you paste the info into the chat").
  - **The instructions** tell Claude to build and fly a pasted specification or file at once, without asking questions first. It gives exactly what the user gave. The must items, the fields not given, the largest approximations and the confidence come with the result, then an offer to refine. This supersedes the workflow of D-092 (ask for what is missing before estimating; clear every must item before simulating).
  - **`build_and_fly`** takes the whole design in one call:
    - the parts, built by the same `addPart` as `add_part`, so every default is recorded the same way;
    - the motor by its written name;
    - the recovery, the launch, the weighed mass and CG, and Claude's estimates.

    A step that fails names itself ("part 2 (Body tube): …") and keeps nothing.

  - **Motor names** are read as NAR/TRA codes: "D12-5", "G80-7T", "H128W-14A", "1/2A6-2", "C6-P".
    - **Matching.** The library is searched first. A manufacturer written in the name must match: another maker's motor with the same code is never used in its place.
    - **ThrustCurve.org.** If the library has no match, the catalogue is searched by the common name, and only an exact, unambiguous designation is downloaded. So three tools now reach the network (D-093 named two), all through the same bounded, read-only transport.
    - **Not found.** A motor that cannot be found or reached never fails the call: the stability is returned, with why the rocket was not flown.
    - **Delays and mounts.** A delay written as letters ("-M") is not a time and stays not given. A mount not given is the aftmost inner tube, otherwise the aftmost body tube, and is listed.
  - **`import_design`** also reads RASAero II `.CDX1` text, and `simulate: true` returns the stability and the flight with the import.
  - The server lists 25 tools (D-094 recorded 22; two were added since, and this one).
- **Why:**
  - **The owner's request.** Asking for every value before any number appears made the tool slow to use.
  - **Rule 3 still holds** (CLAUDE.md 1): nothing is silent. Every default and estimate is listed with its effect and the confidence, after the result instead of before it.
  - **Motor names.** Reading a motor code in the server, not in Claude's head, removes a step where a wrong motor could slip in.
- **Alternatives:**
  - Free-text parsing in the server (rejected: it would need a language model in the server, a cost and an attack surface; Claude already reads the paste).
  - Defaulting a missing motor or parachute (rejected: inventing hardware would change the result without the user having chosen it; a missing motor gives the stability and no flight, a missing parachute a ballistic descent, both said).
- **Consequences:**
  - The step-by-step tools are unchanged and are how a result is refined.
  - No physics change; no golden output changes.

## D-119 (2026-10-14): Real flights at the core: a flight benchmark in CI, its range beside every apogee, and the sources for the missing drag

- **Decision:** Plan 0080, on the owner's instruction ("all these must be done, with real flights at the core … a sim is a sim, and needs accurate info").
  - **The benchmark.** Every flown rocket among RASAero II's examples (24, after the importer learned the averaged and accelerometer apogees of three of them) is flown in both modes in CI. CI fetches the examples by their checked installer and never redistributes them.
    - The results are `docs/reports/real-flights.md`.
    - The measured-over-predicted ratios of each speed range are kept in `real-flights.data.json`. A physics change that moves them fails until they are regenerated, and its commit names the change, as with the goldens.
  - **The target, set before any change:** below Mach 0.95, the mean and median error within ±3 % and the rms within 6 %, RASAero II's own scatter on these flights.
  - **The selection rule.** A model is adopted on its source and on physical completeness. The flights report its effect and never choose it, and nothing is fitted to them (CLAUDE.md 7.4).
  - **The residual rule (owner's choice).** Beside every apogee, the app and the MCP show the range measured flights of the same speed range reached, labelled as measured flights, not physics. Today it is 80 to 95 % of the displayed apogee below Mach 0.95 (13 flights) and 63 to 96 % above (11). It never changes a model constant.
  - **New sources (owner's approval):**
    - NACA TM 1299 (Tillmann, 1951; measured drag of protuberances in a turbulent boundary layer), for rail buttons, rail guides, launch shoes and lugs;
    - NASA SP-125, for thrust at altitude.

    Both are U.S. government works, to be added to `reference/` with their checks when their steps begin.

  - **Flight data.** The owner has none to add yet; the benchmark grows when they do.
- **Why:** Accuracy against real flights is the project's purpose. The displayed apogee was 16 % high on average below Mach 0.95 and 25 % above, worse than OpenRocket's model on the same flights (+9.1 % and +17.8 %). A gap that is measured in every change can be closed and can be shown honestly meanwhile.
- **Alternatives:**
  - **A correction factor fitted to the flights** (offered; the owner chose the labelled range). It would change the physics without a source and fit 24 showcase flights rather than reality.
  - **Stating the bias only** (offered; the owner chose the range, which also gives the expected apogee).
- **Consequences:**
  - Plan 0080's steps 2 to 7 each regenerate the benchmark.
  - The 21-flight figures in the RASAero report stay as that report's own runs.

## D-120 (2026-10-15): The DATCOM's wing-body friction for the fins in the displayed mode (eq. 4.3.3.1-a complete)

- **Decision (plans 0080 step 2 and 0081).** The displayed mode computes the fins' and body's friction by the DATCOM's wing-body zero-lift drag, eq. 4.3.3.1-a, whole:
  - each fin set's skin friction at the Reynolds number of its own mean aerodynamic chord (DATCOM eq. 4.1.5.1-a, DRAG-24) instead of the rocket's (Niskanen eq. 3.85);
  - its thickness bracket 1 + L(t/c) + 100(t/c)⁴ in place of 1 + 2t/c, and its lifting-surface factor R_LS (figure 4.1.5.1-28b);
  - the wing-body factor R_WB (figure 4.3.3.1-37) on the fin and body friction (DRAG-26).

  `dragCoefficient`'s defaults follow (`DEFAULT_FIN_FRICTION_LENGTH`, `DEFAULT_LIFTING_SURFACE_FACTORS`). The OpenRocket-equivalent mode keeps eq. (3.85) whole; tests that mean it name `finFrictionLength: 'rocket'` and `liftingSurfaceFactors: 'none'`.

- **How it got here.**
  - Step 2 of plan 0080 took the fin chord's Reynolds number alone. It improved the flights (+16.4 → +13.2 %) but took the held-out subsonic drag over its target (6.1 → 8.2 % rms). Plan 0080 had quoted D-115's "fin chord alone" row, measured before the body form factor, so the figures the owner saw were stale; the plan is corrected.
  - Asked to keep or revert it, the owner answered: "we need another solution. we can't have everything inaccurate" (2026-10-15).
  - The answer is the rest of the same equation. R_LS lowers the friction of swept fins (0.81 at 60°) and the bracket that of airfoil sections, which is what the over-predicted free-flight model (RM L8A05, fins swept 60°, airfoil section) has; R_WB is about 1.05 for a model rocket at low speed.
- **The charts.** Both were digitised twice: by pixel, on a cleaned image for figure 4.3.3.1-37's dense log paper, and by eye. Every reading either chart gives in the DATCOM's sample problems is reproduced within 0.005 (16 readings), and the passes agree within 0.007 (`reference/digitised/`).
- **Where the charts end.** Both are subsonic to Mach 0.9; the factors are faired linearly to 1 at Mach 1.0, where the DATCOM's transonic method (eq. 4.3.3.1-c) uses neither. R_WB has no data below Mach 0.25 or a body Reynolds number of 2.8 × 10⁶; R_LS comes from round-nosed airfoil wings. Each edge is held and named in the flight's technical notes, as the base drag's chart limits are (issue #19), and in `known-limitations.md`. They are not in the approximation list, which would show every model rocket "3 warnings" for chart edges.
- **Effect, measured on every dataset:**

  | Dataset                                           | Before (D-115)                       | Fin chord alone (measured, superseded) | Eq. 4.3.3.1-a complete      |
  | ------------------------------------------------- | ------------------------------------ | -------------------------------------- | --------------------------- |
  | 13 flights below Mach 0.95: mean, median, rms     | +16.4 %, +17.0 %, 17.5 %             | +13.2 %, +12.6 %, 14.5 %               | +12.4 %, +11.5 %, 13.7 %    |
  | 11 flights above Mach 0.95: mean                  | +24.7 %                              | +21.1 %                                | +21.2 %                     |
  | Held-out C_D rms: subsonic, transonic, supersonic | 6.1 % (target 7 %), 21.2 %, 14.9 %   | 8.2 % (not met), 20.2 %, 15.6 %        | 6.7 % (met), 20.3 %, 15.4 % |
  | ARCAS forebody C_A rms (not held out, D-061)      | 7.8 %, 29.1 %, 20.2 % (last written) |                                        | 2.8 %, 25.5 %, 15.5 %       |
  | Example rocket: apogee, maximum velocity          | 172.41 m, 62.9 m/s                   | 167.42 m, 62.2 m/s                     | 164.36 m, 61.7 m/s          |
  - **Better:** the mean C_D error of five of the six held-out datasets (RM-10 free flight −6.8 → −1.3 %, TN D-3182 model A −16.2 → −13.6 %, TM X-1661 −16.2 → −12.4 %, Blue Scout −13.4 → −11.3 %, L8A05 −2.4 → +0.8 %).
  - **Worse:** the RM-10 tunnel model, already over-predicted above Mach 1.4 by its wave drag (+5.0 → +10.3 %), which raises the supersonic rms by 0.5 points; and the two transonic points of the RM A53D02 rounds (square fins 6.2 → 8.0 %, wedge 1.0 → 3.9 %), which were over-predicted. Plan 0080 step 6 (transonic and supersonic drag) is where they belong.

- **Rules.** Plan 0080's rule (D-119: "adopted on its source and physical completeness; the benchmarks report") adopts it. Plan 0076's stricter rule ("not worse on either independent dataset") would still object to the supersonic rms, 0.5 points higher, from one dataset already over-predicted by another term. Every target that was met is still met, and the flights improve.
- **The held-out test does not assert its targets.** It writes the report; a green CI does not mean the targets are met.
- **Unchanged:** the OpenRocket-equivalent mode and every golden output. The RK4 step-check and in-flight stability reports are not regenerated, as for D-115.

## D-121 (2026-10-15): Real flights compared as their instrument reads them; every result gives the barometric altimeter's reading

- **Decision (plan 0081 part B).**
  - **The benchmark.** A flight measured with a barometric altimeter is compared with what a barometric altimeter would have read on the predicted flight (ATM-13). GPS, optical tracking and accelerometer flights stay compared with the true apogee. The report lists both figures.
  - **Every result.** `FlightSummary.barometricApogee` gives the reading. The app's Apogee card says "A barometric altimeter will read about X: it assumes a standard day, and this one is warmer (colder)" when it is 0.5 % or more from the apogee. The MCP report has `barometric_altimeter_apogee_m`.
  - **The flight-based range (D-119)** is re-based on the same like-with-like ratios and still applies to the true apogee.
- **Why.**
  - A barometric altimeter converts pressure to height with the standard atmosphere, which is "a basis for pressure altimeter calibrations" (U.S. Standard Atmosphere 1976, foreword p. xiv, quoting the WMO definition). On a day warmer than standard the air column is taller for the same pressure drop, so it reads low.
  - The simulator already applies each day's temperature (ATM-11), so its apogee is the true height on that day. Comparing that with a barometric reading is comparing two different quantities.
  - All 13 flights below Mach 0.95 were measured barometrically, on days of 62 to 100 °F at sites where the standard day is 45 to 51 °F.
- **Effect** (the 24 flown rockets of RASAero II's examples):

  | 13 flights below Mach 0.95            | Mean    | Median  | rms    |
  | ------------------------------------- | ------- | ------- | ------ |
  | Displayed, true apogee (before)       | +12.4 % | +11.5 % | 13.7 % |
  | Displayed, as the instrument reads it | +5.3 %  | +6.3 %  | 7.7 %  |
  | OpenRocket-equivalent, the same       | +2.1 %  | +1.8 %  | 6.2 %  |

  Above Mach 0.95 the displayed mean goes from +21.2 to +18.0 %.

- **Uncertainty, stated with it.**
  - The day's atmosphere is the site's temperature offset carried up at the standard lapse rate (Niskanen §4.1.1). A desert afternoon's offset shrinks with height, so the simulated density and the predicted reading share that uncertainty.
  - Instruments differ. On the Kinsel flight two barometric altimeters read 42 231 and 40 113 ft, 5 % apart (GPS 42 771 ft). That flight is far above the layer the model covers, so it is supporting evidence, not a test.
- **Found with it.**
  - **RASAero II applies the launch temperature too.** Thunder&Lightning flown in RASAero II at its file's 100 °F reaches 3989 ft; the same file at 49 °F reaches 3823 ft (two runs with `reference/rasaero/run-rasaero.sh`, the temperature changed in a copy of the file). So its apogees are true heights. Compared like with like on the 13 flights below Mach 0.95, RASAero II is −5.4 % mean and 7.5 % rms: it predicts too much drag, and its +0.4 % against barometers (plan 0075) was two errors cancelling. Its rail guide rule (about 2.6 on the guide's frontal area) reads as part of that compensation.
  - **The base drag decides between the modes.** The OpenRocket-equivalent mode is closer to these flights (+2.1 % mean). With only the base drag switched to Niskanen's eq. (3.94), the displayed mode goes from +5.3 to −3.4 %; the rail buttons (+8.7 % with OpenRocket's), the friction (+10.0 % with eq. 3.85's), the roll damping and the large-angle model move it the other way or not at all. The held-out data favoured the DATCOM's base drag (D-069), which the DATCOM says fins raise the base pressure above. The truth on these rockets lies between the two methods: tracing why, from sources, is next. Nothing is changed for it here.
- **Unchanged:** the physics; every golden output; the true apogee shown.
