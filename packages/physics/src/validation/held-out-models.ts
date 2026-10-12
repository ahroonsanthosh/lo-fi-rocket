/**
 * Held-out validation models for version 1.0 (CLAUDE.md 6.7 item 1, D-061):
 * the configurations of six NACA/NASA reports transcribed from their
 * drawings. The transcription with its page references and every modelling
 * choice is recorded in `reference/digitised/held-out-v1.json` (`geometry`
 * of each dataset), which a formats test compares with these constants. The
 * data are validation only: nothing here feeds the model, and nothing in
 * the model was built, chosen or tuned from them.
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
 * Blue Scout 1/15-scale model, configuration D of NASA TN D-1958 (figure
 * 1(a)): sharp 22° cone 2.56 in long to d = 2.06 in (the 0.43 in spherical
 * tip is replaced by the cone apex), cylinder to station 29.69, conical
 * transition to d = 2.67 in at 32.90, cylinder to the base at 57.25; four
 * fins, root 2.42, tip 0.47, span 2.40, leading edge swept 45° (sweep length
 * 2.40 − 0.47 = 1.93 in from the drawing's 45° leading edge and the 0.63 in
 * tip offset), single wedge 8° included angle (mean thickness 0.17 in, blunt
 * base: 'square'), root leading edge at 54.76. Reference diameter 2.67 in.
 */
export const BLUE_SCOUT_LENGTH_INCHES = 57.72;
export const BLUE_SCOUT_DIAMETER_INCHES = 2.67;
export const BLUE_SCOUT_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'conical',
    length: metres(2.56 * INCH),
    baseRadius: metres(1.03 * INCH),
    density: ALUMINIUM,
  }),
  put(2.56, {
    kind: 'bodyTube',
    length: metres((29.69 - 2.56) * INCH),
    outerRadius: metres(1.03 * INCH),
    wallThickness: metres(0.1 * INCH),
    density: ALUMINIUM,
  }),
  put(29.69, {
    kind: 'transition',
    shape: 'conical',
    length: metres((32.9 - 29.69) * INCH),
    foreRadius: metres(1.03 * INCH),
    aftRadius: metres(1.335 * INCH),
    density: ALUMINIUM,
  }),
  put(32.9, {
    kind: 'bodyTube',
    length: metres((57.25 - 32.9) * INCH),
    outerRadius: metres(1.335 * INCH),
    wallThickness: metres(0.1 * INCH),
    density: ALUMINIUM,
  }),
  put(54.76, {
    kind: 'finSet',
    crossSection: 'square',
    count: 4,
    rootChord: metres(2.42 * INCH),
    tipChord: metres(0.47 * INCH),
    sweep: metres(1.93 * INCH),
    span: metres(2.4 * INCH),
    thickness: metres(0.17 * INCH),
    density: ALUMINIUM,
    bodyRadius: metres(1.335 * INCH),
  }),
];

/**
 * NACA RM-10 half-scale model of NACA RM E50D28 (figure 2) and the 73.25 in
 * flight models of NACA TN 2944 (Table I): parabolic body
 * b = x (2 − x/45)/15 in, 0 ≤ x ≤ 73.25 (d_max = 6 in at x = 45, base radius
 * 1.818 in), modelled as a parabolic-series nose (κ = 1) of length 45 and
 * the unclipped parabolic boattail (κ = 1) that continues the same parabola
 * exactly (GEO-7). Four fins of circular-arc section (t/c 0.10 normal to the
 * 60° leading edge): parallelogram of streamwise chord 9.07 in, root
 * leading edge at 64.5, tip at radius 8.95 in (span 6.85 from the mean root
 * radius 2.10), sweep 6.85 tan 60° = 11.86 in, thickness 0.454 in,
 * 'airfoil'. The 0.25 in removed from the tip of the tunnel model is kept.
 */
