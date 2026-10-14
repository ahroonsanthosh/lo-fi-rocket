/**
 * Plan 0073 part 3: rail buttons a file places past the end of the body. OpenRocket accepts them;
 * the import moves them onto the body and lists it, instead of the stability refusing the design
 * (the validation campaign's finding, CLAUDE.md rule 3).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { orkToDesign } from './design/from-ork.js';
import { designStability } from './design/to-physics.js';
import { parseOrk } from './ork.js';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  ...['..', '..', '..', 'reference', 'rockets', 'r2-ogive-boattail.ork'],
);
const r2 = strFromU8(
  unzipSync(new Uint8Array(readFileSync(FILE)))['rocket.ork'] ?? new Uint8Array(),
);

describe('rail buttons past the end of the body (plan 0073)', () => {
  it('moves the set forward until its last button sits a button diameter inside the end, and lists it', () => {
    // R2's two 10 mm buttons, the first at 0.45 m, spaced 0.40 m instead of 0.25 m: the second at
    // 0.85 m, 50 mm past the boat tail's end at 0.80 m. Moved forward by 0.85 − (0.80 − 0.01) =
    // 60 mm, to 0.39 m and 0.79 m.
    const edited = r2.replace(
      '<instanceseparation>0.25</instanceseparation>',
      '<instanceseparation>0.4</instanceseparation>',
    );
    expect(edited).not.toBe(r2);
    const rocket = parseOrk(edited, 'edited.ork');
    const buttons = rocket.components.find((c) => c.component.kind === 'railButton');
    expect(buttons?.position).toBeCloseTo(0.39, 12);
    expect(buttons?.component).toMatchObject({ separation: 0.4 });
    expect(buttons?.approximations?.map((a) => [a.what, a.method, a.impact])).toEqual([
      [
        'buttons the file places past the end of the body (the last 50 mm beyond it)',
        'the set moved 60 mm forward so that every button sits on the body',
        'minor',
      ],
    ]);
    // The design now has a stability figure instead of a refusal.
    const { design } = orkToDesign(rocket, [], 'r2');
    expect(designStability(design).result.marginLiftoff).toBeGreaterThan(0);
  });

  it('shortens the spacing when the set is longer than the body, and leaves buttons on the body alone', () => {
    const long = parseOrk(
      r2.replace(
        '<instanceseparation>0.25</instanceseparation>',
        '<instanceseparation>2.0</instanceseparation>',
      ),
      'long.ork',
    );
    const buttons = long.components.find((c) => c.component.kind === 'railButton');
    // A button diameter inside each end, 0.01 m to 0.79 m: one spacing of 0.78 m.
    expect(buttons?.position).toBeCloseTo(0.01, 12);
    expect(buttons?.component).toMatchObject({ separation: 0.78 });
    expect(buttons?.approximations?.[0]?.method).toBe(
      'the set moved to the front of the body and its spacing shortened to 780 mm',
    );
    const plain = parseOrk(r2, 'r2.ork');
    const untouched = plain.components.find((c) => c.component.kind === 'railButton');
    expect(untouched?.position).toBeCloseTo(0.45, 12);
    expect(untouched?.approximations).toBeUndefined();
  });
});
