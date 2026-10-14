/**
 * The motor library (plan 0013): the bundled reference motors (the eight
 * `.eng` files of reference/motors, held as text by the formats package), plus
 * the motors the user imported or downloaded, kept in local storage
 * through the formats package's cache.
 */
import {
  BUNDLED_MOTOR_FILES,
  listCachedMotors,
  motorFromEng,
  parseEng,
  parseRse,
  type CachedMotor,
  type KeyValueStore,
  type MotorProvenance,
} from '@lo-fi-rocket/formats';
import { burnTime, totalImpulse, type MotorDefinition, type Seconds } from '@lo-fi-rocket/physics';

export interface LibraryMotor {
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
  /** Delays the data file lists, or undefined when the file gives none; 'plugged' when it has no ejection charge. */
  readonly delays: readonly Seconds[] | 'plugged' | undefined;
  readonly fileText: string | undefined;
  readonly infoUrl: string | undefined;
}

export function bundledMotors(): LibraryMotor[] {
  return BUNDLED_MOTOR_FILES.map(({ file, text }) => {
    const eng = parseEng(text, file)[0];
    if (eng === undefined) throw new Error(`${file}: no motor in the bundled file`);
    return {
      definition: motorFromEng(eng),
      provenance: { kind: 'bundled', file },
      delays: eng.delays,
      fileText: text,
      infoUrl: undefined,
    };
  });
}

/** Delays a cached motor's RASP or RockSim file lists, re-read from the stored text. */
function delaysOf(entry: CachedMotor): LibraryMotor['delays'] {
  if (entry.fileText === undefined) return undefined;
  try {
    if (entry.definition.sourceFormat === 'RASP') return parseEng(entry.fileText)[0]?.delays;
    if (entry.definition.sourceFormat === 'RockSim')
      return parseRse(entry.fileText, {}, 'cached motor')[0]?.delays;
    return undefined;
  } catch {
    return undefined;
  }
}

export function storedMotors(store: KeyValueStore): { motors: LibraryMotor[]; problems: string[] } {
  const { entries, problems } = listCachedMotors(store);
  return {
    motors: entries.map((e) => ({
      definition: e.definition,
      provenance: e.provenance,
      delays: delaysOf(e),
      fileText: e.fileText,
      infoUrl: e.infoUrl,
    })),
    problems,
  };
}

export interface MotorFigures {
  readonly totalImpulse: number;
  readonly burnTime: number;
  readonly averageThrust: number;
  readonly maxThrust: number;
}

/** MOT-2 total impulse, MOT-1 burn time to the last point, and their quotient (plan 0013 "Sources"). */
export function motorFigures(def: MotorDefinition): MotorFigures {
  const impulse: number = totalImpulse(def);
  const burn: number = burnTime(def);
  let maxThrust = 0;
  for (const p of def.points) maxThrust = Math.max(maxThrust, p.thrust);
  return { totalImpulse: impulse, burnTime: burn, averageThrust: impulse / burn, maxThrust };
}

export function provenanceLabel(p: MotorProvenance): string {
  switch (p.kind) {
    case 'bundled':
      return `bundled (${p.file})`;
    case 'thrustcurve':
      return `ThrustCurve.org (${p.motorId})`;
    case 'file':
      return `imported (${p.fileName})`;
    case 'custom':
      return 'custom thrust curve';
  }
}

/** A local-storage adapter with key listing, for the cache. */
export function keyValueStore(storage: Storage): KeyValueStore {
  return {
    getItem: (k) => storage.getItem(k),
    setItem: (k, v) => {
      storage.setItem(k, v);
    },
    removeItem: (k) => {
      storage.removeItem(k);
    },
    keys: () => {
      const out: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    },
  };
}
