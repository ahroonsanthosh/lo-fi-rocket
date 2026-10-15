/**
 * Plan 0070 step 1 (D-106): pod sets, parts repeated around the axis, in the mass properties and
 * the Barrowman stability, against OpenRocket 24.12's figures for the pod probe's rockets
 * (reference/rockets/pod-probe/values.txt): R1's airframe without its nose weight and lug, with
 * none, two or three pods (conical balsa nose 50 × 12.5 mm and a 150 mm paper tube of radius
 * 12.5 mm, wall 0.5 mm, beside the main tube's aft end, axes 75 mm from the rocket's), the second
 * case with three fins on each pod.
 */
import { describe, expect, it } from 'vitest';
import { dragCoefficient } from '../drag/drag.js';
import { OPENROCKET_REFERENCE_GRAVITY_45N } from '../flight/gravity.js';
import { simulateFlight } from '../flight/simulate.js';
import type { SimulationOptions } from '../flight/vehicle.js';
import { D12 } from '../motor/motor.test.js';
import { centreOfPressure } from '../stability/barrowman.js';
import { kilogramsPerCubicMetre, mach, metres, radians, seconds } from '../units/si.js';
import { rocketMassProperties, type PlacedComponent } from './assembly.js';
import { componentMassProperties } from './components.js';
import { R1_COMPONENTS } from './reference-rockets.js';

const BALSA = kilogramsPerCubicMetre(160);
const PAPER = kilogramsPerCubicMetre(700);
const PLY = kilogramsPerCubicMetre(600);

const AIRFRAME = R1_COMPONENTS.filter(
  (p) =>
    p.component.kind !== 'massComponent' &&
    p.component.kind !== 'launchLug' &&
    p.component.kind !== 'centeringRing',
);

function pods(count: number, fins: boolean): PlacedComponent[] {
  const instances = { count, radialOffset: metres(0.075) };
  return [
    {
      position: metres(0.4),
      instances,
      component: {
        kind: 'noseCone',
        shape: 'conical',
        length: metres(0.05),
        baseRadius: metres(0.0125),
        density: BALSA,
      },
    },
    {
      position: metres(0.45),
      instances,
      component: {
        kind: 'bodyTube',
        length: metres(0.15),
        outerRadius: metres(0.0125),
        wallThickness: metres(0.0005),
        density: PAPER,
      },
    },
    ...(fins
      ? [
          {
            position: metres(0.55),
            instances,
            component: {
              kind: 'finSet' as const,
              crossSection: 'square' as const,
              count: 3,
              rootChord: metres(0.05),
              tipChord: metres(0.03),
              sweep: metres(0.02),
              span: metres(0.03),
              thickness: metres(0.002),
              density: PLY,
              bodyRadius: metres(0.0125),
            },
          },
        ]
      : []),
  ];
}

// values.txt: structure mass (kg), CG (m), roll and pitch inertias (kg m²) about the CG, the worst
// CP (m) and C_Nα at Mach 0.3.
const OPENROCKET = [
  {
    pods: 0,
    fins: false,
    m: 0.108770726,
    cg: 0.378863919,
    ixx: 1.648291872e-4,
    iyy: 3.624895751e-3,
    cp: 0.48714873,
    cna: 17.450582104,
  },
  {
    pods: 2,
    fins: false,
    m: 0.119470467,
    cg: 0.390034409,
    ixx: 2.26351221e-4,
    iyy: 3.807647913e-3,
    cp: 0.484231998,
    cna: 18.450582104,
  },
  {
    pods: 2,
    fins: true,
    m: 0.128110467,
    cg: 0.402817929,
    ixx: 2.812727651e-4,
    iyy: 4.101737867e-3,
    cp: 0.50227679,
    cna: 23.414483926,
  },
  {
    pods: 3,
    fins: false,
    m: 0.124820338,
    cg: 0.394901493,
    ixx: 2.571122378e-4,
    iyy: 3.934420521e-3,
    cp: 0.482889067,
    cna: 18.950582104,
  },
];

const relative = (ours: number, theirs: number): number => Math.abs(ours / theirs - 1);

