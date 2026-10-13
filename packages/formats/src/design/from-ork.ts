/**
 * An OpenRocket design read by the plan 0005 reader, as a RocketDesign
 * (plan 0015). Components keep the file's names; the motor mount is the
 * reader's tube; the motor itself is matched by designation and
 * manufacturer against a library the caller supplies (the file carries no
 * thrust curve); recovery devices keep their deployment settings.
 */
import { metres, type MotorDefinition, type Seconds } from '@lo-fi-rocket/physics';
import type { OrkRocket } from '../ork.js';
import { newDesign } from './example.js';
import type { DesignComponent, MotorProvenance, RocketDesign } from './model.js';

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
  const components: DesignComponent[] = rocket.components.map((c, i) => ({
    id: componentId(i),
    name: c.name,
    position: c.position,
    component: c.component,
    ...(c.massOverride === undefined ? {} : { massOverride: c.massOverride }),
    ...(c.approximations === undefined ? {} : { approximations: c.approximations }),
  }));
  const base = newDesign(id, rocket.name);
  let design: RocketDesign = {
    ...base,
    components,
    referenceDiameter: metres(2 * rocket.maxBodyRadius),
    ...(rocket.approximations.length === 0 ? {} : { approximations: rocket.approximations }),
    recovery: rocket.recoveryDevices.map((d, i) => ({
      id: `ork-recovery-${String(i)}`,
      name: d.name,
      diameter: d.diameter,
      dragCoefficient: d.dragCoefficient,
      deploy: {
        event: d.deployEvent,
        delay: d.deployDelay,
        ...(d.deployEvent === 'altitude' ? { altitude: d.deployAltitude } : {}),
      },
    })),
  };
  const mount = rocket.motorMount;
  if (mount !== undefined) {
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
    design = {
      ...design,
      motorMount: {
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
      },
    };
    if (match === undefined) {
      notices.push(
        `The file names the motor ${mount.manufacturer} ${mount.designation} (${String(Math.round(mount.diameter * 1000))} mm, ${delayText}) but carries no thrust curve and no motor of that name is in the library: choose it in the motor panel.`,
      );
    } else {
      notices.push(
        `Motor ${match.definition.manufacturer} ${match.definition.designation} taken from the library, ${delay === undefined ? 'plugged as in the file (no ejection charge)' : `with the file's delay of ${String(delay)} s`}.`,
      );
    }
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
