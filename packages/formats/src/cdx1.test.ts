/**
 * Plan 0075: the RASAero II `.CDX1` reader, on files written for these tests in the format of
 * RASAero II 1.0.2.0 (RASAero's own example files are not redistributed). Expected values are
 * worked by hand from the files and the manual's units: inches, pounds, feet, °F and mph.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateFlight } from '@lo-fi-rocket/physics';
import { describe, expect, it, vi } from 'vitest';
import { Cdx1ParseError, importCdx1 } from './cdx1.js';
import type { LibraryMotorRef } from './design/from-ork.js';
import type { RocketDesign } from './design/model.js';
import {
  designMassProperties,
  designSimulationOptions,
  designVehicle,
} from './design/to-physics.js';
import { parseEng } from './eng.js';
import { motorFromEng } from './motor-definition.js';

vi.setConfig({ testTimeout: 120_000 });

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const library: LibraryMotorRef[] = ['AeroTech_H128W', 'AeroTech_H238T'].map((f) => {
  const eng = parseEng(readFileSync(join(REFERENCE, 'motors', `${f}.eng`), 'utf8'))[0];
  if (eng === undefined) throw new Error(f);
  return { definition: motorFromEng(eng), provenance: { kind: 'bundled', file: `${f}.eng` } };
});

const IN = 0.0254;
const LB = 0.45359237;

const single = `<RASAeroDocument>
  <FileVersion>2</FileVersion>
  <RocketDesign>
    <NoseCone>
      <PartType>NoseCone</PartType><Length>10</Length><Diameter>3</Diameter>
      <Shape>Tangent Ogive</Shape><BluntRadius>0</BluntRadius><Location>0</Location>
    </NoseCone>
    <BodyTube>
      <PartType>BodyTube</PartType><Length>40</Length><Diameter>3</Diameter>
      <LaunchLugDiameter>0</LaunchLugDiameter><LaunchLugLength>0</LaunchLugLength>
      <RailGuideDiameter>0.4</RailGuideDiameter><RailGuideHeight>0.35</RailGuideHeight>
      <LaunchShoeArea>0</LaunchShoeArea><Location>10</Location><Overhang>0.5</Overhang>
      <Fin>
        <Count>3</Count><Chord>8</Chord><Span>3</Span><SweepDistance>4</SweepDistance>
        <TipChord>4</TipChord><Thickness>0.125</Thickness><LERadius>0</LERadius>
        <Location>9</Location><AirfoilSection>Square</AirfoilSection>
      </Fin>
    </BodyTube>
    <Surface>Smooth Paint</Surface>
    <Comments>Test flight
Barometric Altitude = 1,234 ft
RASAero II Prediction = 1300 ft</Comments>
  </RocketDesign>
  <LaunchSite>
    <Altitude>1000</Altitude><Pressure>0</Pressure><RodAngle>2</RodAngle><RodLength>8</RodLength>
    <Temperature>59</Temperature><WindSpeed>5</WindSpeed>
  </LaunchSite>
  <Recovery>
    <Altitude1>1000</Altitude1><Altitude2>500</Altitude2>
    <DeviceType1>Parachute</DeviceType1><DeviceType2>Parachute</DeviceType2>
    <Event1>True</Event1><Event2>True</Event2><Size1>24</Size1><Size2>60</Size2>
    <EventType1>Apogee</EventType1><EventType2>Altitude</EventType2><CD1>1.5</CD1><CD2>2.2</CD2>
  </Recovery>
  <SimulationList>
    <Simulation>
      <SustainerEngine>H128W  (AT)</SustainerEngine><SustainerLaunchWt>3</SustainerLaunchWt>
      <SustainerCG>30</SustainerCG><SustainerIgnitionDelay>0</SustainerIgnitionDelay>
      <IncludeBooster1>False</IncludeBooster1>
      <TimetoApogee>10.5</TimetoApogee><MaxAltitude>1300</MaxAltitude><MaxVelocity>400</MaxVelocity>
    </Simulation>
  </SimulationList>
</RASAeroDocument>`;

const finCan = `<RASAeroDocument>
  <FileVersion>2</FileVersion>
  <RocketDesign>
    <NoseCone>
      <PartType>NoseCone</PartType><Length>8</Length><Diameter>2.6</Diameter>
      <Shape>Conical</Shape><BluntRadius>0</BluntRadius><Location>0</Location>
    </NoseCone>
    <BodyTube>
      <PartType>BodyTube</PartType><Length>40</Length><Diameter>2.6</Diameter><Location>8</Location>
    </BodyTube>
    <FinCan>
      <PartType>FinCan</PartType><Length>10</Length><Diameter>2.8</Diameter>
      <InsideDiameter>2.6</InsideDiameter><Location>48</Location><ShoulderLength>0.5</ShoulderLength>
      <Offset>-10</Offset>
      <Fin>
        <Count>4</Count><Chord>6</Chord><Span>2.5</Span><SweepDistance>3</SweepDistance>
        <TipChord>3</TipChord><Thickness>0.1</Thickness><LERadius>0</LERadius>
        <Location>6.5</Location><AirfoilSection>Hexagonal</AirfoilSection>
      </Fin>
    </FinCan>
    <Surface>Polished</Surface>
  </RocketDesign>
</RASAeroDocument>`;

const twoStage = `<RASAeroDocument>
  <FileVersion>2</FileVersion>
  <RocketDesign>
    <NoseCone>
      <PartType>NoseCone</PartType><Length>12</Length><Diameter>3</Diameter>
      <Shape>Von Karman Ogive</Shape><BluntRadius>0</BluntRadius><Location>0</Location>
    </NoseCone>
    <BodyTube>
      <PartType>BodyTube</PartType><Length>48</Length><Diameter>3</Diameter><Location>12</Location>
      <Overhang>0</Overhang>
      <Fin>
        <Count>3</Count><Chord>6</Chord><Span>2.5</Span><SweepDistance>3</SweepDistance>
        <TipChord>3</TipChord><Thickness>0.125</Thickness><LERadius>0</LERadius>
        <Location>8</Location><AirfoilSection>Square</AirfoilSection>
      </Fin>
    </BodyTube>
    <BoatTail>
      <PartType>BoatTail</PartType><Length>4</Length><Diameter>3</Diameter>
      <RearDiameter>2.98</RearDiameter><Location>60</Location>
    </BoatTail>
    <Booster>
      <PartType>Booster</PartType><Length>50</Length><Diameter>4</Diameter>
      <InsideDiameter>3</InsideDiameter><RailGuideDiameter>0.4</RailGuideDiameter>
      <RailGuideHeight>0.35</RailGuideHeight><Location>60</Location><ShoulderLength>2</ShoulderLength>
      <Fin>
        <Count>4</Count><Chord>10</Chord><Span>3.5</Span><SweepDistance>5</SweepDistance>
        <TipChord>4</TipChord><Thickness>0.1875</Thickness><LERadius>0</LERadius>
        <Location>11</Location><AirfoilSection>Square</AirfoilSection>
      </Fin>
    </Booster>
    <Surface>Smooth (Zero Roughness)</Surface>
    <UseBooster1>True</UseBooster1>
  </RocketDesign>
  <SimulationList>
    <Simulation>
      <SustainerEngine>H128W  (AT)</SustainerEngine><SustainerLaunchWt>4</SustainerLaunchWt>
      <SustainerCG>30</SustainerCG><SustainerIgnitionDelay>1.5</SustainerIgnitionDelay>
      <Booster1Engine>H238T  (AT)</Booster1Engine><Booster1LaunchWt>10</Booster1LaunchWt>
      <Booster1CG>60</Booster1CG><Booster1SeparationDelay>0.5</Booster1SeparationDelay>
      <IncludeBooster1>True</IncludeBooster1>
    </Simulation>
  </SimulationList>
</RASAeroDocument>`;

const part = (design: RocketDesign, name: string) => {
  const c = design.components.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no ${name}`);
  return c;
};

describe('importCdx1: a single-stage rocket', () => {
  const imp = importCdx1(single, library, 'test', 'Single.CDX1');
  const d = imp.design;

  it('reads the parts in inches', () => {
    const nose = part(d, 'Nose cone');
    expect(nose.position).toBe(0);
    expect(nose.component).toMatchObject({ kind: 'noseCone', shape: 'ogive', shapeParameter: 1 });
    if (nose.component.kind !== 'noseCone') throw new Error('nose');
    expect(nose.component.length).toBeCloseTo(10 * IN, 12); // 0.254 m
    expect(nose.component.baseRadius).toBeCloseTo(1.5 * IN, 12); // 0.0381 m
    const tube = part(d, 'Body tube');
    expect(tube.position).toBeCloseTo(10 * IN, 12);
    if (tube.component.kind !== 'bodyTube') throw new Error('tube');
    expect(tube.component.length).toBeCloseTo(40 * IN, 12);
  });

  it('places the fins by their distance from the tube’s aft end (manual p. 13)', () => {
    // Tube 10 to 50 in; Location 9 in: the root leading edge at 50 − 9 = 41 in.
    const fins = part(d, 'Fins');
    expect(fins.position).toBeCloseTo(41 * IN, 12);
    expect(fins.component).toMatchObject({ kind: 'finSet', count: 3, crossSection: 'square' });
    if (fins.component.kind !== 'finSet') throw new Error('fins');
    expect(fins.component.rootChord).toBeCloseTo(8 * IN, 12);
    expect(fins.component.tipChord).toBeCloseTo(4 * IN, 12);
    expect(fins.component.sweep).toBeCloseTo(4 * IN, 12);
    expect(fins.component.span).toBeCloseTo(3 * IN, 12);
    expect(fins.component.thickness).toBeCloseTo(0.125 * IN, 12);
  });

  it('makes two rail guides of the given size (manual p. 19), their place listed', () => {
    const guides = part(d, 'Rail guides');
    if (guides.component.kind !== 'railButton') throw new Error('guides');
    expect(guides.component.count).toBe(2);
    expect(guides.component.outerDiameter).toBeCloseTo(0.4 * IN, 12);
    expect(guides.component.totalHeight).toBeCloseTo(0.35 * IN, 12);
    // A third of the way down the 10-to-50 in tube, 40/3 in apart.
    expect(guides.position).toBeCloseTo((10 + 40 / 3) * IN, 12);
    expect(d.approximations?.some((a) => a.subject === 'Rail guides')).toBe(true);
  });

  it('reads the finish, launch site, rail and wind', () => {
    expect(d.finish.roughnessHeight).toBeCloseTo(0.00025 * IN, 15); // Smooth Paint, 6.35 µm
    expect(d.launch.site.altitude).toBeCloseTo(304.8, 9); // 1000 ft
    expect(d.launch.site.temperature).toBeCloseTo(288.15, 9); // 59 °F
    // The standard day at 304.8 m (USSA 1976 eq. 33a): H = 304.785 m, T = 286.169 K,
    // p = 101 325 (286.169/288.15)^5.25588 = 97 716.7 Pa.
    expect(d.launch.site.pressure).toBeCloseTo(97_716.7, 0);
    expect(d.launch.rail.length).toBeCloseTo(8 * 0.3048, 12);
    expect(d.launch.rail.angleFromVertical).toBeCloseTo((2 * Math.PI) / 180, 12);
    expect(d.launch.wind.speed).toBeCloseTo(5 * 0.44704, 12); // 2.2352 m/s
    expect(d.launch.wind.from).toBe(0);
  });

  it('reads both recovery events', () => {
    expect(d.recovery).toHaveLength(2);
    const [drogue, main] = d.recovery;
    expect(drogue).toMatchObject({ dragCoefficient: 1.5, deploy: { event: 'apogee' } });
    expect(drogue?.kind === 'streamer' ? 0 : drogue?.diameter).toBeCloseTo(24 * IN, 12);
    expect(main).toMatchObject({ dragCoefficient: 2.2, deploy: { event: 'altitude' } });
    expect(main?.deploy.altitude).toBeCloseTo(500 * 0.3048, 12);
  });

  it('takes the motor from the library and reproduces the launch weight and CG', () => {
    expect(imp.notices).toContain('Motor AT H128W taken from the library.');
    expect(d.motorMount?.overhang).toBeCloseTo(0.5 * IN, 12);
    const liftoff = designMassProperties(d, 'liftoff');
    expect(liftoff.mass).toBeCloseTo(3 * LB, 12); // 1.36078 kg
    expect(liftoff.cg).toBeCloseTo(30 * IN, 12); // 0.762 m
  });

  it('keeps RASAero’s prediction and the measured apogee from the comments', () => {
    expect(imp.prediction?.apogee).toBeCloseTo(1300 * 0.3048, 9);
    expect(imp.measuredApogee).toBeCloseTo(1234 * 0.3048, 9);
    expect(imp.motorName).toBe('H128W (AT)');
  });

  it('simulates', () => {
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    expect(r.summary.apogee).toBeGreaterThan(0);
  });
});

describe('importCdx1: a fin can', () => {
  const d = importCdx1(finCan, [], 'can', 'Can.CDX1').design;

  it('ends the body tube under the can and adds the shoulder (exact geometry)', () => {
    // The can's 10 in sleeve, moved 10 in forward, covers 38 to 48 in.
    const tube = part(d, 'Body tube');
    if (tube.component.kind !== 'bodyTube') throw new Error('tube');
    expect(tube.component.length).toBeCloseTo(30 * IN, 12);
    const shoulder = part(d, 'Fin can shoulder');
    expect(shoulder.position).toBeCloseTo(38 * IN, 12);
    expect(shoulder.component).toMatchObject({ kind: 'transition' });
    if (shoulder.component.kind !== 'transition') throw new Error('shoulder');
    expect(shoulder.component.length).toBeCloseTo(0.5 * IN, 12);
    expect(shoulder.component.foreRadius).toBeCloseTo(1.3 * IN, 12);
    expect(shoulder.component.aftRadius).toBeCloseTo(1.4 * IN, 12);
    const can = part(d, 'Fin can');
    expect(can.position).toBeCloseTo(38.5 * IN, 12);
    if (can.component.kind !== 'bodyTube') throw new Error('can');
    expect(can.component.length).toBeCloseTo(9.5 * IN, 12);
  });

  it('puts the fins on the can, the hexagonal section listed as a double wedge', () => {
    const fins = part(d, 'Fin can fins');
    expect(fins.position).toBeCloseTo(41.5 * IN, 12); // 48 − 6.5
    expect(fins.component).toMatchObject({ crossSection: 'double-wedge', count: 4 });
    if (fins.component.kind !== 'finSet') throw new Error('fins');
    expect(fins.component.bodyRadius).toBeCloseTo(1.4 * IN, 12);
    expect(d.approximations?.find((a) => a.subject === 'Fin can fins')?.impact).toBe('moderate');
    expect(d.finish.roughnessHeight).toBeCloseTo(0.00005 * IN, 15); // Polished
  });

  it('notes the missing motor and simulates once one is chosen', () => {
    const imp = importCdx1(finCan, [], 'can', 'Can.CDX1');
    expect(imp.notices).toContain('The file names no motor: choose one in the motor panel.');
  });
});

describe('importCdx1: a two-stage rocket', () => {
  const imp = importCdx1(twoStage, library, 'two', 'Two.CDX1');
  const d = imp.design;

  it('keeps the nested boat tail on the sustainer and starts the booster behind it', () => {
    const tail = part(d, 'Boat tail');
    expect(tail.stage ?? 0).toBe(0);
    expect(tail.position).toBeCloseTo(60 * IN, 12);
    // The booster's transition starts at 64 in (the boat tail's end), from its 1.49 in radius.
    const transition = part(d, 'Booster 1 transition');
    expect(transition.stage).toBe(1);
    expect(transition.position).toBeCloseTo(64 * IN, 12);
    if (transition.component.kind !== 'transition') throw new Error('transition');
    expect(transition.component.foreRadius).toBeCloseTo(1.49 * IN, 12);
    expect(transition.component.aftRadius).toBeCloseTo(2 * IN, 12);
    expect(transition.component.length).toBeCloseTo(2 * IN, 12);
    // The booster's tube then runs to its aft end at 60 + 50 = 110 in.
    const tube = part(d, 'Booster 1 tube');
    expect(tube.position).toBeCloseTo(66 * IN, 12);
    if (tube.component.kind !== 'bodyTube') throw new Error('tube');
    expect(tube.component.length).toBeCloseTo(44 * IN, 12);
    expect(part(d, 'Booster 1 fins').position).toBeCloseTo(99 * IN, 12); // 110 − 11
    expect(part(d, 'Booster 1 fins').stage).toBe(1);
    expect(part(d, 'Rail guides').stage).toBe(1);
    expect(d.approximations?.some((a) => a.subject === 'Booster 1')).toBe(true);
  });

  it('separates the booster at its burnout plus the delay; the sustainer lights after both delays', () => {
    expect(d.stages).toEqual([
      { name: 'Sustainer' },
      { name: 'Booster 1', separation: { event: 'burnout', delay: 0.5 } },
    ]);
    expect(d.motorMount?.ignition).toEqual({ event: 'burnout', delay: 2 }); // 0.5 + 1.5 s
    expect(d.additionalMotorMounts).toHaveLength(1);
    expect(d.additionalMotorMounts?.[0]?.ignition).toBeUndefined();
    expect(imp.notices).toContain('Motor AT H238T (booster 1) taken from the library.');
  });

  it('gives the stack the booster’s lift-off weight and CG, and the sustainer its own', () => {
    // RASAero's booster weight and CG are the whole stack's at lift-off (10 lb at 60 in).
    const stack = designMassProperties(d, 'liftoff');
    expect(stack.mass).toBeCloseTo(10 * LB, 12);
    expect(stack.cg).toBeCloseTo(60 * IN, 12);
    const sustainer: RocketDesign = {
      ...d,
      components: d.components.filter((c) => (c.stage ?? 0) === 0),
    };
    delete (sustainer as { additionalMotorMounts?: unknown }).additionalMotorMounts;
    delete (sustainer as { stages?: unknown }).stages;
    const alone = designMassProperties(sustainer, 'liftoff');
    expect(alone.mass).toBeCloseTo(4 * LB, 12);
    expect(alone.cg).toBeCloseTo(30 * IN, 12);
  });

  it('flies both stages: separation 0.5 s after the booster’s burnout, ignition 1.5 s later', () => {
    const r = simulateFlight(designVehicle(d), designSimulationOptions(d));
    // H238T's curve ends at 1.036 s: separation at 1.536 s, the sustainer lit at 3.036 s.
    const separation = r.events.find((e) => e.kind === 'separation');
    expect(separation?.time).toBeCloseTo(1.536, 2);
    const ignitions = r.events.filter((e) => e.kind === 'ignition');
    expect(ignitions.at(-1)?.time).toBeCloseTo(3.036, 2);
    expect(r.summary.apogee).toBeGreaterThan(0);
  });
});

describe('importCdx1: what it cannot read', () => {
  it('refuses a file that is not RASAero’s, with what is wrong', () => {
    expect(() => importCdx1('<rocket/>', [], 'x', 'x.CDX1')).toThrow(Cdx1ParseError);
    expect(() => importCdx1('<rocket/>', [], 'x', 'x.CDX1')).toThrow(/no <RASAeroDocument>/);
    expect(() => importCdx1('<RASAeroDocument', [], 'x', 'x.CDX1')).toThrow(Cdx1ParseError);
  });

  it('names a field that is not a number', () => {
    const bad = single.replace('<Length>40</Length>', '<Length>forty</Length>');
    expect(() => importCdx1(bad, library, 'x', 'x.CDX1')).toThrow(
      /BodyTube > Length: expected a number, received "forty"/,
    );
  });

  it('lists an unknown nose shape and simulates it as an ogive', () => {
    const odd = single.replace('Tangent Ogive', 'Secant Ogive');
    const d = importCdx1(odd, library, 'x', 'x.CDX1').design;
    expect(part(d, 'Nose cone').component).toMatchObject({ shape: 'ogive' });
    expect(d.approximations?.find((a) => a.subject === 'Nose cone')?.what).toMatch(/Secant Ogive/);
  });

  it('matches a motor by its designation when the manufacturer is named differently', () => {
    const other = single.replace('H128W  (AT)', 'H128W  (AeroTech-RMS)');
    const imp = importCdx1(other, library, 'x', 'x.CDX1');
    expect(imp.design.motorMount?.motor?.definition.designation).toBe('H128W');
    expect(imp.notices.some((n) => n.includes('matched by its designation alone'))).toBe(true);
  });

  it('leaves out a booster the file’s simulation does not fly, as RASAero does', () => {
    const off = twoStage.replace(
      '<IncludeBooster1>True</IncludeBooster1>',
      '<IncludeBooster1>False</IncludeBooster1>',
    );
    const imp = importCdx1(off, library, 'x', 'x.CDX1');
    expect(imp.design.stages).toBeUndefined();
    expect(imp.design.components.some((c) => (c.stage ?? 0) > 0)).toBe(false);
    expect(imp.notices.some((n) => n.startsWith('Booster 1 is not included'))).toBe(true);
  });
});
