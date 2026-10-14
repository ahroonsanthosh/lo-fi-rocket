/**
 * "Your rocket": the home of the task panel (docs/ui/simplify.md section
 * 3). One list of everything the design is made of, in the order a new
 * user builds it; tapping a row opens its page. The flight is the last
 * row, drawn as the one primary action.
 */
import { designMotorCount, newId, type RocketDesign } from '@lo-fi-rocket/formats';
import { Button, FIGURE_DISPLAY, Icon, StatusIcon, type Severity } from '@lo-fi-rocket/ui';
import { useId, useState, type JSX, type KeyboardEvent, type ReactNode } from 'react';
import type { Figures } from '../components/StabilityPanel.js';
import { COMPONENT_LABELS, type ComponentKind } from '../state/reducer.js';
import { useStore } from '../state/store.js';
import { formatQuantity, type UnitSystem } from '../units/display.js';
import { STABILITY_TARGET } from './pages.js';
import { LEVEL_STATUS } from './stability.js';
import { FLIGHT_TARGET, LAUNCH_TARGET, MOTOR_TARGET } from './steps.js';

/** Parts that are seen from outside; every other part is inside the airframe. */
const OUTSIDE: ReadonlySet<ComponentKind> = new Set([
  'noseCone',
  'bodyTube',
  'transition',
  'finSet',
  'launchLug',
  'railButton',
]);

const ADD_ORDER: readonly ComponentKind[] = [
  'noseCone',
  'bodyTube',
  'transition',
  'finSet',
  'innerTube',
  'centeringRing',
  'bulkhead',
  'massComponent',
  'parachute',
  'launchLug',
  'railButton',
];

/** The parts a rocket cannot fly without, offered in this order while missing. */
const CORE: readonly { kind: ComponentKind; label: string }[] = [
  { kind: 'bodyTube', label: 'Add a body tube' },
  { kind: 'noseCone', label: 'Add a nose cone' },
  { kind: 'finSet', label: 'Add fins' },
];

export interface Row {
  readonly id: string;
  readonly title: string;
  readonly detail?: ReactNode;
  /** Shown as an icon and words before the detail when the row needs attention. */
  readonly status?: { readonly severity: Severity; readonly label: string };
}

/**
 * A list of rows that open a page. It keeps the listbox semantics the
 * app had: Up and Down move between rows, Enter or Space opens one.
 */
export function RowList({
  label,
  rows,
  onOpen,
  className,
}: {
  readonly label: string;
  readonly rows: readonly Row[];
  readonly onOpen: (id: string) => void;
  readonly className?: string;
}): JSX.Element {
  const base = useId();
  const [active, setActive] = useState(0);
  const onKey = (e: KeyboardEvent<HTMLUListElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) =>
        e.key === 'ArrowDown' ? Math.min(rows.length - 1, a + 1) : Math.max(0, a - 1),
      );
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const row = rows[active];
      if (row !== undefined) onOpen(row.id);
    }
  };
  return (
    <ul
      role="listbox"
      aria-label={label}
      tabIndex={0}
      className={`rows${className === undefined ? '' : ` ${className}`}`}
      aria-activedescendant={rows.length === 0 ? undefined : `${base}-${String(active)}`}
      onKeyDown={onKey}
    >
      {rows.map((r, i) => (
        <li
          key={r.id}
          id={`${base}-${String(i)}`}
          role="option"
          aria-selected={i === active}
          className={`row${i === active ? ' is-active' : ''}`}
          onClick={() => {
            setActive(i);
            onOpen(r.id);
          }}
        >
          <span className="row__title">{r.title}</span>
          <span className="row__detail">
            {r.status === undefined ? null : (
              <span className={`row__status row__status--${r.status.severity}`}>
                <StatusIcon severity={r.status.severity} size={14} />
                {r.status.label}
              </span>
            )}
            {r.detail}
          </span>
          <Icon name="chevron-right" size={18} />
        </li>
      ))}
    </ul>
  );
}

function launchDetail(design: RocketDesign, units: UnitSystem): string {
  const { rail, wind } = design.launch;
  const angle =
    rail.angleFromVertical === 0
      ? 'vertical'
      : `${formatQuantity(rail.angleFromVertical, 'angle', units)} from vertical`;
  const air =
    wind.profile !== undefined
      ? 'wind profile'
      : wind.speed === 0
        ? 'no wind'
        : `${formatQuantity(wind.speed, 'velocity', units)} wind`;
  return `${formatQuantity(rail.length, 'm', units)} rail, ${angle}, ${air}`;
}

export interface HomeProps {
  readonly figures: Figures;
  readonly onOpen: (id: string) => void;
}

