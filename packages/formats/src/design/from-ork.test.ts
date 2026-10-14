/**
 * .ork import to a design (plan 0015): R1 to R4 from the files reproduce
 * the CG, CP and apogee figures of the acceptance tests; R5 imports with
 * its motor unmatched and a notice.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rocketMassProperties, seconds, simulateFlight } from '@lo-fi-rocket/physics';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseEng } from '../eng.js';
import { motorFromEng } from '../motor-definition.js';
import { parseOrk } from '../ork.js';
import { orkToDesign, type LibraryMotorRef } from './from-ork.js';
import { parseDesign, serializeDesign } from './serialize.js';
import {
  designMassProperties,
  designSimulationOptions,
  designStability,
  designThrustToWeight,
  designVehicle,
} from './to-physics.js';

const REFERENCE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
);
const library: LibraryMotorRef[] = [
  'Estes_D12',
  'AeroTech_G80T',
  'AeroTech_F39T',
  'AeroTech_H123W',
].map((f) => {
  const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${f}.eng`), 'utf8'))[0];
  if (eng === undefined) throw new Error(f);
  return { definition: motorFromEng(eng), provenance: { kind: 'bundled', file: `${f}.eng` } };
});
const ork = (name: string) =>
  parseOrk(new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${name}.ork`))));
const orkXml = (name: string): string =>
  strFromU8(
    unzipSync(new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${name}.ork`))))[
      'rocket.ork'
    ] ?? new Uint8Array(),
  );

describe('orkToDesign (plan 0015)', () => {
  it('R1: components, mount, motor, recovery and reference diameter; CP 0.487227 m, CG 0.387022 m, apogee 166.19 m (D-108)', () => {
    const { design, notices } = orkToDesign(ork('r1-three-fin-conical'), library, 'r1');
    expect(design.components.length).toBe(9);
    expect(design.motorMount?.motor?.definition.designation).toBe('D12');
    expect(design.motorMount?.motor?.ejectionDelay).toBe(5);
    expect(design.motorMount?.overhang).toBeCloseTo(0, 12);
    expect(design.recovery[0]?.deploy.event).toBe('apogee');
    expect(design.referenceDiameter).toBe(0.05);
    expect(notices[0]).toMatch(/Motor Estes D12 taken from the library/);
    const s = designStability(design, 'openrocket-equivalent');
    expect(s.result.centreOfPressure.cp).toBeCloseTo(0.487227, 5);
    expect(s.result.cgLiftoff).toBeCloseTo(0.387022, 6);
    const rk = {
      ...design,
      simulation: {
        ...design.simulation,
        integrator: { kind: 'rk4' as const, timeStep: seconds(0.002) },
      },
    };
    expect(
      simulateFlight(designVehicle(rk), designSimulationOptions(rk, 'openrocket-equivalent'))
        .summary.apogee,
    ).toBeCloseTo(166.187, 1);
    // The imported design is a valid file.
    expect(parseDesign(serializeDesign(design))).toEqual(design);
  });
  it('R2 to R4 match their motors and validate', () => {
    for (const [file, motor] of [
      ['r2-ogive-boattail', 'G80NBT'],
      ['r3-minimum-diameter-24', 'F39T'],
      ['r4-scratch-38mm', 'H123W'],
    ] as const) {
      const { design } = orkToDesign(ork(file), library, file);
      expect(design.motorMount?.motor?.definition.designation).toBe(motor);
      expect(() => parseDesign(serializeDesign(design))).not.toThrow();
    }
  });
  it('R5 imports without its H238T (not in the library given) and says so', () => {
    const { design, notices } = orkToDesign(ork('r5-transonic-min-dia-29'), library, 'r5');
    expect(design.motorMount).toBeDefined();
    expect(design.motorMount?.motor).toBeUndefined();
    expect(notices[0]).toMatch(
      /names the motor AeroTech H238T \(29 mm, delay \d+ s\) but carries no thrust curve/,
    );
  });
});

describe('approximations travel from the import to the result (D-084)', () => {
  // R1 with canted fins (minor, on the fin set) and a streamer with no mass in the file, left out
  // (major, on the design as a whole).
  const edited = orkXml('r1-three-fin-conical')
    .replace('<cant>0.0</cant>', '<cant>0.1</cant>')
    .replace('<parachute>', '<streamer><name>Tail streamer</name></streamer><parachute>');
  const { design, notices } = orkToDesign(parseOrk(edited, 'edited.ork'), library, 'edited');

  it('the import says how many approximations there are, and how many are major', () => {
    expect(notices.at(-1)).toBe(
      '2 parts or settings are approximated, 1 in a way that can change the results a lot; each is listed with the flight results.',
    );
    expect(orkToDesign(ork('r1-three-fin-conical'), library, 'r1').notices.join(' ')).not.toMatch(
      /approximated/,
    );
  });

  it('the design carries them, on the part and on the design, and they survive a save and load', () => {
    const fins = design.components.find((c) => c.component.kind === 'finSet');
    expect(fins?.approximations?.map((a) => a.impact)).toEqual(['minor']);
    expect(design.approximations?.map((a) => [a.subject, a.impact])).toEqual([
      ['Streamer "Tail streamer"', 'major'],
    ]);
    expect(parseDesign(serializeDesign(design))).toEqual(design);
  });

  it('the flight lists both and its confidence is low', () => {
    const r = simulateFlight(
      designVehicle(design),
      designSimulationOptions(design, 'openrocket-equivalent'),
    );
    expect(r.approximations.map((a) => a.subject).sort()).toEqual([
      'Fin set "Fins (3)"',
      'Streamer "Tail streamer"',
    ]);
    expect(r.confidence.level).toBe('low');
  }, 30000);

  it('a saved approximation with an unknown impact is refused on load', () => {
    const text = serializeDesign(design).replace('"impact": "major"', '"impact": "huge"');
    expect(() => parseDesign(text)).toThrow(/approximations\[0\]\.impact/);
  });
});

/**
 * Motor clusters against OpenRocket (plan 0057, D-086): the files and figures of
 * reference/rockets/cluster-probe (values.txt), flown in the OpenRocket-equivalent mode.
 */
