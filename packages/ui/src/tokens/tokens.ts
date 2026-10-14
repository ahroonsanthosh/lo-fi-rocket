/**
 * Design tokens (docs/ui/redesign.md section 7). These values are the
 * single source; `tokens.css` declares the same values as CSS custom
 * properties and `tokens.test.ts` checks the two agree and that every
 * text and indicator pair meets WCAG 2.2 AA contrast (D-UI-2).
 *
 * Colour carries meaning only together with an icon and a text label
 * (WCAG 2.2 SC 1.4.1); the status colours below are never used alone.
 */

export type ThemeName = 'light' | 'dark';

export interface ColourTokens {
  /** Page background. */
  readonly bg: string;
  /** Panels and cards. */
  readonly surface: string;
  /** Inset areas: plots, the side view, table stripes. */
  readonly surfaceSunken: string;
  readonly text: string;
  /** Secondary text: labels, hints, units. */
  readonly textMuted: string;
  /** Decorative dividers only (exempt from 1.4.11); never the edge of a control. */
  readonly borderSubtle: string;
  /** Edges of inputs, selects and buttons: 3:1 against the surface (SC 1.4.11). */
  readonly borderControl: string;
  readonly accent: string;
  /** Text on an accent-filled button. */
  readonly onAccent: string;
  readonly focus: string;
  readonly safeText: string;
  readonly safeBg: string;
  readonly safeIndicator: string;
  readonly cautionText: string;
  readonly cautionBg: string;
  readonly cautionIndicator: string;
  readonly dangerText: string;
  readonly dangerBg: string;
  readonly dangerIndicator: string;
  readonly infoText: string;
  readonly infoBg: string;
  readonly infoIndicator: string;
  /** Model validity and limitation notices: not a hazard, but never hidden. */
  readonly limitText: string;
  readonly limitBg: string;
  readonly limitIndicator: string;
  /** A finished step or a neutral "done" mark: not a hazard and not a pass, just complete. */
  readonly neutralIndicator: string;
  /** Side view and plot markers. */
  readonly cgMarker: string;
  readonly cpMarker: string;
}

export const COLOURS: Readonly<Record<ThemeName, ColourTokens>> = {
  light: {
    bg: '#f4f4f4',
    surface: '#ffffff',
    surfaceSunken: '#f0f0f1',
    text: '#171a20',
    textMuted: '#5c5e62',
    borderSubtle: '#e3e3e4',
    borderControl: '#8a8b8f',
    accent: '#3456d1',
    onAccent: '#ffffff',
    focus: '#3456d1',
    safeText: '#14612f',
    safeBg: '#e8f5ec',
    safeIndicator: '#1b7f3b',
    cautionText: '#6f4400',
    cautionBg: '#fff4d6',
    cautionIndicator: '#a86400',
    dangerText: '#9c1f18',
    dangerBg: '#fdeceb',
    dangerIndicator: '#c62a22',
    infoText: '#22409f',
    infoBg: '#ebeffc',
    infoIndicator: '#3456d1',
    limitText: '#55358f',
    limitBg: '#f2edfa',
    limitIndicator: '#6b47ad',
    neutralIndicator: '#8a8b8f',
    cgMarker: '#3456d1',
    cpMarker: '#c62a22',
  },
  dark: {
    bg: '#111214',
    surface: '#1a1b1e',
    surfaceSunken: '#0b0b0d',
    text: '#f2f2f3',
    textMuted: '#a3a4a8',
    borderSubtle: '#2a2b2f',
    borderControl: '#6e7076',
    accent: '#6b8ff2',
    onAccent: '#0b0d14',
    focus: '#8fabff',
    safeText: '#7ddc9f',
    safeBg: '#11251a',
    safeIndicator: '#3fcf7c',
    cautionText: '#ffcf73',
    cautionBg: '#2b2213',
    cautionIndicator: '#f2a23a',
    dangerText: '#ff9e9a',
    dangerBg: '#2f1717',
    dangerIndicator: '#ff645c',
    infoText: '#a9c0ff',
    infoBg: '#161f38',
    infoIndicator: '#6b8ff2',
    limitText: '#cdb8ff',
    limitBg: '#221c35',
    limitIndicator: '#ad8bff',
    neutralIndicator: '#7c7e84',
    cgMarker: '#6b8ff2',
    cpMarker: '#ff6b6b',
  },
};

