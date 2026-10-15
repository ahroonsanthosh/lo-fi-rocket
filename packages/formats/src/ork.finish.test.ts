/**
 * Plan 0073 (D-110): each part's surface finish read from an `.ork` file, against OpenRocket
 * 24.12's own skin friction for the same rockets (`FinishProbe`,
 * reference/rockets/finish-probe/values.txt): an ogive-nosed 50 mm rocket with three fins and a
 * lug, every part in one finish, then mixed finishes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dragCoefficient, mach } from '@lo-fi-rocket/physics';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { orkToDesign } from './design/from-ork.js';
import { designPlacedComponents } from './design/to-physics.js';
import { OPENROCKET_FINISHES, parseOrk, type OrkRocket } from './ork.js';

const PROBE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'rockets',
  'finish-probe',
);
/** OpenRocket's static conditions (reference/rockets/drag-probe/values.txt header). */
const SPEED_OF_SOUND = 343.4189;
const NU = 1.52562878e-5;

const values = readFileSync(join(PROBE, 'values.txt'), 'utf8').split('\n');
/** OpenRocket's total friction drag coefficient for the file's rocket at the Mach number. */
function openRocketFriction(tag: string, m: number): number {
  const line = values.find((l) => l.startsWith(`${tag} M=${m.toFixed(2)} total`));
  const v = line === undefined ? undefined : / friction=([0-9.e+-]+)/.exec(line)?.[1];
  if (v === undefined) throw new Error(`${tag} Mach ${String(m)} not in values.txt`);
  return Number(v);
}
const read = (tag: string): OrkRocket =>
  parseOrk(new Uint8Array(readFileSync(join(PROBE, `finish-${tag}.ork`))), `finish-${tag}.ork`);

function ourFriction(rocket: OrkRocket, m: number): number {
  return dragCoefficient({
    components: rocket.components,
    mach: mach(m),
    reynolds: (m * SPEED_OF_SOUND * (rocket.length as number)) / NU,
    roughnessHeight: rocket.roughnessHeight,
    baseDragMotorRule: 'never',
    // Against OpenRocket: eq. (3.85)'s body form factor, as the comparison mode (plan 0076).
    bodyFormFactor: 'niskanen',
    finFrictionLength: 'rocket',
  }).skinFriction.cd;
}

const FINISHES = Object.keys(OPENROCKET_FINISHES);

describe('surface finishes in .ork files (plan 0073, D-110)', () => {
  it('reads each of OpenRocket’s nine finishes, as the design’s, with no part of its own', () => {
    expect(FINISHES).toHaveLength(9);
    for (const name of FINISHES) {
      const rocket = read(`uniform-${name}`);
      expect(rocket.roughnessHeight, name).toBe(OPENROCKET_FINISHES[name]);
      expect(rocket.components.every((c) => c.roughnessHeight === undefined)).toBe(true);
      expect(rocket.components.flatMap((c) => c.approximations ?? [])).toEqual([]);
      const { design } = orkToDesign(rocket, [], 'd');
      expect(design.finish.roughnessHeight).toBe(OPENROCKET_FINISHES[name]);
    }
  });

  it('keeps each part’s own finish where they differ, the nose’s (the first of a tie) as the design’s', () => {
    // Nose polished (2 µm), body rough (500 µm), fins smooth (20 µm); the lug's finish
    // (unfinished) does not enter its drag (eq. 3.95) and is not kept.
    const rocket = read('mixed');
    expect(rocket.roughnessHeight).toBe(2e-6);
    const own = (kind: string): number | undefined =>
      rocket.components.find((c) => c.component.kind === kind)?.roughnessHeight;
    expect(own('noseCone')).toBeUndefined();
    expect(own('bodyTube')).toBe(500e-6);
    expect(own('finSet')).toBe(20e-6);
    expect(own('launchLug')).toBeUndefined();
    // The design file keeps them, and they reach the physics.
    const { design } = orkToDesign(rocket, [], 'd');
    expect(design.finish.roughnessHeight).toBe(2e-6);
    const placed = designPlacedComponents(design);
    expect(placed.map((p) => p.roughnessHeight)).toEqual(
      rocket.components.map((c) => c.roughnessHeight),
    );
  });

  it('skin friction against OpenRocket’s, every finish and the mixed files, at Mach 0.1, 0.3, 0.8 and 1.5', () => {
    // Our body friction is eq. (3.85) as printed, 1 + 1/(2 f_B) with f_B = 15 here, where
    // OpenRocket 24.12 uses 1 + 1/(4 f_B) (validation campaign item 7): 1.6 % more on the body
    // term, about 1.3 % on the total. Beside it, every finish agrees within 0.2 % (observed ±0.11 %).
    const tags = [
      ...FINISHES.map((n) => `uniform-${n}`),
      'mixed',
      'nose-rough',
      'body-rough',
      'fins-rough',
      'lug-rough',
    ];
    const reference =
      ourFriction(read('uniform-normal'), 0.3) / openRocketFriction('uniform-normal', 0.3);
    expect(reference).toBeGreaterThan(1.01);
    expect(reference).toBeLessThan(1.017);
    for (const tag of tags) {
      const rocket = read(tag);
      for (const m of [0.1, 0.3, 0.8, 1.5]) {
        const ratio = ourFriction(rocket, m) / openRocketFriction(tag, m);
        expect(Math.abs(ratio / reference - 1), `${tag} M ${String(m)}`).toBeLessThan(0.002);
      }
    }
  });

  it('lists a finish it does not know and flies that part as regular paint, OpenRocket’s default', () => {
    const zipped = new Uint8Array(readFileSync(join(PROBE, 'finish-uniform-smooth.ork')));
    const xml = strFromU8(unzipSync(zipped)['rocket.ork'] ?? new Uint8Array());
    const glossy = xml.replace('<finish>smooth</finish>', '<finish>glossy</finish>');
    expect(glossy).not.toBe(xml);
    const rocket = parseOrk(strToU8(glossy), 'glossy.ork');
    const nose = rocket.components.find((c) => c.component.kind === 'noseCone');
    expect(rocket.roughnessHeight).toBe(20e-6);
    expect(nose?.roughnessHeight).toBe(60e-6);
    expect(nose?.approximations?.map((a) => a.what)).toEqual([
      'the surface finish "glossy", which the app does not know',
    ]);
    expect(nose?.approximations?.[0]?.impact).toBe('moderate');
  });
});
