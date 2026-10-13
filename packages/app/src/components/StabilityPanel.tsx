import { PhysicsError } from '@lo-fi-rocket/physics';
import { designMassProperties, designStability, type DesignStability } from '@lo-fi-rocket/formats';
import { FIGURE_DISPLAY, Panel, Term } from '@lo-fi-rocket/ui';
import type { JSX } from 'react';
import { useStore } from '../state/store.js';
import { formatQuantity } from '../units/display.js';

export interface Figures {
  readonly stability: DesignStability | undefined;
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
    return { stability, massLiftoff, massEmpty, length, error: undefined };
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
    </>
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
