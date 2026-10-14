/** The bundled motor texts are the reference files, byte for byte (plan 0062). */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEng } from '../eng.js';
import { BUNDLED_MOTOR_FILES } from './bundled.js';

const MOTORS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'reference',
  'motors',
);

describe('BUNDLED_MOTOR_FILES', () => {
  it('holds the eight RASP files of reference/motors unchanged, each with one motor', () => {
    expect(BUNDLED_MOTOR_FILES.map((m) => m.file).sort()).toEqual([
      'AeroTech_F39T.eng',
      'AeroTech_G80T.eng',
      'AeroTech_H123W.eng',
      'AeroTech_H128W.eng',
      'AeroTech_H238T.eng',
      'Estes_C6.eng',
      'Estes_D12.eng',
      'Estes_E16.eng',
    ]);
    for (const { file, text } of BUNDLED_MOTOR_FILES) {
      expect(text).toBe(readFileSync(join(MOTORS, file), 'utf8'));
      expect(parseEng(text, file)).toHaveLength(1);
    }
  });
});
