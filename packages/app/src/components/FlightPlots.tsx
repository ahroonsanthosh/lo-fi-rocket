import type { FlightResult } from '@lo-fi-rocket/physics';
import type { JSX } from 'react';
import { displayValue, unitFor, type UnitSystem } from '../units/display.js';
import { LinePlot } from './LinePlot.js';

export function FlightPlots({
  result,
  units,
}: {
  readonly result: FlightResult;
  readonly units: UnitSystem;
}): JSX.Element {
  const s = result.samples;
  const markers = result.events
    .filter(
      (e) =>
        e.kind === 'burnout' ||
        e.kind === 'apogee' ||
        e.kind === 'deployment' ||
        e.kind === 'rail-exit',
    )
    .map((e) => ({ x: e.time, label: e.kind }));
  const m = unitFor('m', units);
  const v = unitFor('velocity', units);
  const a = unitFor('acceleration', units);
  return (
    <div className="plots" aria-label="Flight plots">
      <LinePlot
        title="Altitude above the pad"
        xLabel="Time (s)"
        yLabel={`Altitude (${m.label})`}
        series={[
          {
            name: 'altitude',
            points: s.map((p) => [p.time, displayValue(p.altitude, 'm', units)] as const),
          },
        ]}
        markers={markers}
      />
      <LinePlot
        title="Speed and vertical speed"
        xLabel="Time (s)"
        yLabel={`Speed (${v.label})`}
        series={[
          {
            name: 'speed',
            points: s.map((p) => [p.time, displayValue(p.speed, 'velocity', units)] as const),
          },
          {
            name: 'vertical',
            points: s.map((p) => [p.time, displayValue(p.velocity.z, 'velocity', units)] as const),
          },
        ]}
        markers={markers}
      />
      <LinePlot
        title="Acceleration"
        xLabel="Time (s)"
        yLabel={`Acceleration (${a.label})`}
        series={[
          {
            name: 'acceleration',
            points: s.map(
              (p) => [p.time, displayValue(p.acceleration, 'acceleration', units)] as const,
            ),
          },
        ]}
        markers={markers}
      />
      <LinePlot
        title="Mach number and angle of attack"
        xLabel="Time (s)"
        yLabel="Mach, angle (°)"
        series={[
          { name: 'Mach', points: s.map((p) => [p.time, p.mach] as const) },
          {
            name: 'angle of attack (°)',
            points: s.map((p) => [p.time, (p.angleOfAttack * 180) / Math.PI] as const),
          },
        ]}
        markers={markers}
      />
    </div>
  );
}