/** Spacing scale in px, a 4 px grid. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

/** Type scale: font size and line height in px. */
export const TYPE = {
  caption: { size: 12, line: 16 },
  small: { size: 13, line: 18 },
  body: { size: 15, line: 22 },
  heading: { size: 17, line: 24 },
  title: { size: 20, line: 28 },
  figure: { size: 28, line: 34 },
} as const;

export const RADIUS = { small: 6, medium: 10, large: 16 } as const;

/**
 * The text and indicator pairs the components use. Each must meet the
 * contrast in `minimum` (4.5 for text, 3 for non-text indicators and
 * control edges, WCAG 2.2 SC 1.4.3 and 1.4.11).
 */
export const CONTRAST_PAIRS: readonly {
  readonly fg: keyof ColourTokens;
  readonly bg: keyof ColourTokens;
  readonly minimum: 4.5 | 3;
  readonly use: string;
}[] = [
  { fg: 'text', bg: 'bg', minimum: 4.5, use: 'body text on the page' },
  { fg: 'text', bg: 'surface', minimum: 4.5, use: 'body text in a panel' },
  { fg: 'text', bg: 'surfaceSunken', minimum: 4.5, use: 'text in a plot or table stripe' },
  { fg: 'textMuted', bg: 'surface', minimum: 4.5, use: 'labels, hints and units' },
  { fg: 'textMuted', bg: 'bg', minimum: 4.5, use: 'labels on the page background' },
  { fg: 'textMuted', bg: 'surfaceSunken', minimum: 4.5, use: 'labels in an inset' },
  { fg: 'accent', bg: 'surface', minimum: 4.5, use: 'links and selected tab text' },
  { fg: 'onAccent', bg: 'accent', minimum: 4.5, use: 'primary button text' },
  { fg: 'borderControl', bg: 'surface', minimum: 3, use: 'input and button edges' },
  { fg: 'focus', bg: 'surface', minimum: 3, use: 'focus ring on a panel' },
  { fg: 'focus', bg: 'bg', minimum: 3, use: 'focus ring on the page' },
  { fg: 'safeText', bg: 'safeBg', minimum: 4.5, use: 'safe status text' },
  { fg: 'cautionText', bg: 'cautionBg', minimum: 4.5, use: 'caution warning text' },
  { fg: 'dangerText', bg: 'dangerBg', minimum: 4.5, use: 'danger warning text' },
  { fg: 'infoText', bg: 'infoBg', minimum: 4.5, use: 'information notice text' },
  { fg: 'limitText', bg: 'limitBg', minimum: 4.5, use: 'model limitation notice text' },
  { fg: 'text', bg: 'safeBg', minimum: 4.5, use: 'body text inside a safe card' },
  { fg: 'text', bg: 'cautionBg', minimum: 4.5, use: 'body text inside a caution banner' },
  { fg: 'text', bg: 'dangerBg', minimum: 4.5, use: 'body text inside a danger banner' },
  { fg: 'text', bg: 'limitBg', minimum: 4.5, use: 'body text inside a limitation notice' },
  { fg: 'safeIndicator', bg: 'surface', minimum: 3, use: 'safe stripe and icon' },
  { fg: 'cautionIndicator', bg: 'surface', minimum: 3, use: 'caution stripe and icon' },
  { fg: 'dangerIndicator', bg: 'surface', minimum: 3, use: 'danger stripe and icon' },
  { fg: 'infoIndicator', bg: 'surface', minimum: 3, use: 'information stripe and icon' },
  { fg: 'limitIndicator', bg: 'surface', minimum: 3, use: 'limitation stripe and icon' },
  { fg: 'neutralIndicator', bg: 'surface', minimum: 3, use: 'finished step mark' },
  { fg: 'borderControl', bg: 'bg', minimum: 3, use: 'control edges on the page background' },
  { fg: 'accent', bg: 'bg', minimum: 4.5, use: 'links and selection on the page background' },
  { fg: 'cgMarker', bg: 'surfaceSunken', minimum: 3, use: 'CG marker in the side view' },
  { fg: 'cpMarker', bg: 'surfaceSunken', minimum: 3, use: 'CP marker in the side view' },
];

/** The CSS custom property name of a colour token: `safeText` → `--lfr-safe-text`. */
export function cssVariable(token: keyof ColourTokens): string {
  return `--lfr-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}
