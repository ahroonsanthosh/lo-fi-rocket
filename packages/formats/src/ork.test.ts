/**
 * .ork reader tests (plan 0005). The reference files are the ones OpenRocket
 * 24.12 wrote for reference/rockets; the expected components are the hand
 * transcription in the physics package, the expected masses and CGs are
 * OpenRocket's own per-component report (black-box reference), and the
 * liftoff and burnout values are values.csv.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  centreOfPressure,
  componentMassProperties,
  kilograms,
  mach,
  R1_COMPONENTS,
  R2_COMPONENTS,
  R3_COMPONENTS,
  R4_COMPONENTS,
  R5_COMPONENTS,
  REFERENCE_MOTORS,
  rocketMassProperties,
  type PlacedComponent,
} from '@lo-fi-rocket/physics';
import { describe, expect, it } from 'vitest';
import { parseEng } from './eng.js';
import { OrkParseError, OrkUnsupportedError } from './errors.js';
import { parseOrk, type OrkPlacedComponent, type OrkRocket } from './ork.js';

const REFERENCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'reference');
const ROCKETS = join(REFERENCE, 'rockets');

const CASES = [
  {
    file: 'r1-three-fin-conical.ork',
    motorFile: 'Estes_D12.eng',
    components: R1_COMPONENTS,
    motor: REFERENCE_MOTORS.r1,
    liftoff: { mass: 0.190904, cg: 0.387022 },
    burnout: { mass: 0.169804, cg: 0.364906 },
    cp: 0.487149,
    length: 0.6,
    maxRadius: 0.025,
  },
  {
    file: 'r2-ogive-boattail.ork',
    motorFile: 'AeroTech_G80T.eng',
    components: R2_COMPONENTS,
    motor: REFERENCE_MOTORS.r2,
    liftoff: { mass: 0.414484, cg: 0.484548 },
    burnout: { mass: 0.345484, cg: 0.443897 },
    cp: 0.571037,
    length: 0.8,
    maxRadius: 0.027,
  },
  {
    file: 'r3-minimum-diameter-24.ork',
    motorFile: 'AeroTech_F39T.eng',
    components: R3_COMPONENTS,
    motor: REFERENCE_MOTORS.r3,
    liftoff: { mass: 0.171873, cg: 0.356248 },
    burnout: { mass: 0.149173, cg: 0.332091 },
    cp: 0.449111,
    length: 0.55,
    maxRadius: 0.0127,
  },
  {
    file: 'r4-scratch-38mm.ork',
    motorFile: 'AeroTech_H123W.eng',
    components: R4_COMPONENTS,
    motor: REFERENCE_MOTORS.r4,
    liftoff: { mass: 1.365936, cg: 0.625038 },
    burnout: { mass: 1.2396, cg: 0.594671 },
    cp: 0.807795,
    length: 1.0,
    maxRadius: 0.033,
  },
  {
    file: 'r5-transonic-min-dia-29.ork',
    motorFile: 'AeroTech_H238T.eng',
    components: R5_COMPONENTS,
    motor: REFERENCE_MOTORS.r5,
    liftoff: { mass: 0.450135, cg: 0.43553 },
    burnout: { mass: 0.369495, cg: 0.403346 },
    cp: 0.526894,
    length: 0.68,
    maxRadius: 0.016,
  },
] as const;

const bytes = (file: string): Uint8Array => new Uint8Array(readFileSync(join(ROCKETS, file)));
const xmlOf = (file: string): string => {
  const entry = unzipSync(bytes(file))['rocket.ork'];
  if (entry === undefined) throw new Error('no rocket.ork entry');
  return strFromU8(entry);
};

/** Deep comparison with a relative tolerance on numbers (OpenRocket writes 5.000000000000004E-4 for 0.0005). */
function expectClose(actual: unknown, expected: unknown, path: string): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    const a = actual as number;
    expect(
      Math.abs(a - expected),
      `${path}: ${String(a)} vs ${String(expected)}`,
    ).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(expected)));
    return;
  }
  if (typeof expected !== 'object' || expected === null) {
    expect(actual, path).toBe(expected);
    return;
  }
  expect(typeof actual, path).toBe('object');
  const e = expected as Record<string, unknown>;
  const a = actual as Record<string, unknown>;
  expect(Object.keys(a).sort(), path).toEqual(Object.keys(e).sort());
  for (const key of Object.keys(e)) expectClose(a[key], e[key], `${path}.${key}`);
}

/** Quote-aware CSV reader for reference/rockets/components/*.csv. */
function readCsv(file: string): Record<string, string>[] {
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0] ?? '');
  return lines.slice(1).map((line) => {
    const row: Record<string, string> = {};
    split(line).forEach((v, i) => {
      row[header[i] ?? String(i)] = v;
    });
    return row;
  });
}

