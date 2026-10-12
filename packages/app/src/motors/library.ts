/**
 * The motor library (plan 0013): the bundled reference motors (the eight
 * `.eng` files of reference/motors, imported as text at build time), plus
 * the motors the user imported or downloaded, kept in local storage
 * through the formats package's cache.
 */
import {
  listCachedMotors,
  motorFromEng,
  parseEng,
  type CachedMotor,
  type KeyValueStore,
  type MotorProvenance,
} from '@lo-fi-rocket/formats';
import { burnTime, totalImpulse, type MotorDefinition, type Seconds } from '@lo-fi-rocket/physics';
import f39t from './bundled/AeroTech_F39T.eng?raw';
import g80t from './bundled/AeroTech_G80T.eng?raw';
import h123w from './bundled/AeroTech_H123W.eng?raw';
import h128w from './bundled/AeroTech_H128W.eng?raw';
import h238t from './bundled/AeroTech_H238T.eng?raw';
import c6 from './bundled/Estes_C6.eng?raw';
import d12 from './bundled/Estes_D12.eng?raw';
import e16 from './bundled/Estes_E16.eng?raw';

export interface LibraryMotor {
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
  /** Delays the data file lists, or undefined when the file gives none; 'plugged' when it has no ejection charge. */
  readonly delays: readonly Seconds[] | 'plugged' | undefined;
  readonly fileText: string | undefined;
  readonly infoUrl: string | undefined;
}

const BUNDLED_FILES: readonly { file: string; text: string }[] = [
  { file: 'Estes_C6.eng', text: c6 },
  { file: 'Estes_D12.eng', text: d12 },
  { file: 'Estes_E16.eng', text: e16 },
  { file: 'AeroTech_F39T.eng', text: f39t },
  { file: 'AeroTech_G80T.eng', text: g80t },
  { file: 'AeroTech_H128W.eng', text: h128w },
  { file: 'AeroTech_H238T.eng', text: h238t },
  { file: 'AeroTech_H123W.eng', text: h123w },
];

export function bundledMotors(): LibraryMotor[] {
  return BUNDLED_FILES.map(({ file, text }) => {
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

/** Delays a cached motor's RASP file lists, re-read from the stored text. */
function delaysOf(entry: CachedMotor): LibraryMotor['delays'] {
  if (entry.fileText === undefined || entry.definition.sourceFormat !== 'RASP') return undefined;
  try {
    return parseEng(entry.fileText)[0]?.delays;
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
