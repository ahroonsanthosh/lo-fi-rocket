/**
 * An OpenRocket design read by the plan 0005 reader, as a RocketDesign
 * (plan 0015). Components keep the file's names; the motor mount is the
 * reader's tube; the motor itself is matched by designation and
 * manufacturer against a library the caller supplies (the file carries no
 * thrust curve); recovery devices keep their deployment settings.
 */
import { metres, type MotorDefinition, type Seconds } from '@lo-fi-rocket/physics';
import type { OrkMotorMount, OrkRocket } from '../ork.js';
import { newDesign } from './example.js';
import type {
  DesignComponent,
  DesignRecoveryDevice,
  MotorMount,
  MotorProvenance,
  RocketDesign,
} from './model.js';

export interface LibraryMotorRef {
  readonly definition: MotorDefinition;
  readonly provenance: MotorProvenance;
}

export interface OrkImport {
  readonly design: RocketDesign;
  /** What the user should know: an unmatched motor, for example. */
  readonly notices: readonly string[];
}

/** RASP manufacturer abbreviations seen in the bundled files against OpenRocket's full names. */
const MANUFACTURER_ALIASES: Record<string, string[]> = {
  estes: ['e', 'estes', 'estes industries'],
  aerotech: ['at', 'aerotech'],
};

function sameManufacturer(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x === y) return true;
  return Object.values(MANUFACTURER_ALIASES).some(
    (names) => names.includes(x) && names.includes(y),
  );
}

export function orkToDesign(
  rocket: OrkRocket,
  library: readonly LibraryMotorRef[],
  id: string,
  componentId: (index: number) => string = (i) => `ork-${String(i)}`,
): OrkImport {
  const notices: string[] = [...rocket.notices];
  // Plan 0064: a stage only in a staged file, so that a one-stage import is unchanged.
  const staged = rocket.stages.length > 1;
  const stageOf = (i: number): number => rocket.componentStage[i] ?? 0;
  const components: DesignComponent[] = rocket.components.map((c, i) => ({
    id: componentId(i),
    name: c.name,
    position: c.position,
    component: c.component,
    ...(c.massOverride === undefined ? {} : { massOverride: c.massOverride }),
    ...(c.approximations === undefined ? {} : { approximations: c.approximations }),
    ...(staged ? { stage: stageOf(i) } : {}),
    // Plan 0070: a pod set's part keeps its count and radial offset.
    ...(c.instances === undefined ? {} : { pod: c.instances }),
    // Plan 0073 (D-110): a part whose finish is not the design's keeps its own.
    ...(c.roughnessHeight === undefined ? {} : { roughnessHeight: c.roughnessHeight }),
  }));
  const base = newDesign(id, rocket.name);
  let design: RocketDesign = {
    ...base,
    components,
    finish: { roughnessHeight: rocket.roughnessHeight },
    referenceDiameter: metres(2 * rocket.maxBodyRadius),
    ...(rocket.approximations.length === 0 ? {} : { approximations: rocket.approximations }),
    ...(rocket.asBuilt === undefined ? {} : { asBuilt: rocket.asBuilt }),
    recovery: rocket.recoveryDevices.map((d, i): DesignRecoveryDevice => {
      const common = {
        id: `ork-recovery-${String(i)}`,
        name: d.name,
        deploy: {
          event: d.deployEvent,
          delay: d.deployDelay,
          ...(d.deployEvent === 'altitude' ? { altitude: d.deployAltitude } : {}),
        },
        ...(staged ? { stage: stageOf(d.component) } : {}),
      };
      // Plan 0073 part 2: a streamer keeps its strip, and its C_D only when the file gives one.
      return d.kind === 'streamer'
        ? {
            kind: 'streamer',
            ...common,
            length: d.length,
            width: d.width,
            surfaceDensity: d.surfaceDensity,
            ...(d.dragCoefficient === undefined ? {} : { dragCoefficient: d.dragCoefficient }),
          }
        : { ...common, diameter: d.diameter, dragCoefficient: d.dragCoefficient };
    }),
    ...(staged
      ? {
          stages: rocket.stages.map((st) => ({
            name: st.name,
            ...(st.separation === undefined ? {} : { separation: st.separation }),
          })),
        }
      : {}),
  };
  const mounts = rocket.motorMounts.map((mount) =>
    designMount(
      mount,
      components,
      library,
      notices,
      staged ? rocket.stages[mount.stage]?.name : undefined,
    ),
  );
  const [first, ...rest] = mounts;
  if (first !== undefined) {
    design = {
      ...design,
      motorMount: first,
      ...(rest.length === 0 ? {} : { additionalMotorMounts: rest }),
    };
  }
  // D-084: say once what the import approximated; each one is listed with the results.
  const approximated = [
    ...rocket.approximations,
    ...rocket.components.flatMap((c) => c.approximations ?? []),
  ];
  if (approximated.length > 0) {
    const major = approximated.filter((a) => a.impact === 'major').length;
    const n = approximated.length;
    notices.push(
      `${String(n)} part${n === 1 ? '' : 's'} or setting${n === 1 ? ' is' : 's are'} approximated${major === 0 ? '' : `, ${String(major)} in a way that can change the results a lot`}; each is listed with the flight results.`,
    );
  }
  return { design, notices };
}