describe('reference rockets: parsed components equal the hand transcription', () => {
  for (const c of CASES) {
    it(`${c.file}: components, motor mount, length and radius`, () => {
      const rocket = parseOrk(bytes(c.file), c.file);
      expect(rocket.formatVersion).toBe('1.10');
      expect(rocket.creator).toBe('OpenRocket 24.12');
      expect(rocket.name).toBe(c.file.replace('.ork', ''));
      const parsed: PlacedComponent[] = rocket.components.map((p) => ({
        component: p.component,
        position: p.position,
      }));
      expect(parsed.length).toBe(c.components.length);
      parsed.forEach((p, i) => {
        expectClose(p, c.components[i], `${c.file}[${String(i)}]`);
      });
      const mount = rocket.motorMount;
      expect(mount).toBeDefined();
      if (mount === undefined) return;
      expect(mount.designation).toBe(c.motor.designation);
      expect(mount.diameter).toBeCloseTo(c.motor.diameter, 12);
      expect(mount.length).toBeCloseTo(c.motor.length, 12);
      expect(mount.aftEnd).toBeCloseTo(c.motor.aftEnd, 12);
      expect(rocket.components[mount.mountComponent]?.component.kind).toMatch(/bodyTube|innerTube/);
      expect(rocket.length).toBeCloseTo(c.length, 12);
      expect(rocket.maxBodyRadius).toBeCloseTo(c.maxRadius, 12);
      expect(rocket.recoveryDevices.length).toBe(1);
      expect(rocket.recoveryDevices[0]?.deployEvent).toBe('apogee');
      expect(rocket.recoveryDevices[0]?.dragCoefficient).toBe(0.8);
    });
  }

  it('R1 recovery device and motor delay are read as written', () => {
    const r = parseOrk(bytes('r1-three-fin-conical.ork'));
    expect(r.recoveryDevices[0]?.diameter).toBe(0.3);
    expect(r.recoveryDevices[0]?.deployAltitude).toBe(200);
    expect(r.recoveryDevices[0]?.deployDelay).toBe(0);
    expect(r.recoveryDevices[0]?.component).toBe(8);
    expect(r.motorMount?.delay).toBe(5);
    expect(r.motorMount?.manufacturer).toBe('Estes');
    expect(r.motorMount?.mountComponent).toBe(5);
    expect(r.components.map((p) => p.element)).toEqual([
      'nosecone',
      'bodytube',
      'trapezoidfinset',
      'masscomponent',
      'launchlug',
      'innertube',
      'centeringring',
      'centeringring',
      'parachute',
    ]);
  });
});

describe('per-component mass and CG against OpenRocket (components/*.csv)', () => {
  for (const c of CASES) {
    it(`${c.file}: every row within 0.05 % mass and 0.1 mm CG (plus the printed rounding)`, () => {
      const rocket = parseOrk(bytes(c.file));
      const rows = readCsv(join(ROCKETS, 'components', c.file.replace('.ork', '.csv'))).filter(
        (r) => r['type'] !== 'Motor',
      );
      expect(rows.length).toBe(rocket.components.length);
      rows.forEach((row, i) => {
        const p = rocket.components[i];
        if (p === undefined) throw new Error('missing component');
        expect(p.name, `row ${String(i)}`).toBe(row['component']);
        const props = componentMassProperties(p.component);
        const mass = Number(row['mass_kg_all_instances']);
        const cg = Number(row['cg_x_abs_m']);
        // The CSV prints six decimals: allow half a printed unit on top of the model tolerance.
        expect(Math.abs(props.mass - mass), `${p.name} mass`).toBeLessThan(5e-4 * mass + 0.5e-6);
        expect(Math.abs(p.position + props.cgX - cg), `${p.name} CG`).toBeLessThan(1e-4 + 0.5e-6);
        expect(Number(row['position_x_m']), `${p.name} position`).toBeCloseTo(p.position, 6);
      });
    });
  }
});

describe('end to end: .ork plus .eng reproduce values.csv (mass 0.1 %, CG 1 %)', () => {
  for (const c of CASES) {
    it(`${c.file} with ${c.motorFile}`, () => {
      const rocket = parseOrk(bytes(c.file));
      const motors = parseEng(readFileSync(join(REFERENCE, 'motors', c.motorFile), 'utf8'));
      const eng = motors[0];
      const mount = rocket.motorMount;
      if (eng === undefined || mount === undefined) throw new Error('missing motor');
      expect(eng.designation).toBe(mount.designation);
      expect(eng.diameter).toBeCloseTo(mount.diameter, 12);
      expect(eng.length).toBeCloseTo(mount.length, 12);
      const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
      const at = (mass: number): { mass: number; cg: number } =>
        rocketMassProperties(rocket.components, {
          mass: kilograms(mass),
          length: mount.length,
          diameter: mount.diameter,
          aftEnd: mount.aftEnd,
        });
      const lo = at(eng.totalMass);
      const bo = at(eng.totalMass - eng.propellantMass);
      expect(rel(lo.mass, c.liftoff.mass), 'liftoff mass').toBeLessThan(1e-3);
      expect(rel(lo.cg, c.liftoff.cg), 'liftoff CG').toBeLessThan(1e-2);
      expect(rel(bo.mass, c.burnout.mass), 'burnout mass').toBeLessThan(1e-3);
      expect(rel(bo.cg, c.burnout.cg), 'burnout CG').toBeLessThan(1e-2);
    });
  }
});

describe('end to end: centre of pressure from the .ork file against values.csv (CP 2 %, OpenRocket-equivalent mode)', () => {
  for (const c of CASES) {
    it(`${c.file}: CP ${String(c.cp)} m`, () => {
      const rocket = parseOrk(bytes(c.file));
      const r = centreOfPressure(rocket.components, {
        mach: mach(0.3),
        rollAngle: 'worst',
        finRollReduction: false,
      });
      expect(r.referenceDiameter).toBeCloseTo(2 * rocket.maxBodyRadius, 12);
      expect(Math.abs(r.cp - c.cp) / c.cp).toBeLessThan(0.02);
    });
  }
});

