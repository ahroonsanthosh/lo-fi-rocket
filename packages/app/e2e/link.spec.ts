/**
 * A design link opens the design in the built app (plan 0063), and the fragment leaves the
 * address so a reload opens the stored copy.
 */
import { encodeDesignLink, exampleDesign } from '@lo-fi-rocket/formats';
import { expect, test } from './fixtures.js';

test('a design link opens the design, stores it and clears the address', async ({ page }) => {
  const fragment = encodeDesignLink({ ...exampleDesign('sender'), name: 'Linked rocket' });
  await page.goto(`/${fragment}`);
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Linked rocket');
  await expect(page.getByRole('region', { name: 'Warnings' })).toContainText(
    'Opened "Linked rocket" from a link',
  );
  expect(new URL(page.url()).hash).toBe('');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Linked rocket');
});
