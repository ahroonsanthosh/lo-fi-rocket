/** The text a sighted user sees: hidden elements (closed tooltips, collapsed panels) removed, spaces collapsed. */
export function visibleText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[hidden]')) hidden.remove();
  return clone.textContent.replace(/\s+/g, ' ').trim();
}
