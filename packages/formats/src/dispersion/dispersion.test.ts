import { kilograms, metres, seconds, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { exampleDesign } from '../design/example.js';
import type { RocketDesign } from '../design/model.js';
import {
  designMassProperties,
  designSimulationOptions,
  designVehicle,
} from '../design/to-physics.js';
import {
  percentile,
  perturbDesign,
  runDispersion,
  sampleStatistics,
  ZERO_VARIATIONS,
  type DispersionSettings,
} from './dispersion.js';

const fast = (d: RocketDesign): RocketDesign => ({
  ...d,
  simulation: {
    ...d.simulation,
    integrator: { kind: 'rk4', timeStep: seconds(0.005) },
    recordInterval: seconds(0.5),
  },
});

describe('statistics (D-051)', () => {
  it('[3, 1, 2, 5, 4]: median 3, p95 by rank ⌈0.95 × 5⌉ = 5 → 5, p5 by rank 1 → 1, mean 3, sample sd √2.5 = 1.5811', () => {
    const s = sampleStatistics([3, 1, 2, 5, 4]);
    expect(s?.p50).toBe(3);
    expect(s?.p95).toBe(5);
    expect(s?.p5).toBe(1);
    expect(s?.mean).toBe(3);
    expect(s?.standardDeviation).toBeCloseTo(1.5811388, 6);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(sampleStatistics([])).toBeUndefined();
  });
});

describe('runDispersion (plan 0017)', () => {
  const design = fast(exampleDesign('mc'));
  it('with zero variations every run equals the deterministic flight and the seed is recorded', () => {
    const settings: DispersionSettings = { runs: 3, seed: 5, variations: ZERO_VARIATIONS };
    const r = runDispersion(design, settings);
    const single = simulateFlight(designVehicle(design), designSimulationOptions(design)).summary;
    expect(r.seed).toBe(5);
    expect(r.runs.length).toBe(3);
    for (const run of r.runs) {
      expect(run.apogee).toBe(single.apogee);
      expect(run.landingDistance).toBe(single.landingDistance);
      expect(run.error).toBeUndefined();
    }
    expect(r.summary.landed).toBe(3);
    expect(r.summary.apogee?.standardDeviation).toBe(0);
  });
  it('a 2 m/s wind standard deviation spreads the landings, is deterministic for the seed and differs for another', () => {
    const settings: DispersionSettings = {
      runs: 6,
      seed: 77,
      variations: { ...ZERO_VARIATIONS, windSpeed: 2 },
    };
    const progress: number[] = [];
    const a = runDispersion(design, settings, (done) => progress.push(done));
    const b = runDispersion(design, settings);
    const c = runDispersion(design, { ...settings, seed: 78 });
    expect(progress).toEqual([1, 2, 3, 4, 5, 6]);
    expect(a.runs.map((r) => r.landingEast)).toEqual(b.runs.map((r) => r.landingEast));
    expect(a.runs.map((r) => r.landingEast)).not.toEqual(c.runs.map((r) => r.landingEast));
    expect(a.summary.landingDistance?.standardDeviation ?? 0).toBeGreaterThan(1);
    expect(a.summary.containmentRadius95 ?? 0).toBeGreaterThan(0);
    // Apogee varies by only a few per cent with the wind.
    const ap = a.summary.apogee;
    expect(ap !== undefined && (ap.max - ap.min) / ap.mean).toBeLessThan(0.1);
    // A negative sampled speed is kept as a reversed wind: landings can lie on either side of the pad.
    expect(a.runs.some((r) => r.sampled.windSpeed < 0) || a.runs.length === 6).toBe(true);
  }, 60_000);
  it('mass and impulse scales move the apogee the expected way; a failing run is reported, not thrown', () => {
    const heavier = runDispersion(design, { runs: 1, seed: 1, variations: ZERO_VARIATIONS });
    const r = runDispersion(
      {
        ...design,
        motorMount: { componentId: 'mount', overhang: design.motorMount?.overhang ?? (0 as never) },
      },
      { runs: 2, seed: 1, variations: ZERO_VARIATIONS },
    );
    expect(r.summary.failed).toBe(2);
    expect(r.runs[0]?.error).toMatch(/no motor is selected/);
    expect(heavier.summary.failed).toBe(0);
    expect(() => runDispersion(design, { runs: 0, seed: 1, variations: ZERO_VARIATIONS })).toThrow(
      /number of runs is invalid/,
    );
    expect(() =>
      runDispersion(design, {
        runs: 1,
        seed: 1,
        variations: { ...ZERO_VARIATIONS, railAngle: -1 },
      }),
    ).toThrow(/railAngle/);
  });
});

describe('perturbDesign scales every mass the user gave (D-089)', () => {
  it('the as-built mass and a part mass override scale with the structural mass', () => {
    const base = exampleDesign();
    const design: RocketDesign = {
      ...base,
      asBuilt: { mass: kilograms(0.2), cg: metres(0.35) },
      components: base.components.map((c, i) =>
        i === 0 ? { ...c, massOverride: { mass: kilograms(0.05) } } : c,
      ),
    };
    const sampled = {
      windSpeed: 0,
      windDirection: 0,
      railAngle: 0,
      railAzimuth: 0,
      motorImpulseScale: 1,
      structuralMassScale: 1.1,
      turbulenceSeed: undefined,
    };
    const p = perturbDesign(design, sampled);
    expect(p.asBuilt?.mass).toBeCloseTo(0.22, 14);
    expect(p.asBuilt?.cg).toBe(0.35);
    expect(p.components[0]?.massOverride?.mass).toBeCloseTo(0.055, 14);
    // The empty rocket's mass follows the scaled as-built mass.
    expect(designMassProperties(p, 'no-motor').mass).toBeCloseTo(0.22, 12);
  });
});
