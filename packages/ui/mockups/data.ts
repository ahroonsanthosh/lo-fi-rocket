/**
 * Mockup data, copied from what the current app displays (review
 * screenshots in docs/ui/review/ and the texts read from the running app
 * at 109d117). Nothing here is computed. Values are given in the display
 * unit, as the app will hand them to the library.
 */
import type { WarningItem } from '../src/index.js';

export const R1 = {
  name: 'Example: three-fin sport rocket (R1)',
  stability: {
    liftoff: {
      margin: 1.84,
      level: 'typical' as const,
      message:
        '1.84 calibers is in the typical target range of 1 to 2 (a rule of thumb, not a guarantee).',
    },
    burnout: {
      margin: 2.28,
      level: 'overstable' as const,
      message:
        '2.28 calibers is above 2: the rocket may be overstable and weathercock into the wind, which lowers the apogee and moves the landing point upwind.',
    },
  },
  cg: 387.0,
  cgBurnout: 364.9,
  cp: 478.9,
  referenceDiameter: 50.0,
  cnAlpha: 15.13,
  length: 600.0,
  massEmpty: 148.3,
  massLiftoff: 190.9,
  motor: 'Estes D12, delay 5 s',
  flight: {
    apogee: 167.33,
    timeToApogee: 5.83,
    maxVelocity: 62.3,
    maxMach: 0.183,
    maxAcceleration: 148.1,
    railExitVelocity: 18.5,
    railExitTime: 0.293,
    burnoutTime: 1.65,
    burnoutVelocity: 61.6,
    deploymentTime: 5.83,
    deploymentVelocity: 0.0,
    descentRate: 6.9,
    landingDistance: 0.0,
    flightTime: 30.36,
  },
  events: [
    ['0.000 s', 'ignition at t = 0'],
    ['0.036 s', 'first motion on the rail'],
    ['0.293 s', 'rail exit at 18.453 m/s after 0.2930 s'],
    ['1.650 s', 'motor burnout at 1.65 s'],
    ['5.829 s', 'apogee 167.330 m above the pad'],
    ['5.829 s', 'Parachute deployed (at apogee); C_D A = 0.0565 m²'],
    ['6.650 s', 'ejection charge at 6.650 s'],
    ['30.356 s', 'landing at 6.935 m/s, 0.00 m from the pad'],
  ] as const,
  modes:
    'Dormand–Prince RK5(4) rtol 1e-8 atol 1e-10; 6 degrees of freedom; Niskanen aerodynamics with fin roll reduction on; base drag motor rule while-thrusting; sea-level gravity 9.80665 m/s²; computed drag; steady wind; 626 samples in 96 ms. Flat, non-rotating Earth (docs/known-limitations.md).',
};

export const R5 = {
  name: 'r5-transonic-min-dia-29',
  stability: {
    liftoff: {
      margin: 2.38,
      level: 'overstable' as const,
      message:
        '2.38 calibers is above 2: the rocket may be overstable and weathercock into the wind, which lowers the apogee and moves the landing point upwind.',
    },
    burnout: {
      margin: 3.38,
      level: 'overstable' as const,
      message:
        '3.38 calibers is above 2: the rocket may be overstable and weathercock into the wind, which lowers the apogee and moves the landing point upwind.',
    },
  },
  flight: {
    apogee: 1453.26,
    timeToApogee: 13.77,
    maxVelocity: 372.5,
    maxMach: 1.097,
    maxAcceleration: 516.8,
    railExitVelocity: 36.6,
    railExitTime: 0.095,
    burnoutTime: 1.04,
    burnoutVelocity: 354.3,
    deploymentTime: 13.77,
    deploymentVelocity: 0.0,
    descentRate: 8.8,
    landingDistance: 0.0,
    flightTime: 174.48,
  },
};

/**
 * R5's warnings as the app shows them today, each split at its first
 * colon into what happened (title) and why it matters (reason), with the
 * words unchanged. Severity per docs/ui/redesign.md section 5.
 */
