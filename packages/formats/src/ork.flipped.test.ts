/**
 * Plan 0068 (D-104): flipped nose cones, as OpenRocket 24.12 wrote them for the probe
 * (reference/rockets/flipped-nose-probe/values.txt), read as transitions to a point and compared
 * with OpenRocket's figures for the files.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  componentMassProperties,
  kilogramsPerCubicMetre,
  metres,
  rocketMassProperties,
  type NoseShape,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { orkToDesign } from './design/from-ork.js';
import { designStability } from './design/to-physics.js';
import { parseOrk, type OrkRocket } from './ork.js';

const PROBE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'rockets',
  'flipped-nose-probe',
);
const read = (name: string): OrkRocket =>
  parseOrk(new Uint8Array(readFileSync(join(PROBE, `${name}.ork`))), `${name}.ork`);
const relative = (ours: number, theirs: number): number => Math.abs(ours / theirs - 1);

// values.txt: the tail's mass (kg) and CG, and the rocket's worst-case CP at Mach 0.3 and structure
// CG, x from the nose tip in metres. The flipped cone and the transition agree to every digit.
const CASES: readonly {
  /** OpenRocket's name, in the file names. */
  file: string;
  shape: NoseShape;
  parameter?: number;
  mass: number;
  cg: number;
  cp: number;
  rocketCg: number;
}[] = [
  {
    file: 'conical',
    shape: 'conical',
    mass: 0.015637564,
    cg: 0.551998334,
    cp: 0.397098932,
    rocketCg: 0.355938637,
  },
  {
    file: 'ogive',
    shape: 'ogive',
    parameter: 1,
    mass: 0.02139529,
    cg: 0.557578094,
    cp: 0.394388188,
    rocketCg: 0.366584488,
  },
  {
    file: 'ellipsoid',
    shape: 'elliptical',
    mass: 0.025060304,
    cg: 0.562716284,
    cp: 0.392784728,
    rocketCg: 0.373438483,
  },
  {
    file: 'power',
    shape: 'power',
    parameter: 0.5,
    mass: 0.02102469,
    cg: 0.559669013,
    cp: 0.394941807,
    rocketCg: 0.366355012,
  },
  {
    file: 'parabolic',
    shape: 'parabolic',
    parameter: 0.75,
    mass: 0.018881026,
    cg: 0.555476978,
    cp: 0.395649243,
    rocketCg: 0.36205343,
  },
  {
    file: 'haack',
    shape: 'haack',
    parameter: 0,
    mass: 0.020552627,
    cg: 0.557625212,
    cp: 0.394941695,
    rocketCg: 0.365210234,
  },
];

describe('flipped nose cones from .ork files (plan 0068)', () => {
  for (const c of CASES) {
    it(`${c.file}: a transition from 25 mm to 0, with OpenRocket's mass, CG and CP`, () => {
      for (const file of [`flipped-${c.file}`, `transition-${c.file}`]) {
        const r = read(file);
        expect(r.approximations).toEqual([]);
        const tail = r.components.find((p) => p.name === 'Tail');
        expect(tail?.position).toBeCloseTo(0.52, 12);
        expect(tail?.component).toMatchObject({
          kind: 'transition',
          length: 0.1,
          foreRadius: 0.025,
          aftRadius: 0,
          wallThickness: 0.002,
        });
        if (tail === undefined) throw new Error('no tail');
        // The flip is exact: the tail is our own nose cone of the same shape, reversed.
        const part = rocketMassProperties([tail]);
        const nose = componentMassProperties({
          kind: 'noseCone',
          shape: c.shape,
          length: metres(0.1),
          baseRadius: metres(0.025),
          ...(c.parameter === undefined ? {} : { shapeParameter: c.parameter }),
          wallThickness: metres(0.002),
          density: kilogramsPerCubicMetre(1050),
        });
        expect(relative(part.mass, nose.mass)).toBeLessThan(1e-9);
        expect(part.cg - 0.52).toBeCloseTo(0.1 - nose.cgX, 9);
        // Against OpenRocket: the cone within the quadrature's 1e-6 (D-025; 2.3e-7 in mass); the
        // curved shells within the first-order wall offset's accuracy (D-024), least good on the
        // blunt tips of the ellipsoid and power 0.5: mass 0.022 % and 0.014 %, CG 0.0021 % and
        // 0.0014 %.
        expect(relative(part.mass, c.mass)).toBeLessThan(c.shape === 'conical' ? 1e-6 : 3e-4);
        expect(relative(part.cg, c.cg)).toBeLessThan(c.shape === 'conical' ? 1e-6 : 3e-5);
        // The rocket: CG within 1 % and CP within 2 % (CLAUDE.md 7.4); in fact within 0.003 % and
        // 0.023 %.
        const rocket = rocketMassProperties(r.components);
        const cp = designStability(orkToDesign(r, [], file).design, 'openrocket-equivalent').result
          .centreOfPressure.cp;
        expect(relative(rocket.cg, c.rocketCg)).toBeLessThan(0.01);
        expect(relative(cp, c.cp)).toBeLessThan(0.02);
      }
    });
  }

  it('the base shoulder reaches forward from the base, as OpenRocket places it', () => {
    // values.txt, flipped-ogive-shoulder: the part with its shoulder (30 mm long, radius 24 mm, wall
    // 2 mm) is 0.030499625 kg at 0.541883193 m. By hand: the shoulder is π(0.024² − 0.022²)(0.03)
    // (1050) = 9.1044e-3 kg centred at 0.52 − 0.015 = 0.505 m; with the ogive tail (0.021395 kg at
    // 0.557578 m) that is 0.0304997 kg at 0.541882 m.
    const r = read('flipped-ogive-shoulder');
    expect(r.approximations).toEqual([]);
    const parts = r.components.filter((p) => p.name.startsWith('Tail'));
    expect(parts.map((p) => [p.name, p.component.kind, p.position])).toEqual([
      ['Tail', 'transition', 0.52],
      ['Tail (shoulder)', 'innerTube', 0.49],
    ]);
    const shoulder = rocketMassProperties(parts.slice(1));
    expect(shoulder.mass).toBeCloseTo(Math.PI * (0.024 ** 2 - 0.022 ** 2) * 0.03 * 1050, 12);
    expect(shoulder.cg).toBeCloseTo(0.505, 12);
    const all = rocketMassProperties(parts);
    expect(relative(all.mass, 0.030499625)).toBeLessThan(3e-5);
    expect(relative(all.cg, 0.541883193)).toBeLessThan(3e-6);
  });

  it('parts inside a flipped cone are placed as OpenRocket places them', () => {
    // values.txt, flipped-ogive-children: "top" + 0.01 m starts 0.53 m from the nose tip (the cone's
    // front at 0.52 m), and "bottom" + 0 ends at the point (0.62 m), starting at 0.60 m; with the
    // structure 0.104851170 kg at 0.370949224 m.
    const r = read('flipped-ogive-children');
    expect(r.approximations).toEqual([]);
    const child = (name: string) => r.components.find((p) => p.name === name);
    expect(child('Top')?.position).toBeCloseTo(0.53, 12);
    expect(child('Bottom')?.position).toBeCloseTo(0.6, 12);
    const all = rocketMassProperties(r.components);
    expect(relative(all.mass, 0.10485117)).toBeLessThan(3e-5);
    expect(relative(all.cg, 0.370949224)).toBeLessThan(3e-5);
  });
});
