/**
 * Wind tunnel validation models (CLAUDE.md 6.7 item 1, plan 0021, D-053):
 * the ARCAS half-scale model of NASA TN D-4013 and TN D-4014 and the
 * fin-stabilised body of NACA RM A53D02, transcribed from the reports'
 * drawings. The transcription with its page references and every
 * modelling choice is recorded in
 * `reference/digitised/wind-tunnel-validation.json` (`geometry`), which a
 * formats test compares with these constants. The data are validation only:
 * nothing here feeds the model.
 *
 * Densities are placeholders for the component types (mass plays no part in
 * the CP or drag comparison).
 */
import type { PlacedComponent } from '../geometry/assembly.js';
import type { Component } from '../geometry/components.js';
import { kilogramsPerCubicMetre, metres } from '../units/si.js';

const INCH = 0.0254;
const ALUMINIUM = kilogramsPerCubicMetre(2700);
const put = (positionInches: number, component: Component): PlacedComponent => ({
  component,
  position: metres(positionInches * INCH),
});

/**
 * ARCAS half-scale short model (TN D-4014 configuration 1, TN D-4013 short
 * model): d = 2.25 in, body length 40.95 in. Nose: the coordinate table of
 * TN D-4014 figure 1 reaches the full radius at x = 9.375 in and fits
 * Niskanen's secant ogive with κ = 0.726 to within 0.006 in; the cylinder
 * runs to the 15° boattail (1.00 d to 0.65 d, 1.47 in long) that ends at the
 * reflexed lip (0.06 in, not modelled). Four trapezoidal fins, root 3.380 in,
 * tip 2.165 in, span 2.103 in, leading edge 30° from the normal (sweep
 * 1.214 in, trailing edge unswept), mean thickness 0.123 in, double wedge
 * (modelled as 'rounded'), root leading edge 1.78 d forward of the base.
 */
export const ARCAS_BODY_LENGTH_INCHES = 40.95;
export const ARCAS_DIAMETER_INCHES = 2.25;
export const ARCAS_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'ogive',
    shapeParameter: 0.726,
    length: metres(9.375 * INCH),
    baseRadius: metres(1.125 * INCH),
    density: ALUMINIUM,
  }),
  put(9.375, {
    kind: 'bodyTube',
    length: metres((39.42 - 9.375) * INCH),
    outerRadius: metres(1.125 * INCH),
    wallThickness: metres(0.1 * INCH),
    density: ALUMINIUM,
  }),
  put(39.42, {
    kind: 'transition',
    shape: 'conical',
    length: metres(1.47 * INCH),
    foreRadius: metres(1.125 * INCH),
    aftRadius: metres(0.73125 * INCH),
    density: ALUMINIUM,
  }),
  put(36.945, {
    kind: 'finSet',
    crossSection: 'rounded',
    count: 4,
    rootChord: metres(3.38 * INCH),
    tipChord: metres(2.165 * INCH),
    sweep: metres(1.214 * INCH),
    span: metres(2.103 * INCH),
    thickness: metres(0.123 * INCH),
    density: ALUMINIUM,
    bodyRadius: metres(1.125 * INCH),
  }),
];

/** Reynolds numbers on the body length (1.04013 m) at the tunnels' 9.8e6 and 9.84e6 per metre. */
export const ARCAS_REYNOLDS = {
  tnD4013: 9.8e6 * ARCAS_BODY_LENGTH_INCHES * INCH,
  tnD4014: 9.84e6 * ARCAS_BODY_LENGTH_INCHES * INCH,
} as const;

/**
 * NACA RM A53D02 basic configuration (figure 1(a)): length 2.50 in, diameter
 * 0.250 in, tangent ogive nose 1.00 in long (radius 4 1/16 in), four fins
 * with the trailing edge at the base: root 0.75 in, tip 0.375 in, exposed
 * semispan 0.125 in (from the 0.500 in tip-to-tip span), mean thickness
 * 0.0225 in (thickness ratio 0.04), asymmetric 20° wedge leading edge and
 * blunt trailing edge. `finCrossSection` selects the fin drag section used
 * (neither matches a sharp wedge with a blunt base; both are reported).
 */
export const NACA_A53D02_LENGTH_INCHES = 2.5;
export const NACA_A53D02_DIAMETER_INCHES = 0.25;
export function nacaA53d02Components(
  finCrossSection: 'square' | 'rounded',
): readonly PlacedComponent[] {
  const components: PlacedComponent[] = [
    put(0, {
      kind: 'noseCone',
      shape: 'ogive',
      shapeParameter: 1,
      length: metres(INCH),
      baseRadius: metres(0.125 * INCH),
      density: ALUMINIUM,
    }),
    put(1, {
      kind: 'bodyTube',
      length: metres(1.5 * INCH),
      outerRadius: metres(0.125 * INCH),
      wallThickness: metres(0.02 * INCH),
      density: ALUMINIUM,
    }),
    put(1.75, {
      kind: 'finSet',
      crossSection: finCrossSection,
      count: 4,
      rootChord: metres(0.75 * INCH),
      tipChord: metres(0.375 * INCH),
      sweep: metres(0.375 * INCH),
      span: metres(0.125 * INCH),
      thickness: metres(0.0225 * INCH),
      density: ALUMINIUM,
      bodyRadius: metres(0.125 * INCH),
    }),
  ];
  return components;
}
