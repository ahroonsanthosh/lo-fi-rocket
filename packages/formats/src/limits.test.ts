/**
 * Size limits and the document type refusal (plan 0061 step 1, D-090): hostile files are refused
 * with a plain message before they can exhaust memory, and real files are untouched.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseDesign } from './design/serialize.js';
import { parseEng } from './eng.js';
import { RseParseError } from './errors.js';
import {
  InputTooLargeError,
  MAX_INPUT_BYTES,
  MAX_XML_CHARACTERS,
  requireWithin,
} from './limits.js';
import { parseThrustCurveCsv } from './motors/csv-thrust-curve.js';
import { parseDragCurveCsv } from './motors/drag-curve.js';
import { parseFlightDataCsv } from './motors/flight-data.js';
import { parseOrk, unzipEntry } from './ork.js';
import { parseRse } from './rse.js';
import { parseXmlRoots, XmlSyntaxError } from './xml.js';
import { kilograms, metres } from '@lo-fi-rocket/physics';

const ROCKETS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'rockets',
);
const r1 = (): Uint8Array =>
  new Uint8Array(readFileSync(join(ROCKETS, 'r1-three-fin-conical.ork')));
const r1Xml = (): string => {
  const entry = unzipSync(r1())['rocket.ork'];
  if (entry === undefined) throw new Error('no rocket.ork entry');
  return strFromU8(entry);
};

describe('requireWithin', () => {
  it('accepts the limit itself and refuses one more, naming both sizes', () => {
    expect(() => {
      requireWithin('x', 10, 10);
    }).not.toThrow();
    expect(() => {
      requireWithin('The file', 11, 10);
    }).toThrow('The file is 11 bytes, more than the 10 bytes this app reads');
    // 3 MiB against 2 MiB prints in MiB.
    expect(() => {
      requireWithin('The file', 3 * 1024 * 1024, 2 * 1024 * 1024);
    }).toThrow('The file is 3.0 MiB, more than the 2.0 MiB this app reads');
  });
});

describe('zip bomb defence (unzipEntry)', () => {
  // 1 MiB of zeros deflates to about a kilobyte: a small bomb with the same shape as a large one.
  const zeros = zipSync({ 'rocket.ork': new Uint8Array(1024 * 1024) });

  it('abandons an entry once it produces more bytes than the limit', () => {
    expect(zeros.length).toBeLessThan(10_000);
    expect(() => unzipEntry(zeros, 'rocket.ork', 64 * 1024)).toThrow(InputTooLargeError);
  });

  it('stops decompressing at the first slice past the limit, not at the end of the entry', () => {
    // 64 MiB of zeros deflate to about 64 KiB, fed to the decompressor 16 KiB at a time; each
    // slice expands to at most about 16 MiB (deflate's maximum ratio is about 1032:1).
    const bomb = zipSync({ 'rocket.ork': new Uint8Array(64 * 1024 * 1024) });
    let error: unknown;
    try {
      unzipEntry(bomb, 'rocket.ork', 64 * 1024);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InputTooLargeError);
    const tooLarge = error as InputTooLargeError;
    expect(tooLarge.limit).toBe(64 * 1024);
    expect(tooLarge.size).toBeGreaterThan(64 * 1024);
    expect(tooLarge.size).toBeLessThanOrEqual(17 * 1024 * 1024);
  });

  it('returns the exact bytes within the limit, and the entry names when the entry is absent', () => {
    const r = unzipEntry(zeros, 'rocket.ork', 1024 * 1024);
    expect(r.entry?.length).toBe(1024 * 1024);
    expect(r.entry?.every((b) => b === 0)).toBe(true);
    const other = unzipEntry(zipSync({ 'a.txt': strToU8('a') }), 'rocket.ork', 1024);
    expect(other).toEqual({ entry: undefined, names: ['a.txt'] });
    // The OpenRocket reference file (Java zip with data descriptors) unzips to the same XML.
    expect(strFromU8(unzipEntry(r1(), 'rocket.ork', 1024 * 1024).entry ?? new Uint8Array())).toBe(
      r1Xml(),
    );
  });
});

describe('.ork size limits', () => {
  it('refuses a file over 64 MiB before reading it', () => {
    expect(() => parseOrk(new Uint8Array(MAX_INPUT_BYTES + 1), 'big.ork')).toThrow(
      InputTooLargeError,
    );
  });

  it('skips stored simulations, so a design with megabytes of flight data still opens', () => {
    const xml = r1Xml();
    const padded = xml.replace(
      '</simulations>',
      `<!-- ${'0'.repeat(MAX_XML_CHARACTERS + 1)} --></simulations>`,
    );
    expect(padded.length).toBeGreaterThan(MAX_XML_CHARACTERS);
    expect(parseOrk(padded)).toEqual(parseOrk(xml));
  });

  it('refuses a design part over 16 MiB', () => {
    const xml = r1Xml().replace('<rocket>', `<rocket><!-- ${'0'.repeat(MAX_XML_CHARACTERS)} -->`);
    expect(() => parseOrk(xml, 'big.ork')).toThrow(
      /The design in big.ork is \d+ bytes, more than the 16777216 bytes/,
    );
  });
});

describe('document type declarations are refused (billion laughs)', () => {
  const laughs = [
    '<?xml version="1.0"?>',
    '<!DOCTYPE lolz [',
    ' <!ENTITY lol "lol">',
    ' <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">',
    ']>',
    '<openrocket version="1.10"><rocket>&lol2;</rocket></openrocket>',
  ].join('\n');

  it('parseXmlRoots refuses a DOCTYPE or ENTITY, naming the line', () => {
    let error: unknown;
    try {
      parseXmlRoots(laughs);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(XmlSyntaxError);
    expect((error as XmlSyntaxError).line).toBe(2);
    expect((error as Error).message).toMatch(/document type declaration \(<!DOCTYPE\)/);
    expect(() => parseXmlRoots('<a><!ENTITY x "y"></a>')).toThrow(/<!ENTITY/);
    expect(() => parseXmlRoots('<a>\n<!doctype a></a>')).toThrow(XmlSyntaxError);
  });

  it('parseOrk and parseRse refuse it too', () => {
    expect(() => parseOrk(laughs, 'laughs.ork')).toThrow(/document type declaration/);
    expect(() => parseRse(laughs, {}, 'laughs.rse')).toThrow(RseParseError);
  });

  it('documents without one are unchanged', () => {
    expect(parseXmlRoots('<?xml version="1.0"?><a b="1">t</a>')).toEqual([
      { name: 'a', attributes: { b: '1' }, children: [], text: 't' },
    ]);
  });
});

describe('text readers refuse inputs over 64 MiB', () => {
  const huge = ' '.repeat(MAX_INPUT_BYTES + 1);
  const meta = {
    designation: 'X',
    manufacturer: 'Y',
    diameter: metres(0.029),
    length: metres(0.1),
    totalMass: kilograms(0.1),
    propellantMass: kilograms(0.05),
  };
  it.each([
    ['parseDesign', () => parseDesign(huge, 'a.lofi.json')],
    ['parseEng', () => parseEng(huge, 'a.eng')],
    ['parseRse', () => parseRse(huge, {}, 'a.rse')],
    ['parseDragCurveCsv', () => parseDragCurveCsv(huge, 'd', 'd.csv')],
    ['parseThrustCurveCsv', () => parseThrustCurveCsv(huge, meta, 't.csv')],
    ['parseFlightDataCsv', () => parseFlightDataCsv(huge, 'f', 'm', 'f.csv')],
  ])('%s', (_name, read) => {
    expect(read).toThrow(InputTooLargeError);
  });
});
