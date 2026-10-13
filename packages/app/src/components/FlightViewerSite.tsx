/**
 * The launch-site picker of the 3D replay (plan 3d-0001, D-3D-2): the user
 * chooses where the flight is drawn, by a place search (OpenStreetMap
 * Nominatim), the browser's location, or typed coordinates, and which free
 * imagery source drapes the terrain. The site is for the scenery only; it
 * changes no simulation input. It is remembered in this browser.
 */
import {
  IMAGERY_SOURCES,
  validateSite,
  type ImagerySource,
  type LaunchSite,
} from '@lo-fi-rocket/viewer';
import { imagerySource, searchPlace } from '@lo-fi-rocket/viewer/dom';
import { MapPicker } from './FlightViewerMapPicker.js';
import { useId, useState, type CSSProperties, type JSX } from 'react';

// Inline layout: the app's stylesheet belongs to the ui lane.
const ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  marginTop: 6,
};

export interface SiteChoice {
  readonly site: LaunchSite | undefined;
  readonly source: ImagerySource['id'];
}

const STORAGE_KEY = 'lofi-viewer-site-v1';

/** The remembered choice, or none (illustrative scenery) when nothing valid is stored. */
export function loadSiteChoice(): SiteChoice {
  const none: SiteChoice = { site: undefined, source: 'esri' };
  try {
    // Absent in some test environments and blocked in some private windows.
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    const raw = store === undefined ? null : store.getItem(STORAGE_KEY);
    if (raw === null) return none;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return none;
    const r = v as Record<string, unknown>;
    const source = IMAGERY_SOURCES.find((x) => x.id === r['source'])?.id ?? 'esri';
    const s = r['site'];
    if (typeof s !== 'object' || s === null) return { site: undefined, source };
    const site = s as Record<string, unknown>;
    const lat = site['lat'];
    const lon = site['lon'];
    if (typeof lat !== 'number' || typeof lon !== 'number') return { site: undefined, source };
    if (validateSite({ lat, lon }) !== undefined) return { site: undefined, source };
    const label =
      typeof site['label'] === 'string' ? site['label'] : `${String(lat)}, ${String(lon)}`;
    return { site: { lat, lon, label }, source };
  } catch {
    return none;
  }
}

export function saveSiteChoice(choice: SiteChoice): void {
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify(choice),
    );
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

export function SitePicker({
  choice,
  onChange,
}: {
  readonly choice: SiteChoice;
  readonly onChange: (c: SiteChoice) => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly LaunchSite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const searchId = useId();
  const sourceId = useId();
  const latId = useId();
  const lonId = useId();

  const search = async (): Promise<void> => {
    setBusy(true);
    setMessage(undefined);
    try {
      const found = await searchPlace(query);
      setResults(found);
      if (found.length === 0) setMessage(`No place found for “${query}”.`);
    } catch (e) {
      setMessage(
        `${e instanceof Error ? e.message : String(e)} The search needs an internet connection; you can type the coordinates instead.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = (): void => {
    setMessage(undefined);
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setMessage(
        'This browser cannot report its location; search for the place or type the coordinates.',
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({
          ...choice,
          site: { lat: p.coords.latitude, lon: p.coords.longitude, label: 'My location' },
        });
      },
      (err) => {
        setMessage(`The location is not available (${err.message}).`);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const applyCoordinates = (): void => {
    const site = { lat: Number(lat), lon: Number(lon), label: `${lat}, ${lon}` };
    const invalid =
      lat.trim() === '' || lon.trim() === ''
        ? 'Enter both a latitude and a longitude.'
        : validateSite(site);
    if (invalid !== undefined) {
      setMessage(invalid);
      return;
    }
    setMessage(undefined);
    onChange({ ...choice, site });
  };

  return (
    <details
      className="viewer-site"
      style={{ marginTop: 8 }}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary style={{ cursor: 'pointer' }}>
        Launch site on the map:{' '}
        {choice.site === undefined
          ? 'none (illustrative scenery)'
          : `${choice.site.label} (${choice.site.lat.toFixed(5)}°, ${choice.site.lon.toFixed(5)}°)`}
      </summary>
      <p className="muted small">
        The site sets the scenery only (satellite imagery and terrain height); it does not change
        the simulation. Map data is free and loaded only after you choose a site; tiles are kept in
        this browser for offline use.
      </p>
      <form
        className="viewer-site-row"
        style={ROW}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label htmlFor={searchId}>Find a place</label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder="e.g. Black Rock Desert"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
        <button type="submit" disabled={busy || query.trim() === ''}>
          {busy ? 'Searching…' : 'Search'}
        </button>
        <button type="button" onClick={useMyLocation}>
          Use my location
        </button>
      </form>
      {results.length === 0 ? null : (
        <ul
          className="viewer-site-results"
          aria-label="Places found"
          style={{ listStyle: 'none', padding: 0, margin: '6px 0' }}
        >
          {results.map((r) => (
            <li key={`${String(r.lat)},${String(r.lon)}`}>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  onChange({ ...choice, site: r });
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="viewer-site-row" style={ROW}>
        <label htmlFor={latId}>Latitude (°N)</label>
        <input
          id={latId}
          inputMode="decimal"
          size={10}
          value={lat}
          onChange={(e) => {
            setLat(e.target.value);
          }}
        />
        <label htmlFor={lonId}>Longitude (°E)</label>
        <input
          id={lonId}
          inputMode="decimal"
          size={10}
          value={lon}
          onChange={(e) => {
            setLon(e.target.value);
          }}
        />
        <button type="button" onClick={applyCoordinates}>
          Set site
        </button>
        {choice.site === undefined ? null : (
          <button
            type="button"
            onClick={() => {
              onChange({ ...choice, site: undefined });
            }}
          >
            Use illustrative scenery
          </button>
        )}
      </div>
      <div className="viewer-site-row" style={ROW}>
        <label htmlFor={sourceId}>Imagery</label>
        <select
          id={sourceId}
          value={choice.source}
          onChange={(e) => {
            const id = IMAGERY_SOURCES.find((s) => s.id === e.target.value)?.id ?? 'esri';
            onChange({ ...choice, source: id });
          }}
        >
          {IMAGERY_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {/* Rendered only while open, so no tile is requested before the user looks. */}
      {open ? (
        <MapPicker
          site={choice.site}
          source={imagerySource(choice.source)}
          onPick={(site) => {
            setMessage(undefined);
            onChange({ ...choice, site });
          }}
        />
      ) : null}
      {message === undefined ? null : (
        <p className="warning" role="alert">
          {message}
        </p>
      )}
    </details>
  );
}
