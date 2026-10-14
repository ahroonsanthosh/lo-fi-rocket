/**
 * Quantities as Claude passes them (plan 0062): an SI number, or a string with a unit such as
 * "38 mm", "1.5 in", "4 oz" or "3 deg". Every conversion is a sourced function of the physics
 * package (UNIT-1 to UNIT-13, docs/equations.md), so no unit arithmetic is left to the caller.
 */
import {
  celsiusToKelvin,
  centimetresToMetres,
  degreesToRadians,
  fahrenheitToKelvin,
  feetPerSecondToMetresPerSecond,
  feetToMetres,
  gramsPerCubicCentimetreToKilogramsPerCubicMetre,
  gramsToKilograms,
  hectopascalsToPascals,
  inchesToMetres,
  kilometresPerHourToMetresPerSecond,
  kilopascalsToPascals,
  milesPerHourToMetresPerSecond,
  millimetresToMetres,
  millisecondsToSeconds,
  ouncesToKilograms,
  poundsToKilograms,
} from '@lo-fi-rocket/physics';

export type Dimension =
  | 'length'
  | 'mass'
  | 'angle'
  | 'time'
  | 'speed'
  | 'temperature'
  | 'pressure'
  | 'density'
  | 'surfaceDensity'
  | 'number';

/** The SI unit of each dimension, as the tools report it. */
export const SI_UNIT: Readonly<Record<Dimension, string>> = {
  length: 'm',
  mass: 'kg',
  angle: 'rad',
  time: 's',
  speed: 'm/s',
  temperature: 'K',
  pressure: 'Pa',
  density: 'kg/m³',
  surfaceDensity: 'kg/m²',
  number: '',
};

const identity = (x: number): number => x;
const ouncesPerSquareYard = (x: number): number => ouncesToKilograms(x) / feetToMetres(3) ** 2;

/** Accepted unit symbols per dimension (lower case, spaces removed), each with its conversion. */
export const UNITS: Readonly<Record<Dimension, Readonly<Record<string, (x: number) => number>>>> = {
  length: {
    m: identity,
    cm: centimetresToMetres,
    mm: millimetresToMetres,
    in: inchesToMetres,
    '"': inchesToMetres,
    ft: feetToMetres,
    "'": feetToMetres,
  },
  mass: {
    kg: identity,
    g: gramsToKilograms,
    lb: poundsToKilograms,
    lbs: poundsToKilograms,
    oz: ouncesToKilograms,
  },
  angle: { rad: identity, deg: degreesToRadians, '°': degreesToRadians },
  time: { s: identity, ms: millisecondsToSeconds },
  speed: {
    'm/s': identity,
    'ft/s': feetPerSecondToMetresPerSecond,
    fps: feetPerSecondToMetresPerSecond,
    mph: milesPerHourToMetresPerSecond,
    'km/h': kilometresPerHourToMetresPerSecond,
  },
  temperature: {
    k: identity,
    c: celsiusToKelvin,
    '°c': celsiusToKelvin,
    f: fahrenheitToKelvin,
    '°f': fahrenheitToKelvin,
  },
  pressure: { pa: identity, hpa: hectopascalsToPascals, kpa: kilopascalsToPascals },
  density: {
    'kg/m3': identity,
    'kg/m^3': identity,
    'kg/m³': identity,
    'g/cm3': gramsPerCubicCentimetreToKilogramsPerCubicMetre,
    'g/cm^3': gramsPerCubicCentimetreToKilogramsPerCubicMetre,
    'g/cm³': gramsPerCubicCentimetreToKilogramsPerCubicMetre,
  },
  // Plan 0073: a streamer's material. 1 g/m² = 10⁻³ kg/m² (UNIT-2); 1 oz/yd² is 1 oz over
  // (3 ft)², 0.0339057 kg/m² (NIST SP 811 B.8 p. 52 prints 3.390 575 E−02).
  surfaceDensity: {
    'kg/m2': identity,
    'kg/m^2': identity,
    'kg/m²': identity,
    'g/m2': gramsToKilograms,
    'g/m^2': gramsToKilograms,
    'g/m²': gramsToKilograms,
    gsm: gramsToKilograms,
    'oz/yd2': ouncesPerSquareYard,
    'oz/yd^2': ouncesPerSquareYard,
    'oz/yd²': ouncesPerSquareYard,
  },
  number: {},
};

/** A quantity input that cannot be read, with what to write instead. */
export class QuantityError extends Error {
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'QuantityError';
  }
}

// The number at the start of the text. Unambiguous and not anchored at the end, so it cannot
// backtrack once it has matched (CodeQL js/polynomial-redos); the unit is the rest of the text.
const LEADING_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

/** The SI value of `value` for `field`, or a QuantityError naming the field and the accepted units. */
export function toSi(field: string, dimension: Dimension, value: number | string): number {
  const accepted = (): string => {
    const units = Object.keys(UNITS[dimension]);
    return units.length === 0
      ? 'a plain number'
      : `a number in ${SI_UNIT[dimension]} or one of ${units.join(', ')}`;
  };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new QuantityError(field, `must be a finite number`);
    return value;
  }
  const text = value.trim();
  const m = LEADING_NUMBER.exec(text);
  if (m === null) throw new QuantityError(field, `"${value}" is not ${accepted()}`);
  const x = Number(m[0]);
  const written = text.slice(m[0].length).trim();
  const unit = written.replace(/\s+/g, '').toLowerCase();
  if (unit === '') {
    if (!Number.isFinite(x)) throw new QuantityError(field, `must be a finite number`);
    return x;
  }
  const convert = UNITS[dimension][unit];
  if (convert === undefined) {
    throw new QuantityError(field, `unit "${written}" is not accepted; give ${accepted()}`);
  }
  return convert(x);
}
