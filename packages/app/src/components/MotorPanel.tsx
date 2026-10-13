import {
  motorFromEng,
  motorFromRse,
  parseEng,
  parseRse,
  parseThrustCurveCsv,
  putCachedMotor,
  searchMotors,
  getThrustCurveMotor,
  type MotorSelection,
  type MotorSummary,
} from '@lo-fi-rocket/formats';
import {
  kilograms,
  metres,
  seconds,
  type MotorDefinition,
  type Seconds,
} from '@lo-fi-rocket/physics';
import { useId, useMemo, useState, type JSX } from 'react';
import {
  bundledMotors,
  motorFigures,
  provenanceLabel,
  storedMotors,
  type LibraryMotor,
} from '../motors/library.js';
import { useServices } from '../state/services.js';
import { motorFitMessage } from '../layout/warnings.js';
import { useStore } from '../state/store.js';
import { formatQuantity, parseQuantity } from '../units/display.js';
import { LinePlot } from './LinePlot.js';
import { QuantityField } from './QuantityField.js';

export const MOTOR_SELECTION_ID = 'motor';

type Tab = 'library' | 'thrustcurve' | 'file' | 'csv';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The motor mount, the selected motor and the picker (plan 0013). */
export function MotorPanel(): JSX.Element {
  const { state, dispatch } = useStore();
  const services = useServices();
  const units = state.units;
  const design = state.design;
  const mount = design.motorMount;
  const tubes = design.components.filter(
    (c) => c.component.kind === 'innerTube' || c.component.kind === 'bodyTube',
  );
  const mountId = useId();
  const delayId = useId();
  const [libraryVersion, setLibraryVersion] = useState(0);
  const library = useMemo(() => {
    const stored =
      services.motorStore === undefined
        ? { motors: [], problems: [] }
        : storedMotors(services.motorStore);
    return { motors: [...bundledMotors(), ...stored.motors], problems: stored.problems };
    // libraryVersion forces a re-read after an import or download.
  }, [services.motorStore, libraryVersion]);

  const holder =
    mount === undefined ? undefined : design.components.find((c) => c.id === mount.componentId);
  const innerDiameter =
    holder !== undefined &&
    (holder.component.kind === 'innerTube' || holder.component.kind === 'bodyTube')
      ? 2 * (holder.component.outerRadius - holder.component.wallThickness)
      : undefined;
  const motor = mount?.motor;

  const setMount = (patch: Partial<NonNullable<typeof mount>>): void => {
    const base = mount ?? { componentId: tubes[0]?.id ?? '', overhang: metres(0) };
    dispatch({ type: 'set-motor-mount', mount: { ...base, ...patch } });
  };
  const useMotor = (m: LibraryMotor): void => {
    const delay = m.delays === 'plugged' || m.delays === undefined ? undefined : m.delays[0];
    const selection: MotorSelection = {
      definition: m.definition,
      provenance: m.provenance,
      ...(delay === undefined ? {} : { ejectionDelay: delay }),
    };
    setMount({ motor: selection });
  };

  if (tubes.length === 0) {
    return (
      <section className="editor" aria-label="Motor">
        <h2>Motor</h2>
        <p className="muted">Add a body tube or an inner tube first: the motor sits in a tube.</p>
      </section>
    );
  }

  const libraryMatch =
    motor === undefined ? undefined : library.motors.find((m) => sameProvenance(m, motor));
  const delays = libraryMatch?.delays;
  // Also listed in the checks column (docs/ui/redesign.md section 5).
  const diameterWarning = motorFitMessage(design, units);

  return (
    <section className="editor" aria-label="Motor">
      <h2>Motor</h2>
      <div className="field">
        <label htmlFor={mountId}>Motor mount tube</label>
        <div className="field-input">
          <select
            id={mountId}
            value={mount?.componentId ?? ''}
            onChange={(e) => {
              setMount({ componentId: e.target.value });
            }}
          >
            {mount === undefined ? <option value="">Choose a tube…</option> : null}
            {tubes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mount === undefined ? null : (
        <QuantityField
          label="Motor overhang past the tube's aft end"
          kind="mm"
          units={units}
          value={mount.overhang}
          rule="any"
          onChange={(si) => {
            setMount({ overhang: metres(si) });
          }}
        />
      )}
      {motor === undefined ? (
        <p className="muted">No motor selected. Pick one below.</p>
      ) : (
        <SelectedMotor motor={motor} units={units} />
      )}
      {diameterWarning === undefined ? null : (
        <p className="warning" role="alert">
          {diameterWarning}
        </p>
      )}
      {motor === undefined ? null : (
        <div className="field">
          <label htmlFor={delayId}>Ejection delay after burnout</label>
          <div className="field-input">
            {delays === undefined ? (
              <DelayEntry
                value={motor.ejectionDelay}
                onChange={(d) => {
                  setMount({ motor: withDelay(motor, d) });
                }}
              />
            ) : (
              <select
                id={delayId}
                value={motor.ejectionDelay === undefined ? 'plugged' : String(motor.ejectionDelay)}
                onChange={(e) => {
                  const v = e.target.value;
                  setMount({
                    motor: withDelay(motor, v === 'plugged' ? undefined : seconds(Number(v))),
                  });
                }}
              >
                {delays === 'plugged'
                  ? null
                  : delays.map((d) => (
                      <option key={String(d)} value={String(d)}>
                        {String(d)} s
                      </option>
                    ))}
                <option value="plugged">Plugged (no ejection charge)</option>
              </select>
            )}
            <span className="field-unit">s</span>
          </div>
        </div>
      )}
      <MotorPicker
        library={library.motors}
        problems={library.problems}
        innerDiameter={innerDiameter}
        onUse={useMotor}
        onLibraryChanged={() => {
          setLibraryVersion((v) => v + 1);
        }}
      />
    </section>
  );
}

