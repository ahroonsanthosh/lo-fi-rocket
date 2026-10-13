import type { JSX } from 'react';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedProps<T extends string> {
  /** Accessible name of the group, for example "Units". */
  readonly legend: string;
  /** Name of the radio group; unique on the page. */
  readonly name: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/**
 * A two- or three-way switch drawn as joined buttons (the reference's
 * "Systems | Cabin"). Underneath it is a group of native radio buttons,
 * so the arrow keys, the labels and assistive technology work as for any
 * radio group; the selected option is shown filled.
 */
export function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: SegmentedProps<T>): JSX.Element {
  return (
    <fieldset className="lfr-segmented">
      <legend className="lfr-visually-hidden">{legend}</legend>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label key={o.value} className={`lfr-segmented__option${on ? ' is-on' : ''}`}>
            <input
              type="radio"
              className="lfr-segmented__input"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => {
                onChange(o.value);
              }}
            />
            <span>{o.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
