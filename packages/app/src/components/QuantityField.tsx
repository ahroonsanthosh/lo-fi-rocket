import { useEffect, useId, useState, type JSX } from 'react';
import {
  displayValue,
  parseQuantity,
  unitFor,
  type QuantityKind,
  type UnitSystem,
} from '../units/display.js';

export type FieldRule = 'positive' | 'non-negative' | 'any';

export interface QuantityFieldProps {
  readonly label: string;
  readonly kind: QuantityKind;
  readonly units: UnitSystem;
  /** SI value. */
  readonly value: number;
  readonly rule: FieldRule;
  readonly onChange: (si: number) => void;
  readonly hint?: string;
  readonly disabled?: boolean;
}

function ruleMessage(label: string, rule: FieldRule, unitLabel: string): string | undefined {
  const unit = unitLabel === '' ? '' : ` ${unitLabel}`;
  if (rule === 'positive') return `${label} must be greater than 0${unit}`;
  if (rule === 'non-negative') return `${label} must be 0${unit} or greater`;
  return undefined;
}

/** Text that shows an SI value in the display unit with enough digits to round-trip edits. */
function showValue(si: number, kind: QuantityKind, units: UnitSystem): string {
  const v = displayValue(si, kind, units);
  const u = unitFor(kind, units);
  const fixed = v.toFixed(Math.max(u.decimals, 3));
  return String(Number(fixed));
}

/**
 * A numeric input in the display unit that writes SI to the design only
 * when the entry satisfies its rule (CLAUDE.md 8: validation at the
 * boundary with a plain message). An invalid entry keeps the last value.
 */
export function QuantityField(props: QuantityFieldProps): JSX.Element {
  const { label, kind, units, value, rule, onChange, hint, disabled } = props;
  const id = useId();
  const unit = unitFor(kind, units);
  const [text, setText] = useState(() => showValue(value, kind, units));
  const [error, setError] = useState<string | undefined>(undefined);
  // Re-sync the text when the value or the unit system changes from outside.
  useEffect(() => {
    setText(showValue(value, kind, units));
    setError(undefined);
  }, [value, kind, units]);

  const handle = (next: string): void => {
    setText(next);
    const si = parseQuantity(next, kind, units);
    if (si === undefined) {
      setError(`${label} must be a number`);
      return;
    }
    const bad = (rule === 'positive' && !(si > 0)) || (rule === 'non-negative' && !(si >= 0));
    if (bad) {
      setError(ruleMessage(label, rule, unit.label));
      return;
    }
    setError(undefined);
    onChange(si);
  };

  return (
    <div className={`field${error === undefined ? '' : ' field-invalid'}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled ?? false}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : `${id}-error`}
          onChange={(e) => {
            handle(e.target.value);
          }}
        />
        {unit.label === '' ? null : <span className="field-unit">{unit.label}</span>}
      </div>
      {error === undefined ? (
        hint === undefined ? null : (
          <p className="field-hint">{hint}</p>
        )
      ) : (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface IntegerFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly onChange: (n: number) => void;
}

export function IntegerField({ label, value, min, onChange }: IntegerFieldProps): JSX.Element {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    setText(String(value));
    setError(undefined);
  }, [value]);
  return (
    <div className={`field${error === undefined ? '' : ' field-invalid'}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={text}
          aria-invalid={error !== undefined}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const n = Number(next.trim());
            if (!/^\d+$/.test(next.trim()) || !Number.isInteger(n) || n < min) {
              setError(`${label} must be a whole number of ${String(min)} or more`);
              return;
            }
            setError(undefined);
            onChange(n);
          }}
        />
      </div>
      {error === undefined ? null : (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
