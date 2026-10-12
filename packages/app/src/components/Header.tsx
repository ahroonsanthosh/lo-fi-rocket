import { exampleDesign, newDesign, newId } from '@lo-fi-rocket/formats';
import type { JSX } from 'react';
import { useStore } from '../state/store.js';

export function Header(): JSX.Element {
  const { state, dispatch } = useStore();
  return (
    <header className="app-header">
      <h1>Lo-Fi Rocket</h1>
      <label className="design-name">
        <span className="visually-hidden">Design name</span>
        <input
          type="text"
          aria-label="Design name"
          value={state.design.name}
          onChange={(e) => {
            dispatch({ type: 'rename', name: e.target.value });
          }}
        />
      </label>
      <fieldset className="units-toggle">
        <legend className="visually-hidden">Units</legend>
        <label>
          <input
            type="radio"
            name="units"
            value="metric"
            checked={state.units === 'metric'}
            onChange={() => {
              dispatch({ type: 'set-units', units: 'metric' });
            }}
          />
          Metric
        </label>
        <label>
          <input
            type="radio"
            name="units"
            value="imperial"
            checked={state.units === 'imperial'}
            onChange={() => {
              dispatch({ type: 'set-units', units: 'imperial' });
            }}
          />
          Imperial
        </label>
      </fieldset>
      <div className="header-actions">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'replace-design', design: newDesign(newId(), 'New rocket') });
          }}
        >
          New
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'replace-design', design: exampleDesign(newId()) });
          }}
        >
          Load example
        </button>
      </div>
    </header>
  );
}
