/**
 * The 3D replay (plan 0034): the viewer package's scene in a canvas with
 * play, pause, speed, a time scrubber, the camera modes, the readouts of
 * the stored step nearest to the replay time (labelled with that step's
 * time), the event list, and the Monte Carlo landing points with a run
 * picker that replays a run. Every number shown is a stored simulator
 * value converted at this display boundary; nothing is computed here.
 */
import { perturbDesign, type DispersionResult, type RocketDesign } from '@lo-fi-rocket/formats';
import type { FlightResult } from '@lo-fi-rocket/physics';
import {
  buildLandingObjects,
  CAMERA_MODES,
  EVENT_LABELS,
  FlightScene,
  REPLAY_SPEEDS,
  ReplayController,
  type CameraMode,
  type Formatter,
  type Readouts,
} from '@lo-fi-rocket/viewer';
import {
  loadMapScenery,
  mountViewer,
  type MapScenery,
  type ViewerHandle,
} from '@lo-fi-rocket/viewer/dom';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react';
import {
  CURRENT_PROVENANCE,
  describeProvenance,
  sameProvenance,
  type BuildProvenance,
} from '../build/provenance.js';
import {
  checkReplay,
  replayMatches,
  type LandingPoint,
  type ReplayCheck,
} from '../simulation/replay-check.js';
import { useServices } from '../state/services.js';
import { formatQuantity, type UnitSystem } from '../units/display.js';
import { loadSiteChoice, saveSiteChoice, SitePicker, type SiteChoice } from './FlightViewerSite.js';

type MapState =
  | { readonly kind: 'off' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly map: MapScenery }
  | { readonly kind: 'error'; readonly message: string };

// Inline styles: the app's stylesheet belongs to the ui lane.
const STAGE: CSSProperties = { position: 'relative' };
const CANVAS: CSSProperties = { height: 'clamp(440px, 62vh, 720px)', background: '#c9dcec' };
const HUD: CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 2,
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(15, 20, 28, 0.62)',
  color: '#fff',
  font: '12px/1.45 system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
};
const ATTRIBUTION: CSSProperties = {
  position: 'absolute',
  left: 8,
  bottom: 6,
  zIndex: 2,
  maxWidth: '60%',
  padding: '1px 6px',
  borderRadius: 4,
  background: 'rgba(255, 255, 255, 0.75)',
  color: '#222',
  font: '10px/1.35 system-ui, sans-serif',
};

/** Terrain departures from the pad's height above this are reported (a display threshold). */
const TERRAIN_NOTE_THRESHOLD = 2;
/** A pad altitude this far from the terrain data is pointed out (a display threshold). */
const PAD_ALTITUDE_NOTE = 50;

export interface DispersionState {
  readonly design: RocketDesign;
  readonly result: DispersionResult;
  /** The app version and physics source hash the batch was run with (D-072). */
  readonly provenance: BuildProvenance;
}

export interface FlightViewerProps {
  readonly design: RocketDesign;
  readonly result: FlightResult;
  readonly units: UnitSystem;
  /** The Monte Carlo batch of the same design, when one was run. */
  readonly dispersion: DispersionState | undefined;
}

const CAMERA_LABELS: Readonly<Record<CameraMode, string>> = {
  follow: 'Follow the rocket',
  pad: 'From the pad',
  overview: 'Whole flight',
  orbit: 'Free orbit',
};

function appFormatter(units: UnitSystem): Formatter {
  return {
    format: (si, kind) =>
      kind === 'time' ? formatQuantity(si, 'time', units, 3) : formatQuantity(si, kind, units),
  };
}

interface Shown {
  readonly label: string;
  readonly design: RocketDesign;
  readonly result: FlightResult;
  /** The Monte Carlo batch a replayed run belongs to; the replay is dropped when the batch changes. */
  readonly batch?: DispersionResult;
  /** For a replayed run: the comparison with the stored run and its provenance (D-072). */
  readonly check?: ReplayCheck;
}

