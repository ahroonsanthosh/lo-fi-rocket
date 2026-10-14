import type { JSX } from 'react';

/** The line icons of the dock and the toolbar. */
export type IconName = 'file' | 'settings' | 'chevron' | 'chevron-right' | 'back' | 'check';

const PATHS: Readonly<Record<IconName, readonly string[]>> = {
  file: ['M7 3h7l4.5 4.5V21H7z', 'M14 3v4.5h4.5'],
  settings: [
    'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
    'M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z',
  ],
  chevron: ['M7 9.5l5 5 5-5'],
  'chevron-right': ['M9.5 6.5l5.5 5.5-5.5 5.5'],
  back: ['M14.5 6.5 9 12l5.5 5.5'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
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
