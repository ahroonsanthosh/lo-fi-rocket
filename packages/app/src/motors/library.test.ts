import { describe, expect, it } from 'vitest';
import { bundledMotors, motorFigures } from './library.js';

describe('motor library (plan 0013)', () => {
  it('bundles the eight reference motors with their delays', () => {
    const motors = bundledMotors();
    expect(motors.map((m) => m.definition.designation)).toEqual([
      'C6',
      'D12',
      'E16',
      'F39T',
      'G80NBT',
      'H128W',
      'H238T',
      'H123W',
    ]);
    const d12 = motors[1];
    expect(d12?.delays).toEqual([0, 3, 5, 7]);
    expect(d12?.provenance).toEqual({ kind: 'bundled', file: 'Estes_D12.eng' });
  });
  it('figures: D12 total impulse 16.839 N·s over 1.65 s = 10.205 N average, 29.73 N peak', () => {
    const d12 = bundledMotors()[1];
    if (d12 === undefined) throw new Error('missing');
    const f = motorFigures(d12.definition);
    expect(f.totalImpulse).toBeCloseTo(16.839, 3);
    expect(f.burnTime).toBe(1.65);
    // 16.839 / 1.65 = 10.2055
    expect(f.averageThrust).toBeCloseTo(10.2055, 3);
    expect(f.maxThrust).toBe(29.73);
  });
});
