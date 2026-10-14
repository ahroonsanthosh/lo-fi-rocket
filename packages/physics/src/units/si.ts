/**
 * The SI quantities used by the physics package, each with its constructor.
 *
 * Add a quantity only when a function needs it. Unit symbols follow the SI
 * Brochure; "·" separates multiplied units and "^" marks powers so that the
 * symbol is unambiguous in error messages.
 */
import { defineQuantity, type Quantity } from './quantity.js';

// Base and length-derived quantities
export type Metres = Quantity<'m'>;
export const metres = defineQuantity('Metres', 'm');

export type SquareMetres = Quantity<'m^2'>;
export const squareMetres = defineQuantity('SquareMetres', 'm^2');

export type CubicMetres = Quantity<'m^3'>;
export const cubicMetres = defineQuantity('CubicMetres', 'm^3');

// Mass
export type Kilograms = Quantity<'kg'>;
export const kilograms = defineQuantity('Kilograms', 'kg');

export type KilogramsPerCubicMetre = Quantity<'kg/m^3'>;
export const kilogramsPerCubicMetre = defineQuantity('KilogramsPerCubicMetre', 'kg/m^3');

export type KilogramsPerSquareMetre = Quantity<'kg/m^2'>;
export const kilogramsPerSquareMetre = defineQuantity('KilogramsPerSquareMetre', 'kg/m^2');

export type KilogramSquareMetres = Quantity<'kg·m^2'>;
export const kilogramSquareMetres = defineQuantity('KilogramSquareMetres', 'kg·m^2');

// Time and kinematics
export type Seconds = Quantity<'s'>;
export const seconds = defineQuantity('Seconds', 's');

export type MetresPerSecond = Quantity<'m/s'>;
export const metresPerSecond = defineQuantity('MetresPerSecond', 'm/s');

export type MetresPerSecondSquared = Quantity<'m/s^2'>;
export const metresPerSecondSquared = defineQuantity('MetresPerSecondSquared', 'm/s^2');

// Force and impulse
export type Newtons = Quantity<'N'>;
export const newtons = defineQuantity('Newtons', 'N');

export type NewtonSeconds = Quantity<'N·s'>;
export const newtonSeconds = defineQuantity('NewtonSeconds', 'N·s');

// Thermodynamics and fluids
export type Kelvin = Quantity<'K'>;
export const kelvin = defineQuantity('Kelvin', 'K');

export type Pascals = Quantity<'Pa'>;
export const pascals = defineQuantity('Pascals', 'Pa');

export type PascalSeconds = Quantity<'Pa·s'>;
export const pascalSeconds = defineQuantity('PascalSeconds', 'Pa·s');

export type SquareMetresPerSecond = Quantity<'m^2/s'>;
export const squareMetresPerSecond = defineQuantity('SquareMetresPerSecond', 'm^2/s');

// Angles
export type Radians = Quantity<'rad'>;
export const radians = defineQuantity('Radians', 'rad');

export type RadiansPerSecond = Quantity<'rad/s'>;
export const radiansPerSecond = defineQuantity('RadiansPerSecond', 'rad/s');

// Dimensionless, still branded so they cannot be confused with dimensional values
export type Mach = Quantity<'Mach'>;
export const mach = defineQuantity('Mach', 'Mach');

export type Dimensionless = Quantity<'1'>;
export const dimensionless = defineQuantity('Dimensionless', '1');
