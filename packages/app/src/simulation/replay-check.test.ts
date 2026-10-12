/**
 * The replay check of a Monte Carlo run (D-072), by hand.
 */
import type { DispersionRun } from '@lo-fi-rocket/formats';
import type { FlightSummary } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { checkReplay, landingPointOf, replayMatches } from './replay-check.js';

const NOW = { appVersion: '1.0.0', physicsHash: 'a'.repeat(64) };
const OLD = { appVersion: '0.9.0', physicsHash: 'b'.repeat(64) };

function summary(distance: number | undefined, direction: number | undefined): FlightSummary {
  return { landingDistance: distance, landingDirection: direction } as unknown as FlightSummary;
}

function run(east: number | undefined, north: number | undefined): DispersionRun {
  return { index: 0, landingEast: east, landingNorth: north } as unknown as DispersionRun;
}

describe('landingPointOf', () => {
  it('east = d sin ψ, north = d cos ψ (ψ clockwise from north), as the batch records it', () => {
    // d = 10, ψ = π/6: east = 10 × 0.5 = 5, north = 10 × √3/2 = 8.660254037844387.
    const p = landingPointOf(summary(10, Math.PI / 6))!;
    expect(p.east).toBeCloseTo(5, 14);
    expect(p.north).toBeCloseTo(8.660254037844387, 14);
    expect(landingPointOf(summary(undefined, undefined))).toBeUndefined();
  });
});

describe('checkReplay', () => {
  const s = summary(10, Math.PI / 6);
  const same = run(10 * Math.sin(Math.PI / 6), 10 * Math.cos(Math.PI / 6));

  it('same provenance and the same landing point exactly: matches', () => {
    const c = checkReplay(same, NOW, s, NOW);
    expect(c).toEqual({ provenance: undefined, landing: undefined });
    expect(replayMatches(c)).toBe(true);
  });

  it('another app version or physics source: a provenance mismatch even when the landing agrees', () => {
    const c = checkReplay(same, OLD, s, NOW);
    expect(c.provenance).toEqual({ stored: OLD, current: NOW });
    expect(c.landing).toBeUndefined();
    expect(replayMatches(c)).toBe(false);
  });

  it('a landing point differing in the last bit is a mismatch (no tolerance: a faithful replay is bit-identical)', () => {
    const east = 10 * Math.sin(Math.PI / 6);
    const moved = run(east + Number.EPSILON * 8, 10 * Math.cos(Math.PI / 6));
    const c = checkReplay(moved, NOW, s, NOW);
    expect(c.provenance).toBeUndefined();
    expect(c.landing?.replayed).toEqual(landingPointOf(s));
    expect(c.landing?.stored?.east).toBe(east + Number.EPSILON * 8);
    expect(replayMatches(c)).toBe(false);
  });

  it('landed against not landed is a mismatch both ways; neither landed matches', () => {
    expect(checkReplay(run(undefined, undefined), NOW, s, NOW).landing).toEqual({
      stored: undefined,
      replayed: landingPointOf(s),
    });
    expect(checkReplay(same, NOW, summary(undefined, undefined), NOW).landing?.replayed).toBe(
      undefined,
    );
    expect(
      checkReplay(run(undefined, undefined), NOW, summary(undefined, undefined), NOW).landing,
    ).toBeUndefined();
  });

  it('both reasons together are both reported', () => {
    const c = checkReplay(run(0, 0), OLD, s, NOW);
    expect(c.provenance).toBeDefined();
    expect(c.landing).toBeDefined();
  });
});