export function FlightViewer(outer: FlightViewerProps): JSX.Element {
  // A batch of another design (the settings changed since one of them ran) is not shown with this flight.
  const batchMatches = outer.dispersion?.design === outer.design;
  const props: FlightViewerProps = batchMatches ? outer : { ...outer, dispersion: undefined };
  const services = useServices();
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ReplayController>(new ReplayController(0));
  const sceneRef = useRef<FlightScene | undefined>(undefined);
  const handleRef = useRef<ViewerHandle | undefined>(undefined);
  const [replay, setReplay] = useState<Shown | undefined>(undefined);
  const [replayError, setReplayError] = useState<string | undefined>(undefined);
  const [replaying, setReplaying] = useState(false);
  const [camera, setCamera] = useState<CameraMode>('follow');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [readouts, setReadouts] = useState<Readouts | undefined>(undefined);
  const [webgl, setWebgl] = useState<string | undefined>(undefined);
  const [selectedRun, setSelectedRun] = useState<number | undefined>(undefined);
  const scrubberId = useId();
  const speedId = useId();
  const cameraId = useId();
  const runId = useId();
  const [siteChoice, setSiteChoice] = useState<SiteChoice>(() => loadSiteChoice());
  const [sceneVersion, setSceneVersion] = useState(0);
  const [mapState, setMapState] = useState<MapState>({ kind: 'off' });

  // The flight shown: the design's own, or a replayed Monte Carlo run of the same design.
  const shown: Shown = useMemo(() => {
    if (replay !== undefined && replay.batch === props.dispersion?.result) return replay;
    return { label: 'This flight', design: props.design, result: props.result };
  }, [replay, props.design, props.result, props.dispersion]);

  // A different result: reset the clock.
  useEffect(() => {
    const last = shown.result.samples[shown.result.samples.length - 1];
    controllerRef.current = new ReplayController(last?.time ?? 0, speed);
    setTime(0);
    setPlaying(false);
    // speed is intentionally not a dependency: changing it must not reset the clock.
  }, [shown.result]);

  // Build the scene and mount the renderer; rebuilt when the result, the design or the units change.
  useEffect(() => {
    const container = containerRef.current;
    const design = shown.design;
    const wind = design.launch.wind.profile?.[0] ?? design.launch.wind;
    const scene = new FlightScene({
      result: shown.result,
      components: design.components.map((c) => ({
        component: c.component,
        position: c.position,
        name: c.name,
      })),
      rail: design.launch.rail,
      wind: { speed: wind.speed, from: wind.from },
      format: appFormatter(props.units),
      // A streamer has no canopy to draw yet (plan 0073): diameter 0 is not drawn.
      recovery: design.recovery.map((r) => ({
        name: r.name,
        diameter: r.kind === 'streamer' ? 0 : r.diameter,
      })),
      extraGroundPoints:
        props.dispersion === undefined
          ? []
          : props.dispersion.result.runs
              .filter((r) => r.landingEast !== undefined && r.landingNorth !== undefined)
              .map((r) => ({ east: r.landingEast ?? 0, north: r.landingNorth ?? 0 })),
    });
    sceneRef.current = scene;
    scene.setTime(controllerRef.current.current.time);
    setReadouts(scene.readouts());
    if (props.dispersion !== undefined) {
      scene.setLandingObjects(
        buildLandingObjects(props.dispersion.result, scene.markerRadius, selectedRun).group,
      );
    }
    let handle: ViewerHandle | undefined;
    if (container !== null) {
      try {
        handle = mountViewer(container, scene, {
          initialCamera: camera,
          onFrame: (dt) => {
            const c = controllerRef.current;
            const before = c.current;
            const state = c.advance(dt);
            if (state !== before) {
              scene.setTime(state.time);
              setTime(state.time);
              if (!state.playing) setPlaying(false);
              setReadouts((r) => (r?.index === scene.stepIndex ? r : scene.readouts()));
            }
          },
        });
        handleRef.current = handle;
        setWebgl(undefined);
        setSceneVersion((v) => v + 1);
      } catch (error) {
        setWebgl(
          `The 3D view could not start (${error instanceof Error ? error.message : String(error)}). The readouts below still show the stored values.`,
        );
      }
    }
    return () => {
      handle?.dispose();
      handleRef.current = undefined;
      sceneRef.current = undefined;
    };
    // camera and selectedRun are applied by their own effects below.
  }, [shown, props.units, props.dispersion]);

  useEffect(() => {
    handleRef.current?.setCamera(camera);
  }, [camera]);

  // Real-world scenery for the chosen site (D-3D-2); the illustrative scenery stays until it loads.
  useEffect(() => {
    const scene = sceneRef.current;
    const site = siteChoice.site;
    if (scene === undefined || site === undefined || handleRef.current === undefined) {
      setMapState({ kind: 'off' });
      return;
    }
    const abort = new AbortController();
    setMapState({ kind: 'loading' });
    loadMapScenery(scene, site, siteChoice.source, abort.signal).then(
      (map) => {
        if (abort.signal.aborted) return;
        scene.setTerrain(map.terrain, map.visibility);
        handleRef.current?.render();
        setMapState({ kind: 'ready', map });
      },
      (error: unknown) => {
        if (abort.signal.aborted) return;
        setMapState({
          kind: 'error',
          message: `The map scenery could not be loaded, so the illustrative scenery is shown. ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    );
    return () => {
      abort.abort();
    };
  }, [sceneVersion, siteChoice]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene === undefined || props.dispersion === undefined) return;
    scene.setLandingObjects(
      buildLandingObjects(props.dispersion.result, scene.markerRadius, selectedRun).group,
    );
    handleRef.current?.render();
  }, [selectedRun, props.dispersion]);

  const seek = (t: number): void => {
    const c = controllerRef.current;
    c.seek(t);
    const scene = sceneRef.current;
    if (scene !== undefined) {
      scene.setTime(c.current.time);
      setReadouts(scene.readouts());
      handleRef.current?.render();
    }
    setTime(c.current.time);
  };

  const togglePlay = (): void => {
    const c = controllerRef.current;
    c.toggle();
    setPlaying(c.current.playing);
    setTime(c.current.time);
  };

  const replayRun = async (index: number | undefined): Promise<void> => {
    setSelectedRun(index);
    setReplayError(undefined);
    if (index === undefined || props.dispersion === undefined) {
      setReplay(undefined);
      return;
    }
    const run = props.dispersion.result.runs.find((r) => r.index === index);
    if (run === undefined) return;
    setReplaying(true);
    // The identical perturbed design flown again by the simulator (the two calls flyRun makes); deterministic.
    const perturbed = perturbDesign(props.dispersion.design, run.sampled);
    const outcome = await services.runner.run(perturbed);
    setReplaying(false);
    const stamp = props.dispersion.provenance;
    if (outcome.ok) {
      setReplay({
        label: `Monte Carlo run ${String(index + 1)}`,
        design: perturbed,
        result: outcome.result,
        batch: props.dispersion.result,
        check: checkReplay(run, stamp, outcome.result.summary, CURRENT_PROVENANCE),
      });
    } else {
      setReplay(undefined);
      setReplayError(
        sameProvenance(stamp, CURRENT_PROVENANCE)
          ? outcome.message
          : `${outcome.message} The batch was run with ${describeProvenance(stamp)}; this is ${describeProvenance(CURRENT_PROVENANCE)}, so the replay may not match the original result.`,
      );
    }
  };

  const duration = controllerRef.current.current.duration;
  const u = props.units;
  const r = readouts;
  const stepTime = r === undefined ? '' : formatQuantity(r.time, 'time', u, 3);
  const dispersion = props.dispersion;

  return (
    <section className="viewer" aria-label="3D replay">
      <h3>3D replay</h3>
      <p className="muted small">
        Every number is the simulator&apos;s stored value at the step nearest to the replay time,
        labelled with that step&apos;s time; the picture is blended between stored steps for
        smoothness only.
      </p>
      {webgl === undefined ? null : <p className="warning viewer-unavailable">{webgl}</p>}
      <div style={STAGE}>
        <div className="viewer-canvas" ref={containerRef} data-shown={shown.label} style={CANVAS} />
        {r === undefined || webgl !== undefined ? null : (
          <div className="viewer-hud" style={HUD} aria-hidden="true">
            <div>Altitude: {formatQuantity(r.sample.altitude, 'm', u)}</div>
            <div>Distance from pad: {formatQuantity(r.horizontalDistance, 'm', u)}</div>
            <div>Velocity: {formatQuantity(r.sample.speed, 'velocity', u)}</div>
            <div>
              t = {stepTime} ({r.sample.phase})
            </div>
          </div>
        )}
        {mapState.kind === 'ready' ? (
          <div className="viewer-attribution" style={ATTRIBUTION}>
            {mapState.map.attributions.join(' · ')}
          </div>
        ) : null}
      </div>
      <p className="muted small">
        The scenery, smoke, flame and parachute shapes are illustrative. The simulation assumes flat
        ground at the pad; the ground is drawn at the rocket&apos;s tail at rest, the smoke drifts
        with the ground wind input, and a canopy is drawn at its design diameter from the stored
        deployment time.
      </p>
      <SitePicker
        choice={siteChoice}
        onChange={(c) => {
          setSiteChoice(c);
          saveSiteChoice(c);
        }}
      />
      {mapState.kind === 'loading' ? (
        <p className="muted small" role="status">
          Loading the map scenery…
        </p>
      ) : null}
      {mapState.kind === 'error' ? (
        <p className="warning" role="alert">
          {mapState.message}
        </p>
      ) : null}
      {mapState.kind === 'ready' ? (
        <MapNotes map={mapState.map} padAltitude={shown.design.launch.site.altitude} units={u} />
      ) : null}
      <div className="viewer-controls">
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <label htmlFor={speedId}>Replay speed</label>
        <select
          id={speedId}
          value={String(speed)}
          onChange={(e) => {
            const s = Number(e.target.value);
            setSpeed(s);
            controllerRef.current.setSpeed(s);
          }}
        >
          {REPLAY_SPEEDS.map((s) => (
            <option key={s} value={String(s)}>
              {String(s)}×
            </option>
          ))}
        </select>
        <label htmlFor={scrubberId}>Replay time</label>
        <input
          id={scrubberId}
          type="range"
          min={0}
          max={duration}
          step={0.001}
          value={time}
          onChange={(e) => {
            seek(Number(e.target.value));
          }}
        />
        <span className="viewer-time">{formatQuantity(time, 'time', u, 3)}</span>
        <label htmlFor={cameraId}>Camera</label>
        <select
          id={cameraId}
          value={camera}
          onChange={(e) => {
            setCamera(e.target.value as CameraMode);
          }}
        >
          {CAMERA_MODES.map((m) => (
            <option key={m} value={m}>
              {CAMERA_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      {r === undefined ? null : (
        <dl className="figures viewer-readouts" aria-label="Replay readouts">
          <div>
            <dt>Shown</dt>
            <dd>{shown.label}</dd>
          </div>
          <div>
            <dt>Stored step</dt>
            <dd>
              {String(r.index + 1)} of {String(shown.result.samples.length)}, at {stepTime} (
              {r.sample.phase})
            </dd>
          </div>
          <div>
            <dt>Altitude</dt>
            <dd>{formatQuantity(r.sample.altitude, 'm', u)}</dd>
          </div>
          <div>
            <dt>Velocity</dt>
            <dd>{formatQuantity(r.sample.speed, 'velocity', u)}</dd>
          </div>
          <div>
            <dt>Mach</dt>
            <dd>{r.mach === undefined ? 'not available in this phase' : r.mach.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Angle of attack</dt>
            <dd>
              {r.angleOfAttack === undefined
                ? 'not available in this phase'
                : formatQuantity(r.angleOfAttack, 'angle', u)}
            </dd>
          </div>
          <div>
            <dt>Stability margin</dt>
            <dd>
              {r.stabilityCalibers === undefined
                ? 'not available in this phase'
                : `${r.stabilityCalibers.toFixed(2)} calibers`}
            </dd>
          </div>
        </dl>
      )}
      <ul className="viewer-events" aria-label="Replay events">
        {sceneRef.current?.markers.map((m) => (
          <li key={`${m.event.kind}-${String(m.event.time)}`}>
            <button
              type="button"
              onClick={() => {
                seek(m.time);
              }}
            >
              {EVENT_LABELS[m.event.kind]} {formatQuantity(m.time, 'time', u, 3)}
              {m.exact ? '' : ' (nearest stored step)'}
            </button>
          </li>
        ))}
      </ul>
      {outer.dispersion !== undefined && !batchMatches ? (
        <p className="muted small">
          The Monte Carlo batch was run for a different version of the design (the design or its
          settings changed between the two runs); simulate the flight and the dispersion again to
          see its landing points here.
        </p>
      ) : null}
      {dispersion === undefined ? null : (
        <div className="viewer-dispersion">
          <p className="muted small">
            Landing points of the {String(dispersion.result.runs.length)} Monte Carlo runs at their
            stored coordinates, the stored 95 % containment circle (green), and the 1σ and 2σ
            standard-deviation ellipses of the points (orange; descriptive, computed by the viewer
            from the stored points, no distribution assumed).
          </p>
          <label htmlFor={runId}>Replay run</label>
          <select
            id={runId}
            value={selectedRun === undefined ? '' : String(selectedRun)}
            disabled={replaying}
            onChange={(e) => {
              void replayRun(e.target.value === '' ? undefined : Number(e.target.value));
            }}
          >
            <option value="">This flight</option>
            {dispersion.result.runs.map((run) => (
              <option key={run.index} value={String(run.index)} disabled={run.error !== undefined}>
                Run {String(run.index + 1)}
                {run.error !== undefined
                  ? ' (failed)'
                  : run.landingDistance === undefined
                    ? ' (not landed)'
                    : `: landed ${formatQuantity(run.landingDistance, 'm', u)} from the pad`}
              </option>
            ))}
          </select>
          {replaying ? <span className="muted"> Re-simulating the run…</span> : null}
          {shown.check === undefined ? null : <ReplayCheckNotice check={shown.check} units={u} />}
          {replayError === undefined ? null : (
            <p className="warning" role="alert">
              {replayError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * What the map scenery means for the flight: the terrain height at the pad
 * against the design's pad altitude, and how far the terrain under the
 * flight departs from the flat ground the simulator assumes.
 */
function MapNotes({
  map,
  padAltitude,
  units,
}: {
  readonly map: MapScenery;
  readonly padAltitude: number;
  readonly units: UnitSystem;
}): JSX.Element {
  const dev = map.deviation;
  return (
    <div className="viewer-map-notes">
      <p className="muted small">
        Terrain at the pad: {formatQuantity(map.padElevation, 'm', units)} above sea level from the
        elevation data; the design&apos;s pad altitude is {formatQuantity(padAltitude, 'm', units)}.
        Imagery about {formatQuantity(map.imageryResolution, 'm', units)} per pixel near the pad.
        {Math.abs(map.padElevation - padAltitude) > PAD_ALTITUDE_NOTE
          ? ' The two differ: if this is where you will fly, set the pad altitude in the launch settings so the simulation uses the air density there.'
          : ''}
      </p>
      {Math.abs(dev) > TERRAIN_NOTE_THRESHOLD ? (
        <p className="warning" role="note">
          The terrain under the flight path is up to {formatQuantity(Math.abs(dev), 'm', units)}{' '}
          {dev > 0 ? 'higher' : 'lower'} than the pad. The simulation assumes flat ground at the
          pad, so the landing point and the time of landing do not account for this terrain.
        </p>
      ) : null}
    </div>
  );
}

function point(p: LandingPoint | undefined, units: UnitSystem): string {
  return p === undefined
    ? 'did not land'
    : `${formatQuantity(p.east, 'm', units)} east, ${formatQuantity(p.north, 'm', units)} north`;
}

/**
 * The outcome of the replay check (D-072): a warning naming each reason
 * when the replay may not match the stored run, otherwise a short note
 * that it reproduced the stored landing point exactly.
 */
function ReplayCheckNotice({
  check,
  units,
}: {
  readonly check: ReplayCheck;
  readonly units: UnitSystem;
}): JSX.Element {
  if (replayMatches(check)) {
    return (
      <p className="muted small replay-check-ok">
        The replay reproduces the stored landing point exactly, with the same app version and
        physics as the batch.
      </p>
    );
  }
  return (
    <div className="warning replay-mismatch" role="alert">
      <p className="banner-main">This replay may not match the original Monte Carlo result.</p>
      <ul>
        {check.provenance === undefined ? null : (
          <li>
            The batch was run with {describeProvenance(check.provenance.stored)}; this is{' '}
            {describeProvenance(check.provenance.current)}. The simulator was re-run with the
            current physics, which may differ from the one that produced the batch.
          </li>
        )}
        {check.landing === undefined ? null : (
          <li>
            The replayed landing point ({point(check.landing.replayed, units)}) differs from the
            stored one ({point(check.landing.stored, units)}). The figures of the batch are the
            stored ones; the picture shows the replay.
          </li>
        )}
      </ul>
    </div>
  );
}
