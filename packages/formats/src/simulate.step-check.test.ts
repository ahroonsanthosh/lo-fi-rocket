/**
 * RK4 step check and the extended step-size convergence table (D-063,
 * DYN-16, DYN-17; the owner's request after the 3D viewer session found
 * RK4 at 0.01 s unstable on R2). Every reference rocket is flown with every
 * fixed step the earlier convergence check used (0.01, 0.005, 0.002, 0.001 s)
 * plus 0.02 s, in the Phase 2 OpenRocket-equivalent still-air setting and in
 * the app's displayed mode with a 2 m/s wind on a 5° rail (which excites the
 * roll and pitch modes), and compared with the Dormand–Prince result. The
 * rule under test: a fixed-step RK4 run either agrees with the adaptive run
 * or stops with `IntegrationUnstableError`; it never returns a diverged
 * result. Set STEP_CHECK_REPORT=<path> to write the table for
 * `docs/reports/rk4-step-check.md`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IntegrationUnstableError,
  metres,
  OPENROCKET_REFERENCE_GRAVITY_45N,
  radians,
  rk4StepCheck,
  seconds,
  simulateFlight,
  STANDARD_GRAVITY_MODEL,
  type FlightResult,
  type FlightVehicle,
  type SimulationOptions,
} from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';

// Sixty reference flights: well above the default 5 s per test under a loaded suite.
vi.setConfig({ testTimeout: 180_000 });
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { orkRecoveryDevice, parseOrk } from './ork.js';

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const ROCKETS = [
  { file: 'r1-three-fin-conical', motorFile: 'Estes_D12', delay: 5 },
  { file: 'r2-ogive-boattail', motorFile: 'AeroTech_G80T', delay: 7 },
  { file: 'r3-minimum-diameter-24', motorFile: 'AeroTech_F39T', delay: 6 },
  { file: 'r4-scratch-38mm', motorFile: 'AeroTech_H123W', delay: 10 },
  { file: 'r5-transonic-min-dia-29', motorFile: 'AeroTech_H238T', delay: 6 },
] as const;
const STEPS = [0.02, 0.01, 0.005, 0.002, 0.001] as const;

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
    recovery: rocket.recoveryDevices.map(orkRecoveryDevice),
    roughnessHeight: metres(60e-6),
  };
}

type Setting = 'openrocket-still-air' | 'displayed-wind-2-rail-5';
function options(setting: Setting, integrator: SimulationOptions['integrator']): SimulationOptions {
  const displayed = setting === 'displayed-wind-2-rail-5';
  return {
    site: { altitude: metres(0) },
    rail: {
      length: metres(1.5),
      angleFromVertical: radians(displayed ? (5 * Math.PI) / 180 : 0),
      azimuth: radians(0),
    },
    wind: { kind: 'vector', velocity: { x: displayed ? 2 : 0, y: 0, z: 0 } },
    gravity: displayed
      ? STANDARD_GRAVITY_MODEL
      : { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    aerodynamics: 'niskanen',
    finRollReduction: displayed,
    baseDragMotorRule: displayed ? 'while-thrusting' : 'always',
    baseDragMethod: displayed ? 'datcom' : 'niskanen',
    integrator,
    maxTime: seconds(600),
    degreesOfFreedom: 6,
    recordInterval: seconds(0.05),
  };
}
const DP: SimulationOptions['integrator'] = {
  kind: 'dormand-prince',
  relativeTolerance: 1e-8,
  absoluteTolerance: 1e-10,
  initialStep: seconds(0.001),
  maxStep: seconds(0.05),
};
const rk4 = (h: number): SimulationOptions['integrator'] => ({ kind: 'rk4', timeStep: seconds(h) });

const rows: Record<Setting, string[]> = {
  'openrocket-still-air': [],
  'displayed-wind-2-rail-5': [],
};

describe('rk4StepCheck hand values (DYN-16, DYN-17)', () => {
  it('roll rate 330 s⁻¹ alone: safe step 0.9 × 2.7853/330 = 0.0075963 s, limited by roll', () => {
    const c = rk4StepCheck(0.01, { roll: 330, pitchNatural: 0, pitchDamping: 0, drag: 0 });
    expect(c.limitedBy).toBe('roll');
    expect(c.safeStep).toBeCloseTo(0.0075963, 6);
    expect(c.pitchStepAngle).toBe(0);
    expect(c.pitchAmplitudeLoss).toBe(0);
  });
  it('undamped pitch at 100 rad/s: safe step 0.9 × 2√2/100 = 0.025456 s; at h = 0.01 the step angle is 1 rad with loss 1 − √(1 − 1/72 + 1/576) = 0.00609', () => {
    const c = rk4StepCheck(0.01, { roll: 0, pitchNatural: 100, pitchDamping: 0, drag: 0 });
    expect(c.limitedBy).toBe('pitch');
    expect(c.safeStep).toBeCloseTo(0.025456, 6);
    expect(c.pitchStepAngle).toBeCloseTo(1, 12);
    expect(c.pitchAmplitudeLoss).toBeCloseTo(1 - Math.sqrt(1 - 1 / 72 + 1 / 576), 9);
  });
  it('overdamped pitch: eigenvalues real, the faster one −(λ_d + √(λ_d² − 4ω_n²))/2 sets the step', () => {
    // λ_d = 500, ω_n = 100: λ = −(500 + √(250000 − 40000))/2 = −479.13; safe 0.9 × 2.7853/479.13 = 0.0052321.
    const c = rk4StepCheck(0.001, { roll: 0, pitchNatural: 100, pitchDamping: 500, drag: 0 });
    expect(c.limitedBy).toBe('pitch');
    expect(c.safeStep).toBeCloseTo(0.0052321, 6);
  });
});

describe('the step check stops an unstable fixed-step RK4 run and names a safe step (D-063)', () => {
  const r2 = ROCKETS[1];
  it('R2 in the displayed mode with wind at 0.01 s throws IntegrationUnstableError on the roll dynamics', () => {
    let error: unknown;
    try {
      simulateFlight(vehicleFor(r2), options('displayed-wind-2-rail-5', rk4(0.01)));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(IntegrationUnstableError);
    const e = error as IntegrationUnstableError;
    expect(e.mode).toBe('roll dynamics');
    expect(e.safeStep).toBeGreaterThan(0.005);
    expect(e.safeStep).toBeLessThan(0.0105);
    expect(e.message).toContain('Use a time step of at most');
    expect(e.message).toContain('Dormand–Prince');
  });
  it('R2 at the suggested step lands and agrees with Dormand–Prince within 0.05 m in apogee', () => {
    const dp = simulateFlight(vehicleFor(r2), options('displayed-wind-2-rail-5', DP));
    const r = simulateFlight(vehicleFor(r2), options('displayed-wind-2-rail-5', rk4(0.005)));
    expect(r.summary.endReason).toBe('landing');
    expect(Math.abs(r.summary.apogee - dp.summary.apogee)).toBeLessThan(0.05);
    expect(r.stepCheck?.minimumSafeStepMode).toBe('roll');
    expect(r.stepCheck?.minimumSafeStep).toBeGreaterThan(0.005);
  });
  it('every flight event has a stored sample at its time (liftoff included)', () => {
    for (const c of ROCKETS) {
      const r = simulateFlight(vehicleFor(c), options('displayed-wind-2-rail-5', rk4(0.002)));
      for (const e of r.events) {
        const found = r.samples.some((s) => Math.abs(s.time - e.time) < 1e-9);
        expect(found, `${c.file}: ${e.kind} at ${String(e.time)} s`).toBe(true);
      }
      expect(r.events.some((e) => e.kind === 'liftoff')).toBe(true);
    }
  });
});

describe('extended step-size convergence: every reference rocket, every step the app offered, both settings', () => {
  const summarise = (r: FlightResult): string =>
    `${r.summary.apogee.toFixed(2)} m / ${r.summary.maxVelocity.toFixed(2)} m/s`;
  for (const setting of ['openrocket-still-air', 'displayed-wind-2-rail-5'] as const) {
    for (const c of ROCKETS) {
      it(`${c.file}, ${setting}: each RK4 step agrees with Dormand–Prince or stops`, () => {
        const v = vehicleFor(c);
        const dp = simulateFlight(v, options(setting, DP));
        const cells: string[] = [];
        let safe = '';
        for (const h of STEPS) {
          try {
            const r = simulateFlight(v, options(setting, rk4(h)));
            expect(r.summary.endReason, `${c.file} ${String(h)}`).toBe('landing');
            // Agreement with the adaptive run: 0.1 % in apogee, 0.1 % in maximum velocity (observed far tighter).
            expect(
              Math.abs(r.summary.apogee - dp.summary.apogee) / dp.summary.apogee,
              `${c.file} ${String(h)} apogee`,
            ).toBeLessThan(1e-3);
            expect(
              Math.abs(r.summary.maxVelocity - dp.summary.maxVelocity) / dp.summary.maxVelocity,
              `${c.file} ${String(h)} max velocity`,
            ).toBeLessThan(1e-3);
            const w = r.warnings.some((x) => x.includes('RK4 step check')) ? ' (warning)' : '';
            cells.push(`${summarise(r)}${w}`);
            const sc = r.stepCheck;
            if (sc !== undefined && safe === '')
              safe = `${sc.minimumSafeStep.toPrecision(3)} s (${sc.minimumSafeStepMode}, ${sc.minimumSafeStepTime.toFixed(2)} s)`;
          } catch (e) {
            expect(e, `${c.file} ${String(h)}`).toBeInstanceOf(IntegrationUnstableError);
            const u = e as IntegrationUnstableError;
            cells.push(`stopped: ${u.mode}, safe ≤ ${u.safeStep.toPrecision(2)} s`);
          }
        }
        rows[setting].push(`| ${c.file} | ${summarise(dp)} | ${cells.join(' | ')} | ${safe} |`);
      });
    }
  }
  it('writes the table', () => {
    const lines: string[] = [];
    for (const setting of ['openrocket-still-air', 'displayed-wind-2-rail-5'] as const) {
      lines.push(`## ${setting}`, '');
      lines.push(
        `| rocket | Dormand–Prince 1e-8 | ${STEPS.map((h) => `RK4 ${String(h)} s`).join(' | ')} | smallest safe step (mode, time) |`,
      );
      lines.push(`| --- | --- | ${STEPS.map(() => '---').join(' | ')} | --- |`);
      lines.push(...rows[setting], '');
    }
    const report = process.env['STEP_CHECK_REPORT'];
    if (report !== undefined && report !== '') writeFileSync(report, lines.join('\n') + '\n');
    expect(rows['openrocket-still-air'].length).toBe(ROCKETS.length);
    expect(rows['displayed-wind-2-rail-5'].length).toBe(ROCKETS.length);
  });
});
