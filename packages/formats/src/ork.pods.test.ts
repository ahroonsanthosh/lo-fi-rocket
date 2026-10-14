/**
 * Plan 0070 step 3 (D-107): pod sets, as OpenRocket 24.12 wrote them for the pod probe
 * (reference/rockets/pod-probe/values.txt and positions.txt), read as parts repeated around the
 * axis (D-106) and compared with OpenRocket's figures for the files.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rocketMassProperties } from '@lo-fi-rocket/physics';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { OrkUnsupportedFeaturesError } from './errors.js';
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
  'pod-probe',
);
const bytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(PROBE, `${name}.ork`)));
const read = (name: string): OrkRocket => parseOrk(bytes(name), `${name}.ork`);
const relative = (ours: number, theirs: number): number => Math.abs(ours / theirs - 1);
const podParts = (r: OrkRocket) => r.components.filter((c) => c.instances !== undefined);

/** The XML of a probe file, to edit. */
function xml(name: string): string {
  const r = bytes(name);
  // The probe's .ork files are zips; the edited ones are bare XML.
  if (r[0] !== 0x50) return new TextDecoder().decode(r);
  const entry = unzipSync(r)['rocket.ork'];
  if (entry === undefined) throw new Error(`${name}: no rocket.ork`);
  return strFromU8(entry);
}

// values.txt: the rocket's worst CP and C_Nα at Mach 0.3 and its structure mass and CG.
const ROCKETS = [
  { file: 'pods1', count: 2, cp: 0.484231998, cna: 18.450582104, m: 0.119470467, cg: 0.390034409 },
  { file: 'pods2', count: 2, cp: 0.50227679, cna: 23.414483926, m: 0.128110467, cg: 0.402817929 },
  { file: 'pods3', count: 3, cp: 0.482889067, cna: 18.950582104, m: 0.124820338, cg: 0.394901493 },
] as const;

