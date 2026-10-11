# Plan 0003: Component geometry, mass, CG and moments of inertia

**Status:** written 2026-10-11 under autonomous mode (CLAUDE.md section 11); implemented in the commits that follow.
**Phase:** 1, step 3.

## Goal

For every component type in CLAUDE.md 6.1, compute volume, mass (from a bulk density or a user mass override), centre of gravity, and the longitudinal and rotational moments of inertia; then combine components into a whole-rocket mass, CG and inertia at liftoff and burnout.

## Sources

- Niskanen (2009), Appendix A, pp. 100 to 104: nose cone and transition profiles. Conical eq. (A.1); ogive eqs. (A.2) to (A.5) with parameter κ (κ = 1 tangent ogive, κ → 0 conical); elliptical eq. (A.6); parabolic series eq. (A.7); power series eq. (A.8); Haack series eqs. (A.9) and (A.10) (κ = 0 LD-Haack / Von Kármán, κ = 1/3 LV-Haack, limited to 0 ≤ κ ≤ 1/3); transitions as clipped or non-clipped nose cones (A.7, pp. 103 to 104).
- Niskanen (2009), section 4.2.3, p. 64: mass from volume × density; only the longitudinal and rotational moments of inertia are computed, the centreline being a principal axis; component values are combined (parallel axis theorem) into the rocket's; mass and CG overrides scale the inertia (mass override scales inertia linearly; CG override shifts the axis). The thesis cites "standard formulae" for the inertia of simple bodies; here every quantity is computed directly from its definition by numerical integration of the profile, so no external table of formulae is needed, and the closed forms for the cylinder, tube and cone are used only as test oracles with their working shown.
- Definitions (no external source): mass m = ∫ρ dV; CG x̄ = (1/m) ∫x dm; rotational (about the axis) I_x = ∫(y² + z²) dm; longitudinal (about a transverse axis through the CG) I_y = ∫((x − x̄)² + z²) dm. For a solid of revolution with profile r(x) and density ρ: dV = π r² dx, I_x = ∫ ½ π ρ r⁴ dx, I_y,axis = ∫ π ρ r² (x² + r²/4) dx, then the parallel axis theorem.

## Conventions (added to docs/conventions.md)

- A component's position x is its forward end in the rocket body frame; a profile r(x) is given in the component's own coordinate x ∈ [0, L] measured from its forward end.
- Hollow symmetric components (nose cones and transitions with a wall thickness t) are shells of uniform thickness measured normal to the outer surface: the inner profile is r_i(x) = max(0, r(x) − t·√(1 + r′(x)²)), the first-order normal offset, evaluated over the same x range (the ends are open). This is the physical uniform-wall model; checked against OpenRocket's component masses it agrees to 0.02 % for the conical boat tail (closed form) and to about 0.01 % for the ogive and Haack noses of the reference rockets (`reference/rockets/components/`). A "filled" component has r_i = 0.
- Tubes (body tubes, inner tubes, launch lugs) are hollow cylinders with outer radius R, wall t and length L. Rings (centering rings, bulkheads) are hollow or solid cylinders with explicit inner and outer radii. Mass components and parachutes are solid cylinders of the given mass, radius and length (mass given, density derived), used only for CG and inertia. Rail buttons are a stack of three cylinders (base, shaft, flange) on the body surface.
- Fins are flat plates of the trapezoidal planform (root chord, tip chord, leading-edge sweep, span) and thickness, with the CG at the planform centroid at the radial position of the body surface plus the spanwise centroid; the plate's inertia is integrated numerically over the planform.
- Motors in Phase 1 are cylinders of the total (liftoff) or casing (burnout) mass from the RASP header, length and diameter from the header, CG at mid-length (the convention of the format reader in plan 0004).

## Files

| File                                          | Purpose                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/physics/src/geometry/profiles.ts`   | Nose cone profile functions (A.1 to A.10), transition profiles, with parameter validation                                                                                        |
| `packages/physics/src/geometry/revolution.ts` | Numerical integration of a profile (and inner profile) into volume, CG, I_x, I_y; Gauss–Legendre quadrature on panels, with a documented convergence tolerance                   |
| `packages/physics/src/geometry/components.ts` | The component records and `massProperties(component)` for each type                                                                                                              |
| `packages/physics/src/geometry/assembly.ts`   | Combine components (and a motor) into whole-rocket mass, CG, inertia; parallel axis theorem                                                                                      |
| tests next to each file                       | hand calculations, closed-form oracles, properties, and the OpenRocket component-mass comparison (plan 0005 adds the .ork path; here the R1 to R5 components are built directly) |

## Tests

- Profiles: r(0) = 0 and r(L) = R for every nose shape; tangent ogive radius of curvature by hand (R = 0.027, L = 0.15: ρ_t = (0.027² + 0.15²)/(2 × 0.027) = 0.43017 m); ellipse r(L/2) = R·√3/2; power series κ = 1 equals the cone; parabolic κ = 0 equals the cone; Haack κ = 0 at x = L/2: θ = π/2, r = R·√((π/2)/π) = R/√2; parameter range errors (κ outside [0, 1], Haack κ > 1/3) throw `InvalidInputError`.
- Revolution: cylinder V = πR²L, CG = L/2, I_x = ½mR², I_y = m(3R² + L²)/12; cone V = πR²L/3, CG = 3L/4, I_x = (3/10)mR², I_y = m(3R²/20 + 3L²/80) about the CG; hollow tube I_x = ½m(R² + r²); quadrature converges: doubling panels changes results by less than the documented tolerance (10⁻¹⁰ relative for smooth profiles).
- Components: R1's components by hand (the `hand-checks.md` masses: nose 0.010472, body 0.053878, fins 0.032400, lug 0.000302, mount 0.002020, rings 0.004615 each) to 6 decimals; the hollow noses and boat tail of R2 to R5 against OpenRocket's component masses within 0.05 % (an observed agreement, recorded, not a tuning target); rail buttons against OpenRocket's 0.001113 kg and 0.000491 kg.
- Assembly: R1 liftoff mass 0.190904 kg and CG 0.387022 m (hand-checks.md, matches OpenRocket to six decimals); every reference rocket's liftoff and burnout mass and CG against `values.csv` within 1 % (acceptance) and, as observed, much closer.
- Properties: mass and volume are positive and scale with density and the cube of a uniform scale factor; CG lies within [0, L] for every component; inertia is non-negative and I_y ≥ I_x/2 for slender bodies (not asserted, only checked for sanity); adding a component never reduces total mass.

## Open items

- Elliptical, parabolic and power-series transitions and the "clipped" option are implemented as profiles but only the conical transition has a reference rocket; the others are covered by hand calculations only.
- The rail button and launch lug CG radial position affects only inertia, which has no reference value yet; Phase 2 will compare inertia against OpenRocket if needed.
