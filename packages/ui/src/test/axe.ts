import axe from 'axe-core';

/**
 * Runs axe-core on a rendered element and returns the violations as
 * readable lines, so a failing test names the rule and the element.
 * Colour contrast is off here because jsdom does no layout or styling;
 * tokens.test.ts checks every colour pair against WCAG 2.2 AA instead.
 * The "region" rule is off because components are tested outside the
 * page landmarks they will sit in.
 */
export async function axeViolations(element: Element): Promise<string[]> {
  const result = await axe.run(element, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
    },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}
