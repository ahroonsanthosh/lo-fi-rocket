/**
 * What the tools return (plan 0062): the engine's own figures, in SI with the unit in each key,
 * rounded to six significant figures for reading (the engine keeps full precision), together with
 * the warnings, the approximations and the confidence the app shows, and the review checklist.
 */
import {
  componentLength,
  designFlightWarnings,
  designMassProperties,
  designIgnitions,
  designMotor,
  designMotors,
  designMotorFitProblems,
  designSimulationOptions,
  designStability,
  designThrustToWeight,
  designVehicle,
  isExternal,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import {
  clusterApproximations,
  componentApproximations,
  confidenceOf,
  simulateFlight,
  streamerDragCoefficient,
  type Approximation,
  type FlightResult,
} from '@lo-fi-rocket/physics';
import { PART_FIELDS } from './fields.js';
import { LAUNCH_SETTINGS, type LaunchSetting } from './session.js';

/** Six significant figures, for reading; undefined stays undefined. */
export function r(x: number): number;
export function r(x: number | undefined): number | undefined;
export function r(x: number | undefined): number | undefined {
  return x === undefined ? undefined : Number(x.toPrecision(6));
}

const DEG = 180 / Math.PI;

/** Every approximation of the design known before a flight (the flight adds its own). */
export function designApproximations(design: RocketDesign): Approximation[] {
  return [
    ...(design.approximations ?? []),
    ...componentApproximations(
      design.components.map((c) => ({
        name: c.name,
        component: c.component,
        ...(c.approximations === undefined ? {} : { approximations: c.approximations }),
      })),
    ),
    ...clusterApproximations(design.motorMount?.cluster),
  ];
}

function approximationList(list: readonly Approximation[]): Record<string, unknown> {
  const order = { major: 0, moderate: 1, minor: 2 } as const;
  return {
    confidence: confidenceOf(list),
    approximations: [...list].sort((a, b) => order[a.impact] - order[b.impact]),
  };
}

/** The parts with ids, positions and the fields left at defaults. */
export function partList(design: RocketDesign): Record<string, unknown>[] {
  return design.components.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.component.kind,
    position_m: r(c.position),
    length_m: r(componentLength(c.component)),
    ...(c.stage === undefined ? {} : { stage: c.stage }),
    fields: c.component,
    ...(c.massOverride === undefined ? {} : { massOverride: c.massOverride }),
    not_given: (c.approximations ?? [])
      .filter((a) => a.what.endsWith(' not given'))
      .map((a) => a.what.replace(/ not given$/, '')),
  }));
}

