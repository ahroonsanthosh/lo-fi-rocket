/**
 * Plan 0064 part 2b: staged `.ork` files, as OpenRocket 24.12 wrote them for the staging probe
 * (reference/rockets/staging-probe/values.txt), read and flown against OpenRocket's figures:
 * apogee within 5 % and maximum velocity within 3 % (CLAUDE.md 7.4), and the staging times.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { rocketMassProperties, simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { orkToDesign, type LibraryMotorRef } from './design/from-ork.js';
import {
  designFlightWarnings,
  designSimulationOptions,
  designVehicle,
} from './design/to-physics.js';
import type { RocketDesign } from './design/model.js';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';
import { parseOrk, type OrkRocket } from './ork.js';

vi.setConfig({ testTimeout: 120_000 });

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const PROBE = join(REFERENCE, 'rockets', 'staging-probe');

const library: LibraryMotorRef[] = ['Estes_C6', 'Estes_D12', 'AeroTech_G80T', 'AeroTech_H128W'].map(
  (f) => {
    const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${f}.eng`), 'utf8'))[0];
    if (eng === undefined) throw new Error(f);
    return { definition: motorFromEng(eng), provenance: { kind: 'bundled', file: `${f}.eng` } };
  },
);

const bytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(PROBE, `${name}.ork`)));
const read = (name: string): OrkRocket => parseOrk(bytes(name), `${name}.ork`);
const xml = (name: string): string => {
  const data = bytes(name);
  // OpenRocket saved some probe files as a zip and some as bare XML.
  return data[0] === 0x50 && data[1] === 0x4b
    ? strFromU8(unzipSync(data)['rocket.ork'] ?? new Uint8Array())
    : strFromU8(data);
};
const design = (rocket: OrkRocket): RocketDesign => {
  let n = 0;
  return orkToDesign(rocket, library, 'id', () => `part-${String((n += 1))}`).design;
};

describe('staged .ork files are read stage by stage', () => {
  it('staged-bp: two stages, x continuing, a mount each, automatic ignition', () => {
    const r = read('staged-bp');
    expect(r.stages).toEqual([
      { name: 'Sustainer' },
      { name: 'Booster', separation: { event: 'upper-ignition', delay: 0 } },
    ]);
    // The booster's body tube starts where the sustainer ends: its 4r = 0.066 m ogive and 0.35 m tube.
    const booster = r.components.findIndex((c) => c.name === 'Booster body');
    expect(r.components[booster]?.position).toBeCloseTo(0.416, 12);
    expect(r.componentStage[booster]).toBe(1);
    expect(r.length).toBeCloseTo(0.536, 12);
    expect(r.motorMounts.map((m) => [m.designation, m.stage, m.ignition.event, m.delay])).toEqual([
      ['C6', 0, 'automatic', 5],
      ['D12', 1, 'automatic', 0],
    ]);
    expect(r.motorMount).toBe(r.motorMounts[0]);
    expect(r.approximations).toEqual([]);
  });

  it('staged-hpr: the sustainer lit 0.5 s after the booster’s burnout, separation at burnout', () => {
    const r = read('staged-hpr');
    expect(r.stages[1]?.separation).toEqual({ event: 'burnout', delay: 0 });
    expect(r.motorMounts.map((m) => [m.designation, m.ignition])).toEqual([
      // The file and the library's AeroTech_G80T.eng both name it G80NBT.
      ['G80NBT', { event: 'burnout', delay: 0.5 }],
      ['H128W', { event: 'automatic', delay: 0 }],
    ]);
  });

  it('read a configuration’s own separation and OpenRocket’s words for the other events', () => {
    const text = xml('staged-hpr');
    const id = /<motorconfiguration configid="([^"]+)"/.exec(text)?.[1] ?? '';
    const withConfig = (event: string, extra = ''): OrkRocket =>
      parseOrk(
        text.replace(
          '<separationdelay>0.0</separationdelay>',
          `<separationdelay>0.0</separationdelay><separationconfiguration configid="${id}"><separationevent>${event}</separationevent><separationaltitude>${extra || '150.0'}</separationaltitude><separationdelay>0.25</separationdelay></separationconfiguration>`,
        ),
        'edited.ork',
      );
    expect(withConfig('apogee').stages[1]?.separation).toEqual({ event: 'apogee', delay: 0.25 });
    expect(withConfig('altitudedescending').stages[1]?.separation).toEqual({
      event: 'altitude-descending',
      delay: 0.25,
      altitude: 150,
    });
    // At or below the pad, a climbing altitude is crossed at launch and a descending one never.
    expect(withConfig('altitudeascending', '0.0').stages[1]?.separation).toEqual({
      event: 'launch',
      delay: 0.25,
    });
    const unknown = withConfig('whenever');
    expect(unknown.stages[1]?.separation).toEqual({ event: 'upper-ignition', delay: 0.25 });
    expect(unknown.approximations[0]?.what).toBe(
      'its separation event "whenever", which the app does not know',
    );
    // The ignition's words: "ejectioncharge" is the ejection charge.
    const ejection = parseOrk(
      text.replace(
        '<ignitionevent>burnout</ignitionevent>',
        '<ignitionevent>ejectioncharge</ignitionevent>',
      ),
      'edited.ork',
    );
    expect(ejection.motorMount?.ignition.event).toBe('ejection');
  });

  it('a booster switched off: the sustainer flies alone, as in OpenRocket', () => {
    const r = read('staged-off-booster');
    expect(r.stages).toEqual([{ name: 'Sustainer' }]);
    expect(r.motorMounts.map((m) => m.designation)).toEqual(['C6']);
    expect(r.components.some((c) => c.name.startsWith('Booster'))).toBe(false);
    expect(r.notices.join(' ')).toMatch(/The stage "Booster" is switched off/);
    // One stage left, so the design is a one-stage design: automatic is launch (OpenRocket: C6 at 0 s).
    const d = design(r);
    expect(d.stages).toBeUndefined();
    expect(designVehicle(d).stages).toBeUndefined();
  });

  it('a middle stage switched off: an empty stage, so the sustainer never lights, and the gap listed', () => {
    const r = read('staged-off-middle');
    expect(r.stages.map((s) => s.name)).toEqual(['Sustainer', 'Middle', 'Bottom']);
    expect(r.componentStage.includes(1)).toBe(false);
    expect(r.motorMounts.map((m) => [m.designation, m.stage])).toEqual([
      ['C6', 0],
      ['D12', 2],
    ]);
    // OpenRocket keeps the bottom stage at 0.536 m, behind a 0.12 m gap; the model needs one body,
    // so it moves up to the sustainer's end at 0.416 m, and that is listed.
    const bottom = r.components.find((c) => c.name === 'Booster body');
    expect(bottom?.position).toBeCloseTo(0.416, 12);
    expect(r.length).toBeCloseTo(0.536, 12);
    expect(r.motorMounts[1]?.aftEnd).toBeCloseTo(0.536, 12);
    expect(r.approximations.map((a) => a.impact)).toEqual(['major']);
    const d = design(r);
    const result = simulateFlight(
      designVehicle(d),
      designSimulationOptions(d, 'openrocket-equivalent'),
    );
    // OpenRocket: only the bottom D12 lights; nothing separates.
    expect(result.events.filter((e) => e.kind === 'ignition')).toHaveLength(1);
    expect(result.events.some((e) => e.kind === 'separation')).toBe(false);
    expect(designFlightWarnings(d, result).map((w) => w.code)).toContain('ignition');
  });

  it('a lower stage’s mass override scales that stage’s parts, its CG from the stage’s front', () => {
    const r = read('staged-override');
    // The booster's parts: 70 g with their CG 50 mm behind its front at 0.416 m (staging-probe part 6).
    const parts = r.components.filter((_, i) => r.componentStage[i] === 1);
    const booster = rocketMassProperties(parts);
    expect(booster.mass).toBeCloseTo(0.07, 12);
    expect(booster.cg).toBeCloseTo(0.466, 12);
    expect(r.asBuilt).toBeUndefined();
    // With both motors loaded, OpenRocket's liftoff mass and CG: 0.198145 kg at 0.380318 m.
    const d = design(r);
    const v = designVehicle(d);
    const liftoff = simulateFlight(v, designSimulationOptions(d, 'openrocket-equivalent'))
      .samples[0];
    expect(liftoff?.mass).toBeCloseTo(0.198145, 5);
  });
});

describe('staged flights against OpenRocket (apogee 5 %, maximum velocity 3 %)', () => {
  // reference/rockets/staging-probe/values.txt, OpenRocket 24.12 with the reference harness's
  // settings and no wind (as the Phase 2 references): the sustainer's figures and staging times.
  const CASES = [
    {
      file: 'staged-bp',
      apogee: 438.304,
      maxVelocity: 97.202,
      separation: 1.6502,
      ignition: 1.6502,
    },
    {
      file: 'staged-hpr',
      apogee: 1126.746,
      maxVelocity: 304.574,
      separation: 1.293,
      ignition: 1.7936,
    },
  ];
  for (const c of CASES) {
    it(c.file, () => {
      const d = design(read(c.file));
      const r = simulateFlight(
        designVehicle(d),
        designSimulationOptions(d, 'openrocket-equivalent'),
      );
      const rel = (a: number, b: number): number => Math.abs(a - b) / b;
      expect(rel(r.summary.apogee, c.apogee)).toBeLessThan(0.05);
      expect(rel(r.summary.maxVelocity, c.maxVelocity)).toBeLessThan(0.03);
      // OpenRocket fires timed events at its next step (1 ms here); the times agree to 2 ms.
      const separation = r.events.find((e) => e.kind === 'separation')?.time as number;
      const ignitions = r.events.filter((e) => e.kind === 'ignition').map((e) => e.time as number);
      expect(Math.abs(separation - c.separation)).toBeLessThan(0.002);
      expect(Math.abs((ignitions[1] ?? Number.NaN) - c.ignition)).toBeLessThan(0.002);
      console.log(
        `${c.file}: apogee ${r.summary.apogee.toFixed(3)} m (OpenRocket ${String(c.apogee)}, ${((r.summary.apogee / c.apogee - 1) * 100).toFixed(2)} %), max velocity ${r.summary.maxVelocity.toFixed(3)} m/s (${String(c.maxVelocity)}, ${((r.summary.maxVelocity / c.maxVelocity - 1) * 100).toFixed(2)} %), separation ${separation.toFixed(4)} s, ignition ${(ignitions[1] ?? Number.NaN).toFixed(4)} s`,
      );
    });
  }
});