/**
 * A motor mount of the file as the design's: its part, overhang, the library's motor of that name
 * (the file carries no thrust curve), the cluster and, plan 0064, the ignition when it is not
 * automatic at once. A notice says which motor was taken or that none matched.
 */
function designMount(
  mount: OrkMotorMount,
  components: readonly DesignComponent[],
  library: readonly LibraryMotorRef[],
  notices: string[],
  stageName: string | undefined,
): MotorMount {
  const holder = components[mount.mountComponent];
  if (holder === undefined)
    throw new Error(`motor mount component ${String(mount.mountComponent)} not found`);
  const holderLength: number =
    holder.component.kind === 'innerTube' || holder.component.kind === 'bodyTube'
      ? holder.component.length
      : 0;
  const overhang: number = mount.aftEnd - (holder.position + holderLength);
  const match = library.find(
    (m) =>
      m.definition.designation.toLowerCase() === mount.designation.toLowerCase() &&
      sameManufacturer(m.definition.manufacturer, mount.manufacturer),
  );
  const delay: Seconds | undefined = mount.delay;
  const delayText =
    delay === undefined ? 'plugged (no ejection charge)' : `delay ${String(delay)} s`;
  const motors = mount.cluster === undefined ? '' : `${String(mount.cluster.length)} × `;
  const where = stageName === undefined ? '' : `${stageName}: `;
  if (match === undefined) {
    notices.push(
      `${where}The file names the motor ${motors}${mount.manufacturer} ${mount.designation} (${String(Math.round(mount.diameter * 1000))} mm, ${delayText}) but carries no thrust curve and no motor of that name is in the library: choose it in the motor panel.`,
    );
  } else {
    notices.push(
      `${where}Motor ${motors}${match.definition.manufacturer} ${match.definition.designation} taken from the library, ${delay === undefined ? 'plugged as in the file (no ejection charge)' : `with the file's delay of ${String(delay)} s`}.`,
    );
  }
  const { event, delay: ignitionDelay } = mount.ignition;
  return {
    componentId: holder.id,
    overhang: metres(overhang),
    ...(match === undefined
      ? {}
      : {
          motor: {
            definition: match.definition,
            provenance: match.provenance,
            ...(delay === undefined ? {} : { ejectionDelay: delay }),
          },
        }),
    ...(mount.cluster === undefined ? {} : { cluster: mount.cluster }),
    ...(event === 'automatic' && (ignitionDelay as number) === 0
      ? {}
      : { ignition: { event, delay: ignitionDelay } }),
  };
}
