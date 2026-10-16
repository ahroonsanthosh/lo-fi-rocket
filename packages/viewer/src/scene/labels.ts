/**
 * Label merging (issue #29): labels whose anchors land within a box of
 * `dx` × `dy` pixels of an earlier kept label on screen are folded into it,
 * so stacked labels at the pad read as one ("Launch 0.000 s · Liftoff
 * 0.036 s"). Earlier labels win; the caller orders them by priority.
 */

/** Screen position of a label's anchor, pixels; undefined when it is behind the camera. */
export type ScreenPoint = { readonly x: number; readonly y: number } | undefined;

/**
 * For each label, the index of the label it is shown in: its own index when
 * kept, an earlier kept label's when merged, -1 when it is off screen.
 */
export function mergeLabels(points: readonly ScreenPoint[], dx: number, dy: number): number[] {
  const kept: number[] = [];
  return points.map((p, i) => {
    if (p === undefined) return -1;
    const into = kept.find((k) => {
      const q = points[k];
      return q !== undefined && Math.abs(q.x - p.x) < dx && Math.abs(q.y - p.y) < dy;
    });
    if (into !== undefined) return into;
    kept.push(i);
    return i;
  });
}

/**
 * Whether a label is shown at replay time t: an event's label from the
 * event's time on (so the pad does not carry the landing's label from the
 * first frame), every other label always. 1e-9 s allows the stored event
 * steps' float64 time sum (D-071).
 */
export function labelShown(from: number | undefined, t: number): boolean {
  return from === undefined || t >= from - 1e-9;
}