describe('pod sets from .ork files (plan 0070 step 3)', () => {
  for (const c of ROCKETS) {
    it(`${c.file}: ${String(c.count)} pods at 75 mm, with OpenRocket's mass, CG, CP and C_Nα`, () => {
      const r = read(c.file);
      expect(r.approximations).toEqual([]);
      expect(r.components.flatMap((p) => p.approximations ?? [])).toEqual([]);
      // The pod set's front at 0.4 m (bottom + 0 on the 0.5 m tube from 0.1 m, the pod 0.2 m long),
      // its axis 25 + 37.5 + 12.5 = 75 mm from the rocket's ("relative").
      const pods = podParts(r);
      expect(pods.map((p) => [p.name, Number(p.position.toFixed(12))])).toEqual([
        ['Pod nose', 0.4],
        ['Pod tube', 0.45],
        ...(c.file === 'pods2' ? [['Pod fins', 0.55]] : []),
      ]);
      for (const p of pods) expect(p.instances).toEqual({ count: c.count, radialOffset: 0.075 });
      // The pods are not the main body: its length and reference radius are unchanged.
      expect(r.length).toBeCloseTo(0.6, 12);
      expect(r.maxBodyRadius).toBe(0.025);
      // As in the physics test (geometry/pods.test.ts): mass and CG within the quadrature's 1e-6
      // (D-025), C_Nα to rounding, the CP within 0.05 % (R1's own baseline is 0.016 %). In fact
      // CLAUDE.md 7.4 asks only 1 % and 2 %.
      const mp = rocketMassProperties(r.components);
      expect(relative(mp.mass, c.m)).toBeLessThan(1e-6);
      expect(relative(mp.cg, c.cg)).toBeLessThan(1e-6);
      const { design } = orkToDesign(r, [], c.file);
      expect(design.components.filter((p) => p.pod !== undefined).map((p) => p.pod)).toEqual(
        pods.map(() => ({ count: c.count, radialOffset: 0.075 })),
      );
      const cp = designStability(design, 'openrocket-equivalent').result.centreOfPressure;
      expect(relative(cp.cnAlpha, c.cna)).toBeLessThan(1e-9);
      expect(relative(cp.cp, c.cp)).toBeLessThan(5e-4);
    });
  }

  it('radius methods: the distance of each pod axis from the rocket axis, as OpenRocket places it', () => {
    // positions.txt parts 1, 3 and 4. The body tube is 25 mm; the pod 12.5 mm, or 15 mm at its
    // largest in the mixed files.
    const cases: readonly [string, number][] = [
      ['pods-radius-coaxial', 0],
      ['pods-radius-free', 0.01],
      ['pods-radius-relative', 0.0225],
      ['pods-radius-surface', 0.0375],
      ['pods-mixed-surface-0', 0.04],
      ['pods-mixed-surface-1', 0.04],
      ['pods-mixed-relative-0', 0.005],
      ['pods-mixed-relative-1', 0.005],
      ['pods-edited-surface-nonzero', 0.0375],
      ['pods-edited-relative-negative', 0.0625],
      ['pods-edited-coaxial-nonzero', 0],
    ];
    for (const [file, distance] of cases) {
      const pods = podParts(read(file));
      expect(pods.length, file).toBeGreaterThan(0);
      for (const p of pods) {
        expect(p.instances?.count, file).toBe(2);
        expect(p.instances?.radialOffset, file).toBeCloseTo(distance, 12);
      }
    }
  });

  it('axial methods: the pod set is placed like any child of its tube, its length its parts', () => {
    // positions.txt part 2: the tube from 0.1 to 0.6 m, the pod 0.2 m, offset 0.02 m.
    const cases: readonly [string, number][] = [
      ['pods-axial-absolute', 0.02],
      ['pods-axial-top', 0.12],
      ['pods-axial-middle', 0.27],
      ['pods-axial-bottom', 0.42],
      // part 3: bottom + 0, pods 0.17 m and 0.14 m long
      ['pods-mixed-surface-0', 0.43],
      ['pods-mixed-surface-1', 0.46],
    ];
    for (const [file, front] of cases) {
      const [first] = podParts(read(file));
      expect(first?.position, file).toBeCloseTo(front, 12);
    }
    // The parts stacked from the front: nose 40 mm, transition 30 mm, tube.
    const mixed = podParts(read('pods-mixed-surface-0'));
    expect(mixed.map((p) => [p.component.kind, Number(p.position.toFixed(12))])).toEqual([
      ['noseCone', 0.43],
      ['transition', 0.47],
      ['bodyTube', 0.5],
    ]);
  });

  it('a parachute in a pod is one per pod, as OpenRocket opens them', () => {
    // positions.txt part 5: the structure 0.129470467 kg at 0.417451132 m, two parachutes.
    const r = read('pods4');
    const mp = rocketMassProperties(r.components);
    expect(relative(mp.mass, 0.129470467)).toBeLessThan(1e-6);
    expect(relative(mp.cg, 0.417451132)).toBeLessThan(1e-6);
    expect(r.recoveryDevices.map((d) => [d.name, d.diameter, d.dragCoefficient])).toEqual([
      ['Parachute (pod 1 of 2)', 0.3, 0.8],
      ['Parachute (pod 2 of 2)', 0.3, 0.8],
    ]);
    const chute = r.components[r.recoveryDevices[0]?.component ?? -1];
    expect(chute?.instances).toEqual({ count: 2, radialOffset: 0.075 });
    expect(orkToDesign(r, [], 'pods4').design.recovery).toHaveLength(2);
  });

  it('what is not modelled yet is listed or refused, never dropped', () => {
    const base = xml('pods1');
    // A pod set inside a pod (OpenRocket allows one on a pod's tube) is left out and listed.
    const nested = base.replace(
      '<radius>0.0125</radius>',
      '<radius>0.0125</radius><subcomponents><podset><name>Inner</name><instancecount>2</instancecount><radiusoffset method="surface">0.0</radiusoffset><axialoffset method="top">0.0</axialoffset></podset></subcomponents>',
    );
    const r = parseOrk(nested, 'nested.ork');
    expect(r.approximations.map((a) => [a.subject, a.what, a.impact])).toEqual([
      ['Pod set "Inner"', 'a pod set inside a pod (the app cannot model this part yet)', 'major'],
    ]);
    // A motor in a pod is refused until step 4 models it, so that it is never lost.
    const config = /<motor configid="([^"]+)">/.exec(base)?.[1] ?? '';
    const motor = base.replace(
      '<radius>0.0125</radius>',
      `<radius>0.0125</radius><motormount><ignitionevent>automatic</ignitionevent><ignitiondelay>0.0</ignitiondelay><overhang>0.0</overhang><motor configid="${config}"><type>single</type><manufacturer>Estes</manufacturer><digest>x</digest><designation>A8</designation><diameter>0.018</diameter><length>0.07</length><delay>3.0</delay></motor></motormount>`,
    );
    let error: unknown;
    try {
      parseOrk(motor, 'motor.ork');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OrkUnsupportedFeaturesError);
    expect((error as OrkUnsupportedFeaturesError).problems.map((p) => p.feature)).toEqual([
      'a motor in a pod set',
    ]);
  });
});
