# Plan 0008: Frames, orientation, gravity and environment

**Status:** written 2026-10-12 under autonomous mode; implemented in the following commit.
**Phase:** 2, step 2 (CLAUDE.md 6.4 and the frame part of 6.5). Drag (plan 0009) and the equations of motion, integrators and events (plan 0010) follow.

## Goal

Everything the equations of motion need around the rocket: the world and body frames, orientation as a unit quaternion with its algebra, the launch rail's direction and the initial orientation, gravity as a function of altitude, the atmosphere with launch-site overrides, a constant wind, and the flight parameters (airspeed, angle of attack, lateral airflow direction, Mach number, dynamic pressure) that chapter 3 consumes.

## Sources

| ID     | Content                                                                                                                                                                                               | Source                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| DYN-1  | Quaternion product (a + bi + cj + dk)(w + xi + yj + zk) = (aw − bx − cy − dz) + (ax + bw + cz − dy)i + (ay − bz + cw + dx)j + (az + by − cx + dw)k                                                    | Niskanen (2009) eq. (4.11), p. 63                                                                         |
| DYN-2  | Norm \|q\| = √(w² + x² + y² + z²); unit quaternion inverse q⁻¹ = w − xi − yj − zk                                                                                                                     | eqs. (4.12) and (4.16), p. 63                                                                             |
| DYN-3  | Rotation by angle φ about unit axis u: q = cos(φ/2) + u sin(φ/2)                                                                                                                                      | eq. (4.13), p. 63                                                                                         |
| DYN-4  | Rotating a vector: v ↦ q v q⁻¹; inverse rotation v ↦ q⁻¹ v q                                                                                                                                          | eqs. (4.14), (4.15), p. 63                                                                                |
| DYN-5  | Orientation update by an angular velocity ω over Δt: o₁ = (cos(\|ω\|Δt) + ω̂ sin(\|ω\|Δt)) · o₀, then normalised                                                                                       | eq. (4.24), p. 67 (used by plan 0010; the rotation quaternion is built here)                              |
| DYN-6  | World frame: Cartesian, origin at the launch position, xy parallel to the ground, z up; flat non-rotating Earth, no Coriolis. Rocket frame as chapter 3. Reference orientation: nose towards world +z | §4.2 and §4.2.1, pp. 60 to 62; frames fixed in `docs/conventions.md`                                      |
| DYN-7  | Airspeed = rocket velocity minus wind velocity; rotated into rocket coordinates by the inverse rotation; angle of attack α = angle between the centreline and the airspeed                            | §4.2.4 p. 65; α defined §2.4 p. 11 ("angle between the rocket centerline and the velocity")               |
| DYN-8  | Mach number M = v₀/c; dynamic pressure q = ½ ρ v₀²; Reynolds number R = v₀ L/ν                                                                                                                        | eqs. (3.11) p. 18, (3.12) p. 19; q in §3.1.1 p. 16; regimes Table 3.1 p. 19                               |
| GRAV-1 | g(Z) = g₀ (r₀/(r₀ + Z))², the inverse-square law with r₀ = 6 356 766 m                                                                                                                                | USSA76 eq. (17) p. 8 (printed; PDF p. 24)                                                                 |
| GRAV-C | Sea-level values: standard g_n = 9.80665 m/s²; OpenRocket-equivalent 9.8061992025 m/s² at 45° N (observed)                                                                                            | SI Brochure App. 1, 3rd CGPM 1901, p. 154; `reference/rockets/settings.md`                                |
| ATM-11 | Launch-site conditions: the user's temperature and pressure "are simply assigned to the first layer", given at mean sea level or at the site altitude; humidity ignored (< 1 %)                       | Niskanen §4.1.1 pp. 55 to 56; site variant by inverting ATM-3 and ATM-4 within layer 0                    |
| ENV-1  | Wind: a steady unidirectional velocity (turbulence is a separate zero-mean process, Phase 5)                                                                                                          | Niskanen §4.1.2 pp. 56 to 57; direction convention in `docs/conventions.md`                               |
| ENV-2  | Launch guide: the rocket is held along the rod until it leaves it; rod length, angle from vertical and direction; the NAR safety code forbids more than 30° from vertical                             | Niskanen §2.1 p. 6, §4.2.1 p. 61 (rod angle relative to the wind), Table 4.2 p. 69 ("launch rod cleared") |

Gravity's latitude dependence is not implemented: OpenRocket's formula (`settings.md`) mixes constants that match no document in `reference/`, and the WGS 84 or GRS 80 standards are not approved sources. The sea-level value is therefore a parameter (D-030); the owner is asked, without blocking, whether to approve a source for the latitude formula.

## Conventions (added to `docs/conventions.md`)

