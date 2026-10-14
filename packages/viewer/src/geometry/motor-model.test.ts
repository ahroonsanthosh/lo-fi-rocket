/** The motor drawn from its data (plan 3d-0002, D-3D-4), by hand. */
import { describe, expect, it } from 'vitest';
import { buildMotors, caseOutline, motorNozzles, motorStyle } from './motor-model.js';

const reload = {
  diameter: 0.029,
  length: 0.124,
  aftEnd: 0.61,
  offsets: [{ y: 0, z: 0 }],
  manufacturer: 'AeroTech',
};

describe('motor model', () => {
  it('styles Estes, Quest and Apogee as paper motors and the rest as reloads', () => {
    expect(motorStyle('Estes Industries')).toBe('paper');
    expect(motorStyle('Quest')).toBe('paper');
    expect(motorStyle('AeroTech')).toBe('reload');
    expect(motorStyle('Cesaroni Technology')).toBe('reload');
  });
  it('puts the case from aftEnd − length to aftEnd at the motor radius', () => {
    expect(caseOutline(reload)).toEqual([
      [-0.124, 0],
      [-0.124, 0.0145],
      [0, 0.0145],
    ]);
  });
  it('places the nozzle exit 0.2 d aft for a reload (flush for paper), radius 0.3 d, per motor', () => {
    const [n] = motorNozzles(reload);
    expect(n!.x).toBeCloseTo(0.61 + 0.2 * 0.029, 12); // 0.6158
    expect(n!.radius).toBeCloseTo(0.0087, 12);
    const paper = motorNozzles({ ...reload, manufacturer: 'Estes' });
    expect(paper[0]!.x).toBe(0.61);
    const cluster = motorNozzles({
      ...reload,
      offsets: [
        { y: 0.03, z: 0 },
        { y: -0.03, z: 0 },
      ],
    });
    expect(cluster.map((c) => c.y)).toEqual([0.03, -0.03]);
  });
  it('builds a case and a nozzle per motor at the aft end', () => {
    const g = buildMotors({
      ...reload,
      offsets: [
        { y: 0.02, z: 0.01 },
        { y: -0.02, z: 0 },
      ],
    });
    expect(g.children).toHaveLength(4);
    expect(g.children[0]!.position.toArray()).toEqual([0.61, 0.02, 0.01]);
  });
});
