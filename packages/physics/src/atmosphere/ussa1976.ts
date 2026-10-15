/**
 * U.S. Standard Atmosphere, 1976, from sea level (and down to −5 000 m) to
 * 86 000 m geometric altitude.
 *
 * Source (all citations below): NOAA, NASA, USAF, *U.S. Standard Atmosphere,
 * 1976*, NOAA-S/T 76-1562 / NASA-TM-X-74335, October 1976. File:
 * reference/docs/ussa1976-nasa-ntrs-19770009539.pdf. Page numbers are the
 * document's printed page numbers (PDF page = printed page + 16 in Part 1).
 * Equation IDs refer to docs/equations.md.
 *
 * Validity: geometric altitude Z from −5 000 m (the lowest row of Table I,
 * p. 51; p. 12 states eq. 33a applies down to −5 km') to 86 000 m (the top of
 * the seven linear layers, Table 4, p. 3). Outside that range the function
 * throws; it never extrapolates. The model is an idealised mid-latitude
 * yearly mean (Foreword, p. xiv) of dry air; real conditions differ.
 *
 * Numerical tolerance: every output is a chain of at most seven float64
 * exponentials or powers, so the relative error against exact evaluation of
 * the same formulas is below 1e-13. Against the printed tables the limit is
 * the tables' own rounding (see ussa1976.tables.test.ts).
 */
import { InvalidInputError, NotImplementedError } from '../errors.js';
import { finiteResult } from '../numerics/finite.js';
import {
  kelvin,
  kilogramsPerCubicMetre,
  metres,
  metresPerSecond,
  pascalSeconds,
  pascals,
  squareMetresPerSecond,
  type Kelvin,
  type KilogramsPerCubicMetre,
  type Metres,
  type MetresPerSecond,
  type PascalSeconds,
  type Pascals,
  type SquareMetresPerSecond,
} from '../units/si.js';

/**
 * Adopted constants of the standard. Table 2, p. 2, except where noted.
 * These belong to the atmosphere model only; in particular
 * `seaLevelGravityG0` is the standard's defining constant for the
 * geopotential metre and the pressure equations, not the flight
 * simulator's gravity model (docs/conventions.md, "Gravity: two different
 * constants").
 */
export const USSA1976_CONSTANTS = Object.freeze({
  /** g₀ = 9.80665 m/s², Table 2 p. 2 and p. 3. Numerically equal to g₀′ = 9.80665 m²/(s²·m′), p. 3 and p. 8. */
  seaLevelGravityG0: 9.80665,
  /** r₀ = 6 356 766 m, Table 2 p. 2 ("6.356766 × 10³ km"), p. 4 and p. 8. */
  effectiveEarthRadiusR0: 6356766,
  /** P₀ = 101 325 Pa, Table 2 p. 2 ("1.013250 × 10⁵ N/m²"), p. 3 to 4, p. 12. */
  seaLevelPressureP0: 101325,
  /** T₀ = 288.15 K, Table 2 p. 2 and p. 4. */
  seaLevelTemperatureT0: 288.15,
  /** M₀ = 28.9644 kg/kmol, p. 9 (text below eq. 21) and Table 10 p. 20. */
  seaLevelMolecularWeightM0: 28.9644,
  /** R* = 8.31432 × 10³ N·m/(kmol·K), Table 2 p. 2 and p. 3. */
  universalGasConstantRStar: 8314.32,
  /** γ = 1.40, Table 2 p. 2 and p. 4 ("1.400"). */
  ratioOfSpecificHeatsGamma: 1.4,
  /** β = 1.458 × 10⁻⁶ kg/(s·m·K^½), Table 2 p. 2, p. 4 and p. 19. */
  sutherlandBeta: 1.458e-6,
  /**
   * S = 110.4 K, p. 19 (text of eq. 51). Table 2 p. 2 and p. 4 print "110 K";
   * only 110.4 K reproduces the tabulated sea-level viscosity
   * μ₀ = 1.7894 × 10⁻⁵ (Table 10 p. 20, Table III p. 101). See docs/decisions.md D-021.
   */
  sutherlandS: 110.4,
});

