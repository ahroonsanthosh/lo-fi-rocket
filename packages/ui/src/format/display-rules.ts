/**
 * Display formatting rules: the one documented place for decimals and
 * unit labels (docs/ui/redesign.md section 8, D-UI-3).
 *
 * The rules reproduce the current app exactly: `UNIT_DISPLAY` is the
 * label and decimals of every quantity kind in
 * `packages/app/src/units/display.ts` (a parity test reads that file), and
 * `FIGURE_DISPLAY` is every other `toFixed` the app's panels apply, with
 * the file it came from. The unit conversion factors are not here: they
 * are physics (UNIT-5 to UNIT-11) and stay with the app, which hands this
 * package numbers already in the display unit.
 *
 * Nothing here computes a value. `formatFixed` is `Number.prototype.toFixed`
 * (round half away from zero on the exact binary value, as the app does
 * today) and never turns a non-finite number into a finite-looking one.
 */

export type UnitSystem = 'metric' | 'imperial';

export type QuantityKind =
  | 'mm'
  | 'm'
  | 'g'
  | 'kg'
  | 'density'
  | 'velocity'
  | 'acceleration'
  | 'force'
  | 'temperature'
  | 'pressure'
  | 'angle'
  | 'time'
  | 'ratio'
  | 'modulus' // shear modulus of fin materials (app plan 0031)
  | 'surfaceDensity'; // a streamer's material (plan 0073)

export interface DisplayRule {
  /** Unit label shown after the value; empty for a plain number. */
  readonly unit: string;
  readonly decimals: number;
}

/** Labels and decimals per quantity kind, as in the app's `units/display.ts`. */
export const UNIT_DISPLAY: Readonly<
  Record<UnitSystem, Readonly<Record<QuantityKind, DisplayRule>>>
> = {
  metric: {
    mm: { unit: 'mm', decimals: 1 },
    m: { unit: 'm', decimals: 2 },
    g: { unit: 'g', decimals: 1 },
    kg: { unit: 'kg', decimals: 3 },
    density: { unit: 'kg/m³', decimals: 0 },
    velocity: { unit: 'm/s', decimals: 1 },
    acceleration: { unit: 'm/s²', decimals: 1 },
    force: { unit: 'N', decimals: 1 },
    temperature: { unit: '°C', decimals: 1 },
    pressure: { unit: 'hPa', decimals: 1 },
    angle: { unit: '°', decimals: 1 },
    time: { unit: 's', decimals: 2 },
    modulus: { unit: 'GPa', decimals: 2 },
    ratio: { unit: '', decimals: 2 },
    surfaceDensity: { unit: 'g/m²', decimals: 0 },
  },
  imperial: {
    mm: { unit: 'in', decimals: 3 },
    m: { unit: 'ft', decimals: 1 },
    g: { unit: 'oz', decimals: 2 },
    kg: { unit: 'lb', decimals: 3 },
    density: { unit: 'lb/ft³', decimals: 1 },
    velocity: { unit: 'ft/s', decimals: 1 },
    acceleration: { unit: 'ft/s²', decimals: 1 },
    force: { unit: 'lbf', decimals: 2 },
    temperature: { unit: '°F', decimals: 1 },
    pressure: { unit: 'psi', decimals: 2 },
    modulus: { unit: '10⁶ psi', decimals: 3 },
    angle: { unit: '°', decimals: 1 },
    time: { unit: 's', decimals: 2 },
    ratio: { unit: '', decimals: 2 },
    surfaceDensity: { unit: 'oz/yd²', decimals: 2 },
  },
};

export type FigureKind =
  | 'stabilityMargin'
  | 'normalForceDerivative'
  | 'maxMach'
  | 'timeToApogee'
  | 'railExitTime'
  | 'burnoutTime'
  | 'deploymentTime'
  | 'flightTime'
  | 'eventTime'
  | 'bearing'
  | 'totalImpulse'
  | 'totalImpulseInList'
  | 'averageThrustInList'
  | 'burnTime'
  | 'recordedApogeeDifference'
  | 'runMillis'
  | 'thrustToWeight';

export interface FigureRule extends DisplayRule {
  /** The file under packages/ where the app applies this rounding. */
  readonly from: string;
  /**
   * A piece of the code on the line that applies it, found by text rather than by line
   * number so that edits elsewhere in the file do not break the check (D-083). That line
   * either rounds with `toFixed(decimals)` or reads this rule.
   */
  readonly marker: string;
}

