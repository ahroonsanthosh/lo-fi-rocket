/**
 * Phase 3 acceptance (CLAUDE.md 10): a new user builds and simulates a basic
 * rocket without documentation, and the example reproduces the Phase 2
 * figure. Runs against the built app in a real browser.
 */
import { expect, test, type Page } from '@playwright/test';

async function addComponent(page: Page, kind: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Add a component' }).selectOption(kind);
}

async function setField(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label);
  await field.fill(value);
}

test('a new user builds a basic rocket, picks a motor and reads an apogee', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByRole('region', { name: 'Stability' })).toContainText('Add components');
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
  const stability = page.getByRole('region', { name: 'Stability' });
  await expect(stability).toContainText('calibers');
  await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
  await page.getByRole('button', { name: 'Simulate flight' }).click();
  const results = page.getByRole('region', { name: 'Flight' });
  const apogee = await results.locator('dt:text-is("Apogee") + dd').textContent();
  expect(apogee).toMatch(/^\d+\.\d\d m$/);
  expect(Number.parseFloat(apogee ?? '0')).toBeGreaterThan(5);
  await expect(page.getByRole('img', { name: 'Altitude above the pad' })).toBeVisible();
});

test('the example flies to the Phase 2 displayed apogee and survives a reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('listbox', { name: 'Flight' }).getByRole('option').click();
  await page.getByRole('button', { name: 'Simulate flight' }).click();
  const results = page.getByRole('region', { name: 'Flight' });
  await expect(results.locator('dt:text-is("Apogee") + dd')).toHaveText('167.33 m');
  await expect(results.locator('dt:text-is("Maximum velocity") + dd')).toHaveText('62.3 m/s');
  await expect(results.getByText('No warnings.')).toBeVisible();
  // Rename, wait for the autosave, reload: the design comes back.
  await setField(page, 'Design name', 'Reloaded rocket');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Reloaded rocket');
  // Units toggle.
  await page.getByRole('radio', { name: 'Imperial' }).check();
  await expect(page.getByRole('region', { name: 'Stability' })).toContainText('in');
});

test('the key numbers are visible without scrolling at laptop size', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load example' }).click();
  const stability = page.getByRole('region', { name: 'Stability' });
  const box = await stability.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + 80).toBeLessThan(768);
  await expect(page.getByRole('img', { name: /Side view of the rocket/ })).toBeInViewport();
});