/** A compact view of the design: parts, motor, recovery, launch and the settings not given. */
export function designSummary(
  design: RocketDesign,
  launchGiven: ReadonlySet<LaunchSetting>,
): Record<string, unknown> {
  const m = designMotor(design);
  const l = design.launch;
  return {
    id: design.id,
    name: design.name,
    parts: partList(design),
    motor:
      m === undefined
        ? 'none: set_motor before simulating'
        : {
            mount_part_id: design.motorMount?.componentId,
            designation: `${m.selection.definition.manufacturer} ${m.selection.definition.designation}`,
            overhang_m: design.motorMount?.overhang,
            ejection_delay_s: m.selection.ejectionDelay ?? 'plugged',
            ...(design.motorMount?.cluster === undefined
              ? {}
              : { cluster_offsets_m: design.motorMount.cluster }),
          },
    // Plan 0064: the stages, and every motor with its stage and ignition, for a staged design.
    ...(design.stages === undefined ? {} : { stages: design.stages }),
    ...(design.stages === undefined && design.additionalMotorMounts === undefined
      ? {}
      : {
          motors: designMotors(design).map((dm, i) => ({
            mount_part_id: dm.mount.componentId,
            stage: dm.stage,
            designation: `${dm.selection.definition.manufacturer} ${dm.selection.definition.designation}`,
            ejection_delay_s: dm.selection.ejectionDelay ?? 'plugged',
            ignition_given: dm.mount.ignition ?? 'automatic',
            ignition_resolved: designIgnitions(design)[i]?.ignition,
          })),
        }),
    recovery: design.recovery.map((d) => ({
      name: d.name,
      // Plan 0073: a streamer's strip, and its C_D when the user gave one (else eq. C.6's).
      ...(d.kind === 'streamer'
        ? {
            kind: 'streamer',
            length_m: d.length,
            width_m: d.width,
            surface_density_kg_m2: d.surfaceDensity,
            drag_coefficient:
              d.dragCoefficient ?? `${String(r(streamerDragCoefficient(d)))} (Niskanen eq. C.6)`,
          }
        : { diameter_m: d.diameter, drag_coefficient: d.dragCoefficient }),
      deploy: d.deploy,
      ...(d.stage === undefined ? {} : { stage: d.stage }),
    })),
    launch: {
      site_altitude_m: l.site.altitude,
      ...(l.site.temperature === undefined
        ? {}
        : { temperature_K: l.site.temperature, pressure_Pa: l.site.pressure }),
      rail_length_m: l.rail.length,
      rail_angle_deg: r(l.rail.angleFromVertical * DEG),
      rail_azimuth_deg: r(l.rail.azimuth * DEG),
      wind_speed_m_s: l.wind.speed,
      wind_from_deg: r(l.wind.from * DEG),
      ...(l.wind.profile === undefined ? {} : { wind_profile: l.wind.profile }),
      ...(l.wind.turbulence === undefined ? {} : { turbulence: l.wind.turbulence }),
      settings_not_given: LAUNCH_SETTINGS.filter((k) => !launchGiven.has(k)),
    },
    ...(design.asBuilt === undefined ? {} : { as_built: design.asBuilt }),
  };
}

/** CP, CG and margins at liftoff and burnout at the design Mach number. */
export function stabilityReport(design: RocketDesign): Record<string, unknown> {
  if (!design.components.some((c) => isExternal(c.component.kind))) {
    return { message: 'no outline yet: add a nose cone and body tube first' };
  }
  const s = designStability(design);
  const cp = s.result.centreOfPressure;
  const liftoff = designMassProperties(design, s.noMotor ? 'no-motor' : 'liftoff');
  const burnout = designMassProperties(design, s.noMotor ? 'no-motor' : 'burnout');
  return {
    mach: cp.mach,
    cp_from_nose_m: r(cp.cp),
    cn_alpha_per_rad: r(cp.cnAlpha),
    reference_diameter_m: r(cp.referenceDiameter),
    liftoff: {
      mass_kg: r(liftoff.mass),
      cg_from_nose_m: r(s.result.cgLiftoff),
      margin_calibers: r(s.result.marginLiftoff),
      assessment: s.liftoff.message,
    },
    burnout: {
      mass_kg: r(burnout.mass),
      cg_from_nose_m: r(s.result.cgBurnout),
      margin_calibers: r(s.result.marginBurnout),
      assessment: s.burnout.message,
    },
    ...(s.noMotor ? { note: 'no motor yet: the CG is the empty rocket’s' } : {}),
    ...(cp.warnings.length === 0 ? {} : { model_notes: cp.warnings }),
    ...approximationList(designApproximations(design)),
  };
}

export interface SimulateOptions {
  /** Return the time series, thinned to at most this many samples (at most 200). */
  readonly samples?: number;
}

