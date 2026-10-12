# Future work after v1.0

This file lists what v1.0 does not do, in a suggested order. For each item it gives the reason, the approved or proposed source, and what it would change. Sources marked "approved" are on the CLAUDE.md section 4 list or were approved in `docs/decisions.md`; the others need the owner's approval first (CLAUDE.md rule 1).

## Accuracy: drag (the targets not met)

The held-out C_D rms is 7.1 % subsonic (target 7 %), 21.3 % transonic (target 10 %) and 16.4 % supersonic (target 8 %). See `docs/reports/held-out-validation.md`.

1. **DATCOM supersonic base pressure** (approved DATCOM, section 4.2.3.1 C, figures 4.2.3.1-50, -55 and -60). Above Mach 1.5 the base drag is Niskanen's eq. (3.94). The DATCOM charts account for the boattail and the jet-off base pressure. They are the remaining sourced method for the supersonic gap, and the RM-10 flight drag (7.6 % low) is the first check.
2. **Transonic body and fin wave drag** (approved DATCOM 4.2.3.1 B and 4.1.5.1 B). The transonic excess is largest on the sharp-finned held-out models. Each source term should be compared against the held-out breakdown before anything is changed (D-061: no tuning).
3. **The base drag of finned bodies** (D-069 conflict). The DATCOM states that fins and stings change the base pressure but gives no correction. A sourced correction, or the owner's choice of default, is needed.

## Accuracy: large angles of attack

4. **Digitise ARCAS (NASA TN D-4013) to 21°** and compare C_N(α) and CP(α) with both normal-force models. This decides the open moderate-angle question of D-070.
5. **Body-vortex interference on the fins** (approved DATCOM 4.3.1.3 Method 1, figures 4.3.1.3-7 to -15). The DATCOM says it "may become sizable" for missiles.
6. **Supersonic high-angle fin force** (approved DATCOM 4.1.3.3 C, figures 4.1.3.3-59 to -61). Above Mach 1 a flight still ends at 90°.
7. **Jorgensen's axial force** (approved DATCOM 4.2.3.2), to replace the mirrored axial-drag scaling beyond 90° (D-033).
8. **High-aspect-ratio and single-wedge fins at large angles.** DATCOM 4.1.3.4 Method 2 needs section maximum-lift data, which flat plates do not have (Hoerner's _Fluid-Dynamic Lift_ would be a new source). For single wedges no chart covers a maximum thickness at the trailing edge.

## Inputs without a source

9. **Fibreglass and carbon shear moduli** for the flutter check (D-068). They need a materials source approved by the owner.
10. **The deployment-speed warning threshold** (D-042) and the stability rules of thumb. The owner's figures are needed.

## Features (CLAUDE.md non-goals for v1 or waiting on material)

11. **Multi-stage and clustered motors.** The data model allows them (CLAUDE.md section 2); the physics and UI do not.
12. **RASAero II `.CDX1` import** (CLAUDE.md 6.7 item 3). It waits on sample files.
13. **Recorded flight data.** The comparison view exists (Phase 4). Real altimeter files from the owner's flights are needed to validate apogee against flight rather than against OpenRocket.
14. **Liquid engines.** Only imported thrust and propellant mass and CG profiles are supported (Phase 5). Combustion modelling is a non-goal.

## Housekeeping

15. **Make `main` the default branch** on GitHub. This is an owner action; the token in the automation environment is invalid.
16. **Add the papers that would close verifications formally**, none of which is blocking: Dormand and Prince (1980), Box and Muller (1958) and Barrowman's 1966 NARAM-8 report.
