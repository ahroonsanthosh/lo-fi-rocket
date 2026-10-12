/**
 * Launch site and launch rail (plan 0008, ENV-2).
 *
 * Sources: Niskanen §2.1 p. 6 (the launch guide holds the rocket until it
 * has enough speed for the fins to stabilise it; the NAR safety code forbids
 * launching more than 30° from vertical), §4.2.1 p. 61 (the rod angle is set
 * relative to the wind direction) and Table 4.2 p. 69 ("launch rod cleared"
 * event). The rail mechanics (motion constrained to the rail direction until
 * the rocket has travelled the rail length) are applied in plan 0010.
 */
import { InvalidInputError } from '../errors.js';
import { railDirection } from '../flight/frames.js';
import type { Vec3 } from '../flight/vector.js';
import { radians, type Metres, type Radians } from '../units/si.js';

export interface LaunchSite {
  /** Pad altitude above mean sea level. */
  readonly altitude: Metres;
  /** Geodetic latitude, kept for a future latitude-dependent gravity model (D-030); unused now. */
  readonly latitude?: Radians;
}

export interface LaunchRail {
  readonly length: Metres;
  readonly angleFromVertical: Radians;
  /** Compass azimuth the rail leans towards, clockwise from north. */
  readonly azimuth: Radians;
}

export interface LaunchWarning {
  readonly code: 'rail-angle-above-nar-limit';
  readonly message: string;
}

/** The NAR safety code limit quoted by Niskanen p. 6. */
export const NAR_MAX_LAUNCH_ANGLE: Radians = radians(Math.PI / 6);

export interface ValidatedLaunch {
  readonly site: LaunchSite;
  readonly rail: LaunchRail;
  readonly railDirection: Vec3;
  readonly warnings: readonly LaunchWarning[];
}

/** Validate and derive; azimuth is normalised to [0, 2π). */
export function validateLaunch(site: LaunchSite, rail: LaunchRail): ValidatedLaunch {
  const alt: number = site.altitude;
  if (!Number.isFinite(alt))
    throw new InvalidInputError('launch site altitude', alt, 'must be finite');
  if (site.latitude !== undefined) {
    const lat: number = site.latitude;
    if (!(Math.abs(lat) <= Math.PI / 2)) {
      throw new InvalidInputError('latitude', lat, 'must be between −90° and 90°');
    }
  }
  const len: number = rail.length;
  if (!(len > 0) || !Number.isFinite(len)) {
    throw new InvalidInputError('launch rail length', len, 'must be greater than 0 m');
  }
  const angle: number = rail.angleFromVertical;
  if (!(angle >= 0 && angle < Math.PI / 2)) {
    throw new InvalidInputError(
      'rail angle from vertical',
      angle,
      'must be between 0 and 90 degrees',
    );
  }
  const az: number = rail.azimuth;
  if (!Number.isFinite(az)) throw new InvalidInputError('rail azimuth', az, 'must be finite');
  const twoPi = 2 * Math.PI;
  const azimuth = radians(((az % twoPi) + twoPi) % twoPi);
  const warnings: LaunchWarning[] = [];
  if (angle > (NAR_MAX_LAUNCH_ANGLE as number)) {
    warnings.push({
      code: 'rail-angle-above-nar-limit',
      message: `The rail is ${((angle * 180) / Math.PI).toFixed(1)}° from vertical; the NAR safety code forbids launching more than 30° from vertical (Niskanen 2009, p. 6), because a tilted launch sends the rocket far downrange and lowers the apogee.`,
    });
  }
  const validatedRail: LaunchRail = {
    length: rail.length,
    angleFromVertical: rail.angleFromVertical,
    azimuth,
  };
  return {
    site,
    rail: validatedRail,
    railDirection: railDirection(rail.angleFromVertical, azimuth),
    warnings,
  };
}
