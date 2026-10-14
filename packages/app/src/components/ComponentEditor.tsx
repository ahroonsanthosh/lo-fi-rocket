import type {
  Component,
  FinCrossSection,
  NoseShape,
  TrapezoidFinSetComponent,
} from '@lo-fi-rocket/physics';
import { metres, pascals, TN4197_MATERIALS, trapezoidOf, type Metres } from '@lo-fi-rocket/physics';
import type { DesignComponent } from '@lo-fi-rocket/formats';
import { useId, type JSX } from 'react';
import { COMPONENT_LABELS } from '../state/reducer.js';
import { useStore } from '../state/store.js';
import { IntegerField, QuantityField, type FieldRule } from './QuantityField.js';
import { FilletFields, FinishField, hasFinish } from './SurfaceFields.js';
import { StageSelect } from './StagesEditor.js';
import { formatQuantity, type QuantityKind } from '../units/display.js';

/** The fin set without a shear modulus (flutter not checked). */
function withoutShearModulus(c: TrapezoidFinSetComponent): TrapezoidFinSetComponent {
  const copy: { -readonly [K in keyof TrapezoidFinSetComponent]: TrapezoidFinSetComponent[K] } = {
    ...c,
  };
  delete copy.shearModulus;
  return copy;
}

/**
 * Plan 0059, D-087: a fin set made elliptical keeps its root chord and span; one made trapezoidal
 * from another shape becomes its equivalent trapezoid (same span, root chord, area and CP).
 */
export function withPlanform(
  c: TrapezoidFinSetComponent,
  kind: 'trapezoidal' | 'elliptical',
): TrapezoidFinSetComponent {
  if (kind === 'elliptical') {
    return { ...c, tipChord: metres(0), sweep: metres(0), shape: { kind: 'elliptical' } };
  }
  return trapezoidOf(c);
}

/** The editable sizes: a shaped fin's tip chord and sweep describe nothing; a freeform outline sets its root and span. */
export function fieldsOf(c: Component): readonly NumField[] {
  if (c.kind !== 'finSet' || c.shape === undefined) return FIELDS[c.kind];
  const hidden =
    c.shape.kind === 'freeform'
      ? ['rootChord', 'tipChord', 'sweep', 'span']
      : ['tipChord', 'sweep'];
  return FIELDS.finSet.filter((f) => !hidden.includes(f.key));
}

const NOSE_SHAPES: readonly { value: NoseShape; label: string }[] = [
  { value: 'conical', label: 'Conical' },
  { value: 'ogive', label: 'Ogive (tangent at parameter 1)' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'parabolic', label: 'Parabolic series' },
  { value: 'power', label: 'Power series' },
  { value: 'haack', label: 'Haack series (Von Kármán at parameter 0)' },
];

/** Shapes whose parameter means something (Niskanen Appendix A): ogive 0 to 1, parabolic 0 to 1, power 0 to 1, Haack 0 to 1/3. */
const PARAMETER_RANGE: Partial<Record<NoseShape, { min: number; max: number; hint: string }>> = {
  ogive: { min: 0, max: 1, hint: '0 to 1; 1 is the tangent ogive' },
  parabolic: { min: 0, max: 1, hint: '0 (cone) to 1 (full parabola)' },
  power: { min: 0, max: 1, hint: '0 to 1; 0.5 is the ½-power series' },
  haack: { min: 0, max: 1 / 3, hint: '0 is Von Kármán (LD-Haack), 1/3 is LV-Haack' },
};

interface NumField {
  readonly key: string;
  readonly label: string;
  readonly kind: QuantityKind;
  readonly rule: FieldRule;
  readonly hint?: string;
}

