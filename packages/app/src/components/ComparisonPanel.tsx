import { parseDragCurveCsv, parseFlightDataCsv } from '@lo-fi-rocket/formats';
import { useId, useState, type JSX } from 'react';
import { useServices } from '../state/services.js';
import { useStore } from '../state/store.js';
import { formatQuantity } from '../units/display.js';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Recorded flight data overlay and the imported drag curve (plan 0015). */
export function ComparisonPanel({
  simulatedApogee,
}: {
  readonly simulatedApogee: number | undefined;
}): JSX.Element {
  const { state, dispatch } = useStore();
  const services = useServices();
  const units = state.units;
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [altUnit, setAltUnit] = useState<'m' | 'ft'>('m');
  const dataId = useId();
  const unitId = useId();
  const curveId = useId();
  const recorded = state.design.recordedFlight;
  const curve = state.design.dragCurve;

  const importData = async (file: File): Promise<void> => {
    try {
      const flight = parseFlightDataCsv(
        await services.readFile(file),
        file.name,
        altUnit,
        file.name,
      );
      dispatch({ type: 'set-recorded-flight', recordedFlight: flight });
      setStatus(`${file.name}: ${String(flight.points.length)} samples loaded.`);
    } catch (e) {
      setStatus(errorText(e));
    }
  };
  const importCurve = async (file: File): Promise<void> => {
    try {
      const c = parseDragCurveCsv(await services.readFile(file), file.name, file.name);
      dispatch({ type: 'set-drag-curve', dragCurve: c });
      setStatus(
        `${file.name}: ${String(c.points.length)} points, Mach ${String(c.points[0]?.mach)} to ${String(c.points.at(-1)?.mach)}. Simulations now use this curve instead of the drag model.`,
      );
    } catch (e) {
      setStatus(errorText(e));
    }
  };
  const recordedApogee =
    recorded === undefined
      ? undefined
      : Math.max(...recorded.points.map((p) => p.altitude as number));

  return (
    <section className="comparison" aria-label="Comparison data">
      <h3>Recorded flight data</h3>
      <div className="field">
        <label htmlFor={unitId}>Altitude unit in the file</label>
        <div className="field-input">
          <select
            id={unitId}
            value={altUnit}
            onChange={(e) => {
              setAltUnit(e.target.value === 'ft' ? 'ft' : 'm');
            }}
          >
            <option value="m">metres</option>
            <option value="ft">feet</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={dataId}>Altimeter CSV (time, altitude)</label>
        <div className="field-input">
          <input
            id={dataId}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void importData(f);
            }}
          />
        </div>
      </div>
      {recorded === undefined ? null : (
        <p className="small">
          {recorded.label}: recorded apogee {formatQuantity(recordedApogee ?? 0, 'm', units)}
          {simulatedApogee === undefined || recordedApogee === undefined
            ? ''
            : `, simulated ${formatQuantity(simulatedApogee, 'm', units)} (${(((simulatedApogee - recordedApogee) / recordedApogee) * 100).toFixed(1)} %)`}
          .{' '}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'set-recorded-flight', recordedFlight: undefined });
            }}
          >
            Remove
          </button>
        </p>
      )}
      <h3>Imported drag curve</h3>
      <p className="muted small">
        A C_D versus Mach table (for example a RASAero II aero plot export) replaces the computed
        drag coefficient; the angle-of-attack scaling still applies and results are labelled.
      </p>
      <div className="field">
        <label htmlFor={curveId}>Drag curve CSV (Mach, C_D)</label>
        <div className="field-input">
          <input
            id={curveId}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void importCurve(f);
            }}
          />
        </div>
      </div>
      {curve === undefined ? null : (
        <p className="warning" role="status">
          Using the imported drag curve "{curve.label}" ({String(curve.points.length)} points)
          instead of the drag model.{' '}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'set-drag-curve', dragCurve: undefined });
            }}
          >
            Use the drag model again
          </button>
        </p>
      )}
      {status === undefined ? null : (
        <p className="small" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
