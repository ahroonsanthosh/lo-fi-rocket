/* global process, console, window */
/**
 * Screenshots of the redesign mockups (docs/ui/redesign.md section 9),
 * rendered from packages/ui itself. Run after building them:
 *
 *   pnpm --filter @lo-fi-rocket/ui mockups
 *   pnpm --filter @lo-fi-rocket/ui exec vite preview --config mockups/vite.config.ts --port 4174 &
 *   node tools/ui-walkthrough/mockups.js
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'docs/ui/mockups');
mkdirSync(out, { recursive: true });
const base = process.env['MOCKUP_URL'] ?? 'http://127.0.0.1:4174';
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];
const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });

const shots = [
  { name: 'after-design', screen: 'design', full: true },
  { name: 'after-problems', screen: 'problems' },
  { name: 'after-results', screen: 'results' },
  { name: 'after-transonic', screen: 'transonic', full: true },
  { name: 'after-motor', screen: 'motor' },
  { name: 'after-results-dark', screen: 'results', theme: 'dark' },
  { name: 'after-transonic-dark', screen: 'transonic', theme: 'dark' },
  { name: 'after-problems-narrow', screen: 'problems', width: 1024, full: true },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.width ?? 1366, height: 768 } });
  const theme = s.theme === undefined ? '' : `&theme=${s.theme}`;
  await page.goto(`${base}/?screen=${s.screen}${theme}`);
  await page.waitForTimeout(200);
  if (s.screen === 'problems') {
    // Show the inline validation: a root chord of 0 is rejected and the value in use is named.
    const chord = page.getByRole('textbox', { name: 'Root chord' });
    await chord.fill('100');
    await chord.fill('0');
  }
  await page.screenshot({ path: join(out, `${s.name}.png`) });
  if (s.full === true) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: join(out, `${s.name}-full.png`), fullPage: true });
  }
  console.log('saved', s.name);
  await page.close();
}
// Keyboard: a focused glossary term with its tooltip open.
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto(`${base}/?screen=results`);
await page.getByRole('button', { name: 'Apogee' }).first().focus();
await page.screenshot({ path: join(out, 'after-tooltip-focus.png') });
console.log('saved after-tooltip-focus');
await browser.close();
