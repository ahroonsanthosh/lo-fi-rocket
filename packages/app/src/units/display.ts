/**
 * Display units (plan 0012). The design and the physics hold SI; these
 * specs convert for the inputs and labels of the chosen unit system. Each
 * customary unit uses the exact factor of UNIT-5 to UNIT-11 (NIST SP 811,
 * D-040), and its inverse is division by the same factor (SP 811 B.3 note
 * 2, p. 41). Derived units (lb/ft³, psi) are products of the exact factors.
 */
import { CUSTOMARY_UNIT_FACTORS } from '@lo-fi-rocket/physics';

export type UnitSystem = 'metric' | 'imperial';

export type QuantityKind =
  | 'mm' // component dimensions and positions
  | 'm' // altitudes, distances, rail length
  | 'g' // component masses
  | 'kg' // rocket mass
  | 'density'
  | 'velocity'
  | 'acceleration'
  | 'force'
  | 'temperature'
  | 'pressure'
  | 'angle'
  | 'time'
  | 'ratio'
  | 'modulus' // shear modulus of fin materials (plan 0031)
  | 'surfaceDensity'; // a streamer's material (plan 0073)

export interface UnitSpec {
  /** Unit label shown after the value. */
  readonly label: string;
  readonly toSI: (display: number) => number;
  readonly fromSI: (si: number) => number;
  /** Decimals shown when formatting. */
  readonly decimals: number;
}

const F = CUSTOMARY_UNIT_FACTORS;
const linear = (label: string, factor: number, decimals: number): UnitSpec => ({
  label,
  toSI: (x) => x * factor,
  fromSI: (si) => si / factor,
  decimals,
});

/** 1 lb/ft³ = 0.45359237 / 0.3048³ kg/m³ = 16.018463373960... (SP 811 B.8 prints 1.601 846 E+01). */
const KG_PER_M3_PER_LB_PER_FT3 = F.kilogramsPerPound / F.metresPerFoot ** 3;
/** 1 psi = 4.4482216152605 / 0.0254² Pa = 6894.757293168... (SP 811 B.8 prints 6.894 757 E+03). */
const PA_PER_PSI = F.newtonsPerPoundForce / F.metresPerInch ** 2;
/** 1 oz/yd² = 0.028349523125 / 0.9144² kg/m² = 0.0339057... (SP 811 B.8 p. 52 prints 3.390 575 E−02). */
const KG_PER_M2_PER_OZ_PER_YD2 = F.kilogramsPerOunce / (3 * F.metresPerFoot) ** 2;

const METRIC: Record<QuantityKind, UnitSpec> = {
  mm: linear('mm', 1 / 1000, 1),
  m: linear('m', 1, 2),
  g: linear('g', 1 / 1000, 1),
  kg: linear('kg', 1, 3),
  density: linear('kg/m³', 1, 0),
  velocity: linear('m/s', 1, 1),
  acceleration: linear('m/s²', 1, 1),
  force: linear('N', 1, 1),
  temperature: {
    label: '°C',
    // UNIT-4 and its inverse
    toSI: (c) => c + 273.15,
    fromSI: (k) => k - 273.15,
    decimals: 1,
  },
  pressure: linear('hPa', 100, 1),
  angle: {
    label: '°',
    // UNIT-3 and its inverse
    toSI: (deg) => (deg * Math.PI) / 180,
    fromSI: (rad) => (rad * 180) / Math.PI,
    decimals: 1,
  },
  time: linear('s', 1, 2),
  modulus: linear('GPa', 1e9, 2),
  ratio: linear('', 1, 2),
  surfaceDensity: linear('g/m²', 1 / 1000, 0),
};

const IMPERIAL: Record<QuantityKind, UnitSpec> = {
  mm: linear('in', F.metresPerInch, 3),
  m: linear('ft', F.metresPerFoot, 1),
  g: linear('oz', F.kilogramsPerOunce, 2),
  kg: linear('lb', F.kilogramsPerPound, 3),
  density: linear('lb/ft³', KG_PER_M3_PER_LB_PER_FT3, 1),
  velocity: linear('ft/s', F.metresPerSecondPerFootPerSecond, 1),
  acceleration: linear('ft/s²', F.metresPerSecondPerFootPerSecond, 1),
  force: linear('lbf', F.newtonsPerPoundForce, 2),
  temperature: {
    label: '°F',
    // UNIT-11 and its inverse
    toSI: (f) => ((f + 459.67) * 5) / 9,
    fromSI: (k) => (k * 9) / 5 - 459.67,
    decimals: 1,
  },
  pressure: linear('psi', PA_PER_PSI, 2),
  modulus: linear('10⁶ psi', PA_PER_PSI * 1e6, 3),
  surfaceDensity: linear('oz/yd²', KG_PER_M2_PER_OZ_PER_YD2, 2),
  angle: METRIC.angle,
  time: METRIC.time,
  ratio: METRIC.ratio,
};

export function unitFor(kind: QuantityKind, system: UnitSystem): UnitSpec {
  return system === 'metric' ? METRIC[kind] : IMPERIAL[kind];
}

/** Format an SI value in the display unit with the unit's decimals, for example "123.4 mm". */
export function formatQuantity(
  si: number,
  kind: QuantityKind,
  system: UnitSystem,
  decimals?: number,
): string {
  const u = unitFor(kind, system);
  const value = u.fromSI(si).toFixed(decimals ?? u.decimals);
  return u.label === '' ? value : `${value} ${u.label}`;
}

/** The number a field shows for an SI value (no rounding beyond float64; the field formats). */
export function displayValue(si: number, kind: QuantityKind, system: UnitSystem): number {
  return unitFor(kind, system).fromSI(si);
}

/** Parse a field's text in the display unit to SI; undefined when the text is not a finite number. */
export function parseQuantity(
  text: string,
  kind: QuantityKind,
  system: UnitSystem,
): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '' || !/^[-+]?(\d+(?:\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(trimmed))
    return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? unitFor(kind, system).toSI(n) : undefined;
}