- World frame: ENU, origin at the launch pad (the base of the rail), z up. Altitude above sea level = site altitude + z.
- Body frame: the rocket body frame of Phase 1 (origin at the nose tip, x aft). The nose direction is body −x.
- Orientation: a unit quaternion q rotating body vectors into world vectors, v_w = q v_b q⁻¹. Reference orientation q_ref = rotation by +90° about the body y axis, which sends body +x (aft) to world −z (nose up), body y to north and body z to east. A rail tilted by θ from vertical towards azimuth ψ (clockwise from north) gives the initial orientation q₀ = q_tilt q_ref with q_tilt the rotation by θ about ẑ × d̂, d̂ = (sin θ sin ψ, sin θ cos ψ, cos θ).
- Wind: given as the direction it blows from (meteorological, clockwise from north) and a speed; velocity vector v_wind = −speed (sin ψ, cos ψ, 0). A velocity vector may be given directly (OpenRocket comparisons use (v sin θ, v cos θ, 0) for OpenRocket's direction θ).
- Angle of attack α ∈ [0, π]: angle between the nose direction and the airspeed vector; lateral airflow angle: the angle of the airspeed's body (y, z) component measured from +y towards +z, the roll angle θ of BAR-7 when fin 1 lies in the +y half-plane.

## Files

| File                                          | Purpose                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/physics/src/flight/vector.ts`       | `Vec3` and its arithmetic (definitions)                                                                                               |
| `packages/physics/src/flight/quaternion.ts`   | DYN-1 to DYN-5                                                                                                                        |
| `packages/physics/src/flight/frames.ts`       | DYN-6 to DYN-8: reference orientation, rail direction and initial orientation, body/world rotations, `flightParameters`               |
| `packages/physics/src/flight/gravity.ts`      | GRAV-1, GRAV-C                                                                                                                        |
| `packages/physics/src/atmosphere/ussa1976.ts` | ATM-11: `standardAtmosphere1976(z, baseConditions?)` with the layer table rebuilt from the given T₀, P₀ (standard values when absent) |
| `packages/physics/src/environment/wind.ts`    | ENV-1                                                                                                                                 |
| `packages/physics/src/environment/launch.ts`  | ENV-2: launch site (altitude, latitude), rail (length, angle, azimuth), validation and the 30° warning                                |
| tests next to each file                       |                                                                                                                                       |

## Tests

- Quaternions: eq. (4.9), (4.10) products (ij = k, ji = −k, i² = −1) through DYN-1; a 90° rotation about z sends (1, 0, 0) to (0, 1, 0) by hand; composition of two rotations equals the product; inverse rotation round-trips; eq. (4.24) with ω = (0, 0, π) rad/s over 0.5 s is a 90° rotation about z; properties: the norm is preserved under rotation, rotation of a unit quaternion keeps unit norm, q q⁻¹ = 1.
- Frames: the reference orientation sends the nose (body −x) to world +z and body y to north; a rail at 10° towards east gives d̂ = (0.173648, 0, 0.984808) and q₀ sends the nose there; the launch-rod angle relative to the wind is representable (rail azimuth and wind direction independent).
- Flight parameters: a rocket flying nose-first along its rail at 50 m/s with a 5 m/s crosswind from the east: airspeed body components by hand, α = atan(5/50) = 0.099669 rad, lateral angle = the direction of the wind in the body yz plane, Mach 50/340.294 = 0.14693 at sea level, q = ½ × 1.225 × 50² = 1531.25 Pa, Reynolds for L = 0.6 m with ν = 1.4607e-5: 2.0538e6.
- Gravity: 9.80665 at 0 m; at 86 000 m: 9.80665 × (6 356 766/6 442 766)² = 9.54735 m/s² (by hand: ratio 0.986652, squared 0.973482; × 9.80665 = 9.546569... computed in the test comment); monotone decreasing; the OpenRocket-equivalent constant.
- Atmosphere overrides: standard values reproduce the standard bit for bit; sea-level T₀ = 300 K halves nothing but density = P₀M₀/(R*·300) = 1.17665 kg/m³ by hand; a site at 1 000 m with T = 280 K and P = 90 000 Pa: T₀ = 280 + 0.0065 × 999.843 = 286.499 K, P₀ = 90 000 × (286.499/280)^(5.255876) = 101 160 Pa (by hand in the comment), and the atmosphere at 1 000 m returns exactly 280 K and 90 000 Pa; a site above layer 0 throws `NotImplementedError`; non-positive pressure or temperature below 0 K throw `InvalidInputError`.
- Wind: 5 m/s from the north → (0, −5, 0); from the east → (−5, 0, 0); OpenRocket vector helper for θ = π/2 → (5, 0, 0).
- Launch: rail length must be positive; angle in [0°, 90°); 35° yields a warning citing the NAR 30° limit; azimuth normalised to [0, 2π).
