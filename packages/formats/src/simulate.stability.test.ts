/**
 * Stability along the trajectory (completion prompt Part C item 5, plan
 * 0030, D-067): the smallest margin over powered flight and coast, at the CP
 * for the actual Mach number and angle of attack, for every reference rocket
 * in the displayed mode with a 2 m/s wind on a 5° rail. Set
 * STABILITY_REPORT=<path> to write the table for the final report.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  centreOfPressure,
  mach,
  metres,
  pascals,
  radians,
  seconds,
  simulateFlight,
  STANDARD_GRAVITY_MODEL,
  type FlightVehicle,
  type SimulationOptions,
  type StabilityPoint,
  TN4197_MATERIALS,
} from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { parseOrk } from './ork.js';

vi.setConfig({ testTimeout: 120_000 });

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const ROCKETS = [
  { file: 'r1-three-fin-conical', motorFile: 'Estes_D12', delay: 5 },
  { file: 'r2-ogive-boattail', motorFile: 'AeroTech_G80T', delay: 7 },
  { file: 'r3-minimum-diameter-24', motorFile: 'AeroTech_F39T', delay: 6 },
  { file: 'r4-scratch-38mm', motorFile: 'AeroTech_H123W', delay: 10 },
  { file: 'r5-transonic-min-dia-29', motorFile: 'AeroTech_H238T', delay: 6 },
] as const;

function vehicleFor(c: (typeof ROCKETS)[number]): FlightVehicle {
  const rocket = parseOrk(
    new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${c.file}.ork`))),
  );
  const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${c.motorFile}.eng`), 'utf8'))[0];
  const mount = rocket.motorMount;
  if (eng === undefined || mount === undefined) throw new Error('missing motor');
  return {
    components: rocket.components,
    motor: {
      kind: 'definition',
      definition: motorFromEng(eng),
      aftEnd: mount.aftEnd,
      ejectionDelay: seconds(c.delay),
    },
    recovery: rocket.recoveryDevices.map((d) => ({
      name: d.name,
      diameter: d.diameter,
      dragCoefficient: d.dragCoefficient,
      deploy: { event: d.deployEvent, altitude: d.deployAltitude, delay: d.deployDelay },
    })),
    roughnessHeight: metres(60e-6),
  };
}

const OPTIONS: SimulationOptions = {
  site: { altitude: metres(0) },
  rail: {
    length: metres(1.5),
    angleFromVertical: radians((5 * Math.PI) / 180),
    azimuth: radians(0),
  },
  wind: { kind: 'vector', velocity: { x: 2, y: 0, z: 0 } },
  gravity: STANDARD_GRAVITY_MODEL,
  aerodynamics: 'niskanen',
  finRollReduction: true,
  baseDragMotorRule: 'while-thrusting',
  integrator: {
    kind: 'dormand-prince',
    relativeTolerance: 1e-8,
    absoluteTolerance: 1e-10,
    initialStep: seconds(0.001),
    maxStep: seconds(0.05),
  },
  maxTime: seconds(600),
  degreesOfFreedom: 6,
};

const fmt = (p: StabilityPoint | undefined): string =>
  p === undefined
    ? '—'
    : `${p.calibers.toFixed(2)} cal at ${p.time.toFixed(2)} s (Mach ${p.mach.toFixed(2)}, α ${((p.angleOfAttack * 180) / Math.PI).toFixed(2)}°)`;

const rows: string[] = [];
const flutterRows: string[] = [];

describe('minimum in-flight stability margin (plan 0030)', () => {
  for (const c of ROCKETS) {
    it(`${c.file}: the summary minimum is the smallest step margin of each phase`, () => {
      const v = vehicleFor(c);
      const r = simulateFlight(v, OPTIONS);
      const s = r.summary.minimumStability;
      for (const phase of ['powered', 'coast'] as const) {
        const values = r.samples
          .filter((x) => x.phase === phase && Number.isFinite(x.stabilityCalibers))
          .map((x) => x.stabilityCalibers);
        const p = s[phase];
        if (p === undefined) throw new Error(`no ${phase} minimum`);
        // Every accepted step is recorded without a record interval, so the minimum is a sample's.
        expect(p.calibers).toBeCloseTo(Math.min(...values), 12);
        expect(p.calibers).toBeCloseTo((p.cp - p.cg) / dOf(v), 12);
      }
      // The in-flight CP differs from the static (α = 0, worst roll) CP at the same Mach number only by the
      // angle-of-attack effects (body lift, Niskanen p. 23) and the roll angle: within one caliber here (R3, a
      // minimum-diameter rocket at 6° just off the rail, differs by 0.51).
      const powered = s.powered;
      if (powered === undefined) throw new Error('no powered phase');
      const staticCp = centreOfPressure(v.components, {
        mach: mach(powered.mach),
        rollAngle: 'worst',
        finRollReduction: true,
      }).cp as number;
      expect(Math.abs(powered.cp - staticCp)).toBeLessThan(dOf(v));
      rows.push(`| ${c.file} | ${fmt(s.powered)} | ${fmt(s.coast)} |`);
    });
  }
  it('warns when the margin falls below the minimum', () => {
    const v = vehicleFor(ROCKETS[0]);
    const r = simulateFlight(v, { ...OPTIONS, minimumStabilityMargin: 50 });
    expect(r.warnings.some((w) => w.startsWith('In-flight stability margin fell to'))).toBe(true);
    const ok = simulateFlight(v, OPTIONS);
    expect(ok.warnings.some((w) => w.startsWith('In-flight stability margin fell to'))).toBe(false);
  });
  it('fin flutter (plan 0031): plywood fins as TN 4197 wood; the shear modulus every rocket needs', () => {
    const wood = TN4197_MATERIALS.find((m) => m.name === 'wood (solid)');
    if (wood === undefined) throw new Error('wood missing');
    for (const c of ROCKETS) {
      const v = vehicleFor(c);
      const plywood =
        c.file === 'r1-three-fin-conical' ||
        c.file === 'r2-ogive-boattail' ||
        c.file === 'r4-scratch-38mm';
      const withG = (g: number): FlightVehicle => ({
        ...v,
        components: v.components.map((p) =>
          p.component.kind === 'finSet'
            ? { ...p, component: { ...p.component, shearModulus: pascals(g) } }
            : p,
        ),
      });
      // V_f ∝ √G_E (eq. 16), so with G = 1 GPa the lowest ratio r gives the modulus at which V_f = V: 1 GPa/r².
      const unit = simulateFlight(withG(1e9), OPTIONS).summary.flutter[0];
      if (unit?.ratio === undefined) throw new Error('flutter not evaluated');
      const needed = 1e9 / unit.ratio ** 2;
      let margin = 'not evaluated: fibreglass has no shear modulus in the approved sources';
      if (plywood) {
        const r = simulateFlight(withG(wood.shearModulus), OPTIONS);
        const f = r.summary.flutter[0];
        if (f?.ratio === undefined) throw new Error('flutter not evaluated');
        // The ratio scales with √G exactly (same trajectory: G does not enter the dynamics).
        expect(f.ratio).toBeCloseTo(unit.ratio * Math.sqrt(wood.shearModulus / 1e9), 9);
        margin = `V_f/V = ${f.ratio.toFixed(2)} at ${f.time.toFixed(2)} s (Mach ${f.mach.toFixed(2)}, V_f ${f.flutterVelocity.toFixed(0)} m/s)`;
        expect(r.warnings.some((w) => w.startsWith('Fin flutter:'))).toBe(f.ratio < 1);
      } else {
        const r = simulateFlight(v, OPTIONS);
        expect(r.summary.flutter[0]?.ratio).toBeUndefined();
        expect(r.warnings.some((w) => w.startsWith('Fin flutter not checked'))).toBe(true);
      }
      flutterRows.push(
        `| ${c.file} | ${plywood ? 'plywood (TN 4197 wood, 0.487 GPa)' : 'fibreglass'} | ${margin} | ${(needed / 1e9).toFixed(3)} GPa |`,
      );
    }
  });
  it('writes the table', () => {
    const out = [
      '| rocket | lowest margin, powered flight | lowest margin, coast to apogee |',
      '| --- | --- | --- |',
      ...rows,
      '',
      '| rocket | fin material | lowest flutter margin | shear modulus at which V_f = V |',
      '| --- | --- | --- | --- |',
      ...flutterRows,
    ].join('\n');
    const path = process.env['STABILITY_REPORT'];
    if (path !== undefined && path !== '') writeFileSync(path, `${out}\n`);
    expect(rows.length).toBe(ROCKETS.length);
  });
});

function dOf(v: FlightVehicle): number {
  let r = 0;
  for (const { component: c } of v.components) {
    if (c.kind === 'noseCone') r = Math.max(r, c.baseRadius);
    else if (c.kind === 'bodyTube') r = Math.max(r, c.outerRadius);
    else if (c.kind === 'transition') r = Math.max(r, c.foreRadius, c.aftRadius);
  }
  return 2 * r;
}
