import {
  kilogramsPerSquareMetre,
  metres,
  seconds,
  streamerDragCoefficient,
} from '@lo-fi-rocket/physics';
import type { DeployEvent, DesignRecoveryDevice, DesignStreamer } from '@lo-fi-rocket/formats';
import { useId, type JSX } from 'react';
import { useStore } from '../state/store.js';
import { QuantityField } from './QuantityField.js';
import { StageSelect } from './StagesEditor.js';

const EVENTS: readonly { value: DeployEvent; label: string }[] = [
  { value: 'apogee', label: 'At apogee' },
  { value: 'ejection', label: 'At the motor’s ejection charge' },
  { value: 'altitude', label: 'Descending through an altitude' },
  { value: 'launch', label: 'At launch' },
  { value: 'never', label: 'Never (not used)' },
];

/** The device without one of its optional fields, of the same kind. */
function without<D extends DesignRecoveryDevice>(device: D, key: 'stage' | 'dragCoefficient'): D {
  const next: { -readonly [K in keyof D]?: D[K] } = { ...device };
  if (key === 'stage') delete next.stage;
  else delete next.dragCoefficient;
  return next as D;
}

export function RecoveryEditor({ device }: { readonly device: DesignRecoveryDevice }): JSX.Element {
  const { state, dispatch } = useStore();
  const units = state.units;
  const nameId = useId();
  const eventId = useId();
  const set = (next: DesignRecoveryDevice): void => {
    dispatch({ type: 'update-recovery', id: device.id, device: next });
  };
  return (
    <section className="editor" aria-label="Recovery device editor">
      <h2>{device.kind === 'streamer' ? 'Streamer' : 'Recovery device'}</h2>
      <div className="field">
        <label htmlFor={nameId}>Name</label>
        <div className="field-input">
          <input
            id={nameId}
            type="text"
            value={device.name}
            onChange={(e) => {
              set({ ...device, name: e.target.value });
            }}
          />
        </div>
      </div>
      <StageSelect
        label="Stage it is on (it leaves with that stage)"
        value={device.stage ?? 0}
        onChange={(stage) => {
          set(stage === 0 ? without(device, 'stage') : { ...device, stage });
        }}
      />
      {device.kind === 'streamer' ? (
        <StreamerFields device={device} set={set} />
      ) : (
        <>
          <QuantityField
            label="Canopy diameter"
            kind="mm"
            units={units}
            value={device.diameter}
            rule="positive"
            onChange={(si) => {
              set({ ...device, diameter: metres(si) });
            }}
          />
          <QuantityField
            label="Drag coefficient (canopy area)"
            kind="ratio"
            units={units}
            value={device.dragCoefficient}
            rule="positive"
            hint="0.8 is the usual value for a round parachute (Niskanen p. 67)"
            onChange={(v) => {
              set({ ...device, dragCoefficient: v });
            }}
          />
        </>
      )}
      <div className="field">
        <label htmlFor={eventId}>Deploys</label>
        <div className="field-input">
          <select
            id={eventId}
            value={device.deploy.event}
            onChange={(e) => {
              const event = e.target.value as DeployEvent;
              const deploy =
                event === 'altitude'
                  ? {
                      event,
                      delay: device.deploy.delay,
                      altitude: device.deploy.altitude ?? metres(200),
                    }
                  : { event, delay: device.deploy.delay };
              set({ ...device, deploy });
            }}
          >
            {EVENTS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {device.deploy.event === 'altitude' ? (
        <QuantityField
          label="Deployment altitude above the pad"
          kind="m"
          units={units}
          value={device.deploy.altitude ?? 0}
          rule="positive"
          onChange={(si) => {
            set({ ...device, deploy: { ...device.deploy, altitude: metres(si) } });
          }}
        />
      ) : null}
      <QuantityField
        label="Delay after the event"
        kind="time"
        units={units}
        value={device.deploy.delay}
        rule="non-negative"
        onChange={(si) => {
          set({ ...device, deploy: { ...device.deploy, delay: seconds(si) } });
        }}
      />
      <div className="editor-actions">
        <button
          type="button"
          className="danger"
          onClick={() => {
            dispatch({ type: 'remove-recovery', id: device.id });
          }}
        >
          Remove
        </button>
      </div>
    </section>
  );
}

/** Plan 0073: a streamer's strip, its material and its drag coefficient (Niskanen Appendix C). */
function StreamerFields({
  device,
  set,
}: {
  readonly device: DesignStreamer;
  readonly set: (next: DesignRecoveryDevice) => void;
}): JSX.Element {
  const { state } = useStore();
  const units = state.units;
  const autoId = useId();
  const automatic = device.dragCoefficient === undefined;
  let estimate: string;
  try {
    estimate = streamerDragCoefficient(device).toFixed(3);
  } catch {
    estimate = 'not available until the strip has a length and a width';
  }
  return (
    <>
      <QuantityField
        label="Strip length"
        kind="mm"
        units={units}
        value={device.length}
        rule="positive"
        onChange={(si) => {
          set({ ...device, length: metres(si) });
        }}
      />
      <QuantityField
        label="Strip width"
        kind="mm"
        units={units}
        value={device.width}
        rule="positive"
        onChange={(si) => {
          set({ ...device, width: metres(si) });
        }}
      />
      <QuantityField
        label="Material weight (mass per area)"
        kind="surfaceDensity"
        units={units}
        value={device.surfaceDensity}
        rule="non-negative"
        hint="Thin polyethylene film is 10 to 40 g/m², crêpe paper about 24 g/m² (Niskanen Table C.1)"
        onChange={(si) => {
          set({ ...device, surfaceDensity: kilogramsPerSquareMetre(si) });
        }}
      />
      <div className="field">
        <label htmlFor={autoId}>
          <input
            id={autoId}
            type="checkbox"
            checked={automatic}
            onChange={(e) => {
              set(
                e.target.checked
                  ? without(device, 'dragCoefficient')
                  : { ...device, dragCoefficient: streamerDragCoefficient(device) },
              );
            }}
          />{' '}
          Drag coefficient from the strip (Niskanen 2009, eq. C.6): {estimate}
        </label>
        <p className="muted">
          Measured on strips 0.2 to 1 m long and 2 to 9 cm wide; the descent speed it gives is
          within about 15 %. Untick to enter a measured figure.
        </p>
      </div>
      {automatic ? null : (
        <QuantityField
          label="Drag coefficient (strip area)"
          kind="ratio"
          units={units}
          value={device.dragCoefficient ?? 0}
          rule="positive"
          onChange={(v) => {
            set({ ...device, dragCoefficient: v });
          }}
        />
      )}
    </>
  );
}
