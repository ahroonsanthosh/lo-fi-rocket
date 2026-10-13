/**
 * Panels of the console layout (docs/ui/redesign.md, D-UI-6): the
 * telemetry readouts at the top of the right column, the step strip over
 * each editor, the empty step and the in-flight checks. Every number is
 * the physics' own, formatted by the display rules; nothing is computed
 * here except unit conversion at the display boundary.
 */
import { newId } from '@lo-fi-rocket/formats';
import type { WarningThresholds } from '@lo-fi-rocket/formats';
import {
  Button,
  FIGURE_DISPLAY,
  Meter,
  Panel,
  ResultCard,
  ResultGrid,
  Term,
  type Severity,
} from '@lo-fi-rocket/ui';
import type { JSX } from 'react';
import type { FlightState } from '../components/FlightPanel.js';
import type { Figures } from '../components/StabilityPanel.js';
import { useStore } from '../state/store.js';
import { unitFor, type UnitSystem } from '../units/display.js';
import { gaugeRange, LEVEL_STATUS, machStatus, MACH_SCALE, MACH_TICKS } from './stability.js';
import { nextStep, STEP_HINT, STEP_LABEL, STEP_ORDER, type StepId } from './steps.js';

export interface TelemetryProps {
  readonly figures: Figures;
  readonly thresholds: { readonly unstableBelow: number; readonly overstableAbove: number };
  readonly warningThresholds: WarningThresholds;
  readonly units: UnitSystem;
  readonly flight: FlightState | undefined;
  readonly stale: boolean;
}

/** The status the rail exit figure gets against the editable minimum (CLAUDE.md 9). */
export function railExitStatus(
  velocity: number,
  minimum: number,
  minimumText: string,
): { severity: Severity; label: string } {
  return velocity < minimum
    ? { severity: 'danger', label: `Below ${minimumText}` }
    : { severity: 'safe', label: `At least ${minimumText}` };
}

/**
 * The always-visible figures (the reference's right-hand readouts): the
 * stability margin at liftoff and burnout on the rule-of-thumb scale, the
 * apogee and the maximum velocity, the rail exit velocity against its
 * minimum and the maximum Mach number against the model's regimes.
 */
export function Telemetry(props: TelemetryProps): JSX.Element {
  const { figures, thresholds, warningThresholds, units, flight, stale } = props;
  const s = figures.stability;
  const { min, max } = gaugeRange(thresholds);
  const margin = FIGURE_DISPLAY.stabilityMargin;
  const ticks = [
    {
      at: thresholds.unstableBelow,
      label: `likely unstable below ${String(thresholds.unstableBelow)}`,
    },
    {
      at: thresholds.overstableAbove,
      label: `may be overstable above ${String(thresholds.overstableAbove)}`,
    },
  ];
  const m = unitFor('m', units);
  const v = unitFor('velocity', units);
  const summary = flight?.result.summary;
  const railMin = v.fromSI(warningThresholds.minRailExitVelocity);
  const railMinText = `${railMin.toFixed(v.decimals)} ${v.label}`;
  const missing = figures.error !== undefined ? 'cannot compute' : 'add parts to see';
  const notYet = 'not simulated yet';
  return (
    <div className="telemetry">
      <Meter
        label={
          <>
            <Term k="stabilityMargin">Stability</Term> at liftoff
          </>
        }
        value={s?.result.marginLiftoff}
        decimals={margin.decimals}
        unit={margin.unit}
        scale={{ min, max }}
        ticks={ticks}
        emptyText={missing}
        {...(s === undefined
          ? figures.error === undefined
            ? {}
            : { status: { severity: 'danger', label: 'Cannot compute' } }
          : { status: LEVEL_STATUS[s.liftoff.level] })}
        {...(s?.noMotor === true ? { detail: 'no motor selected' } : {})}
      />
      <Meter
        label="Stability at burnout"
        value={s === undefined || s.noMotor ? undefined : s.result.marginBurnout}
        decimals={margin.decimals}
        unit={margin.unit}
        scale={{ min, max }}
        ticks={ticks}
        emptyText={s?.noMotor === true ? 'choose a motor' : missing}
        {...(s === undefined || s.noMotor ? {} : { status: LEVEL_STATUS[s.burnout.level] })}
      />
      <Meter
        label={<Term k="apogee">Apogee</Term>}
        value={summary === undefined ? undefined : m.fromSI(summary.apogee)}
        decimals={m.decimals}
        unit={m.label}
        emptyText={notYet}
        stale={stale}
        {...(summary === undefined
          ? {}
          : {
              detail: `at ${summary.timeToApogee.toFixed(FIGURE_DISPLAY.timeToApogee.decimals)} s`,
            })}
      />
      <Meter
        label="Maximum velocity"
        value={summary === undefined ? undefined : v.fromSI(summary.maxVelocity)}
        decimals={v.decimals}
        unit={v.label}
        emptyText={notYet}
        stale={stale}
      />
      <Meter
        label={<Term k="railExitVelocity">Rail exit velocity</Term>}
        value={summary === undefined ? undefined : v.fromSI(summary.railExitVelocity)}
        decimals={v.decimals}
        unit={v.label}
        scale={{ min: 0, max: Math.max(2 * railMin, 1) }}
        ticks={[{ at: railMin, label: `minimum ${railMinText}` }]}
        emptyText={notYet}
        stale={stale}
        {...(summary === undefined
          ? {}
          : {
              status: railExitStatus(
                summary.railExitVelocity,
                warningThresholds.minRailExitVelocity,
                railMinText,
              ),
            })}
      />
      <Meter
        label={
          <>
            Maximum <Term k="mach">Mach</Term>
          </>
        }
        value={summary?.maxMach}
        decimals={FIGURE_DISPLAY.maxMach.decimals}
        unit=""
        scale={MACH_SCALE}
        ticks={MACH_TICKS}
        emptyText={notYet}
        stale={stale}
        {...(summary === undefined ? {} : { status: machStatus(summary.maxMach) })}
      />
    </div>
  );
}

/** "Step 3 of 7", the step's one line, and a button to the next step. */
export function StepStrip({
  step,
  onOpen,
}: {
  readonly step: StepId;
  readonly onOpen: (id: StepId) => void;
}): JSX.Element {
  const next = nextStep(step);
  return (
    <div className="step-strip">
      <p className="step-strip__text">
        <span className="step-strip__count">
          Step {String(STEP_ORDER.indexOf(step) + 1)} of {String(STEP_ORDER.length)}
        </span>
        <span className="step-strip__hint">{STEP_HINT[step]}</span>
      </p>
      {next === undefined ? null : (
        <Button
          onClick={() => {
            onOpen(next);
          }}
        >
          Next: {STEP_LABEL[next]}
        </Button>
      )}
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
    <Panel title="In-flight checks" description="Computed during the simulation.">
      {flight === undefined ? (
        <p className="muted small">Simulate a flight to see the lowest margin in flight.</p>
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
