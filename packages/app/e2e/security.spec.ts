/**
 * The built page carries its Content-Security-Policy and the browser enforces it (plan 0061
 * step 1, D-090).
 */
import { expect, test } from '@playwright/test';

test('the built page has the policy, and a load from an unlisted host is blocked', async ({
  page,
}) => {
  const blocked: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) blocked.push(m.text());
  });
  await page.goto('/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("object-src 'none'");
  // An image from a host the policy does not list: the browser refuses to request it.
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'https://unlisted.example/pixel.png';
    document.body.append(img);
  });
  await expect.poll(() => blocked.length).toBeGreaterThan(0);
  expect(blocked[0]).toContain('unlisted.example');
  // An inline script injected into the page does not run.
  const ran = await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__injected = true;';
    document.body.append(s);
    return (window as unknown as { __injected?: boolean }).__injected === true;
  });
  expect(ran).toBe(false);
});
