import { PhysicsError } from '@lo-fi-rocket/physics';
import {
  designMassProperties,
  designStability,
  DESIGN_MACH,
  type DesignStability,
} from '@lo-fi-rocket/formats';
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

export function StabilityPanel({ figures }: { readonly figures: Figures }): JSX.Element {
  const { state } = useStore();
  const units = state.units;
  const d = state.design;
  const s = figures.stability;
  if (figures.error !== undefined) {
    return (
      <section className="stability level-error" aria-live="polite" aria-label="Stability">
        <h2>Stability</h2>
        <p className="banner-main">Cannot compute</p>
        <p>{figures.error}</p>
      </section>
    );
  }
  if (s === undefined) {
    return (
      <section className="stability" aria-live="polite" aria-label="Stability">
        <h2>Stability</h2>
        <p className="muted">
          Add components to see the centre of gravity, the centre of pressure and the margin.
        </p>
      </section>
    );
  }
  const r = s.result;
  const cp = r.centreOfPressure;
  const level = s.liftoff.level;
  return (
    <section className={`stability level-${level}`} aria-live="polite" aria-label="Stability">
      <h2>Stability at Mach {String(DESIGN_MACH)}</h2>
      <p className="banner-main">
        <span className="big">{r.marginLiftoff.toFixed(2)}</span> calibers{' '}
        {s.noMotor ? '(no motor selected)' : 'at liftoff'}
        {s.noMotor ? null : <>, {r.marginBurnout.toFixed(2)} at burnout</>}
      </p>
      <p className="guidance">{s.liftoff.message}</p>
      {s.noMotor || s.burnout.level === s.liftoff.level ? null : (
        <p className="guidance">At burnout: {s.burnout.message}</p>
      )}
      <dl className="figures">
        <div>
          <dt>Centre of gravity</dt>
          <dd>
            {formatQuantity(r.cgLiftoff, 'mm', units)}
            {s.noMotor ? '' : ` (burnout ${formatQuantity(r.cgBurnout, 'mm', units)})`}
          </dd>
        </div>
        <div>
          <dt>Centre of pressure</dt>
          <dd>{formatQuantity(cp.cp, 'mm', units)}</dd>
        </div>
        <div>
          <dt>Reference diameter</dt>
          <dd>{formatQuantity(cp.referenceDiameter, 'mm', units)}</dd>
        </div>
        <div>
          <dt>Normal force derivative C_Nα</dt>
          <dd>{cp.cnAlpha.toFixed(2)} per radian</dd>
        </div>
      </dl>
      <p className="muted small">
        Barrowman method with Niskanen’s extensions, worst roll angle, roll-angle reduction applied
        (D-016). Thresholds {String(d.stabilityThresholds.unstableBelow)} and{' '}
        {String(d.stabilityThresholds.overstableAbove)} calibers are rules of thumb, not guarantees.
      </p>
    </section>
  );
}

export function MassPanel({ figures }: { readonly figures: Figures }): JSX.Element {
  const { state } = useStore();
  const units = state.units;
  return (
    <section className="mass" aria-label="Mass and size">
      <h2>Mass and size</h2>
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
    </section>
  );
}
