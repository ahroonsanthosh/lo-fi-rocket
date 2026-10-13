/**
 * The vehicle overview (the owner's reference screen): a row of dials,
 * the rocket standing in the middle with two dials either side, and two
 * small tables of the motor and the airframe. Every figure is the
 * physics' own; the dials only picture it on a stated scale (D-UI-7).
 */
import { designThrustToWeight, type RocketDesign } from '@lo-fi-rocket/formats';
import { PhysicsError } from '@lo-fi-rocket/physics';
import { Button, FIGURE_DISPLAY, Gauge, SeverityTag, type Severity } from '@lo-fi-rocket/ui';
import type { JSX, ReactNode } from 'react';
import type { FlightState } from '../components/FlightPanel.js';
import type { Figures } from '../components/StabilityPanel.js';
import { VehicleView } from '../components/VehicleView.js';
import { motorFigures } from '../motors/library.js';
import { formatQuantity, unitFor, type UnitSystem } from '../units/display.js';
import { railExitStatus } from './panels.js';
import {
  gaugeRange,
  gaugeZones,
  LEVEL_STATUS,
  machStatus,
  MACH_SCALE,
  MACH_ZONES,
} from './stability.js';

export interface OverviewProps {
  readonly figures: Figures;
  readonly design: RocketDesign;
  readonly units: UnitSystem;
  readonly flight: FlightState | undefined;
  readonly stale: boolean;
  readonly selectedId: string | undefined;
  readonly onSelect: (id: string) => void;
  /** Opens the first step of the guide; offered when the design has nothing to draw. */
  readonly onStart: () => void;
}

/** Thrust to weight for the dial, or the reason it has none. */
function thrustToWeight(design: RocketDesign): number | undefined {
  try {
    return designThrustToWeight(design);
  } catch (error) {
    // A design the physics rejects has no figure; the stability card shows the physics error.
    if (error instanceof PhysicsError) return undefined;
    throw error;
  }
}

