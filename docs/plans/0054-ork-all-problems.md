# Plan 0054: list every unsupported .ork feature at once

## Problem

The reader stopped at the first unsupported feature, so a user fixing or reporting problems saw one per attempt.

## Change

- `packages/formats/src/errors.ts`: `OrkUnsupportedError.feature`; `OrkUnsupportedFeaturesError` (a subclass) carrying every problem, its message listing them with readable component paths; the message no longer cites the plan file.
- `packages/formats/src/ork.ts`: each child of a stage, body tube, nose cone, coupler or inner tube is read through `Reader.attempt`, which records an unsupported feature and continues; `readRocket` refuses the file with the whole list. Malformed input still stops at once.
- Decision D-082.

## Tests

`packages/formats/src/ork.test.ts`: canted fins and an unknown part in R1 are both reported, in file order, by one error that is also an `OrkUnsupportedError`.
