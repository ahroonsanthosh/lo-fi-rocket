import { useId, type JSX, type ReactNode } from 'react';
import type { DesignComponent } from '@lo-fi-rocket/formats';
import { componentShapes, extentOf, type Shape } from './side-view-geometry.js';

export interface VehicleViewProps {
  readonly components: readonly DesignComponent[];
  readonly selectedId: string | undefined;
  /** Metres from the nose tip; undefined when not computable. */
  readonly cg: number | undefined;
  readonly cp: number | undefined;
  /** The CG and CP positions as the user reads them, for example "387.0 mm". */
  readonly cgText: string | undefined;
  readonly cpText: string | undefined;
  readonly onSelect: (id: string) => void;
  /** Offered when there is nothing to draw yet, for example a button to add the body tube. */
  readonly emptyAction?: ReactNode;
}

/** Outside parts only: the hero shows the rocket as it stands on the pad. */
const OUTSIDE = new Set<Shape['kind']>([
  'noseCone',
  'bodyTube',
  'transition',
  'finSet',
  'launchLug',
  'railButton',
]);

/** Drawing units per metre: millimetres, so the numbers in the SVG stay readable. */
const MM = 1000;

/**
 * The rocket standing nose up, shaded like a model on a stand (the
 * centrepiece of the owner's reference design). The outline is the same
 * geometry as the side view (plan 0012, GEO-1, GEO-2), turned upright;
 * only outside parts are drawn. The CG and CP markers sit on the axis at
 * their computed positions and are labelled in words beside the body.
 * Clicking a part selects it; the parts list is the keyboard equivalent.
 */