/** One row of a small table, like the reference's "Connections". */
function Row({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="spec__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function Overview(props: OverviewProps): JSX.Element {
  const { figures, design, units, flight, stale, selectedId, onSelect, onStart } = props;
  const s = figures.stability;
  const thresholds = design.stabilityThresholds;
  const warn = design.warningThresholds;
  const range = gaugeRange(thresholds);
  const zones = gaugeZones(thresholds);
  const margin = FIGURE_DISPLAY.stabilityMargin;
  const len = unitFor('mm', units);
  const vel = unitFor('velocity', units);
  const summary = flight?.result.summary;
  const motor = design.motorMount?.motor;
  const twr = motor === undefined ? undefined : thrustToWeight(design);
  const twrRule = FIGURE_DISPLAY.thrustToWeight;
  const twrMin = warn.minThrustToWeight;
  const twrStatus: { severity: Severity; label: string } | undefined =
    twr === undefined
      ? undefined
      : twr < twrMin
        ? { severity: 'caution', label: `Below ${String(twrMin)} to 1` }
        : { severity: 'safe', label: `At least ${String(twrMin)} to 1` };
  const railMin = vel.fromSI(warn.minRailExitVelocity);
  const deployMax = vel.fromSI(warn.maxDeploymentVelocity);
  // Each threshold dial runs to twice its threshold (D-UI-7); never an empty range.
  const twice = (x: number): number => Math.max(2 * x, 1);
  const length = figures.length === 0 ? undefined : len.fromSI(figures.length);
  const notYet = stale ? 'out of date: simulate again' : 'simulate to see';
  const motorFig = motor === undefined ? undefined : motorFigures(motor.definition);
  const status = s === undefined ? undefined : LEVEL_STATUS[s.liftoff.level];

  return (
    <div className="overview">
      <div className="overview__row">
        <Gauge
          label="Liftoff margin"
          value={s?.result.marginLiftoff}
          min={range.min}
          max={range.max}
          decimals={margin.decimals}
          unit={margin.unit}
          zones={zones}
          emptyText={figures.error === undefined ? 'add parts to see' : 'cannot compute'}
          {...(s === undefined ? {} : { status: LEVEL_STATUS[s.liftoff.level] })}
        />
        <Gauge
          label="Burnout margin"
          value={s === undefined || s.noMotor ? undefined : s.result.marginBurnout}
          min={range.min}
          max={range.max}
          decimals={margin.decimals}
          unit={margin.unit}
          zones={zones}
          emptyText={s?.noMotor === true ? 'choose a motor' : 'add parts to see'}
          {...(s === undefined || s.noMotor ? {} : { status: LEVEL_STATUS[s.burnout.level] })}
        />
        <Gauge
          label="Thrust : weight"
          value={twr}
          min={0}
          max={twice(twrMin)}
          decimals={twrRule.decimals}
          unit="to 1"
          zones={[
            { from: 0, to: twrMin, severity: 'caution' },
            { from: twrMin, to: twice(twrMin), severity: 'safe' },
          ]}
          emptyText="choose a motor"
          {...(twrStatus === undefined ? {} : { status: twrStatus })}
        />
        <Gauge
          label="Max Mach"
          value={summary?.maxMach}
          min={MACH_SCALE.min}
          max={MACH_SCALE.max}
          decimals={FIGURE_DISPLAY.maxMach.decimals}
          unit="Mach"
          zones={MACH_ZONES}
          emptyText={notYet}
          {...(summary === undefined ? {} : { status: machStatus(summary.maxMach) })}
        />
      </div>
      <div className="overview__stage">
        <div className="overview__side overview__side--left">
          <div className="overview__pair">
            <Gauge
              label="CG from nose"
              value={s === undefined ? undefined : len.fromSI(s.result.cgLiftoff)}
              min={0}
              max={length ?? 1}
              decimals={len.decimals}
              unit={len.label}
              emptyText="add parts to see"
            />
            <Gauge
              label="CP from nose"
              value={s === undefined ? undefined : len.fromSI(s.result.centreOfPressure.cp)}
              min={0}
              max={length ?? 1}
              decimals={len.decimals}
              unit={len.label}
              emptyText="add parts to see"
            />
          </div>
          <section className="spec" aria-label="Motor">
            <h3 className="lfr-section-title">Motor</h3>
            <dl>
              <Row label="Motor">
                {motor === undefined
                  ? 'none chosen'
                  : `${motor.definition.manufacturer} ${motor.definition.designation}`}
              </Row>
              <Row label="Total impulse">
                {motorFig === undefined
                  ? '—'
                  : `${motorFig.totalImpulse.toFixed(FIGURE_DISPLAY.totalImpulse.decimals)} N·s`}
              </Row>
              <Row label="Burn time">
                {motorFig === undefined
                  ? '—'
                  : `${motorFig.burnTime.toFixed(FIGURE_DISPLAY.burnTime.decimals)} s`}
              </Row>
              <Row label="Ejection delay">
                {motor === undefined
                  ? '—'
                  : motor.ejectionDelay === undefined
                    ? 'plugged'
                    : `${String(motor.ejectionDelay)} s`}
              </Row>
            </dl>
          </section>
        </div>
        <div className="overview__vehicle">
          <VehicleView
            components={design.components}
            selectedId={selectedId}
            cg={s?.result.cgLiftoff}
            cp={s?.result.centreOfPressure.cp}
            cgText={s === undefined ? undefined : formatQuantity(s.result.cgLiftoff, 'mm', units)}
            cpText={
              s === undefined
                ? undefined
                : formatQuantity(s.result.centreOfPressure.cp, 'mm', units)
            }
            onSelect={onSelect}
            emptyAction={
              <Button variant="primary" onClick={onStart}>
                Start with the body tube
              </Button>
            }
          />
          <p className="overview__caption">
            <span className="overview__caption-key">Stability:</span>{' '}
            {status === undefined ? (
              <span className="muted">
                {figures.error === undefined ? 'add parts to see' : 'cannot compute'}
              </span>
            ) : (
              <SeverityTag severity={status.severity} label={status.label} />
            )}
          </p>
        </div>
        <div className="overview__side overview__side--right">
          <div className="overview__pair">
            <Gauge
              label="Rail exit"
              value={summary === undefined ? undefined : vel.fromSI(summary.railExitVelocity)}
              min={0}
              max={twice(railMin)}
              decimals={vel.decimals}
              unit={vel.label}
              zones={[
                { from: 0, to: railMin, severity: 'danger' },
                { from: railMin, to: twice(railMin), severity: 'safe' },
              ]}
              emptyText={notYet}
              {...(summary === undefined
                ? {}
                : {
                    status: railExitStatus(
                      summary.railExitVelocity,
                      warn.minRailExitVelocity,
                      `${railMin.toFixed(vel.decimals)} ${vel.label}`,
                    ),
                  })}
            />
            <Gauge
              label="Deployment"
              value={
                summary?.deploymentVelocity === undefined
                  ? undefined
                  : vel.fromSI(summary.deploymentVelocity)
              }
              min={0}
              max={twice(deployMax)}
              decimals={vel.decimals}
              unit={vel.label}
              zones={[
                { from: 0, to: deployMax, severity: 'safe' },
                { from: deployMax, to: twice(deployMax), severity: 'danger' },
              ]}
              emptyText={summary === undefined ? notYet : 'no deployment'}
              {...(summary?.deploymentVelocity === undefined
                ? {}
                : {
                    status:
                      summary.deploymentVelocity > warn.maxDeploymentVelocity
                        ? {
                            severity: 'danger' as const,
                            label: `Above ${deployMax.toFixed(vel.decimals)} ${vel.label}`,
                          }
                        : {
                            severity: 'safe' as const,
                            label: `At most ${deployMax.toFixed(vel.decimals)} ${vel.label}`,
                          },
                  })}
            />
          </div>
          <section className="spec" aria-label="Airframe">
            <h3 className="lfr-section-title">Airframe</h3>
            <dl>
              <Row label="Length">
                {figures.length === 0 ? '—' : formatQuantity(figures.length, 'mm', units)}
              </Row>
              <Row label="Reference diameter">
                {s === undefined
                  ? '—'
                  : formatQuantity(s.result.centreOfPressure.referenceDiameter, 'mm', units)}
              </Row>
              <Row label="Mass, no motor">
                {figures.massEmpty === undefined
                  ? '—'
                  : formatQuantity(figures.massEmpty, 'g', units)}
              </Row>
              <Row label="Mass at liftoff">
                {figures.massLiftoff === undefined || s?.noMotor === true
                  ? 'no motor'
                  : formatQuantity(figures.massLiftoff, 'g', units)}
              </Row>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
