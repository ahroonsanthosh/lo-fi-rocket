/**
 * The stages of a multi-stage rocket (plan 0064 part 3b, D-097): each stage's name and, below the
 * top stage, when it separates. A stage is added below the bottom one and removed from the bottom
 * once it holds nothing. Display and editing only: the physics is the engine's.
 */
import { stageRemovalProblem, type DesignStage, type RocketDesign } from '@lo-fi-rocket/formats';
import { metres, seconds, type SeparationEvent, type StageSeparation } from '@lo-fi-rocket/physics';
import { Button } from '@lo-fi-rocket/ui';
import { useId, type JSX } from 'react';
import { useStore } from '../state/store.js';
import { QuantityField } from './QuantityField.js';

/** The separation events in plain words (OpenRocket's set, D-097). */
export const SEPARATION_LABELS: Readonly<Record<SeparationEvent, string>> = {
  'upper-ignition': 'when the stage above lights',
  ignition: 'when its own motor lights',
  burnout: 'at its own motor’s burnout',
  ejection: 'at its own motor’s ejection charge',
  launch: 'at launch',
  apogee: 'at apogee',
  'altitude-ascending': 'climbing through an altitude',
  'altitude-descending': 'descending through an altitude',
  never: 'never (it stays on)',
};

const EVENTS = Object.keys(SEPARATION_LABELS) as SeparationEvent[];

function StageRow({
  design,
  index,
  stage,
  onChange,
}: {
  readonly design: RocketDesign;
  readonly index: number;
  readonly stage: DesignStage;
  readonly onChange: (next: DesignStage) => void;
}): JSX.Element {
  const { state } = useStore();
  const nameId = useId();
  const eventId = useId();
  const sep = stage.separation;
  const setSeparation = (patch: Partial<StageSeparation>): void => {
    const base: StageSeparation = sep ?? { event: 'upper-ignition', delay: seconds(0) };
    const next: StageSeparation = { ...base, ...patch };
    const altitudeEvent =
      next.event === 'altitude-ascending' || next.event === 'altitude-descending';
    // An altitude event needs its altitude; any other leaves it out.
    const { altitude, ...rest } = next;
    onChange({
      ...stage,
      separation: altitudeEvent ? { ...rest, altitude: altitude ?? metres(100) } : rest,
    });
  };
  const parts = design.components.filter((c) => (c.stage ?? 0) === index).length;
  return (
    <fieldset className="stage-row">
      <legend>
        Stage {String(index + 1)}
        {index === 0 ? ' (top)' : ''}: {String(parts)} part{parts === 1 ? '' : 's'}
      </legend>
      <div className="field">
        <label htmlFor={nameId}>Name</label>
        <div className="field-input">
          <input
            id={nameId}
            type="text"
            value={stage.name}
            onChange={(e) => {
              onChange({ ...stage, name: e.target.value });
            }}
          />
        </div>
      </div>
      {index === 0 || sep === undefined ? (
        <p className="muted small">The top stage flies to the end; it never separates.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor={eventId}>Separates</label>
            <div className="field-input">
              <select
                id={eventId}
                value={sep.event}
                onChange={(e) => {
                  setSeparation({ event: e.target.value as SeparationEvent });
                }}
              >
                {EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {SEPARATION_LABELS[ev]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sep.altitude === undefined ? null : (
            <QuantityField
              label="Altitude above the pad"
              kind="m"
              units={state.units}
              value={sep.altitude}
              rule="positive"
              onChange={(si) => {
                setSeparation({ altitude: metres(si) });
              }}
            />
          )}
          <QuantityField
            label="Delay after that"
            kind="time"
            units={state.units}
            value={sep.delay}
            rule="non-negative"
            onChange={(si) => {
              setSeparation({ delay: seconds(si) });
            }}
          />
        </>
      )}
    </fieldset>
  );
}

export function StagesEditor(): JSX.Element {
  const { state, dispatch } = useStore();
  const design = state.design;
  const stages = design.stages;
  const problem = stageRemovalProblem(design);
  return (
    <details className="stages" open={stages !== undefined}>
      <summary>Stages{stages === undefined ? ': one' : `: ${String(stages.length)}`}</summary>
      <p className="muted small">
        A multi-stage rocket flies as one body until a lower stage separates; that stage then leaves
        with every stage below it (its own flight is not simulated). Give each part its stage in the
        part editor, and each stage its motor in the motor view.
      </p>
      {stages?.map((st, k) => (
        <StageRow
          key={String(k)}
          design={design}
          index={k}
          stage={st}
          onChange={(next) => {
            dispatch({
              type: 'set-stages',
              stages: stages.map((s, j) => (j === k ? next : s)),
            });
          }}
        />
      ))}
      <div className="editor-actions">
        <Button
          onClick={() => {
            dispatch({ type: 'add-stage' });
          }}
        >
          {stages === undefined ? 'Add a booster stage' : 'Add a stage below'}
        </Button>
        {stages === undefined ? null : (
          <Button
            disabled={problem !== undefined}
            onClick={() => {
              dispatch({ type: 'remove-bottom-stage' });
            }}
          >
            Remove the bottom stage
          </Button>
        )}
      </div>
      {stages === undefined || problem === undefined ? null : (
        <p className="muted small">{problem}</p>
      )}
    </details>
  );
}

/** Which stage something belongs to, shown only for a multi-stage design. */
export function StageSelect({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (stage: number) => void;
}): JSX.Element | null {
  const { state } = useStore();
  const id = useId();
  const stages = state.design.stages;
  if (stages === undefined) return null;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
        >
          {stages.map((st, k) => (
            <option key={String(k)} value={String(k)}>
              {String(k + 1)}: {st.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
