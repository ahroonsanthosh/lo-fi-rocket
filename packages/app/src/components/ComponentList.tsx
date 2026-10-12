import type { JSX, KeyboardEvent } from 'react';
import { newId } from '@lo-fi-rocket/formats';
import { COMPONENT_LABELS, type ComponentKind } from '../state/reducer.js';
import { useStore } from '../state/store.js';
import { FLIGHT_SELECTION_ID } from './FlightPanel.js';
import { MOTOR_SELECTION_ID } from './MotorPanel.js';

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

/** The component list: a listbox with arrow-key navigation, plus the add menu. */
export function ComponentList(): JSX.Element {
  const { state, dispatch } = useStore();
  const items = state.design.components;
  const selected = state.selectedId;
  const motor = state.design.motorMount?.motor;

  const onKey = (e: KeyboardEvent<HTMLUListElement>): void => {
    const i = items.findIndex((c) => c.id === selected);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const j = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      const target = items[j];
      if (target !== undefined) dispatch({ type: 'select', id: target.id });
    } else if (e.key === 'Delete' && selected !== undefined) {
      dispatch({ type: 'remove-component', id: selected });
    }
  };

  return (
    <section className="component-list" aria-label="Components">
      <div className="list-header">
        <h2>Components</h2>
        <label className="add-menu">
          <span className="visually-hidden">Add a component</span>
          <select
            aria-label="Add a component"
            value=""
            onChange={(e) => {
              const kind = e.target.value as ComponentKind | '';
              if (kind !== '') dispatch({ type: 'add-component', kind, id: newId() });
            }}
          >
            <option value="">Add…</option>
            {ADD_ORDER.map((k) => (
              <option key={k} value={k}>
                {COMPONENT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {items.length === 0 ? (
        <p className="muted">
          No components yet. Add a nose cone, a body tube and a fin set to start.
        </p>
      ) : (
        <ul role="listbox" aria-label="Component list" tabIndex={0} onKeyDown={onKey}>
          {items.map((c) => (
            <li
              key={c.id}
              role="option"
              aria-selected={c.id === selected}
              className={c.id === selected ? 'selected' : ''}
              onClick={() => {
                dispatch({ type: 'select', id: c.id });
              }}
            >
              <span className="item-name">{c.name}</span>
              <span className="item-kind">{COMPONENT_LABELS[c.component.kind]}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="list-header">
        <h2>Motor</h2>
      </div>
      <ul role="listbox" aria-label="Motor" tabIndex={0}>
        <li
          role="option"
          aria-selected={selected === MOTOR_SELECTION_ID}
          className={selected === MOTOR_SELECTION_ID ? 'selected' : ''}
          onClick={() => {
            dispatch({ type: 'select', id: MOTOR_SELECTION_ID });
          }}
        >
          <span className="item-name">
            {motor === undefined
              ? 'No motor'
              : `${motor.definition.manufacturer} ${motor.definition.designation}`}
          </span>
          <span className="item-kind">
            {motor === undefined
              ? 'choose one'
              : motor.ejectionDelay === undefined
                ? 'plugged'
                : `delay ${String(motor.ejectionDelay)} s`}
          </span>
        </li>
      </ul>
      <div className="list-header">
        <h2>Flight</h2>
      </div>
      <ul role="listbox" aria-label="Flight" tabIndex={0}>
        <li
          role="option"
          aria-selected={selected === FLIGHT_SELECTION_ID}
          className={selected === FLIGHT_SELECTION_ID ? 'selected' : ''}
          onClick={() => {
            dispatch({ type: 'select', id: FLIGHT_SELECTION_ID });
          }}
        >
          <span className="item-name">Launch and flight</span>
          <span className="item-kind">conditions, simulate</span>
        </li>
      </ul>
      <div className="list-header">
        <h2>Recovery</h2>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'add-recovery', id: newId() });
          }}
        >
          Add parachute
        </button>
      </div>
      {state.design.recovery.length === 0 ? (
        <p className="muted">No recovery device: the rocket would fall ballistically.</p>
      ) : (
        <ul role="listbox" aria-label="Recovery devices" tabIndex={0}>
          {state.design.recovery.map((r) => (
            <li
              key={r.id}
              role="option"
              aria-selected={r.id === selected}
              className={r.id === selected ? 'selected' : ''}
              onClick={() => {
                dispatch({ type: 'select', id: r.id });
              }}
            >
              <span className="item-name">{r.name}</span>
              <span className="item-kind">deploys at {r.deploy.event}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
