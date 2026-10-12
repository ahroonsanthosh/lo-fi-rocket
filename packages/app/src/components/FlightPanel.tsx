import { designFlightWarnings, type RocketDesign } from '@lo-fi-rocket/formats';
import { validateLaunch, type FlightResult, type StabilityPoint } from '@lo-fi-rocket/physics';
import { useState, type JSX } from 'react';
import { resultToCsv } from '../simulation/csv-export.js';
import { useServices } from '../state/services.js';
import { useStore } from '../state/store.js';
import { formatQuantity, type UnitSystem } from '../units/display.js';
import { ComparisonPanel } from './ComparisonPanel.js';
import { DispersionPanel } from './DispersionPanel.js';
import type { DispersionState } from './FlightViewer.js';
import { LaunchEditor } from './LaunchEditor.js';

export const FLIGHT_SELECTION_ID = 'flight';

export interface FlightState {
  readonly design: RocketDesign;
  readonly result: FlightResult;
  readonly millis: number;
}

export interface FlightPanelProps {
  readonly flight: FlightState | undefined;
  readonly onFlight: (f: FlightState | undefined) => void;
  /** The Monte Carlo batch, lifted to the App so the 3D replay can show it (plan 0034). */
  readonly dispersion?: DispersionState | undefined;
  readonly onDispersion?: (d: DispersionState | undefined) => void;
}

/** The lowest margin of a phase at its Mach number and angle of attack (plan 0030). */
function stabilityText(p: StabilityPoint | undefined, phase: string): string {
  if (p === undefined) return '';
  return `${p.calibers.toFixed(2)} cal ${phase} (t ${p.time.toFixed(2)} s, Mach ${p.mach.toFixed(2)}, α ${((p.angleOfAttack * 180) / Math.PI).toFixed(1)}°)`;
}

function bearing(rad: number): string {
  const deg = ((rad * 180) / Math.PI + 360) % 360;
  return `${deg.toFixed(0)}°`;
}

/** Launch conditions, the run button, the summary, the events and the warnings (plan 0014). */
export function FlightPanel({
  flight,
  onFlight,
  dispersion,
  onDispersion,
}: FlightPanelProps): JSX.Element {
  const { state } = useStore();
  const services = useServices();
  const units = state.units;
  const design = state.design;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    const outcome = await services.runner.run(design);
    setBusy(false);
    if (outcome.ok) onFlight({ design, result: outcome.result, millis: outcome.millis });
    else {
      onFlight(undefined);
      setError(outcome.message);
    }
  };

  const stale = flight !== undefined && flight.design !== design;
  const noMotor = design.motorMount?.motor === undefined;

  return (
    <section className="editor" aria-label="Flight">
      <h2>Launch and flight</h2>
      <LaunchEditor />
      <div className="editor-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || noMotor}
          onClick={() => {
            void run();
          }}
        >
          {busy ? 'Simulating…' : 'Simulate flight'}
        </button>
        {flight === undefined ? null : (
          <button
            type="button"
            onClick={() => {
              services.saveFile(
                `${design.name || 'flight'}.csv`,
                resultToCsv(flight.result, flight.design.name),
                'text/csv',
              );
            }}
          >
            Export CSV
          </button>
        )}
      </div>
      {noMotor ? <p className="muted">Select a motor before simulating.</p> : null}
      {error === undefined ? null : (
        <div className="stability level-error" role="alert">
          <p className="banner-main">The simulation could not run</p>
          <p>{error}</p>
        </div>
      )}
      {flight === undefined ? null : (
        <>
          {stale ? (
            <p className="warning" role="status">
              The design or the launch conditions changed since this flight was simulated; run it
              again to update.
            </p>
          ) : null}
          <Summary flight={flight} units={units} />
        </>
      )}
      <ComparisonPanel simulatedApogee={flight?.result.summary.apogee} />
      <DispersionPanel result={dispersion} onResult={onDispersion} />
    </section>
  );
}

