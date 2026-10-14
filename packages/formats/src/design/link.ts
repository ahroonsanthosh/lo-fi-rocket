/**
 * Design links (plan 0063): a design carried in a URL fragment, `#design=v1.<data>`, where
 * `<data>` is the design file text deflated and written in base64url (RFC 4648 section 5, no
 * padding). Browsers never send the fragment to a server. Decoding is bounded (D-090): the text,
 * the decompressed size and every field are checked before anything is used.
 */
import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';
import { FormatError } from '../errors.js';
import { InputTooLargeError, requireWithin } from '../limits.js';
import type { RocketDesign } from './model.js';
import { parseDesign, serializeDesign } from './serialize.js';

/** The fragment that marks a design link, with the encoding version. */
export const DESIGN_LINK_PREFIX = '#design=v1.';

/** Longest encoded design accepted: far above any design; browsers cap addresses near 2 MB. */
export const MAX_LINK_CHARACTERS = 512 * 1024;

/** Largest design text a link may expand to. */
export const MAX_LINK_DESIGN_BYTES = 4 * 1024 * 1024;

/** Compressed bytes handed to the decompressor at a time (as unzipEntry, D-090). */
const INFLATE_SLICE_BYTES = 16 * 1024;

/** A link that cannot be opened, with what is wrong. */
export class DesignLinkError extends FormatError {}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // Chunked: String.fromCharCode with a spread of a large array exceeds the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch (error) {
    throw new DesignLinkError('the link is damaged: its data is not valid base64url', {
      cause: error,
    });
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Inflate raw deflate data, abandoning it once the output passes `limit` bytes. */
function inflateLimited(data: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  const state: { total: number; failure: Error | undefined } = { total: 0, failure: undefined };
  const inflate = new Inflate((chunk) => {
    if (state.failure !== undefined) return;
    state.total += chunk.length;
    if (state.total > limit) {
      state.failure = new InputTooLargeError('The design in the link', state.total, limit);
      return;
    }
    chunks.push(chunk);
  });
  try {
    for (let at = 0; at < data.length && state.failure === undefined; at += INFLATE_SLICE_BYTES) {
      const end = Math.min(at + INFLATE_SLICE_BYTES, data.length);
      inflate.push(data.subarray(at, end), end === data.length);
    }
  } catch (error) {
    if (state.failure === undefined) {
      throw new DesignLinkError('the link is damaged: its data cannot be decompressed', {
        cause: error,
      });
    }
  }
  if (state.failure !== undefined) throw state.failure;
  const out = new Uint8Array(state.total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The fragment (`#design=v1.…`) that carries `design`. */
export function encodeDesignLink(design: RocketDesign): string {
  return `${DESIGN_LINK_PREFIX}${toBase64Url(deflateSync(strToU8(serializeDesign(design)), { level: 9 }))}`;
}

/** Whether a URL fragment is a design link (of any version). */
export function isDesignLink(fragment: string): boolean {
  return fragment.startsWith('#design=');
}

/** The design a fragment carries, validated as a design file; DesignLinkError or a FormatError otherwise. */
export function decodeDesignLink(fragment: string): RocketDesign {
  if (!fragment.startsWith(DESIGN_LINK_PREFIX)) {
    throw new DesignLinkError(
      isDesignLink(fragment)
        ? 'the link was made by a newer version of the app; open it with the current site'
        : 'this is not a design link',
    );
  }
  const data = fragment.slice(DESIGN_LINK_PREFIX.length);
  requireWithin('The link', data.length, MAX_LINK_CHARACTERS);
  if (!/^[A-Za-z0-9_-]*$/.test(data)) {
    throw new DesignLinkError('the link is damaged: it holds characters a design link never has');
  }
  const text = strFromU8(inflateLimited(fromBase64Url(data), MAX_LINK_DESIGN_BYTES));
  return parseDesign(text, 'the link');
}
