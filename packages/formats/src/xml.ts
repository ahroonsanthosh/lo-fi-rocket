/**
 * Shared strict XML parsing for the .ork and .rse readers: well-formedness
 * check first, then an ordered element tree with string attributes and
 * text. Nothing is coerced to numbers here; each reader validates its own
 * fields.
 */
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { FormatError } from './errors.js';

export interface XmlNode {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlNode[];
  readonly text: string;
}

/** The document is not well-formed XML. */
export class XmlSyntaxError extends FormatError {
  readonly line: number | undefined;
  constructor(line: number | undefined, detail: string, options?: ErrorOptions) {
    super(
      `not well-formed XML${line === undefined ? '' : ` at line ${String(line)}`}: ${detail}`,
      options,
    );
    this.line = line;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Convert fast-xml-parser's preserveOrder output to XmlNode[]. */
function toNodes(raw: unknown): XmlNode[] {
  if (!Array.isArray(raw)) return [];
  const nodes: XmlNode[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const attributes: Record<string, string> = {};
    const rawAttrs = item[':@'];
    if (isRecord(rawAttrs)) {
      for (const [k, v] of Object.entries(rawAttrs)) {
        if (typeof v === 'string') attributes[k] = v;
      }
    }
    for (const [key, value] of Object.entries(item)) {
      if (key === ':@' || key === '#text') continue;
      const children = toNodes(value);
      const text = Array.isArray(value)
        ? value
            .filter(isRecord)
            .map((c) => c['#text'])
            .filter((t): t is string => typeof t === 'string')
            .join('')
        : '';
      nodes.push({ name: key, attributes, children, text });
    }
  }
  return nodes;
}

/** Parse a document into its top-level elements; throws XmlSyntaxError when malformed. */
export function parseXmlRoots(xml: string): XmlNode[] {
  try {
    SyntaxValidator.validate(xml);
  } catch (error) {
    // The validator throws a ValidationError carrying `line` and `message`.
    const line = isRecord(error) && typeof error['line'] === 'number' ? error['line'] : undefined;
    const message = error instanceof Error ? error.message : String(error);
    throw new XmlSyntaxError(line, message, { cause: error });
  }
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
  });
  return toNodes(parser.parse(xml));
}

/** Plain decimal or exponent number, as the simulator files write them ("29.", "5.0E-4", ".0108"). */
export const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