/** The home page of the task panel. */
export function Home({ figures, onOpen }: HomeProps): JSX.Element {
  const { state, dispatch } = useStore();
  const d = state.design;
  const units = state.units;
  const [showInside, setShowInside] = useState(false);
  const insideId = useId();
  const partRow = (c: (typeof d.components)[number]): Row => {
    const kind = COMPONENT_LABELS[c.component.kind];
    return { id: c.id, title: c.name, ...(kind === c.name ? {} : { detail: kind }) };
  };
  const outside = d.components.filter((c) => OUTSIDE.has(c.component.kind)).map(partRow);
  const inside = d.components.filter((c) => !OUTSIDE.has(c.component.kind)).map(partRow);
  // Only the next missing core part is offered, so there is one obvious thing to do.
  const next = CORE.find((c) => !d.components.some((p) => p.component.kind === c.kind));
  const motor = d.motorMount?.motor;
  const count = designMotorCount(d);
  const s = figures.stability;

  return (
    <div className="home">
      <h2 className="page-title">Your rocket</h2>

      {next === undefined ? null : (
        <div className="home__start">
          <p>
            {d.components.length === 0
              ? 'Start with the body tube: it sets the diameter that stability is measured in.'
              : `Next: ${next.label.replace(/^Add /, 'add ')}.`}
          </p>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'add-component', kind: next.kind, id: newId() });
            }}
          >
            {next.label}
          </Button>
        </div>
      )}

      {outside.length === 0 ? null : (
        <RowList label="Component list" rows={outside} onOpen={onOpen} />
      )}
      {inside.length === 0 ? null : (
        <>
          <button
            type="button"
            className="row row--toggle"
            aria-expanded={showInside}
            aria-controls={insideId}
            onClick={() => {
              setShowInside((v) => !v);
            }}
          >
            <span className="row__title">Inside the airframe</span>
            <span className="row__detail">
              {String(inside.length)} {inside.length === 1 ? 'part' : 'parts'}
            </span>
            <Icon name="chevron" size={18} />
          </button>
          <div id={insideId} hidden={!showInside}>
            <RowList label="Inside parts" rows={inside} onOpen={onOpen} className="rows--inside" />
          </div>
        </>
      )}
      <label className="add-part">
        <span className="visually-hidden">Add a component</span>
        <select
          aria-label="Add a component"
          value=""
          onChange={(e) => {
            const kind = e.target.value as ComponentKind | '';
            if (kind !== '') dispatch({ type: 'add-component', kind, id: newId() });
          }}
        >
          <option value="">Add a part…</option>
          {ADD_ORDER.map((k) => (
            <option key={k} value={k}>
              {COMPONENT_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <div className="home__group">
        <RowList
          label="Motor"
          rows={[
            {
              id: MOTOR_TARGET,
              title: 'Motor',
              detail:
                motor === undefined
                  ? 'Choose one'
                  : `${count > 1 ? `${String(count)} × ` : ''}${motor.definition.manufacturer} ${motor.definition.designation}${
                      motor.ejectionDelay === undefined
                        ? ', plugged'
                        : `, ${String(motor.ejectionDelay)} s delay`
                    }`,
            },
          ]}
          onOpen={onOpen}
        />
        {d.recovery.length === 0 ? (
          <div className="row row--static">
            <span className="row__title">Recovery</span>
            <span className="row__detail">
              {d.components.length === 0 ? (
                'None'
              ) : (
                <span className="row__status row__status--danger">
                  <StatusIcon severity="danger" size={14} />
                  None
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: 'add-recovery', id: newId() });
              }}
            >
              Add parachute
            </Button>
          </div>
        ) : (
          <RowList
            label="Recovery devices"
            rows={d.recovery.map((r) => ({
              id: r.id,
              title: r.name,
              detail: `deploys at ${r.deploy.event}`,
            }))}
            onOpen={onOpen}
          />
        )}
        <RowList
          label="Launch"
          rows={[{ id: LAUNCH_TARGET, title: 'Launch', detail: launchDetail(d, units) }]}
          onOpen={onOpen}
        />
        <RowList
          label="Stability and mass"
          rows={[
            {
              id: STABILITY_TARGET,
              title: 'Stability and mass',
              ...(s === undefined
                ? {
                    detail: figures.error === undefined ? 'Add parts to see' : 'Cannot compute',
                  }
                : {
                    status: LEVEL_STATUS[s.liftoff.level],
                    detail: `${s.result.marginLiftoff.toFixed(FIGURE_DISPLAY.stabilityMargin.decimals)} calibers`,
                  }),
            },
          ]}
          onOpen={onOpen}
        />
      </div>

      <RowList
        label="Flight"
        // The accent bar is kept for when the flight can run (simplify.md principle 3).
        className={motor === undefined ? 'rows--flight' : 'rows--flight rows--primary'}
        rows={[
          {
            id: FLIGHT_TARGET,
            title: 'Simulate the flight',
            detail: motor === undefined ? 'Choose a motor first' : 'Results, replay and plots',
          },
        ]}
        onOpen={onOpen}
      />
    </div>
  );
}
