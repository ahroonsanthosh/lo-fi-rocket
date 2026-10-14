# Plan 0079: the MCP server builds and flies a pasted design in one call

## 1. Why

The owner (2026-10-14): "i dont like the way you have to fill in everything, i want the claude mcp to bypass everything if you paste the info into the chat".

Today the server's instructions make Claude:

1. ask the user for every missing value before estimating;
2. build the rocket one tool call per part, then the motor, recovery and launch;
3. clear every "must" item of `review_design` before `simulate`.

A pasted kit description becomes a questionnaire and a dozen calls before any number appears.

## 2. What changes

- **Instructions.** When the user pastes a specification or a file, Claude builds it at once. It gives exactly what the paste says and leaves out what it does not say. It flies the rocket and reports. It does not ask first. The must items, the fields not given and the largest approximations come with the result, followed by an offer to refine. "Never compute physics yourself" and "never present an estimate as a measurement" stay. `about` returns the same text.
- **`build_and_fly`, a new tool.** One input holds the whole design:
  - the name and the parts (kind, name, position, fields, stage, as in `add_part`);
  - the motor by its name as people write it, with an optional mount, delay and overhang;
  - the recovery devices (as in `set_recovery`) and the launch settings (as in `set_launch`);
  - an optional weighed mass and CG;
  - the estimates Claude made from the paste (as in `note_assumption`).

  It is built with the existing edit functions, so every default is recorded exactly as the step-by-step tools record it. If a step fails, nothing is kept and the error names the step ("part 7 (Fins): …").

- **What `build_and_fly` returns, in this order:**
  1. the must items, then the fields not given and the confidence;
  2. the stability;
  3. the flight summary, events and warnings;
  4. the motor used and where it came from;
  5. a link that opens the design in the web app, and the design's id, for refining with the other tools.
- **The motor by name.**
  - **Parsing.** "D12-5", "Estes D12", "G80-7T", "AeroTech H128W" and "F39T" are read as manufacturer, designation and delay. "D12-5" is the D12 with a 5 s delay; "G80-7T" is the G80T with 7 s. Letter delay codes ("-M") are not numbers and stay not given.
  - **Lookup.** The session's library first. If it has no match, ThrustCurve.org is searched by the common name, and only a designation that matches exactly is downloaded. That is the same read-only, bounded transport as `search_thrustcurve` (D-093). The result says the motor was downloaded.
  - **No match.** A motor that is not found, is ambiguous, or cannot be reached (ThrustCurve.org may be down) never fails the call. The stability is returned with "not flown: …" and what to do.
  - **Mount not given.** The aftmost inner tube, otherwise the aftmost body tube. The choice is listed as an approximation.
  - **Delay not given.** As `set_motor`: plugged, and listed.
- **`import_design`.**
  - It also takes RASAero II `.CDX1` text (`"cdx1"`, the existing importer).
  - It takes `simulate: true`, so a pasted file gives the stability and the flight in the same call.
- **Two stale texts.**
  - `add_part`'s description says other parts "need a position"; they take the editing default, listed.
  - `about` says multi-stage flights are not modelled; they are, with the booster's own flight left out.
- **The Claude page** (`claude.html`) says Claude "asks for anything missing". It now says Claude builds from what you paste and lists what it assumed.

## 3. What does not change

Rule 3 (CLAUDE.md 1) still holds: every default and estimate appears in the result with its effect and the confidence. Only the order changes: the result first, then the list, instead of questions first. The step-by-step tools stay for refining.

## 4. Decision

D-118 records this. It supersedes the workflow part of D-092 (ask first, clear must items before simulating). It updates D-093's "two tools reach the network" to three, and D-094's tool count.

## 5. Tests

- **One call reproduces the example.** `build_and_fly` with the example rocket's parts, "Estes D12-5", the parachute and the launch settings gives `exampleDesign()`'s stability and flight bit for bit, as the step-by-step test does.
- **Motor names.**
  - "D12-5", "Estes C6-5", "F39-6T" and "AeroTech H128W" resolve to the bundled motors with the right delays.
  - "G80-7T" does not: the bundled file names its G80 "G80NBT", a different propellant label, so it is looked up on ThrustCurve.org instead of being guessed.
  - "Cesaroni D12" never takes the Estes D12. An unknown motor returns the stability and "not flown". A motor found only on ThrustCurve.org is downloaded through a recorded transport.
- **Defaults.** Fields, positions and the mount left out are listed. A bad field names its part and keeps nothing.
- **Imports.** A `"cdx1"` import of R1's export reads back. `simulate: true` returns the flight.
- **The server.** The tool list holds 25 tools, and the new one is marked as reaching the network. The bundle's smoke test counts 25.