describe('motor clusters from .ork files (plan 0057)', () => {
  const probe = (n: number) =>
    orkToDesign(ork(join('cluster-probe', `cluster${String(n)}`)), library, `cluster${String(n)}`);
  const fly = (n: number) => {
    const { design } = probe(n);
    const rk = {
      ...design,
      simulation: {
        ...design.simulation,
        integrator: { kind: 'rk4' as const, timeStep: seconds(0.002) },
      },
    };
    return simulateFlight(designVehicle(rk), designSimulationOptions(rk, 'openrocket-equivalent'))
      .summary;
  };
  const relative = (ours: number, theirs: number): number => Math.abs(ours / theirs - 1);

  it('three D12s in a 3-ring: offsets, tubes, launch mass and CG as OpenRocket', () => {
    const { design, notices } = probe(1);
    // values.txt case 1: (∓0.0125, −0.007216878) and (0, 0.014433757) m.
    const cluster = design.motorMount?.cluster ?? [];
    expect(cluster).toHaveLength(3);
    [
      [-0.0125, -0.007216878],
      [0.0125, -0.007216878],
      [0, 0.014433757],
    ].forEach(([y, z], i) => {
      expect(cluster[i]?.y).toBeCloseTo(y ?? NaN, 9);
      expect(cluster[i]?.z).toBeCloseTo(z ?? NaN, 9);
    });
    expect(design.components.filter((c) => c.component.kind === 'innerTube')).toHaveLength(3);
    expect(notices[0]).toMatch(/^Motor 3 × Estes D12 taken from the library/);
    // OpenRocket: launch 0.396983731 kg at 0.514652679 m (tolerances: CG 1 %, CLAUDE.md 7.4).
    const m = designMassProperties(design, 'liftoff');
    expect(relative(m.mass, 0.396983731)).toBeLessThan(1e-5);
    expect(relative(m.cg, 0.514652679)).toBeLessThan(1e-5);
    expect(designThrustToWeight(design)).toBeCloseTo(
      3 *
        designThrustToWeight(probe(0).design)! *
        (designMassProperties(probe(0).design, 'liftoff').mass / m.mass),
      9,
    );
  });

  it('rotated by 30° and scaled 1.2: the offsets OpenRocket gives', () => {
    // values.txt case 2: (−0.017320508, 0), (0.008660254, −0.015), (0.008660254, 0.015) m.
    const cluster = probe(2).design.motorMount?.cluster ?? [];
    [
      [-0.017320508, 0],
      [0.008660254, -0.015],
      [0.008660254, 0.015],
    ].forEach(([y, z], i) => {
      expect(cluster[i]?.y).toBeCloseTo(y ?? NaN, 9);
      expect(cluster[i]?.z).toBeCloseTo(z ?? NaN, 9);
    });
  });

  it('a mass override on the clustered tubes is their total, as OpenRocket (case 3)', () => {
    const m = designMassProperties(probe(3).design, 'liftoff');
    expect(relative(m.mass, 0.420518333)).toBeLessThan(1e-5);
    expect(relative(m.cg, 0.526145085)).toBeLessThan(1e-5);
  });

  it('flights: apogee and maximum velocity within tolerance, as close as one motor', () => {
    // OpenRocket (values.txt): one D12 85.958 m, 36.060 m/s; three 273.974 m, 93.420 m/s;
    // three with the tube override 267.393 m, 89.530 m/s. Tolerances 5 % and 3 % (CLAUDE.md 7.4).
    // With D-086 the clusters agree as closely as the single motor (within 1.5 %).
    for (const [n, apogee, speed] of [
      [0, 85.958, 36.06],
      [1, 273.974, 93.42],
      [3, 267.393, 89.53],
    ] as const) {
      const s = fly(n);
      expect(relative(s.apogee, apogee)).toBeLessThan(0.015);
      expect(relative(s.maxVelocity, speed)).toBeLessThan(0.015);
    }
  }, 120000);

  it('the cluster design survives a save and load', () => {
    const { design } = probe(1);
    expect(parseDesign(serializeDesign(design))).toEqual(design);
    const text = serializeDesign(design).replace(/"cluster": \[[^\]]*\]/s, '"cluster": []');
    expect(() => parseDesign(text)).toThrow(/cluster/);
  });
});