describe('pod sets in the mass properties and the stability (plan 0070)', () => {
  it('one pod part, by hand: n m at its CG; roll n(I_rot + m r²), pitch n(I_long + m r²/2)', () => {
    // A 150 mm paper tube, radius 12.5 mm, wall 0.5 mm: m = 700 π (0.0125² − 0.012²) 0.15
    // = 4.040874e-3 kg (OpenRocket: 0.004040874). Two at r = 0.075 m: 8.081748e-3 kg; roll
    // 2 (m (0.0125² + 0.012²)/2 + m 0.075²) = 2 (6.06635e-7 + 2.272992e-5) = 4.667311e-5 kg m².
    const tube = pods(2, false)[1];
    if (tube === undefined) throw new Error('tube');
    const one = componentMassProperties(tube.component);
    expect(one.mass).toBeCloseTo(4.040874e-3, 9);
    const two = rocketMassProperties([tube]);
    expect(two.mass).toBeCloseTo(8.081748e-3, 8);
    expect(two.cg).toBeCloseTo(0.525, 12);
    expect(two.inertiaRotational).toBeCloseTo(4.667311e-5, 10);
    // Pitch about the CG: 2 (m (3(r_o² + r_i²) + L²)/12 + m r²/2), the tube's own about its middle.
    const ownPitch = (one.mass * (3 * (0.0125 ** 2 + 0.012 ** 2) + 0.15 ** 2)) / 12;
    expect(two.inertiaLongitudinal).toBeCloseTo(2 * (ownPitch + (one.mass * 0.075 ** 2) / 2), 10);
  });

  const base = rocketMassProperties(AIRFRAME);
  const base0 = OPENROCKET[0];
  // One pod's mass (nose and tube) and the pods' axis: 1.308997e-3 + 4.040874e-3 kg at 0.075 m.
  const podMass = 0.001308997 + 0.004040874;
  for (const c of OPENROCKET) {
    it(`${String(c.pods)} pods${c.fins ? ' with fins' : ''}: OpenRocket's mass, CG, inertias, CP and C_Nα`, () => {
      const parts = [...AIRFRAME, ...(c.pods === 0 ? [] : pods(c.pods, c.fins))];
      const mp = rocketMassProperties(parts);
      const cp = centreOfPressure(parts, {
        mach: mach(0.3),
        rollAngle: 'worst',
        finRollReduction: false,
      });
      expect(relative(mp.mass, c.m)).toBeLessThan(1e-6);
      expect(relative(mp.cg, c.cg)).toBeLessThan(1e-6);
      // The CP within R1's own 0.016 % (the fin CP), the C_Nα exactly: each pod part counts once
      // per pod, its normal force independent of its distance from the axis.
      expect(relative(cp.cp, c.cp)).toBeLessThan(5e-4);
      expect(relative(cp.cnAlpha, c.cna)).toBeLessThan(1e-9);
      if (base0 === undefined || c.pods === 0) return;
      // The inertias the pods add (R1's own differ from OpenRocket's by its fin model): the roll
      // inertia exactly for plain pods (0.23 % with fins, the fins' own roll inertia).
      const roll = mp.inertiaRotational - base.inertiaRotational;
      expect(relative(roll, c.ixx - base0.ixx)).toBeLessThan(c.fins ? 3e-3 : 1e-6);
      // The pitch inertia exactly for three pods. For two, OpenRocket reports Iyy = Izz without
      // the pods' offset, where the true pitch and yaw inertias differ by 2 m r²; the one transverse
      // inertia of the axisymmetric model is their mean, n m r²/2 = 3.0093e-5 kg m² more.
      const pitch = mp.inertiaLongitudinal - base.inertiaLongitudinal;
      const offsetTerm = c.pods === 2 ? (2 * podMass * 0.075 ** 2) / 2 : 0;
      if (!c.fins) expect(relative(pitch, c.iyy - base0.iyy + offsetTerm)).toBeLessThan(1e-5);
    });
  }

  it('the drag at Mach 0.3: each pod part on its own area, the pod bases exactly as OpenRocket', () => {
    // values.txt, OpenRocket's C_D and its friction, pressure and base parts at Mach 0.3, with
    // Niskanen's base drag (eq. 3.94) as OpenRocket uses it; Reynolds number on the 0.6 m rocket at
    // sea level, 0.3 × 340.294 × 0.6/1.4607e-5.
    const cases = [
      { pods: 0, fins: false, cd: 0.781969, friction: 0.325631, pressure: 0.324638, base: 0.1317 },
      { pods: 2, fins: false, cd: 0.943524, friction: 0.397776, pressure: 0.348198, base: 0.19755 },
      { pods: 2, fins: true, cd: 1.118481, friction: 0.438244, pressure: 0.482686, base: 0.19755 },
      {
        pods: 3,
        fins: false,
        cd: 1.024302,
        friction: 0.433849,
        pressure: 0.359978,
        base: 0.230475,
      },
    ];
    for (const c of cases) {
      const r = dragCoefficient({
        components: [...AIRFRAME, ...(c.pods === 0 ? [] : pods(c.pods, c.fins))],
        mach: mach(0.3),
        reynolds: (0.3 * 340.294 * 0.6) / 1.4607e-5,
        roughnessHeight: metres(60e-6),
        baseDragMotorRule: 'while-thrusting',
        baseDragMethod: 'niskanen',
        bodyFormFactor: 'niskanen',
        finFrictionLength: 'rocket',
        liftingSurfaceFactors: 'none',
      });
      const sum = (base: boolean): number =>
        r.terms.filter((t) => (t.kind === 'base') === base).reduce((a, t) => a + t.cd, 0);
      // Each pod's base: 0.1317 on a quarter of the reference area, exactly.
      expect(sum(true)).toBeCloseTo(c.base, 6);
      // The pod noses' and fins' pressure drag within 1e-4.
      expect(Math.abs(sum(false) - c.pressure)).toBeLessThan(1e-4);
      // The friction, and so the total, within R1's own +1.4 % friction at this Reynolds number.
      expect(relative(r.skinFriction.cd, c.friction)).toBeLessThan(0.022);
      expect(relative(r.cd0, c.cd)).toBeLessThan(0.007);
    }
  });

  it('the flights on an Estes D12-5: apogee within 5 % and maximum velocity within 3 % (CLAUDE.md 7.4)', () => {
    // values.txt: OpenRocket's apogee and maximum velocity with the reference harness's settings,
    // no wind; the parachute (0.3 m, C_D 0.8) opens at apogee.
    const OR: SimulationOptions = {
      site: { altitude: metres(0) },
      rail: { length: metres(1.5), angleFromVertical: radians(0), azimuth: radians(0) },
      wind: { kind: 'vector', velocity: { x: 0, y: 0, z: 0 } },
      gravity: { seaLevel: OPENROCKET_REFERENCE_GRAVITY_45N, altitudeDependence: 'inverse-square' },
      aerodynamics: 'niskanen',
      finRollReduction: false,
      baseDragMotorRule: 'always',
      baseDragMethod: 'niskanen',
      bodyFormFactor: 'niskanen',
      finFrictionLength: 'rocket',
      liftingSurfaceFactors: 'none',
      largeAngleMethod: 'linear',
      integrator: { kind: 'rk4', timeStep: seconds(0.001) },
      maxTime: seconds(120),
      degreesOfFreedom: 6,
      recordInterval: seconds(0.01),
    };
    const flights = [
      { pods: 0, fins: false, apogee: 189.714, maxVelocity: 73.583 },
      { pods: 2, fins: false, apogee: 167.845, maxVelocity: 67.063 },
      { pods: 2, fins: true, apogee: 150.689, maxVelocity: 61.978 },
      { pods: 3, fins: false, apogee: 158.886, maxVelocity: 64.277 },
    ];
    for (const f of flights) {
      const r = simulateFlight(
        {
          components: [...AIRFRAME, ...(f.pods === 0 ? [] : pods(f.pods, f.fins))],
          motor: {
            kind: 'definition',
            definition: D12,
            aftEnd: metres(0.6),
            ejectionDelay: seconds(5),
          },
          recovery: [
            {
              name: 'Parachute',
              diameter: metres(0.3),
              dragCoefficient: 0.8,
              deploy: { event: 'apogee', delay: seconds(0) },
            },
          ],
          roughnessHeight: metres(60e-6),
        },
        OR,
      );
      // Apogee +1.1 to +1.7 % and maximum velocity +0.6 to +0.8 % (the pods no worse than R1's own
      // airframe); the pods' approximations listed, moderate.
      expect(r.approximations.some((a) => a.subject.startsWith('Pod set'))).toBe(f.pods > 0);
      expect(relative(r.summary.apogee, f.apogee)).toBeLessThan(0.05);
      expect(relative(r.summary.maxVelocity, f.maxVelocity)).toBeLessThan(0.03);
    }
  }, 120_000);
});
