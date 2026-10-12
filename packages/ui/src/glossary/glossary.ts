/**
 * Plain-language explanations of the technical terms the app shows
 * (docs/ui/redesign.md section 4). Each entry says what the term means
 * and what a good value looks like. A "good value" is given only where
 * the project already has a figure with a source or a stated status
 * (CLAUDE.md 9 rules of thumb, a decision record, a page of Niskanen);
 * otherwise the entry says that there is no single good value, rather
 * than inventing one (CLAUDE.md rule 1).
 *
 * This is text, not physics: nothing here is used in a calculation.
 */

export interface GlossaryEntry {
  /** The label used in the app, for example "CG". */
  readonly term: string;
  /** The words the label stands for, for example "Centre of gravity". */
  readonly name: string;
  /** What it means, in one or two plain sentences. */
  readonly meaning: string;
  /** What a good value looks like, or why there is no single one. */
  readonly goodValue: string;
  /** Where the good-value guidance comes from. */
  readonly basis: string;
}

export type GlossaryKey =
  | 'cg'
  | 'cp'
  | 'stabilityMargin'
  | 'calibers'
  | 'mach'
  | 'cd'
  | 'cnAlpha'
  | 'referenceDiameter'
  | 'apogee'
  | 'railExitVelocity'
  | 'thrustToWeight'
  | 'totalImpulse'
  | 'burnTime'
  | 'ejectionDelay'
  | 'deploymentVelocity'
  | 'descentRate'
  | 'angleOfAttack'
  | 'transonic'
  | 'supersonic'
  | 'weathercocking'
  | 'monteCarlo'
  | 'standardDeviation'
  | 'containmentRadius'
  | 'turbulenceIntensity'
  | 'motorOverhang'
  | 'railAngle'
  | 'integrator'
  | 'minimumFlightMargin'
  | 'finFlutterMargin';

