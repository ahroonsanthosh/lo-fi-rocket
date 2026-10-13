import { useId, type JSX } from 'react';
import { componentShapes, extentOf } from './side-view-geometry.js';
import type { DesignComponent } from '@lo-fi-rocket/formats';

export interface SideViewProps {
  readonly components: readonly DesignComponent[];
  readonly selectedId: string | undefined;
  /** Metres from the nose tip; undefined when not computable. */
  readonly cg: number | undefined;
  readonly cp: number | undefined;
  readonly onSelect: (id: string) => void;
}

const WIDTH = 1000;

/** Two opposite filled quarters of a circle of radius r: the CG symbol. */
function quarters(r: number): string {
  const R = r.toFixed(2);
  return `M0 0 L${R} 0 A${R} ${R} 0 0 1 0 ${R} Z M0 0 L-${R} 0 A${R} ${R} 0 0 1 0 -${R} Z`;
}

/** The 2D side view: nose at the left, x aft to the right, CG and CP markers (plan 0012). */
export function SideView({ components, selectedId, cg, cp, onSelect }: SideViewProps): JSX.Element {
  const uid = useId().replace(/:/g, '');
  const shapes = componentShapes(components);
  const ext = extentOf(shapes);
  const body = Math.max(
    0.001,
    ...shapes
      .filter((s) => s.kind === 'bodyTube' || s.kind === 'noseCone' || s.kind === 'transition')
      .flatMap((s) => s.points.map(([, r]) => r)),
  );
  const margin = 0.06 * ext.length;
  const scale = WIDTH / (ext.length + 2 * margin);
  const halfHeight = (ext.radius + margin / 2) * scale;
  const height = 2 * halfHeight;
  const X = (x: number): number => (x + margin) * scale;
  const Y = (r: number): number => halfHeight - r * scale;
  const markerR = Math.max(6, Math.min(14, 0.02 * ext.length * scale));

  const poly = (pts: readonly (readonly [number, number])[], flip: boolean): string =>
    pts.map(([x, r]) => `${X(x).toFixed(2)},${Y(flip ? -r : r).toFixed(2)}`).join(' ');

  return (
    <svg
      className="side-view"
      viewBox={`0 0 ${String(WIDTH)} ${height.toFixed(1)}`}
      role="img"
      aria-label="Side view of the rocket with the centre of gravity and the centre of pressure"
      data-scale={scale}
      data-margin={margin}
    >
      <defs>
        {/* The same lit cylinder as the upright view, turned on its side: light from above. */}
        <linearGradient
          id={`${uid}-body`}
          gradientUnits="userSpaceOnUse"
          x1={0}
          x2={0}
          y1={Y(body)}
          y2={Y(-body)}
        >
          <stop offset="0" className="vehicle__shade-0" />
          <stop offset="0.16" className="vehicle__shade-1" />
          <stop offset="0.34" className="vehicle__shade-2" />
          <stop offset="0.42" className="vehicle__shade-3" />
          <stop offset="0.58" className="vehicle__shade-2" />
          <stop offset="0.84" className="vehicle__shade-1" />
          <stop offset="1" className="vehicle__shade-0" />
        </linearGradient>
        <linearGradient id={`${uid}-fin`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" className="vehicle__fin-0" />
          <stop offset="1" className="vehicle__fin-3" />
        </linearGradient>
      </defs>
      <line x1={0} y1={halfHeight} x2={WIDTH} y2={halfHeight} className="axis" />
      {shapes.map((s) => {
        const base = s.id.split('-')[0] ?? s.id;
        const selected = base === selectedId;
        const cls = `shape ${s.external ? 'external' : 'internal'} kind-${s.kind}${selected ? ' selected' : ''}`;
        const fill =
          s.kind === 'finSet' ? `url(#${uid}-fin)` : s.external ? `url(#${uid}-body)` : undefined;
        return (
          <g
            key={s.id}
            className={cls}
            data-component={base}
            onClick={() => {
              onSelect(base);
            }}
          >
            <polygon points={poly(s.points, false)} fill={fill} />
            {s.mirror ? <polygon points={poly(s.points, true)} fill={fill} /> : null}
          </g>
        );
      })}
      {cg === undefined ? null : (
        <g
          className="marker cg"
          data-x={cg}
          transform={`translate(${X(cg).toFixed(2)} ${halfHeight.toFixed(2)})`}
        >
          <title>Centre of gravity</title>
          <circle r={markerR} />
          <path d={quarters(markerR)} />
        </g>
      )}
      {cp === undefined ? null : (
        <g
          className="marker cp"
          data-x={cp}
          transform={`translate(${X(cp).toFixed(2)} ${halfHeight.toFixed(2)})`}
        >
          <title>Centre of pressure</title>
          <circle r={markerR} />
          <circle r={markerR / 3} className="dot" />
        </g>
      )}
    </svg>
  );
}
