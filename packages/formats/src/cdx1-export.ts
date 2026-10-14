/**
 * Writing a design as a RASAero II `.CDX1` file (plan 0077), the inverse of `cdx1.ts`, in the
 * same units and meanings: inches, pounds, feet, °F and mph; fins placed by their distance from
 * their tube's aft end (manual p. 13); two rail guides of the given size (p. 19); the surface
 * finish as the nearest of RASAero's eight sand-roughness classes (Table 1, p. 52); the lift-off
 * weight and CG with the motor (pp. 99 to 100).
 *
 * RASAero II's rocket is a nose cone, one body tube with its fins and guides, and an optional
 * boat tail (fin cans and boosters exist but are not written here). A design that is not of that
 * form is refused with what is in the way; nothing is dropped silently. What the export rounds or
 * maps (the finish class, a rail button count other than two) is listed in its notices.
 */
import type { Component, FinCrossSection } from '@lo-fi-rocket/physics';
import { RASAERO_FINISHES } from './cdx1.js';
import type { DesignComponent, RocketDesign } from './design/model.js';
import { designMassProperties, designMotor } from './design/to-physics.js';
import { FormatError } from './errors.js';

/** A design the `.CDX1` format cannot hold, with what to change. */
export class Cdx1ExportError extends FormatError {
  constructor(problem: string) {
    super(`RASAero II export: ${problem}`);
    this.name = 'Cdx1ExportError';
  }
}

export interface Cdx1Export {
  readonly text: string;
  /** What was rounded or mapped on the way, in plain words. */
  readonly notices: readonly string[];
}

export interface Cdx1ExportOptions {
  /**
   * The motor's name as RASAero II's motor list writes it ("D12  (Estes)"). By default the
   * design's motor designation and manufacturer.
   */
  readonly motorName?: string;
  /** The nozzle exit diameter RASAero uses for the base and thrust at altitude, m; 0 by default. */
  readonly nozzleDiameter?: number;
}

const IN = 0.0254;
const FT = 0.3048;
const LB = 0.45359237;
const MPH = 0.44704;
const TOL = 1e-9;

/** A number as RASAero writes it: plain decimals, at most 10 significant digits. */
function num(x: number): string {
  if (!Number.isFinite(x)) throw new Cdx1ExportError(`a value is not finite (${String(x)})`);
  const s = Number(x.toPrecision(10)).toString();
  return s.includes('e') ? x.toFixed(10).replace(/\.?0+$/, '') : s;
}
const inches = (m: number): string => num(m / IN);

function xmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** RASAero's nose shapes (manual p. 10) from ours; the inverse of the importer's mapping. */
function noseShape(c: Extract<Component, { kind: 'noseCone' }>): string {
  const k = c.shapeParameter;
  const near = (a: number | undefined, b: number): boolean =>
    a !== undefined && Math.abs(a - b) < TOL;
  switch (c.shape) {
    case 'conical':
      return 'Conical';
    case 'ogive':
      if (k === undefined || near(k, 1)) return 'Tangent Ogive';
      break;
    case 'haack':
      if (k === undefined || near(k, 0)) return 'Von Karman Ogive';
      if (near(k, 1 / 3)) return 'LV-Haack';
      break;
    case 'parabolic':
      if (k === undefined || near(k, 1)) return 'Parabolic';
      break;
    case 'elliptical':
      return 'Elliptical';
    case 'power':
      // RASAero's power law takes its exponent in a field no file seen shows (cdx1.ts).
      break;
  }
  throw new Cdx1ExportError(
    `the nose cone's shape (${c.shape}${k === undefined ? '' : `, parameter ${String(k)}`}) is not one of RASAero II's (conical, tangent ogive, Von Kármán, LV-Haack, parabolic, elliptical): choose one of those to export`,
  );
}

