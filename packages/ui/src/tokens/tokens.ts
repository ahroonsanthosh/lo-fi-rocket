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
  /** Side view and plot markers. */
  readonly cgMarker: string;
  readonly cpMarker: string;
}

export const COLOURS: Readonly<Record<ThemeName, ColourTokens>> = {
  light: {
    bg: '#f4f6f8',
    surface: '#ffffff',
    surfaceSunken: '#f0f3f6',
    text: '#1b1f24',
    textMuted: '#4f5966',
    borderSubtle: '#dde2e8',
    borderControl: '#77828f',
    accent: '#1f5fbf',
    onAccent: '#ffffff',
    focus: '#1f5fbf',
    safeText: '#166232',
    safeBg: '#e7f4eb',
    safeIndicator: '#1b7f3b',
    cautionText: '#6f4400',
    cautionBg: '#fff3d3',
    cautionIndicator: '#a86400',
    dangerText: '#9c1f18',
    dangerBg: '#fdeceb',
    dangerIndicator: '#b3261e',
    infoText: '#1a4b93',
    infoBg: '#e8f0fb',
    infoIndicator: '#1f5fbf',
    limitText: '#55358f',
    limitBg: '#f2edfa',
    limitIndicator: '#6b47ad',
    cgMarker: '#1b4f9c',
    cpMarker: '#b3261e',
  },
  dark: {
    bg: '#101317',
    surface: '#181d23',
    surfaceSunken: '#20262e',
    text: '#e7eaee',
    textMuted: '#a7b1bc',
    borderSubtle: '#2c343d',
    borderControl: '#7f8a97',
    accent: '#80b0ff',
    onAccent: '#0b1a33',
    focus: '#80b0ff',
    safeText: '#86dca0',
    safeBg: '#122a1b',
    safeIndicator: '#4cc272',
    cautionText: '#ffd27a',
    cautionBg: '#2d2310',
    cautionIndicator: '#e0a030',
    dangerText: '#ffa39b',
    dangerBg: '#33171a',
    dangerIndicator: '#ff6b61',
    infoText: '#a3c6ff',
    infoBg: '#14233a',
    infoIndicator: '#80b0ff',
    limitText: '#cdb9ff',
    limitBg: '#241d3a',
    limitIndicator: '#a98bf0',
    cgMarker: '#80b0ff',
    cpMarker: '#ff6b61',
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

export const RADIUS = { small: 4, medium: 8 } as const;

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
  { fg: 'cgMarker', bg: 'surfaceSunken', minimum: 3, use: 'CG marker in the side view' },
  { fg: 'cpMarker', bg: 'surfaceSunken', minimum: 3, use: 'CP marker in the side view' },
];

/** The CSS custom property name of a colour token: `safeText` → `--lfr-safe-text`. */
export function cssVariable(token: keyof ColourTokens): string {
  return `--lfr-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}