function sameProvenance(m: LibraryMotor, sel: MotorSelection): boolean {
  return JSON.stringify(m.provenance) === JSON.stringify(sel.provenance);
}

function withDelay(motor: MotorSelection, delay: Seconds | undefined): MotorSelection {
  const rest: MotorSelection = { definition: motor.definition, provenance: motor.provenance };
  return delay === undefined ? rest : { ...rest, ejectionDelay: delay };
}

function DelayEntry({
  value,
  onChange,
}: {
  readonly value: Seconds | undefined;
  readonly onChange: (d: Seconds | undefined) => void;
}): JSX.Element {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Ejection delay in seconds, empty for a plugged motor"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim();
        if (t === '') onChange(undefined);
        else {
          const n = Number(t);
          if (Number.isFinite(n) && n >= 0) onChange(seconds(n));
        }
      }}
    />
  );
}

function SelectedMotor({
  motor,
  units,
}: {
  readonly motor: MotorSelection;
  readonly units: 'metric' | 'imperial';
}): JSX.Element {
  const def = motor.definition;
  const f = motorFigures(def);
  return (
    <div className="motor-summary">
      <p className="banner-main">
        <strong>
          {def.manufacturer} {def.designation}
        </strong>{' '}
        <span className="muted small">{provenanceLabel(motor.provenance)}</span>
      </p>
      <dl className="figures">
        <div>
          <dt>Diameter × length</dt>
          <dd>
            {formatQuantity(def.diameter, 'mm', units)} × {formatQuantity(def.length, 'mm', units)}
          </dd>
        </div>
        <div>
          <dt>Total impulse</dt>
          <dd>{f.totalImpulse.toFixed(2)} N·s</dd>
        </div>
        <div>
          <dt>Burn time (to the last data point)</dt>
          <dd>{f.burnTime.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Average thrust (impulse / burn time)</dt>
          <dd>{formatQuantity(f.averageThrust, 'force', units)}</dd>
        </div>
        <div>
          <dt>Peak thrust</dt>
          <dd>{formatQuantity(f.maxThrust, 'force', units)}</dd>
        </div>
        <div>
          <dt>Loaded / propellant mass</dt>
          <dd>
            {formatQuantity(def.totalMass, 'g', units)} /{' '}
            {formatQuantity(def.propellantMass, 'g', units)}
          </dd>
        </div>
        <div>
          <dt>Mass rule</dt>
          <dd>{def.massRule}</dd>
        </div>
      </dl>
      <LinePlot
        title={`Thrust curve, ${def.designation}`}
        xLabel="Time (s)"
        yLabel="Thrust (N)"
        height={220}
        series={[
          { name: def.designation, points: def.points.map((p) => [p.time, p.thrust] as const) },
        ]}
      />
    </div>
  );
}

interface PickerProps {
  readonly library: readonly LibraryMotor[];
  readonly problems: readonly string[];
  readonly innerDiameter: number | undefined;
  readonly onUse: (m: LibraryMotor) => void;
  readonly onLibraryChanged: () => void;
}

export function MotorPicker(props: PickerProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('library');
  const tabs: readonly { id: Tab; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'thrustcurve', label: 'ThrustCurve.org' },
    { id: 'file', label: 'Import .eng / .rse' },
    { id: 'csv', label: 'Custom CSV' },
  ];
  return (
    <div className="picker">
      <div role="tablist" aria-label="Motor sources" className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'library' ? <LibraryTab {...props} /> : null}
        {tab === 'thrustcurve' ? <ThrustCurveTab {...props} /> : null}
        {tab === 'file' ? <FileTab {...props} /> : null}
        {tab === 'csv' ? <CsvTab {...props} /> : null}
      </div>
    </div>
  );
}

