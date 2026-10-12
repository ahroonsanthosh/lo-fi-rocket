import type { JSX, ReactNode } from 'react';

/** Text for screen readers only; it stays in the accessibility tree. */
export function VisuallyHidden({ children }: { readonly children: ReactNode }): JSX.Element {
  return <span className="lfr-visually-hidden">{children}</span>;
}
