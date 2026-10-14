# Plan 0078: the review lane's open findings, first group

## 1. Why

The owner asked for the other sessions' inputs to be integrated. The UI (#77) and 3D (#79) pull requests are merged. Of the review lane's 36 open issues, 4 were already fixed on main and closed with the evidence (#12, #25, #33, #34), and #79 fixed #29 and most of #61. This plan takes the open findings that are high in severity and small to fix.

## 2. The fixes

- **#8 (critical): ThrustCurve.org search found nothing.**
  - The cause: the search sent `hasDataFiles: true`. The API documentation lists that criterion (`reference/docs/thrustcurve-api/swagger.json`, SearchRequest: "only motors with data files"), but the live service answered it with 0 matches on its own (the issue, 2026-10-12).
  - The fix: `searchMotorsWithData` in the formats package sends the other criteria only. It keeps the results whose own `dataFiles` count is above 0, and counts the rest.
  - Both the app and the MCP server use it. The app says how many motors were left out, and why. It asks to narrow the search when more matched than were read.
  - This is correct however the service treats the criterion. It could not be checked live today: ThrustCurve.org answered 503 "Application Error".
- **#10 (major): changing the motor reset the ejection delay to the first listed (0 s for the C6).** `chooseDelay` (app, `motors/delay.ts`):
  - It keeps the delay when the new motor is sold with it.
  - Otherwise it takes the nearest. On a tie it takes the longer one: just before apogee the rocket is slowed by gravity and drag together, so it is faster at a given time before apogee than after it.
  - With no previous delay, it takes the shortest delay above 0 s.
  - Every change is said under the delay field, and so is a plugged motor or a file with no delays (the remaining part of #35).
- **#14 (major): the relative tolerance read 0.** A field's value is shown to 6 significant digits when the fixed decimals would move it by more than 1 % (1e-8 shows "1e-8"). The 1 % bound leaves every value that already showed within 1 % as it was.
- **#39 (major): deleting a stored design did not ask, and the list did not update.** The row now asks ("Delete “Keep me”? This cannot be undone.", Delete for good / Keep). The list is drawn again at once: the two calls to `setListOpen` were batched into nothing.

## 3. Tests

- `chooseDelay`: the review's own steps (D12 at 5 s to the F39T gives 6 s; then the C6 gives 7 s), the tie, the first selection, 0 s, plugged, and no delays.
- The motor page, end to end: those steps, with the notes, and choosing a delay clears the note.
- Search:
  - No `hasDataFiles` is sent.
  - A motor without a data file is counted and not offered (formats, app and MCP).
  - A search with no criterion is refused before a request is made.
- `QuantityField`: 1e-8, 0.0012345 and 0 are shown as they are; 0.0748 still shows 0.075.
- The designs list: Delete asks, Keep keeps, and Delete for good removes the design from storage and from the list.

## 4. Not in this plan

The other open findings, one pull request each, in order of severity:

- #11's remaining parts (parts that do not follow their tube);
- #15 and #16 (stale figures and cross-field errors);
- #18 (undo);
- #36's pre-flight length check;
- #40's duplicated rail-angle warning;
- the minor ones.
