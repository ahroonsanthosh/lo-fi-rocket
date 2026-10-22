# Lo-Fi Rocket

[![CI](https://github.com/ahroonsanthosh/lo-fi-rocket/actions/workflows/ci.yml/badge.svg)](https://github.com/ahroonsanthosh/lo-fi-rocket/actions/workflows/ci.yml)
[![Deploy](https://github.com/ahroonsanthosh/lo-fi-rocket/actions/workflows/deploy.yml/badge.svg)](https://github.com/ahroonsanthosh/lo-fi-rocket/actions/workflows/deploy.yml)
[![CodeQL](https://github.com/ahroonsanthosh/lo-fi-rocket/actions/workflows/codeql.yml/badge.svg)](https://github.com/ahroonsanthosh/lo-fi-rocket/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A rocket design and flight simulator that tells you how far to trust
every number.** Free, and it runs in your browser.

**[Open the simulator](https://ahroonsanthosh.github.io/lo-fi-rocket/)**
(no install, no account).

![The Lo-Fi Rocket designer: a three-fin rocket with its CG and CP, live stability and the parts list](docs/images/designer.png)

## Why it matters

Hobby and student rocketeers use simulators to answer safety questions: is
it stable, does it leave the rail fast enough, where will it land? The
standard tools are hard to learn and rarely say how accurate they are.
Lo-Fi Rocket is built the other way round:

- **Accuracy you can check.** All 145 equations are cited to a page of a
  published source and tested against hand calculations. Results are
  checked against wind-tunnel data, 24 real flights and two other
  simulators.
- **Honest about its limits.** Every result lists its approximations and a
  confidence rating, and says what your altimeter will actually read.
- **Easy, and free.** Design with stability updating live, then fly in six
  degrees of freedom with a 3D replay, Monte Carlo landing zones and real
  launch-site maps. Imports OpenRocket, RASAero II and ThrustCurve.org
  motors.

![Flight results beside the 3D replay: apogee with the range real flights reached, rail exit velocity and a confidence rating](docs/images/flight.png)

## Build with Claude

Press **Build with Claude**, describe your rocket to Claude (or attach a
photo or parts list), and paste the answer back. The site checks it, builds
the rocket and flies it. Anything Claude estimated is listed with the
result. There's also an MCP server so Claude Desktop and Claude Code can
drive the simulator directly.

## How accurate is it?

| Result                                   | Agreement                                                |
| ---------------------------------------- | -------------------------------------------------------- |
| Atmosphere (US Standard Atmosphere 1976) | Matches the published tables to their printed precision  |
| Centre of gravity                        | Within 0.0004% of OpenRocket                             |
| Centre of pressure vs wind tunnel        | 0.4% of body length below Mach 0.8, 3 to 4% above        |
| Drag vs wind tunnel, subsonic            | 6.7% rms                                                 |
| Apogee and velocity vs OpenRocket        | Apogee within 3%, max velocity within 1%, rail exit 0.3% |
| Determinism                              | Same inputs, bit-identical outputs                       |

Where to be careful: drag past Mach 0.8 is less certain (15 to 20% from
measured data), and on real amateur flights the predicted apogee is about
5% high below Mach 0.95 and more above it. The app warns in those cases
and shows the range real flights reached. Nothing above Mach 2 is
validated. Full details in [docs/known-limitations.md](docs/known-limitations.md)
and [docs/reports/](docs/reports/).

## How it's built

One developer directing several Claude Code agents working in parallel
(physics, UI, 3D, review), each through pull requests. The rules are in
[CLAUDE.md](CLAUDE.md): no physics from memory, a source for every
equation, tests in the same change, and no tuning constants to fit data.
Every modelling choice is recorded with its reason in
[docs/decisions.md](docs/decisions.md). About 1,900 tests run on every
change, and every merge redeploys the site.

## Run it locally

Requires Node 22.12+ and pnpm 10.

```sh
pnpm install
pnpm --filter @lo-fi-rocket/app dev   # the app in your browser
pnpm check                             # typecheck, lint, format and all tests
```

| Package            | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `packages/physics` | The simulation engine, pure TypeScript with SI units |
| `packages/formats` | File import and export (.ork, .CDX1, .eng, .rse)     |
| `packages/app`     | The React app                                        |
| `packages/ui`      | The design system                                    |
| `packages/viewer`  | 3D replay and launch-site maps                       |
| `packages/mcp`     | The Claude integration                               |

## License

MIT ([LICENSE](LICENSE)). The OpenRocket comparison harness in
`tools/openrocket-harness/` is GPLv3, separately, and nothing in
`packages/` depends on it. OpenRocket was only ever run as a black box to
produce reference results; none of its code was used.