export function VehicleView(props: VehicleViewProps): JSX.Element {
  const { components, selectedId, cg, cp, cgText, cpText, onSelect, emptyAction } = props;
  const uid = useId().replace(/:/g, '');
  const shapes = componentShapes(components).filter(
    (s) => OUTSIDE.has(s.kind) && !s.id.endsWith('-shoulder'),
  );
  if (shapes.length === 0) {
    return (
      <div className="vehicle vehicle--empty">
        <svg className="vehicle__ghost" viewBox="0 0 40 160" aria-hidden="true">
          <path d="M20 4c7 12 10 26 10 40v86H10V44c0-14 3-28 10-40z" />
          <path d="M10 112 2 128v20l8-6M30 112l8 16v20l-8-6" />
        </svg>
        <p>Add a body tube and a nose cone to see your rocket here.</p>
        {emptyAction}
      </div>
    );
  }
  const ext = extentOf(shapes);
  const body = Math.max(
    0.001,
    ...shapes
      .filter((s) => s.kind === 'bodyTube' || s.kind === 'noseCone' || s.kind === 'transition')
      .flatMap((s) => s.points.map(([, r]) => r)),
  );
  const margin = 0.04 * ext.length;
  const half = ext.radius + margin;
  const width = 2 * half * MM;
  const height = (ext.length + 2 * margin) * MM;
  const cx = half * MM;
  const Y = (x: number): number => (x + margin) * MM;
  const pts = (s: Shape, side: 1 | -1): string =>
    s.points.map(([x, r]) => `${(cx + side * r * MM).toFixed(2)},${Y(x).toFixed(2)}`).join(' ');
  const markerR = Math.max(0.35 * body * MM, 0.012 * ext.length * MM);
  const quarters = (r: number): string =>
    `M0 0 L${r.toFixed(2)} 0 A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 0 ${r.toFixed(2)} Z M0 0 L-${r.toFixed(2)} 0 A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 0 -${r.toFixed(2)} Z`;
  const pct = (x: number): string => `${((Y(x) / height) * 100).toFixed(2)}%`;
  // The labels start just outside the body tube, not outside the fins, so they stay near the rocket.
  const beside = `${(((cx - body * MM) / width) * 100).toFixed(2)}%`;
  // The fins draw first so the body covers their roots; lugs and buttons go on top.
  const order = (s: Shape): number =>
    s.kind === 'finSet' ? 0 : s.kind === 'launchLug' || s.kind === 'railButton' ? 2 : 1;
  const sorted = [...shapes].sort((a, b) => order(a) - order(b));

  return (
    <div className="vehicle">
      <div
        className="vehicle__frame"
        style={{ aspectRatio: `${width.toFixed(1)} / ${height.toFixed(1)}` }}
      >
        <svg
          className="vehicle__svg"
          viewBox={`0 0 ${width.toFixed(1)} ${height.toFixed(1)}`}
          role="img"
          aria-label="Your rocket standing nose up, with the centre of gravity and the centre of pressure"
        >
          <defs>
            <linearGradient
              id={`${uid}-body`}
              gradientUnits="userSpaceOnUse"
              x1={cx - body * MM}
              x2={cx + body * MM}
              y1={0}
              y2={0}
            >
              {/* A cylinder lit from the upper left: dark edges, a bright band left of centre. */}
              <stop offset="0" className="vehicle__shade-0" />
              <stop offset="0.16" className="vehicle__shade-1" />
              <stop offset="0.34" className="vehicle__shade-2" />
              <stop offset="0.42" className="vehicle__shade-3" />
              <stop offset="0.58" className="vehicle__shade-2" />
              <stop offset="0.84" className="vehicle__shade-1" />
              <stop offset="1" className="vehicle__shade-0" />
            </linearGradient>
            <linearGradient id={`${uid}-fin`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" className="vehicle__fin-0" />
              <stop offset="1" className="vehicle__fin-1" />
            </linearGradient>
          </defs>
          {sorted.map((s) => {
            const base = s.id.split('-')[0] ?? s.id;
            const selected = base === selectedId;
            const fill =
              s.kind === 'finSet'
                ? `url(#${uid}-fin)`
                : s.kind === 'launchLug' || s.kind === 'railButton'
                  ? undefined
                  : `url(#${uid}-body)`;
            return (
              <g
                key={s.id}
                className={`vehicle__part vehicle__part--${s.kind}${selected ? ' is-selected' : ''}`}
                data-component={base}
                onClick={() => {
                  onSelect(base);
                }}
              >
                <polygon points={pts(s, 1)} fill={fill} />
                {s.mirror ? <polygon points={pts(s, -1)} fill={fill} /> : null}
              </g>
            );
          })}
          {cg === undefined ? null : (
            <g
              className="vehicle__marker vehicle__marker--cg"
              transform={`translate(${cx.toFixed(2)} ${Y(cg).toFixed(2)})`}
            >
              <title>Centre of gravity</title>
              <circle r={markerR} />
              <path d={quarters(markerR)} />
            </g>
          )}
          {cp === undefined ? null : (
            <g
              className="vehicle__marker vehicle__marker--cp"
              transform={`translate(${cx.toFixed(2)} ${Y(cp).toFixed(2)})`}
            >
              <title>Centre of pressure</title>
              <circle r={markerR} />
              <circle r={markerR / 3} className="vehicle__dot" />
            </g>
          )}
        </svg>
        {cg === undefined || cgText === undefined ? null : (
          <p
            className="vehicle__label vehicle__label--cg"
            style={{ top: pct(cg), right: `calc(100% - ${beside} + 26px)` }}
          >
            <span className="vehicle__label-key">CG</span>
            <span>{cgText}</span>
          </p>
        )}
        {cp === undefined || cpText === undefined ? null : (
          <p
            className="vehicle__label vehicle__label--cp"
            style={{ top: pct(cp), left: `calc(100% - ${beside} + 26px)` }}
          >
            <span className="vehicle__label-key">CP</span>
            <span>{cpText}</span>
          </p>
        )}
      </div>
      <div className="vehicle__floor" aria-hidden="true" />
    </div>
  );
}