export const GLOSSARY: Readonly<Record<GlossaryKey, GlossaryEntry>> = {
  cg: {
    term: 'CG',
    name: 'Centre of gravity',
    meaning:
      'The balance point of the rocket, measured from the nose tip. It moves forward as the motor burns its propellant.',
    goodValue:
      'Further forward is more stable. What matters is how far it is ahead of the centre of pressure (the stability margin).',
    basis: 'Definition; see the stability margin for the rule of thumb.',
  },
  cp: {
    term: 'CP',
    name: 'Centre of pressure',
    meaning:
      'The point where the air’s sideways push on the rocket acts, measured from the nose tip. Fins move it towards the tail.',
    goodValue:
      'It should be behind the centre of gravity, so that a gust turns the nose back into the airflow.',
    basis: 'Definition (Barrowman 1967; Niskanen 2009 chapter 3).',
  },
  stabilityMargin: {
    term: 'Stability margin',
    name: 'Static stability margin',
    meaning:
      'How far the centre of pressure is behind the centre of gravity, counted in body diameters (calibers).',
    goodValue:
      'Below 1 caliber the rocket is likely unstable; 1 to 2 calibers is the typical target; well above 2 it may weathercock into the wind. These are rules of thumb, not guarantees, and you can change the thresholds.',
    basis: 'CLAUDE.md section 9 rules of thumb; thresholds editable in the launch settings.',
  },
  calibers: {
    term: 'Calibers',
    name: 'Body diameters',
    meaning:
      'A length expressed in multiples of the rocket’s reference (largest body) diameter. 1.5 calibers on a 50 mm rocket is 75 mm.',
    goodValue: 'See the stability margin.',
    basis: 'Definition.',
  },
  mach: {
    term: 'Mach',
    name: 'Mach number',
    meaning:
      'The rocket’s speed through the air divided by the speed of sound at its altitude. Mach 1 is the speed of sound.',
    goodValue:
      'Below Mach 0.8 the aerodynamic model is at its most accurate. From 0.8 to 1.2 (transonic) accuracy is lower, and above 1.2 (supersonic) it has been checked against only two wind tunnel models. The app labels results in those ranges.',
    basis: 'CLAUDE.md 6.3; wind tunnel validation D-057 (docs/reports/wind-tunnel-validation.md).',
  },
  cd: {
    term: 'C_D',
    name: 'Drag coefficient',
    meaning:
      'A number that says how much air resistance the rocket’s shape and surfaces create, independent of its size and speed. Lower means less drag and a higher flight.',
    goodValue:
      'There is no single good value: it depends on the shape, the finish and the speed. Use it to compare versions of your design. Against wind tunnel data the app over-predicts subsonic drag by 15 to 20 %.',
    basis: 'Niskanen 2009 chapter 3; validation errors from D-057.',
  },
  cnAlpha: {
    term: 'C_Nα',
    name: 'Normal force coefficient derivative',
    meaning:
      'How strongly the sideways air force grows as the rocket tilts away from its direction of travel, per radian of tilt. Fins contribute most of it.',
    goodValue:
      'No target value on its own; it is shown so that experienced users can compare with other tools. The stability margin is what to check.',
    basis: 'Barrowman 1967; Niskanen 2009 section 3.2.',
  },
  referenceDiameter: {
    term: 'Reference diameter',
    name: 'Reference diameter',
    meaning:
      'The diameter used to turn lengths into calibers and to scale the aerodynamic coefficients: the largest body diameter of the rocket.',
    goodValue: 'Not a target: it is a property of the design.',
    basis: 'Niskanen 2009 section 3.1.',
  },
  apogee: {
    term: 'Apogee',
    name: 'Apogee',
    meaning: 'The highest point of the flight, measured above the launch pad.',
    goodValue:
      'No single good value. Check it against your field’s altitude limit and your recovery plan.',
    basis: 'Definition.',
  },
  railExitVelocity: {
    term: 'Rail exit velocity',
    name: 'Speed leaving the launch rail',
    meaning:
      'How fast the rocket is moving when it leaves the rail or rod. Until then the rail keeps it pointed; after that only the fins do.',
    goodValue:
      'At least 15 m/s is commonly cited guidance; slower and the fins may not have enough airflow to keep the rocket on course. You can change this threshold.',
    basis: 'CLAUDE.md section 9 (default 15 m/s, configurable).',
  },
  thrustToWeight: {
    term: 'Thrust-to-weight',
    name: 'Thrust-to-weight ratio',
    meaning:
      'The motor’s average thrust divided by the rocket’s weight at liftoff. It says how hard the rocket accelerates off the pad.',
    goodValue:
      'At least 5:1 is commonly cited guidance; lower and the rocket leaves the pad slowly and is sensitive to wind. You can change this threshold.',
    basis: 'CLAUDE.md section 9 (default 5:1, configurable).',
  },
  totalImpulse: {
    term: 'Total impulse',
    name: 'Total impulse',
    meaning:
      'The motor’s thrust added up over its whole burn, in newton-seconds. The letter in a motor name (C, D, E…) is its impulse class.',
    goodValue: 'No single good value: more impulse flies higher and faster.',
    basis: 'Definition (RASP and RockSim motor file formats).',
  },
  burnTime: {
    term: 'Burn time',
    name: 'Burn time',
    meaning: 'How long the motor produces thrust, to the last point of its thrust curve.',
    goodValue: 'Not a target: it is a property of the motor.',
    basis: 'Definition; as computed in the motor panel.',
  },
  ejectionDelay: {
    term: 'Ejection delay',
    name: 'Ejection charge delay',
    meaning:
      'The time between the end of the motor’s burn and its ejection charge, which deploys the recovery device. A plugged motor has no charge.',
    goodValue:
      'Ideally the charge fires near apogee, when the rocket is slowest. The results show the speed at deployment: compare the deployment time with the time to apogee.',
    basis: 'Definition; the deployment speed warning of D-042.',
  },
  deploymentVelocity: {
    term: 'Deployment velocity',
    name: 'Speed at recovery deployment',
    meaning: 'How fast the rocket is moving when the parachute or streamer comes out.',
    goodValue:
      'The app warns above 20 m/s. That figure is a rule of thumb without a source: adjust it to what your recovery hardware is rated for.',
    basis: 'D-042 (rule of thumb, configurable).',
  },
  descentRate: {
    term: 'Descent rate',
    name: 'Descent rate at landing',
    meaning: 'How fast the rocket is falling when it reaches the ground.',
    goodValue:
      'No sourced figure is built in. Check it against your recovery device and your club’s guidance.',
    basis: 'No approved source gives a value.',
  },
  angleOfAttack: {
    term: 'Angle of attack',
    name: 'Angle of attack',
    meaning:
      'The angle between the direction the rocket points and the direction it is moving through the air.',
    goodValue:
      'Small is good. The aerodynamic model is for small angles; past 90° (flying backwards or tumbling) the flight stops with a notice.',
    basis: 'Niskanen 2009 chapter 3; D-046.',
  },
  transonic: {
    term: 'Transonic',
    name: 'Transonic regime',
    meaning: 'Speeds near the speed of sound, from Mach 0.8 to 1.2.',
    goodValue:
      'Results there are less accurate: against wind tunnel data the drag rise is predicted too early and the centre of pressure is within about 7 % of body length.',
    basis: 'CLAUDE.md 6.3; D-057.',
  },
  supersonic: {
    term: 'Supersonic',
    name: 'Supersonic regime',
    meaning: 'Speeds above Mach 1.2.',
    goodValue:
      'Validated against two wind tunnel models only. The centre of pressure is conservative (the margin shown is a lower bound) and thick fins’ drag is over-predicted.',
    basis: 'D-057 (docs/reports/wind-tunnel-validation.md).',
  },
  weathercocking: {
    term: 'Weathercocking',
    name: 'Weathercocking',
    meaning:
      'A very stable rocket turns into the wind as it leaves the rail, like a weathervane. It flies lower and lands further upwind.',
    goodValue: 'Shown as a note when the margin is well above 2 calibers (rule of thumb).',
    basis: 'CLAUDE.md section 9.',
  },
  monteCarlo: {
    term: 'Monte Carlo',
    name: 'Monte Carlo dispersion',
    meaning:
      'Many simulated flights, each with the wind, rail and motor varied at random by the amounts you enter, to show the spread of apogees and landing points.',
    goodValue:
      'The variations are zero until you enter them: no approved source gives typical figures. The seed makes every batch repeatable.',
    basis: 'D-051.',
  },
  standardDeviation: {
    term: 'Standard deviation',
    name: 'Standard deviation',
    meaning:
      'The typical size of a random variation. For the normal (bell-curve) variations the app uses, about two in three samples fall within one standard deviation of the mean.',
    goodValue: 'Enter what you know about your conditions; the default is zero.',
    basis: 'Definition; D-051.',
  },
  containmentRadius: {
    term: '95 % containment radius',
    name: '95 % containment radius',
    meaning:
      'The radius of the circle, centred on the average landing point, that holds 95 % of the simulated landings.',
    goodValue: 'Compare it with the size of your recovery area.',
    basis: 'D-051.',
  },
  turbulenceIntensity: {
    term: 'Turbulence intensity',
    name: 'Turbulence intensity',
    meaning:
      'How gusty the wind is: the standard deviation of the wind speed divided by its mean. 0 means steady wind.',
    goodValue: 'Niskanen quotes 0.1 to 0.2 as the top of the range for model rocket conditions.',
    basis: 'Niskanen 2009 (as cited in the launch editor, ENV-4).',
  },
  motorOverhang: {
    term: 'Overhang',
    name: 'Motor overhang',
    meaning: 'How far the motor sticks out past the aft end of its mount tube.',
    goodValue: 'Not a target: set it to match how the motor is retained.',
    basis: 'Definition.',
  },
  railAngle: {
    term: 'Rail angle',
    name: 'Launch rail angle from vertical',
    meaning: 'How far the launch rail leans away from straight up.',
    goodValue: 'The NAR safety code forbids more than 30° from vertical; the app warns above it.',
    basis: 'Niskanen 2009 p. 6, as cited in the launch validation.',
  },
  integrator: {
    term: 'Integrator',
    name: 'Numerical integrator',
    meaning:
      'The method that steps the flight forward in time. Dormand–Prince adapts its step; RK4 uses a fixed step.',
    goodValue:
      'The defaults reproduce the finest-step result within 0.001 m on the reference rockets. Change them only to check convergence.',
    basis: 'The launch editor hints (plan 0014) and the convergence study of plan 0010.',
  },
  minimumFlightMargin: {
    term: 'Minimum in-flight margin',
    name: 'Minimum stability margin during flight',
    meaning:
      'The smallest stability margin the rocket has at any moment of the powered and coasting flight, as speed and mass change.',
    goodValue:
      'The same rules of thumb as the static margin apply. Arriving from the physics work; the figure will come with its own source.',
    basis: 'Placeholder for the physics session’s feature; no figure until it lands.',
  },
  finFlutterMargin: {
    term: 'Fin flutter margin',
    name: 'Fin flutter margin',
    meaning:
      'How far the rocket’s top speed is below the speed at which the fins could start to vibrate and fail.',
    goodValue:
      'Arriving from the physics work; the threshold will come with its source. Until then the app shows nothing for it.',
    basis: 'Placeholder for the physics session’s feature; no figure until it lands.',
  },
};
