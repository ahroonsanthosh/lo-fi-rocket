/**
 * Branded physical quantities.
 *
 * A `Quantity<Unit>` is a float64 `number` carrying its SI unit in the type
 * system. It is usable wherever a `number` is (comparison, `Math.*`,
 * arithmetic), but a plain `number` or a quantity of a different unit cannot
 * be passed where a specific quantity is expected. See docs/conventions.md,
 * "Units", for the rules and the known limitation (arithmetic yields a plain
 * `number`; functions re-brand on return).
 */
import { InvalidInputError } from '../errors.js';

declare const unitBrand: unique symbol;

/** A float64 tagged with its SI unit symbol. */
export type Quantity<Unit extends string> = number & { readonly [unitBrand]: Unit };

/** A constructor that validates and brands a raw number as a quantity. */
export type QuantityConstructor<Unit extends string> = (value: number) => Quantity<Unit>;

/**
 * Builds the constructor for one quantity type.
 *
 * The constructor is the only way to create a quantity. It accepts every
 * finite float64, including zero, negative zero and negative values (sign
 * and range are the consuming function's responsibility), and throws
 * `InvalidInputError` for NaN and ±Infinity (CLAUDE.md rule 3 and section 8).
 *
 * @param name human-readable quantity name used in error messages, e.g. "Metres"
 * @param unit SI unit symbol, e.g. "m"
 */
export function defineQuantity<Unit extends string>(
  name: string,
  unit: Unit,
): QuantityConstructor<Unit> {
  const requirement = `must be a finite number in ${unit}`;
  return (value: number): Quantity<Unit> => {
    if (!Number.isFinite(value)) {
      throw new InvalidInputError(name, value, requirement);
    }
    return value as Quantity<Unit>;
  };
}
