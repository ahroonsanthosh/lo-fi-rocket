/** Paint schemes (plan 3d-0002, D-3D-4): every scheme builds, textures keep their real size. */
import { MeshPhysicalMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { finishMaterial, PAINT_SCHEME_IDS, PAINT_SCHEMES, TEXTURE_SIZE_M } from './finish.js';

describe('finishes', () => {
  it('every scheme has a label and builds its three materials', () => {
    expect(PAINT_SCHEME_IDS).toContain('classic');
    for (const id of PAINT_SCHEME_IDS) {
      const s = PAINT_SCHEMES[id];
      expect(s.label.length).toBeGreaterThan(3);
      for (const f of [s.nose, s.body, s.fins]) {
        expect(finishMaterial(f, 0.157)).toBeInstanceOf(MeshPhysicalMaterial);
      }
    }
  });
  it('carbon round a 50 mm body: 0.157 m / 0.025 m = 6.28 → 6 weaves round, 40 per metre along', () => {
    const m = finishMaterial(
      { kind: 'carbon', colour: 0xffffff },
      Math.PI * 0.05,
    ) as MeshPhysicalMaterial;
    expect(m.map?.repeat.x).toBe(6);
    expect(m.map?.repeat.y).toBeCloseTo(1 / TEXTURE_SIZE_M.carbon, 12);
    // On a fin (uv in metres) both directions repeat every 25 mm.
    const f = finishMaterial({ kind: 'carbon', colour: 0xffffff }) as MeshPhysicalMaterial;
    expect(f.map?.repeat.x).toBeCloseTo(40, 12);
  });
});
