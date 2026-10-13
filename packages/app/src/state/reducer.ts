/**
 * The application's state and the actions that change it (plan 0012,
 * D-043). The design is only ever replaced by a new object; every action
 * leaves a design that validates. New-component defaults are editing
 * conveniences derived from the current design, not physics.
 */
import {
  kilograms,
  kilogramsPerCubicMetre,
  metres,
  seconds,
  type AsBuilt,
  type Component,
  type DragCurve,
  type Metres,
} from '@lo-fi-rocket/physics';
import type {
  DesignComponent,
  DispersionSettingsRecord,
  DesignRecoveryDevice,
  LaunchConditions,
  MotorMount,
  RecordedFlight,
  RocketDesign,
  SimulationSettings,
  StabilityThresholds,
  WarningThresholds,
} from '@lo-fi-rocket/formats';
import type { UnitSystem } from '../units/display.js';

export type ComponentKind = Component['kind'];

export interface AppState {
  readonly design: RocketDesign;
  readonly selectedId: string | undefined;
  readonly units: UnitSystem;
  /** Bumped on every design change; the autosave watches it. */
  readonly revision: number;
}

export type Action =
  | { readonly type: 'replace-design'; readonly design: RocketDesign }
  | { readonly type: 'rename'; readonly name: string }
  | { readonly type: 'select'; readonly id: string | undefined }
  | { readonly type: 'set-units'; readonly units: UnitSystem }
  | { readonly type: 'add-component'; readonly kind: ComponentKind; readonly id: string }
  | {
      readonly type: 'update-component';
      readonly id: string;
      readonly name?: string;
      readonly position?: Metres;
      readonly component?: Component;
    }
  | { readonly type: 'remove-component'; readonly id: string }
  | { readonly type: 'move-component'; readonly id: string; readonly direction: -1 | 1 }
  | { readonly type: 'set-motor-mount'; readonly mount: MotorMount | undefined }
  | { readonly type: 'add-recovery'; readonly id: string }
  | {
      readonly type: 'update-recovery';
      readonly id: string;
      readonly device: DesignRecoveryDevice;
    }
  | { readonly type: 'remove-recovery'; readonly id: string }
  | { readonly type: 'set-finish'; readonly roughnessHeight: Metres }
  | { readonly type: 'set-reference-diameter'; readonly referenceDiameter: Metres | undefined }
  | { readonly type: 'set-as-built'; readonly asBuilt: AsBuilt | undefined }
  | { readonly type: 'set-stability-thresholds'; readonly thresholds: StabilityThresholds }
  | { readonly type: 'set-warning-thresholds'; readonly thresholds: WarningThresholds }
  | { readonly type: 'set-launch'; readonly launch: LaunchConditions }
  | { readonly type: 'set-drag-curve'; readonly dragCurve: DragCurve | undefined }
  | { readonly type: 'set-recorded-flight'; readonly recordedFlight: RecordedFlight | undefined }
  | { readonly type: 'set-dispersion'; readonly dispersion: DispersionSettingsRecord }
  | { readonly type: 'set-simulation'; readonly simulation: SimulationSettings };

export const COMPONENT_LABELS: Record<ComponentKind, string> = {
  noseCone: 'Nose cone',
  bodyTube: 'Body tube',
  transition: 'Transition',
  finSet: 'Fin set',
  innerTube: 'Inner tube',
  centeringRing: 'Centering ring',
  bulkhead: 'Bulkhead',
  massComponent: 'Mass component',
  parachute: 'Parachute (packed)',
  launchLug: 'Launch lug',
  railButton: 'Rail buttons',
};

/** External parts set the body outline; everything else sits inside or on it. */
export function isExternal(kind: ComponentKind): boolean {
  return kind === 'noseCone' || kind === 'bodyTube' || kind === 'transition';
}

