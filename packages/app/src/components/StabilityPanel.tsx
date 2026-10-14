import { PhysicsError } from '@lo-fi-rocket/physics';
import {
  designMassProperties,
  designStability,
  designStageStability,
  type DesignStability,
  type RocketDesign,
  type StageConfigurationStability,
} from '@lo-fi-rocket/formats';
import { FIGURE_DISPLAY, Panel, Term } from '@lo-fi-rocket/ui';
import type { JSX } from 'react';
import { useStore } from '../state/store.js';
import { formatQuantity } from '../units/display.js';

export interface Figures {
  readonly stability: DesignStability | undefined;
  /**
   * Plan 0064: for a staged design, the top stage alone as it burns out (the burnout that flies;
   * the whole stack's burnout figure never does) and its name.
   */
  readonly topStageBurnout?: {
    readonly name: string;
    readonly configuration: StageConfigurationStability;
  };
  readonly massLiftoff: number | undefined;
  readonly massEmpty: number | undefined;
  readonly length: number;
  readonly error: string | undefined;
}

/** Everything the panels and the side view need, or the physics error that prevents it. */
export function computeFigures(design: Parameters<typeof designStability>[0]): Figures {
  let length = 0;
  for (const c of design.components) {
    const comp = c.component;
    const l: number =
      comp.kind === 'finSet' ? comp.rootChord : comp.kind === 'railButton' ? 0 : comp.length;
    length = Math.max(length, c.position + l);
  }
  if (design.components.length === 0) {
    return {
      stability: undefined,
      massLiftoff: undefined,
      massEmpty: undefined,
      length,
      error: undefined,
    };
  }
  try {
    const stability = designStability(design);
    const massEmpty: number = designMassProperties(design, 'no-motor').mass;
    const massLiftoff: number = stability.noMotor
      ? massEmpty
      : designMassProperties(design, 'liftoff').mass;
    const stages = design.stages;
    const top =
      stages !== undefined && stages.length > 1
        ? designStageStability(design).find((c) => c.stage === 0)
        : undefined;
    return {
      stability,
      ...(top === undefined
        ? {}
        : { topStageBurnout: { name: stages?.[0]?.name ?? 'top stage', configuration: top } }),
      massLiftoff,
      massEmpty,
      length,
      error: undefined,
    };
  } catch (error) {
    if (error instanceof PhysicsError) {
      return {
        stability: undefined,
        massLiftoff: undefined,
        massEmpty: undefined,
        length,
        error: error.message,
      };
    }
    throw error;
  }
}

/**
 * The figures behind the stability margin, shown inside the stability
 * card of the checks column: CG, CP, the reference diameter, the normal
 * force derivative and the method (Barrowman 1967 with Niskanen's
 * extensions, D-016).
 */
export function StabilityDetails({ figures }: { readonly figures: Figures }): JSX.Element | null {
  const { state } = useStore();
  const units = state.units;
  const s = figures.stability;
  if (s === undefined) return null;
  const r = s.result;
  const cp = r.centreOfPressure;
  return (
    <>
      <dl className="figures">
        <div>
          <dt>
            <Term k="cg">Centre of gravity</Term>
          </dt>
          <dd>
            {formatQuantity(r.cgLiftoff, 'mm', units)}
            {s.noMotor ? '' : ` (burnout ${formatQuantity(r.cgBurnout, 'mm', units)})`}
          </dd>
        </div>
        <div>
          <dt>
            <Term k="cp">Centre of pressure</Term>
          </dt>
          <dd>{formatQuantity(cp.cp, 'mm', units)}</dd>
        </div>
        <div>
          <dt>
            <Term k="referenceDiameter">Reference diameter</Term>
          </dt>
          <dd>{formatQuantity(cp.referenceDiameter, 'mm', units)}</dd>
        </div>
        <div>
          <dt>
            <Term k="cnAlpha">Normal force derivative C_Nα</Term>
          </dt>
          <dd>{cp.cnAlpha.toFixed(FIGURE_DISPLAY.normalForceDerivative.decimals)} per radian</dd>
        </div>
      </dl>
      <p className="muted small">
        Barrowman method with Niskanen’s extensions, worst roll angle, roll-angle reduction applied
        (D-016).
      </p>
      <StageConfigurations design={state.design} />
    </>
  );
}

/**
 * Plan 0064: a staged rocket's figures above are the whole stack's; each configuration it flies in
 * has its own margin, as its bottom stage lights and as it burns out.
 */
function StageConfigurations({ design }: { readonly design: RocketDesign }): JSX.Element | null {
  const stages = design.stages;
  if (stages === undefined || stages.length < 2) return null;
  let list: ReturnType<typeof designStageStability>;
  try {
    list = designStageStability(design);
  } catch (error) {
    if (error instanceof PhysicsError) return null;
    throw error;
  }
  const d = FIGURE_DISPLAY.stabilityMargin.decimals;
  const name = (k: number): string => stages[k]?.name ?? `stage ${String(k + 1)}`;
  return (
    <div className="stage-configurations">
      <h3>Each stage configuration</h3>
      <ul>
        {list.map((c) => (
          <li key={String(c.stage)}>
            {c.stage === 0
              ? `${name(0)} alone`
              : `${name(0)} with ${Array.from({ length: c.stage }, (_, j) => name(j + 1)).join(', ')}`}
            :{' '}
            {c.noMotor
              ? `${c.marginLoaded.toFixed(d)} calibers (no motor)`
              : `${c.marginLoaded.toFixed(d)} calibers as ${name(c.stage)} lights, ${c.marginSpent.toFixed(d)} at its burnout`}{' '}
            (
            {c.loaded.level === 'typical' && c.spent.level === 'typical'
              ? 'typical'
              : [c.loaded.level, c.spent.level].includes('unstable')
                ? 'likely unstable'
                : 'may be overstable'}
            )
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MassPanel({ figures }: { readonly figures: Figures }): JSX.Element {
  const { state } = useStore();
  const units = state.units;
  return (
    <Panel title="Mass and size">
      <dl className="figures">
        <div>
          <dt>Length</dt>
          <dd>{formatQuantity(figures.length, 'mm', units)}</dd>
        </div>
        <div>
          <dt>Mass without motor</dt>
          <dd>
            {figures.massEmpty === undefined ? '—' : formatQuantity(figures.massEmpty, 'g', units)}
          </dd>
        </div>
        <div>
          <dt>Mass at liftoff</dt>
          <dd>
            {figures.massLiftoff === undefined || figures.stability?.noMotor === true
              ? 'no motor'
              : formatQuantity(figures.massLiftoff, 'g', units)}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
