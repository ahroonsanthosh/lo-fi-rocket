# Plan 0069: The boat-tail drag combination, checked (the D-104 open item)

## 1. The question

In the displayed mode the body base drag is the DATCOM's (DRAG-21, DRAG-22, D-069). A boat tail's pressure drag is still Niskanen's eq. (3.88) (DRAG-9): a fraction 1, (3 − γ)/2 or 0 of his base drag coefficient, eq. (3.94). Eq. (3.94) is the higher of the two at subsonic speed, so a short tail cone can be charged more than the blunt base it replaces. Plan 0068 found this on R1 with an 80 mm ogive tail at Mach 0.3: +0.092 for the boat tail against −0.060 for the base.

The OpenRocket-equivalent mode is consistent, with eq. (3.94) throughout.

## 2. The alternative tried

Option (b) takes eq. (3.88)'s fraction of the base drag method in use. In the displayed mode that is the DATCOM's coefficient for a blunt base of the boat tail's fore radius. It was prototyped, run on the reference rockets and the wind-tunnel validation, and not committed.

## 3. Results

| Case                                                                          | Current            | Option (b)         |
| ----------------------------------------------------------------------------- | ------------------ | ------------------ |
| R2, displayed mode apogee (OpenRocket 820.806 m)                              | 814.42 m (−0.78 %) | 819.77 m (−0.13 %) |
| R1, R3, R4, R5 (no boat tail)                                                 | unchanged          | unchanged          |
| ARCAS forebody drag (TN D-4013, sting mounted, boat tail γ = 1.867), subsonic | −8 % rms           | −20 % rms          |
| ARCAS forebody drag, transonic (Mach 0.8 to 1.2)                              | 29 % rms           | 37 % rms           |
| ARCAS boat tail term at Mach 0.6 / 0.9                                        | 0.055 / 0.074      | 0.022 / 0.026      |

- **The reference rockets.** Option (b) moves R2 by 0.66 %, inside the 5 % tolerance of CLAUDE.md 7.4, so this is not a stop-and-ask item (section 11 (a)).
- **The measured data.** ARCAS is the only measured case in `reference/` whose boat tail is short enough (γ < 3) for eq. (3.88) to charge it. RM-10 (γ ≈ 11.9) and L8A05 (γ ≈ 8.7) have long boat tails that both options leave at 0, and their results did not change. ARCAS's forebody drag is already under-predicted with the present term. Option (b) roughly doubles that error subsonically.
- **What supports each piece.** The DATCOM base drag is supported by measurement for cylindrical bases (D-069). The larger boat-tail term is supported by ARCAS.

## 4. Decision

Keep the present combination (D-105). Measured data outrank the internal consistency of the construction and the closer agreement with OpenRocket, which is a model, not a measurement. Record the side effect in `docs/known-limitations.md`: in the displayed mode a short boat tail or tail cone can be charged more pressure drag than the base drag it removes.

## 5. Also corrected here

Two lines of `docs/known-limitations.md` named the wrong side as safe for altitude limits:

- An under-predicted apogee means the rocket may fly higher than shown. That is the unsafe side for an altitude limit.
- An over-predicted apogee means it may fly lower. That is the safe side for an altitude limit, but an ejection delay chosen from the predicted coast may then fire after apogee.

No code changes; no test changes.