/** Lowest geometric altitude of Table I (p. 51), in metres. */
export const USSA1976_MIN_ALTITUDE = -5000;
/** Top of the linearly segmented profile, 86 km geometric (Table 4 p. 3, p. 10), in metres. */
export const USSA1976_MAX_ALTITUDE = 86000;

interface Layer {
  /** Base geopotential altitude H_b in m′ (Table 4 p. 3 gives km′). */
  readonly baseGeopotential: number;
  /** Molecular-scale temperature gradient L_M,b in K/m′ (Table 4 p. 3 gives K/km′). */
  readonly gradient: number;
  /** T_M,b in K, from eq. 23 chained from T_M,0 = T₀ (p. 10). */
  readonly baseTemperature: number;
  /** P_b in Pa, from eqs. 33a and 33b chained from P₀ (p. 12). */
  readonly basePressure: number;
}

/**
 * Table 4, p. 3: the seven layers' base geopotential heights (km′) and
 * gradients (K/km′). The eighth entry, 84.8520 km′, is the top.
 */
const LAYER_BASES_KM = [0, 11, 20, 32, 47, 51, 71] as const;
const LAYER_GRADIENTS_K_PER_KM = [-6.5, 0.0, 1.0, 2.8, 0.0, -2.8, -2.0] as const;
/** Geopotential altitude of the top of layer 6, 84.8520 km′ (Table 4 p. 3). */
export const USSA1976_TOP_GEOPOTENTIAL = 84852;

const {
  seaLevelGravityG0: g0,
  seaLevelMolecularWeightM0: M0,
  universalGasConstantRStar: RStar,
} = USSA1976_CONSTANTS;
/** g₀′ M₀ / R*, the exponent factor of eqs. 33a and 33b, in K/m′. */
const G0_M0_OVER_RSTAR = (g0 * M0) / RStar;

/**
 * ATM-4, eq. 33a p. 12 (L_M,b ≠ 0):
 *   P = P_b [T_M,b / (T_M,b + L_M,b (H − H_b))]^(g₀′ M₀ / (R* L_M,b))
 * ATM-5, eq. 33b p. 12 (L_M,b = 0):
 *   P = P_b exp[−g₀′ M₀ (H − H_b) / (R* T_M,b)]
 */
function pressureInLayer(layer: Layer, geopotential: number): number {
  const dH = geopotential - layer.baseGeopotential;
  if (layer.gradient === 0) {
    return layer.basePressure * Math.exp((-G0_M0_OVER_RSTAR * dH) / layer.baseTemperature);
  }
  const ratio = layer.baseTemperature / (layer.baseTemperature + layer.gradient * dH);
  return layer.basePressure * ratio ** (G0_M0_OVER_RSTAR / layer.gradient);
}

/**
 * Builds the layer table, chaining eq. 23 and eqs. 33a/33b from the given
 * sea-level base conditions (the standard's T₀ and P₀, or a launch-site
 * override assigned to the first layer, ATM-11).
 */
