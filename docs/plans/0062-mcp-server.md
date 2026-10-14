# Plan 0062: The local MCP server (plan 0061 step 2)

Claude, in the user's own Claude Code or Claude Desktop, builds and simulates designs through a local MCP server (D-090). The server is a thin layer over the engine: every number comes from `packages/physics` and `packages/formats`, and every edit passes the same validation as a design file.

## 1. Package and distribution

- `packages/mcp` (`@lo-fi-rocket/mcp`, private). Node 18 or later, ES modules, TypeScript strict as the rest.
- Dependencies, pinned exactly and older than two weeks when adopted: `@modelcontextprotocol/sdk` 1.31.0 (MIT, the official SDK; stdio transport only) and `zod` 4.6.5 (its schema library).
- Bundled into one file, `lo-fi-rocket-mcp.mjs`, with Vite's library build, so a user installs nothing but the file. The bundle includes only what the stdio server imports.
- A Claude Desktop extension `lo-fi-rocket.mcpb`: a zip of `manifest.json` (manifest version 0.3, `server.type` `node`, entry `server/index.js`, run as `node ${__dirname}/server/index.js`; checked against `@anthropic-ai/mcpb` 2.1.2's schema and loader) and the bundled server.
- Both files are built by the deploy workflow and served from the GitHub Pages site, with a page that explains the two ways to connect:
  - Claude Code: `claude mcp add --transport stdio lo-fi-rocket -- node <path>/lo-fi-rocket-mcp.mjs`.
  - Claude Desktop: open the `.mcpb` file, or Settings > Extensions > Install extension.
- Publishing to npm (`npx -y @lo-fi-rocket/mcp`) needs an npm account in the owner's name; not done until the owner asks.

## 2. State

The server keeps designs in memory for the session, by id: no file is read or written. Designs enter by `new_design` or `import_design` (content passed in the call) and leave by `export_design` (the `.lofi.json` text, which Claude Code can save with the user's permission, or the user opens in the app).

## 3. Tools

Inputs take SI numbers or quantity strings converted with sourced factors (UNIT-1 to UNIT-11, and UNIT-12 and UNIT-13 added for this plan from the SI Brochure: cm, ms, hPa, kPa, g/cm³, km/h): `"38 mm"`, `"1.5 in"`, `"120 g"`, `"4 oz"`, `"3 deg"`, `"20 C"`. The server converts them, so Claude does no unit arithmetic. An optional field given as `null` is left out (a solid nose cone has no wall thickness).

| Tool                                         | Does                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `about`                                      | Component kinds and their fields with units, accepted units, the models and their validity ranges, the main limitations, and how to work (section 4)                                                                                                  |
| `new_design`                                 | An empty design, or the example (R1 with the Estes D12)                                                                                                                                                                                               |
| `import_design`                              | `.lofi.json` text, `.ork` XML text or base64 `.ork` zip; returns the import notices and approximations                                                                                                                                                |
| `export_design`, `get_design`                | The design file text; a compact summary of parts with ids                                                                                                                                                                                             |
| `add_part`, `update_part`, `remove_part`     | Edit parts. A position is absolute from the nose tip, or relative to another part's fore or aft end. A field not given takes the app's editing default and is recorded on the part as an approximation ("default, not from the user") until it is set |
| `set_motor`                                  | By library id or by ThrustCurve.org motor id (downloaded read-only, D-090), with overhang, ejection delay and cluster offsets                                                                                                                         |
| `find_motor`                                 | The bundled library, motor files imported this session and the ThrustCurve.org catalogue                                                                                                                                                              |
| `import_motor`                               | `.eng`, `.rse` or thrust-curve CSV content into the session's library                                                                                                                                                                                 |
| `set_recovery`, `set_launch`, `set_as_built` | Recovery devices, launch site, rail and wind, and the weighed mass and balance point                                                                                                                                                                  |
| `note_assumption`                            | Records an estimate Claude made (a thickness read from a photo, a density from a material name) as an approximation with its source and impact                                                                                                        |
| `review_design`                              | The checklist before a simulation: fields still at defaults, motor fit, warnings, stability at liftoff and burnout, computed against weighed mass and CG, every approximation and the confidence                                                      |
| `stability`                                  | CP, CG and margin at liftoff and burnout, with the plain-language assessment                                                                                                                                                                          |
| `simulate`                                   | Summary values, events, warnings, approximations and the confidence; a time series only when asked, at most 200 samples                                                                                                                               |
| `monte_carlo`                                | The dispersion summary for a stated number of runs and seed (at most 1000 runs)                                                                                                                                                                       |

## 4. Instructions shipped with the server

The server's `instructions` (sent at connection) tell Claude to: ask the user for every dimension and mass it does not have before estimating; record each estimate with `note_assumption`; run `review_design` and clear or explain each item before `simulate`; compare with the user's weighed mass and balance point when known; report the confidence and the largest approximations with every result; never present an estimate as a measurement; never compute physics itself.

## 5. Security (plan 0061 section 5)

- No tool reads or writes a file, runs a command or contacts any host but ThrustCurve.org (read-only, fixed base URL, 20 s timeout).
- Every input passes the zod schema of its tool, then the design file's validator and the engine; all reader size limits apply (D-090); file content is limited to 8 Mi characters and one message to 16 MiB, designs to 500 parts, freeform fins to 1000 points, time series to 200 samples, Monte Carlo to 1000 runs, sessions to 50 designs and 200 motors.
- Text from files and from users (part names, notices) is returned as data in JSON, never as instructions.
- Errors come back as tool errors with the validator's plain message, never as a crash of the server.

## 6. Shared code moved, not copied

- The app's editing defaults (`defaultComponent`, `defaultRecoveryDevice`) move from `packages/app/src/state/reducer.ts` to `packages/formats/src/design/defaults.ts`, unchanged; the app imports them.
- The eight bundled `.eng` files move into `packages/formats/src/motors/bundled.ts` as text, with a test that each is byte-identical to `reference/motors`; the app's library reads them from there.

## 7. Tests

- Every tool driven through the SDK's in-memory client and server pair, as Claude would call it.
- The example design built part by part through `add_part` gives the same CG, CP and apogee as `exampleDesign()` (bit-identical).
- R1 to R5 imported as `.ork` through `import_design` give the same results as the formats tests.
- The tool field table matches the validator's accepted fields (`COMPONENT_FIELDS`, now exported from `validate.ts` and used by the validator itself), so the tools cannot drift from the file format.
- Quantity strings: every unit against its sourced factor (hand values in the test).
- Hostile inputs: oversized strings, unknown fields, 10 000 parts, a DOCTYPE, path-like strings, all refused with plain messages and the server still answering.
- The bundle starts under Node, answers `initialize` and `tools/list` over stdio, and the `.mcpb` manifest passes the `@anthropic-ai/mcpb` 2.1.2 schema.

## 8. Pull requests

1. The server with the design, part, motor (bundled and imported files), recovery, launch, as-built, assumption, review, stability and simulate tools; the moved defaults and motors; UNIT-12 and UNIT-13.
2. ThrustCurve search and download, `monte_carlo`.
3. The bundle, the `.mcpb`, the deploy workflow and the connection page.
