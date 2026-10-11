/**
 * Compile-time tests for the unit brands. Checked by `pnpm typecheck`:
 * `tsc` fails if a `@ts-expect-error` line stops erroring, so each one
 * below is an assertion that the brand rejects what it must reject.
 * Excluded from Vitest (see packages/physics/vitest.config.ts).
 */
import { kilograms, metres, type Kilograms, type Metres } from './si.js';
import { millimetresToMetres } from './convert.js';

function takesMetres(length: Metres): number {
  return length * 2;
}

// A plain number is not a quantity.
// @ts-expect-error a plain number must not be assignable to Metres
export const plainNumberIsNotMetres: Metres = 1;

// A quantity of another unit is not interchangeable.
// @ts-expect-error Kilograms must not be assignable to Metres
export const kilogramsAreNotMetres: Metres = kilograms(1);

// A function taking Metres rejects a raw number even when it "looks right".
// @ts-expect-error raw millimetre value must not be passed as Metres
export const rawArgumentRejected = takesMetres(1500);

// Arithmetic on quantities yields a plain number, which must be re-branded.
// @ts-expect-error the sum of two Metres is a number, not Metres
export const arithmeticLosesBrand: Metres = metres(1) + metres(2);

// Positive cases: these must compile.
export const quantityIsANumber: number = metres(1);
export const constructedArgumentAccepted = takesMetres(metres(1.5));
export const convertedArgumentAccepted = takesMetres(millimetresToMetres(1500));
export const rebranded: Metres = metres(metres(1) + metres(2));
export const massStaysMass: Kilograms = kilograms(3);
