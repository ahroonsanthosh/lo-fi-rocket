/**
 * Plan 0073: a part's surface finish (the roughness of its skin friction, D-110) and a fin set's
 * fillets (GEO-19, D-113).
 */
import { OPENROCKET_FINISHES, type DesignComponent } from '@lo-fi-rocket/formats';
import {
  kilogramsPerCubicMetre,
  metres,
  type Component,
  type TrapezoidFinSetComponent,
} from '@lo-fi-rocket/physics';
import { useId, type JSX } from 'react';
import { useStore } from '../state/store.js';
import { QuantityField } from './QuantityField.js';

/** OpenRocket's nine finishes (D-110), roughest first, in plain words. */
const FINISH_LABELS: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'rough', label: 'Rough' },
  { key: 'roughunfinished', label: 'Rough, unfinished' },
  { key: 'unfinished', label: 'Unfinished' },
  { key: 'normal', label: 'Regular paint' },
  { key: 'smooth', label: 'Smooth paint' },
  { key: 'optimum', label: 'Optimum paint' },
  { key: 'polished', label: 'Aircraft sheet metal' },
  { key: 'finishpolished', label: 'Finished and polished' },
  { key: 'mirror', label: 'Mirror' },
];

const micrometres = (m: number): string => `${String(Math.round(m * 1e7) / 10)} µm`;

/** The parts whose skin friction has a finish. */
export function hasFinish(c: Component): boolean {
  return (
    c.kind === 'noseCone' || c.kind === 'bodyTube' || c.kind === 'transition' || c.kind === 'finSet'
  );
}

/** The part's finish, its own or the design's, with a button to give the whole rocket that finish. */
export function FinishField({ item }: { readonly item: DesignComponent }): JSX.Element {
  const { state, dispatch } = useStore();
  const id = useId();
  const design = state.design.finish.roughnessHeight;
  const value: number = item.roughnessHeight ?? design;
  const options = FINISH_LABELS.map((f) => ({
    value: OPENROCKET_FINISHES[f.key] ?? 60e-6,
    label: f.label,
  }));
  const known = options.some((o) => o.value === value);
  const own = item.roughnessHeight !== undefined;
  return (
    <div className="field">
      <label htmlFor={id}>Surface finish</label>
      <div className="field-input">
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            dispatch({
              type: 'set-component-finish',
              id: item.id,
              roughnessHeight: metres(Number(e.target.value)),
            });
          }}
        >
          {known ? null : <option value={String(value)}>Other ({micrometres(value)})</option>}
          {options.map((o) => (
            <option key={o.label} value={String(o.value)}>
              {o.label} ({micrometres(o.value)})
              {o.value === design ? ', the rest of the rocket' : ''}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">
        {own
          ? 'This part has its own finish. Its skin friction uses it; the rest of the rocket keeps its finish.'
          : 'The finish sets how rough the surface is for the skin friction, a third or more of the drag of most rockets.'}
      </p>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'set-finish', roughnessHeight: metres(value), everyPart: true });
        }}
      >
        Use this finish on every part
      </button>
    </div>
  );
}

/** OpenRocket's default fillet material, cardboard (FilletProbe's files: 680 kg/m³). */
const DEFAULT_FILLET_DENSITY = 680;

/** A fin set's fillets: radius (0 for none) and their material's density. */
export function FilletFields({
  fins,
  onChange,
}: {
  readonly fins: TrapezoidFinSetComponent;
  readonly onChange: (next: TrapezoidFinSetComponent) => void;
}): JSX.Element {
  const { state } = useStore();
  const units = state.units;
  const radius: number = fins.fillet?.radius ?? 0;
  return (
    <>
      <QuantityField
        label="Fillet radius (0 for none)"
        kind="mm"
        units={units}
        value={radius}
        rule="non-negative"
        hint="The glue or filler fillet along both sides of each fin root; its mass is counted, it adds no drag (as in OpenRocket)."
        onChange={(si) => {
          if (si > 0) {
            onChange({
              ...fins,
              fillet: {
                radius: metres(si),
                density: fins.fillet?.density ?? kilogramsPerCubicMetre(DEFAULT_FILLET_DENSITY),
              },
            });
            return;
          }
          const next: {
            -readonly [K in keyof TrapezoidFinSetComponent]: TrapezoidFinSetComponent[K];
          } = { ...fins };
          delete next.fillet;
          onChange(next);
        }}
      />
      {fins.fillet === undefined ? null : (
        <QuantityField
          label="Fillet material density"
          kind="density"
          units={units}
          value={fins.fillet.density}
          rule="positive"
          hint="680 kg/m³ is OpenRocket's default (cardboard); epoxy is about 1100 to 1200 kg/m³."
          onChange={(si) => {
            if (fins.fillet !== undefined) {
              onChange({
                ...fins,
                fillet: { ...fins.fillet, density: kilogramsPerCubicMetre(si) },
              });
            }
          }}
        />
      )}
    </>
  );
}