function LibraryTab({ library, problems, innerDiameter, onUse }: PickerProps): JSX.Element {
  const { state } = useStore();
  const [fitOnly, setFitOnly] = useState(true);
  const id = useId();
  const shown = library.filter(
    (m) => !fitOnly || innerDiameter === undefined || m.definition.diameter <= innerDiameter + 1e-9,
  );
  return (
    <div>
      <div className="field field-check">
        <input
          id={id}
          type="checkbox"
          checked={fitOnly}
          onChange={(e) => {
            setFitOnly(e.target.checked);
          }}
        />
        <label htmlFor={id}>Only motors that fit the mount tube</label>
      </div>
      {problems.map((p) => (
        <p key={p} className="warning">
          A stored motor could not be read and was left in place: {p}
        </p>
      ))}
      <ul className="motor-list" aria-label="Motor library">
        {shown.map((m) => {
          const f = motorFigures(m.definition);
          return (
            <li key={JSON.stringify(m.provenance)}>
              <span>
                <strong>
                  {m.definition.manufacturer} {m.definition.designation}
                </strong>{' '}
                <span className="muted small">
                  {formatQuantity(m.definition.diameter, 'mm', state.units)},{' '}
                  {f.totalImpulse.toFixed(1)} N·s, {provenanceLabel(m.provenance)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onUse(m);
                }}
                aria-label={`Use ${m.definition.manufacturer} ${m.definition.designation}`}
              >
                Use
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? (
        <p className="muted">No motor in the library fits; untick the filter or import one.</p>
      ) : null}
    </div>
  );
}

function ThrustCurveTab({ innerDiameter, onUse, onLibraryChanged }: PickerProps): JSX.Element {
  const services = useServices();
  const { state } = useStore();
  const [diameter, setDiameter] = useState(
    innerDiameter === undefined ? '' : String(Math.floor(innerDiameter * 1000)),
  );
  const [impulseClass, setImpulseClass] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [results, setResults] = useState<readonly MotorSummary[] | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const dId = useId();
  const cId = useId();
  const mId = useId();

  const search = async (): Promise<void> => {
    setBusy(true);
    setStatus(undefined);
    try {
      const request = {
        ...(diameter.trim() === '' ? {} : { diameter: Number(diameter) }),
        ...(impulseClass.trim() === '' ? {} : { impulseClass: impulseClass.trim().toUpperCase() }),
        ...(manufacturer.trim() === '' ? {} : { manufacturer: manufacturer.trim() }),
        hasDataFiles: true,
        maxResults: 50,
      };
      const r = await searchMotors(services.transport, request);
      setResults(r.results);
      setStatus(`${String(r.matches)} motor${r.matches === 1 ? '' : 's'} found`);
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const download = async (m: MotorSummary): Promise<void> => {
    if (services.motorStore === undefined) {
      setStatus(
        'Local storage is unavailable, so downloaded motors cannot be kept for offline use.',
      );
      return;
    }
    setBusy(true);
    try {
      const { motor, fromCache } = await getThrustCurveMotor(
        services.motorStore,
        services.transport,
        m.motorId,
      );
      onLibraryChanged();
      onUse({
        definition: motor.definition,
        provenance: motor.provenance,
        delays: motor.fileText === undefined ? undefined : parseEng(motor.fileText)[0]?.delays,
        fileText: motor.fileText,
        infoUrl: motor.infoUrl,
      });
      setStatus(fromCache ? 'Used the cached copy.' : 'Downloaded and added to the library.');
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="muted small">
        Searches www.thrustcurve.org. Downloaded motors are kept in the library for offline use.
      </p>
      <div className="field">
        <label htmlFor={dId}>Diameter (mm)</label>
        <div className="field-input">
          <input
            id={dId}
            type="text"
            inputMode="numeric"
            value={diameter}
            onChange={(e) => {
              setDiameter(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={cId}>Impulse class (letter)</label>
        <div className="field-input">
          <input
            id={cId}
            type="text"
            value={impulseClass}
            onChange={(e) => {
              setImpulseClass(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={mId}>Manufacturer</label>
        <div className="field-input">
          <input
            id={mId}
            type="text"
            value={manufacturer}
            onChange={(e) => {
              setManufacturer(e.target.value);
            }}
          />
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void search();
        }}
      >
        Search ThrustCurve.org
      </button>
      {status === undefined ? null : (
        <p className="small" role="status">
          {status}
        </p>
      )}
      {results === undefined ? null : (
        <ul className="motor-list" aria-label="Search results">
          {results.map((m) => (
            <li key={m.motorId}>
              <span>
                <strong>
                  {m.manufacturerAbbrev} {m.commonName}
                </strong>{' '}
                <span className="muted small">
                  class {m.impulseClass}, {formatQuantity(m.diameter, 'mm', state.units)},{' '}
                  {m.totImpulseNs.toFixed(1)} N·s, {m.avgThrustN.toFixed(1)} N average (ThrustCurve
                  figures), {m.dataFiles} data file{m.dataFiles === 1 ? '' : 's'}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`Download and use ${m.manufacturerAbbrev} ${m.commonName}`}
                onClick={() => {
                  void download(m);
                }}
              >
                Download and use
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileTab({ onUse, onLibraryChanged }: PickerProps): JSX.Element {
  const services = useServices();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const id = useId();
  const importFile = async (file: File): Promise<void> => {
    // A new import starts with no message, so the previous file's message cannot stand in for this one's.
    setStatus(undefined);
    try {
      const text = await services.readFile(file);
      const lower = file.name.toLowerCase();
      let definition: MotorDefinition;
      let delays: LibraryMotor['delays'];
      if (lower.endsWith('.eng')) {
        const motors = parseEng(text, file.name);
        const first = motors[0];
        if (first === undefined) throw new Error(`${file.name}: no motor found`);
        definition = motorFromEng(first);
        delays = first.delays;
        if (motors.length > 1)
          setStatus(
            `${file.name} holds ${String(motors.length)} motors; the first (${first.designation}) was used.`,
          );
      } else if (lower.endsWith('.rse')) {
        const motors = parseRse(text, {}, file.name);
        const first = motors[0];
        if (first === undefined) throw new Error(`${file.name}: no motor found`);
        definition = motorFromRse(first, file.name);
        delays = first.delays;
      } else {
        throw new Error(`${file.name}: choose a .eng (RASP) or .rse (RockSim) file`);
      }
      const entry = {
        definition,
        provenance: { kind: 'file' as const, fileName: file.name },
        fileText: text,
        savedAt: new Date().toISOString(),
        infoUrl: undefined,
      };
      if (services.motorStore !== undefined) {
        putCachedMotor(services.motorStore, entry);
        onLibraryChanged();
      }
      onUse({
        definition,
        provenance: entry.provenance,
        delays,
        fileText: text,
        infoUrl: undefined,
      });
      setStatus(
        (s) =>
          s ??
          `${file.name}: ${definition.manufacturer} ${definition.designation} imported and selected.`,
      );
    } catch (e) {
      setStatus(errorText(e));
    }
  };
  return (
    <div>
      <div className="field">
        <label htmlFor={id}>RASP .eng or RockSim .rse file</label>
        <div className="field-input">
          <input
            id={id}
            type="file"
            accept=".eng,.rse"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void importFile(f);
            }}
          />
        </div>
      </div>
      {status === undefined ? null : (
        <p className="small" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

function CsvTab({ onUse, onLibraryChanged }: PickerProps): JSX.Element {
  const services = useServices();
  const { state } = useStore();
  const units = state.units;
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [designation, setDesignation] = useState('Custom');
  const [manufacturer, setManufacturer] = useState('Workshop');
  const [diameter, setDiameter] = useState(metres(0.029));
  const [length, setLength] = useState(metres(0.1));
  const [totalMass, setTotalMass] = useState(kilograms(0.1));
  const [propellantMass, setPropellantMass] = useState(kilograms(0.04));
  const nameId = useId();
  const mId = useId();
  const fileId = useId();
  const importCsv = async (file: File): Promise<void> => {
    try {
      const text = await services.readFile(file);
      const definition = parseThrustCurveCsv(
        text,
        { designation, manufacturer, diameter, length, totalMass, propellantMass },
        file.name,
      );
      const entry = {
        definition,
        provenance: { kind: 'custom' as const },
        fileText: text,
        savedAt: new Date().toISOString(),
        infoUrl: undefined,
      };
      if (services.motorStore !== undefined) {
        putCachedMotor(services.motorStore, entry);
        onLibraryChanged();
      }
      onUse({
        definition,
        provenance: entry.provenance,
        delays: undefined,
        fileText: text,
        infoUrl: undefined,
      });
      setStatus(
        `${file.name}: custom motor ${designation} created and selected (${definition.massRule}).`,
      );
    } catch (e) {
      setStatus(errorText(e));
    }
  };
  return (
    <div>
      <p className="muted small">
        Columns: time (s), thrust (N) and optionally propellant remaining (kg). The curve must start
        at 0 s and end at 0 N. Without a mass column the propellant burns in proportion to the
        impulse delivered (as RASP motors).
      </p>
      <div className="field">
        <label htmlFor={nameId}>Designation</label>
        <div className="field-input">
          <input
            id={nameId}
            type="text"
            value={designation}
            onChange={(e) => {
              setDesignation(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={mId}>Manufacturer</label>
        <div className="field-input">
          <input
            id={mId}
            type="text"
            value={manufacturer}
            onChange={(e) => {
              setManufacturer(e.target.value);
            }}
          />
        </div>
      </div>
      <QuantityField
        label="Motor diameter"
        kind="mm"
        units={units}
        value={diameter}
        rule="positive"
        onChange={(si) => {
          setDiameter(metres(si));
        }}
      />
      <QuantityField
        label="Motor length"
        kind="mm"
        units={units}
        value={length}
        rule="positive"
        onChange={(si) => {
          setLength(metres(si));
        }}
      />
      <QuantityField
        label="Loaded mass"
        kind="g"
        units={units}
        value={totalMass}
        rule="positive"
        onChange={(si) => {
          setTotalMass(kilograms(si));
        }}
      />
      <QuantityField
        label="Propellant mass"
        kind="g"
        units={units}
        value={propellantMass}
        rule="positive"
        onChange={(si) => {
          setPropellantMass(kilograms(si));
        }}
      />
      <div className="field">
        <label htmlFor={fileId}>Thrust curve CSV</label>
        <div className="field-input">
          <input
            id={fileId}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f !== undefined) void importCsv(f);
            }}
          />
        </div>
      </div>
      {status === undefined ? null : (
        <p className="small" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

// parseQuantity is re-exported for the search form's unit-aware entries in a later step.
export { parseQuantity };