/** RASAero's fin sections (manual p. 14, the names its files use) from ours. */
function finSection(section: FinCrossSection | undefined): string {
  switch (section) {
    case 'square':
    case undefined:
      return 'Square';
    case 'rounded':
      return 'Rounded';
    case 'airfoil':
      // Our airfoil section's wave drag is a biconvex's (D-062).
      return 'Biconvex';
    case 'wedge':
      return 'Single Wedge';
    case 'double-wedge':
      return 'Double Wedge';
  }
}

/**
 * The RASAero finish class nearest to a roughness height (Table 1, p. 52): zero roughness is its
 * smooth class; any other height the rough class nearest on a log scale.
 */
function nearestFinish(roughness: number): { name: string; inches: number } {
  const r = roughness / IN;
  if (r === 0) return { name: 'Smooth (Zero Roughness)', inches: 0 };
  let best = { name: 'Polished', inches: 0.00005, distance: Infinity };
  for (const [name, h] of Object.entries(RASAERO_FINISHES)) {
    if (h === 0) continue;
    const distance = Math.abs(Math.log(r / h));
    if (distance < best.distance) best = { name, inches: h, distance };
  }
  return { name: best.name, inches: best.inches };
}

const isOutline = (c: DesignComponent): boolean =>
  c.component.kind === 'noseCone' ||
  c.component.kind === 'bodyTube' ||
  c.component.kind === 'transition';

