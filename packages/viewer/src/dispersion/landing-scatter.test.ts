/**
 * Landing points and the descriptive covariance ellipse by hand (plan 0034).
 */
import { describe, expect, it } from 'vitest';
import {
  buildLandingObjects,
  circleOutline,
  covarianceEllipse,
  ellipseOutline,
  landingPoints,
  type LandingResultLike,
} from './landing-scatter.js';

const result: LandingResultLike = {
  runs: [
    { index: 0, landingEast: 1, landingNorth: 0, error: undefined },
    { index: 1, landingEast: -1, landingNorth: 0, error: undefined },
    { index: 2, landingEast: 0, landingNorth: 2, error: undefined },
    { index: 3, landingEast: 0, landingNorth: -2, error: undefined },
    { index: 4, landingEast: undefined, landingNorth: undefined, error: undefined }, // not landed
    { index: 5, landingEast: 7, landingNorth: 7, error: 'failed' }, // failed: excluded
  ],
  summary: { meanLanding: { east: 0, north: 0 }, containmentRadius95: 2 },
};

describe('landingPoints', () => {
  it('keeps the landed runs without error, with their stored coordinates', () => {
    expect(landingPoints(result)).toEqual([
      { index: 0, east: 1, north: 0 },
      { index: 1, east: -1, north: 0 },
      { index: 2, east: 0, north: 2 },
      { index: 3, east: 0, north: -2 },
    ]);
  });
});

describe('covarianceEllipse by hand', () => {
  it('(±1, 0), (0, ±2): s_ee = 2/3, s_nn = 8/3, s_en = 0 → major axis north, √(8/3) and √(2/3)', () => {
    const e = covarianceEllipse(landingPoints(result))!;
    expect(e.centreEast).toBe(0);
    expect(e.centreNorth).toBe(0);
    expect(e.semiMajor).toBeCloseTo(Math.sqrt(8 / 3), 15); // 1.6329931618554521
    expect(e.semiMinor).toBeCloseTo(Math.sqrt(2 / 3), 15); // 0.8164965809277260
    expect(e.angle).toBeCloseTo(Math.PI / 2, 15);
    expect(e.count).toBe(4);
  });
  it('(1, 1), (−1, −1), (0.5, −0.5), (−0.5, 0.5): s_ee = s_nn = 2.5/3, s_en = 0.5 → λ = 4/3 and 1/3 at 45°', () => {
    const e = covarianceEllipse([
      { index: 0, east: 1, north: 1 },
      { index: 1, east: -1, north: -1 },
      { index: 2, east: 0.5, north: -0.5 },
      { index: 3, east: -0.5, north: 0.5 },
    ])!;
    expect(e.semiMajor).toBeCloseTo(Math.sqrt(4 / 3), 14); // 1.1547005383792515
    expect(e.semiMinor).toBeCloseTo(Math.sqrt(1 / 3), 14); // 0.5773502691896257
    expect(e.angle).toBeCloseTo(Math.PI / 4, 15);
  });
  it('is shifted by the mean: the same points moved to (10, 20) keep their axes', () => {
    const e = covarianceEllipse([
      { index: 0, east: 11, north: 20 },
      { index: 1, east: 9, north: 20 },
      { index: 2, east: 10, north: 22 },
      { index: 3, east: 10, north: 18 },
    ])!;
    expect(e.centreEast).toBe(10);
    expect(e.centreNorth).toBe(20);
    expect(e.semiMajor).toBeCloseTo(Math.sqrt(8 / 3), 14);
  });
  it('needs at least two points', () => {
    expect(covarianceEllipse([])).toBeUndefined();
    expect(covarianceEllipse([{ index: 0, east: 1, north: 1 }])).toBeUndefined();
  });
});

describe('outlines', () => {
  it('the ellipse outline at k = 2 reaches 2 semi-major along the major axis and 2 semi-minor across', () => {
    const e = covarianceEllipse(landingPoints(result))!;
    const pts = ellipseOutline(e, 2, 4);
    // phi = 0: along the major axis (north); phi = π/2: along the minor axis (−east, since the axis is rotated by +90°).
    expect(pts[0]!.x).toBeCloseTo(0, 14);
    expect(pts[0]!.y).toBeCloseTo(2 * Math.sqrt(8 / 3), 14);
    expect(pts[1]!.x).toBeCloseTo(-2 * Math.sqrt(2 / 3), 14);
    expect(pts[1]!.y).toBeCloseTo(0, 14);
    expect(pts.every((p) => p.z === 0)).toBe(true);
  });
  it('the circle outline is the stored containment radius about the stored mean', () => {
    const pts = circleOutline(3, 4, 2, 4);
    expect(pts[0]).toEqual({ x: 5, y: 4, z: 0 });
    expect(pts[1]!.x).toBeCloseTo(3, 14);
    expect(pts[1]!.y).toBeCloseTo(6, 14);
  });
});

describe('buildLandingObjects', () => {
  it('one marker per landed run at its stored coordinates, the stored circle, and the two ellipses', () => {
    const o = buildLandingObjects(result, 0.5, 2);
    const names = o.group.children.map((c) => c.name);
    expect(names.filter((n) => n.startsWith('landing-'))).toEqual([
      'landing-0',
      'landing-1',
      'landing-2',
      'landing-3',
    ]);
    expect(names).toContain('containment-95');
    expect(names).toContain('ellipse-1sigma');
    expect(names).toContain('ellipse-2sigma');
    const chosen = o.group.getObjectByName('landing-2')!;
    expect(chosen.position.toArray()).toEqual([0, 2, 0]);
    expect(chosen.scale.x).toBe(1.8);
    expect(o.group.getObjectByName('landing-0')!.scale.x).toBe(1);
    expect(o.containment).toEqual({ east: 0, north: 0, radius: 2 });
  });
  it('no circle when the summary has none; no ellipse for a single point', () => {
    const o = buildLandingObjects(
      {
        runs: [{ index: 0, landingEast: 1, landingNorth: 1, error: undefined }],
        summary: { meanLanding: undefined, containmentRadius95: undefined },
      },
      0.5,
    );
    expect(o.group.children.map((c) => c.name)).toEqual(['landing-0']);
    expect(o.ellipse).toBeUndefined();
    expect(o.containment).toBeUndefined();
  });
});
