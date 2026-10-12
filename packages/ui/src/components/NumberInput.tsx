import { useEffect, useRef, useState, type JSX } from 'react';
import { editText, parseNumber } from '../format/display-rules.js';
import type { GlossaryKey } from '../glossary/glossary.js';
import { Field } from './Field.js';
import { Term } from './Tooltip.js';

/** What a number field accepts. Comparisons only: no value is changed. */
export type NumberRule =
  | { readonly kind: 'positive' }
  | { readonly kind: 'non-negative' }
  | { readonly kind: 'any' }
  | { readonly kind: 'integer'; readonly min: number };

export interface NumberInputProps {
  /** The label; also the subject of the validation messages. */
  readonly label: string;
  /** The value in the display unit, as the app converted it. */
  readonly value: number;
  /** Unit label after the field; empty for a plain number. */
  readonly unit: string;
  /** Decimals of the quantity (from UNIT_DISPLAY), used for the field text. */
  readonly decimals: number;
  readonly rule: NumberRule;
  /** Called with each valid entry, in the display unit. Never called for an invalid one. */
  readonly onChange: (value: number) => void;
  readonly hint?: string;
  readonly disabled?: boolean;
  /** Adds a "?" button that explains the term. */
  readonly term?: GlossaryKey;
}

function ruleError(label: string, rule: NumberRule, unit: string, n: number): string | undefined {
  const u = unit === '' ? '' : ` ${unit}`;
  switch (rule.kind) {
    case 'positive':
      return n > 0 ? undefined : `${label} must be greater than 0${u}`;
    case 'non-negative':
      return n >= 0 ? undefined : `${label} must be 0${u} or greater`;
    case 'integer':
      return Number.isInteger(n) && n >= rule.min
        ? undefined
        : `${label} must be a whole number of ${String(rule.min)} or more`;
    case 'any':
      return undefined;
  }
}

/**
 * A number field in a display unit with inline validation (CLAUDE.md 8).
 * A valid entry is passed on at once; an invalid one is not, and the
 * message says so and names the value still in use, so nothing is
 * silently ignored. The text is re-read from `value` only when the value
 * changes from outside (another control, the units toggle, an undo).
 */
export function NumberInput(props: NumberInputProps): JSX.Element {
  const { label, value, unit, decimals, rule, onChange, hint, disabled, term } = props;
  const [text, setText] = useState(() => editText(value, decimals));
  const [error, setError] = useState<string | undefined>(undefined);
  const lastSent = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (lastSent.current !== undefined && Object.is(lastSent.current, value)) return;
    lastSent.current = undefined;
    setText(editText(value, decimals));
    setError(undefined);
  }, [value, decimals, unit]);

  const handle = (next: string): void => {
    setText(next);
    const n = parseNumber(next);
    const problem = n === undefined ? `${label} must be a number` : ruleError(label, rule, unit, n);
    if (problem !== undefined || n === undefined) {
      setError(problem);
      return;
    }
    setError(undefined);
    lastSent.current = n;
    onChange(n);
  };

  const inUse = `${editText(value, decimals)}${unit === '' ? '' : ` ${unit}`}`;
  return (
    <Field
      label={label}
      labelAddon={
        term === undefined ? undefined : (
          <Term k={term} ariaLabel={`What is ${label.toLowerCase()}?`}>
            ?
          </Term>
        )
      }
      hint={hint}
      error={error}
      errorDetail={error === undefined ? undefined : `Not applied: still using ${inUse}.`}
      suffix={unit === '' ? undefined : unit}
    >
      {(control) => (
        <input
          {...control}
          className="lfr-input lfr-input--number"
          type="text"
          inputMode={rule.kind === 'integer' ? 'numeric' : 'decimal'}
          value={text}
          disabled={disabled ?? false}
          onChange={(e) => {
            handle(e.target.value);
          }}
        />
      )}
    </Field>
  );
}
