import axe from 'axe-core';

/**
 * axe-core on a whole page, with the landmark ("region") rule on.
 * Contrast is off for the reason given in axe.ts.
 */
export async function axePageViolations(element: Element): Promise<string[]> {
  const result = await axe.run(element, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}