/** A flight of the design with the app's settings, its summary, events, warnings and confidence. */
export function simulateReport(
  design: RocketDesign,
  launchGiven: ReadonlySet<LaunchSetting>,
  options: SimulateOptions = {},
): Record<string, unknown> {
  const result: FlightResult = simulateFlight(
    designVehicle(design),
    designSimulationOptions(design),
  );
  const s = result.summary;
  const n = Math.min(200, Math.max(0, Math.floor(options.samples ?? 0)));
  const series =
    n === 0
      ? undefined
      : result.samples
          .filter(
            (_, i, all) =>
              all.length <= n || i % Math.ceil(all.length / n) === 0 || i === all.length - 1,
          )
          .map((p) => ({
            t_s: r(p.time),
            phase: p.phase,
            altitude_m: r(p.altitude),
            airspeed_m_s: r(p.airspeed),
            mach: r(p.mach),
            acceleration_m_s2: r(p.acceleration),
            angle_of_attack_deg: r(p.angleOfAttack * DEG),
            thrust_N: r(p.thrust),
            mass_kg: r(p.mass),
            stability_calibers: Number.isFinite(p.stabilityCalibers)
              ? r(p.stabilityCalibers)
              : null,
          }));
  return {
    summary: {
      apogee_m: r(s.apogee),
      time_to_apogee_s: r(s.timeToApogee),
      max_velocity_m_s: r(s.maxVelocity),
      max_mach: r(s.maxMach),
      max_acceleration_m_s2: r(s.maxAcceleration),
      rail_exit_velocity_m_s: r(s.railExitVelocity),
      burnout_time_s: r(s.burnoutTime),
      thrust_to_weight: r(designThrustToWeight(design)),
      deployment_velocity_m_s: r(s.deploymentVelocity),
      descent_rate_m_s: r(s.descentRate),
      ground_hit_velocity_m_s: r(s.groundHitVelocity),
      landing_distance_m: r(s.landingDistance),
      landing_direction_deg:
        s.landingDirection === undefined ? undefined : r(s.landingDirection * DEG),
      flight_time_s: r(s.flightTime),
      end_reason: s.endReason,
      min_stability_calibers: {
        powered: r(s.minimumStability.powered?.calibers),
        coast: r(s.minimumStability.coast?.calibers),
      },
      regimes: s.regimes,
    },
    events: result.events.map((e) => ({ kind: e.kind, t_s: r(e.time), detail: e.detail })),
    warnings: designFlightWarnings(design, result).map((w) => w.message),
    launch_settings_not_given: LAUNCH_SETTINGS.filter((k) => !launchGiven.has(k)),
    approximations: [...result.approximations],
    confidence: result.confidence,
    model: {
      integrator: result.modes.integrator,
      degrees_of_freedom: result.modes.degreesOfFreedom,
      drag_curve: result.modes.dragCurve ?? 'computed',
    },
    ...(series === undefined ? {} : { time_series: series }),
  };
}

type Severity = 'must' | 'should' | 'info';
interface ReviewItem {
  readonly severity: Severity;
  readonly item: string;
}