function buildLayers(
  seaLevelTemperature: number = USSA1976_CONSTANTS.seaLevelTemperatureT0, // T_M,0 = T₀, p. 10
  seaLevelPressure: number = USSA1976_CONSTANTS.seaLevelPressureP0, // P_0, p. 12
): readonly Layer[] {
  const layers: Layer[] = [];
  let baseTemperature = seaLevelTemperature;
  let basePressure = seaLevelPressure;
  for (let b = 0; b < LAYER_BASES_KM.length; b++) {
    const baseKm = LAYER_BASES_KM[b];
    const gradientPerKm = LAYER_GRADIENTS_K_PER_KM[b];
    if (baseKm === undefined || gradientPerKm === undefined) {
      throw new Error('USSA1976 layer table is malformed');
    }
    const layer: Layer = {
      baseGeopotential: baseKm * 1000,
      gradient: gradientPerKm / 1000,
      baseTemperature,
      basePressure,
    };
    layers.push(layer);
    const nextBaseKm = LAYER_BASES_KM[b + 1];
    const nextBase = nextBaseKm === undefined ? USSA1976_TOP_GEOPOTENTIAL : nextBaseKm * 1000;
    // ATM-3, eq. 23 p. 10: T_M = T_M,b + L_M,b (H − H_b), evaluated at the next base.
    baseTemperature = layer.baseTemperature + layer.gradient * (nextBase - layer.baseGeopotential);
    basePressure = pressureInLayer(layer, nextBase);
  }
  return layers;
}

const LAYERS: readonly Layer[] = buildLayers();

/**
 * ATM-11. Launch-site conditions (Niskanen §4.1.1 p. 55): the user's
 * temperature and pressure "are simply assigned to the first layer of the
 * atmospheric model", given "either at mean sea level or at the altitude of
 * the launch site". Humidity is ignored (p. 56, under 1 %).
 */
export interface AtmosphereBaseConditions {
  /** Where the values apply: mean sea level, or a geometric altitude within the first layer. */
  readonly at: 'sea-level' | { readonly altitude: Metres };
  readonly temperature: Kelvin;
  readonly pressure: Pascals;
}

/**
 * Sea-level T₀ and P₀ equivalent to the given base conditions. For a site
 * altitude, eq. 23 and eq. 33a of layer 0 are inverted: T₀ = T_site − L₀ H_site,
 * P₀ = P_site (T_site/T₀)^(g₀′M₀/(R* L₀)). The site must lie in layer 0
 * (H < 11 km′); anything higher is not covered by the thesis's statement.
 */
export function seaLevelEquivalent(base: AtmosphereBaseConditions): {
  temperature: number;
  pressure: number;
} {
  const t: number = base.temperature;
  const p: number = base.pressure;
  if (!(t > 0) || !Number.isFinite(t)) {
    throw new InvalidInputError('base temperature', t, 'must be greater than 0 K');
  }
  if (!(p > 0) || !Number.isFinite(p)) {
    throw new InvalidInputError('base pressure', p, 'must be greater than 0 Pa');
  }
  if (base.at === 'sea-level') return { temperature: t, pressure: p };
  const z: number = base.at.altitude;
  assertInDomain(z);
  const h: number = geometricToGeopotential(base.at.altitude);
  const layer0 = LAYERS[0];
  const layer1 = LAYERS[1];
  if (layer0 === undefined || layer1 === undefined)
    throw new Error('USSA1976 layer table is malformed');
  if (!(h < layer1.baseGeopotential)) {
    throw new NotImplementedError(
      `launch-site conditions above the first layer (site at ${String(z)} m, the first layer ends at 11 km′): Niskanen p. 55 assigns them to the first layer only`,
    );
  }
  const L0 = layer0.gradient;
  const t0 = t - L0 * h;
  if (!(t0 > 0))
    throw new InvalidInputError(
      'base temperature',
      t,
      'implies a sea-level temperature at or below 0 K',
    );
  const p0 = p * (t / t0) ** (G0_M0_OVER_RSTAR / L0);
  return {
    temperature: finiteResult('sea-level equivalent temperature', t0),
    pressure: finiteResult('sea-level equivalent pressure', p0),
  };
}

/** Layer table for the given base conditions (the standard's when absent). */
function layersFor(base: AtmosphereBaseConditions | undefined): readonly Layer[] {
  if (base === undefined) return LAYERS;
  const sl = seaLevelEquivalent(base);
  return buildLayers(sl.temperature, sl.pressure);
}