const FIELDS: Record<Component['kind'], readonly NumField[]> = {
  noseCone: [
    { key: 'length', label: 'Length', kind: 'mm', rule: 'positive' },
    { key: 'baseRadius', label: 'Base radius', kind: 'mm', rule: 'positive' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  transition: [
    { key: 'length', label: 'Length', kind: 'mm', rule: 'positive' },
    { key: 'foreRadius', label: 'Fore radius', kind: 'mm', rule: 'positive' },
    // Plan 0068: 0 is a tail cone ending in a point.
    { key: 'aftRadius', label: 'Aft radius', kind: 'mm', rule: 'non-negative' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  bodyTube: [
    { key: 'length', label: 'Length', kind: 'mm', rule: 'positive' },
    { key: 'outerRadius', label: 'Outer radius', kind: 'mm', rule: 'positive' },
    { key: 'wallThickness', label: 'Wall thickness', kind: 'mm', rule: 'positive' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  innerTube: [
    { key: 'length', label: 'Length', kind: 'mm', rule: 'positive' },
    { key: 'outerRadius', label: 'Outer radius', kind: 'mm', rule: 'positive' },
    { key: 'wallThickness', label: 'Wall thickness', kind: 'mm', rule: 'positive' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  launchLug: [
    { key: 'length', label: 'Length', kind: 'mm', rule: 'positive' },
    { key: 'outerRadius', label: 'Outer radius', kind: 'mm', rule: 'positive' },
    { key: 'wallThickness', label: 'Wall thickness', kind: 'mm', rule: 'positive' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
    {
      key: 'radialOffset',
      label: 'Distance from the rocket axis',
      kind: 'mm',
      rule: 'non-negative',
      hint: 'to the lug’s own axis: body radius plus lug radius for a lug glued to the body',
    },
  ],
  centeringRing: [
    { key: 'length', label: 'Thickness (length)', kind: 'mm', rule: 'positive' },
    { key: 'outerRadius', label: 'Outer radius', kind: 'mm', rule: 'positive' },
    { key: 'innerRadius', label: 'Inner radius', kind: 'mm', rule: 'non-negative' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  bulkhead: [
    { key: 'length', label: 'Thickness (length)', kind: 'mm', rule: 'positive' },
    { key: 'outerRadius', label: 'Outer radius', kind: 'mm', rule: 'positive' },
    { key: 'innerRadius', label: 'Inner radius', kind: 'mm', rule: 'non-negative' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  massComponent: [
    { key: 'mass', label: 'Mass', kind: 'g', rule: 'non-negative' },
    { key: 'length', label: 'Length', kind: 'mm', rule: 'positive' },
    { key: 'radius', label: 'Radius', kind: 'mm', rule: 'positive' },
  ],
  parachute: [
    { key: 'mass', label: 'Packed mass', kind: 'g', rule: 'non-negative' },
    { key: 'length', label: 'Packed length', kind: 'mm', rule: 'positive' },
    { key: 'radius', label: 'Packed radius', kind: 'mm', rule: 'positive' },
  ],
  finSet: [
    { key: 'rootChord', label: 'Fin root chord', kind: 'mm', rule: 'positive' },
    { key: 'tipChord', label: 'Fin tip chord', kind: 'mm', rule: 'non-negative' },
    {
      key: 'sweep',
      label: 'Sweep length',
      kind: 'mm',
      rule: 'any',
      hint: 'root leading edge to tip leading edge, positive aft',
    },
    { key: 'span', label: 'Span (root to tip)', kind: 'mm', rule: 'positive' },
    { key: 'thickness', label: 'Thickness', kind: 'mm', rule: 'positive' },
    { key: 'bodyRadius', label: 'Body radius at the root', kind: 'mm', rule: 'positive' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
  railButton: [
    { key: 'outerDiameter', label: 'Outer diameter', kind: 'mm', rule: 'positive' },
    { key: 'innerDiameter', label: 'Inner (shaft) diameter', kind: 'mm', rule: 'positive' },
    { key: 'totalHeight', label: 'Total height', kind: 'mm', rule: 'positive' },
    { key: 'baseHeight', label: 'Base height', kind: 'mm', rule: 'positive' },
    { key: 'flangeHeight', label: 'Flange height', kind: 'mm', rule: 'positive' },
    { key: 'separation', label: 'Separation between buttons', kind: 'mm', rule: 'non-negative' },
    { key: 'bodyRadius', label: 'Body radius', kind: 'mm', rule: 'positive' },
    { key: 'density', label: 'Material density', kind: 'density', rule: 'positive' },
  ],
};

function numberOf(c: Component, key: string): number {
  const v = (c as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : 0;
}

function withField(c: Component, key: string, value: number): Component {
  return { ...c, [key]: value };
}

export function ComponentEditor({ item }: { readonly item: DesignComponent }): JSX.Element {
  const { state, dispatch } = useStore();
  const units = state.units;
  const c = item.component;
  const nameId = useId();
  const shapeId = useId();
  const sectionId = useId();
  const planformId = useId();
  const materialId = useId();
  const hollowId = useId();
  const update = (component: Component): void => {
    dispatch({ type: 'update-component', id: item.id, component });
  };

  const shaped = c.kind === 'noseCone' || c.kind === 'transition' ? c : undefined;
  const range = shaped === undefined ? undefined : PARAMETER_RANGE[shaped.shape];

  return (
    <section className="editor" aria-label={`${COMPONENT_LABELS[c.kind]} editor`}>
      <h2>{COMPONENT_LABELS[c.kind]}</h2>
      <div className="field">
        <label htmlFor={nameId}>Name</label>
        <div className="field-input">
          <input
            id={nameId}
            type="text"
            value={item.name}
            onChange={(e) => {
              dispatch({ type: 'update-component', id: item.id, name: e.target.value });
            }}
          />
        </div>
      </div>
      <QuantityField
        label="Position of the forward end from the nose tip"
        kind="mm"
        units={units}
        value={item.position}
        rule="non-negative"
        onChange={(si) => {
          dispatch({ type: 'update-component', id: item.id, position: metres(si) });
        }}
      />
      <StageSelect
        label="Stage"
        value={item.stage ?? 0}
        onChange={(stage) => {
          dispatch({ type: 'set-component-stage', id: item.id, stage });
        }}
      />
      {item.pod === undefined ? null : (
        <p className="muted small">
          Part of a pod set: repeated {item.pod.count} time{item.pod.count === 1 ? '' : 's'} around
          the rocket, each pod&rsquo;s axis {formatQuantity(item.pod.radialOffset, 'mm', units)}{' '}
          from the rocket&rsquo;s. Its mass, lift and drag count once per pod.
        </p>
      )}
      {shaped === undefined ? null : (
        <>
          <div className="field">
            <label htmlFor={shapeId}>Shape</label>
            <div className="field-input">
              <select
                id={shapeId}
                value={shaped.shape}
                onChange={(e) => {
                  const shape = e.target.value as NoseShape;
                  const r = PARAMETER_RANGE[shape];
                  const next = { ...shaped, shape } as Component;
                  update(
                    r === undefined
                      ? (() => {
                          const copy = { ...next } as Record<string, unknown>;
                          delete copy['shapeParameter'];
                          return copy as unknown as Component;
                        })()
                      : ({
                          ...next,
                          shapeParameter: shape === 'power' ? 0.5 : shape === 'haack' ? 0 : 1,
                        } as Component),
                  );
                }}
              >
                {NOSE_SHAPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {range === undefined ? null : (
            <QuantityField
              label="Shape parameter"
              kind="ratio"
              units={units}
              value={shaped.shapeParameter ?? 0}
              rule="non-negative"
              hint={range.hint}
              onChange={(v) => {
                update({ ...shaped, shapeParameter: v });
              }}
            />
          )}
          <div className="field field-check">
            <input
              id={hollowId}
              type="checkbox"
              checked={shaped.wallThickness !== undefined}
              onChange={(e) => {
                if (e.target.checked) update({ ...shaped, wallThickness: metres(0.002) });
                else {
                  const copy = { ...shaped } as Record<string, unknown>;
                  delete copy['wallThickness'];
                  update(copy as unknown as Component);
                }
              }}
            />
            <label htmlFor={hollowId}>Hollow shell (otherwise solid)</label>
          </div>
          {shaped.wallThickness === undefined ? null : (
            <QuantityField
              label="Wall thickness"
              kind="mm"
              units={units}
              value={shaped.wallThickness}
              rule="positive"
              onChange={(si) => {
                update({ ...shaped, wallThickness: metres(si) });
              }}
            />
          )}
        </>
      )}
      {c.kind === 'finSet' || c.kind === 'railButton' ? (
        <IntegerField
          label={c.kind === 'finSet' ? 'Number of fins' : 'Number of buttons'}
          value={c.count}
          min={1}
          onChange={(n) => {
            update({ ...c, count: n });
          }}
        />
      ) : null}
      {c.kind === 'finSet' ? (
        <div className="field">
          <label htmlFor={planformId}>Fin shape</label>
          <div className="field-input">
            <select
              id={planformId}
              value={c.shape?.kind ?? 'trapezoidal'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'trapezoidal' || v === 'elliptical') update(withPlanform(c, v));
              }}
            >
              <option value="trapezoidal">Trapezoidal</option>
              <option value="elliptical">Elliptical</option>
              {c.shape?.kind === 'freeform' ? (
                <option value="freeform">Freeform outline (from the imported file)</option>
              ) : null}
            </select>
          </div>
        </div>
      ) : null}
      {c.kind === 'finSet' && c.shape?.kind === 'freeform' ? (
        <p className="muted small">
          An outline of {c.shape.points.length} points: root chord{' '}
          {formatQuantity(c.rootChord, 'mm', units)}, span {formatQuantity(c.span, 'mm', units)}.
          Choose Trapezoidal to edit the sizes: the fins become the trapezoid with the same span,
          root chord, area and centre of pressure.
        </p>
      ) : null}
      {fieldsOf(c).map((f) => (
        <QuantityField
          key={f.key}
          label={f.label}
          kind={f.kind}
          units={units}
          value={numberOf(c, f.key)}
          rule={f.rule}
          {...(f.hint === undefined ? {} : { hint: f.hint })}
          onChange={(si) => {
            update(withField(c, f.key, si));
          }}
        />
      ))}
      {c.kind === 'finSet' ? (
        <div className="field">
          <label htmlFor={sectionId}>Cross section (drag; supersonic fin force)</label>
          <div className="field-input">
            <select
              id={sectionId}
              value={c.crossSection ?? 'square'}
              onChange={(e) => {
                update({ ...c, crossSection: e.target.value as FinCrossSection });
              }}
            >
              <option value="square">Square (rectangular)</option>
              <option value="rounded">Rounded edges</option>
              <option value="airfoil">Airfoil (sharp edges)</option>
              <option value="wedge">Wedge (sharp leading edge, square trailing edge)</option>
              <option value="double-wedge">Double wedge (sharp edges, ridge at mid-chord)</option>
            </select>
          </div>
        </div>
      ) : null}
      {c.kind === 'finSet' ? (
        <div className="field">
          <label htmlFor={materialId}>Fin material for the flutter check (NACA TN 4197)</label>
          <div className="field-input">
            <select
              id={materialId}
              value={
                c.shearModulus === undefined
                  ? 'none'
                  : (TN4197_MATERIALS.find((mat) => mat.shearModulus === c.shearModulus)?.name ??
                    'custom')
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'none') {
                  update(withoutShearModulus(c));
                } else if (v === 'custom') {
                  update({ ...c, shearModulus: c.shearModulus ?? pascals(1e9) });
                } else {
                  const mat = TN4197_MATERIALS.find((x) => x.name === v);
                  if (mat !== undefined) update({ ...c, shearModulus: pascals(mat.shearModulus) });
                }
              }}
            >
              <option value="none">Not set (flutter not checked)</option>
              {TN4197_MATERIALS.map((mat) => (
                <option key={mat.name} value={mat.name}>
                  {mat.name}
                </option>
              ))}
              <option value="custom">Other: enter the shear modulus</option>
            </select>
          </div>
        </div>
      ) : null}
      {c.kind === 'finSet' && c.shearModulus !== undefined ? (
        <QuantityField
          label="Fin shear modulus G"
          kind="modulus"
          units={units}
          value={c.shearModulus}
          rule="positive"
          hint="Effective shear modulus of the fin (TN 4197 eq. 12): the material's G for a solid fin. Composite and balsa values come from the supplier's data."
          onChange={(si) => {
            update({ ...c, shearModulus: pascals(si) });
          }}
        />
      ) : null}
      {c.kind === 'finSet' ? <FilletFields fins={c} onChange={update} /> : null}
      {c.kind === 'noseCone' ? <ShoulderEditor nose={c} onChange={update} units={units} /> : null}
      {hasFinish(c) ? <FinishField item={item} /> : null}
      <div className="editor-actions">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'move-component', id: item.id, direction: -1 });
          }}
        >
          Move up
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'move-component', id: item.id, direction: 1 });
          }}
        >
          Move down
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            dispatch({ type: 'remove-component', id: item.id });
          }}
        >
          Remove
        </button>
      </div>
    </section>
  );
}

function ShoulderEditor({
  nose,
  onChange,
  units,
}: {
  readonly nose: Extract<Component, { kind: 'noseCone' }>;
  readonly onChange: (c: Component) => void;
  readonly units: 'metric' | 'imperial';
}): JSX.Element {
  const id = useId();
  const s = nose.aftShoulder;
  return (
    <>
      <div className="field field-check">
        <input
          id={id}
          type="checkbox"
          checked={s !== undefined}
          onChange={(e) => {
            if (e.target.checked) {
              const r: number = nose.baseRadius;
              onChange({
                ...nose,
                aftShoulder: {
                  length: metres(r),
                  radius: metres(Math.max(0.001, r - 0.0015)),
                  wallThickness: metres(0.002),
                },
              });
            } else {
              const copy = { ...nose } as Record<string, unknown>;
              delete copy['aftShoulder'];
              onChange(copy as unknown as Component);
            }
          }}
        />
        <label htmlFor={id}>Aft shoulder</label>
      </div>
      {s === undefined ? null : (
        <>
          <QuantityField
            label="Shoulder length"
            kind="mm"
            units={units}
            value={s.length}
            rule="positive"
            onChange={(si) => {
              onChange({ ...nose, aftShoulder: { ...s, length: metres(si) } });
            }}
          />
          <QuantityField
            label="Shoulder radius"
            kind="mm"
            units={units}
            value={s.radius}
            rule="positive"
            onChange={(si) => {
              onChange({ ...nose, aftShoulder: { ...s, radius: metres(si) } });
            }}
          />
          <QuantityField
            label="Shoulder wall thickness"
            kind="mm"
            units={units}
            value={s.wallThickness}
            rule="positive"
            onChange={(si) => {
              onChange({ ...nose, aftShoulder: { ...s, wallThickness: si as Metres } });
            }}
          />
        </>
      )}
    </>
  );
}
