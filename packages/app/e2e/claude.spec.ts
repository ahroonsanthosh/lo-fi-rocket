/**
 * The page that explains how to use the simulator with Claude (plan 0062 part 3): reached from the
 * File menu, under its own strict policy, with the downloads and the checksum file linked.
 */
import { expect, test } from './fixtures.js';

test('the File menu leads to the Claude page, which links the downloads and checksums', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('link', { name: 'Use with Claude' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Use Lo-Fi Rocket with Claude');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'none'");
  await expect(page.getByRole('link', { name: 'lo-fi-rocket.mcpb' })).toHaveAttribute(
    'href',
    'lo-fi-rocket.mcpb',
  );
  await expect(page.getByRole('link', { name: 'lo-fi-rocket-mcp.mjs' })).toHaveAttribute(
    'download',
    '',
  );
  await expect(page.getByRole('link', { name: 'SHA256SUMS' })).toBeVisible();
  await expect(page.getByText('claude mcp add --transport stdio lo-fi-rocket')).toBeVisible();
  await page.getByRole('link', { name: '← Back to the simulator' }).click();
  await expect(page.getByRole('button', { name: 'File' })).toBeVisible();
});