/** The layer whose base is at or below `geopotential` (the first layer also serves H < 0, p. 12). */
function layerAt(layers: readonly Layer[], geopotential: number): Layer {
  let found = layers[0];
  for (const layer of layers) {
    if (geopotential >= layer.baseGeopotential) {
      found = layer;
    }
  }
  if (found === undefined) {
    throw new Error('USSA1976 layer table is empty');
  }
  return found;
}

/** Reports the layer table for tests and documentation (base H in m′, L in K/m′, T_M,b in K, P_b in Pa). */
export function ussa1976Layers(base?: AtmosphereBaseConditions): readonly Layer[] {
  return layersFor(base);
}

/**
 * ATM-1, eq. 18 p. 8: H = Γ r₀ Z / (r₀ + Z) with Γ = g₀/g₀′ = 1 m′/m.
 * Converts geometric altitude Z (m) to geopotential altitude H (m′).
 * Validity: any Z > −r₀; this module only uses −5 000 m ≤ Z ≤ 86 000 m.
 * Tolerance: one division and one multiplication, ≤ 1 ulp.
 */
export function geometricToGeopotential(geometricAltitude: Metres): Metres {
  const r0 = USSA1976_CONSTANTS.effectiveEarthRadiusR0;
  const z: number = geometricAltitude;
  return metres(finiteResult('geometricToGeopotential', (r0 * z) / (r0 + z)));
}

/**
 * ATM-2, eq. 19 p. 8: Z = r₀ H / (Γ r₀ − H) with Γ = 1 m′/m.
 * Converts geopotential altitude H (m′) to geometric altitude Z (m).
 * Tolerance: ≤ 1 ulp.
 */
export function geopotentialToGeometric(geopotentialAltitude: Metres): Metres {
  const r0 = USSA1976_CONSTANTS.effectiveEarthRadiusR0;
  const h: number = geopotentialAltitude;
  return metres(finiteResult('geopotentialToGeometric', (r0 * h) / (r0 - h)));
}

/**
 * Table 8, p. 9: molecular-weight ratio M/M₀ at geometric altitudes 80 000 to
 * 86 000 m in 500 m steps (the right-hand, Z-indexed columns). Below 80 km the
 * ratio is exactly 1 (p. 9, "M remains constant at its sea-level value M₀").
 */
const TABLE_8_Z_STEP = 500;
const TABLE_8_Z_START = 80000;
const TABLE_8_RATIO = [
  1.0, // 80 000
  0.999996, // 80 500
  0.999989, // 81 000
  0.999971, // 81 500
  0.999941, // 82 000
  0.999909, // 82 500
  0.99987, // 83 000
  0.999829, // 83 500
  0.999786, // 84 000
  0.999741, // 84 500
  0.999694, // 85 000
  0.999641, // 85 500
  0.999579, // 86 000
] as const;

/**
 * ATM-10 (data): M/M₀ at geometric altitude Z, from Table 8 p. 9, linearly
 * interpolated between the 500 m entries (the document tabulates the ratio
 * only at those points; see docs/decisions.md D-022). Equal to 1 below 80 km.
 * Validity: −5 000 m ≤ Z ≤ 86 000 m.
 */
export function molecularWeightRatio(geometricAltitude: Metres): number {
  const z: number = geometricAltitude;
  assertInDomain(z);
  if (z <= TABLE_8_Z_START) {
    return 1;
  }
  const position = (z - TABLE_8_Z_START) / TABLE_8_Z_STEP;
  const index = Math.min(Math.floor(position), TABLE_8_RATIO.length - 2);
  const lower = TABLE_8_RATIO[index];
  const upper = TABLE_8_RATIO[index + 1];
  if (lower === undefined || upper === undefined) {
    throw new Error('Table 8 lookup out of range');
  }
  const fraction = position - index;
  return finiteResult('molecularWeightRatio', lower + (upper - lower) * fraction);
}

