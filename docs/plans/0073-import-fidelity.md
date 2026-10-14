# Plan 0073: import fidelity, from the OpenRocket validation campaign

## 1. What the campaign found

The validation campaign (60 generated rockets against OpenRocket 24.12, task 18) found these gaps in what an `.ork` import keeps. Each breaks CLAUDE.md rule 3 (nothing ignored unless listed) or lists an approximation with the wrong weight:

1. **Surface finish ignored.** `<finish>` was in the reader's ignored list, so every part flew at the design's 60 µm whatever the file said, and nothing was listed. On the six campaign rockets with another finish, the apogee moved −13 % to +14 %.
2. **Streamers dropped.** A streamer was stood in as "the part left out: the file gives no mass for it", which is wrong (the file gives its strip, from which OpenRocket computes 1.35 g), and the recovery was lost: that rocket fell ballistically, 49 m/s at the ground against 23 m/s.
3. **Fillets left out of the mass**, listed as minor. On one rocket the fillets are 15 % of the fin mass (structure mass −2.5 %, CG −2.8 %, pitch inertia −6.5 %).
4. **Airfoil fin mass** (the slab kept, D-077) listed as minor. Airfoil fin sets are +17.6 % against OpenRocket, structure mass up to +8.5 %.
5. **The RK4 refusal message** rounds the safe step up (`toPrecision(2)`): it asks for 0.0020 s, the very step it refused.
6. **Rail buttons past the end of the body** make the stability throw instead of giving a result with a listed approximation.

Three more findings are differences between OpenRocket 24.12 and the source, not import gaps, and need the owner (rule 4): what an `.ork` "airfoil" fin section maps to, the launch lug drag, and the friction form factor (plan 0074, open questions in `docs/progress.md`).

The work is split into one pull request per item, in the order above.

## 2. Part 1: surface finish (this change, D-110)

### What OpenRocket does (`FinishProbe`, `reference/rockets/finish-probe/values.txt`)

- **The file.** Each external part (nose cone, body tube, transition, fin set, launch lug, rail button) has its own `<finish>`. It is one of nine names, written in lower case: `rough`, `roughunfinished`, `unfinished`, `normal`, `smooth`, `optimum`, `polished`, `finishpolished`, `mirror`.
- **The roughness heights.** 500, 250, 150, 60, 20, 5, 2, 0.5 and 0 µm in that order. Five of them are the values of Niskanen's Table 3.2 or Figure 3.10: 500 (raw wooden boards), 60 (regular paint), 20 (paint in aircraft mass production), 5 (optimum paint-sprayed surface) and 0.5 (finished and polished surface).
- **The friction.** Each part's skin friction is computed at its own finish. In a rocket with mixed finishes each part's friction is exactly that part's friction in a rocket of its finish alone.
- **The smooth finishes.** At these Reynolds numbers, 5 µm and smoother are all in the turbulent (smooth-wall) regime, so they give the same friction.

### The method

- **One finish (the thesis).** Niskanen gives one roughness R_s for the whole rocket: eqs. (3.78) to (3.84) give one C_fc, and eq. (3.85) applies it to the body and fin wetted areas.
- **Several finishes.** The friction force is a sum over the surfaces (eq. 3.77). With parts of several finishes, each surface's C_fc comes from eqs. (3.78) to (3.84) at its own R_s, with the rocket's length L in eqs. (3.79) and (3.80) as for one finish. Eq. (3.85)'s body and fin factors then apply to each surface.
  - With one finish this is eq. (3.85) itself, to the last bit: the code takes the old path whenever every part has the design's finish.
- **The DATCOM base drag** (D-069) uses the body's C_f S_S (eq. 4.2.3.1-b). With several finishes C_f is the wetted-area mean, Σ C_f,i S_i / Σ S_i, which gives the same product exactly.
- **R_s = 0** (OpenRocket's "mirror") is a smooth surface. Eq. (3.78) "assumes that the surface is smooth" (p. 43). The critical Reynolds number (3.79) is then infinite, so the roughness-limited value never applies. It was refused before.

### The design file (schema 4) and the reader

- **Design file.** A part may carry its own `roughnessHeight`, for a part whose finish is not the design's. A version-3 file migrates unchanged: every part has the design's finish.
- **Reader.**
  - It reads each friction part's `<finish>`: nose cone, body tube, transition and fin set.
  - **Design finish.** The design's finish is the one most of those parts have; on a tie, the first in file order. Every part with another finish keeps its own.
  - **Lugs and buttons.** Their finish is not kept: eq. (3.95) and the rail pin do not depend on it.
  - **Missing finish.** A part that names none has OpenRocket's default, regular paint.
  - **Unknown finish.** A name the app does not know is flown as regular paint and listed (moderate).
- **Unchanged.** The physics, the app's editors and the MCP tools keep a part's own finish through edits. A user cannot yet set one in the app: that, and a design-wide finish control the app also lacks, are part 1b.

### Tests

- **Physics.**
  - `skin-friction.test.ts`: R_s = 0 by hand (1.53969·10⁻³ at R = 10⁹).
  - `drag.test.ts`: R1 with its fins at 5 µm by hand. The body term is 0.232511 and the fins 0.073940, total 0.30645 (all at 60 µm: 0.332418).
  - `drag.test.ts`: a part given the design's finish changes nothing (bit for bit), and every part at one other finish equals that design finish.
- **Formats.** `ork.finish.test.ts`:
  - Each of the nine finishes is read as the design's.
  - The mixed file keeps each part's own.
  - The finish reaches the physics.
  - An unknown finish is listed.
  - **Friction against OpenRocket.** The friction of all 14 probe rockets at Mach 0.1, 0.3, 0.8 and 1.5 is 1.24 to 1.46 % above OpenRocket's, the same as with regular paint everywhere within ±0.11 %. The 1.3 % offset is the form factor (campaign item 7: eq. (3.85) as printed against OpenRocket's 1 + 1/(4 f_B)).
- **Unchanged.** Every reference rocket and golden output: all of them are regular paint throughout.

## 3. Part 2: streamers (next)

- **Source.** Niskanen Appendix C (pp. 111 to 116) gives the streamer drag from wind tunnel measurements, eq. (C.6), normalised to the strip area w l:
  - C_D = 0.034 · ((ρ_m + 25 g/m²)/105 g/m²) · ((l + 1 m)/l).
  - The thesis validates it within 12 to 27 % on an independent set (Table C.2) and quotes about 20 % in C_D and 15 % in descent speed (p. 68).
- **What OpenRocket does.** Its automatic streamer C_D is exactly eq. (C.6), capped at 0.4 (`FinishProbe` part 3).
  - A 0.6 × 0.06 m strip of 80 g/m² gives 0.090667.
  - A 0.05 m long strip gives 0.4, where eq. (C.6) gives 0.714.
  - The mass is the strip area times the surface density.
- **The plan.**
  - A streamer recovery device in the physics and the design file (schema 5), with the descent drag C_D · w · l.
  - The reader reads `<striplength>`, `<stripwidth>`, the surface material and `<cd>`.
  - The comparison mode takes OpenRocket's cap.
  - A strip outside the measured lengths and widths of Figure C.1 (about 0.2 to 1 m long, 0.01 to 0.1 m wide) is listed.

## 4. Part 3: the smaller fixes (next)

- **Fillets.** Add the fillet mass, from its cross-section along the root chord (exact geometry).
- **Approximation ratings.** Rate the airfoil fin mass and any remaining fin approximation by their measured effect, not "minor".
- **RK4 safe step.** Round it down in the refusal message.
- **Rail buttons past the body end.** List them and give the stability, instead of throwing.
