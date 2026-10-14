/**
 * Pieces of the task panel (docs/ui/simplify.md): the frame of a page
 * with its Back button, the page that offers to add a missing part, and
 * the in-flight checks. Every number is the physics' own.
 */
import { newId } from '@lo-fi-rocket/formats';
import {
  Button,
  FIGURE_DISPLAY,
  Icon,
  Panel,
  ResultCard,
  ResultGrid,
  Term,
} from '@lo-fi-rocket/ui';
import type { JSX, ReactNode } from 'react';
import type { FlightState } from '../components/FlightPanel.js';
import { useStore } from '../state/store.js';
import { STEP_LABEL, type StepId } from './steps.js';

/** A page of the task panel: "Your rocket" to go back, then the page itself. */
export function Page({
  children,
  onBack,
}: {
  readonly children: ReactNode;
  readonly onBack: () => void;
}): JSX.Element {
  return (
    <div className="page">
      <button type="button" className="back" onClick={onBack}>
        <Icon name="back" size={18} />
        Your rocket
      </button>
      {children}
    </div>
  );
}

/** A step whose part does not exist yet: say what it is for and offer to add it. */
export function EmptyStep({ step }: { readonly step: StepId }): JSX.Element {
  const { dispatch } = useStore();
  const kind =
    step === 'body' ? 'bodyTube' : step === 'nose' ? 'noseCone' : step === 'fins' ? 'finSet' : '';
  return (
    <section className="editor" aria-label={STEP_LABEL[step]}>
      <h2>{STEP_LABEL[step]}</h2>
      <p className="muted">This design has no {STEP_LABEL[step].toLowerCase()} yet.</p>
      <div className="editor-actions">
        {step === 'recovery' ? (
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'add-recovery', id: newId() });
            }}
          >
            Add a parachute
          </Button>
        ) : kind === '' ? null : (
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'add-component', kind, id: newId() });
            }}
          >
            Add a {STEP_LABEL[step].toLowerCase()}
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * In-flight checks (redesign section 6): the lowest in-flight margin the
 * simulation already reports, and the fin flutter margin, which arrives
 * with a physics update and says so until then.
 */
export function InFlightChecks({
  flight,
  stale,
}: {
  readonly flight: FlightState | undefined;
  readonly stale: boolean;
}): JSX.Element {
  const m = flight?.result.summary.minimumStability;
  const decimals = FIGURE_DISPLAY.stabilityMargin.decimals;
  const unit = FIGURE_DISPLAY.stabilityMargin.unit;
  const at = (p: { time: number; mach: number } | undefined): string | undefined =>
    p === undefined ? undefined : `at ${p.time.toFixed(2)} s, Mach ${p.mach.toFixed(2)}`;
  const powered = at(m?.powered);
  const coast = at(m?.coast);
  return (
    <Panel title="In flight" description="Computed during the simulation.">
      {flight === undefined ? (
        <p className="muted">Simulate the flight to see the lowest margin in flight.</p>
      ) : (
        <ResultGrid label="In-flight checks">
          <ResultCard
            label="Lowest margin, powered"
            term="minimumFlightMargin"
            value={m?.powered?.calibers}
            decimals={decimals}
            unit={unit}
            stale={stale}
            {...(powered === undefined ? {} : { detail: powered })}
          />
          <ResultCard
            label="Lowest margin, coast"
            term="minimumFlightMargin"
            value={m?.coast?.calibers}
            decimals={decimals}
            unit={unit}
            stale={stale}
            {...(coast === undefined ? {} : { detail: coast })}
          />
        </ResultGrid>
      )}
      <p className="muted small">
        <Term k="finFlutterMargin">Fin flutter margin</Term>: arrives with the physics update.
      </p>
    </Panel>
  );
}
