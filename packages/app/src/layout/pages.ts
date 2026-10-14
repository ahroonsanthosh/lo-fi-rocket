/**
 * The pages of the task panel (docs/ui/simplify.md section 3) and which
 * page a selection opens. Display only: no physics.
 */
import type { RocketDesign } from '@lo-fi-rocket/formats';
import { EMPTY_STEP_PREFIX, FLIGHT_TARGET, LAUNCH_TARGET, MOTOR_TARGET } from './steps.js';

/** Selection of the stability and mass page. */
export const STABILITY_TARGET = 'stability';

export type Page =
  'home' | 'part' | 'add-part' | 'motor' | 'recovery' | 'launch' | 'flight' | 'stability';

/** The page that shows a selection; nothing selected, or a selection that no longer exists, is home. */
export function pageOf(selectedId: string | undefined, design: RocketDesign): Page {
  if (selectedId === undefined) return 'home';
  if (selectedId === MOTOR_TARGET) return 'motor';
  if (selectedId === FLIGHT_TARGET) return 'flight';
  if (selectedId === LAUNCH_TARGET) return 'launch';
  if (selectedId === STABILITY_TARGET) return 'stability';
  if (selectedId.startsWith(EMPTY_STEP_PREFIX)) return 'add-part';
  if (design.recovery.some((r) => r.id === selectedId)) return 'recovery';
  if (design.components.some((c) => c.id === selectedId)) return 'part';
  return 'home';
}
