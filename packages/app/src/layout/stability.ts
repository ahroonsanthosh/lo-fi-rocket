/**
 * The stability figures of the design in the form the UI library shows
 * them (docs/ui/redesign.md section 2). The level and the sentences are
 * the formats package's own assessment, passed through unchanged.
 */
import { DESIGN_MACH } from '@lo-fi-rocket/formats';
import type { GaugeZone, Severity, StabilityIndicatorProps } from '@lo-fi-rocket/ui';
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

/**
 * The ends of the stability dials: 0 to twice the overstable threshold
 * (0 to 4 calibers with the default thresholds). A display choice only
 * (D-UI-7); a margin beyond either end is said in words by the gauge.
 */
export function gaugeRange(thresholds: { readonly overstableAbove: number }): {
  min: number;
  max: number;
} {
  return { min: 0, max: Math.max(2 * thresholds.overstableAbove, 1) };
}

/** The rule-of-thumb zones on the dial, the same three the stability card names. */
export function gaugeZones(thresholds: {
  readonly unstableBelow: number;
  readonly overstableAbove: number;
}): GaugeZone[] {
  const { min, max } = gaugeRange(thresholds);
  return [
    { from: min, to: thresholds.unstableBelow, severity: 'danger' },
    { from: thresholds.unstableBelow, to: thresholds.overstableAbove, severity: 'safe' },
    { from: thresholds.overstableAbove, to: max, severity: 'caution' },
  ];
}

/**
 * The Mach regimes of the model's accuracy, the same boundaries the
 * flight warnings use (designFlightWarnings in packages/formats: transonic
 * above 0.8, supersonic above 1.2, validated to 2.0; CLAUDE.md 6.3,
 * D-055, D-056). Only for display: the warnings themselves come from
 * formats.
 */
export const MACH_TRANSONIC = 0.8;
export const MACH_SUPERSONIC = 1.2;
export const MACH_VALIDATED = 2;
export const MACH_SCALE = { min: 0, max: MACH_VALIDATED } as const;
export const MACH_TICKS = [
  { at: MACH_TRANSONIC, label: 'transonic from Mach 0.8' },
  { at: MACH_SUPERSONIC, label: 'supersonic from Mach 1.2' },
] as const;
export const MACH_ZONES: GaugeZone[] = [
  { from: 0, to: MACH_TRANSONIC, severity: 'info' },
  { from: MACH_TRANSONIC, to: MACH_VALIDATED, severity: 'limitation' },
];

/** The regime of the maximum Mach number, in words, as the model-limit warnings name it. */
export function machStatus(mach: number): { severity: Severity; label: string } {
  if (mach > MACH_VALIDATED) return { severity: 'limitation', label: 'Beyond the validated range' };
  if (mach > MACH_SUPERSONIC) return { severity: 'limitation', label: 'Supersonic' };
  if (mach > MACH_TRANSONIC) return { severity: 'limitation', label: 'Transonic' };
  return { severity: 'info', label: 'Subsonic' };
}
