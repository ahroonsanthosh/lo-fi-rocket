/**
 * The stability figures of the design in the form the UI library shows
 * them (docs/ui/redesign.md section 2). The level and the sentences are
 * the formats package's own assessment, passed through unchanged.
 */
import { DESIGN_MACH } from '@lo-fi-rocket/formats';
import type { Severity, StabilityIndicatorProps } from '@lo-fi-rocket/ui';
import type { Figures } from '../components/StabilityPanel.js';

export type Level = 'unstable' | 'typical' | 'overstable';

export const LEVEL_STATUS: Readonly<Record<Level, { severity: Severity; label: string }>> = {
  unstable: { severity: 'danger', label: 'Likely unstable' },
  typical: { severity: 'safe', label: 'Typical range' },
  overstable: { severity: 'caution', label: 'May be overstable' },
};

export function stabilityProps(
  figures: Figures,
  thresholds: { readonly unstableBelow: number; readonly overstableAbove: number },
): StabilityIndicatorProps {
  if (figures.error !== undefined) return { state: 'error', message: figures.error };
  const s = figures.stability;
  if (s === undefined) {
    return {
      state: 'empty',
      message:
        'Add components to see the centre of gravity, the centre of pressure and the margin.',
    };
  }
  // Plan 0064: a staged rocket's burnout is its top stage's alone (the whole stack's never flies).
  const top = figures.topStageBurnout?.configuration;
  const burnout =
    top === undefined
      ? s.noMotor
        ? undefined
        : { margin: s.result.marginBurnout, level: s.burnout.level, message: s.burnout.message }
      : top.noMotor
        ? undefined
        : { margin: top.marginSpent, level: top.spent.level, message: top.spent.message };
  return {
    state: 'ready',
    mach: DESIGN_MACH,
    thresholds,
    liftoff: { margin: s.result.marginLiftoff, level: s.liftoff.level, message: s.liftoff.message },
    burnout,
  };
}
