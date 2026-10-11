# Plan 0004: Minimal RASP `.eng` motor file reader

**Status:** written 2026-10-11 under autonomous mode; implemented in the following commit.
**Phase:** 1, step 4. The full motor system (thrust interpolation, mass during burn, `.rse`) is Phase 2.

## Source

ThrustCurve.org, "RASP File Format" (`reference/docs/thrustcurve-api/raspformat.html`, SHA-256 in `reference/SOURCES.md`). Rules used, all from that page:

1. Blank lines and lines beginning with a semicolon are ignored at the beginning of an entry.
2. The header line has exactly seven space-separated fields: common name; casing diameter in mm; casing length in mm; delays separated by dashes ("0" for an ejection charge without delay, "P" for plugged); propellant (consumables) mass in kg; loaded mass in kg; manufacturer abbreviation. All seven must be present.
3. Data points follow immediately: time in seconds and thrust in newtons per line. An implicit first point (0, 0) is assumed and must not be given. The final point must have zero thrust and marks the burn time; zero thrust at any other point is an error. Points must be in order of time; a point before the previous one, or a first point at negative time, is an error.
4. After the final point only comments and blank lines may follow; multiple entries in a file are separated by at least one comment line.

## Files

| File                               | Purpose                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/formats/src/eng.ts`      | `parseEng(text, fileName?)`: returns every entry in the file as an `EngMotor`, or throws `EngParseError` naming the line and the rule broken |
| `packages/formats/src/errors.ts`   | `FormatError` base and `EngParseError`                                                                                                       |
| `packages/formats/src/eng.test.ts` | all eight reference motors parsed and their headers checked; malformed inputs                                                                |

## Output

`EngMotor`: designation, manufacturer, diameter and length (metres, converted with `UNIT-1`), delays (seconds, or `plugged`), propellant mass and total (loaded) mass (kilograms), the data points (seconds, newtons) with the implicit origin prepended, burn time (seconds), total impulse by the trapezoidal rule over the points (newton-seconds, informational), and the comment lines of the entry.

## Decisions

- Equal consecutive times are accepted (the page rejects only a point _before_ the previous one); negative thrust is rejected; a casing mass greater than or equal to the loaded mass, or a loaded mass smaller than the propellant, is rejected.
- Delay lists with separators other than dashes (some files use commas) are rejected with a message quoting the field; the owner can relax this if such files matter.
- Nothing is defaulted: a missing or non-numeric field is an error naming the field and line.

## Tests

- Each file in `reference/motors/` parses to one entry whose header matches the file's header line read by eye (values listed in the test), e.g. D12: 24 mm, 70 mm, delays 0, 3, 5, 7, propellant 0.0211 kg, total 0.0426 kg, "Estes"; H123W: 38 mm, 154 mm, delays [0], 0.126336 kg, 0.278656 kg, "AT"; F39T with aligned columns; C6 with leading-dot numbers (".0108").
- Burn time equals the last time; the first explicit point is at positive time; thrust is positive except at the end.
- Total impulse of the D12 by hand from the first three trapezoids is reproduced by the first partial sums, and the full value is within the certified class (10 to 20 N·s for a D).
- Errors: six fields in the header; non-numeric mass; zero thrust before the end; last thrust not zero; decreasing time; negative first time; text after the data; empty input; two entries in one file parse to two motors.
