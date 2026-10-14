/**
 * Plan 0070 step 3 (schema 3, D-106): a part's pod set in the design file and its mapping to the
 * physics, where the part is repeated around the axis.
 */
import { centreOfPressure, kilogramsPerCubicMetre, metres, mach } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { exampleDesign } from './example.js';
import { CURRENT_SCHEMA_VERSION, type DesignComponent, type RocketDesign } from './model.js';
import { parseDesign, serializeDesign } from './serialize.js';
import { designPlacedComponents, designStability } from './to-physics.js';

/** The example rocket (R1 with a D12) with two pods beside its tube's aft end, 75 mm out. */
function podded(): RocketDesign {
  const d = exampleDesign('pods');
  const pod = { count: 2, radialOffset: metres(0.075) };
  const parts: DesignComponent[] = [
    {
      id: 'pod-nose',
      name: 'Pod nose',
      position: metres(0.4),
      pod,
      component: {
        kind: 'noseCone',
        shape: 'conical',
        length: metres(0.05),
        baseRadius: metres(0.0125),
        density: kilogramsPerCubicMetre(160),
      },
    },
    {
      id: 'pod-tube',
      name: 'Pod tube',
      position: metres(0.45),
      pod,
      component: {
        kind: 'bodyTube',
        length: metres(0.15),
        outerRadius: metres(0.0125),
        wallThickness: metres(0.0005),
        density: kilogramsPerCubicMetre(700),
      },
    },
  ];
  return { ...d, components: [...d.components, ...parts] };
}

describe('pod sets in the design file (plan 0070, schema 3)', () => {
  it('a design with pods survives a file exactly, at the current schema version', () => {
    const d = podded();
    const text = serializeDesign(d);
    expect(text).toContain(`"schemaVersion": ${String(CURRENT_SCHEMA_VERSION)}`);
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
    expect(parseDesign(text)).toEqual(d);
  });

  it('reads a version-2 file as the same design, with no pods', () => {
    const d = exampleDesign('v2');
    const v2 = serializeDesign(d).replace('"schemaVersion": 3', '"schemaVersion": 2');
    expect(parseDesign(v2)).toEqual(d);
  });

  it('names the path and the problem in a bad pod set', () => {
    const base = JSON.parse(serializeDesign(podded())) as { components: Record<string, unknown>[] };
    const withPod = (pod: unknown): string => {
      const copy = structuredClone(base);
      const part = copy.components.find((p) => p['id'] === 'pod-nose');
      if (part === undefined) throw new Error('pod nose');
      part['pod'] = pod;
      return JSON.stringify(copy);
    };
    expect(() => parseDesign(withPod({ count: 0, radialOffset: 0.075 }))).toThrow(
      /\.pod\.count.*1 or more pods/,
    );
    expect(() => parseDesign(withPod({ count: 2, radialOffset: -0.01 }))).toThrow(
      /\.pod\.radialOffset.*0 m or more/,
    );
    expect(() => parseDesign(withPod({ count: 2.5, radialOffset: 0.075 }))).toThrow(/\.pod\.count/);
  });

  it('maps a pod set to the physics parts repeated around the axis', () => {
    const parts = designPlacedComponents(podded());
    const pods = parts.filter((p) => p.instances !== undefined);
    expect(pods).toHaveLength(2);
    expect(pods.every((p) => p.instances?.count === 2 && p.instances.radialOffset === 0.075)).toBe(
      true,
    );
    // The design's stability is the physics' with the pods: each pod nose adds 2 (A_pod/A_ref) = 0.5.
    const withPods = designStability(podded(), 'openrocket-equivalent').result;
    const without = designStability(exampleDesign('none'), 'openrocket-equivalent').result;
    expect(withPods.centreOfPressure.cnAlpha - without.centreOfPressure.cnAlpha).toBeCloseTo(1, 9);
    expect(withPods.centreOfPressure.cp).toBeCloseTo(
      centreOfPressure(parts, { mach: mach(0.3), rollAngle: 'worst', finRollReduction: false }).cp,
      12,
    );
  });
});