/** The checklist to clear before trusting a simulation (plan 0062 section 4). */
export function reviewReport(
  design: RocketDesign,
  launchGiven: ReadonlySet<LaunchSetting>,
): Record<string, unknown> {
  const items: ReviewItem[] = [];
  const add = (severity: Severity, item: string): void => {
    items.push({ severity, item });
  };
  const kinds = new Set(design.components.map((c) => c.component.kind));
  if (!kinds.has('noseCone')) add('must', 'There is no nose cone.');
  if (!kinds.has('bodyTube')) add('must', 'There is no body tube.');
  if (!kinds.has('finSet'))
    add(
      'must',
      'There are no fins: unless the rocket is meant to fly without fins, add the fin set.',
    );
  const m = designMotor(design);
  if (designMotors(design).length === 0) add('must', 'No motor is selected: set_motor.');
  for (const p of designMotorFitProblems(design)) add('must', p);
  // Plan 0064: a motor whose ignition event can never come.
  for (const { problem } of designIgnitions(design))
    if (problem !== undefined) add('must', problem);
  for (const c of design.components) {
    const missing = (c.approximations ?? []).filter((a) => a.what.endsWith(' not given'));
    if (missing.length > 0) {
      add(
        missing.some((a) => a.impact !== 'minor') ? 'must' : 'should',
        `${c.name}: ${missing.map((a) => a.what.replace(/ not given$/, '')).join(', ')} not given (editing defaults in use). Ask the user, then update_part.`,
      );
    }
    const comp = c.component;
    if (comp.kind === 'finSet' || comp.kind === 'railButton') {
      const tube = design.components.find(
        (b) =>
          b.component.kind === 'bodyTube' &&
          c.position >= b.position - 1e-9 &&
          c.position <= b.position + b.component.length + 1e-9,
      );
      if (
        tube?.component.kind === 'bodyTube' &&
        Math.abs(tube.component.outerRadius - comp.bodyRadius) > 1e-6
      ) {
        add(
          'must',
          `${c.name}: its body radius (${String(r(comp.bodyRadius))} m) is not the radius of the body tube it sits on (${String(r(tube.component.outerRadius))} m). Update bodyRadius.`,
        );
      }
    }
    if (comp.kind === 'finSet' && comp.shearModulus === undefined) {
      add(
        'info',
        `${c.name}: no shear modulus, so fin flutter is not checked. Give it if the fins may flutter (fast flights, thin fins).`,
      );
    }
    if (comp.kind === 'noseCone' && comp.aftShoulder === undefined) {
      add(
        'info',
        `${c.name}: no shoulder is modelled. If the nose cone has one, give aftShoulder (its mass moves the CG).`,
      );
    }
  }
  for (const a of design.approximations ?? []) {
    if (a.what.endsWith(' not given'))
      add(a.impact === 'minor' ? 'should' : 'must', `${a.subject}: ${a.what}. ${a.method}.`);
  }
  if (design.recovery.length === 0)
    add('should', 'No recovery device: the flight will show a ballistic descent.');
  if (
    m !== undefined &&
    m.selection.ejectionDelay === undefined &&
    design.recovery.some((d) => d.deploy.event === 'ejection')
  ) {
    add(
      'must',
      'A recovery device opens at the ejection charge but the motor is plugged: give the ejection delay.',
    );
  }
  const notGiven = LAUNCH_SETTINGS.filter((k) => !launchGiven.has(k));
  if (notGiven.length > 0) {
    add(
      'should',
      `Launch settings not given (new-design values in use): ${notGiven.join(', ')}. The rail length sets the rail exit speed; the wind sets the landing point.`,
    );
  }
  if (design.asBuilt === undefined) {
    add(
      'info',
      'No weighed mass or balance point. If the rocket is built, ask for both (motor out) and set_as_built: they correct the computed mass and CG.',
    );
  } else {
    add(
      'info',
      'The weighed mass and/or balance point are in use; every part is scaled and moved to match them (GEO-17).',
    );
  }
  if (design.components.some((c) => isExternal(c.component.kind))) {
    try {
      const s = designStability(design);
      if (s.liftoff.level !== 'typical')
        add(s.liftoff.level === 'unstable' ? 'must' : 'info', `At liftoff: ${s.liftoff.message}`);
      if (s.burnout.level !== 'typical')
        add(s.burnout.level === 'unstable' ? 'must' : 'info', `At burnout: ${s.burnout.message}`);
    } catch (error) {
      add(
        'must',
        `The stability cannot be computed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const order = { must: 0, should: 1, info: 2 } as const;
  return {
    ready: !items.some((i) => i.severity === 'must'),
    items: items.sort((a, b) => order[a.severity] - order[b.severity]),
    ...approximationList(designApproximations(design)),
    fields_reference: 'about lists every field with its meaning and units',
  };
}

/** Field reference for the about tool. */
export function fieldReference(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [kind, fields] of Object.entries(PART_FIELDS)) {
    out[kind] = Object.fromEntries(
      Object.entries(fields).map(([k, f]) => [k, `${f.description} [${f.type}]`]),
    );
  }
  return out;
}
