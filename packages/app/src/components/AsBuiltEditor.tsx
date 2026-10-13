/**
 * The rocket as built (plan 0060, D-089): the weighed mass and the balance point of the empty
 * rocket, motor out. Every part is scaled and moved to them (GEO-17), so the stability, the masses
 * and the flight are those of the real rocket.
 */
import { designMassProperties, type RocketDesign } from '@lo-fi-rocket/formats';
import { kilograms, metres, PhysicsError, type AsBuilt } from '@lo-fi-rocket/physics';
import { useId, type JSX } from 'react';
import { useStore } from '../state/store.js';
import { QuantityField } from './QuantityField.js';

/** The empty rocket's computed mass and CG from its parts alone, or undefined when it has none. */
function computed(design: RocketDesign): { mass: number; cg: number } | undefined {
  if (design.components.length === 0) return undefined;
  const parts: RocketDesign = { ...design };
  delete (parts as { asBuilt?: AsBuilt }).asBuilt;
  try {
    const m = designMassProperties(parts, 'no-motor');
    return m.mass > 0 ? { mass: m.mass, cg: m.cg } : undefined;
  } catch (error) {
    if (error instanceof PhysicsError) return undefined;
    throw error;
  }
}

/** The as-built settings with one figure set or cleared; none when both are clear. */
export function withAsBuiltFigure(
  current: AsBuilt | undefined,
  key: 'mass' | 'cg',
  value: number | undefined,
): AsBuilt | undefined {
  const mass = key === 'mass' ? value : current?.mass;
  const cg = key === 'cg' ? value : current?.cg;
  if (mass === undefined && cg === undefined) return undefined;
  return {
    ...(mass === undefined ? {} : { mass: kilograms(mass) }),
    ...(cg === undefined ? {} : { cg: metres(cg) }),
  };
}

export function AsBuiltEditor(): JSX.Element | null {
  const { state, dispatch } = useStore();
  const massId = useId();
  const cgId = useId();
  const design = state.design;
  const asBuilt = design.asBuilt;
  const parts = computed(design);
  if (parts === undefined && asBuilt === undefined) return null;
  const set = (key: 'mass' | 'cg', value: number | undefined): void => {
    dispatch({ type: 'set-as-built', asBuilt: withAsBuiltFigure(asBuilt, key, value) });
  };
  return (
    <details className="as-built" open={asBuilt !== undefined}>
      <summary>As built: the weighed mass and balance point</summary>
      <p className="muted small">
        Weigh the finished rocket without its motor and find where it balances. Every part is then
        scaled to that mass and moved to that balance point, so the stability and the flight are
        those of the rocket you built.
      </p>
      <div className="field field-check">
        <input
          id={massId}
          type="checkbox"
          checked={asBuilt?.mass !== undefined}
          disabled={parts === undefined && asBuilt?.mass === undefined}
          onChange={(e) => {
            set('mass', e.target.checked ? parts?.mass : undefined);
          }}
        />
        <label htmlFor={massId}>Use the weighed mass (motor out)</label>
      </div>
      {asBuilt?.mass === undefined ? null : (
        <QuantityField
          label="Weighed mass, motor out"
          kind="g"
          units={state.units}
          value={asBuilt.mass}
          rule="positive"
          onChange={(si) => {
            set('mass', si);
          }}
        />
      )}
      <div className="field field-check">
        <input
          id={cgId}
          type="checkbox"
          checked={asBuilt?.cg !== undefined}
          disabled={parts === undefined && asBuilt?.cg === undefined}
          onChange={(e) => {
            set('cg', e.target.checked ? parts?.cg : undefined);
          }}
        />
        <label htmlFor={cgId}>Use the balance point (motor out)</label>
      </div>
      {asBuilt?.cg === undefined ? null : (
        <QuantityField
          label="Balance point from the nose tip, motor out"
          kind="mm"
          units={state.units}
          value={asBuilt.cg}
          rule="non-negative"
          onChange={(si) => {
            set('cg', si);
          }}
        />
      )}
    </details>
  );
}
