/**
 * Usability walkthrough of the current app (docs/ui/review.md). Drives the
 * built app as a new user would and saves a screenshot at each step into
 * docs/ui/review/. Run with the preview server on 127.0.0.1:4173:
 *
 *   pnpm --filter @lo-fi-rocket/app build
 *   pnpm --filter @lo-fi-rocket/app exec vite preview --host 127.0.0.1 --port 4173 &
 *   node tools/ui-walkthrough/walkthrough.js
 *
 * It changes nothing in the app; it only reads the screen.
 */
/* global process, console */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'docs/ui/review');
mkdirSync(out, { recursive: true });
const base = process.env['APP_URL'] ?? 'http://127.0.0.1:4173';
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const shot = async (name, target) => {
  const path = join(out, `${name}.png`);
  if (target === undefined) await page.screenshot({ path });
  else await target.screenshot({ path });
  console.log('saved', name);
};
/** The results block, or the error shown when the flight could not run. */
const flightOutcome = () => page.locator('.results, .right [role=alert]').first();
/** Lets a panel grow to its content so a whole panel fits in one image (documentation only). */
const unclip = () =>
  page.addStyleTag({
    content: '.app{height:auto!important}.left,.right,.centre{overflow:visible!important}',
  });

await page.goto(base);
await page.waitForTimeout(500);
await shot('01-first-load');

// A new user starts from scratch.
await page.getByRole('button', { name: 'New' }).click();
await shot('02-new-empty');
const add = (kind) => page.getByRole('combobox', { name: 'Add a component' }).selectOption(kind);
await add('noseCone');
await shot('03-nose-added');
await add('bodyTube');
await add('finSet');
await shot('04-fins-added');
await add('innerTube');
await page.getByLabel('Length', { exact: true }).fill('0');
await shot('05-invalid-field');
await page.getByLabel('Length', { exact: true }).fill('70');

// The motor.
await page.getByRole('listbox', { name: 'Motor' }).getByRole('option').click();
await shot('06-motor-panel');
await page
  .getByRole('combobox', { name: 'Motor mount tube' })
  .selectOption({ label: 'Motor mount tube' });
await shot('07-motor-library-filtered');
await page.getByLabel('Only motors that fit the mount tube').uncheck();
await page.getByRole('button', { name: 'Use E C6' }).click();
await shot('08-motor-selected');

// Launch and simulate, without a parachute.
await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
await shot('09-launch-editor');
await page.getByRole('button', { name: 'Simulate flight' }).click();
await flightOutcome().waitFor();
await shot('10-results-viewport');
await flightOutcome().scrollIntoViewIfNeeded();
await shot('11-results-scrolled');

// Recovery.
await page.getByRole('button', { name: 'Add parachute' }).click();
await shot('12-recovery-editor');

// The example flight.
await page.getByRole('button', { name: 'Load example' }).click();
await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
await page.getByRole('button', { name: 'Simulate flight' }).click();
await flightOutcome().waitFor();
await shot('13-example-results');
await page.locator('.centre').evaluate((el) => {
  el.scrollTop = el.scrollHeight;
});
await shot('14-plots');

// A launch warning.
await page.getByLabel('Rail angle from vertical').fill('35');
await shot('15-launch-warning');
await page.getByLabel('Rail angle from vertical').fill('0');
await shot('16-stale-results');

// Thresholds and settings.
await page.getByText('Warning and stability thresholds').click();
await page.getByText('Simulation settings').click();
await page.getByText('Simulation settings').scrollIntoViewIfNeeded();
await shot('17-settings-open');

// Monte Carlo.
await page.getByLabel('Wind speed standard deviation').fill('2');
await page.getByRole('button', { name: 'Run dispersion' }).click();
await page.getByRole('region', { name: 'Dispersion results' }).waitFor({ timeout: 120_000 });
await page.getByRole('region', { name: 'Dispersion results' }).scrollIntoViewIfNeeded();
await shot('18-dispersion');

// Units.
await page.getByRole('radio', { name: 'Imperial' }).check();
await page.locator('.right').evaluate((el) => {
  el.scrollTop = 0;
});
await shot('19-imperial');
await page.getByRole('radio', { name: 'Metric' }).check();

// Stability out of range: remove the fins of the example.
await page.getByRole('listbox', { name: 'Component list' }).getByText('Fins').click();
await page.keyboard.press('Delete');
await shot('20-unstable');

// .ork import of the transonic reference rocket and its supersonic warnings.
await page
  .getByLabel('Import an OpenRocket file')
  .setInputFiles(join(root, 'reference/rockets/r5-transonic-min-dia-29.ork'));
await page.waitForTimeout(300);
await shot('21-ork-import');
await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
const sim = page.getByRole('button', { name: 'Simulate flight' });
if (await sim.isEnabled()) {
  await sim.click();
  await flightOutcome().waitFor({ timeout: 120_000 });
  await flightOutcome().scrollIntoViewIfNeeded();
}
await shot('22-ork-flight-warnings');

// Stored designs.
await page.getByRole('button', { name: 'Designs' }).click();
await shot('23-designs-list');
await page.getByRole('button', { name: 'Designs' }).click();

// Keyboard: tab through the header and into the list.
await page.goto(base);
await page.waitForTimeout(300);
for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
await shot('24-keyboard-focus');

// Narrow window.
await page.setViewportSize({ width: 1024, height: 768 });
await shot('25-narrow-window');

// Whole panels, unclipped, for reference.
await page.setViewportSize({ width: 1366, height: 768 });
await page.getByRole('button', { name: 'Load example' }).click();
await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
await unclip();
await shot('26-flight-panel-full', page.locator('.right'));

await browser.close();