function assertInDomain(z: number): void {
  if (!(z >= USSA1976_MIN_ALTITUDE && z <= USSA1976_MAX_ALTITUDE)) {
    throw new InvalidInputError(
      'geometric altitude',
      z,
      `must be between ${String(USSA1976_MIN_ALTITUDE)} m and ${String(USSA1976_MAX_ALTITUDE)} m (U.S. Standard Atmosphere 1976, lower atmosphere)`,
    );
  }
}

/** Everything the standard defines for one altitude below 86 km. */
export interface StandardAtmosphereState {
  readonly geometricAltitude: Metres;
  readonly geopotentialAltitude: Metres;
  /** T_M, the molecular-scale temperature (eq. 23 p. 10). Equals the kinetic temperature below 80 km. */
  readonly molecularScaleTemperature: Kelvin;
  /** T, the kinetic temperature: T = T_M · M/M₀ (eq. 22 p. 9, Table 8). */
  readonly temperature: Kelvin;
  readonly pressure: Pascals;
  readonly density: KilogramsPerCubicMetre;
  readonly speedOfSound: MetresPerSecond;
  readonly dynamicViscosity: PascalSeconds;
  readonly kinematicViscosity: SquareMetresPerSecond;
  /** M/M₀ from Table 8 (1 below 80 km). */
  readonly molecularWeightRatio: number;
}

/**
 * The U.S. Standard Atmosphere, 1976, at a geometric altitude between
 * −5 000 m and 86 000 m. Throws `InvalidInputError` outside that range.
 *
 * Equations (docs/equations.md): ATM-1 (eq. 18), ATM-3 (eq. 23), ATM-4/ATM-5
 * (eqs. 33a/33b), ATM-6 (eq. 42), ATM-7 (eq. 50), ATM-8 (eq. 51), ATM-9
 * (eq. 52), ATM-10 (eq. 22 with Table 8).
 */
export function standardAtmosphere1976(
  geometricAltitude: Metres,
  base?: AtmosphereBaseConditions,
): StandardAtmosphereState {
  return atmosphereState(geometricAltitude, layersFor(base));
}

/**
 * A reusable atmosphere for the given base conditions (ATM-11), built once.
 * Returns the standard atmosphere when `base` is undefined.
 */
export function atmosphereModel(
  base?: AtmosphereBaseConditions,
): (geometricAltitude: Metres) => StandardAtmosphereState {
  const layers = layersFor(base);
  return (geometricAltitude) => atmosphereState(geometricAltitude, layers);
}

function atmosphereState(
  geometricAltitude: Metres,
  layers: readonly Layer[],
): StandardAtmosphereState {
  const z: number = geometricAltitude;
  assertInDomain(z);
  const h: number = geometricToGeopotential(geometricAltitude);
  const layer = layerAt(layers, h);

  // ATM-3, eq. 23 p. 10.
  const tM = finiteResult(
    'molecular-scale temperature',
    layer.baseTemperature + layer.gradient * (h - layer.baseGeopotential),
  );
  // ATM-4 / ATM-5, eqs. 33a and 33b p. 12.
  const p = finiteResult('pressure', pressureInLayer(layer, h));
  // ATM-6, eq. 42 p. 15: ρ = P M₀ / (R* T_M).
  const rho = finiteResult('density', (p * M0) / (RStar * tM));
  // ATM-10, eq. 22 p. 9 with Table 8: T = T_M · M/M₀.
  const ratio = molecularWeightRatio(geometricAltitude);
  const t = finiteResult('kinetic temperature', tM * ratio);
  // ATM-7, eq. 50 p. 18: C_s = (γ R* T_M / M₀)^½.
  const cs = finiteResult(
    'speed of sound',
    Math.sqrt((USSA1976_CONSTANTS.ratioOfSpecificHeatsGamma * RStar * tM) / M0),
  );
  // ATM-8, eq. 51 p. 19: μ = β T^(3/2) / (T + S), with the kinetic temperature T.
  const mu = finiteResult(
    'dynamic viscosity',
    (USSA1976_CONSTANTS.sutherlandBeta * t ** 1.5) / (t + USSA1976_CONSTANTS.sutherlandS),
  );
  // ATM-9, eq. 52 p. 19: η = μ / ρ.
  const eta = finiteResult('kinematic viscosity', mu / rho);

  return {
    geometricAltitude,
    geopotentialAltitude: metres(h),
    molecularScaleTemperature: kelvin(tM),
    temperature: kelvin(t),
    pressure: pascals(p),
    density: kilogramsPerCubicMetre(rho),
    speedOfSound: metresPerSecond(cs),
    dynamicViscosity: pascalSeconds(mu),
    kinematicViscosity: squareMetresPerSecond(eta),
    molecularWeightRatio: ratio,
  };
}