/** Figures the app shows with a fixed number of decimals outside the unit table. */
export const FIGURE_DISPLAY: Readonly<Record<FigureKind, FigureRule>> = {
  stabilityMargin: {
    unit: 'calibers',
    decimals: 2,
    from: 'formats/src/design/to-physics.ts',
    marker: 'calibers.toFixed(2)',
  },
  normalForceDerivative: {
    unit: 'per radian',
    decimals: 2,
    from: 'app/src/components/StabilityPanel.tsx',
    marker: 'FIGURE_DISPLAY.normalForceDerivative.decimals',
  },
  maxMach: {
    unit: '',
    decimals: 3,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'fd.maxMach.decimals',
  },
  timeToApogee: {
    unit: 's',
    decimals: 2,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'fd.timeToApogee.decimals',
  },
  railExitTime: {
    unit: 's',
    decimals: 3,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 's.railExitTime.toFixed(fd.railExitTime.decimals)',
  },
  burnoutTime: {
    unit: 's',
    decimals: 2,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'fd.burnoutTime.decimals',
  },
  deploymentTime: {
    unit: 's',
    decimals: 2,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'fd.deploymentTime.decimals',
  },
  flightTime: {
    unit: 's',
    decimals: 2,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'fd.flightTime.decimals',
  },
  eventTime: {
    unit: 's',
    decimals: 3,
    from: 'app/src/components/FlightPanel.tsx',
    marker: '(e.time as number).toFixed(3)',
  },
  bearing: {
    unit: '°',
    decimals: 0,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'deg.toFixed(0)',
  },
  totalImpulse: {
    unit: 'N·s',
    decimals: 2,
    from: 'app/src/components/MotorPanel.tsx',
    marker: '<dd>{f.totalImpulse.toFixed(2)} N·s</dd>',
  },
  totalImpulseInList: {
    unit: 'N·s',
    decimals: 1,
    from: 'app/src/components/MotorPanel.tsx',
    marker: '{f.totalImpulse.toFixed(1)} N·s',
  },
  averageThrustInList: {
    unit: 'N',
    decimals: 1,
    from: 'app/src/components/MotorPanel.tsx',
    marker: 'm.avgThrustN.toFixed(1)',
  },
  burnTime: {
    unit: 's',
    decimals: 2,
    from: 'app/src/components/MotorPanel.tsx',
    marker: 'f.burnTime.toFixed(2)',
  },
  recordedApogeeDifference: {
    unit: '%',
    decimals: 1,
    from: 'app/src/components/ComparisonPanel.tsx',
    marker: '((simulatedApogee - recordedApogee) / record',
  },
  runMillis: {
    unit: 'ms',
    decimals: 0,
    from: 'app/src/components/FlightPanel.tsx',
    marker: 'flight.millis.toFixed(0)',
  },
  thrustToWeight: {
    unit: ': 1',
    decimals: 1,
    from: 'formats/src/design/to-physics.ts',
    marker: 'twr.toFixed(1)',
  },
};

/**
 * `value.toFixed(decimals)` for a finite value. A non-finite value is
 * written out as `NaN`, `Infinity` or `-Infinity`: it is never shown as a
 * number, a dash or a blank (CLAUDE.md 8). Components that receive one
 * also mark it as an error (see `isDisplayable`).
 */
export function formatFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(decimals);
}

/** True for a value that can be shown as a number. */
export function isDisplayable(value: number): boolean {
  return Number.isFinite(value);
}

/** "123.4 mm", or "1.84" when the unit label is empty: the app's `formatQuantity` layout. */
export function withUnit(text: string, unit: string): string {
  return unit === '' ? text : `${text} ${unit}`;
}

/** A value already in the display unit of `kind`, formatted by the table. */
export function formatQuantity(
  displayValue: number,
  kind: QuantityKind,
  system: UnitSystem,
): string {
  const rule = UNIT_DISPLAY[system][kind];
  return withUnit(formatFixed(displayValue, rule.decimals), rule.unit);
}

/** A figure formatted by `FIGURE_DISPLAY`, with its unit. */
export function formatFigure(value: number, kind: FigureKind): string {
  const rule = FIGURE_DISPLAY[kind];
  return withUnit(formatFixed(value, rule.decimals), rule.unit);
}

/**
 * The text an editable number field shows for a value (D-UI-3). The
 * current app shows `toFixed(max(decimals, 3))` with trailing zeros
 * removed; that rule is kept, except where it would misstate the value
 * (a non-zero value shown as 0, such as a tolerance of 1e-8, or any value
 * whose text reads back more than 0.1 % away from it). Then six
 * significant digits are shown instead, so a field never shows a number
 * it does not hold.
 */
export function editText(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return String(value);
  const fixed = Number(value.toFixed(Math.max(decimals, 3)));
  const misstated =
    (fixed === 0 && value !== 0) || Math.abs(fixed - value) > Math.abs(value) * 1e-3;
  return String(misstated ? Number(value.toPrecision(6)) : fixed);
}

/**
 * Parse what a user typed in a number field. Accepts an optional sign,
 * digits with an optional decimal point and an optional exponent; returns
 * undefined for anything else, including an empty field. Same grammar as
 * the app's `parseQuantity`.
 */
export function parseNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '' || !/^[-+]?(\d+(?:\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(trimmed))
    return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}
