/**
 * .ork import to a design (plan 0015): R1 to R4 from the files reproduce
 * the CG, CP and apogee figures of the acceptance tests; R5 imports with
 * its motor unmatched and a notice.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seconds, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { parseEng } from '../eng.js';
import { motorFromEng } from '../motor-definition.js';
import { parseOrk } from '../ork.js';
import { orkToDesign, type LibraryMotorRef } from './from-ork.js';
import { parseDesign, serializeDesign } from './serialize.js';
import { designSimulationOptions, designStability, designVehicle } from './to-physics.js';

const REFERENCE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
);
const library: LibraryMotorRef[] = [
  'Estes_D12',
  'AeroTech_G80T',
  'AeroTech_F39T',
  'AeroTech_H123W',
].map((f) => {
  const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${f}.eng`), 'utf8'))[0];
  if (eng === undefined) throw new Error(f);
  return { definition: motorFromEng(eng), provenance: { kind: 'bundled', file: `${f}.eng` } };
});
const ork = (name: string) =>
  parseOrk(new Uint8Array(readFileSync(join(REFERENCE, 'rockets', `${name}.ork`))));

describe('orkToDesign (plan 0015)', () => {
  it('R1: components, mount, motor, recovery and reference diameter; CP 0.487227 m, CG 0.387022 m, apogee 168.87 m', () => {
    const { design, notices } = orkToDesign(ork('r1-three-fin-conical'), library, 'r1');
    expect(design.components.length).toBe(9);
    expect(design.motorMount?.motor?.definition.designation).toBe('D12');
    expect(design.motorMount?.motor?.ejectionDelay).toBe(5);
    expect(design.motorMount?.overhang).toBeCloseTo(0, 12);
    expect(design.recovery[0]?.deploy.event).toBe('apogee');
    expect(design.referenceDiameter).toBe(0.05);
    expect(notices[0]).toMatch(/Motor Estes D12 taken from the library/);
    const s = designStability(design, 'openrocket-equivalent');
    expect(s.result.centreOfPressure.cp).toBeCloseTo(0.487227, 5);
    expect(s.result.cgLiftoff).toBeCloseTo(0.387022, 6);
    const rk = {
      ...design,
      simulation: {
        ...design.simulation,
        integrator: { kind: 'rk4' as const, timeStep: seconds(0.002) },
      },
    };
    expect(
      simulateFlight(designVehicle(rk), designSimulationOptions(rk, 'openrocket-equivalent'))
        .summary.apogee,
    ).toBeCloseTo(168.866, 1);
    // The imported design is a valid file.
    expect(parseDesign(serializeDesign(design))).toEqual(design);
  });
  it('R2 to R4 match their motors and validate', () => {
    for (const [file, motor] of [
      ['r2-ogive-boattail', 'G80NBT'],
      ['r3-minimum-diameter-24', 'F39T'],
      ['r4-scratch-38mm', 'H123W'],
    ] as const) {
      const { design } = orkToDesign(ork(file), library, file);
      expect(design.motorMount?.motor?.definition.designation).toBe(motor);
      expect(() => parseDesign(serializeDesign(design))).not.toThrow();
    }
  });
  it('R5 imports without its H238T (not in the library given) and says so', () => {
    const { design, notices } = orkToDesign(ork('r5-transonic-min-dia-29'), library, 'r5');
    expect(design.motorMount).toBeDefined();
    expect(design.motorMount?.motor).toBeUndefined();
    expect(notices[0]).toMatch(
      /names the motor AeroTech H238T \(29 mm, delay \d+ s\) but carries no thrust curve/,
    );
  });
});