function componentLength(c: Component): number {
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
    if (!isExternal(d.component.kind)) continue;
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

function withDesign(state: AppState, design: RocketDesign): AppState {
  return { ...state, design, revision: state.revision + 1 };
}

export function reduce(state: AppState, action: Action): AppState {
  const d = state.design;
  switch (action.type) {
    case 'replace-design':
      return {
        ...state,
        design: action.design,
        selectedId: undefined,
        revision: state.revision + 1,
      };
    case 'rename':
      return withDesign(state, { ...d, name: action.name });
    case 'select':
      return { ...state, selectedId: action.id };
    case 'set-units':
      return { ...state, units: action.units };
    case 'add-component': {
      const c: DesignComponent = { id: action.id, ...defaultComponent(action.kind, d) };
      return { ...withDesign(state, { ...d, components: [...d.components, c] }), selectedId: c.id };
    }
    case 'update-component':
      return withDesign(state, {
        ...d,
        components: d.components.map((c) =>
          c.id === action.id
            ? {
                ...c,
                ...(action.name === undefined ? {} : { name: action.name }),
                ...(action.position === undefined ? {} : { position: action.position }),
                ...(action.component === undefined ? {} : { component: action.component }),
              }
            : c,
        ),
      });
    case 'remove-component': {
      const components = d.components.filter((c) => c.id !== action.id);
      const mount = d.motorMount?.componentId === action.id ? undefined : d.motorMount;
      const next: RocketDesign = { ...d, components };
      if (mount === undefined) delete (next as { motorMount?: MotorMount }).motorMount;
      return {
        ...withDesign(state, next),
        selectedId: state.selectedId === action.id ? undefined : state.selectedId,
      };
    }
    case 'move-component': {
      const i = d.components.findIndex((c) => c.id === action.id);
      const j = i + action.direction;
      if (i < 0 || j < 0 || j >= d.components.length) return state;
      const components = [...d.components];
      const a = components[i];
      const b = components[j];
      if (a === undefined || b === undefined) return state;
      components[i] = b;
      components[j] = a;
      return withDesign(state, { ...d, components });
    }
    case 'set-motor-mount': {
      const next: RocketDesign = { ...d };
      if (action.mount === undefined) delete (next as { motorMount?: MotorMount }).motorMount;
      else (next as { motorMount?: MotorMount }).motorMount = action.mount;
      return withDesign(state, next);
    }
    case 'add-recovery': {
      const device = defaultRecoveryDevice(action.id, d);
      return {
        ...withDesign(state, { ...d, recovery: [...d.recovery, device] }),
        selectedId: device.id,
      };
    }
    case 'update-recovery':
      return withDesign(state, {
        ...d,
        recovery: d.recovery.map((r) => (r.id === action.id ? action.device : r)),
      });
    case 'remove-recovery':
      return {
        ...withDesign(state, { ...d, recovery: d.recovery.filter((r) => r.id !== action.id) }),
        selectedId: state.selectedId === action.id ? undefined : state.selectedId,
      };
    case 'set-finish':
      return withDesign(state, { ...d, finish: { roughnessHeight: action.roughnessHeight } });
    case 'set-as-built': {
      // D-089: the weighed mass and balance point, or none.
      const next: RocketDesign = { ...d };
      if (action.asBuilt === undefined) delete (next as { asBuilt?: AsBuilt }).asBuilt;
      else (next as { asBuilt?: AsBuilt }).asBuilt = action.asBuilt;
      return withDesign(state, next);
    }
    case 'set-reference-diameter': {
      const next: RocketDesign = { ...d };
      if (action.referenceDiameter === undefined) {
        delete (next as { referenceDiameter?: Metres }).referenceDiameter;
      } else (next as { referenceDiameter?: Metres }).referenceDiameter = action.referenceDiameter;
      return withDesign(state, next);
    }
    case 'set-stability-thresholds':
      return withDesign(state, { ...d, stabilityThresholds: action.thresholds });
    case 'set-warning-thresholds':
      return withDesign(state, { ...d, warningThresholds: action.thresholds });
    case 'set-launch':
      return withDesign(state, { ...d, launch: action.launch });
    case 'set-drag-curve': {
      const next: RocketDesign = { ...d };
      if (action.dragCurve === undefined) delete (next as { dragCurve?: DragCurve }).dragCurve;
      else (next as { dragCurve?: DragCurve }).dragCurve = action.dragCurve;
      return withDesign(state, next);
    }
    case 'set-dispersion':
      return withDesign(state, { ...d, dispersion: action.dispersion });
    case 'set-recorded-flight': {
      const next: RocketDesign = { ...d };
      if (action.recordedFlight === undefined)
        delete (next as { recordedFlight?: RecordedFlight }).recordedFlight;
      else (next as { recordedFlight?: RecordedFlight }).recordedFlight = action.recordedFlight;
      return withDesign(state, next);
    }
    case 'set-simulation':
      return withDesign(state, { ...d, simulation: action.simulation });
  }
}

export function initialState(design: RocketDesign, units: UnitSystem = 'metric'): AppState {
  return { design, selectedId: undefined, units, revision: 0 };
}