function Summary({
  flight,
  units,
}: {
  readonly flight: FlightState;
  readonly units: UnitSystem;
}): JSX.Element {
  const r = flight.result;
  const s = r.summary;
  const d = flight.design;
  const warnings = [
    ...designFlightWarnings(d, r).map((w) => w.message),
    ...validateLaunch({ altitude: d.launch.site.altitude }, d.launch.rail).warnings.map(
      (w) => w.message,
    ),
  ];
  const opt = (v: number | undefined, f: (x: number) => string): string =>
    v === undefined ? '—' : f(v);
  return (
    <div className="results" aria-label="Flight results">
      <h3>Results</h3>
      {warnings.length === 0 ? (
        <p className="ok">No warnings.</p>
      ) : (
        <ul className="warnings" aria-label="Warnings">
          {warnings.map((w) => (
            <li key={w} className="warning">
              {w}
            </li>
          ))}
        </ul>
      )}
      <dl className="figures">
        <div>
          <dt>Apogee</dt>
          <dd>{formatQuantity(s.apogee, 'm', units)}</dd>
        </div>
        <div>
          <dt>Time to apogee</dt>
          <dd>{s.timeToApogee.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Maximum velocity</dt>
          <dd>{formatQuantity(s.maxVelocity, 'velocity', units)}</dd>
        </div>
        <div>
          <dt>Maximum Mach</dt>
          <dd>{s.maxMach.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Maximum acceleration</dt>
          <dd>{formatQuantity(s.maxAcceleration, 'acceleration', units)}</dd>
        </div>
        <div>
          <dt>Rail exit velocity</dt>
          <dd>
            {formatQuantity(s.railExitVelocity, 'velocity', units)} at {s.railExitTime.toFixed(3)} s
          </dd>
        </div>
        <div>
          <dt>Burnout</dt>
          <dd>
            {s.burnoutTime.toFixed(2)} s, {formatQuantity(s.burnoutVelocity, 'velocity', units)}
          </dd>
        </div>
        <div>
          <dt>Deployment</dt>
          <dd>
            {opt(s.deploymentTime, (t) => `${t.toFixed(2)} s`)} at{' '}
            {opt(s.deploymentVelocity, (v) => formatQuantity(v, 'velocity', units))}
          </dd>
        </div>
        <div>
          <dt>Lowest in-flight stability</dt>
          <dd>
            {stabilityText(s.minimumStability.powered, 'powered')}
            {s.minimumStability.coast === undefined ? '' : '; '}
            {stabilityText(s.minimumStability.coast, 'coast')}
          </dd>
        </div>
        <div>
          <dt>Descent rate at landing</dt>
          <dd>{opt(s.descentRate, (v) => formatQuantity(v, 'velocity', units))}</dd>
        </div>
        <div>
          <dt>Landing</dt>
          <dd>
            {opt(s.landingDistance, (x) => formatQuantity(x, 'm', units))}
            {s.landingDirection === undefined ||
            s.landingDistance === undefined ||
            s.landingDistance < 0.01
              ? ''
              : ` towards ${bearing(s.landingDirection)}`}
          </dd>
        </div>
        <div>
          <dt>Flight time</dt>
          <dd>
            {s.flightTime.toFixed(2)} s (
            {s.endReason === 'landing'
              ? 'landed'
              : s.endReason === 'max-time'
                ? 'stopped at the maximum time'
                : 'stopped at the model limit, not landed'}
            )
          </dd>
        </div>
      </dl>
      <h3>Events</h3>
      <ol className="events" aria-label="Events">
        {r.events.map((e) => (
          <li key={`${e.kind}-${String(e.time)}`}>
            <span className="event-time">{(e.time as number).toFixed(3)} s</span> {e.detail}
          </li>
        ))}
      </ol>
      <p className="muted small">
        {r.modes.integrator}; {String(r.modes.degreesOfFreedom)} degrees of freedom; Niskanen
        aerodynamics with fin roll reduction {r.modes.finRollReduction ? 'on' : 'off'}; base drag
        motor rule {r.modes.baseDragMotorRule}; sea-level gravity {String(r.modes.gravitySeaLevel)}{' '}
        m/s²;{' '}
        {r.modes.dragCurve === undefined
          ? 'computed drag'
          : `imported drag curve "${r.modes.dragCurve}"`}
        ;{' '}
        {r.modes.windSeed === undefined
          ? 'steady wind'
          : `turbulent wind, turbulence seed ${String(r.modes.windSeed)}`}
        ; {String(r.samples.length)} samples in {flight.millis.toFixed(0)} ms. Flat, non-rotating
        Earth (docs/known-limitations.md).
      </p>
    </div>
  );
}
