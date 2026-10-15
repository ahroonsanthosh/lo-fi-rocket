/** Recovery device drag (plan 0073 part 2): STREAM-1, Niskanen (2009) Appendix C. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../errors.js';
import { R1_COMPONENTS } from '../geometry/reference-rockets.js';
import { D12 } from '../motor/motor.test.js';
import { kilogramsPerSquareMetre, metres, radians, seconds } from '../units/si.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from './gravity.js';
import { recoveryApproximations, recoveryDragArea, streamerDragCoefficient } from './recovery.js';
import { simulateFlight } from './simulate.js';
import type { FlightVehicle, SimulationOptions, StreamerDevice } from './vehicle.js';

const streamer = (
  length: number,
  width: number,
  gramsPerSquareMetre: number,
  dragCoefficient?: number,
): StreamerDevice => ({
  kind: 'streamer',
  name: 'Streamer',
  length: metres(length),
  width: metres(width),
  surfaceDensity: kilogramsPerSquareMetre(gramsPerSquareMetre / 1000),
  ...(dragCoefficient === undefined ? {} : { dragCoefficient }),
  deploy: { event: 'apogee', delay: seconds(0) },
});

describe('STREAM-1 streamer drag, Niskanen eq. (C.6)', () => {
  it('reproduces the estimates of Table C.2 p. 115 to their printed digits', () => {
    // C_D · A = 0.034 (ρ + 25)/105 (l + 1) w, by hand:
    //   0.07 × 0.21, 21 g/m²: 0.034 × 0.438095 × 1.21 × 0.07 = 1.2616·10⁻³ (printed 1.26)
    //   0.07 × 0.49, 41 g/m²: 0.034 × 0.628571 × 1.49 × 0.07 = 2.2290·10⁻³ (2.23)
    //   0.08 × 0.24, 10 g/m²: 0.034 × 0.333333 × 1.24 × 0.08 = 1.1243·10⁻³ (1.12)
    //   0.06 × 0.70, 20 g/m²: 0.034 × 0.428571 × 1.70 × 0.06 = 1.4863·10⁻³ (1.49)
    //   0.06 × 0.50, 24 g/m²: 0.034 × 0.466667 × 1.50 × 0.06 = 1.4280·10⁻³ (1.43)
    const rows = [
      [0.07, 0.21, 21, 1.26],
      [0.07, 0.49, 41, 2.23],
      [0.08, 0.24, 10, 1.12],
      [0.06, 0.7, 20, 1.49],
      [0.06, 0.5, 24, 1.43],
    ] as const;
    for (const [w, l, rho, printed] of rows) {
      const area = recoveryDragArea(streamer(l, w, rho));
      expect(Math.abs(area * 1000 - printed)).toBeLessThan(0.005);
    }
    // 0.6 × 0.06 m of 80 g/m²: 0.034 × 1 × 1.6/0.6 = 0.0906667.
    expect(streamerDragCoefficient(streamer(0.6, 0.06, 80))).toBeCloseTo(0.0906667, 7);
  });

  it('is OpenRocket 24.12’s automatic streamer C_D wherever that is below its 0.4 cap', () => {
    // FinishProbe part 3 (reference/rockets/finish-probe/values.txt).
    const probe = join(
      dirname(fileURLToPath(import.meta.url)),
      ...['..', '..', '..', '..', 'reference', 'rockets', 'finish-probe', 'values.txt'],
    );
    const lines = readFileSync(probe, 'utf8')
      .split('\n')
      .filter((l) => /^STREAMER \d+ length=/.test(l));
    expect(lines).toHaveLength(10);
    let capped = 0;
    for (const line of lines) {
      const v = (k: string): number => Number(new RegExp(` ${k}=([0-9.e+-]+)`).exec(line)?.[1]);
      const ours = streamerDragCoefficient(streamer(v('length'), v('width'), v('density') * 1000));
      if (ours > 0.4) {
        capped += 1;
        expect(v('cd')).toBe(0.4);
      } else {
        expect(ours).toBeCloseTo(v('cd'), 9);
      }
    }
    // The 0.05 m long, 0.5 m wide strip: eq. (C.6) gives 0.034 × 1.05/0.05 = 0.714.
    expect(capped).toBe(1);
    // The comparison mode takes OpenRocket's cap: 0.4 × 0.025 m² = 0.01 m², OpenRocket's cdA.
    const wide = streamer(0.05, 0.5, 80);
    expect(recoveryDragArea(wide, 'openrocket')).toBeCloseTo(0.01, 15);
    expect(recoveryDragArea(wide)).toBeCloseTo(0.01785, 7);
  });

  it('a parachute is C_D π d²/4; a streamer’s own C_D replaces eq. (C.6)', () => {
    const chute = {
      name: 'Main',
      diameter: metres(0.3),
      dragCoefficient: 0.8,
      deploy: { event: 'apogee' as const, delay: seconds(0) },
    };
    // 0.8 × π × 0.09/4 = 0.0565487.
    expect(recoveryDragArea(chute)).toBeCloseTo(0.0565487, 7);
    expect(recoveryDragArea(streamer(1, 0.1, 80, 0.5))).toBeCloseTo(0.05, 15);
  });

  it('refuses a strip without length or width, or a negative density', () => {
    expect(() => recoveryDragArea(streamer(0, 0.1, 80))).toThrow(InvalidInputError);
    expect(() => recoveryDragArea(streamer(1, 0, 80))).toThrow(InvalidInputError);
    expect(() => recoveryDragArea(streamer(1, 0.1, -1))).toThrow(InvalidInputError);
  });

  it('lists a strip outside the measured ones, unless the user gave its C_D', () => {
    expect(recoveryApproximations([streamer(0.6, 0.06, 80)])).toEqual([]);
    const long = recoveryApproximations([streamer(2, 0.05, 30)]);
    expect(long).toHaveLength(1);
    expect(long[0]?.what).toContain('length outside');
    expect(long[0]?.impact).toBe('moderate');
    const all = recoveryApproximations([streamer(0.05, 0.5, 100)]);
    expect(all[0]?.what).toContain('length and width and surface density');
    expect(recoveryApproximations([streamer(2, 0.05, 30, 0.1)])).toEqual([]);
  });
});

describe('a streamer in flight', () => {
  const options: SimulationOptions = {
    site: { altitude: metres(0) },
    rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
    wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
    gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
    aerodynamics: 'niskanen',
    finRollReduction: false,
    baseDragMotorRule: 'while-thrusting',
    baseDragMethod: 'niskanen',
    bodyFormFactor: 'niskanen',
    finFrictionLength: 'rocket',
    liftingSurfaceFactors: 'none',
    largeAngleMethod: 'linear',
    integrator: { kind: 'rk4', timeStep: seconds(0.002) },
    maxTime: seconds(120),
    degreesOfFreedom: 6,
  };
  const fly = (recovery: FlightVehicle['recovery']): ReturnType<typeof simulateFlight> =>
    simulateFlight(
      {
        components: R1_COMPONENTS,
        motor: { kind: 'definition', definition: D12, aftEnd: metres(0.6) },
        recovery,
        roughnessHeight: metres(60e-6),
      },
      options,
    );
  const chute = fly([
    {
      name: 'Parachute',
      diameter: metres(0.3),
      dragCoefficient: 0.8,
      deploy: { event: 'apogee', delay: seconds(0) },
    },
  ]);
  const groundHit = (r: ReturnType<typeof simulateFlight>): number => {
    const v = r.summary.groundHitVelocity;
    if (v === undefined) throw new Error('the flight did not land');
    return v;
  };

  it('descends as a parachute of the same C_D A', () => {
    // C_D on the strip area such that C_D w l = 0.0565487, the canopy's.
    const same = fly([streamer(1, 0.1, 80, 0.565487)]);
    expect(groundHit(same)).toBeCloseTo(groundHit(chute), 4);
  });

  it('lands at the terminal speed of eq. (C.6)’s C_D A: v ∝ (C_D A)^−½', () => {
    // 1 m × 0.09 m of 80 g/m²: C_D A = 0.034 × 1 × 2 × 0.09 = 0.00612 m², so the ground hit is
    // the parachute's × √(0.0565487/0.00612) = × 3.03971, both at their terminal speed by the
    // ground.
    const r = fly([streamer(1, 0.09, 80)]);
    const expected = groundHit(chute) * Math.sqrt(0.0565487 / 0.00612);
    expect(Math.abs(groundHit(r) / expected - 1)).toBeLessThan(0.005);
    const event = r.events.find((e) => e.kind === 'deployment');
    expect(event?.detail).toContain('C_D A = 0.0061 m²');
    expect(r.approximations.filter((a) => a.subject.startsWith('Streamer'))).toEqual([]);
  });
});
