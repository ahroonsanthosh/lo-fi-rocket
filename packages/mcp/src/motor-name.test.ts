/**
 * Plan 0079: motors named as people write them. The library is the session's bundled motors
 * (reference/motors: Estes C6, D12 and E16 written "E" or "Estes"; AeroTech F39T, G80NBT,
 * H123W, H128W and H238T written "AT").
 */
import { describe, expect, it } from 'vitest';
import { matchLibrary, parseMotorName, sameManufacturer } from './motor-name.js';
import { Session } from './session.js';

describe('parseMotorName', () => {
  it('reads the class, thrust, propellant letters and delay (NAR/TRA codes)', () => {
    expect(parseMotorName('D12-5')).toEqual({
      manufacturer: '',
      designation: 'D12',
      commonName: 'D12',
      delay: 5,
    });
    expect(parseMotorName('Estes D12')).toEqual({
      manufacturer: 'Estes',
      designation: 'D12',
      commonName: 'D12',
    });
    // AeroTech writes the propellant letter after the delay, or before it.
    expect(parseMotorName('G80-7T')).toMatchObject({ designation: 'G80T', delay: 7 });
    expect(parseMotorName('G80T-7')).toMatchObject({ designation: 'G80T', delay: 7 });
    expect(parseMotorName('AeroTech H128W-14A')).toMatchObject({
      manufacturer: 'AeroTech',
      designation: 'H128W',
      commonName: 'H128',
      delay: 14,
    });
    // A letter delay code is not a time; P is plugged.
    expect(parseMotorName('H128W-M')).toMatchObject({ designation: 'H128W', delayCode: 'M' });
    expect(parseMotorName('C6-P')).toMatchObject({ designation: 'C6', delay: 'plugged' });
    expect(parseMotorName('1/2A6-2')).toMatchObject({ designation: '1/2A6', delay: 2 });
    expect(parseMotorName('Estes D12-5 black powder')).toMatchObject({ designation: 'D12' });
  });

  it('says when nothing is a motor code', () => {
    expect(parseMotorName('a big one')).toBeUndefined();
    expect(parseMotorName('')).toBeUndefined();
    expect(parseMotorName('Z99-5')).toBeUndefined();
  });
});

describe('matchLibrary', () => {
  const library = [...new Session().motors.values()];
  const names = (written: string): string[] => {
    const parsed = parseMotorName(written);
    if (parsed === undefined) throw new Error(`not a code: ${written}`);
    return matchLibrary(parsed, library).map(
      (m) => `${m.definition.manufacturer} ${m.definition.designation}`,
    );
  };

  it('finds the bundled motors by code, with or without the maker', () => {
    expect(names('D12-5')).toEqual(['Estes D12']);
    expect(names('Estes C6-5')).toEqual(['E C6']);
    expect(names('AeroTech H128W')).toEqual(['AT H128W']);
    expect(names('F39-6T')).toEqual(['AT F39T']);
    // No propellant letter given: the one F39 in the library.
    expect(names('F39')).toEqual(['AT F39T']);
  });

  it('never puts another maker’s motor or another propellant in its place', () => {
    expect(names('Cesaroni D12')).toEqual([]);
    // The bundled G80 is the G80NBT; a G80T is looked up elsewhere.
    expect(names('G80-7T')).toEqual([]);
  });

  it('matches makers by name or abbreviation, never by a stray letter', () => {
    expect(sameManufacturer('AeroTech', 'AT')).toBe(true);
    expect(sameManufacturer('estes', 'Estes Industries')).toBe(true);
    expect(sameManufacturer('AeroTech', 'E')).toBe(false);
    expect(sameManufacturer('', 'AT')).toBe(true);
  });
});
