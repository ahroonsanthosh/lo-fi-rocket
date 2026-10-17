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

test('Build with Claude: a pasted answer is built and flown in the browser, under the page policy', async ({
  page,
}) => {
  // Claude's answer for a small rocket (the paste box's own example, plan 0082), as Claude writes it.
  const answer = {
    name: 'Sport rocket',
    parts: [
      {
        kind: 'noseCone',
        name: 'Nose cone',
        fields: {
          shape: 'ogive',
          length: '100 mm',
          baseRadius: '20.5 mm',
          wallThickness: '1.5 mm',
        },
      },
      {
        kind: 'bodyTube',
        name: 'Body tube',
        fields: { length: '450 mm', outerRadius: '20.5 mm', wallThickness: '0.6 mm' },
      },
      {
        kind: 'innerTube',
        name: 'Motor mount',
        position: { relativeTo: 'Body tube', method: 'bottom' },
        fields: { length: '70 mm', outerRadius: '12 mm', wallThickness: '0.5 mm' },
      },
      {
        kind: 'finSet',
        name: 'Fins',
        fields: {
          count: 3,
          rootChord: '70 mm',
          tipChord: '30 mm',
          sweep: '40 mm',
          span: '50 mm',
          thickness: '3 mm',
        },
      },
    ],
    motor: { name: 'Estes D12-5' },
    recovery: [{ name: 'Parachute', diameter: '12 in', deploy: { event: 'ejection' } }],
  };
  await page.goto('/');
  await page.getByRole('button', { name: 'Build with Claude' }).click();
  const dialog = page.getByRole('dialog', { name: 'Build with Claude' });
  await expect(dialog.getByRole('button', { name: 'Copy the prompt' })).toBeEnabled();
  await dialog.getByText('Show the prompt').click();
  await expect(dialog.getByRole('textbox', { name: 'The prompt' })).toHaveValue(
    /^I am designing a model rocket/,
  );
  await dialog
    .getByLabel('Paste Claude’s answer here.')
    .fill(`Here is the specification:\n\`\`\`json\n${JSON.stringify(answer, null, 2)}\n\`\`\``);
  await dialog.getByRole('button', { name: 'Build and fly' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Sport rocket');
  await expect(page.getByRole('heading', { name: 'Simulate and results' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Flight' }).locator('.lfr-result__number').first(),
  ).toHaveText(/\d/);
});
