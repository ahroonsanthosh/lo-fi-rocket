/**
 * Plan 0082: the paste box. What a paste is, the plain errors for what it is not, and the proof
 * that Claude's answer pasted on the site builds the same design as the same answer sent to the
 * MCP server's build_and_fly.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  BUNDLED_MOTOR_FILES,
  exampleDesign,
  exportCdx1,
  FormatError,
  motorFromEng,
  parseEng,
  serializeDesign,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  buildFromFile,
  buildFromPaste,
  classifyPaste,
  MAX_CONTENT_CHARACTERS,
  PasteError,
  pastePrompt,
  PROMPT_EXAMPLE,
  type PasteLibraryMotor,
} from './paste.js';
import { createServer } from './server.js';
import { Session } from './session.js';

const ROCKETS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'reference',
  'rockets',
);

/** The example rocket as Claude would write it (as build.test.ts's paste). */
function exampleSpec(): Record<string, unknown> {
  const example = exampleDesign();
  return {
    name: example.name,
    parts: example.components.map((c) => {
      const { kind, ...given } = c.component;
      const fields = kind === 'noseCone' ? { ...given, wallThickness: null } : given;
      return { kind, name: c.name, position: c.position, fields };
    }),
    motor: {
      name: 'Estes D12-5',
      mount: example.components.findIndex((c) => c.id === 'mount'),
      overhang: 0,
    },
    recovery: [
      { name: 'Parachute', diameter: 0.3, dragCoefficient: 0.8, deploy: { event: 'apogee' } },
    ],
    launch: { siteAltitude: 0, railLength: 1.5, windSpeed: 0 },
  };
}

/** The design with its generated ids replaced by their order of first appearance. */
function withoutIds(design: RocketDesign): string {
  const ids = [
    design.id,
    ...design.components.map((c) => c.id),
    ...design.recovery.map((d) => d.id),
  ];
  let text = JSON.stringify(design);
  ids.forEach((id, i) => {
    text = text.split(JSON.stringify(id)).join(`"#${String(i)}"`);
  });
  return text;
}

describe('classifyPaste (plan 0082)', () => {
  const spec = JSON.stringify(exampleSpec());

  it("finds Claude's answer in a fenced block, bare, or after a sentence", () => {
    for (const text of [
      `Here is the specification:\n\n\`\`\`json\n${spec}\n\`\`\`\n\nPaste it into the site.`,
      `\`\`\`\n${spec}\n\`\`\``,
      `  ${spec}  `,
      `\uFEFF${spec}`,
      `Here it is: ${spec} Enjoy.`,
    ]) {
      const c = classifyPaste(text);
      expect(c.kind).toBe('specification');
      expect(JSON.parse(c.body)).toEqual(exampleSpec());
    }
  });

  it('recognises a design file, a RASAero II file and OpenRocket XML', () => {
    expect(classifyPaste(serializeDesign(exampleDesign())).kind).toBe('design');
    expect(classifyPaste(exportCdx1(exampleDesign()).text).kind).toBe('rasaero');
    expect(
      classifyPaste('<?xml version="1.0"?>\n<openrocket version="1.9"></openrocket>').kind,
    ).toBe('openrocket');
  });

  it('says plainly what is wrong with anything else, and refuses a paste over the size limit first', () => {
    const fails = (text: string, message: RegExp): void => {
      expect(() => classifyPaste(text)).toThrow(message);
    };
    fails('', /The box is empty/);
    fails('   \n ', /The box is empty/);
    fails('a rocket with three fins', /not JSON/);
    fails('{"name": "x", "parts": [', /not JSON/);
    fails('[1, 2]', /not a rocket/);
    fails('{"name": "x"}', /"parts".*"schemaVersion"/);
    fails('<html><body>hello</body></html>', /neither an OpenRocket design/);
    expect(() => classifyPaste(' '.repeat(MAX_CONTENT_CHARACTERS + 1))).toThrow(FormatError);
  });
});

