# Plan 0061: Claude as the modelling partner, at no cost beyond the user's own subscription, secure by design

The owner's goal (2026-10-13): any rocket, from any specification, modelled completely and simulated as accurately as the evidence allows, with Claude doing the modelling; secure, with ill intent accounted for and the user protected; no cost to anyone except usage on the user's own Claude subscription; open source; other AI providers later.

## 1. What "perfect" can honestly mean

No simulator is perfect; OpenRocket and RASAero are within a few per cent at best. This app gets as close as the evidence allows by:

1. **Complete inputs.** Claude reads whatever the user has (a kit's parts list, a PDF manual, photos, an `.ork` file, a sentence) and turns it into a full design, asking for what is missing instead of guessing silently.
2. **Sourced physics only.** Claude never computes physics. It builds the design and reads the results; every number comes from the engine's sourced, tested methods (CLAUDE.md section 1, rule 1).
3. **Every assumption visible.** When Claude estimates a value (a wall thickness from a photo, a density from a material name), the estimate is recorded as an approximation with its source and impact, so the confidence rating covers Claude's work as well as the models' limits (D-083).
4. **Uncertainty, not a single number.** Monte Carlo over the inputs that are uncertain, with the spread shown.
5. **Validation against reality.** Measured data (wind tunnel reports, OpenRocket references, altimeter flights) keep the engine honest; a modelling benchmark keeps Claude's design-building honest (section 6).

## 2. How users connect their own Claude (no cost to anyone else)

The engine already runs entirely in the user's browser or on their machine; no server is needed for physics. Facts checked against Anthropic's documentation on 2026-10-13 (sources in D-090).

- **Route A, the default: a local MCP server.**
  - `packages/mcp`, run with `npx` by Claude Code: `claude mcp add --transport stdio lo-fi-rocket -- npx -y @lo-fi-rocket/mcp` (code.claude.com/docs/en/mcp).
  - The same server packaged as a Claude Desktop extension (`.mcpb`), installed from Settings > Extensions, the file served from the GitHub Pages site (claude.com/docs/connectors/custom/add-unlisted).
  - Either way it runs on the user's machine, under the user's own plan (Free, Pro, Max, Team or Enterprise), with nothing hosted: no cost to the project and no server to attack. Other AI apps that speak MCP can use the same server later.
- **Route B, optional: a remote connector for claude.ai on the web and phone.**
  - Added by URL on any plan; Free allows one.
  - Needs a public HTTPS server using Streamable HTTP, which GitHub Pages cannot host. That means a host account in the owner's name and a public server to defend.
  - Usage then runs in the user's own Claude session. Anthropic's documentation does not state the metering explicitly.
- **Route C, opt-in, only if the owner accepts the risk: the user's own API key in the app** ("only strictly with their input", the owner, 2026-10-13).
  - The official SDK allows it only with `dangerouslyAllowBrowser`. Anthropic's documentation warns that keys in a browser can be extracted, and does not list public apps among the acceptable uses.
  - If built, it is off by default. The key is kept in memory only, never stored or sent anywhere but Anthropic.
  - Every request is a click by the user, with its token limit and cost estimate shown first and a per-session cap.
  - Users are told to use a dedicated workspace with its own spend limit and a key scoped to it.
  - It would be API billing, not the subscription.
- **Not allowed:** a "log in with your Claude account" button inside the site. Anthropic: "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users" (code.claude.com/docs/en/legal-and-compliance).

## 3. The tool surface (what Claude can do through the MCP server)

All tools compute and return data; none deletes, sends or runs anything outside the simulator.

- `capabilities`: component kinds, units, the models and their validity ranges, the limitations list.
- `new_design`, `add_part`, `update_part`, `remove_part`, `set_motor`, `set_recovery`, `set_launch`, `set_as_built`: the same validated edits the app makes; invalid input comes back as a plain message.
- `note_assumption`: records an estimate Claude made, with its source and impact, as an approximation on the part or the design.
- `import_file`: `.ork`, `.eng`, `.rse`, `.lofi.json`, CSV drag curves, given as content (never a file path, see section 5).
- `find_motor`: the bundled library and the ThrustCurve.org catalogue.
- `review_design`: the checklist Claude must clear before simulating. Missing or defaulted inputs, fit problems, measured-versus-computed mass and CG, and every approximation with its impact.
- `stability`, `simulate`, `monte_carlo`: the engine's results with warnings, approximations and the confidence rating.
- `design_link`: a link that opens the exact design in the web app. The design travels in the link's `#` fragment, which browsers never send to any server.

## 4. Weighing everything carefully

Claude's instructions, shipped with the server, require it to:

- ask for missing data before estimating;
- run `review_design` and clear its items;
- cross-check against what the user measured (weight, balance point);
- report the confidence and the largest approximations with every result;
- never present an estimate as a measurement.

## 5. Security: threat model and defences

| Threat                                                                                    | Defence                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A crafted `.ork` that unzips to gigabytes (zip bomb)                                      | Size limits on the file and on the unzipped entry before decompressing (today there are none)                                                                                                                                                                                                   |
| XML entity expansion ("billion laughs")                                                   | Refuse any document with a DOCTYPE or entity declaration; `.ork` and `.rse` files never have one                                                                                                                                                                                                |
| Oversized or hostile designs (huge arrays, extreme numbers)                               | Limits on parts, points and simulation steps; every input validated as today                                                                                                                                                                                                                    |
| Prompt injection: instructions hidden in a file, a manual or a web page that Claude reads | Tools have no power to harm: no shell, no file paths, no writes, network only to ThrustCurve.org read-only; part names and file text are returned as data                                                                                                                                       |
| A malicious shared design link                                                            | The same strict validation as a file, a size cap, and React's escaping (no HTML from data)                                                                                                                                                                                                      |
| Supply-chain attacks                                                                      | Pinned dependencies and lockfile, few dependencies, CodeQL and dependency review in CI, npm provenance on the published MCP package                                                                                                                                                             |
| The site itself (script injection, clickjacking)                                          | Content-Security-Policy allowing only the app's own scripts and the listed data hosts, no third-party scripts. GitHub Pages cannot send headers and a meta tag cannot carry `frame-ancestors`, so framing is not blocked; the page holds no account or secret to abuse (revisit before route C) |
| Privacy                                                                                   | Designs stay on the user's machine; the map picker's outside services (OpenStreetMap search, map and elevation tiles) learn the searched location: said in the app and switchable off                                                                                                           |
| A remote MCP server, if one is ever hosted                                                | Stateless, no stored user data, input size and rate limits, no secrets in it                                                                                                                                                                                                                    |

## 6. Proving it: a modelling benchmark

A set of rockets with known answers: the OpenRocket references and probes, kit specifications with measured masses, and later real flights. For each, Claude builds the design from the specification alone; the benchmark compares the CG, CP, mass and apogee against the known ones and publishes the error. "Industry leader" is earned by these numbers, not claimed.

## 7. The owner's decisions (2026-10-13)

1. Route A only: the local MCP server for Claude Code and Claude Desktop. Routes B and C are not built for now (D-090).
2. The licence is deferred ("for now ignore making open source"). The repository stays as it is; the OpenRocket harness under `tools/` stays GPL-3.0.
3. Multi-stage designs drop the spent stage at separation (D-091; CLAUDE.md's version-1 non-goal changed).

## 8. Steps (each its own pull request)

1. Security hardening of today's app: file and unzip limits, the DOCTYPE refusal, CSP, CodeQL, the map-services notice (done, D-090); dependency review once the owner switches on the dependency graph.
2. `packages/mcp` with the tool surface and the review checklist; tests that drive every tool; docs to connect Claude Desktop and Claude Code.
3. `design_link` in the web app (open a design from the URL fragment, validated).
4. The modelling benchmark and its first published results.
5. Route B, if the owner later chooses it.