/** Write a one-stage design as a RASAero II file. */
export function exportCdx1(design: RocketDesign, options: Cdx1ExportOptions = {}): Cdx1Export {
  const notices: string[] = [];
  if ((design.stages?.length ?? 1) > 1) {
    throw new Cdx1ExportError(
      'only one-stage designs can be exported for now; remove the lower stages to export the top one',
    );
  }
  if (design.components.some((c) => c.pod !== undefined)) {
    throw new Cdx1ExportError('RASAero II has no pods; remove the pod sets to export');
  }
  const outline = design.components
    .filter(isOutline)
    .sort((a, b) => (a.position as number) - (b.position as number));
  const nose = outline[0];
  if (nose?.component.kind !== 'noseCone' || Math.abs(nose.position) > TOL) {
    throw new Cdx1ExportError('the rocket must start with a nose cone at the tip');
  }
  const radius: number = nose.component.baseRadius;
  // The body tube: every tube of the nose's diameter that follows it, end to end.
  let tubeEnd: number = (nose.position as number) + (nose.component.length as number);
  let i = 1;
  for (; i < outline.length; i++) {
    const c = outline[i];
    if (c?.component.kind !== 'bodyTube') break;
    if (Math.abs((c.component.outerRadius as number) - radius) > TOL) break;
    if (Math.abs((c.position as number) - tubeEnd) > TOL) break;
    tubeEnd += c.component.length as number;
  }
  const tubeStart = (nose.position as number) + (nose.component.length as number);
  if (!(tubeEnd > tubeStart + TOL)) {
    throw new Cdx1ExportError(
      'RASAero II needs a body tube of the nose cone’s diameter behind it; add one to export',
    );
  }
  let boatTail: DesignComponent | undefined;
  const next = outline[i];
  if (
    next?.component.kind === 'transition' &&
    Math.abs((next.component.foreRadius as number) - radius) < TOL &&
    (next.component.aftRadius as number) < radius &&
    i === outline.length - 1
  ) {
    boatTail = next;
    if (next.component.shape !== 'conical') {
      notices.push(
        `The boat tail is ${next.component.shape}; RASAero II's boat tail is conical, so it is written as a cone of the same length and diameters.`,
      );
    }
    i += 1;
  }
  const extra = outline[i];
  if (extra !== undefined) {
    throw new Cdx1ExportError(
      `RASAero II's rocket is a nose cone, one body tube of its diameter and an optional boat tail; “${extra.name}” at ${(extra.position as number).toFixed(3)} m does not fit that: merge or remove it to export`,
    );
  }

  // Fins: one trapezoidal set on the body tube, placed by its distance from the tube's aft end.
  const fins = design.components.filter((c) => c.component.kind === 'finSet');
  if (fins.length !== 1) {
    throw new Cdx1ExportError(
      `RASAero II's body tube carries one fin set; this design has ${String(fins.length)}`,
    );
  }
  const finPart = fins[0];
  if (finPart?.component.kind !== 'finSet') throw new Cdx1ExportError('no fin set');
  const fin = finPart.component;
  if (fin.shape !== undefined) {
    throw new Cdx1ExportError(
      'RASAero II takes trapezoidal fins only; this fin set is elliptical or freeform',
    );
  }
  const finLe = finPart.position as number;
  if (finLe < tubeStart - TOL || finLe > tubeEnd + TOL) {
    throw new Cdx1ExportError('the fins must sit on the body tube to export');
  }

  // Rail guides (RASAero always counts two) and a launch lug.
  const buttons = design.components.filter((c) => c.component.kind === 'railButton');
  const button = buttons[0]?.component.kind === 'railButton' ? buttons[0].component : undefined;
  if (buttons.length > 1) {
    notices.push(
      'Only the first rail button set is written: RASAero II takes one rail guide size.',
    );
  }
  if (button !== undefined && button.count !== 2) {
    notices.push(
      `The design has ${String(button.count)} rail buttons; RASAero II always computes the drag of two.`,
    );
  }
  const lug = design.components.find((c) => c.component.kind === 'launchLug')?.component;

  const finish = nearestFinish(design.finish.roughnessHeight);
  if (Math.abs(finish.inches * IN - (design.finish.roughnessHeight as number)) > 1e-12) {
    notices.push(
      `The finish (${String((design.finish.roughnessHeight as number) * 1e6)} µm) is written as RASAero II's nearest class, “${finish.name}” (${String(Math.round(finish.inches * IN * 1e7) / 10)} µm).`,
    );
  }
  if (design.components.some((c) => c.roughnessHeight !== undefined)) {
    notices.push(
      'RASAero II has one finish for the whole rocket; the parts’ own finishes are not written.',
    );
  }

  // Lift-off weight and CG with the motor (manual pp. 99 to 100).
  const motor = designMotor(design);
  if (motor === undefined) {
    throw new Cdx1ExportError(
      'RASAero II needs the motor to give the lift-off weight and CG: choose one to export',
    );
  }
  const liftoff = designMassProperties(design, 'liftoff');
  const def = motor.selection.definition;
  const motorName = options.motorName ?? `${def.designation}  (${def.manufacturer})`;
  // RASAero's motor ends at the rocket's aft end plus the overhang; it has no recessed motor.
  const rocketAft =
    boatTail?.component.kind === 'transition'
      ? (boatTail.position as number) + (boatTail.component.length as number)
      : tubeEnd;
  const overhang = (motor.aftEnd as number) - rocketAft;
  if (overhang < -TOL) {
    notices.push(
      `The motor is recessed ${(-overhang * 1000).toFixed(1)} mm inside the rocket; RASAero II puts its aft end at the rocket's aft end. The lift-off weight and CG written are the design's.`,
    );
  }

  // Recovery: up to two parachutes, at apogee or at an altitude on the way down.
  const chutes = design.recovery.filter((r) => r.kind !== 'streamer');
  if (chutes.length < design.recovery.length) {
    notices.push('Streamers are not written: RASAero II’s recovery devices are parachutes.');
  }
  if (chutes.length > 2) notices.push('Only the first two parachutes are written.');
  const recovery = [0, 1].map((k) => {
    const r = chutes[k];
    if (r === undefined) {
      return { on: false, type: 'None', event: 'None', size: 0, cd: 1.33, altitude: 1000 };
    }
    const altitude = r.deploy.event === 'altitude' ? (r.deploy.altitude as number) / FT : 1000;
    if (r.deploy.event !== 'apogee' && r.deploy.event !== 'altitude') {
      notices.push(
        `“${r.name}” deploys at ${r.deploy.event}; RASAero II deploys at apogee or at an altitude, so it is written at apogee.`,
      );
    }
    return {
      on: true,
      type: 'Parachute',
      event: r.deploy.event === 'altitude' ? 'Altitude' : 'Apogee',
      size: (r.diameter as number) / IN,
      cd: r.dragCoefficient,
      altitude,
    };
  });

  const site = design.launch.site;
  const wind = design.launch.wind;
  const temperatureF =
    site.temperature === undefined ? 59 : ((site.temperature as number) - 273.15) * 1.8 + 32;
  // A RASAero wind is a headwind when positive: from the direction the rail leans towards.
  const windMph = ((wind.speed as number) / MPH) * (Math.cos(wind.from) >= 0 ? 1 : -1);
  if (Math.abs(Math.sin(wind.from)) > 1e-9 && (wind.speed as number) > 0) {
    notices.push(
      'A crosswind is written as its head or tail component: RASAero II’s wind is along the launch direction.',
    );
  }
  const flag = (b: boolean): string => (b ? 'True' : 'False');
  const finLocation = tubeEnd - finLe;
  const x = `<RASAeroDocument>
  <FileVersion>2</FileVersion>
  <RocketDesign>
    <NoseCone>
      <PartType>NoseCone</PartType>
      <Length>${inches(nose.component.length)}</Length>
      <Diameter>${inches(2 * radius)}</Diameter>
      <Shape>${noseShape(nose.component)}</Shape>
      <BluntRadius>0</BluntRadius>
      <Location>0</Location>
      <Color>Black</Color>
    </NoseCone>
    <BodyTube>
      <PartType>BodyTube</PartType>
      <Length>${inches(tubeEnd - tubeStart)}</Length>
      <Diameter>${inches(2 * radius)}</Diameter>
      <LaunchLugDiameter>${lug?.kind === 'launchLug' ? inches(2 * (lug.outerRadius as number)) : '0'}</LaunchLugDiameter>
      <LaunchLugLength>${lug?.kind === 'launchLug' ? inches(lug.length) : '0'}</LaunchLugLength>
      <RailGuideDiameter>${button === undefined ? '0' : inches(button.outerDiameter)}</RailGuideDiameter>
      <RailGuideHeight>${button === undefined ? '0' : inches(button.totalHeight)}</RailGuideHeight>
      <LaunchShoeArea>0</LaunchShoeArea>
      <Location>${inches(tubeStart)}</Location>
      <Color>Black</Color>
      <BoattailLength>${boatTail?.component.kind === 'transition' ? inches(boatTail.component.length) : '0'}</BoattailLength>
      <BoattailRearDiameter>${boatTail?.component.kind === 'transition' ? inches(2 * (boatTail.component.aftRadius as number)) : '0'}</BoattailRearDiameter>
      <BoattailOffset>0</BoattailOffset>
      <Overhang>${inches(Math.max(0, overhang))}</Overhang>
      <Fin>
        <Count>${String(fin.count)}</Count>
        <Chord>${inches(fin.rootChord)}</Chord>
        <Span>${inches(fin.span)}</Span>
        <SweepDistance>${inches(fin.sweep)}</SweepDistance>
        <TipChord>${inches(fin.tipChord)}</TipChord>
        <Thickness>${inches(fin.thickness)}</Thickness>
        <LERadius>0</LERadius>
        <Location>${inches(finLocation)}</Location>
        <AirfoilSection>${finSection(fin.crossSection)}</AirfoilSection>
        <FX1>${
          // Our double wedge has its ridge at mid-chord (D-066): RASAero's leading-edge diamond
          // length, measured at half span (manual p. 15), is half the chord there.
          fin.crossSection === 'double-wedge'
            ? inches(((fin.rootChord as number) + (fin.tipChord as number)) / 4)
            : '0'
        }</FX1>
        <FX3>0</FX3>
      </Fin>
    </BodyTube>${
      boatTail?.component.kind === 'transition'
        ? `
    <BoatTail>
      <PartType>BoatTail</PartType>
      <Length>${inches(boatTail.component.length)}</Length>
      <Diameter>${inches(2 * radius)}</Diameter>
      <RearDiameter>${inches(2 * (boatTail.component.aftRadius as number))}</RearDiameter>
      <Location>${inches(boatTail.position)}</Location>
      <Color>Black</Color>
    </BoatTail>`
        : ''
    }
    <Surface>${finish.name}</Surface>
    <CP>0</CP>
    <ModifiedBarrowman>False</ModifiedBarrowman>
    <Turbulence>False</Turbulence>
    <SustainerNozzle>${inches(options.nozzleDiameter ?? 0)}</SustainerNozzle>
    <Booster1Nozzle>0</Booster1Nozzle>
    <Booster2Nozzle>0</Booster2Nozzle>
    <UseBooster1>False</UseBooster1>
    <UseBooster2>False</UseBooster2>
    <Comments>${xmlText(`Exported by lo-fi-rocket from "${design.name}".`)}</Comments>
  </RocketDesign>
  <LaunchSite>
    <Altitude>${num((site.altitude as number) / FT)}</Altitude>
    <Pressure>0</Pressure>
    <RodAngle>${num(((design.launch.rail.angleFromVertical as number) * 180) / Math.PI)}</RodAngle>
    <RodLength>${num((design.launch.rail.length as number) / FT)}</RodLength>
    <Temperature>${num(temperatureF)}</Temperature>
    <WindSpeed>${num(windMph)}</WindSpeed>
  </LaunchSite>
  <Recovery>
    <Altitude1>${num(recovery[0]?.altitude ?? 1000)}</Altitude1>
    <Altitude2>${num(recovery[1]?.altitude ?? 1000)}</Altitude2>
    <DeviceType1>${recovery[0]?.type ?? 'None'}</DeviceType1>
    <DeviceType2>${recovery[1]?.type ?? 'None'}</DeviceType2>
    <Event1>${flag(recovery[0]?.on ?? false)}</Event1>
    <Event2>${flag(recovery[1]?.on ?? false)}</Event2>
    <Size1>${num(recovery[0]?.size ?? 0)}</Size1>
    <Size2>${num(recovery[1]?.size ?? 0)}</Size2>
    <EventType1>${recovery[0]?.event ?? 'None'}</EventType1>
    <EventType2>${recovery[1]?.event ?? 'None'}</EventType2>
    <CD1>${num(recovery[0]?.cd ?? 1.33)}</CD1>
    <CD2>${num(recovery[1]?.cd ?? 1.33)}</CD2>
  </Recovery>
  <MachAlt />
  <SimulationList>
    <Simulation>
      <SustainerEngine>${xmlText(motorName)}</SustainerEngine>
      <SustainerLaunchWt>${num((liftoff.mass as number) / LB)}</SustainerLaunchWt>
      <SustainerNozzleDiameter>${inches(options.nozzleDiameter ?? 0)}</SustainerNozzleDiameter>
      <SustainerCG>${inches(liftoff.cg)}</SustainerCG>
      <SustainerIgnitionDelay>0</SustainerIgnitionDelay>
      <Booster1LaunchWt>0</Booster1LaunchWt>
      <Booster1SeparationDelay>0</Booster1SeparationDelay>
      <Booster1IgnitionDelay>0</Booster1IgnitionDelay>
      <Booster1CG>0</Booster1CG>
      <Booster1NozzleDiameter>0</Booster1NozzleDiameter>
      <IncludeBooster1>False</IncludeBooster1>
      <Booster2LaunchWt>0</Booster2LaunchWt>
      <Booster2Delay>0</Booster2Delay>
      <Booster2CG>0</Booster2CG>
      <Booster2NozzleDiameter>0</Booster2NozzleDiameter>
      <IncludeBooster2>False</IncludeBooster2>
      <FlightTime>0</FlightTime>
      <TimetoApogee>0</TimetoApogee>
      <MaxAltitude>0</MaxAltitude>
      <MaxVelocity>0</MaxVelocity>
      <OptimumWt>0</OptimumWt>
      <OptimumMaxAlt>0</OptimumMaxAlt>
    </Simulation>
  </SimulationList>
</RASAeroDocument>
`;
  // RASAero II writes its files with Windows line ends.
  return { text: x.replace(/\n/g, '\r\n'), notices };
}
