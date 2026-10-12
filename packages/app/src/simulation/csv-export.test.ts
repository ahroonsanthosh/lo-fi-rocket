import { exampleDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import { resultToCsv } from './csv-export.js';
import { runNow } from './runner.js';

describe('CSV export (plan 0014)', () => {
  it('writes a comment line with the modes, a header and one row per sample', () => {
    const outcome = runNow(exampleDesign());
    if (!outcome.ok) throw new Error(outcome.message);
    const csv = resultToCsv(outcome.result, 'R1');
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toMatch(
      /^# R1; aerodynamics niskanen; fin roll reduction true; base drag motor rule while-thrusting; integrator Dormand/,
    );
    expect(lines[1]).toBe(
      'time_s,phase,x_east_m,y_north_m,z_up_m,vx_m_s,vy_m_s,vz_m_s,altitude_m,speed_m_s,airspeed_m_s,mach,angle_of_attack_rad,acceleration_m_s2,thrust_N,aerodynamic_force_N,cd0,mass_kg,cg_m,cp_m,stability_calibers',
    );
    expect(lines.length).toBe(2 + outcome.result.samples.length);
    expect(lines[2]?.startsWith('0,on-rail,0,0,0,')).toBe(true);
  });
});
