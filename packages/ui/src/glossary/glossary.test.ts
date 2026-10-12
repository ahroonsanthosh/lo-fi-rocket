import { describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary.js';

describe('glossary', () => {
  it('every entry has a term, a name, a meaning, a good-value line and its basis', () => {
    for (const [key, e] of Object.entries(GLOSSARY)) {
      for (const field of [e.term, e.name, e.meaning, e.goodValue, e.basis]) {
        expect(field.trim().length, key).toBeGreaterThan(0);
      }
    }
  });
  it('covers the terms the owner named: CG, CP, calibers, Mach, C_D', () => {
    expect(GLOSSARY.cg.term).toBe('CG');
    expect(GLOSSARY.cp.term).toBe('CP');
    expect(GLOSSARY.calibers.term).toBe('Calibers');
    expect(GLOSSARY.mach.term).toBe('Mach');
    expect(GLOSSARY.cd.term).toBe('C_D');
  });
  it('quotes the project defaults, not other numbers (CLAUDE.md 9, D-042)', () => {
    expect(GLOSSARY.stabilityMargin.goodValue).toContain('Below 1 caliber');
    expect(GLOSSARY.stabilityMargin.goodValue).toContain('1 to 2 calibers');
    expect(GLOSSARY.railExitVelocity.goodValue).toContain('15 m/s');
    expect(GLOSSARY.thrustToWeight.goodValue).toContain('5:1');
    expect(GLOSSARY.deploymentVelocity.goodValue).toContain('20 m/s');
    expect(GLOSSARY.railAngle.goodValue).toContain('30°');
    expect(GLOSSARY.mach.goodValue).toContain('0.8');
  });
  it('says so where there is no sourced figure instead of inventing one', () => {
    expect(GLOSSARY.cd.goodValue).toContain('no single good value');
    expect(GLOSSARY.descentRate.goodValue).toContain('No sourced figure');
  });
  it('labels every rule of thumb as one', () => {
    expect(GLOSSARY.stabilityMargin.goodValue).toContain('rules of thumb');
    expect(GLOSSARY.deploymentVelocity.goodValue).toContain('rule of thumb');
  });
});
