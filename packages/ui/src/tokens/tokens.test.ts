import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLOURS,
  CONTRAST_PAIRS,
  cssVariable,
  type ColourTokens,
  type ThemeName,
} from './tokens.js';

/**
 * WCAG 2.2, "relative luminance" (Understanding docs, glossary): each sRGB
 * channel c in 0..1 is c/12.92 if c <= 0.04045, else ((c+0.055)/1.055)^2.4;
 * L = 0.2126 R + 0.7152 G + 0.0722 B. "Contrast ratio" = (L1+0.05)/(L2+0.05)
 * with L1 the lighter. Used only here, to check the tokens (D-UI-2).
 */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast helper against known values', () => {
  it('black on white is 21:1 and white on white 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
  });
  it('#767676 on white is the well-known 4.54:1 and #777777 just fails 4.5', () => {
    // #767676: c = 118/255 = 0.46275, ((0.46275+0.055)/1.055)^2.4 = 0.18116; (1.05)/(0.23116) = 4.542.
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.542, 3);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
  });
});

describe('every token pair meets WCAG 2.2 AA in both themes', () => {
  for (const theme of ['light', 'dark'] as const satisfies readonly ThemeName[]) {
    for (const pair of CONTRAST_PAIRS) {
      it(`${theme}: ${pair.use} (${pair.fg} on ${pair.bg}) ≥ ${String(pair.minimum)}:1`, () => {
        const t = COLOURS[theme];
        expect(contrast(t[pair.fg], t[pair.bg])).toBeGreaterThanOrEqual(pair.minimum);
      });
    }
  }
});

describe('tokens.css declares exactly the values of tokens.ts', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');
  const blockAfter = (marker: string): string => {
    const start = css.indexOf(marker);
    return css.slice(start, css.indexOf('}', start));
  };
  const blocks: Record<string, { theme: ThemeName; text: string }> = {
    ':root': { theme: 'light', text: blockAfter(':root {') },
    'prefers dark': { theme: 'dark', text: blockAfter(":root:not([data-theme='light'])") },
    'data-theme dark': { theme: 'dark', text: blockAfter(":root[data-theme='dark']") },
  };
  for (const [name, { theme, text }] of Object.entries(blocks)) {
    it(name, () => {
      for (const key of Object.keys(COLOURS[theme]) as (keyof ColourTokens)[]) {
        expect(text, cssVariable(key)).toContain(`${cssVariable(key)}: ${COLOURS[theme][key]};`);
      }
    });
  }
  it('names variables in kebab case', () => {
    expect(cssVariable('safeText')).toBe('--lfr-safe-text');
    expect(cssVariable('bg')).toBe('--lfr-bg');
  });
});