export const R5_WARNINGS: WarningItem[] = [
  {
    id: 'transonic',
    severity: 'limitation',
    title: 'Maximum Mach 1.10 is in the transonic regime',
    reason:
      'The drag rise is predicted too early and the centre of pressure is within about 7 % of body length of wind tunnel data.',
    detail: 'docs/reports/wind-tunnel-validation.md',
    origin: 'Flight results',
  },
  {
    id: 'model:transonic-drag',
    severity: 'limitation',
    title: 'Transonic regime (Mach 0.8 to 1.2): drag',
    reason:
      'Accuracy is lower than in subsonic flight; against wind tunnel data the drag rise is predicted too early (up to +40 % at Mach 0.9, within 10 % from Mach 1.0 to 1.2).',
    detail: 'CLAUDE.md 6.3',
    origin: 'Drag model',
  },
  {
    id: 'model:transonic-cp',
    severity: 'limitation',
    title: 'Transonic regime (Mach 0.8 to 1.2): centre of pressure',
    reason:
      'The centre of pressure is within about 7 % of body length of wind tunnel data (ARCAS), the fin force is an interpolation.',
    detail: 'BAR-12',
    origin: 'Aerodynamics',
  },
  {
    id: 'model:haack',
    severity: 'limitation',
    title: 'Haack nose: transonic and supersonic pressure drag from digitised data',
    reason:
      'From NASA TR R-100 Figure 12 (fineness ratio 3, digitised, reading uncertainty ±0.005 in C_D,N) scaled to the nose by Niskanen eq. (B.9).',
    detail: 'D-055',
    origin: 'Drag model',
  },
  {
    id: 'stability:overstable',
    severity: 'caution',
    title: 'Stability margin 2.38 calibers at liftoff is above 2',
    reason:
      'The rocket may be overstable and weathercock into the wind, which lowers the apogee and moves the landing point upwind.',
    origin: 'Stability',
  },
];

/** The starter rocket of review screenshots 08 to 11: fins too small, no parachute, C6 with a 0 s delay. */
export const STARTER = {
  stability: {
    liftoff: {
      margin: 0.21,
      level: 'unstable' as const,
      message:
        '0.21 calibers is below 1: the rocket is likely unstable, because the centre of pressure is too close to or ahead of the centre of gravity for the fins to correct a disturbance.',
    },
    burnout: {
      margin: 0.37,
      level: 'unstable' as const,
      message:
        '0.37 calibers is below 1: the rocket is likely unstable, because the centre of pressure is too close to or ahead of the centre of gravity for the fins to correct a disturbance.',
    },
  },
  warnings: [
    {
      id: 'stability:unstable',
      severity: 'danger',
      title: 'Stability margin 0.21 calibers at liftoff is below 1',
      reason:
        'The rocket is likely unstable, because the centre of pressure is too close to or ahead of the centre of gravity for the fins to correct a disturbance.',
      origin: 'Stability',
    },
    {
      id: 'no-recovery',
      severity: 'danger',
      title: 'No recovery device',
      reason: 'The rocket falls ballistically and lands at its terminal speed.',
      origin: 'Recovery',
    },
    {
      id: 'thrust-to-weight',
      severity: 'caution',
      title: 'Average thrust to liftoff weight is 4.9:1, below 5:1',
      reason: 'The rocket accelerates slowly off the pad and is sensitive to wind at rail exit.',
      origin: 'Flight results',
    },
    {
      id: 'model-limit',
      severity: 'limitation',
      title: 'The flight ended at 5.39 s, before landing',
      reason:
        'The rocket turned past 90° angle of attack (flying backwards or tumbling), which the aerodynamic model does not cover. The apogee and the ascent are valid; a recovery device deploying at apogee lets the descent be simulated.',
      detail: 'D-046',
      origin: 'Flight results',
    },
    {
      id: 'model:aoa-drag',
      severity: 'limitation',
      title: 'Angle of attack 180.0° is beyond the 90° the drag scaling covers',
      reason: 'The drag scaling was mirrored past 90°.',
      detail: 'D-033',
      origin: 'Drag model',
    },
    {
      id: 'model:normal-force-limit',
      severity: 'limitation',
      title: 'The flight ended at 5.393 s because the angle of attack reached 180.0°',
      reason:
        'The normal force model (Niskanen chapter 3, Barrowman fins as flat plates) is a model for small angles of attack and is applied only up to 90°. The rocket was flying backwards or tumbling; a recovery device deploying at apogee avoids this.',
      detail: 'D-046',
      origin: 'Aerodynamics',
    },
  ] satisfies WarningItem[],
};
