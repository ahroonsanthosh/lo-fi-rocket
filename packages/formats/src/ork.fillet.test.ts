/**
 * Plan 0073 part 3b (GEO-19): fin fillets read from `.ork` files, against OpenRocket 24.12's own
 * fin set mass and CG for 17 cases of radius, body, root, count, thickness, planform and fillet
 * material (`FilletProbe`, reference/rockets/fillet-probe/values.txt).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentMassProperties, type Component } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { orkToDesign } from './design/from-ork.js';
import { parseDesign, serializeDesign } from './design/serialize.js';
import { parseOrk } from './ork.js';

const PROBE = join(
  dirname(fileURLToPath(import.meta.url)),
  ...['..', '..', '..', 'reference', 'rockets', 'fillet-probe'],
);
const lines = readFileSync(join(PROBE, 'values.txt'), 'utf8')
  .split('\n')
  .filter((l) => l.includes(' mass='));

/** The probe's numbers for one case. */
function probe(tag: string): (k: string) => number {
  const line = lines.find((l) => l.startsWith(`${tag} `)) ?? '';
  return (k) => Number(new RegExp(` ${k}=([0-9.e+-]+)`).exec(line)?.[1]);
}
const finsOf = (tag: string): Component => {
  const rocket = parseOrk(
    new Uint8Array(readFileSync(join(PROBE, `fillet-${tag}.ork`))),
    `fillet-${tag}.ork`,
  );
  const fins = rocket.components.find((c) => c.component.kind === 'finSet');
  if (fins === undefined) throw new Error(`${tag}: no fin set`);
  return fins.component;
};

describe('fin fillets in .ork files (plan 0073, GEO-19)', () => {
  it('every probe case: the fin set mass within 1e-7 and its CG within 1e-9 m of OpenRocket’s', () => {
    expect(lines).toHaveLength(17);
    for (const line of lines) {
      const tag = line.split(' ')[0] ?? '';
      const v = (k: string): number => Number(new RegExp(` ${k}=([0-9.e+-]+)`).exec(line)?.[1]);
      const rocket = parseOrk(
        new Uint8Array(readFileSync(join(PROBE, `fillet-${tag}.ork`))),
        `fillet-${tag}.ork`,
      );
      const fins = rocket.components.find((c) => c.component.kind === 'finSet');
      if (fins?.component.kind !== 'finSet') throw new Error(`${tag}: no fin set`);
      // Nothing about the fillets is approximated any more.
      expect(fins.approximations ?? []).toEqual([]);
      if (v('fillet') > 0) {
        expect(fins.component.fillet).toEqual({ radius: v('fillet'), density: v('rho') });
      } else {
        expect(fins.component.fillet).toBeUndefined();
      }
      const m = componentMassProperties(fins.component);
      if (v('shape') === 1) {
        // OpenRocket's elliptical fin is a polygon of 0.18 % less area than the ellipse
        // (finArea 6.2717e-3 against π × 0.1 × 0.08/4 = 6.2832e-3 m², D-087): the plate differs,
        // so the fillet is compared by itself, against the same fins without it.
        expect(Math.abs(m.mass / v('mass') - 1), tag).toBeLessThan(0.002);
        expect(Math.abs(m.cgX - v('cgx')), tag).toBeLessThan(1e-9);
        continue;
      }
      expect(Math.abs(m.mass / v('mass') - 1), tag).toBeLessThan(1e-7);
      expect(Math.abs(m.cgX - v('cgx')), tag).toBeLessThan(1e-9);
    }
  });

  it('the elliptical fins’ fillets alone: OpenRocket’s increment within 1e-7', () => {
    const added = (tag: string, base: string): number =>
      componentMassProperties(finsOf(tag)).mass - componentMassProperties(finsOf(base)).mass;
    const theirs = probe('r6-ellip')('mass') - probe('r0-ellip')('mass');
    expect(Math.abs(added('r6-ellip', 'r0-ellip') / theirs - 1)).toBeLessThan(1e-7);
  });
});

describe('fin fillets in the design file (schema 6)', () => {
  it('keep their radius and material through a save and load, and are refused when malformed', () => {
    const { design } = orkToDesign(
      parseOrk(new Uint8Array(readFileSync(join(PROBE, 'fillet-r6.ork'))), 'fillet-r6.ork'),
      [],
      'd',
    );
    const fins = design.components.find((c) => c.component.kind === 'finSet');
    expect(fins?.component).toMatchObject({ fillet: { radius: 0.006, density: 680 } });
    const text = serializeDesign(design);
    expect(parseDesign(text)).toEqual(design);
    const bad = text.replace('"radius": 0.006', '"radius": "6 mm"');
    expect(bad).not.toBe(text);
    expect(() => parseDesign(bad)).toThrow(/fillet\.radius/);
  });
});
