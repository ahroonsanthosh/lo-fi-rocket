/**
 * Design links (plan 0063): exact round trips, and every hostile or damaged link refused with a
 * plain message before anything is used.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { InputTooLargeError } from '../limits.js';
import { parseOrk } from '../ork.js';
import { exampleDesign } from './example.js';
import { orkToDesign } from './from-ork.js';
import {
  decodeDesignLink,
  DESIGN_LINK_PREFIX,
  DesignLinkError,
  encodeDesignLink,
  MAX_LINK_CHARACTERS,
} from './link.js';
import { serializeDesign } from './serialize.js';

const ROCKETS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
  'rockets',
);

const b64url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('design links', () => {
  it('carry the example design exactly, in a few kilobytes of URL-safe text', () => {
    const design = exampleDesign();
    const link = encodeDesignLink(design);
    expect(link.startsWith(DESIGN_LINK_PREFIX)).toBe(true);
    expect(link.slice(DESIGN_LINK_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(link.length).toBeLessThan(4000);
    expect(serializeDesign(decodeDesignLink(link))).toBe(serializeDesign(design));
  });

  it('carry every reference rocket, with its import approximations, exactly', () => {
    for (const file of readdirSync(ROCKETS).filter((f) => f.endsWith('.ork'))) {
      let n = 0;
      const design = orkToDesign(
        parseOrk(new Uint8Array(readFileSync(join(ROCKETS, file))), file),
        [],
        'id',
        () => `part-${String((n += 1))}`,
      ).design;
      expect(serializeDesign(decodeDesignLink(encodeDesignLink(design))), file).toBe(
        serializeDesign(design),
      );
    }
  });

  it('refuse other fragments, newer versions, damaged data and bad characters', () => {
    expect(() => decodeDesignLink('#section=2')).toThrow('this is not a design link');
    expect(() => decodeDesignLink('#design=v2.abc')).toThrow(/newer version of the app/);
    expect(() => decodeDesignLink(`${DESIGN_LINK_PREFIX}abc<script>`)).toThrow(
      /characters a design link never has/,
    );
    const link = encodeDesignLink(exampleDesign());
    expect(() => decodeDesignLink(link.slice(0, link.length - 40))).toThrow(DesignLinkError);
    expect(() =>
      decodeDesignLink(`${DESIGN_LINK_PREFIX}${'A'.repeat(MAX_LINK_CHARACTERS + 1)}`),
    ).toThrow(InputTooLargeError);
  });

  it('validate what they carry as a design file', () => {
    const notADesign = `${DESIGN_LINK_PREFIX}${b64url(deflateSync(strToU8('{"schemaVersion":1,"id":"x"}')))}`;
    expect(() => decodeDesignLink(notADesign)).toThrow(/missing required field/);
    const notJson = `${DESIGN_LINK_PREFIX}${b64url(deflateSync(strToU8('<html>')))}`;
    expect(() => decodeDesignLink(notJson)).toThrow(/not valid JSON/);
  });

  it('stop a deflate bomb after a few megabytes, quickly', () => {
    // 64 MiB of spaces deflate to about 64 KiB (well inside the link limit).
    const bomb = `${DESIGN_LINK_PREFIX}${b64url(deflateSync(new Uint8Array(64 * 1024 * 1024).fill(32), { level: 9 }))}`;
    expect(bomb.length).toBeLessThan(MAX_LINK_CHARACTERS);
    const start = performance.now();
    expect(() => decodeDesignLink(bomb)).toThrow(
      /The design in the link is .* more than the 4.0 MiB/,
    );
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
