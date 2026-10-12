/**
 * The wind tunnel models in the physics package equal the transcription in
 * `reference/digitised/wind-tunnel-validation.json` (plan 0021, D-057).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCAS_COMPONENTS, nacaA53d02Components } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'digitised',
  'wind-tunnel-validation.json',
);
interface Fins {
  count: number;
  root_chord_in: number;
  tip_chord_in: number;
  span_in: number;
  sweep_in: number;
  thickness_in: number;
  root_leading_edge_in: number;
}
interface Geometry {
  arcas_half_scale_model: {
    transcription: {
      diameter_m: number;
      nose: { length_in: number; shape_parameter: number };
      cylinder: { from_in: number; to_in: number };
      boattail: { length_in: number; fore_radius_in: number; aft_radius_in: number };
      fins: Fins;
    };
  };
  naca_a53d02_model: {
    transcription: {
      diameter_in: number;
      length_in: number;
      nose_length_in: number;
      fins: Fins;
    };
  };
}
const INCH = 0.0254;
const geometry = (JSON.parse(readFileSync(FILE, 'utf8')) as { geometry: Geometry }).geometry;

function fin(components: readonly { component: { kind: string } }[]): Record<string, number> {
  const f = components.find((p) => p.component.kind === 'finSet') as
    { position: number; component: Record<string, number> } | undefined;
  if (f === undefined) throw new Error('no fin set');
  return { position: f.position, ...f.component };
}

describe('wind tunnel models against the transcription', () => {
  it('ARCAS', () => {
    const t = geometry.arcas_half_scale_model.transcription;
    const [nose, tube, tail] = ARCAS_COMPONENTS;
    expect(nose?.component.kind).toBe('noseCone');
    if (nose?.component.kind !== 'noseCone') return;
    expect(nose.component.length).toBeCloseTo(t.nose.length_in * INCH, 12);
    expect(nose.component.shapeParameter).toBe(t.nose.shape_parameter);
    expect(nose.component.baseRadius).toBeCloseTo(t.diameter_m / 2, 12);
    if (tube?.component.kind !== 'bodyTube') throw new Error('tube');
    expect(tube.component.length).toBeCloseTo((t.cylinder.to_in - t.cylinder.from_in) * INCH, 12);
    if (tail?.component.kind !== 'transition') throw new Error('tail');
    expect(tail.component.length).toBeCloseTo(t.boattail.length_in * INCH, 12);
    expect(tail.component.aftRadius).toBeCloseTo(t.boattail.aft_radius_in * INCH, 12);
    const f = fin(ARCAS_COMPONENTS);
    expect(f['count']).toBe(t.fins.count);
    expect(f['rootChord']).toBeCloseTo(t.fins.root_chord_in * INCH, 12);
    expect(f['tipChord']).toBeCloseTo(t.fins.tip_chord_in * INCH, 12);
    expect(f['span']).toBeCloseTo(t.fins.span_in * INCH, 12);
    expect(f['sweep']).toBeCloseTo(t.fins.sweep_in * INCH, 12);
    expect(f['thickness']).toBeCloseTo(t.fins.thickness_in * INCH, 12);
    expect(f['position']).toBeCloseTo(t.fins.root_leading_edge_in * INCH, 12);
  });
  it('NACA RM A53D02', () => {
    const t = geometry.naca_a53d02_model.transcription;
    const c = nacaA53d02Components('square');
    const [nose, tube] = c;
    if (nose?.component.kind !== 'noseCone') throw new Error('nose');
    expect(nose.component.length).toBeCloseTo(t.nose_length_in * INCH, 12);
    expect(nose.component.baseRadius).toBeCloseTo((t.diameter_in / 2) * INCH, 12);
    if (tube?.component.kind !== 'bodyTube') throw new Error('tube');
    expect(tube.component.length).toBeCloseTo((t.length_in - t.nose_length_in) * INCH, 12);
    const f = fin(c);
    expect(f['rootChord']).toBeCloseTo(t.fins.root_chord_in * INCH, 12);
    expect(f['tipChord']).toBeCloseTo(t.fins.tip_chord_in * INCH, 12);
    expect(f['span']).toBeCloseTo(t.fins.span_in * INCH, 12);
    expect(f['sweep']).toBeCloseTo(t.fins.sweep_in * INCH, 12);
    expect(f['thickness']).toBeCloseTo(t.fins.thickness_in * INCH, 12);
    expect(f['position']).toBeCloseTo(t.fins.root_leading_edge_in * INCH, 12);
  });
});
