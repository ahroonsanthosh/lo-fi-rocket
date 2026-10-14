/**
 * The 3D replay in a real browser (plan 0034): the example flies, the
 * canvas renders, seeking to an event shows the flight panel's own figure
 * for it, the cameras switch, playback runs, and the Monte Carlo landing
 * points appear with a run that can be replayed. With VIEWER_SCREENSHOTS=1
 * the screenshots for docs/reports/3d-viewer.md are written.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SHOTS = process.env['VIEWER_SCREENSHOTS'] === '1';
const SHOT_DIR = join(process.cwd(), '..', '..', 'docs', 'reports', 'images');

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.getByRole('region', { name: '3D replay' }).screenshot({
    path: join(SHOT_DIR, `${name}.png`),
  });
}

async function simulateExample(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
  await page.getByRole('button', { name: 'Simulate flight' }).click();
  await expect(page.getByRole('region', { name: '3D replay' })).toBeVisible();
}

test('the replay shows the stored apogee figure of the flight panel at the apogee event', async ({
  page,
}) => {
  await simulateExample(page);
  const viewer = page.getByRole('region', { name: '3D replay' });
  await expect(viewer.getByRole('img', { name: '3D replay of the flight' })).toBeVisible();
  await expect(viewer.locator('.viewer-unavailable')).toHaveCount(0);
  await expect(viewer.locator('.viewer-label-event', { hasText: 'Launch' })).toBeVisible();
  await expect(viewer.locator('.viewer-label-wind')).toHaveText(/Wind|No wind/);
  await shot(page, '3d-viewer-start');
  const results = page.getByRole('region', { name: 'Flight' });
  // Apogee's label is a glossary term (a button with a tooltip), so match the button.
  const apogee = await results
    .locator('dt')
    .filter({ has: page.getByRole('button', { name: 'Apogee', exact: true }) })
    .locator('xpath=following-sibling::dd[1]')
    // The figure itself, without its real-flight range (plan 0080).
    .locator('.lfr-result__number')
    .textContent();
  const toApogee = await results.locator('dt:text-is("Time to apogee") + dd').textContent();
  await viewer.getByRole('button', { name: /^Apogee / }).click();
  await expect(viewer.locator('dt:text-is("Altitude") + dd')).toHaveText(apogee ?? '');
  // The flight panel prints the time to apogee with 2 decimals, the replay its stored step with 3:
  // the two agree within the sum of their half display units (0.005 + 0.0005 s). Comparing the
  // two after rounding again fails whenever the time falls on a rounding boundary.
  const step = (await viewer.locator('dt:text-is("Stored step") + dd').textContent()) ?? '';
  const stepTime = Number.parseFloat(/at ([\d.]+) s/.exec(step)?.[1] ?? 'NaN');
  expect(Math.abs(stepTime - Number.parseFloat(toApogee ?? 'NaN'))).toBeLessThanOrEqual(0.0055);
  expect(step).toContain('(descent)');
  // The follow camera looks at the rocket, so the apogee marker's label is in view.
  await expect(viewer.locator('.viewer-label-event', { hasText: 'Apogee' })).toBeVisible();
  await shot(page, '3d-viewer-apogee');
  // Cameras.
  await page.getByLabel('Camera').selectOption('pad');
  await shot(page, '3d-viewer-pad');
  await page.getByLabel('Camera').selectOption('overview');
  await shot(page, '3d-viewer-overview');
  await page.getByLabel('Camera').selectOption('orbit');
  await shot(page, '3d-viewer-orbit');
  await page.getByLabel('Camera').selectOption('follow');
  // Playback from the start at half speed: the time advances and the readouts follow a stored
  // step of the powered phase (burnout is at 1.65 s; half a second of wall clock is 0.25 s of flight).
  await viewer.getByRole('button', { name: /^Launch / }).click();
  await page.getByLabel('Replay speed').selectOption('0.5');
  await viewer.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(500);
  await viewer.getByRole('button', { name: 'Pause' }).click();
  const t = Number.parseFloat((await viewer.locator('.viewer-time').textContent()) ?? '0');
  expect(t).toBeGreaterThan(0.15);
  expect(t).toBeLessThan(1.65);
  await expect(viewer.locator('dt:text-is("Stored step") + dd')).toContainText('powered');
  await shot(page, '3d-viewer-powered');
  // Landing: the readouts show the landing step and no stability margin.
  await viewer.getByRole('button', { name: /^Landing / }).click();
  await expect(viewer.locator('dt:text-is("Stability margin") + dd')).toHaveText(
    'not available in this phase',
  );
  // Units.
  await page.getByRole('radio', { name: 'Imperial' }).check();
  await viewer.getByRole('button', { name: /^Apogee / }).click();
  await expect(viewer.locator('dt:text-is("Altitude") + dd')).toHaveText(/ ft$/);
  await page.getByRole('radio', { name: 'Metric' }).check();
});

test('the Monte Carlo landing points appear and a run replays', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
  // The dispersion settings are part of the design: set them before the flight so both share it.
  await page.getByLabel('Wind speed standard deviation').fill('2');
  await page.getByLabel('Runs').fill('20');
  await page.getByRole('button', { name: 'Simulate flight' }).click();
  const viewer = page.getByRole('region', { name: '3D replay' });
  await expect(viewer).toBeVisible();
  await page.getByRole('button', { name: 'Run dispersion' }).click();
  await expect(page.getByRole('region', { name: 'Dispersion results' })).toBeVisible({
    timeout: 60_000,
  });
  const picker = page.getByLabel('Replay run');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option')).toHaveCount(21);
  await page.getByLabel('Camera').selectOption('overview');
  await shot(page, '3d-viewer-dispersion');
  await picker.selectOption('4');
  await expect(viewer.locator('dt:text-is("Shown") + dd')).toHaveText('Monte Carlo run 5');
  await viewer.getByRole('button', { name: /^Landing / }).click();
  await shot(page, '3d-viewer-run');
  await picker.selectOption('');
  await expect(viewer.locator('dt:text-is("Shown") + dd')).toHaveText('This flight');
});
