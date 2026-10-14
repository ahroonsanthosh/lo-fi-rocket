/**
 * RASAero II's example designs and motor file, for the tests that fly them (plans 0075 and 0080).
 * They are not redistributed: `reference/rasaero/fetch-examples.sh` downloads them into
 * `reference/rasaero/download/RASAero II/` (CI does the same). Test support only; not exported.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCdx1, type Cdx1Import } from '../cdx1.js';
import type { LibraryMotorRef } from '../design/from-ork.js';
import { parseEng } from '../eng.js';
import { motorFromEng } from '../motor-definition.js';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const RASAERO_DATA =
  process.env['RASAERO_DIR'] ?? join(REPO_ROOT, 'reference', 'rasaero', 'download', 'RASAero II');

/** True when the examples have been fetched. */
export function rasaeroExamplesPresent(): boolean {
  return existsSync(join(RASAERO_DATA, 'Examples')) && existsSync(join(RASAERO_DATA, 'rasp.eng'));
}

/** RASAero's `rasp.eng`, each motor read on its own so that one malformed entry skips only itself. */
export function raspLibrary(text: string): { library: LibraryMotorRef[]; skipped: string[] } {
  const blocks: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t === '' || t.startsWith(';')) continue;
    if (/^[-+.\d]/.test(t)) blocks.at(-1)?.push(t);
    else blocks.push([t]);
  }
  const library: LibraryMotorRef[] = [];
  const skipped: string[] = [];
  for (const b of blocks) {
    try {
      for (const eng of parseEng(b.join('\n'))) {
        library.push({ definition: motorFromEng(eng), provenance: { kind: 'custom' } });
      }
    } catch (e) {
      skipped.push(`${b[0] ?? '?'}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { library, skipped };
}

export interface Example {
  readonly file: string;
  readonly imported: Cdx1Import;
}

/** Every example design, imported with RASAero's own motor file, in file-name order. */
export function rasaeroExamples(): { examples: Example[]; motors: number; skipped: string[] } {
  const { library, skipped } = raspLibrary(readFileSync(join(RASAERO_DATA, 'rasp.eng'), 'latin1'));
  const dir = join(RASAERO_DATA, 'Examples');
  const examples = readdirSync(dir)
    .filter((f) => /\.cdx1$/i.test(f))
    .sort()
    .map((file) => ({
      file,
      imported: importCdx1(readFileSync(join(dir, file), 'latin1'), library, file, file),
    }));
  return { examples, motors: library.length, skipped };
}
