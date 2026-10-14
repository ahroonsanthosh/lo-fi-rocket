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

- **Schema version 2** (migration from 1 is the identity). A component may name its stage. The design may list `stages`, each with a name and a separation event and delay, and `motorMounts` with an ignition event each. A version-1 file is a one-stage design.
- **Import.** The `.ork` reader reads stages, their separation events and the motor mounts' ignition events (default and per configuration). OpenRocket's "automatic" ignition is observed with a probe: the bottom stage at launch, upper stages at the ejection charge below.
- **Reference.** OpenRocket's "Two stage high power rocket" and "Three stage low power rocket" are measured as a black box (a new probe) and compared: apogee, maximum velocity and separation time, against CLAUDE.md 7.4's tolerances.

## 4. App and the MCP server (part 3)

- **App.** Each part's stage is shown and editable. The motor view lists one motor mount per stage with its ignition event, and the launch view shows each stage's separation.
- **MCP server.** `add_part` takes a stage, and `set_motor` a mount per stage with its ignition. `about` explains staging.

## 5. Order

Part 1 is its own pull request, then part 2, then part 3. Until part 2 merges, multi-stage `.ork` files stay refused with their reason.