/**
 * ATM-12 (plan 0081). The standard atmosphere's geopotential altitude H (m′) at which its pressure
 * is `pressure`: the inverse of eqs. 33a and 33b (p. 12) on the standard's own layers,
 *   L_M,b ≠ 0: H = H_b + (T_M,b/L_M,b) [(P/P_b)^(−R* L_M,b/(g₀′ M₀)) − 1]
 *   L_M,b = 0: H = H_b − (R* T_M,b/(g₀′ M₀)) ln(P/P_b)
 * This is what a barometric altimeter computes: the standard is "a basis for pressure altimeter
 * calibrations" (foreword p. xiv, quoting the WMO definition). Below sea level the first layer
 * serves (p. 12). The result is geopotential: the standard writes its pressure-height relation in
 * it; geometric height differs by H²/(r₀ − H), under 0.2 % below 10 km.
 */
export function standardPressureAltitude(pressure: Pascals): Metres {
  const p: number = pressure;
  if (!(p > 0) || !Number.isFinite(p))
    throw new InvalidInputError('pressure', p, 'must be greater than 0 Pa');
  const top = LAYERS[LAYERS.length - 1];
  if (top === undefined) throw new Error('USSA1976 layer table is malformed');
  const pTop = pressureInLayer(top, USSA1976_TOP_GEOPOTENTIAL);
  if (p < pTop)
    throw new InvalidInputError(
      'pressure',
      p,
      `must be at least ${pTop.toPrecision(4)} Pa, the standard's pressure at 84.852 km′ (the top of its lower atmosphere)`,
    );
  let layer = LAYERS[0];
  for (const l of LAYERS) if (p <= l.basePressure) layer = l;
  if (layer === undefined) throw new Error('USSA1976 layer table is malformed');
  const ratio = p / layer.basePressure;
  const h =
    layer.gradient === 0
      ? layer.baseGeopotential - (layer.baseTemperature / G0_M0_OVER_RSTAR) * Math.log(ratio)
      : layer.baseGeopotential +
        (layer.baseTemperature / layer.gradient) *
          (ratio ** (-layer.gradient / G0_M0_OVER_RSTAR) - 1);
  return metres(finiteResult('standard pressure altitude', h));
}

/**
 * ATM-13 (plan 0081). What a barometric altimeter zeroed on the pad reads at a height `height` above
 * it, on the day whose atmosphere is `atmosphere`: the standard pressure altitude (ATM-12) of the
 * pressure there, minus that of the pressure on the pad. On a standard day it is the height itself
 * to within the geopotential difference; on a warmer day the air column is taller than the standard
 * one for the same pressure drop, and the altimeter reads low.
 */
export function barometricAltimeterReading(
  atmosphere: (geometricAltitude: Metres) => StandardAtmosphereState,
  siteAltitude: Metres,
  height: Metres,
): Metres {
  const pad = atmosphere(siteAltitude).pressure;
  const at = atmosphere(metres((siteAltitude as number) + (height as number))).pressure;
  return metres(
    finiteResult(
      'barometric altimeter reading',
      (standardPressureAltitude(at) as number) - (standardPressureAltitude(pad) as number),
    ),
  );
}
