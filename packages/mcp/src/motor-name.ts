/**
 * A motor named the way people write it (plan 0079): "D12-5", "Estes D12", "G80-7T",
 * "AeroTech H128W-M", "1/2A6-2". The code is the NAR/TRA designation: an impulse class letter
 * (with 1/2, 1/4 or 1/8 for the smallest), the average thrust in newtons, an optional propellant
 * suffix (AeroTech's "T", "W", ...), and the delay after a dash, in seconds, or "P" for plugged.
 * AeroTech also writes the suffix after the delay ("G80-7T"). Letter delay codes ("-M", the
 * medium delay of an adjustable reload) are not seconds and are left to the user.
 */
import type { LibraryMotor } from './session.js';

export interface MotorName {
  /** The words before the code, as given ("Estes", "AeroTech"); empty when none. */
  readonly manufacturer: string;
  /** Class, thrust and propellant suffix, upper case: "D12", "G80T", "1/2A6". */
  readonly designation: string;
  /** Class and thrust only, the ThrustCurve.org common name: "D12", "G80", "1/2A6". */
  readonly commonName: string;
  /** Seconds after burnout, "plugged", or undefined when the name gives none. */
  readonly delay?: number | 'plugged';
  /** A delay given as letters other than P ("M"), which is not a time. */
  readonly delayCode?: string;
}

const CODE =
  /^((?:1\/[248])?[A-Oa-o])(\d+(?:\.\d+)?)([A-Za-z]*)(?:-(\d+(?:\.\d+)?|[A-Za-z]+))?([A-Za-z]*)$/;

/** The motor code read from a name, or undefined when no word of it is a motor code. */
export function parseMotorName(text: string): MotorName | undefined {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '');
  // The code is the last word that reads as one ("Estes D12-5 black powder": D12-5).
  for (let i = words.length - 1; i >= 0; i--) {
    const m = CODE.exec(words[i] ?? '');
    if (m === null) continue;
    const [, cls = '', thrust = '', before = '', delay, after = ''] = m;
    const commonName = `${cls}${thrust}`.toUpperCase();
    // The propellant letters come before the delay or after it ("G80T-7", "G80-7T"), not both:
    // letters after a delay that follows them are a delay mark ("H128W-14A", A for adjustable).
    const designation = `${commonName}${before === '' ? after : before}`.toUpperCase();
    const manufacturer = words.slice(0, i).join(' ');
    if (delay === undefined) return { manufacturer, designation, commonName };
    if (/^\d/.test(delay)) return { manufacturer, designation, commonName, delay: Number(delay) };
    if (delay.toUpperCase() === 'P')
      return { manufacturer, designation, commonName, delay: 'plugged' };
    return { manufacturer, designation, commonName, delayCode: delay.toUpperCase() };
  }
  return undefined;
}

/** Manufacturer names and the abbreviations motor files and ThrustCurve.org use for them. */
const MANUFACTURER_ALIASES: readonly (readonly string[])[] = [
  ['aerotech', 'at', 'aerotech/rcs', 'rcs'],
  ['estes', 'e', 'estes industries'],
  ['cesaroni', 'cti', 'cesaroni technology'],
  ['apogee', 'a', 'apogee components'],
  ['quest', 'q', 'quest aerospace'],
  ['loki', 'loki research'],
  ['animal motor works', 'amw'],
];

/** True when the motor's maker is the one written (or nothing was written). */
export function sameManufacturer(written: string, maker: string): boolean {
  const w = written.trim().toLowerCase();
  if (w === '') return true;
  const m = maker.trim().toLowerCase();
  if (w === m) return true;
  // A part of the name ("Estes" in "Estes Industries"), never a one- or two-letter abbreviation.
  if (Math.min(w.length, m.length) >= 3 && (m.includes(w) || w.includes(m))) return true;
  return MANUFACTURER_ALIASES.some((names) => names.includes(w) && names.includes(m));
}

/** Compact upper-case form of a designation, for comparison ("G80T", "D12"). */
export function compactDesignation(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * The library motors that a parsed name means: the same designation, or, when the name gives
 * no propellant suffix, the motors whose designation is the common name plus letters. A
 * manufacturer written in the name must match: another maker's motor with the same code is
 * never put in its place (its thrust curve differs).
 */
export function matchLibrary(name: MotorName, library: readonly LibraryMotor[]): LibraryMotor[] {
  const exact = library.filter(
    (m) => compactDesignation(m.definition.designation) === name.designation,
  );
  const byCommon =
    exact.length > 0 || name.designation !== name.commonName
      ? exact
      : library.filter((m) => {
          const d = compactDesignation(m.definition.designation);
          return d.startsWith(name.commonName) && /^[A-Z]*$/.test(d.slice(name.commonName.length));
        });
  return byCommon.filter((m) => sameManufacturer(name.manufacturer, m.definition.manufacturer));
}
