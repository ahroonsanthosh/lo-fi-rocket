# Plan 0018: Propellant mass and centre-of-gravity profiles for liquid engines (Prompt 4 step 3)

**Status:** written 2026-10-12 under autonomous mode; Prompt 4 step 3 (Phase 5, CLAUDE.md 10: "custom propellant mass profiles for liquid engines"; section 2: "mass that changes in non-standard ways (propellant tanks), without a rewrite").
**Phase:** 5.

## Goal

A motor whose propellant is not a solid grain burning about its mid-length: the user gives, with the thrust curve, the propellant remaining and the motor's centre of gravity from its fore end against time (tanks draining, oxidiser and fuel at different stations). The simulator's mass, CG and stability then follow the profile. The mass-profile rule already exists (MOT-4, D-029); this step adds the CG and the file column, nothing else.

## Sources

| ID    | Content                                                                                                                                               | Source                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOT-6 | Motor CG from the fore end as a function of time: linear interpolation between the profile's points, held at the ends; mid-length when no CG is given | The CG of a system of parts is the mass-weighted mean (GEO-12, Niskanen §4.2.3); a user-measured or computed CG table is data, interpolated as MOT-1 is |

The inertia of the motor remains that of a uniform cylinder of the current mass about the current CG (GEO-11 through `motorMassPart`): the thesis treats motors as such and no source gives a tank inertia law (recorded in `docs/known-limitations.md`).

## Conventions

- `MotorMassProfilePoint.cgFromForeEnd?: Metres`: either every point has it or none (validated); values within [0, motor length].
- `motorStateAt` interpolates it linearly in time and holds the ends; `motorMassAt` passes it to the assembly, which already accepts `cgFromForeEnd`.
- CSV (D-044 extended): a fourth column is the CG from the fore end in metres; three columns keep the mass profile with the mid-length CG; two columns keep the impulse-proportional rule.
- Design files: `massProfile` points accept the optional `cgFromForeEnd` (schema version unchanged, optional field).

## Tests

- By hand: a profile with CG 0.05 m at 0 s and 0.03 m at 2 s gives 0.04 m at 1 s; a rocket with that motor has its CG move forward during the burn by the motor's share.
- Validation: a CG outside the motor, a CG on only some points, and a CG with another mass rule are rejected.
- CSV: a four-column file produces the profile; a three-column one has no CG.
- A design file round trip with the CG column.
