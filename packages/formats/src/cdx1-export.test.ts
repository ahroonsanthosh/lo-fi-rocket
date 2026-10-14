/**
 * Plan 0077: writing designs as RASAero II `.CDX1` files. Each reference rocket written and read
 * back keeps its outline, fins, guides, finish class and lift-off weight and CG; designs RASAero
 * cannot hold are refused with what to change.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metres } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { importCdx1 } from './cdx1.js';
import { Cdx1ExportError, exportCdx1 } from './cdx1-export.js';
import { orkToDesign, type LibraryMotorRef } from './design/from-ork.js';
import type { RocketDesign } from './design/model.js';
import { designMassProperties } from './design/to-physics.js';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { parseOrk } from './ork.js';

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const library: LibraryMotorRef[] = [
  'Estes_C6',
  'Estes_D12',
  'Estes_E16',
  'AeroTech_F39T',
  'AeroTech_G80T',
  'AeroTech_H123W',
  'AeroTech_H128W',
  'AeroTech_H238T',
].map((f) => {
  const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${f}.eng`), 'utf8'))[0];
  if (eng === undefined) throw new Error(f);
  return { definition: motorFromEng(eng), provenance: { kind: 'bundled', file: `${f}.eng` } };
});

function rocket(name: string): RocketDesign {
  let n = 0;
  const file = join(REFERENCE, 'rockets', `${name}.ork`);
  return orkToDesign(parseOrk(new Uint8Array(readFileSync(file)), name), library, name, () => {
    n += 1;
    return `${name}-${String(n)}`;
  }).design;
}

const outline = (d: RocketDesign) =>
  d.components
    .filter((c) => ['noseCone', 'bodyTube', 'transition'].includes(c.component.kind))
    .map((c) => ({ kind: c.component.kind, at: c.position, c: c.component }));

describe('exportCdx1: the reference rockets written and read back', () => {
  for (const name of [
    'r1-three-fin-conical',
    'r2-ogive-boattail',
    'r3-minimum-diameter-24',
    'r4-scratch-38mm',
    'r5-transonic-min-dia-29',
  ]) {
    it(name, () => {
      const design = rocket(name);
      const exported = exportCdx1(design);
      const back = importCdx1(exported.text, library, 'back', `${name}.CDX1`).design;
      // The outline: same parts, places and sizes (RASAero's inches to 10 digits, about 1e-10 m).
      const a = outline(design);
      const b = outline(back);
      expect(b.map((p) => p.kind)).toEqual(a.map((p) => p.kind));
      a.forEach((p, i) => {
        const q = b[i];
        expect(q?.at).toBeCloseTo(p.at, 8);
        for (const key of [
          'length',
          'baseRadius',
          'outerRadius',
          'foreRadius',
          'aftRadius',
        ] as const) {
          if (key in p.c) {
            expect((q?.c as unknown as Record<string, number>)[key]).toBeCloseTo(
              (p.c as unknown as Record<string, number>)[key] ?? NaN,
              8,
            );
          }
        }
      });
      // The fins: the same set at the same place.
      const f = design.components.find((c) => c.component.kind === 'finSet');
      const g = back.components.find((c) => c.component.kind === 'finSet');
      if (f?.component.kind !== 'finSet' || g?.component.kind !== 'finSet') throw new Error('fins');
      expect(g.position).toBeCloseTo(f.position, 8);
      for (const key of ['rootChord', 'tipChord', 'sweep', 'span', 'thickness'] as const) {
        expect(g.component[key]).toBeCloseTo(f.component[key], 8);
      }
      expect(g.component.count).toBe(f.component.count);
      expect(g.component.crossSection).toBe(f.component.crossSection ?? 'square');
      // The motor is the same, and the lift-off weight and CG come back (10 digits).
      expect(back.motorMount?.motor?.definition.designation).toBe(
        design.motorMount?.motor?.definition.designation,
      );
      const m0 = designMassProperties(design, 'liftoff');
      const m1 = designMassProperties(back, 'liftoff');
      expect(m1.mass / m0.mass - 1).toBeLessThan(1e-9);
      expect(Math.abs(m1.cg - m0.cg)).toBeLessThan(1e-9);
      // The finish: 60 µm is nearest RASAero's "Rough Camouflage Paint" class, 0.0012 in = 30.48 µm
      // (|ln(60/30.48)| = 0.677 against |ln(152.4/60)| = 0.932 for "Galvanized Metal").
      expect(back.finish.roughnessHeight).toBeCloseTo(0.0012 * 0.0254, 12);
      expect(exported.notices.some((n) => n.includes('Rough Camouflage Paint'))).toBe(true);
    });
  }

  it('writes rail guides and a launch lug at their sizes', () => {
    const r2 = exportCdx1(rocket('r2-ogive-boattail')).text;
    // R2's buttons: 10 mm across, 10 mm high = 0.3937007874 in.
    expect(r2).toContain('<RailGuideDiameter>0.3937007874</RailGuideDiameter>');
    expect(r2).toContain('<RailGuideHeight>0.3937007874</RailGuideHeight>');
    expect(r2).toContain('<BoatTail>');
    const r1 = exportCdx1(rocket('r1-three-fin-conical')).text;
    // R1's lug: 6 mm across (0.2362204724 in), 50 mm long (1.968503937 in).
    expect(r1).toContain('<LaunchLugDiameter>0.2362204724</LaunchLugDiameter>');
    expect(r1).toContain('<LaunchLugLength>1.968503937</LaunchLugLength>');
    expect(r1).toContain('<SustainerEngine>D12  (Estes)</SustainerEngine>');
    expect(r1).toContain('\r\n');
  });
});

describe('exportCdx1: fin sections', () => {
  it('writes each section by RASAero’s name; the double wedge with its diamond length at half span', () => {
    const r1 = rocket('r1-three-fin-conical');
    const as = (crossSection: 'rounded' | 'airfoil' | 'wedge' | 'double-wedge'): string =>
      exportCdx1({
        ...r1,
        components: r1.components.map((c) =>
          c.component.kind === 'finSet' ? { ...c, component: { ...c.component, crossSection } } : c,
        ),
      }).text;
    expect(as('rounded')).toContain('<AirfoilSection>Rounded</AirfoilSection>');
    expect(as('airfoil')).toContain('<AirfoilSection>Biconvex</AirfoilSection>');
    expect(as('wedge')).toContain('<AirfoilSection>Single Wedge</AirfoilSection>');
    const dw = as('double-wedge');
    expect(dw).toContain('<AirfoilSection>Double Wedge</AirfoilSection>');
    // R1's fins: root 100 mm, tip 50 mm; mid-span chord 75 mm, half of it 37.5 mm = 1.476377953 in.
    expect(dw).toContain('<FX1>1.476377953</FX1>');
    // Each reads back as the same section.
    for (const s of ['rounded', 'airfoil', 'wedge', 'double-wedge'] as const) {
      const back = importCdx1(as(s), library, 'b', 'b.CDX1').design;
      const fins = back.components.find((c) => c.component.kind === 'finSet');
      expect(fins?.component.kind === 'finSet' ? fins.component.crossSection : undefined).toBe(s);
    }
  });
});

describe('exportCdx1: what RASAero II cannot hold is refused with what to change', () => {
  const r1 = rocket('r1-three-fin-conical');

  it('a second stage', () => {
    const staged: RocketDesign = {
      ...r1,
      stages: [
        { name: 'Top' },
        { name: 'Booster', separation: { event: 'burnout', delay: 0 as never } },
      ],
    };
    expect(() => exportCdx1(staged)).toThrow(Cdx1ExportError);
    expect(() => exportCdx1(staged)).toThrow(/one-stage designs/);
  });
  it('a step in the body diameter', () => {
    const tube = r1.components.find((c) => c.component.kind === 'bodyTube');
    if (tube?.component.kind !== 'bodyTube') throw new Error('tube');
    const stepped: RocketDesign = {
      ...r1,
      components: [
        ...r1.components,
        {
          id: 'extra',
          name: 'Wider tube',
          position: metres((tube.position as number) + (tube.component.length as number)),
          component: { ...tube.component, outerRadius: metres(0.03) },
        },
      ],
    };
    expect(() => exportCdx1(stepped)).toThrow(/“Wider tube” at 0.600 m does not fit/);
  });
  it('no motor', () => {
    const { motorMount, ...rest } = r1;
    expect(motorMount).toBeDefined();
    expect(() =>
      exportCdx1({ ...rest, motorMount: { ...r1.motorMount!, motor: undefined as never } }),
    ).toThrow(/choose one to export/);
  });
  it('an elliptical fin set', () => {
    const elliptical: RocketDesign = {
      ...r1,
      components: r1.components.map((c) =>
        c.component.kind === 'finSet'
          ? { ...c, component: { ...c.component, shape: { kind: 'elliptical' } as never } }
          : c,
      ),
    };
    expect(() => exportCdx1(elliptical)).toThrow(/trapezoidal fins only/);
  });
});
