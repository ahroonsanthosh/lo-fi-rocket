# Decision log

Each entry: ID, date, decision, why, alternatives considered, consequences. Entries are never deleted; a reversed decision gets a new entry that references the old one.

## D-001 (2026-10-11): pnpm workspaces monorepo with three packages

- **Decision:** `pnpm` workspaces with `packages/physics`, `packages/formats`, `packages/app`. Packages are consumed from TypeScript source (`exports` point at `src/index.ts`); there is no build step for the libraries yet.
- **Why:** The structure is mandated by CLAUDE.md section 5. pnpm is already installed in the development environment, enforces strict dependency isolation, and its `workspace:*` protocol keeps the cross-package links explicit. Consuming source directly avoids a build step while the API is still forming.
- **Alternatives:** npm workspaces (weaker isolation), Nx or Turborepo (not needed at three packages).
- **Consequences:** When the app is published, the libraries will need a declaration build; revisit then.

## D-002 (2026-10-11): TypeScript 6.0, not 7.0

- **Decision:** Pin `typescript@6.0.3`.
- **Why:** TypeScript 7.0 (the native compiler) is the registry's `latest`, but `typescript-eslint@8.71` declares support only for `typescript < 6.1`. Type-aware linting is how we enforce "no `any`" mechanically, so it wins.
- **Alternatives:** TypeScript 7 without type-aware lint. Rejected: losing the lint rules is worse than losing compiler speed.
- **Consequences:** Upgrade to 7 once typescript-eslint supports it. Check `peerDependencies` before bumping.

## D-003 (2026-10-11): Strictness beyond `strict`

- **Decision:** In addition to `strict` and `noUncheckedIndexedAccess`, enable `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `isolatedModules`. ESLint runs `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` with `no-explicit-any` and all `no-unsafe-*` rules as errors.
- **Why:** CLAUDE.md section 5 requires `strict` and no `any`; the extra flags catch the classes of mistake (missing return, optional-property confusion, index-signature typos) that produce silently wrong numbers rather than crashes.
- **Consequences:** More verbose code in places. Accepted.

## D-004 (2026-10-11): Purity of `packages/physics` is enforced by lint

- **Decision:** ESLint forbids `Math.random`, `Date.now`, `fetch`, `window`, `document`, Node built-ins and React imports inside `packages/physics/src`.
- **Why:** CLAUDE.md section 5: pure functions, no UI, no network, deterministic.
- **Consequences:** Seeded random generators for Monte Carlo (Phase 5) must be implemented or imported as pure code.

## D-005 (2026-10-11): Error hierarchy

- **Decision:** `PhysicsError` base with `NotImplementedError`, `InvalidInputError` (parameter, value, requirement) and `NonFiniteResultError` (where, value). Defined in `packages/physics/src/errors.ts`.
- **Why:** CLAUDE.md rules 2 and 3 and section 8 each need a distinct, catchable error so the UI can show the right message. The base class lets the UI catch everything from the engine in one place.

## D-006 (2026-10-11): ESM everywhere, Vitest projects per package

- **Decision:** All packages are `"type": "module"`. One root `vitest.config.ts` lists `packages/*` as projects; each package has a small `vitest.config.ts` naming itself. `pnpm test` runs everything.
- **Why:** One command runs the full suite, which CLAUDE.md rule 7 requires before any task is declared complete.

## D-007 (2026-10-11): Continuous integration runs the same `check` as locally

- **Decision:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check`, `test` on every push and pull request. The same steps are `pnpm check` locally.
- **Why:** Reliability (CLAUDE.md section 8) and the rule that the full suite passes before a task is complete.

## D-008 (2026-10-11): Prettier for formatting

- **Decision:** Prettier with single quotes, 100-column width, trailing commas. `pnpm format:check` is part of `pnpm check`.
- **Why:** Removes formatting from code review so review time goes to physics.

## D-009 (2026-10-11): SessionStart hook installs dependencies in cloud sessions

- **Decision:** `.claude/hooks/session-start.sh`, registered in `.claude/settings.json`, runs `pnpm install --frozen-lockfile` synchronously at the start of every Claude Code cloud session (it exits immediately outside one).
- **Why:** Cloud session containers start from a fresh clone. Without the hook, the first test or lint run in each session fails until dependencies are installed, which invites skipping the full-suite rule (CLAUDE.md rule 7).
- **Consequences:** Session start waits for the install (a few seconds with a warm cache). Can be made asynchronous if that becomes annoying.

## D-010 (2026-10-11): Branded quantities enforced at function boundaries only

- **Decision:** `Quantity<Unit>` brands (plan 0001, Part A) are checked at function boundaries. Arithmetic yields plain `number`; functions re-brand on return through the validating constructor. No checked-arithmetic helpers.
- **Why:** Catches the common mistake (wrong unit or wrong quantity passed to a function) with zero runtime cost beyond a finiteness check, and keeps formula code readable. TypeScript cannot express unit algebra through `+` and `*` legibly.
- **Alternatives:** `add`/`mul`/`div` helpers with type-level unit algebra. Rejected for now; revisit if a unit bug escapes (approved by the project owner, plan 0001 question 6).

## D-011 (2026-10-11): SI Brochure approved as the source for definitional conversions

- **Decision:** BIPM, The International System of Units (SI), 9th edition (2019), is an approved source for unit definitions and definitional conversions (`UNIT-*` entries). Every such conversion cites its section and table.
- **Why:** CLAUDE.md section 4 requires every constant to have a source; the owner asked that even definitional factors be cited so the rule has no exceptions.

## D-012 (2026-10-11): Atmosphere g₀ stays in the atmosphere module under its own name

- **Decision:** The 1976 standard's g₀ = 9.80665 m/s² is an atmosphere constant (`seaLevelGravityG0`) and is not exported as a gravity model. The simulator's gravity is defined separately in Phase 2.
- **Why:** One place defines gravity for flight; the atmosphere's g₀ is a defining constant of the standard, not a model of the launch site. See `docs/conventions.md`, "Gravity: two different constants".
