/**
 * Phase 3 acceptance (CLAUDE.md 10): a new user builds and simulates a basic
 * rocket without documentation, and the example reproduces the Phase 2
 * figure. Runs against the built app in a real browser.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.js';

async function addComponent(page: Page, kind: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Add a component' }).selectOption(kind);
}

/** A result card's value: the dd after the dt whose visible label (or glossary term) is `label`. */
function resultValue(page: Page, label: string): Locator {
  const results = page.getByRole('region', { name: 'Flight' });
  return results
    .locator('dt')
    .filter({ has: page.getByRole('button', { name: label, exact: true }) })
    .or(results.locator(`dt:text-is("${label}")`))
    .locator('xpath=following-sibling::dd[1]');
}

/** File actions sit behind the File menu in the top bar. */
async function fileAction(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

async function setField(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label);
  await field.fill(value);
}

test('a new user builds a basic rocket, picks a motor and reads an apogee', async ({ page }) => {
  await page.goto('/');
  await fileAction(page, 'New');
  await expect(page.getByRole('region', { name: 'Stability', exact: true })).toContainText(
    'Add components',
  );
  await addComponent(page, 'noseCone');
  await addComponent(page, 'bodyTube');
  await addComponent(page, 'finSet');
  await addComponent(page, 'innerTube');
  // The 25 mm default outline gives an 18 mm mount tube; set the fin and mount defaults the editor proposed.
  await page.getByRole('listbox', { name: 'Motor' }).getByRole('option').click();
  await page
    .getByRole('combobox', { name: 'Motor mount tube' })
    .selectOption({ label: 'Motor mount tube' });
  await page.getByLabel('Only motors that fit the mount tube').uncheck();
  await page.getByRole('button', { name: 'Use E C6' }).click();
  await expect(page.getByRole('listbox', { name: 'Motor' })).toContainText('E C6');
  await page.getByRole('button', { name: 'Add parachute' }).click();
  const stability = page.getByRole('region', { name: 'Stability', exact: true });
  await expect(stability).toContainText('calibers');
  await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
  await page.getByRole('button', { name: 'Simulate flight' }).click();
  const apogee = await resultValue(page, 'Apogee').textContent();
  expect(apogee).toMatch(/^\d+\.\d\d m$/);
  expect(Number.parseFloat(apogee ?? '0')).toBeGreaterThan(5);
  await expect(page.getByRole('img', { name: 'Altitude above the pad' })).toBeVisible();
});

test('the example flies to the displayed apogee (DATCOM base drag, D-069) and survives a reload', async ({
  page,
}) => {
  await page.goto('/');
  await fileAction(page, 'Load example');
  await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
  await page.getByRole('button', { name: 'Simulate flight' }).click();
  await expect(resultValue(page, 'Apogee')).toHaveText('172.94 m');
  await expect(resultValue(page, 'Maximum velocity')).toHaveText('63.0 m/s');
  await expect(
    page.getByRole('region', { name: 'Warnings' }).getByText('No warnings.'),
  ).toBeVisible();
  // Rename, wait for the autosave, reload: the design comes back.
  await setField(page, 'Design name', 'Reloaded rocket');
  // Wait for the autosave itself rather than a fixed time: under load it can take longer.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((k) =>
          (localStorage.getItem(k) ?? '').includes('Reloaded rocket'),
        ),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Reloaded rocket');
  // Units toggle.
  await page.getByRole('radio', { name: 'Imperial' }).check();
  await expect(page.getByRole('region', { name: 'Stability', exact: true })).toContainText('in');
});

test('the key numbers are visible without scrolling at laptop size', async ({ page }) => {
  await page.goto('/');
  await fileAction(page, 'Load example');
  // The console never scrolls the page: the telemetry, the warnings and the rocket are on screen.
  const status = page.getByRole('region', { name: 'Status' });
  await expect(status).toBeInViewport();
  await expect(status).toContainText('1.84');
  await expect(status).toContainText('Typical range');
  await expect(page.getByRole('region', { name: 'Warnings' })).toBeInViewport();
  await expect(page.getByRole('img', { name: /standing nose up/ })).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Views' })).toBeInViewport();
  const scroll = await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
  expect(scroll).toBe(0);
});
