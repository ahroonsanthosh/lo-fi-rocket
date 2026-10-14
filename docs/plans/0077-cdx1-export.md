# Plan 0077: writing designs as RASAero II files, and R1 to R5 in three simulators

## 1. Why

Plan 0075 left two of its comparison sets undone. Set 2 is the reference rockets R1 to R5 run in RASAero II as well as in OpenRocket and ours. Set 3 is ARCAS. The owner asked for "extensive and exhaustive testing against our source, rasaero and openrocket".

Putting our designs into RASAero needs a `.CDX1` writer. The same writer lets a user take a design to RASAero II.

## 2. The writer (`packages/formats/src/cdx1-export.ts`)

The inverse of the importer, with the same units and meanings:

- **Outline.** A nose cone, one body tube (contiguous tubes of the nose's diameter, merged) and an optional boat tail.
- **Fins and guides.**
  - One trapezoidal fin set, placed by its distance from the tube's aft end.
  - The first rail button set, as RASAero's two rail guides.
  - A launch lug.
- **Finish.** The nearest of RASAero's eight sand-roughness classes, on a log scale. Zero roughness is its smooth class.
- **Site and recovery.** The launch site and rail, with the wind as its head or tail component. Up to two parachutes, at apogee or at an altitude.
- **Motor and mass.** The motor's name as RASAero's list writes it ("D12 (Estes)", or a given name). The lift-off weight and CG with the motor, from our mass model.
- **Fin sections.** As RASAero's own names: Square, Rounded, Biconvex for our airfoil (D-062), Single Wedge and Double Wedge. The double wedge's leading-edge diamond length is half the chord at mid-span. The names were confirmed from RASAero's files and its program's string table.
- **Refused, with what to change:**
  - a design of two or more stages, or with pods;
  - a step in the body diameter, or a part after the boat tail;
  - fins that are not trapezoidal, or not one set;
  - a nose shape RASAero does not have;
  - no motor.
- **Listed, not refused:** the finish class, a rail button count other than two, a recessed motor, streamers, a deployment event RASAero does not have, a crosswind.

The app's File menu gets "Export RASAero"; the MCP's `export_design` takes `format: "cdx1"`.

## 3. The three-way comparison (`rasaero-reference.test.ts`, opt-in)

1. **Export.** R1 to R5 are written as `.CDX1` files. Our motor files go into RASAero's motor list under names of their own ("LF-D12", maker "LoFi"), as its manual allows (p. 93), so that both programs fly the same thrust curves.
2. **Run.** RASAero II runs each file under Wine (`reference/rasaero/run-rasaero.sh`).
3. **Read back.** The exported file is read by our importer and flown, so our simulator flies exactly RASAero's inputs: its finish class, the lift-off weight and CG, the motor. OpenRocket's figures are its own runs of the original files (60 µm finish).
4. **Report.** `docs/reports/rasaero-reference-rockets.md` lists apogee, maximum velocity, C_D and CP for each rocket.

## 4. ARCAS (set 3): not done

RASAero's authors published their own ARCAS comparison. Its model carries their modelling choices: fin anchors entered as rail guides, and the fin root over the boat tail replaced by a cylinder of equal volume. Our ARCAS model's nose is a secant ogive, which RASAero's shapes do not include. A three-way on ARCAS would compare these modelling choices more than the methods, so it is left out. Our own ARCAS comparison with the wind tunnel data stands (`docs/reports/wind-tunnel-validation.md`).

## 5. Tests

- **Round trip.** Each of R1 to R5 is written and read back: the outline, fins, guides and motor are the same to 10 digits, and so are the lift-off weight and CG. The finish becomes RASAero's nearest class.
- **Refusals.** Each kind of design RASAero cannot hold is refused with its message.
- **App and MCP.** The menu entry saves a `.CDX1` and lists what was mapped. The MCP tool writes the text, which reads back.
