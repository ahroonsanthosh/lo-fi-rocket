/**
 * Size limits on everything the readers accept (plan 0061 step 1, D-090). A file, a pasted text or a
 * shared link may come from anyone; a hostile one must not exhaust the user's memory or freeze the
 * page. Every limit is far above any real file (a rocket design is kilobytes; OpenRocket files with
 * many stored simulations reach tens of megabytes, almost all of it flight data the reader skips).
 */
import { FormatError } from './errors.js';

/** Largest file or text the readers take: 64 MiB. */
export const MAX_INPUT_BYTES = 64 * 1024 * 1024;

/** Largest content unzipped from an `.ork` archive before it is abandoned: 256 MiB. */
export const MAX_UNZIPPED_BYTES = 256 * 1024 * 1024;

/** Largest XML handed to the parser once stored simulations are cut out: 16 MiB. */
export const MAX_XML_CHARACTERS = 16 * 1024 * 1024;

/** An input over a size limit: refused before it is read further. */
export class InputTooLargeError extends FormatError {
  readonly size: number;
  readonly limit: number;
  constructor(what: string, size: number, limit: number) {
    const mib = (n: number): string => `${(n / (1024 * 1024)).toFixed(1)} MiB`;
    // Just over the limit the two would print alike; then the exact sizes are given.
    const [shown, allowed] =
      mib(size) === mib(limit)
        ? [`${String(size)} bytes`, `${String(limit)} bytes`]
        : [mib(size), mib(limit)];
    super(
      `${what} is ${shown}, more than the ${allowed} this app reads; it is refused to protect your browser. Real design and motor files are far smaller: check that this is the file you meant.`,
    );
    this.size = size;
    this.limit = limit;
  }
}

/** Refuse `size` over `limit`. */
export function requireWithin(what: string, size: number, limit: number): void {
  if (size > limit) throw new InputTooLargeError(what, size, limit);
}