describe('containers', () => {
  it('the zip and the bare XML give the same rocket', () => {
    const a = parseOrk(bytes('r2-ogive-boattail.ork'));
    const b = parseOrk(xmlOf('r2-ogive-boattail.ork'));
    expect(b).toEqual(a);
    const c = parseOrk(strToU8(xmlOf('r2-ogive-boattail.ork')));
    expect(c).toEqual(a);
  });
  it('a zip without rocket.ork, a broken zip and malformed XML are rejected', () => {
    const noEntry = zipSync({ 'other.txt': strToU8('x') });
    expect(() => parseOrk(noEntry, 'a.ork')).toThrow(/no "rocket.ork" entry/);
    const broken = new Uint8Array([0x50, 0x4b, 1, 2, 3]);
    expect(() => parseOrk(broken)).toThrow(OrkParseError);
    expect(() => parseOrk('<openrocket version="1.10"><rocket></openrocket>')).toThrow(
      /not well-formed XML/,
    );
    expect(() => parseOrk('<foo/>')).toThrow(/root element is not <openrocket>/);
  });
  it('every reference file in the folder parses', () => {
    const files = readdirSync(ROCKETS).filter((f) => f.endsWith('.ork'));
    expect(files.length).toBe(5);
    for (const f of files) expect(parseOrk(bytes(f), f).components.length).toBeGreaterThan(0);
  });
});

