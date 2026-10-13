/**
 * Every warning and notice the app shows, as items for the checks column
 * (docs/ui/redesign.md section 5, D-UI-4, D-UI-5). The words come from
 * the physics and formats packages unchanged: a message is split at its
 * first ": " into what happened and why it matters, and nothing is
 * dropped, reworded or rounded again here.
 */
import { designFlightWarnings, type DesignWarning, type RocketDesign } from '@lo-fi-rocket/formats';
import { validateLaunch, type FlightResult } from '@lo-fi-rocket/physics';
import type { WarningItem, WarningSeverity } from '@lo-fi-rocket/ui';
import { formatQuantity, type UnitSystem } from '../units/display.js';

/** Severity of each flight warning code (D-UI-5). The thresholds behind them are unchanged. */
export const CODE_SEVERITY: Readonly<Record<DesignWarning['code'], WarningSeverity>> = {
  'rail-exit-velocity': 'danger',
  'deployment-velocity': 'danger',
  'no-recovery': 'danger',
  'thrust-to-weight': 'caution',
  'max-time': 'caution',
  transonic: 'limitation',
  supersonic: 'limitation',
  'model-limit': 'limitation',
  model: 'limitation',
};

/**
 * Splits a message at its first colon followed by a space: the title is
 * what happened, the reason why it matters. "4.2:1" has no space after
 * its colon, so ratios stay whole. A message without one is all title.
 * Joining title, ": " and reason gives the message back exactly.
 */
export function splitMessage(message: string): { title: string; reason: string } {
  const i = message.indexOf(': ');
  if (i < 0) return { title: message, reason: '' };
  return { title: message.slice(0, i), reason: message.slice(i + 2) };
}

function item(id: string, severity: WarningSeverity, message: string, origin: string): WarningItem {
  const { title, reason } = splitMessage(message);
  return { id, severity, title, reason, origin };
}

/** The launch rail checks of the physics (the NAR 30° limit): danger, shown at design time. */
export function launchWarningItems(design: RocketDesign): WarningItem[] {
  let messages: string[];
  try {
    messages = validateLaunch(
      { altitude: design.launch.site.altitude },
      design.launch.rail,
    ).warnings.map((w) => w.message);
  } catch (error) {
    // An invalid launch input is reported in words, never skipped.
    messages = [error instanceof Error ? error.message : String(error)];
  }
  return messages.map((m, i) => item(`launch-${String(i)}`, 'danger', m, 'Launch'));
}

/** The motor is wider than the inside of its mount tube; also shown inline in the motor step. */
export function motorFitMessage(design: RocketDesign, units: UnitSystem): string | undefined {
  const mount = design.motorMount;
  const motor = mount?.motor;
  if (mount === undefined || motor === undefined) return undefined;
  const holder = design.components.find((c) => c.id === mount.componentId);
  if (
    holder === undefined ||
    (holder.component.kind !== 'innerTube' && holder.component.kind !== 'bodyTube')
  )
    return undefined;
  const inner = 2 * (holder.component.outerRadius - holder.component.wallThickness);
  return motor.definition.diameter > inner + 1e-9
    ? `The motor is ${formatQuantity(motor.definition.diameter, 'mm', units)} wide but the mount tube's inside is ${formatQuantity(inner, 'mm', units)}: it will not fit unless the tube changes.`
    : undefined;
}

/**
 * Warnings that hold for the design before any flight: the rail angle, a
 * motor that does not fit, and a rocket with parts but no recovery device
 * (the same words the flight check uses).
 */
export function designWarningItems(design: RocketDesign, units: UnitSystem): WarningItem[] {
  const out = launchWarningItems(design);
  const fit = motorFitMessage(design, units);
  if (fit !== undefined) out.push(item('motor-fit', 'caution', fit, 'Motor'));
  if (design.components.length > 0 && design.recovery.length === 0) {
    out.push(
      item(
        'no-recovery',
        CODE_SEVERITY['no-recovery'],
        'No recovery device: the rocket falls ballistically and lands at its terminal speed.',
        'Recovery',
      ),
    );
  }
  return out;
}

/**
 * The flight's warnings against the thresholds of the design it flew, in
 * the order the formats package gives them. `withoutNoRecovery` leaves
 * out "No recovery device" when the design check already shows it with
 * the same words, so it is not listed twice.
 */
export function flightWarningItems(
  design: RocketDesign,
  result: FlightResult,
  withoutNoRecovery: boolean,
): WarningItem[] {
  return designFlightWarnings(design, result)
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => !(withoutNoRecovery && w.code === 'no-recovery'))
    .map(({ w, i }) =>
      item(`flight-${w.code}-${String(i)}`, CODE_SEVERITY[w.code], w.message, 'Flight results'),
    );
}
