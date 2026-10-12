import { useId, type JSX, type ReactNode, type SelectHTMLAttributes } from 'react';

export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean;
}

export interface FieldProps {
  readonly label: ReactNode;
  /** Shown after the label, outside it so that it is not part of the control's name (a glossary term button). */
  readonly labelAddon?: ReactNode;
  /** Shown under the control while there is no error. */
  readonly hint?: ReactNode;
  /** An inline validation message; replaces nothing else on the screen. */
  readonly error?: string | undefined;
  /** Extra text kept under the error, for example the value still in use. */
  readonly errorDetail?: string | undefined;
  /** Text after the control, typically the unit. */
  readonly suffix?: ReactNode;
  readonly children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label, control, hint and inline error, wired together: the label names
 * the control, the hint or error describes it, and an error marks it
 * invalid and is announced (role="alert").
 */
export function Field({
  label,
  labelAddon,
  hint,
  error,
  errorDetail,
  suffix,
  children,
}: FieldProps): JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error !== undefined ? errorId : hint !== undefined ? hintId : undefined;
  return (
    <div className={`lfr-field${error === undefined ? '' : ' lfr-field--invalid'}`}>
      <div className="lfr-field__label-row">
        <label className="lfr-field__label" htmlFor={id}>
          {label}
        </label>
        {labelAddon}
      </div>
      <div className="lfr-field__row">
        {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error !== undefined })}
        {suffix === undefined ? null : <span className="lfr-field__suffix">{suffix}</span>}
      </div>
      {error !== undefined ? (
        <p className="lfr-field__error" id={errorId} role="alert">
          <span>{error}</span>
          {errorDetail === undefined ? null : (
            <span className="lfr-field__error-detail"> {errorDetail}</span>
          )}
        </p>
      ) : hint !== undefined ? (
        <p className="lfr-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps {
  readonly label: ReactNode;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint?: ReactNode;
  readonly error?: string | undefined;
  readonly disabled?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
}: TextFieldProps): JSX.Element {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <input
          {...control}
          className="lfr-input"
          type="text"
          value={value}
          disabled={disabled ?? false}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      )}
    </Field>
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value' | 'id'
> {
  readonly label: ReactNode;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly hint?: ReactNode;
  readonly suffix?: ReactNode;
}

export function SelectField(props: SelectFieldProps): JSX.Element {
  const { label, value, options, onChange, hint, suffix, ...rest } = props;
  return (
    <Field label={label} hint={hint} suffix={suffix}>
      {(control) => (
        <select
          {...rest}
          {...control}
          className="lfr-input lfr-select"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
