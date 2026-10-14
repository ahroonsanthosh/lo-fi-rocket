/**
 * Opening a design from a link (plan 0063): the `#design=` fragment, decoded and validated as a
 * design file by the formats package. The design gets a fresh id, so a link never overwrites a
 * stored design.
 */
import { decodeDesignLink, isDesignLink, newId, type RocketDesign } from '@lo-fi-rocket/formats';

export type LinkStart =
  | { readonly kind: 'none' }
  | { readonly kind: 'design'; readonly design: RocketDesign }
  | { readonly kind: 'invalid'; readonly message: string };

export function readDesignLink(fragment: string): LinkStart {
  if (!isDesignLink(fragment)) return { kind: 'none' };
  try {
    return { kind: 'design', design: { ...decodeDesignLink(fragment), id: newId() } };
  } catch (error) {
    return { kind: 'invalid', message: error instanceof Error ? error.message : String(error) };
  }
}
