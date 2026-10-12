import type { DispersionResult, DispersionSettingsRecord } from '@lo-fi-rocket/formats';
import { useId, useState, type JSX } from 'react';
import type { DispersionState } from './FlightViewer.js';
import { useServices } from '../state/services.js';
import { useStore } from '../state/store.js';
import { displayValue, formatQuantity, unitFor, type QuantityKind } from '../units/display.js';
import { QuantityField, IntegerField } from './QuantityField.js';
import { ScatterPlot } from './ScatterPlot.js';

/** Zero variations: CLAUDE.md gives no uncertainty figures and no approved source does (D-051). */
export const DEFAULT_DISPERSION: DispersionSettingsRecord = {
  runs: 50,
  seed: 1,
  variations: {
    windSpeed: 0,
    windDirection: 0,
    railAngle: 0,
    railAzimuth: 0,
    motorImpulseScale: 0,
    structuralMassScale: 0,
  },
};

const VARIATION_FIELDS: readonly {
  key: keyof DispersionSettingsRecord['variations'];
  label: string;
  kind: QuantityKind;
}[] = [
  { key: 'windSpeed', label: 'Wind speed standard deviation', kind: 'velocity' },
  { key: 'windDirection', label: 'Wind direction standard deviation', kind: 'angle' },
  { key: 'railAngle', label: 'Rail angle standard deviation', kind: 'angle' },
  { key: 'railAzimuth', label: 'Rail azimuth standard deviation', kind: 'angle' },
  {
    key: 'motorImpulseScale',
    label: 'Thrust curve scale standard deviation (fraction)',
    kind: 'ratio',
  },
  {
    key: 'structuralMassScale',
    label: 'Structural mass scale standard deviation (fraction)',
    kind: 'ratio',
  },
];

export interface DispersionPanelProps {
  /** The batch, held by the App when given (plan 0024) so the 3D replay can show it; local otherwise. */
  readonly result?: DispersionState | undefined;
  readonly onResult?: ((d: DispersionState | undefined) => void) | undefined;
}

export function DispersionPanel(props: DispersionPanelProps = {}): JSX.Element {
  const { state, dispatch } = useStore();
  const services = useServices();
  const units = state.units;
  const design = state.design;
  const settings = design.dispersion ?? DEFAULT_DISPERSION;
  const [local, setLocal] = useState<DispersionResult | undefined>(undefined);
  const result = props.onResult === undefined ? local : props.result?.result;
  const setResult = (r: DispersionResult | undefined): void => {
    if (props.onResult === undefined) setLocal(r);
    else props.onResult(r === undefined ? undefined : { design, result: r });
  };
  const [progress, setProgress] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const runsId = useId();
  const set = (next: DispersionSettingsRecord): void => {
    dispatch({ type: 'set-dispersion', dispersion: next });
  };
  const run = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    const outcome = await services.runner.runDispersion(design, settings, (done, total) => {
      setProgress(`${String(done)} of ${String(total)} runs`);
    });
    setBusy(false);
    setProgress(undefined);
    if (outcome.ok) setResult(outcome.result);
    else setError(outcome.message);
  };
  const mUnit = unitFor('m', units);
  const summary = result?.summary;
  const stat = (
    s:
      { mean: number; standardDeviation: number; p5: number; p50: number; p95: number } | undefined,
  ): string =>
    s === undefined
      ? '—'
      : `mean ${formatQuantity(s.mean, 'm', units)}, sd ${formatQuantity(s.standardDeviation, 'm', units)}, 5 % ${formatQuantity(s.p5, 'm', units)}, median ${formatQuantity(s.p50, 'm', units)}, 95 % ${formatQuantity(s.p95, 'm', units)}`;
  return (
    <section className="dispersion" aria-label="Monte Carlo dispersion">
      <h3>Monte Carlo dispersion</h3>
      <p className="muted small">
        Each run perturbs the design with normal variations of the standard deviations below (all
        zero by default: no source gives figures) and flies it. The seed makes the batch
        reproducible and is kept with the results.
      </p>
      <div className="field">
        <label htmlFor={runsId}>Number of runs</label>
        <div className="field-input">
          <IntegerField
            label="Runs"
            value={settings.runs}
            min={1}
            onChange={(n) => {
              set({ ...settings, runs: n });
            }}
          />
        </div>
      </div>
      <IntegerField
        label="Dispersion seed"
        value={settings.seed}
        min={0}
        onChange={(n) => {
          set({ ...settings, seed: n });
        }}
      />
      {VARIATION_FIELDS.map((f) => (
        <QuantityField
          key={f.key}
          label={f.label}
          kind={f.kind}
          units={units}
          value={settings.variations[f.key]}
          rule="non-negative"
          onChange={(si) => {
            set({ ...settings, variations: { ...settings.variations, [f.key]: si } });
          }}
        />
      ))}
      <div className="editor-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || design.motorMount?.motor === undefined}
          onClick={() => {
            void run();
          }}
        >
          {busy ? (progress ?? 'Running…') : 'Run dispersion'}
        </button>
      </div>
      {error === undefined ? null : (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {result === undefined || summary === undefined ? null : (
        <section className="dispersion-results" aria-label="Dispersion results">
          <dl className="figures">
            <div>
              <dt>Runs</dt>
              <dd>
                {String(result.runs.length)} (landed {String(summary.landed)}, not landed{' '}
                {String(summary.notLanded)}, failed {String(summary.failed)}), seed{' '}
                {String(result.seed)}
              </dd>
            </div>
            <div>
              <dt>Apogee</dt>
              <dd>{stat(summary.apogee)}</dd>
            </div>
            <div>
              <dt>Landing distance from the pad</dt>
              <dd>{stat(summary.landingDistance)}</dd>
            </div>
            <div>
              <dt>95 % containment radius about the mean landing</dt>
              <dd>
                {summary.containmentRadius95 === undefined
                  ? '—'
                  : formatQuantity(summary.containmentRadius95, 'm', units)}
              </dd>
            </div>
          </dl>
          {summary.failed === 0 ? null : (
            <p className="warning">
              {String(summary.failed)} run{summary.failed === 1 ? '' : 's'} could not be simulated;
              the first message: {result.runs.find((r) => r.error !== undefined)?.error}
            </p>
          )}
          <ScatterPlot
            title="Landing points"
            unitLabel={mUnit.label}
            points={result.runs
              .filter(
                (r) =>
                  r.landingEast !== undefined &&
                  r.landingNorth !== undefined &&
                  r.error === undefined,
              )
              .map(
                (r) =>
                  [
                    displayValue(r.landingEast ?? 0, 'm', units),
                    displayValue(r.landingNorth ?? 0, 'm', units),
                  ] as const,
              )}
            mean={
              summary.meanLanding === undefined
                ? undefined
                : [
                    displayValue(summary.meanLanding.east, 'm', units),
                    displayValue(summary.meanLanding.north, 'm', units),
                  ]
            }
            containmentRadius={
              summary.containmentRadius95 === undefined
                ? undefined
                : displayValue(summary.containmentRadius95, 'm', units)
            }
          />
        </section>
      )}
    </section>
  );
}
