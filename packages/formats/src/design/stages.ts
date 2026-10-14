/**
 * Editing a staged design (plan 0064 part 3b): the stage-wise operations the app uses, each one
 * returning a design that validates. A one-stage design keeps no stage fields at all, so that its
 * file is the same as before staging existed (D-097).
 */
import { seconds } from '@lo-fi-rocket/physics';
import type {
  DesignComponent,
  DesignRecoveryDevice,
  DesignStage,
  MotorMount,
  RocketDesign,
} from './model.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** A part or device with no stage field (stage 0). */
function withoutStage<T extends DesignComponent | DesignRecoveryDevice>(x: T): T {
  const copy: Mutable<T> = { ...x };
  delete copy.stage;
  return copy;
}

/** The stage of the part `componentId` (0 when the part names none). */
function partStage(design: RocketDesign, componentId: string): number {
  return design.components.find((c) => c.id === componentId)?.stage ?? 0;
}

/** Every motor mount in order: `motorMount`, then the additional ones. */
function mounts(design: RocketDesign): MotorMount[] {
  return [
    ...(design.motorMount === undefined ? [] : [design.motorMount]),
    ...(design.additionalMotorMounts ?? []),
  ];
}

/** The design with these mounts: the first as `motorMount`, the rest as additional ones. */
function withMounts(design: RocketDesign, list: readonly MotorMount[]): RocketDesign {
  const next: Mutable<RocketDesign> = { ...design };
  delete next.motorMount;
  delete next.additionalMotorMounts;
  const [first, ...rest] = list;
  if (first !== undefined) next.motorMount = first;
  if (rest.length > 0) next.additionalMotorMounts = rest;
  return next;
}

/** The motor mount of a stage: the first mount whose part is in it. */
export function stageMotorMount(design: RocketDesign, stage: number): MotorMount | undefined {
  return mounts(design).find((m) => partStage(design, m.componentId) === stage);
}

/**
 * Replace the motor mount of a stage, or remove it with undefined; the other stages' mounts are
 * kept, in order. A further mount of the same stage (an air start) is kept too.
 */
export function withStageMotorMount(
  design: RocketDesign,
  stage: number,
  mount: MotorMount | undefined,
): RocketDesign {
  const list = mounts(design);
  const at = list.findIndex((m) => partStage(design, m.componentId) === stage);
  if (at < 0) return withMounts(design, mount === undefined ? list : [...list, mount]);
  return withMounts(
    design,
    list.flatMap((m, i) => (i === at ? (mount === undefined ? [] : [mount]) : [m])),
  );
}

/** Move a part to a stage; stage 0 leaves the field out. */
export function withComponentStage(design: RocketDesign, id: string, stage: number): RocketDesign {
  return {
    ...design,
    components: design.components.map((c) => {
      if (c.id !== id) return c;
      return stage === 0 ? withoutStage(c) : { ...c, stage };
    }),
  };
}

/** The design with these stages, top first; one stage or none makes it a one-stage design. */
export function withStages(design: RocketDesign, stages: readonly DesignStage[]): RocketDesign {
  const next: Mutable<RocketDesign> = { ...design };
  if (stages.length > 1) {
    next.stages = stages;
    return next;
  }
  // A one-stage design keeps no stage fields (every part and device is then on stage 0).
  delete next.stages;
  next.components = design.components.map(withoutStage);
  next.recovery = design.recovery.map(withoutStage);
  return next;
}

/**
 * Add a stage below the bottom one, separating at the ignition of the stage above (the usual
 * setting, shown and editable). A one-stage design becomes a sustainer and a booster.
 */
export function withStageAdded(design: RocketDesign): RocketDesign {
  const current: readonly DesignStage[] = design.stages ?? [{ name: 'Sustainer' }];
  const name = current.length === 1 ? 'Booster' : `Booster ${String(current.length)}`;
  return withStages(design, [
    ...current,
    { name, separation: { event: 'upper-ignition', delay: seconds(0) } },
  ]);
}

/** Why the bottom stage cannot be removed, or undefined when it can: it must hold nothing. */
export function stageRemovalProblem(design: RocketDesign): string | undefined {
  const stages = design.stages;
  if (stages === undefined || stages.length < 2) return 'the rocket has one stage';
  const bottom = stages.length - 1;
  const name = stages[bottom]?.name ?? `stage ${String(bottom + 1)}`;
  const parts = design.components.filter((c) => (c.stage ?? 0) === bottom).length;
  const devices = design.recovery.filter((d) => (d.stage ?? 0) === bottom).length;
  if (parts + devices === 0) return undefined;
  return `${name} still holds ${String(parts)} part${parts === 1 ? '' : 's'}${devices === 0 ? '' : ` and ${String(devices)} recovery device${devices === 1 ? '' : 's'}`}: remove them or move them to another stage first.`;
}

/** Remove the bottom stage, which must hold nothing (stageRemovalProblem). */
export function withBottomStageRemoved(design: RocketDesign): RocketDesign {
  const problem = stageRemovalProblem(design);
  if (problem !== undefined) throw new Error(`the bottom stage cannot be removed: ${problem}`);
  return withStages(design, (design.stages ?? []).slice(0, -1));
}
