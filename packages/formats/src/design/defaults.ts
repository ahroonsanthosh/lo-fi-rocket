/**
 * Editing defaults for a new part or recovery device, sized from the current outline (plan 0012,
 * D-043; moved here from the app by plan 0062 so the MCP server shares them). They are editing
 * conveniences, not physics: the MCP server records every default it uses as an approximation.
 */
import {
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  seconds,
  type Component,
} from '@lo-fi-rocket/physics';
import type { DesignComponent, DesignRecoveryDevice, RocketDesign } from './model.js';

export type ComponentKind = Component['kind'];

/** External parts set the body outline; everything else sits inside or on it. */
export function isExternal(kind: ComponentKind): boolean {
  return kind === 'noseCone' || kind === 'bodyTube' || kind === 'transition';
}

/** Length of a part along the axis, for placing parts relative to it (a fin set: its root chord). */
export function componentLength(c: Component): number {
  switch (c.kind) {
    case 'finSet':
      return c.rootChord;
    case 'railButton':
      return 0;
    case 'noseCone':
    case 'transition':
    case 'bodyTube':
    case 'innerTube':
    case 'launchLug':
    case 'centeringRing':
    case 'bulkhead':
    case 'massComponent':
    case 'parachute':
      return c.length;
  }
}

/** The aft end of the outline, and the radius there. */
function tail(components: readonly DesignComponent[]): { x: number; radius: number } {
  let x = 0;
  let radius = 0.025;
  for (const d of components) {
    // Plan 0070: a pod set's parts are not the main body's outline.
    if (!isExternal(d.component.kind) || d.pod !== undefined) continue;
    const end: number = d.position + componentLength(d.component);
    if (end >= x) {
      x = end;
      const c = d.component;
      if (c.kind === 'noseCone') radius = c.baseRadius;
      else if (c.kind === 'transition') radius = c.aftRadius;
      else if (c.kind === 'bodyTube') radius = c.outerRadius;
    }
  }
  return { x, radius };
}

/** Editing defaults for a new component, sized from the current outline. */
export function defaultComponent(
  kind: ComponentKind,
  design: RocketDesign,
): Omit<DesignComponent, 'id'> {
  const t = tail(design.components);
  const r = t.radius;
  const m = metres;
  const paper = kilogramsPerCubicMetre(700);
  switch (kind) {
    case 'noseCone':
      return {
        name: 'Nose cone',
        position: m(0),
        component: {
          kind,
          shape: 'ogive',
          shapeParameter: 1,
          length: m(3 * r),
          baseRadius: m(r),
          wallThickness: m(0.002),
          density: kilogramsPerCubicMetre(1050),
        },
      };
    case 'bodyTube':
      return {
        name: 'Body tube',
        position: m(t.x),
        component: {
          kind,
          length: m(10 * r),
          outerRadius: m(r),
          wallThickness: m(0.001),
          density: paper,
        },
      };
    case 'transition':
      return {
        name: 'Transition',
        position: m(t.x),
        component: {
          kind,
          shape: 'conical',
          length: m(2 * r),
          foreRadius: m(r),
          aftRadius: m(0.8 * r),
          wallThickness: m(0.002),
          density: kilogramsPerCubicMetre(1050),
        },
      };
    case 'finSet':
      return {
        name: 'Fin set',
        position: m(Math.max(0, t.x - 4 * r)),
        component: {
          kind,
          count: 3,
          rootChord: m(4 * r),
          tipChord: m(2 * r),
          sweep: m(2 * r),
          span: m(3 * r),
          thickness: m(0.003),
          density: kilogramsPerCubicMetre(600),
          bodyRadius: m(r),
          crossSection: 'square',
        },
      };
    case 'innerTube':
      return {
        name: 'Motor mount tube',
        position: m(Math.max(0, t.x - 0.075)),
        component: {
          kind,
          length: m(0.075),
          outerRadius: m(0.0125),
          wallThickness: m(0.0005),
          density: paper,
        },
      };
    case 'centeringRing':
      return {
        name: 'Centering ring',
        position: m(Math.max(0, t.x - 0.01)),
        component: {
          kind,
          length: m(0.005),
          outerRadius: m(Math.max(0.001, r - 0.001)),
          innerRadius: m(0.0125),
          density: paper,
        },
      };
    case 'bulkhead':
      return {
        name: 'Bulkhead',
        position: m(t.x / 2),
        component: {
          kind,
          length: m(0.005),
          outerRadius: m(Math.max(0.001, r - 0.001)),
          innerRadius: m(0),
          density: kilogramsPerCubicMetre(600),
        },
      };
    case 'massComponent':
      return {
        name: 'Mass component',
        position: m(t.x / 4),
        component: {
          kind,
          mass: kilograms(0.02),
          length: m(0.02),
          radius: m(Math.max(0.001, r - 0.005)),
        },
      };
    case 'parachute':
      return {
        name: 'Parachute (packed)',
        position: m(t.x / 3),
        component: {
          kind,
          mass: kilograms(0.01),
          length: m(0.05),
          radius: m(Math.max(0.001, r - 0.005)),
        },
      };
    case 'launchLug':
      return {
        name: 'Launch lug',
        position: m(t.x / 2),
        component: {
          kind,
          length: m(0.05),
          outerRadius: m(0.003),
          wallThickness: m(0.0005),
          density: paper,
          radialOffset: m(r + 0.003),
        },
      };
    case 'railButton':
      return {
        name: 'Rail buttons',
        position: m(t.x / 2),
        component: {
          kind,
          count: 2,
          separation: m(t.x / 3),
          outerDiameter: m(0.01),
          innerDiameter: m(0.006),
          totalHeight: m(0.01),
          baseHeight: m(0.002),
          flangeHeight: m(0.002),
          density: kilogramsPerCubicMetre(1050),
          bodyRadius: m(r),
        },
      };
  }
}

export function defaultRecoveryDevice(id: string, design: RocketDesign): DesignRecoveryDevice {
  return {
    id,
    name:
      design.recovery.length === 0
        ? 'Parachute'
        : `Parachute ${String(design.recovery.length + 1)}`,
    diameter: metres(0.3),
    // Niskanen p. 67: a round parachute's C_D is about 0.8 (DYN-14).
    dragCoefficient: 0.8,
    deploy: { event: 'apogee', delay: seconds(0) },
  };
}

/**
 * Remove a part and every motor mount on it, `motorMount` and the additional mounts of plan 0064
 * alike, so that an edit never leaves a mount on a missing part.
 */
export function withoutComponent(design: RocketDesign, id: string): RocketDesign {
  const { motorMount, additionalMotorMounts, ...rest } = design;
  const additional = additionalMotorMounts?.filter((m) => m.componentId !== id);
  return {
    ...rest,
    components: design.components.filter((c) => c.id !== id),
    ...(motorMount === undefined || motorMount.componentId === id ? {} : { motorMount }),
    ...(additional === undefined || additional.length === 0
      ? {}
      : { additionalMotorMounts: additional }),
  };
}
