/**
 * The application's state and the actions that change it (plan 0012,
 * D-043). The design is only ever replaced by a new object; every action
 * leaves a design that validates. New-component defaults are editing
 * conveniences derived from the current design, not physics.
 */
import type { AsBuilt, Component, DragCurve, Metres } from '@lo-fi-rocket/physics';
import {
  defaultComponent,
  defaultRecoveryDevice,
  type DesignComponent,
  type DispersionSettingsRecord,
  type DesignRecoveryDevice,
  type LaunchConditions,
  type MotorMount,
  type RecordedFlight,
  type RocketDesign,
  type SimulationSettings,
  type StabilityThresholds,
  type WarningThresholds,
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
