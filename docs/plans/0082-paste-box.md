# Plan 0082: build with Claude on the site, with nothing to download

## 1. Why

The owner (2026-10-17): "why is there still no claude mcp on the site?" Earlier they turned down the download ("i dont want it to make me download an extension") and chose the paste box.

Today the only route is File > "Use with Claude", a page of downloads (the Claude Desktop extension, or the server for Claude Code).

A site cannot run Claude itself without one of two things, and the owner's cost rule rules out both:

- a Claude API key, paid per use by whoever owns it;
- a hosted server, which GitHub Pages cannot provide.

## 2. What changes

- **A visible button.** "Build with Claude" sits in the top bar, beside File.
- **The dialog, in three steps.**
  1. **Copy the prompt.** It tells Claude the exact JSON to answer with: the same specification as the MCP server's `build_and_fly` (parts nose to tail, units as written, the motor by name). It also says to leave out what the user did not give.
  2. **Ask Claude.** Paste the prompt into any Claude app (claude.ai, the desktop or phone app, Claude Code), on the user's own plan, with the rocket's description, a photo or a file.
  3. **Paste the answer back.** The site builds the design and flies it at once. It shows the stability and the flight, with every field left out listed, as the MCP server does.
- **What the box also accepts.** Instead of Claude's answer, the box takes the text of a design file: `.lofi.json`, OpenRocket XML, or RASAero II `.CDX1`. A file can also be dropped on it (`.ork` included). These go through the same importers as File > Open.
- **One builder for both routes.** The specification's validation (the zod schema) and the builder (`Session.build`) move into browser-safe modules of the MCP package (`spec.ts`, `paste.ts`, exported as `@lo-fi-rocket/mcp/paste`). The server and the site then build identically, and the MCP SDK never enters the site's bundle.
- **The Claude page** (`claude.html`) leads with the paste route. The downloads stay, as the alternative for people who want Claude to drive the simulator directly.

## 3. Cost and security

- **Cost: $0.** No API key, no server, no account. Claude runs on the user's own plan, in their own Claude app.
- **Data stays on the device.** The paste is parsed in the browser.
- **One network call, read-only.** A motor the bundled library lacks is looked up on ThrustCurve.org, as the motor picker does (the site's CSP already allows it).
- **Untrusted input.** The paste is checked for size first (the same input limit as files, `MAX_INPUT_BYTES`), parsed as JSON or XML by the existing importers (which refuse DOCTYPE), and validated against the schema before anything is built. A bad paste says what is wrong, in plain words, and changes nothing.

## 4. Tests

- **`paste.ts`, the classifier.** It recognises a fenced or bare specification, a design file, `.CDX1` text and OpenRocket XML. Text that is none of these, or too large, gets a plain error.
- **The example, both routes.** The example rocket's specification builds the same design through `buildFromPaste` as through `build_and_fly`.
- **The app.** Pasting the example's specification replaces the design and shows the flight, with the "not given" items. A bad paste keeps the design and shows the error.
- **The MCP server is unchanged.** All its tests pass, and the smoke test still counts 25 tools.
- **The page policy.** An end-to-end test in Chromium pastes an answer and flies it with the site's Content-Security-Policy enforced; any violation fails it.

## 5. Result

- Built as above (D-122). The builder loads only when the box opens (41 kB compressed); the MCP SDK stays out of the site's bundle.
- The end-to-end test found that zod 4 probes for eval when a schema is created, which the page policy forbids. `spec.ts` turns that off (`z.config({ jitless: true })`); the checks give the same result.
