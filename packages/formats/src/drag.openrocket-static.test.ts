/**
 * Plan 0071 (D-108): the reference rockets' drag at Mach 0.10, 0.14 and 0.18 in the
 * OpenRocket-equivalent mode against OpenRocket 24.12's own static figures
 * (reference/rockets/drag-probe/values.txt part 1), total and rail button share. Bounds are the
 * observed agreement, as regression guards: totals within 0.4 to 0.7 % (R1 1.2 %, its launch lug, which
 * OpenRocket does not compute by Niskanen eq. (3.95)); the rest is the skin friction, about 1.4 %
 * higher here on every rocket (plan 0071 section 7). Rail buttons within 0.2 %.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dragCoefficient, mach, metres, ROUGHNESS_HEIGHTS } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { parseOrk } from './ork.js';

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
/** OpenRocket's static conditions (values.txt header). */
const SPEED_OF_SOUND = 343.4189;
const NU = 1.52562878e-5;

const values = readFileSync(join(REFERENCE, 'rockets', 'drag-probe', 'values.txt'), 'utf8');
function openRocket(file: string, m: number): number {
  const line = values
    .split('\n')
    .find((l) => l.startsWith(`${file}.ork: Mach ${m.toFixed(2)} static`));
  const cd = line === undefined ? undefined : /static cd=([0-9.]+)/.exec(line)?.[1];
  if (cd === undefined) throw new Error(`${file} Mach ${String(m)} not in values.txt`);
  return Number(cd);
}
function openRocketParts(file: string): number {
  const line = values.split('\n').find((l) => l.startsWith(`${file}.ork: Mach 0.10 cd with`));
  const v = line === undefined ? undefined : /their drag=([0-9.]+)/.exec(line)?.[1];
  if (v === undefined) throw new Error(`${file} parts not in values.txt`);
  return Number(v);
}

const ROCKETS = [
  { file: 'r1-three-fin-conical', total: 0.013, parts: Number.NaN },
  { file: 'r2-ogive-boattail', total: 0.006, parts: 0.003 },
  { file: 'r3-minimum-diameter-24', total: 0.007, parts: 0.003 },
  { file: 'r4-scratch-38mm', total: 0.005, parts: 0.003 },
  { file: 'r5-transonic-min-dia-29', total: 0.007, parts: 0.003 },
] as const;

describe('reference rockets: static drag against OpenRocket 24.12 (comparison mode, D-108)', () => {
  const report: string[] = [];
  for (const c of ROCKETS) {
    it(c.file, () => {
      const rocket = parseOrk(
        new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${c.file}.ork`))),
        `${c.file}.ork`,
      );
      const length: number = rocket.length;
      for (const m of [0.1, 0.14, 0.18]) {
        const r = dragCoefficient({
          components: rocket.components,
          mach: mach(m),
          reynolds: (m * SPEED_OF_SOUND * length) / NU,
          roughnessHeight: metres(ROUGHNESS_HEIGHTS.regularPaint60um),
          baseDragMotorRule: 'never',
          railButtonDragMethod: 'openrocket',
          baseDragMethod: 'niskanen',
          bodyFormFactor: 'niskanen',
          finFrictionLength: 'rocket',
        });
        const or = openRocket(c.file, m);
        const rel = (r.cd0 as number) / or - 1;
        const buttons = r.terms
          .filter((t) => t.kind === 'railButton')
          .reduce((s, t) => s + t.cd, 0);
        report.push(
          `${c.file} M ${m.toFixed(2)}: ours ${(r.cd0 as number).toFixed(5)} OpenRocket ${or.toFixed(5)} (${(rel * 100).toFixed(2)} %), friction ${r.skinFriction.cd.toFixed(5)}${buttons > 0 ? `, rail buttons ${buttons.toFixed(5)}` : ''}`,
        );
        expect(Math.abs(rel)).toBeLessThan(c.total);
        if (m === 0.1 && !Number.isNaN(c.parts)) {
          expect(Math.abs(buttons / openRocketParts(c.file) - 1)).toBeLessThan(c.parts);
        }
      }
    });
  }
  it('writes the table', () => {
    const path = process.env['DRAG_STATIC_REPORT'];
    if (path !== undefined) writeFileSync(path, `${report.join('\n')}\n`);
    expect(report.length).toBe(15);
  });
});
