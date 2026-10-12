/**
 * Time series to CSV (plan 0014). SI units in the header; one comment line
 * names the simulation modes so a file is never read without its context.
 */
import type { FlightResult } from '@lo-fi-rocket/physics';

const COLUMNS: readonly string[] = [
  'time_s',
  'phase',
  'x_east_m',
  'y_north_m',
  'z_up_m',
  'vx_m_s',
  'vy_m_s',
  'vz_m_s',
  'altitude_m',
  'speed_m_s',
  'airspeed_m_s',
  'mach',
  'angle_of_attack_rad',
  'acceleration_m_s2',
  'thrust_N',
  'aerodynamic_force_N',
  'cd0',
  'mass_kg',
  'cg_m',
  'cp_m',
  'stability_calibers',
];

export function resultToCsv(result: FlightResult, designName: string): string {
  const m = result.modes;
  const lines: string[] = [
    `# ${designName}; aerodynamics ${m.aerodynamics}; fin roll reduction ${String(m.finRollReduction)}; base drag motor rule ${m.baseDragMotorRule}; integrator ${m.integrator}; ${String(m.degreesOfFreedom)} degrees of freedom; sea-level gravity ${String(m.gravitySeaLevel)} m/s2; SI units; world frame east-north-up at the pad (docs/conventions.md)`,
    COLUMNS.join(','),
  ];
  const num = (v: number): string => (Number.isFinite(v) ? String(v) : '');
  for (const s of result.samples) {
    lines.push(
      [
        num(s.time),
        s.phase,
        num(s.position.x),
        num(s.position.y),
        num(s.position.z),
        num(s.velocity.x),
        num(s.velocity.y),
        num(s.velocity.z),
        num(s.altitude),
        num(s.speed),
        num(s.airspeed),
        num(s.mach),
        num(s.angleOfAttack),
        num(s.acceleration),
        num(s.thrust),
        num(s.aerodynamicForce),
        num(s.cd0),
        num(s.mass),
        num(s.cg),
        num(s.cp),
        num(s.stabilityCalibers),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
