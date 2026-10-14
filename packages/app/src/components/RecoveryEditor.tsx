import { metres, seconds } from '@lo-fi-rocket/physics';
import type { DeployEvent, DesignRecoveryDevice } from '@lo-fi-rocket/formats';
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
      <h2>Recovery device</h2>
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
          const next: { -readonly [K in keyof DesignRecoveryDevice]: DesignRecoveryDevice[K] } = {
            ...device,
            stage,
          };
          if (stage === 0) delete next.stage;
          set(next);
        }}
      />
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
