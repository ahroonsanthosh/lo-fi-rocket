import {
  kelvin,
  metres,
  metresPerSecond,
  pascals,
  radians,
  seconds,
  validateLaunch,
  validateWindLayers,
} from '@lo-fi-rocket/physics';
import type {
  LaunchConditions,
  SimulationSettings,
  WindLayerSettings,
} from '@lo-fi-rocket/formats';
import { useId, type JSX } from 'react';
import { useStore } from '../state/store.js';
import { IntegerField, QuantityField } from './QuantityField.js';

function launchWarnings(launch: LaunchConditions): string[] {
  try {
    return validateLaunch({ altitude: launch.site.altitude }, launch.rail).warnings.map(
      (w) => w.message,
    );
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/** Launch site, rail, wind and the simulation settings (plan 0014). */
export function LaunchEditor(): JSX.Element {
  const { state, dispatch } = useStore();
  const units = state.units;
  const launch = state.design.launch;
  const sim = state.design.simulation;
  const overrideId = useId();
  const integratorId = useId();
  const set = (next: LaunchConditions): void => {
    dispatch({ type: 'set-launch', launch: next });
  };
  const setSim = (next: SimulationSettings): void => {
    dispatch({ type: 'set-simulation', simulation: next });
  };
  const overrides = launch.site.temperature !== undefined && launch.site.pressure !== undefined;
  const warnings = launchWarnings(launch);
  return (
    <div>
      <h3>Launch site</h3>
      <QuantityField
        label="Pad altitude above sea level"
        kind="m"
        units={units}
        value={launch.site.altitude}
        rule="any"
        onChange={(si) => {
          set({ ...launch, site: { ...launch.site, altitude: metres(si) } });
        }}
      />
      <div className="field field-check">
        <input
          id={overrideId}
          type="checkbox"
          checked={overrides}
          onChange={(e) => {
            if (e.target.checked) {
              set({
                ...launch,
                site: { ...launch.site, temperature: kelvin(288.15), pressure: pascals(101325) },
              });
            } else {
              set({ ...launch, site: { altitude: launch.site.altitude } });
            }
          }}
        />
        <label htmlFor={overrideId}>
          Override the standard temperature and pressure at the pad
        </label>
      </div>
      {overrides ? (
        <>
          <QuantityField
            label="Temperature at the pad"
            kind="temperature"
            units={units}
            value={launch.site.temperature ?? 288.15}
            rule="positive"
            onChange={(si) => {
              set({ ...launch, site: { ...launch.site, temperature: kelvin(si) } });
            }}
          />
          <QuantityField
            label="Pressure at the pad"
            kind="pressure"
            units={units}
            value={launch.site.pressure ?? 101325}
            rule="positive"
            onChange={(si) => {
              set({ ...launch, site: { ...launch.site, pressure: pascals(si) } });
            }}
          />
        </>
      ) : null}
      <h3>Launch rail</h3>
      <QuantityField
        label="Rail length"
        kind="m"
        units={units}
        value={launch.rail.length}
        rule="positive"
        onChange={(si) => {
          set({ ...launch, rail: { ...launch.rail, length: metres(si) } });
        }}
      />
      <QuantityField
        label="Rail angle from vertical"
        kind="angle"
        units={units}
        value={launch.rail.angleFromVertical}
        rule="non-negative"
        hint="the NAR safety code limit is 30°"
        onChange={(si) => {
          set({ ...launch, rail: { ...launch.rail, angleFromVertical: radians(si) } });
        }}
      />
      <QuantityField
        label="Rail leans towards (compass bearing)"
        kind="angle"
        units={units}
        value={launch.rail.azimuth}
        rule="any"
        onChange={(si) => {
          set({ ...launch, rail: { ...launch.rail, azimuth: radians(si) } });
        }}
      />
      <h3>Wind</h3>
      {launch.wind.profile === undefined ? (
        <>
          <QuantityField
            label="Wind speed (steady, uniform)"
            kind="velocity"
            units={units}
            value={launch.wind.speed}
            rule="non-negative"
            onChange={(si) => {
              set({ ...launch, wind: { ...launch.wind, speed: metresPerSecond(si) } });
            }}
          />
          <QuantityField
            label="Wind blows from (compass bearing)"
            kind="angle"
            units={units}
            value={launch.wind.from}
            rule="any"
            onChange={(si) => {
              set({ ...launch, wind: { ...launch.wind, from: radians(si) } });
            }}
          />
          <button
            type="button"
            onClick={() => {
              set({
                ...launch,
                wind: {
                  ...launch.wind,
                  profile: [
                    { altitude: metres(0), speed: launch.wind.speed, from: launch.wind.from },
                    { altitude: metres(100), speed: launch.wind.speed, from: launch.wind.from },
                  ],
                },
              });
            }}
          >
            Vary the wind with altitude
          </button>
        </>
      ) : (
        <WindProfileEditor
          layers={launch.wind.profile}
          units={units}
          onChange={(profile) => {
            if (profile === undefined) {
              const rest = { speed: launch.wind.speed, from: launch.wind.from };
              set({
                ...launch,
                wind:
                  launch.wind.turbulence === undefined
                    ? rest
                    : { ...rest, turbulence: launch.wind.turbulence },
              });
            } else set({ ...launch, wind: { ...launch.wind, profile } });
          }}
        />
      )}
      <QuantityField
        label="Turbulence intensity (standard deviation over the mean speed)"
        kind="ratio"
        units={units}
        value={launch.wind.turbulence?.intensity ?? 0}
        rule="non-negative"
        hint="0 for none; Niskanen quotes 0.1 to 0.2 as the top of the range for model rocket conditions; pink-noise gusts at 20 Hz"
        onChange={(v) => {
          set({
            ...launch,
            wind: {
              ...launch.wind,
              turbulence: { intensity: v, seed: launch.wind.turbulence?.seed ?? 1 },
            },
          });
        }}
      />
      {launch.wind.turbulence === undefined ? null : (
        <IntegerField
          label="Turbulence seed (same seed, same gusts)"
          value={launch.wind.turbulence.seed}
          min={0}
          onChange={(n) => {
            set({
              ...launch,
              wind: {
                ...launch.wind,
                turbulence: { intensity: launch.wind.turbulence?.intensity ?? 0, seed: n },
              },
            });
          }}
        />
      )}
      {warnings.map((w) => (
        <p key={w} className="warning" role="alert">
          {w}
        </p>
      ))}
      <details className="settings">
        <summary>Simulation settings</summary>
        <div className="field">
          <label htmlFor={integratorId}>Integrator</label>
          <div className="field-input">
            <select
              id={integratorId}
              value={sim.integrator.kind}
              onChange={(e) => {
                setSim({
                  ...sim,
                  integrator:
                    e.target.value === 'rk4'
                      ? { kind: 'rk4', timeStep: seconds(0.002) }
                      : {
                          kind: 'dormand-prince',
                          relativeTolerance: 1e-8,
                          absoluteTolerance: 1e-10,
                          initialStep: seconds(0.001),
                          maxStep: seconds(0.05),
                        },
                });
              }}
            >
              <option value="dormand-prince">Dormand–Prince RK5(4), adaptive step</option>
              <option value="rk4">Classical RK4, fixed step</option>
            </select>
          </div>
        </div>
        {sim.integrator.kind === 'rk4' ? (
          <QuantityField
            label="Time step"
            kind="time"
            units={units}
            value={sim.integrator.timeStep}
            rule="positive"
            hint="0.002 s reproduces the 0.001 s result within 0.001 m on the reference rockets"
            onChange={(si) => {
              setSim({ ...sim, integrator: { kind: 'rk4', timeStep: seconds(si) } });
            }}
          />
        ) : (
          <QuantityField
            label="Relative tolerance"
            kind="ratio"
            units={units}
            value={sim.integrator.relativeTolerance}
            rule="positive"
            hint="1e-8 matches RK4 at 0.001 s within 0.001 m; looser values can miss the velocity peak"
            onChange={(v) => {
              if (sim.integrator.kind === 'dormand-prince') {
                setSim({
                  ...sim,
                  integrator: {
                    ...sim.integrator,
                    relativeTolerance: v,
                    absoluteTolerance: v / 100,
                  },
                });
              }
            }}
          />
        )}
        <QuantityField
          label="Maximum simulated time"
          kind="time"
          units={units}
          value={sim.maxTime}
          rule="positive"
          onChange={(si) => {
            setSim({ ...sim, maxTime: seconds(si) });
          }}
        />
        <QuantityField
          label="Recording interval"
          kind="time"
          units={units}
          value={sim.recordInterval}
          rule="positive"
          onChange={(si) => {
            setSim({ ...sim, recordInterval: seconds(si) });
          }}
        />
      </details>
    </div>
  );
}

function WindProfileEditor({
  layers,
  units,
  onChange,
}: {
  readonly layers: readonly WindLayerSettings[];
  readonly units: 'metric' | 'imperial';
  readonly onChange: (layers: readonly WindLayerSettings[] | undefined) => void;
}): JSX.Element {
  let problem: string | undefined;
  try {
    validateWindLayers(layers.map((l) => ({ altitude: l.altitude, speed: l.speed, from: l.from })));
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error);
  }
  const update = (i: number, patch: Partial<WindLayerSettings>): void => {
    onChange(layers.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };
  return (
    <div className="wind-profile" aria-label="Wind profile by altitude">
      <p className="muted small">
        Mean wind by altitude, interpolated between rows; the first row is the pad, the last row
        holds above it.
      </p>
      {layers.map((l, i) => (
        <div key={i} className="wind-row">
          <QuantityField
            label={`Row ${String(i + 1)} altitude`}
            kind="m"
            units={units}
            value={l.altitude}
            rule="non-negative"
            disabled={i === 0}
            onChange={(si) => {
              update(i, { altitude: metres(si) });
            }}
          />
          <QuantityField
            label={`Row ${String(i + 1)} speed`}
            kind="velocity"
            units={units}
            value={l.speed}
            rule="non-negative"
            onChange={(si) => {
              update(i, { speed: metresPerSecond(si) });
            }}
          />
          <QuantityField
            label={`Row ${String(i + 1)} from`}
            kind="angle"
            units={units}
            value={l.from}
            rule="any"
            onChange={(si) => {
              update(i, { from: radians(si) });
            }}
          />
          {i > 0 ? (
            <button
              type="button"
              aria-label={`Remove row ${String(i + 1)}`}
              onClick={() => {
                onChange(layers.filter((_, j) => j !== i));
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      {problem === undefined ? null : (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
      <div className="editor-actions">
        <button
          type="button"
          onClick={() => {
            const last = layers[layers.length - 1];
            onChange([
              ...layers,
              {
                altitude: metres((last?.altitude ?? 0) + 100),
                speed: last?.speed ?? metresPerSecond(0),
                from: last?.from ?? radians(0),
              },
            ]);
          }}
        >
          Add row
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
          }}
        >
          Use a uniform wind
        </button>
      </div>
    </div>
  );
}
