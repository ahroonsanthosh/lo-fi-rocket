# Plan 0064: Multi-stage rockets (D-091)

The owner's decision (2026-10-13, D-091): multi-stage designs fly as one body whose motors ignite in turn, and the spent stage separates and leaves the vehicle. The booster's own flight after separation stays a version-1 non-goal.

## 1. Sources and what each settles

- **Ignition.** Niskanen (2009) §4.2.6 and Table 4.2, p. 69. A motor ignites at launch, at another motor's burnout, or at another motor's ejection charge, each with a delay. The text gives the example of "the burnout or ignition charge of the first stage's motor" triggering a second stage.
- **Separation.** The thesis has no separation event. The event that triggers it, and what leaves the vehicle, follow the owner's decision and OpenRocket's file format: a stage separates at the upper stage's ignition, at its own motor's burnout or ejection charge, at launch, or never, with a delay. What OpenRocket does at separation is observed as a black box (CLAUDE.md 3), never taken from its source.
- **The rest.** Everything that is not a staging event keeps its existing sourced model: mass properties (GEO-12), aerodynamics (chapter 3), equations of motion. Each is computed for the parts still attached.

## 2. Physics (part 1)

- **The vehicle.** `FlightVehicle` gains optional `stages`:
  - the stage of each component (0 is the top stage, as in OpenRocket);
  - the motors, each with its stage and its ignition event (`launch`, or `burnout` / `ejection` of another motor, plus a delay);
  - each stage's separation event and delay;
  - the stage of each recovery device.

  Without `stages`, nothing changes: every existing result stays bit-identical (the golden tests guard it).

- **Thrust and mass.** The thrust is the sum over attached motors that have ignited and not burnt out. The mass properties combine the attached parts and every attached motor:
  - an unignited motor at its loaded mass;
  - a burning motor by its file's mass rule (MOT-3);
  - a spent motor at its burnout mass.
- **Separation, applied at once.** The stage and every stage below it leave the vehicle: their parts, motors and recovery devices. The rocket's state (position, velocity, orientation, angular velocity) carries on. The attached parts' mass properties, aerodynamic parts, reference diameter (unless the user fixed it), length and base motor are recomputed.
- **Phases and events.**
  - Ignition moves a coasting rocket back to powered flight. New events `ignition` and `separation` join the flight's event list.
  - `burnout` and `ejection-charge` occur once per motor, named.
  - The summary's burnout is the last motor's.
  - A recovery device set to the ejection charge uses the charge of its own stage's motor.
- **Listed approximations** (rule 3):
  - instantaneous separation with no impulse (minor);
  - the separated stages' own flight not simulated (minor: it does not change the upper stage's flight);
  - the interstage's aerodynamic interference not modelled (minor).
- **Tests.**
  - Hand-calculated two-stage flights in vacuum with constant-thrust motors: a closed-form, piecewise constant-acceleration solution.
  - Separation drops exactly the parts of the separated stages (mass by hand).
  - Ignition at another motor's burnout or ejection charge with a delay.
  - Single-stage results unchanged (golden).
  - Property: separating never increases the mass.

## 3. Design file and import (part 2)

Part 2 is two pull requests: 2a (the engine's further events and the design file) and 2b (the import and the OpenRocket comparison).

- **OpenRocket, measured first** (`StagingProbe`, reference/rockets/staging-probe/values.txt). Its two staged examples, and four staged rockets built by the probe from the reference motors:
  - `staged-bp`: D12-0 to C6-5 at the charge;
  - `staged-hpr`: H128W to G80T 0.5 s after burnout, separation at burnout;
  - `staged-gap-bottom`: a bottom stage with no motor;
  - `staged-gap-middle`: a middle stage with no motor.

  "Automatic" ignition is launch for the bottom stage only, and the ejection charge of the stage directly below for every other stage. With no motor there, the motor never lights; with none lit at launch, OpenRocket aborts.

- **2a, the engine.**
  - A motor may be set never to light.
  - A stage may separate at its own motor's ignition, at apogee, or when climbing or descending through an altitude above the pad: OpenRocket's nine events.
  - A motor that was due to light and did not, and a stage that was due to separate and did not, are each a warning with the reason.
  - No motor lit at launch ends the flight on the pad, said plainly (end reason `no-ignition`).
- **2a, schema version 2** (migration from 1 is the identity; D-097).
  - Parts and recovery devices may name their stage.
  - The design may list `stages` (a name each, and a separation for every stage but the top one) and `additionalMotorMounts`.
  - Each mount may have an `ignition` (OpenRocket's events, automatic when absent); a motor's stage is its mount part's.
  - The adapter resolves the ignition events to the engine's (Table 4.2) and combines every motor's mass.
  - Thrust-to-weight counts the motors lit at launch.
  - Removing a part removes any mount on it, in the app and the MCP server alike.
- **2a tests.**
  - The engine: closed-form vacuum flights for each new event (apogee, climbing and descending altitudes, own ignition plus a delay), and the warnings.
  - The file: version-1 files unchanged, round trips, and a message for each malformed staged file.
  - The adapter: the staged vehicle of a two-stage design, two motors' mass and CG by hand, thrust-to-weight, a full flight's events, the empty-middle-stage case (as OpenRocket), and a delayed launch ignition.
- **2b, import.** The `.ork` reader reads:
  - stages, with x continuing across them;
  - a motor mount per stage;
  - separation and ignition events, default and per configuration;
  - inactive stages;
  - each stage's recovery devices and stage overrides.
- **2b, reference.** The probe's staged rockets are imported and flown against OpenRocket's figures: apogee within 5 % and maximum velocity within 3 % (CLAUDE.md 7.4), and the separation and ignition times. OpenRocket's own examples are compared from the recorded values only; their files stay in OpenRocket.

## 4. App and the MCP server (part 3)

- **App.** Each part's stage is shown and editable. The motor view lists one motor mount per stage with its ignition event, and the launch view shows each stage's separation.
- **MCP server.** `add_part` takes a stage, and `set_motor` a mount per stage with its ignition. `about` explains staging.

## 5. Order

Part 1 is its own pull request, then part 2, then part 3. Until part 2 merges, multi-stage `.ork` files stay refused with their reason.
