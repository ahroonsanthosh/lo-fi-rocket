import type { RocketDesign } from '@lo-fi-rocket/formats';
import type { FlightResult, StabilityPoint } from '@lo-fi-rocket/physics';
import { Button, FIGURE_DISPLAY, ResultCard, ResultGrid } from '@lo-fi-rocket/ui';
import { useState, type JSX, type ReactNode } from 'react';
import { resultToCsv } from '../simulation/csv-export.js';
import { useServices } from '../state/services.js';
import { useStore } from '../state/store.js';
import { formatQuantity, unitFor, type UnitSystem } from '../units/display.js';
import { machStatus } from '../layout/stability.js';
import { ComparisonPanel } from './ComparisonPanel.js';
import { DispersionPanel } from './DispersionPanel.js';
import type { DispersionState } from './FlightViewer.js';

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
  /** Lifted to the App so the checks column and the status bar show it too. */
  readonly error?: string | undefined;
  readonly onError?: (message: string | undefined) => void;
  /** The 3D replay and the plots of the flight, shown under the results (App). */
  readonly replay?: ReactNode;
  readonly plots?: ReactNode;
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

/**
 * The run button, the summary and the events (plan 0014), then the 3D
 * replay, the plots, the recorded-flight comparison and the Monte Carlo
 * dispersion. Simulate is at the top so it is never below the fold
 * (docs/ui/redesign.md section 3); the warnings are in the checks column
 * and the launch conditions have their own view.
 */
export function FlightPanel({
  flight,
  onFlight,
  dispersion,
  onDispersion,
  error: liftedError,
  onError,
  replay,
  plots,
}: FlightPanelProps): JSX.Element {
  const { state } = useStore();
  const services = useServices();
  const units = state.units;
  const design = state.design;
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const error = onError === undefined ? localError : liftedError;
  const setError = (m: string | undefined): void => {
    setLocalError(m);
    onError?.(m);
  };

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
      <div className="editor-title">
        <h2>Simulate and results</h2>
        <div className="editor-actions">
          <Button
            variant="primary"
            disabled={busy || noMotor}
            onClick={() => {
              void run();
            }}
          >
            {busy ? 'Simulating…' : 'Simulate flight'}
          </Button>
          {flight === undefined ? null : (
            <Button
              onClick={() => {
                services.saveFile(
                  `${design.name || 'flight'}.csv`,
                  resultToCsv(flight.result, flight.design.name),
                  'text/csv',
                );
              }}
            >
              Export CSV
            </Button>
          )}
        </div>
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
          <Summary flight={flight} units={units} stale={stale} />
        </>
      )}
      {flight === undefined ? null : (
        <>
          {replay}
          {plots}
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
  stale,
}: {
  readonly flight: FlightState;
  readonly units: UnitSystem;
  readonly stale: boolean;
}): JSX.Element {
  const r = flight.result;
  const s = r.summary;
  const m = unitFor('m', units);
  const v = unitFor('velocity', units);
  const a = unitFor('acceleration', units);
  const fd = FIGURE_DISPLAY;
  const opt = (x: number | undefined, f: (y: number) => string): string =>
    x === undefined ? '—' : f(x);
  return (
    <div className="results" aria-label="Flight results">
      <ResultGrid label="Flight results">
        <ResultCard
          label="Apogee"
          term="apogee"
          value={m.fromSI(s.apogee)}
          decimals={m.decimals}
          unit={m.label}
          stale={stale}
        />
        <ResultCard
          label="Time to apogee"
          value={s.timeToApogee}
          decimals={fd.timeToApogee.decimals}
          unit={fd.timeToApogee.unit}
          stale={stale}
        />
        <ResultCard
          label="Maximum velocity"
          value={v.fromSI(s.maxVelocity)}
          decimals={v.decimals}
          unit={v.label}
          stale={stale}
        />
        <ResultCard
          label="Maximum Mach"
          term="mach"
          value={s.maxMach}
          decimals={fd.maxMach.decimals}
          unit={fd.maxMach.unit}
          status={machStatus(s.maxMach)}
          stale={stale}
        />
        <ResultCard
          label="Maximum acceleration"
          value={a.fromSI(s.maxAcceleration)}
          decimals={a.decimals}
          unit={a.label}
          stale={stale}
        />
        <ResultCard
          label="Rail exit velocity"
          term="railExitVelocity"
          value={v.fromSI(s.railExitVelocity)}
          decimals={v.decimals}
          unit={v.label}
          detail={`at ${s.railExitTime.toFixed(fd.railExitTime.decimals)} s`}
          stale={stale}
        />
        <ResultCard
          label="Burnout"
          term="burnTime"
          value={s.burnoutTime}
          decimals={fd.burnoutTime.decimals}
          unit={fd.burnoutTime.unit}
          detail={`at ${formatQuantity(s.burnoutVelocity, 'velocity', units)}`}
          stale={stale}
        />
        <ResultCard
          label="Deployment"
          term="deploymentVelocity"
          value={s.deploymentTime}
          decimals={fd.deploymentTime.decimals}
          unit={fd.deploymentTime.unit}
          detail={`at ${opt(s.deploymentVelocity, (x) => formatQuantity(x, 'velocity', units))}`}
          stale={stale}
        />
        <ResultCard
          label="Descent rate at landing"
          term="descentRate"
          value={s.descentRate === undefined ? undefined : v.fromSI(s.descentRate)}
          decimals={v.decimals}
          unit={v.label}
          stale={stale}
        />
        <ResultCard
          label="Landing"
          value={s.landingDistance === undefined ? undefined : m.fromSI(s.landingDistance)}
          decimals={m.decimals}
          unit={m.label}
          {...(s.landingDirection === undefined ||
          s.landingDistance === undefined ||
          s.landingDistance < 0.01
            ? {}
            : { detail: `towards ${bearing(s.landingDirection)}` })}
          stale={stale}
        />
        <ResultCard
          label="Flight time"
          value={s.flightTime}
          decimals={fd.flightTime.decimals}
          unit={fd.flightTime.unit}
          detail={
            s.endReason === 'landing'
              ? '(landed)'
              : s.endReason === 'max-time'
                ? '(stopped at the maximum time)'
                : s.endReason === 'no-ignition'
                  ? '(no motor ignited)'
                  : '(stopped at the model limit, not landed)'
          }
          stale={stale}
        />
      </ResultGrid>
      <p
        className={`confidence confidence-${r.confidence.level}`}
        role="note"
        aria-label="Confidence"
      >
        {r.confidence.summary}
        {r.approximations.length === 0
          ? ''
          : ` ${String(r.approximations.length)} approximation${r.approximations.length === 1 ? '' : 's'} listed in the checks.`}
      </p>
      <p className="muted small">
        Lowest in-flight stability: {stabilityText(s.minimumStability.powered, 'powered')}
        {s.minimumStability.coast === undefined ? '' : '; '}
        {stabilityText(s.minimumStability.coast, 'coast')}
      </p>
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
