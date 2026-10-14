/**
 * The stage (docs/ui/simplify.md section 3): the three numbers that decide
 * a flight, the rocket itself, and one plain sentence about its
 * stability. After a simulation the 3D replay can take the rocket's
 * place. Every figure is the physics' own, formatted by the display rules.
 */
import type { RocketDesign } from '@lo-fi-rocket/formats';
import {
  FIGURE_DISPLAY,
  formatFixed,
  isDisplayable,
  Segmented,
  SeverityTag,
  Term,
  type GlossaryKey,
  type Severity,
} from '@lo-fi-rocket/ui';
import type { JSX, ReactNode } from 'react';
import type { FlightState } from '../components/FlightPanel.js';
import { FlightViewer, type DispersionState } from '../components/FlightViewer.js';
import { SideView } from '../components/SideView.js';
import type { Figures } from '../components/StabilityPanel.js';
import { useStore } from '../state/store.js';
import { formatQuantity, unitFor } from '../units/display.js';
import { LEVEL_STATUS } from './stability.js';

export type StageMode = 'rocket' | 'replay';

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

/** One of the three numbers: large, with its name and its status in words under it. */
function Figure(props: {
  readonly term: GlossaryKey;
  readonly label: string;
  readonly value: number | undefined;
  readonly decimals: number;
  readonly unit: string;
  readonly status?: { readonly severity: Severity; readonly label: string } | undefined;
  readonly note?: ReactNode;
  readonly stale?: boolean;
}): JSX.Element {
  const { value, decimals, unit, status, note, stale = false } = props;
  return (
    <div className={`figure${stale ? ' figure--stale' : ''}`}>
      <p className="figure__label">
        <Term k={props.term}>{props.label}</Term>
      </p>
      <p className="figure__value">
        {value === undefined ? (
          <>
            <span className="figure__number figure__number--none" aria-hidden="true">
              —
            </span>
            <span className="visually-hidden">not available</span>
          </>
        ) : (
          <>
            <span className="figure__number">{formatFixed(value, decimals)}</span>
            {unit === '' ? null : <span className="figure__unit"> {unit}</span>}
            {isDisplayable(value) ? null : (
              <span className="lfr-nonfinite"> not a finite number</span>
            )}
          </>
        )}
      </p>
      <div className="figure__foot">
        {status === undefined ? null : (
          <SeverityTag severity={status.severity} label={status.label} />
        )}
        {note === undefined ? null : <span className="figure__note">{note}</span>}
        {stale ? <span className="figure__stale">out of date</span> : null}
      </div>
    </div>
  );
}

export interface StageProps {
  readonly figures: Figures;
  readonly design: RocketDesign;
  readonly flight: FlightState | undefined;
  readonly stale: boolean;
  readonly dispersion: DispersionState | undefined;
  readonly mode: StageMode;
  readonly onMode: (mode: StageMode) => void;
}

export function Stage(props: StageProps): JSX.Element {
  const { figures, design, flight, stale, dispersion, mode, onMode } = props;
  const { state, dispatch } = useStore();
  const units = state.units;
  const s = figures.stability;
  const m = unitFor('m', units);
  const v = unitFor('velocity', units);
  const summary = flight?.result.summary;
  const railMin = design.warningThresholds.minRailExitVelocity;
  const railMinText = formatQuantity(railMin, 'velocity', units);
  const margin = FIGURE_DISPLAY.stabilityMargin;
  const burnout =
    s === undefined || s.noMotor ? undefined : (
      <>
        {formatFixed(s.result.marginBurnout, margin.decimals)} at burnout
        {s.burnout.level === s.liftoff.level ? null : (
          <>
            {' '}
            <SeverityTag
              severity={LEVEL_STATUS[s.burnout.level].severity}
              label={LEVEL_STATUS[s.burnout.level].label}
            />
          </>
        )}
      </>
    );
  const showReplay = mode === 'replay' && flight !== undefined;

  return (
    <div className="stage">
      <section className="key-figures" aria-label="Status">
        <Figure
          term="stabilityMargin"
          label={s?.noMotor === true ? 'Stability, no motor' : 'Stability'}
          value={s?.result.marginLiftoff}
          decimals={margin.decimals}
          unit={margin.unit}
          status={
            s === undefined
              ? figures.error === undefined
                ? undefined
                : { severity: 'danger', label: 'Cannot compute' }
              : LEVEL_STATUS[s.liftoff.level]
          }
          note={s === undefined && figures.error === undefined ? 'Add parts to see' : burnout}
        />
        <Figure
          term="apogee"
          label="Apogee"
          value={summary === undefined ? undefined : m.fromSI(summary.apogee)}
          decimals={m.decimals}
          unit={m.label}
          stale={stale}
          note={
            summary === undefined
              ? 'Simulate to see'
              : `at ${summary.timeToApogee.toFixed(FIGURE_DISPLAY.timeToApogee.decimals)} s`
          }
        />
        <Figure
          term="railExitVelocity"
          label="Rail exit velocity"
          value={summary === undefined ? undefined : v.fromSI(summary.railExitVelocity)}
          decimals={v.decimals}
          unit={v.label}
          stale={stale}
          status={
            summary === undefined
              ? undefined
              : railExitStatus(summary.railExitVelocity, railMin, railMinText)
          }
          note={summary === undefined ? `Needs at least ${railMinText}` : undefined}
        />
      </section>

      {s === undefined ? null : <p className="stage__sentence">{s.liftoff.message}</p>}

      {flight === undefined ? null : (
        <div className="stage__switch">
          <Segmented
            legend="Show"
            name="stage-mode"
            value={showReplay ? 'replay' : 'rocket'}
            options={[
              { value: 'rocket', label: 'Rocket' },
              { value: 'replay', label: 'Flight replay' },
            ]}
            onChange={onMode}
          />
        </div>
      )}

      {showReplay ? (
        <div className="stage__replay">
          <FlightViewer
            design={flight.design}
            result={flight.result}
            units={units}
            dispersion={dispersion}
          />
        </div>
      ) : design.components.length === 0 ? (
        <div className="stage__empty">
          <p>Your rocket will appear here as you add its parts.</p>
        </div>
      ) : (
        <div className="stage__rocket">
          <SideView
            components={design.components}
            selectedId={state.selectedId}
            cg={s?.result.cgLiftoff}
            cp={s?.result.centreOfPressure.cp}
            onSelect={(id) => {
              dispatch({ type: 'select', id });
            }}
          />
          {s === undefined ? null : (
            <p className="stage__legend">
              <span className="key key--cg" aria-hidden="true" />
              <Term k="cg">CG</Term> {formatQuantity(s.result.cgLiftoff, 'mm', units)}
              <span className="key key--cp" aria-hidden="true" />
              <Term k="cp">CP</Term> {formatQuantity(s.result.centreOfPressure.cp, 'mm', units)}
              <span className="stage__legend-note">from the nose tip</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
