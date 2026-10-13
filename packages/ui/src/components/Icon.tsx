import type { JSX } from 'react';

/** The line icons of the dock and the toolbar. */
export type IconName =
  | 'overview'
  | 'airframe'
  | 'motor'
  | 'recovery'
  | 'launch'
  | 'flight'
  | 'file'
  | 'sun'
  | 'moon'
  | 'book'
  | 'chevron';

const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  overview: [
    'M12 2.6c2.7 2.2 4.1 5.3 4.1 9v5.4H7.9v-5.4c0-3.7 1.4-6.8 4.1-9z',
    'M7.9 13.2 5.2 15.9v3.5l2.7-1.7M16.1 13.2l2.7 2.7v3.5l-2.7-1.7',
    'M10.4 19.6 12 22l1.6-2.4',
  ],
  airframe: ['M3 9.5h13.5L21 12l-4.5 2.5H3z', 'M6.5 9.5 4.5 6.5h2.8l2.7 3M6.5 14.5l-2 3h2.8l2.7-3'],
  motor: [
    'M12 2.8c1.6 3.1 4.6 4.9 4.6 9.3a4.6 4.6 0 0 1-9.2 0c0-2.3 1.1-3.7 2.3-4.9.2 1.7.9 2.6 2 3.2-.6-2.8-.4-5.1.3-7.6z',
    'M12 21.5v-2.2',
  ],
  recovery: [
    'M3.5 11.2a8.5 8.5 0 0 1 17 0z',
    'M3.5 11.2 11 18.6M20.5 11.2 13 18.6M9.2 11.2l2 7.4M14.8 11.2l-2 7.4',
    'M10.6 18.6h2.8v2.8h-2.8z',
  ],
  launch: ['M4.5 21h15', 'M8 21 15.5 3.5', 'M12.2 12.2l3.4 1.5M10.4 16.4l3.4 1.5', 'M17 21v-4'],
  flight: ['M3.5 20.5C6 11 11.5 5.6 19 4.5', 'M3 20.5h18', 'M16.6 3.4 19.3 4.4 18.1 7'],
  file: ['M7 3h7l4.5 4.5V21H7z', 'M14 3v4.5h4.5', 'M9.8 12.5h6M9.8 16h6'],
  sun: [
    'M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z',
    'M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6',
  ],
  moon: ['M19.5 14.8A8 8 0 0 1 9.2 4.5 8 8 0 1 0 19.5 14.8z'],
  book: [
    'M5 4.5h9.5A3.5 3.5 0 0 1 18 8v12H8.5A3.5 3.5 0 0 1 5 16.5z',
    'M5 16.5A3.5 3.5 0 0 1 8.5 13H18',
  ],
  chevron: ['M7 9.5l5 5 5-5'],
};

/** A decorative line icon; the text label next to it carries the meaning. */
export function Icon({
  name,
  size = 22,
}: {
  readonly name: IconName;
  readonly size?: number;
}): JSX.Element {
  return (
    <svg
      className={`lfr-line-icon lfr-line-icon--${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