/**
 * Elliptical and freeform fin sets (plan 0059, D-087) against OpenRocket's figures for the files
 * it wrote (reference/rockets/fin-shape-probe/values.txt); fin tabs and shapes survive a save and
 * load.
 */
describe('elliptical and freeform fins from .ork files (plan 0059)', () => {
  const probe = (n: number) => ork(join('fin-shape-probe', `fins${String(n)}`));
  const fins = (r: ReturnType<typeof probe>) => {
    const f = r.components.find((c) => c.component.kind === 'finSet');
    if (f?.component.kind !== 'finSet') throw new Error('fins expected');
    return { position: f.position, component: f.component };
  };
  const cp = (n: number): number =>
    designStability(
      orkToDesign(probe(n), library, `fins${String(n)}`).design,
      'openrocket-equivalent',
    ).result.centreOfPressure.cp;
  const relative = (ours: number, theirs: number): number => Math.abs(ours / theirs - 1);

  it('the shapes are read from the file', () => {
    expect(fins(probe(0)).component.shape).toBeUndefined();
    expect(fins(probe(1)).component).toMatchObject({
      rootChord: 0.1,
      span: 0.08,
      shape: { kind: 'elliptical' },
    });
    expect(fins(probe(2)).component).toMatchObject({
      rootChord: 0.12,
      span: 0.08,
      shape: {
        kind: 'freeform',
        points: [
          { x: 0, y: 0 },
          { x: 0.03, y: 0.06 },
          { x: 0.07, y: 0.08 },
          { x: 0.1, y: 0.04 },
          { x: 0.12, y: 0 },
        ],
      },
    });
    expect(fins(probe(2)).position).toBeCloseTo(0.48, 12);
  });

  it('mass and CG: the freeform set exactly as OpenRocket, the ellipse 0.18 % above its polygon', () => {
    // Freeform: 3 × 0.003 × 600 × 5.9e-3 m² (shoelace) = 0.03186 kg at 0.539887006 m (OpenRocket).
    const free = rocketMassProperties([fins(probe(2))]);
    expect(free.mass).toBeCloseTo(0.03186, 12);
    expect(free.cg).toBeCloseTo(0.539887006, 9);
    // Ellipse: 5.4 × π 0.1 × 0.08/4 = 0.0339292 kg; OpenRocket's 31-point polygon has 6.2717e-3 m²,
    // 0.0338672 kg (values.txt). The CG, at mid-chord, is 0.55 m in both.
    const ellipse = rocketMassProperties([fins(probe(1))]);
    expect(ellipse.mass).toBeCloseTo((5.4 * Math.PI * 0.008) / 4, 12);
    expect(relative(ellipse.mass, 0.033867222)).toBeLessThan(0.002);
    expect(ellipse.cg).toBeCloseTo(0.55, 12);
  });

  it('the rocket CP within 2 % of OpenRocket (CLAUDE.md 7.4), as close as the trapezoid', () => {
    // OpenRocket's worst-case CP at Mach 0.3: 0.487148730, 0.477035991, 0.465957494 m.
    expect(relative(cp(0), 0.48714873)).toBeLessThan(0.0005);
    expect(relative(cp(1), 0.477035991)).toBeLessThan(0.0005);
    expect(relative(cp(2), 0.465957494)).toBeLessThan(0.002);
  });

  it('a design with fin tabs or a fin shape saves and loads', () => {
    for (const file of [
      join('tab-probe', 'tab1'),
      join('fin-shape-probe', 'fins1'),
      join('fin-shape-probe', 'fins2'),
    ]) {
      const { design } = orkToDesign(ork(file), library, 'd');
      expect(parseDesign(serializeDesign(design))).toEqual(design);
    }
    const { design } = orkToDesign(probe(1), library, 'd');
    const text = serializeDesign(design).replace('"kind": "elliptical"', '"kind": "oval"');
    expect(() => parseDesign(text)).toThrow(/shape\.kind/);
  });
});
