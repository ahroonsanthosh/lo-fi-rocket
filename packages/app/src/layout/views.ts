/**
 * The views of the main screen (the dock at its foot) and which view a
 * selection belongs to. Display only: no physics.
 */
import type { RocketDesign } from '@lo-fi-rocket/formats';
import { EMPTY_STEP_PREFIX, FLIGHT_TARGET, LAUNCH_TARGET, MOTOR_TARGET } from './steps.js';

export type View = 'overview' | 'airframe' | 'motor' | 'recovery' | 'launch' | 'flight';

const VIEWS: readonly View[] = ['overview', 'airframe', 'motor', 'recovery', 'launch', 'flight'];

export function isView(s: string): s is View {
  return (VIEWS as readonly string[]).includes(s);
}

/** The title centred over the main screen, like the reference's "Vehicle overview". */
export const VIEW_TITLE: Readonly<Record<View, string>> = {
  overview: 'Vehicle overview',
  airframe: 'Airframe',
  motor: 'Motor',
  recovery: 'Recovery',
  launch: 'Launch site',
  flight: 'Flight',
};

/** The view that shows a selection, or undefined when the selection is none or unknown. */
export function viewOf(selectedId: string | undefined, design: RocketDesign): View | undefined {
  if (selectedId === undefined) return undefined;
  if (selectedId === MOTOR_TARGET) return 'motor';
  if (selectedId === FLIGHT_TARGET) return 'flight';
  if (selectedId === LAUNCH_TARGET) return 'launch';
  if (selectedId === `${EMPTY_STEP_PREFIX}recovery`) return 'recovery';
  if (selectedId.startsWith(EMPTY_STEP_PREFIX)) return 'airframe';
  if (design.recovery.some((r) => r.id === selectedId)) return 'recovery';
  if (design.components.some((c) => c.id === selectedId)) return 'airframe';
  return undefined;
}