describe('rejected inputs name the element and component', () => {
  const r1 = xmlOf('r1-three-fin-conical.ork');
  const r2 = xmlOf('r2-ogive-boattail.ork');
  const edit = (xml: string, from: string, to: string): string => {
    if (!xml.includes(from)) throw new Error(`test edit target not found: ${from}`);
    return xml.replace(from, to);
  };
  const unsupported = (xml: string, pattern: RegExp): void => {
    expect(() => parseOrk(xml, 'edited.ork')).toThrow(OrkUnsupportedError);
    expect(() => parseOrk(xml, 'edited.ork')).toThrow(pattern);
  };
  const malformed = (xml: string, pattern: RegExp): void => {
    expect(() => parseOrk(xml, 'edited.ork')).toThrow(OrkParseError);
    expect(() => parseOrk(xml, 'edited.ork')).toThrow(pattern);
  };

  it('unknown components', () => {
    unsupported(
      edit(r1, '<parachute>', '<streamer><name>S</name></streamer><parachute>'),
      /streamer "S": element <streamer>/,
    );
    unsupported(
      edit(r1, '</nosecone>', '</nosecone><podset><name>Pods</name></podset>'),
      /podset "Pods": element <podset>/,
    );
  });

  it('structure: stages, motors, mounts, version, reference type', () => {
    unsupported(
      edit(r1, '</stage>', '</stage><stage><name>Booster</name><subcomponents/></stage>'),
      /2 stages/,
    );
    unsupported(edit(r1, 'version="1.10"', 'version="2.0"'), /format version "2.0"/);
    unsupported(edit(r1, '<referencetype>maximum', '<referencetype>nose'), /reference length/);
    // Two configurations and neither marked as the default: OpenRocket opens such a file with no
    // motor, and so does the reader (D-078).
    const none = parseOrk(
      edit(
        edit(r1, ' default="true">', '>'),
        '</motorconfiguration>',
        '</motorconfiguration><motorconfiguration configid="b"><stage number="0" active="true"/></motorconfiguration>',
      ),
      'edited.ork',
    );
    expect(none.motorMount).toBeUndefined();
    expect(none.notices.join(' ')).toMatch(/none is marked as the default/);
    unsupported(
      edit(
        r1,
        '<ignitionevent>automatic</ignitionevent>\n                    <ignitiondelay>0.0',
        '<ignitionevent>automatic</ignitionevent>\n                    <ignitiondelay>2.0',
      ),
      /motor ignition delay/,
    );
    unsupported(
      edit(
        r1,
        '<subcomponents>\n              <trapezoidfinset>',
        '<subcomponents><innertube><name>Second mount</name><axialoffset method="top">0.0</axialoffset><material type="bulk" density="700.0">p</material><length>0.05</length><outerradius>0.01</outerradius><thickness>0.001</thickness><motormount><overhang>0.0</overhang><motor configid="87104846-a550-42cb-8c9c-36360f4ef57c"><manufacturer>m</manufacturer><designation>d</designation><diameter>0.018</diameter><length>0.07</length><delay>3.0</delay></motor></motormount></innertube><trapezoidfinset>',
      ),
      /more than one motor mount/,
    );
    unsupported(
      edit(r1, '<clusterconfiguration>single', '<clusterconfiguration>double'),
      /motor clusters/,
    );
  });

  it('nose cones and transitions', () => {
    unsupported(edit(r1, '<isflipped>false', '<isflipped>true'), /flipped nose cones/);
    // A capped shoulder adds the cap as a disc (D-078).
    expect(
      parseOrk(
        edit(
          r2,
          '<aftshouldercapped>false</aftshouldercapped>\n            <isflipped>',
          '<aftshouldercapped>true</aftshouldercapped>\n            <isflipped>',
        ),
        'edited.ork',
      ).components.some((c) => c.element === 'shouldercap'),
    ).toBe(true);
    unsupported(
      edit(
        r1,
        '<shape>conical</shape>\n            <aftradius>',
        '<shape>bezier</shape>\n            <aftradius>',
      ),
      /shape "bezier"/,
    );
    malformed(edit(r2, '<shapeparameter>1.0</shapeparameter>', ''), /needs a <shapeparameter>/);
    unsupported(
      edit(r1, '<aftradius>0.025</aftradius>', '<aftradius>auto</aftradius>'),
      /<aftradius> "auto"/,
    );
    unsupported(
      edit(
        r2,
        '<foreshoulderradius>0.0</foreshoulderradius>\n            <foreshoulderlength>0.0',
        '<foreshoulderradius>0.02</foreshoulderradius>\n            <foreshoulderlength>0.03',
      ),
      /transition shoulders/,
    );
    malformed(
      edit(r2, '<aftshoulderthickness>0.002', '<aftshoulderthickness>-0.002'),
      /aft shoulder needs positive/,
    );
    unsupported(
      edit(
        r2,
        '<shape>conical</shape>\n            <foreradius>',
        '<shape>conical</shape><shapeclipped>true</shapeclipped>\n            <foreradius>',
      ),
      /clipped transitions/,
    );
    // A clipped flag on a nose cone has no effect (zero fore radius) and is accepted either way.
    const r3 = xmlOf('r3-minimum-diameter-24.ork');
    expect(parseOrk(edit(r3, '<shapeclipped>false', '<shapeclipped>true')).components[0]).toEqual(
      parseOrk(r3).components[0],
    );
    unsupported(
      edit(
        r1,
        '<material type="bulk" density="160.0" group="Custom">Reference balsa 160',
        '<material type="surface" density="160.0" group="Custom">Reference balsa 160',
      ),
      /material type "surface"/,
    );
  });

  it('fins, lugs, buttons, rings, inner tubes', () => {
    unsupported(edit(r1, '<cant>0.0</cant>', '<cant>0.1</cant>'), /canted fins/);
    unsupported(edit(r1, '<filletradius>0.0', '<filletradius>0.003'), /fin fillets/);
    unsupported(
      edit(r1, '<crosssection>square', '<crosssection>wedge'),
      /fin cross-section "wedge"/,
    );
    malformed(
      edit(r1, '<fincount>3</fincount>', '<fincount>4</fincount>'),
      /<instancecount> 3 differs from <fincount> 4/,
    );
    unsupported(
      edit(
        r1,
        '<instancecount>1</instancecount>\n                <instanceseparation>0.06',
        '<instancecount>2</instancecount>\n                <instanceseparation>0.06',
      ),
      /more than one launch lug/,
    );
    unsupported(edit(r2, '<screwheight>0.0', '<screwheight>0.002'), /screw height/);
    malformed(
      edit(r2, '<instanceseparation>0.25</instanceseparation>', ''),
      /<instanceseparation> is required/,
    );
    // An automatic inner radius fits the motor tube the ring surrounds (D-080): R1's first ring
    // was written with 0.0125 m, the tube's outer radius.
    const autoRing = parseOrk(
      edit(
        r1,
        '<innerradius>0.0125</innerradius>\n              </centeringring>\n\n              <centeringring>',
        '<innerradius>auto</innerradius>\n              </centeringring>\n\n              <centeringring>',
      ),
      'edited.ork',
    ).components.find((c) => c.element === 'centeringring')?.component;
    expect(autoRing?.kind === 'centeringRing' && autoRing.innerRadius).toBe(0.0125);
    unsupported(
      edit(
        r1,
        '<radialposition>0.0</radialposition>\n                <radialdirection>0.0</radialdirection>\n                <outerradius>0.0125',
        '<radialposition>0.01</radialposition>\n                <radialdirection>0.0</radialdirection>\n                <outerradius>0.0125',
      ),
      /radially offset inner tubes/,
    );
    unsupported(
      edit(
        r1,
        '<clusterrotation>0.0</clusterrotation>',
        '<clusterrotation>0.0</clusterrotation><subcomponents><engineblock/></subcomponents>',
      ),
      /components inside an inner tube/,
    );
  });

  it('overrides, parachutes, positions, numbers', () => {
    unsupported(
      edit(r1, '<radius>0.025</radius>', '<radius>0.025</radius><overridecd>0.5</overridecd>'),
      /drag coefficient override \(<overridecd>\)/,
    );
    malformed(
      edit(r1, '<radius>0.025</radius>', '<radius>0.025</radius><overridemass>-0.1</overridemass>'),
      /<overridemass> must be 0 kg or more/,
    );
    // Without an override the parachute's mass comes from its materials (D-079).
    expect(
      parseOrk(edit(r1, '<overridemass>0.01</overridemass>', ''), 'edited.ork').components.find(
        (c) => c.element === 'parachute',
      )?.component,
    ).toMatchObject({ kind: 'parachute' });
    unsupported(
      edit(edit(r1, '<overridemass>0.01</overridemass>', ''), 'type="surface"', 'type="bulk"'),
      /<material> of type "bulk" where "surface" is expected/,
    );
    unsupported(
      edit(r1, '<overridesubcomponentsmass>false', '<overridesubcomponentsmass>true'),
      /overridesubcomponentsmass/,
    );
    unsupported(
      edit(r1, '<deployevent>apogee', '<deployevent>lowerstageseparation'),
      /deployment event/,
    );
    expect(
      parseOrk(edit(r1, '<cd>0.8</cd>', '<cd>auto</cd>'), 'edited.ork').recoveryDevices[0]
        ?.dragCoefficient,
    ).toBe(0.8);
    unsupported(
      edit(
        r1,
        '<axialoffset method="top">0.1</axialoffset>\n                <position type="top">0.1</position>',
        '<axialoffset method="after">0.1</axialoffset>\n                <position type="after">0.1</position>',
      ),
      /axial offset method "after"/,
    );
    malformed(
      edit(r1, '<position type="top">0.1</position>', '<position type="top">0.2</position>'),
      /disagrees with <axialoffset/,
    );
    malformed(
      edit(r1, '<length>0.5</length>', '<length>half</length>'),
      /<length> is not a number: "half"/,
    );
    malformed(edit(r1, '<length>0.5</length>', '<length></length>'), /<length> is empty/);
    malformed(edit(r1, '<length>0.5</length>', ''), /missing <length>/);
    malformed(
      edit(r1, '<length>0.5</length>', '<length>0.5</length><length>0.5</length>'),
      /<length> appears 2 times/,
    );
    malformed(
      edit(
        r1,
        'density="700.0" group="Custom">Reference paper 700</material>\n            <length>0.5',
        'density="0" group="Custom">Reference paper 700</material>\n            <length>0.5',
      ),
      /density must be greater than 0/,
    );
    unsupported(
      edit(r1, '<radius>0.025</radius>', '<radius>0.025</radius><customelement>1</customelement>'),
      /element <customelement>/,
    );
  });

  it('absolute, middle and bottom positions follow the documented rules', () => {
    // Nose weight: top 0.0 in the tube at 0.1 → 0.1. Change to absolute 0.3, middle 0 and bottom 0.
    const at = (method: string, value: string): number => {
      const xml = edit(
        r1,
        '<axialoffset method="top">0.0</axialoffset>\n                <position type="top">0.0</position>\n                <packedlength>0.02',
        `<axialoffset method="${method}">${value}</axialoffset>\n                <position type="${method}">${value}</position>\n                <packedlength>0.02`,
      );
      const r: OrkRocket = parseOrk(xml);
      const w = r.components.find((p) => p.name === 'Nose weight');
      if (w === undefined) throw new Error('nose weight missing');
      return w.position;
    };
    expect(at('absolute', '0.3')).toBeCloseTo(0.3, 12);
    // middle: parent centre 0.35, own length 0.02 → forward end 0.34
    expect(at('middle', '0.0')).toBeCloseTo(0.34, 12);
    // bottom: parent aft end 0.6 − 0.02 → 0.58; with −0.1 → 0.48
    expect(at('bottom', '0.0')).toBeCloseTo(0.58, 12);
    expect(at('bottom', '-0.1')).toBeCloseTo(0.48, 12);
  });
});

