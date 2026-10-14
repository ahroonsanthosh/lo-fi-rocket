/**
 * The Playwright test with a Content-Security-Policy watch (plan 0061 step 1, D-090): every
 * end-to-end test fails if the built page tries to load anything its policy blocks, so a new
 * script, worker or outside service cannot break the published site unnoticed.
 */
import { expect, test as base } from '@playwright/test';

export { expect };

export const test = base.extend<{ policyViolations: string[] }>({
  policyViolations: [
    async ({ page }, use) => {
      const violations: string[] = [];
      // Chromium reports a blocked load as a console error; the event also names the directive.
      page.on('console', (m) => {
        if (m.type() === 'error' && /Content Security Policy|CSP violation/i.test(m.text())) {
          violations.push(m.text());
        }
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`);
        });
      });
      await use(violations);
      expect(violations, 'Content-Security-Policy violations').toEqual([]);
    },
    { auto: true },
  ],
});
