/**
 * Display units (plan 0024). The viewer holds SI values only and converts
 * nothing itself: the app supplies a formatter for the labels it draws, so
 * the units setting applies at the display boundary (CLAUDE.md section 5).
 */
export type FormatKind = 'm' | 'velocity' | 'acceleration' | 'angle' | 'time';

export interface Formatter {
  /** An SI value formatted in the display unit, with the unit label, for example "123.4 m". */
  format(si: number, kind: FormatKind): string;
}

/** SI labels with fixed decimals, for tests and as a fallback. */
export const SI_FORMATTER: Formatter = {
  format: (si, kind) => {
    switch (kind) {
      case 'm':
        return `${si.toFixed(2)} m`;
      case 'velocity':
        return `${si.toFixed(1)} m/s`;
      case 'acceleration':
        return `${si.toFixed(1)} m/s²`;
      case 'angle':
        return `${((si * 180) / Math.PI).toFixed(1)}°`;
      case 'time':
        return `${si.toFixed(3)} s`;
    }
  },
};
