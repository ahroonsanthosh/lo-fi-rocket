# Plan 0063: Open a design from a link (plan 0061 step 3)

A link of the form `https://ahroonsanthosh.github.io/lo-fi-rocket/#design=v1.<data>` opens a design in the web app. Claude's `design_link` tool makes one, so a design built in Claude Desktop or Claude Code opens in the app with one click, with its approximations and "not given" notes intact.

## Format

- `<data>` is the design file text (`serializeDesign`, schema version included), deflated (fflate, level 9) and written in base64url (RFC 4648 §5, no padding). `v1.` names this encoding, so a later one can be told apart.
- The design travels in the `#` fragment, which browsers never send to a server: GitHub Pages never sees it.

## Opening a link (the app)

- At start-up, a `#design=` fragment is decoded and validated exactly as a design file (`parseDesign`: migration, every field, the size limits of D-090). The design opens with a fresh id, so a link never overwrites a stored design, and the fragment is removed from the address so a reload opens the autosave.
- A notice says the design came from a link and that the previous design is kept under File > Designs.
- A link that cannot be read opens the autosaved design as usual, with a notice saying why the link was refused.

## Limits (plan 0061 section 5)

- The encoded text is refused above 512 Ki characters (far above any design; browsers cap addresses near 2 MB).
- Decompression is a stream fed in 16 KiB slices and abandoned past 4 MiB of output, so a "deflate bomb" stops early, as the `.ork` reader does (D-090).
- Anything but `v1.` and base64url characters is refused before decoding.

## Code and tests

- `packages/formats/src/design/link.ts`: `encodeDesignLink`, `decodeDesignLink`, `DESIGN_LINK_PREFIX`. Tests: the example and every reference rocket round-trip exactly; a bomb, a wrong prefix, bad characters, truncated data and invalid designs are refused with plain messages.
- `packages/app`: start-up reads the fragment (unit test with a stored design kept, an end-to-end test opening the example by link).
- `packages/mcp`: `design_link` returns the link and its length; tested by decoding it back.