/**
 * D-073: mass and CG overrides, read from files OpenRocket 24.12 wrote itself
 * (tools/openrocket-harness/src/OverrideProbe.java). OpenRocket's structure
 * masses are in reference/rockets/override-probe/values.txt; mass does not
 * depend on positions, so it is compared directly. The CGs are worked by hand
 * for the stacked layout the reader builds (nose 0 to 0.1 m, tube 0.1 to 0.6 m).
 */
describe('mass and CG overrides (D-073)', () => {
  const probe = (n: number): OrkRocket =>
    parseOrk(bytes(join('override-probe', `probe${String(n)}.ork`)), `probe${String(n)}.ork`);

  it('nose cone mass 0.05 kg and CG 0.03 m: OpenRocket mass 0.133878314 kg, CG by hand', () => {
    const rocket = probe(3);
    expect(rocket.components[0]?.massOverride).toEqual({ mass: 0.05, cg: 0.03 });
    const m = rocketMassProperties(rocket.components);
    expect(m.mass).toBeCloseTo(0.133878314, 8);
    // Nose 0.05 kg at 0.03 m; tube π(0.025² − 0.024²)(0.5)(700) = 0.0538783 kg at 0.35 m;
    // weight 0.03 kg at 0.1 + 0.1 + 0.01 = 0.21 m:
    // (0.0015 + 0.0188574 + 0.0063)/0.1338783 = 0.0266574/0.1338783 = 0.199117 m.
    expect(m.cg).toBeCloseTo(0.199117, 6);
  });

  it('fin set (3 fins) and rail buttons (2): the override is the total of all instances', () => {
    const rocket = probe(10);
    const fins = rocket.components.find((c) => c.element === 'trapezoidfinset');
    const buttons = rocket.components.find((c) => c.element === 'railbutton');
    expect(fins?.massOverride).toEqual({ mass: 0.06, cg: 0.02 });
    expect(buttons?.massOverride).toEqual({ mass: 0.004 });
    // OpenRocket's structure mass for this rocket: 0.158350290 kg (values.txt, case 10).
    expect(rocketMassProperties(rocket.components).mass).toBeCloseTo(0.15835029, 8);
  });

  it('an override that includes subcomponents is rejected when there are subcomponents', () => {
    expect(() => parseOrk(bytes(join('override-probe', 'probe5.ork')), 'probe5.ork')).toThrow(
      /override that includes the subcomponents \(<overridesubcomponentsmass> true/,
    );
  });

  it('a mass override alone keeps the computed CG', () => {
    const rocket = probe(1);
    expect(rocket.components[0]?.massOverride).toEqual({ mass: 0.05 });
    expect(rocketMassProperties(rocket.components).mass).toBeCloseTo(0.133878314, 8);
  });
});

/**
 * Components inside a nose cone. OpenRocket 24.12 was asked where it places
 * them (tools/openrocket-harness/src/NoseChildProbe.java); its output is
 * reference/rockets/nose-child-probe/values.txt. Nose cone 0.150 m long,
 * base radius 0.025 m; mass component 0.020 m long. Fore ends by hand, from
 * the cone's own length (the 0.040 m shoulder of cases 4 to 8 does not count):
 * top +0.010 → 0.010; bottom −0.005 → 0.150 − 0.005 − 0.020 = 0.125;
 * middle +0.003 → (0.150 − 0.020)/2 + 0.003 = 0.068; absolute 0.050 → 0.050.
 */
describe('components inside a nose cone', () => {
  const probe = (n: number): OrkRocket =>
    parseOrk(
      bytes(join('nose-child-probe', `nosechild${String(n)}.ork`)),
      `nosechild${String(n)}.ork`,
    );
  // OpenRocket's structure mass (kg) and CG (m from the tip) for each saved file as it loads it, values.txt.
  const OPENROCKET: readonly (readonly [number, number])[] = [
    [0.115387874, 0.217727117],
    [0.115387874, 0.247626272],
    [0.115387874, 0.232806691],
    [0.115387874, 0.228126823],
    [0.126999201, 0.213363505],
    [0.126999201, 0.240529031],
    [0.126999201, 0.227064379],
    [0.126999201, 0.222812384],
    [0.142769112, 0.203356708],
  ];
  const FORE_END = [0.01, 0.125, 0.068, 0.05];

  for (let n = 0; n <= 8; n++) {
    it(`case ${String(n)}: the mass component's fore end, the structure mass and CG match OpenRocket`, () => {
      const rocket = probe(n);
      const mass = rocket.components.find((c) => c.element === 'masscomponent');
      expect(mass?.position).toBeCloseTo(FORE_END[n % 4] ?? Number.NaN, 12);
      const m = rocketMassProperties(rocket.components);
      const [orMass, orCg] = OPENROCKET[n] ?? [Number.NaN, Number.NaN];
      // 1e-5: OpenRocket integrates the ogive nose shell numerically; the nose cone alone differs from
      // the closed form by 1.7e-5 of its mass (0.031510094 against 0.031509560 kg), 5e-6 of the total.
      expect(Math.abs(m.mass - orMass) / orMass).toBeLessThan(1e-5);
      expect(Math.abs(m.cg - orCg) / orCg).toBeLessThan(1e-5);
    });
  }

  it('case 8: the parachute and bulkhead sit where OpenRocket puts them, and the parachute is a recovery device', () => {
    const rocket = probe(8);
    // Parachute 0.050 m long, bottom −0.010: 0.150 − 0.010 − 0.050 = 0.090 m.
    expect(rocket.components.find((c) => c.element === 'parachute')?.position).toBeCloseTo(
      0.09,
      12,
    );
    // Bulkhead 0.005 m long, bottom 0: 0.150 − 0.005 = 0.145 m.
    expect(rocket.components.find((c) => c.element === 'bulkhead')?.position).toBeCloseTo(
      0.145,
      12,
    );
    expect(rocket.recoveryDevices).toHaveLength(1);
  });
});

/**
 * Motor configurations, per-configuration deployment and fin cross-sections
 * (D-077), against files OpenRocket 24.12 saved and reloaded
 * (tools/openrocket-harness/src/ConfigProbe.java, reference/rockets/config-probe/values.txt).
 */
describe('motor configurations and fin cross-sections (D-077)', () => {
  const probe = (n: number): OrkRocket =>
    parseOrk(bytes(join('config-probe', `config${String(n)}.ork`)), `config${String(n)}.ork`);

  it('three configurations: the default one is used and the import says so', () => {
    const rocket = probe(3);
    expect(rocket.notices.some((n) => n.includes('3 motor configurations; the default one'))).toBe(
      true,
    );
  });

  it("the parachute uses the default configuration's own deployment (altitude 150 m), as OpenRocket does", () => {
    // values.txt case 3: "event=Specific altitude during descent altitude=150.000 delay=0.000"; the
    // parachute's own elements say apogee, which applies to configurations without an entry.
    const [chute] = probe(3).recoveryDevices;
    expect(chute?.deployEvent).toBe('altitude');
    expect(chute?.deployAltitude).toBe(150);
    expect(chute?.deployDelay).toBe(0);
  });

  it('rounded and airfoil fins are read with their cross-section and a notice on the mass', () => {
    for (const [n, section] of [
      [0, 'square'],
      [1, 'rounded'],
      [2, 'airfoil'],
    ] as const) {
      const rocket = probe(n);
      const fins = rocket.components.find((c) => c.element === 'trapezoidfinset');
      expect(fins?.component.kind === 'finSet' && fins.component.crossSection).toBe(section);
      expect(rocket.notices.some((t) => t.includes('OpenRocket makes such fins'))).toBe(n !== 0);
    }
  });

  it('the fin mass is the slab, area × thickness × density, for every cross-section', () => {
    // 3 fins, root 0.1, tip 0.05, height 0.08 m: area 0.5 (0.1 + 0.05) 0.08 = 0.006 m² each;
    // 3 × 0.006 × 0.003 × 600 = 0.0324 kg, OpenRocket's square figure (values.txt case 0).
    // OpenRocket gives 0.032076 kg rounded and 0.02754 kg airfoil; this app keeps the slab.
    for (const n of [0, 1, 2]) {
      const fins = probe(n).components.find((c) => c.element === 'trapezoidfinset');
      expect(fins === undefined ? Number.NaN : rocketMassProperties([fins]).mass).toBeCloseTo(
        0.0324,
        12,
      );
    }
  });
});

/**
 * Capped and zero-thickness shoulders and resolved "auto" sizes (D-078), against
 * files OpenRocket 24.12 saved and reloaded
 * (tools/openrocket-harness/src/ShoulderProbe.java,
 * reference/rockets/shoulder-probe/values.txt). Conical nose 0.150 m, base
 * radius 0.025 m, wall 0.002 m; shoulder radius 0.023 m, length 0.040 m.
 */
describe('capped and zero-thickness shoulders, resolved "auto" sizes (D-078)', () => {
  const probe = (n: number): OrkRocket =>
    parseOrk(bytes(join('shoulder-probe', `shoulder${String(n)}.ork`)), `shoulder${String(n)}.ork`);
  // OpenRocket's nose cone mass (kg) and CG (m), values.txt cases 0 to 3.
  const OPENROCKET = [
    [0.034713431, 0.124725757],
    [0.03762286, 0.129696175],
    [0.023102105, 0.101970514],
    [0.023102105, 0.101970514],
  ] as const;

  for (const n of [0, 1, 2, 3]) {
    it(`case ${String(n)}: nose cone mass and CG match OpenRocket`, () => {
      const m = rocketMassProperties(probe(n).components);
      const [orMass, orCg] = OPENROCKET[n] ?? [Number.NaN, Number.NaN];
      expect(Math.abs(m.mass - orMass) / orMass).toBeLessThan(1e-6);
      expect(Math.abs(m.cg - orCg) / orCg).toBeLessThan(1e-6);
    });
  }

  it('the cap is a disc of the wall thickness and inner radius at the far end of the shoulder', () => {
    // π (0.023 − 0.002)² × 0.002 × 1050 = π × 0.000441 × 2.1 = 0.0029094 kg, the difference
    // between cases 1 and 0 (0.03762286 − 0.034713431 = 0.002909429); fore face at
    // 0.150 + 0.040 − 0.002 = 0.188 m.
    const cap = probe(1).components.find((c) => c.element === 'shouldercap');
    expect(cap?.position).toBeCloseTo(0.188, 12);
    expect(cap === undefined ? Number.NaN : rocketMassProperties([cap]).mass).toBeCloseTo(
      0.0029094,
      7,
    );
  });

  it('an automatic radius uses the value OpenRocket resolved ("auto 0.031")', () => {
    const rocket = probe(4);
    const nose = rocket.components.find((c) => c.element === 'nosecone');
    const transition = rocket.components.find((c) => c.element === 'transition');
    expect(nose?.component.kind === 'noseCone' && nose.component.baseRadius).toBe(0.031);
    expect(transition?.component.kind === 'transition' && transition.component.foreRadius).toBe(
      0.031,
    );
  });
});

/**
 * Parachute mass from its materials, the automatic parachute C_D, shock cords,
 * tube couplers and engine blocks (D-079), against a file OpenRocket 24.12
 * saved and reloaded (tools/openrocket-harness/src/PartsProbe.java,
 * reference/rockets/parts-probe/values.txt).
 */
describe('parachute materials, shock cords, couplers and engine blocks (D-079)', () => {
  const rocket = parseOrk(bytes(join('parts-probe', 'parts.ork')), 'parts.ork');
  const part = (element: string): OrkPlacedComponent => {
    const c = rocket.components.find((x) => x.element === element);
    if (c === undefined) throw new Error(`no ${element}`);
    return c;
  };
  const massCg = (c: OrkPlacedComponent): { mass: number; cg: number } => rocketMassProperties([c]);

  it('parachute: canopy π (0.3)² × 0.067 + lines 8 × 0.5 × 0.0018 = 0.026144 kg, as OpenRocket', () => {
    // 0.2827433 × 0.067 = 0.0189438; + 0.0072 = 0.0261438. OpenRocket: 0.026143804 kg, CG 0.150 m.
    const m = massCg(part('parachute'));
    expect(m.mass).toBeCloseTo(0.026143804, 9);
    expect(m.cg).toBeCloseTo(0.15, 12);
  });

  it("automatic parachute C_D is 0.8 and the import says it is OpenRocket's default", () => {
    expect(rocket.recoveryDevices[0]?.dragCoefficient).toBe(0.8);
    expect(rocket.notices.join(' ')).toMatch(/automatic drag coefficient, 0\.8/);
  });

  it('shock cord: 1.5 m × 0.005 kg/m = 0.0075 kg at the packed centre 0.205 m', () => {
    const m = massCg(part('shockcord'));
    expect(m.mass).toBeCloseTo(0.0075, 12);
    expect(m.cg).toBeCloseTo(0.205, 12);
  });

  it('tube coupler: π (0.024² − 0.0225²) × 0.08 × 700 = 0.0122711 kg, centred at 0.350 m', () => {
    // π × 0.00006975 × 56 = 0.01227106. OpenRocket: 0.012271061 kg.
    const m = massCg(part('tubecoupler'));
    expect(m.mass).toBeCloseTo(0.012271061, 9);
    expect(m.cg).toBeCloseTo(0.35, 12);
  });

  it('engine block: inner radius 0.0095 − 0.003; π (0.0095² − 0.0065²) × 0.006 × 700 = 0.000633345 kg', () => {
    // π × 0.000048 × 4.2 = 0.00063335. OpenRocket: 0.000633345 kg, CG 0.527 m.
    const m = massCg(part('engineblock'));
    expect(m.mass).toBeCloseTo(0.000633345, 9);
    expect(m.cg).toBeCloseTo(0.527, 12);
  });
});

/**
 * Automatic ("auto") ring, bulkhead and coupler radii and components inside a
 * tube coupler (D-080), against a file OpenRocket 24.12 saved and reloaded
 * (tools/openrocket-harness/src/AutoRingProbe.java,
 * reference/rockets/auto-ring-probe/values.txt).
 */
describe('automatic ring radii and parts inside a coupler (D-080)', () => {
  const rocket = parseOrk(bytes(join('auto-ring-probe', 'autoring.ork')), 'autoring.ork');
  const named = (name: string): OrkPlacedComponent => {
    const c = rocket.components.find((x) => x.name === name);
    if (c === undefined) throw new Error(`no ${name}`);
    return c;
  };
  const radii = (name: string): [number, number] => {
    const c = named(name).component;
    if (c.kind !== 'centeringRing' && c.kind !== 'bulkhead')
      throw new Error(`${name} is not a ring`);
    return [c.outerRadius, c.innerRadius];
  };

  it('in the body tube: outer radius = the tube inner radius 0.025 − 0.001; inner = the motor tube it overlaps, else 0', () => {
    expect(radii('Ring fore')).toEqual([0.024, 0.0095]);
    expect(radii('Ring aft')).toEqual([0.024, 0.0095]);
    expect(radii('Ring clear')).toEqual([0.024, 0]);
    expect(radii('Body bulkhead')[0]).toBe(0.024);
  });

  it('in an ogive nose: the nose radius at the fore face less the wall, as OpenRocket', () => {
    // Tangent ogive L = 0.15, R = 0.025: ρ = (R² + L²)/(2R) = 0.4625;
    // y(x) = √(ρ² − (L − x)²) + R − ρ. y(0.030) = √(0.21390625 − 0.0144) − 0.4375 = 0.0091612,
    // less 0.002 = 0.0071612; y(0.145) = 0.0249730, less 0.002 = 0.0229730.
    // OpenRocket: 0.007161225 and 0.022972972.
    expect(radii('Nose bulkhead fore')[0]).toBeCloseTo(0.007161225, 8);
    expect(radii('Nose bulkhead aft')[0]).toBeCloseTo(0.022972972, 8);
  });

  it('in a coupler: children positioned against the coupler, automatic radius = its inner radius', () => {
    // Coupler at 0.150 to 0.230 m (outer radius auto = 0.024, wall 0 as saved). Bulkhead 0.004 m in
    // the middle: 0.150 + (0.08 − 0.004)/2 = 0.188; mass 0.025 kg, bottom −0.01: 0.230 − 0.01 − 0.02 = 0.200.
    expect(named('Coupler bulkhead').position).toBeCloseTo(0.188, 12);
    expect(radii('Coupler bulkhead')[0]).toBe(0.024);
    expect(named('Coupler mass').position).toBeCloseTo(0.2, 12);
  });

  it("every part has OpenRocket's mass and CG", () => {
    // values.txt: name, mass (kg), CG (m).
    const OPENROCKET: readonly (readonly [string, number, number])[] = [
      ['Nose bulkhead aft', 0.004973997, 0.1475],
      ['Nose bulkhead fore', 0.000483332, 0.0325],
      ['Ring fore', 0.004578086, 0.5825],
      ['Ring aft', 0.004578086, 0.6475],
      ['Ring clear', 0.005428672, 0.4025],
      ['Body bulkhead', 0.006514407, 0.253],
      ['Coupler bulkhead', 0.004342938, 0.19],
      ['Coupler mass', 0.025, 0.21],
    ];
    for (const [name, mass, cg] of OPENROCKET) {
      const m = rocketMassProperties([named(name)]);
      expect(m.mass, name).toBeCloseTo(mass, 8);
      expect(m.cg, name).toBeCloseTo(cg, 8);
    }
  });
});

describe('a radially offset mass component (D-080)', () => {
  it('is placed on the axis at the same axial position, with a notice', () => {
    const r1 = strFromU8(
      unzipSync(bytes('r1-three-fin-conical.ork'))['rocket.ork'] ?? new Uint8Array(),
    );
    const plain = parseOrk(r1, 'r1.ork');
    const offset = parseOrk(
      r1.replace(
        '<packedradius>0.02</packedradius>\n                <radialposition>0.0</radialposition>',
        '<packedradius>0.02</packedradius>\n                <radialposition>0.012</radialposition>',
      ),
      'r1.ork',
    );
    const weight = (r: OrkRocket): OrkPlacedComponent | undefined =>
      r.components.find((c) => c.element === 'masscomponent');
    expect(weight(offset)).toEqual(weight(plain));
    expect(offset.notices.join(' ')).toMatch(/12 mm off the rocket's axis/);
  });
});