describe('buildFromPaste (plan 0082)', () => {
  it('builds the same design as build_and_fly for the same answer', async () => {
    const session = new Session();
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(session).connect(a);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(b);
    const tool = await client.callTool({ name: 'build_and_fly', arguments: exampleSpec() });
    const out = JSON.parse((tool.content as { text: string }[])[0]?.text ?? '') as {
      design_id: string;
    };
    const viaServer = session.get(out.design_id);

    const pasted = await buildFromPaste(`\`\`\`json\n${JSON.stringify(exampleSpec())}\n\`\`\``);
    expect(pasted.kind).toBe('specification');
    expect(pasted.notFlown).toBeUndefined();
    expect(withoutIds(pasted.design)).toBe(withoutIds(viaServer));
    expect(pasted.notices).toEqual([
      `Built "${exampleDesign().name}" from Claude’s answer: ${String(exampleDesign().components.length)} parts.`,
      'Motor Estes D12, from the bundled library; ejection delay 5 s.',
      'Launch settings not given, so the app’s values are used (see the Launch page): temperature, pressure, rail angle, rail direction, wind direction.',
    ]);
  }, 30000);

  it("the prompt's own example builds, with its estimate listed and the left-out fields as not given", async () => {
    const built = await buildFromPaste(JSON.stringify(PROMPT_EXAMPLE));
    expect(built.notFlown).toBeUndefined();
    expect(built.design.components.map((c) => c.component.kind)).toEqual([
      'noseCone',
      'bodyTube',
      'innerTube',
      'finSet',
    ]);
    expect(built.design.motorMount?.motor?.definition.designation).toBe('D12');
    // A part's estimate is listed on the part; the left-out fields on their parts and the design.
    const whats = [
      ...(built.design.approximations ?? []),
      ...built.design.components.flatMap((c) => c.approximations ?? []),
    ].map((x) => x.what);
    expect(built.design.components[3]?.approximations?.map((x) => x.what)).toContain(
      'fin thickness 3 mm',
    );
    expect(whats.filter((w) => w.endsWith('not given')).length).toBeGreaterThan(3);
    // The prompt carries the schema, the fields and the example, and asks for the JSON alone.
    const prompt = pastePrompt();
    expect(prompt).toContain('"$schema"');
    expect(prompt).toContain('"rootChord"');
    expect(prompt).toContain('"Estes D12-5"');
    expect(prompt).toMatch(/answer with only that JSON/);
    expect(prompt).toMatch(/Never present an estimate as if I had given it/);
  });

  it("names where Claude's answer breaks the schema, and builds nothing", async () => {
    const bad = { ...exampleSpec(), parts: [{ kind: 'wing' }], recovery: [{ name: 'P' }] };
    const error = await buildFromPaste(JSON.stringify(bad)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PasteError);
    expect((error as Error).message).toMatch(/^Claude’s answer does not follow the specification/);
    expect((error as Error).message).toContain('parts[0].kind');
    expect((error as Error).message).toContain('recovery[0].deploy');
    expect((error as Error).message).toMatch(/Paste this message back to Claude/);
  });

  it('a step the engine refuses is named, as build_and_fly names it', async () => {
    const bad = {
      name: 'x',
      parts: [{ kind: 'bodyTube', fields: { length: '-3 mm' } }],
    };
    await expect(buildFromPaste(JSON.stringify(bad))).rejects.toThrow(/^part 1 \(bodyTube\): /);
  });

  it("without the catalogue, a motor the library lacks is said, and the rocket is still built; the user's own motors are used", async () => {
    const spec = { ...exampleSpec(), motor: { name: 'Acme F10-6' } };
    const offline = await buildFromPaste(JSON.stringify(spec));
    expect(offline.notFlown).toMatch(/no F10 in the library/);
    expect(offline.design.components.length).toBe(exampleDesign().components.length);

    const eng = parseEng(
      'F10 29 124 6 0.04 0.09 Acme\n0.1 12.0\n3.0 10.0\n3.5 0.0\n',
      'acme.eng',
    )[0];
    if (eng === undefined) throw new Error('test motor');
    const mine: PasteLibraryMotor = {
      definition: motorFromEng(eng),
      provenance: { kind: 'file', fileName: 'acme.eng' },
      delays: [6],
    };
    // The bundled D12 again, as a ThrustCurve download the user kept: listed once, not ambiguous.
    const d12 = parseEng(
      BUNDLED_MOTOR_FILES.find((f) => f.file === 'Estes_D12.eng')?.text ?? '',
      'd12.eng',
    )[0];
    if (d12 === undefined) throw new Error('bundled D12');
    const again: PasteLibraryMotor = {
      definition: motorFromEng(d12),
      provenance: { kind: 'thrustcurve', motorId: 'x', simfileId: 'y' },
      delays: [5],
    };
    const library = [mine, again];
    const built = await buildFromPaste(JSON.stringify(spec), { library });
    expect(built.notFlown).toBeUndefined();
    expect(built.notices[1]).toBe('Motor Acme F10, from your motor library; ejection delay 6 s.');
    const d = await buildFromPaste(JSON.stringify(exampleSpec()), { library });
    expect(d.notices[1]).toBe('Motor Estes D12, from the bundled library; ejection delay 5 s.');
  });

  it('opens a design file with a fresh id, and the RASAero II and OpenRocket texts', async () => {
    const example = exampleDesign();
    const file = await buildFromPaste(serializeDesign(example));
    expect(file.kind).toBe('design');
    expect(file.design.id).not.toBe(example.id);
    expect(file.design.components).toEqual(example.components);
    expect(file.notices[0]).toBe(`Opened the design file "${example.name}".`);

    const cdx = await buildFromPaste(exportCdx1(example).text);
    expect(cdx.kind).toBe('rasaero');
    expect(cdx.notFlown).toBeUndefined();

    const zip = unzipSync(new Uint8Array(readFileSync(join(ROCKETS, 'r1-three-fin-conical.ork'))));
    const xml = Object.values(zip)[0];
    if (xml === undefined) throw new Error('r1.ork has no entry');
    const ork = await buildFromPaste(new TextDecoder().decode(xml));
    expect(ork.kind).toBe('openrocket');
    expect(ork.design.motorMount?.motor?.definition.designation).toBe('D12');
  });
});

describe('buildFromFile (plan 0082)', () => {
  it('reads a dropped .ork zip by its bytes, the same as its XML pasted', async () => {
    const bytes = new Uint8Array(readFileSync(join(ROCKETS, 'r1-three-fin-conical.ork')));
    const fromFile = await buildFromFile('r1.ork', bytes);
    expect(fromFile.kind).toBe('openrocket');
    expect(fromFile.notices[0]).toMatch(/^Opened r1\.ork \(OpenRocket \d/);
    const xml = Object.values(unzipSync(bytes))[0];
    if (xml === undefined) throw new Error('r1.ork has no entry');
    const fromText = await buildFromPaste(new TextDecoder().decode(xml));
    expect(withoutIds(fromFile.design)).toBe(withoutIds(fromText.design));
  });

  it("reads any other file as text (Claude's answer saved, a design file), and refuses one that is not text", async () => {
    const text = new TextEncoder().encode(JSON.stringify(PROMPT_EXAMPLE));
    expect((await buildFromFile('answer.txt', text)).kind).toBe('specification');
    await expect(
      buildFromFile('photo.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x80, 0x81])),
    ).rejects.toThrow(/photo\.jpg is not a text file or an OpenRocket \.ork/);
  });
});
