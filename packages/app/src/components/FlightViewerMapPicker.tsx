/**
 * A small slippy map for choosing the launch site by clicking (plan
 * 3d-0001, D-3D-2). No map library: the free tiles of the chosen imagery
 * source are laid out as images from the Web Mercator tile arithmetic of
 * the viewer package. Drag to pan, the wheel or the buttons to zoom,
 * click to place the pad. Keyboard: the arrow keys pan, + and − zoom, and
 * Enter places the pad at the centre cross.
 */
import {
  lonLatOfPixel,
  TILE_SIZE,
  worldPixel,
  type ImagerySource,
  type LaunchSite,
  type LonLat,
} from '@lo-fi-rocket/viewer';
import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';

const HEIGHT = 300;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
/** A press that moves less than this is a click, not a drag (pixels). */
const CLICK_SLOP = 4;

const FRAME: CSSProperties = {
  position: 'relative',
  height: HEIGHT,
  marginTop: 8,
  overflow: 'hidden',
  borderRadius: 6,
  border: '1px solid rgba(0,0,0,0.25)',
  background: '#aac6dc',
  cursor: 'crosshair',
  touchAction: 'none',
  userSelect: 'none',
};
const BUTTONS: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  zIndex: 2,
};
const NOTE: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2,
  padding: '1px 6px',
  background: 'rgba(255,255,255,0.75)',
  color: '#222',
  font: '10px/1.35 system-ui, sans-serif',
};

function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}

function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function MapPicker({
  site,
  source,
  onPick,
}: {
  readonly site: LaunchSite | undefined;
  readonly source: ImagerySource;
  readonly onPick: (site: LaunchSite) => void;
}): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [center, setCenter] = useState<LonLat>(() =>
    site === undefined ? { lon: 0, lat: 25 } : { lon: site.lon, lat: site.lat },
  );
  const [zoom, setZoom] = useState(site === undefined ? MIN_ZOOM : 14);
  const drag = useRef<{ x: number; y: number; moved: boolean; start: LonLat } | undefined>(
    undefined,
  );

  useEffect(() => {
    const el = frameRef.current;
    if (el === null) return;
    const measure = (): void => {
      setWidth(Math.max(200, el.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const c = worldPixel(center, zoom);
  const left = c.x - width / 2;
  const top = c.y - HEIGHT / 2;
  const n = 2 ** zoom;

  const tiles: JSX.Element[] = [];
  for (let j = Math.floor(top / TILE_SIZE); j <= Math.floor((top + HEIGHT) / TILE_SIZE); j++) {
    if (j < 0 || j >= n) continue;
    for (let i = Math.floor(left / TILE_SIZE); i <= Math.floor((left + width) / TILE_SIZE); i++) {
      const x = ((i % n) + n) % n;
      tiles.push(
        <img
          key={`${String(zoom)}/${String(i)}/${String(j)}`}
          src={source.url(zoom, x, j)}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          style={{
            position: 'absolute',
            left: i * TILE_SIZE - left,
            top: j * TILE_SIZE - top,
            width: TILE_SIZE,
            height: TILE_SIZE,
          }}
        />,
      );
    }
  }

  const pointAt = (clientX: number, clientY: number): LonLat => {
    const r = frameRef.current?.getBoundingClientRect();
    const px = left + clientX - (r?.left ?? 0);
    const py = top + clientY - (r?.top ?? 0);
    const p = lonLatOfPixel(px, py, zoom);
    return { lon: wrapLon(p.lon), lat: clampLat(p.lat) };
  };

  const pick = (p: LonLat): void => {
    const s: LaunchSite = {
      lat: p.lat,
      lon: p.lon,
      label: `Picked on the map`,
    };
    picked.current = s;
    onPick(s);
  };

  const panBy = (dx: number, dy: number): void => {
    const p = lonLatOfPixel(c.x + dx, c.y + dy, zoom);
    setCenter({ lon: wrapLon(p.lon), lat: clampLat(p.lat) });
  };

  const zoomTo = (z: number): void => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)));
  };

  // A site chosen elsewhere (search, location, coordinates) recentres the map; a click does not.
  const picked = useRef<LaunchSite | undefined>(undefined);
  useEffect(() => {
    if (site === undefined || site === picked.current) return;
    setCenter({ lon: site.lon, lat: site.lat });
    setZoom(14);
  }, [site]);

  // Wheel zoom about the centre (a native listener, so the page does not scroll).
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = frameRef.current;
    if (el === null) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const next = zoomRef.current + (e.deltaY < 0 ? 1 : -1);
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const marker = site === undefined ? undefined : worldPixel(site, zoom);

  return (
    <div>
      <div
        ref={frameRef}
        style={FRAME}
        tabIndex={0}
        role="application"
        aria-label="Map for choosing the launch site. Drag to pan, click to place the pad; arrow keys pan, plus and minus zoom, Enter places the pad at the centre."
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false, start: center };
          // Keeps the drag when the pointer leaves the map; some environments lack it (the drag
          // then ends at the edge, nothing else changes).
          if ('setPointerCapture' in e.currentTarget) {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // An inactive pointer id: nothing to capture.
            }
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d === undefined) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
          d.moved = true;
          const s = worldPixel(d.start, zoom);
          const p = lonLatOfPixel(s.x - dx, s.y - dy, zoom);
          setCenter({ lon: wrapLon(p.lon), lat: clampLat(p.lat) });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = undefined;
          if (d !== undefined && !d.moved) pick(pointAt(e.clientX, e.clientY));
        }}
        onKeyDown={(e) => {
          const step = 100;
          const keys: Record<string, () => void> = {
            ArrowLeft: () => {
              panBy(-step, 0);
            },
            ArrowRight: () => {
              panBy(step, 0);
            },
            ArrowUp: () => {
              panBy(0, -step);
            },
            ArrowDown: () => {
              panBy(0, step);
            },
            '+': () => {
              zoomTo(zoom + 1);
            },
            '=': () => {
              zoomTo(zoom + 1);
            },
            '-': () => {
              zoomTo(zoom - 1);
            },
            Enter: () => {
              pick(center);
            },
          };
          const action = keys[e.key];
          if (action !== undefined) {
            e.preventDefault();
            action();
          }
        }}
      >
        {tiles}
        {/* Centre cross, for keyboard placement. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: width / 2 - 8,
            top: HEIGHT / 2 - 8,
            width: 16,
            height: 16,
            pointerEvents: 'none',
            background:
              'linear-gradient(#fff,#fff) center/2px 16px no-repeat, linear-gradient(#fff,#fff) center/16px 2px no-repeat',
            opacity: 0.8,
          }}
        />
        {marker === undefined ? null : (
          <div
            aria-hidden="true"
            title="Launch pad"
            style={{
              position: 'absolute',
              left: marker.x - left - 7,
              top: marker.y - top - 7,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#e3342f',
              border: '2px solid #fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          />
        )}
        <div style={BUTTONS}>
          <button
            type="button"
            aria-label="Zoom in"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={() => {
              zoomTo(zoom + 1);
            }}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={() => {
              zoomTo(zoom - 1);
            }}
          >
            −
          </button>
        </div>
        <div style={NOTE}>{source.attribution}</div>
      </div>
    </div>
  );
}
