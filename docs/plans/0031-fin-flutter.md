# Plan 0031: Fin flutter from NACA TN 4197 (completion prompt Part C item 6)

**Status:** written and implemented 2026-10-12 under autonomous mode; D-068.

## Goal

The flutter speed of every fin set along the flight, from NACA TN 4197 with sourced material shear moduli and the local atmosphere, with the lowest margin reported and a warning when the flight exceeds it.

## Source and equations

NACA TN 4197 (Martin 1958), appendix pp. 11 to 15: Theodorsen and Garrick's flutter formula at the three-quarter span with Coleman's taper correction and the aspect-ratio correction A/(A + 2), reduced to eq. (16) and, with ρa² = γp (eq. 17), γ = 1.4, ε = 0.25, to eq. (18): (V_f/a)² = G_E / [39.3 A³/((t/c)³(A + 2)) · ((λ + 1)/2)(p/p₀)] with p₀ = 14.7 psi and G_E in psi. The SI form keeps the constant as (24ε/π)γp (FLUT-2). A is the aspect ratio of one exposed panel L/c₀.₅₀ (p. 13), t/c the streamwise thickness ratio, λ the taper ratio. The report's worked example (A = 2, t/c = 0.04: X ≈ 1.25 × 10⁶ psi, p. 6) is a unit test.

## Materials

The shear moduli marked on figure 3's axis (p. 19), digitised from a 220 dpi render: magnesium 2.52, aluminium 4.05, titanium 6.03 × 10⁶ psi (single marks), wood 0.071 to 0.121 and steel 9.0 to 11.3 × 10⁶ psi (ranges; the lower ends are used). Other materials (fibreglass, carbon, balsa) are not in an approved source: the user enters G_E (the app says the value comes from the supplier's data); a fin set without one is not checked and the flight says so.

## Implementation

`TrapezoidFinSetComponent.shearModulus` (optional, Pa; the native format accepts it); `stability/flutter.ts` (FLUT-1, FLUT-2, `TN4197_MATERIALS`); the simulator evaluates V_f/V at every accepted step of powered flight and coast with the local pressure and speed of sound (USSA 1976 at the vehicle's altitude) and reports per fin set the lowest ratio with its time, Mach number, airspeed and V_f (`FlightSummary.flutter`); below 1 a warning. App: a material selector (TN 4197 materials or a custom G_E with the modulus unit GPa or 10⁶ psi). The example design's plywood fins use TN 4197's wood.

## Results

`docs/reports/in-flight-stability.md`: R1 3.41, R2 1.10 (marginal), R4 2.37 with plywood as TN 4197 wood; R3 and R5 (fibreglass) not evaluated, needing 0.18 and 0.42 GPa.

## Files

`packages/physics/src/stability/flutter.ts` (+ test), `geometry/components.ts`, `flight/simulate.ts`, `index.ts`; `packages/formats/src/design/validate.ts`, `example.ts`, `simulate.stability.test.ts`; `packages/app/src/components/ComponentEditor.tsx`, `units/display.ts`; docs: FLUT-1, FLUT-2, D-068, limitations, report.