export const RM10_BASE_STATION_INCHES = 73.25;
export const RM10_DIAMETER_INCHES = 6;
export const RM10_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'parabolic',
    shapeParameter: 1,
    length: metres(45 * INCH),
    baseRadius: metres(3 * INCH),
    density: ALUMINIUM,
  }),
  put(45, {
    kind: 'transition',
    shape: 'parabolic',
    shapeParameter: 1,
    length: metres(28.25 * INCH),
    foreRadius: metres(3 * INCH),
    aftRadius: metres(1.818 * INCH),
    density: ALUMINIUM,
  }),
  put(64.5, {
    kind: 'finSet',
    crossSection: 'airfoil',
    count: 4,
    rootChord: metres(9.07 * INCH),
    tipChord: metres(9.07 * INCH),
    sweep: metres(11.86 * INCH),
    span: metres(6.85 * INCH),
    thickness: metres(0.454 * INCH),
    density: ALUMINIUM,
    bodyRadius: metres(2.1 * INCH),
  }),
];

/**
 * Model A of NASA TN D-3182 (figure 1): nose 25.9 in long to r = 3 in whose
 * coordinate table is fitted by Niskanen's parabolic series with κ = 0.825
 * (largest error 0.085 in; a power series misses by 0.16 in, a tangent ogive
 * by 0.31 in; the text calls it "approximately three-quarter-power"),
 * cylinder to the base at 65.9; four fins: root 9.15, tip 6.54, span 4.38,
 * leading edge swept 45° (sweep 4.38), trailing edge at the base (root
 * leading edge at 56.75), 10° included-angle wedge with a blunt trailing
 * edge (mean thickness 0.69 in, 'square').
 */
export const TN_D3182_DIAMETER_INCHES = 6;
export const TN_D3182_LENGTH_INCHES = 65.9;
export const TN_D3182_MODEL_A_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'parabolic',
    shapeParameter: 0.825,
    length: metres(25.9 * INCH),
    baseRadius: metres(3 * INCH),
    density: ALUMINIUM,
  }),
  put(25.9, {
    kind: 'bodyTube',
    length: metres(40 * INCH),
    outerRadius: metres(3 * INCH),
    wallThickness: metres(0.1 * INCH),
    density: ALUMINIUM,
  }),
  put(56.75, {
    kind: 'finSet',
    crossSection: 'square',
    count: 4,
    rootChord: metres(9.15 * INCH),
    tipChord: metres(6.54 * INCH),
    sweep: metres(4.38 * INCH),
    span: metres(4.38 * INCH),
    thickness: metres(0.69 * INCH),
    density: ALUMINIUM,
    bodyRadius: metres(3 * INCH),
  }),
];

/**
 * Fineness-ratio 7.87 model of NACA RM L8A05 (figure 1(a)): parabolic body
 * Y = 3.88 − 0.002577 X² (X from the maximum-diameter station 38.8), nose
 * parabolic series κ = 1 of length 38.8 and radius 3.88, unclipped parabolic
 * boattail to r = 2.61 at station 61 (the same parabola; the drawing lists
 * 5.15/2 = 2.575 at the base); three untapered fins swept 60°, circular-arc
 * section t/c 0.10 normal to the leading edge, streamwise chord 9.25 in
 * (4.625 normal to the edge), tip radius 8.65 (span 5.9 from the mean root
 * radius 2.75), sweep 5.9 tan 60° = 10.2, thickness 0.4625, trailing edge
 * at the base (root leading edge at 51.75), 'airfoil'.
 */
export const L8A05_DIAMETER_INCHES = 7.76;
export const L8A05_LENGTH_INCHES = 61;
export const L8A05_COMPONENTS: readonly PlacedComponent[] = [
  put(0, {
    kind: 'noseCone',
    shape: 'parabolic',
    shapeParameter: 1,
    length: metres(38.8 * INCH),
    baseRadius: metres(3.88 * INCH),
    density: ALUMINIUM,
  }),
  put(38.8, {
    kind: 'transition',
    shape: 'parabolic',
    shapeParameter: 1,
    length: metres(22.2 * INCH),
    foreRadius: metres(3.88 * INCH),
    aftRadius: metres(2.61 * INCH),
    density: ALUMINIUM,
  }),
  put(51.75, {
    kind: 'finSet',
    crossSection: 'airfoil',
    count: 3,
    rootChord: metres(9.25 * INCH),
    tipChord: metres(9.25 * INCH),
    sweep: metres(10.2 * INCH),
    span: metres(5.9 * INCH),
    thickness: metres(0.4625 * INCH),
    density: ALUMINIUM,
    bodyRadius: metres(2.75 * INCH),
  }),
];
