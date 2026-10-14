# Plan 0070: Pod sets and booster sets (task 4 of plan 0055, import part 2)

A pod set in OpenRocket is a group of parts repeated n times around the body at a radial offset: nacelles, strap-on tubes. A booster set (parallel stage) is the same, with motors, and it separates. The `.ork` reader refuses a pod set outside the body, or stands it in as a mass, listed as major, when it sits inside a body tube; a pod with a motor is always refused. CLAUDE.md section 2 asks that podded designs be simulated with their approximations listed (D-083). The aim here is to model them, not stand them in.

## 1. What OpenRocket does (black-box probe)

`tools/openrocket-harness/src/PodProbe.java` takes R1's airframe (conical nose, 0.5 m tube, three fins, D12-5 in its motor tube, 0.3 m parachute) and builds four versions. Each pod is a conical balsa nose 50 mm × 12.5 mm and a 150 mm paper tube of radius 12.5 mm, set beside the main tube's aft end:

- `pods0`: no pods;
- `pods1`: two plain pods;
- `pods2`: two pods with three fins each;
- `pods3`: three plain pods.

Each is saved, reloaded and measured. The results are in `reference/rockets/pod-probe/values.txt`:

- **Position.** `<radiusoffset method="relative">` is the gap between the two tubes. The pod axis is at body radius + offset + pod radius (75 mm for a 37.5 mm offset).
- **Barrowman.** Each pod part contributes its own C_Nα, scaled by the count, at its own CP. The pod nose is 2 (A_pod/A_ref) = 0.5 per pod, so 1.0 for two pods and 1.5 for three. Pod fins use the pod tube as their body. Two pods' fins give 4.9639.
- **Mass.** Each part's mass is multiplied by the count, at its own CG along the rocket. The roll inertia gains n(I_own + m r²): for two pods 6.0186e-5 + 1.336e-6 = 6.152e-5 kg·m², and OpenRocket gives 6.1522e-5.
- **Drag at Mach 0.3.** Each pod adds its own skin friction, nose pressure drag and base drag. The base drag goes from 0.1317 to 0.1317 × (1 + 2 × 0.25) = 0.19755 for two pods and 0.230475 for three: each pod's base counts at its own area.
- **Flight.** The apogee goes from 189.7 m with no pods to 167.8, 150.7 and 158.9 m for `pods1` to `pods3`.

## 2. The model: parts repeated around the axis

A placed part may carry `instances: { count, radialOffset }`: n copies equally spaced around the axis at that distance. Such parts are outside the main body:

- they are not part of its stacking, continuity or base;
- each contributes its own terms, multiplied by n.

Barrowman's normal force does not depend on a part's distance from the axis, so the static stability is exact in the Barrowman sense, as OpenRocket's is. What the axisymmetric model cannot represent is listed:

- a single pod (n = 1), whose CG is off the axis;
- the different pitch and yaw inertias of n = 2;
- the pods' interference with the body and with each other, which neither model has.

## 3. Steps, one pull request each

Steps 1 and 2 went into one pull request: the drag and the flight needed the same pod bodies, and a pod with mass but no drag would not have been a sensible state to merge.

1. **Physics, mass and static stability.**
   - The `instances` field.
   - Mass and CG: m × n at the part's CG.
   - Inertias: roll n(I_rot + m r²), pitch n(I_long + m r²/2). The pitch term is the mean of the pitch and yaw inertias, exact for n ≥ 3.
   - Barrowman terms × n, with pod fins on their pod tube's radius.
   - The body checks skip pod parts.
   - Tests: by hand, and against `pods0` to `pods3` for the CG, CP, C_Nα and inertias.
2. **Physics, drag and flight.**
   - Pod skin friction, pressure drag and base drag × n, on the pods' own geometry (Niskanen's methods, as OpenRocket does).
   - The large-angle body terms, pitch damping and roll damping for pods.
   - Tests against the probe's drag breakdown and apogees (CLAUDE.md 7.4: apogee within 5 %, maximum velocity within 3 %).
3. **Design model and reader.**
   - A design part's `pod` group (count, radial offset), a design schema version with a migration.
   - The reader's `<podset>` read wherever OpenRocket allows one: on a body tube, the only part that accepts it (section 4).
   - The app lists pod parts. Drawing them in the side view is the UI lane's, through an issue.
4. **Motors in pods.** A pod's motor tube carries its motor as a cluster at the pod's offsets (D-086 already models motor clusters off the axis).
5. **Booster sets.** A `<parallelstage>` is a pod set that separates. It becomes a stage of its own with its separation event (D-097), igniting with the core, its parts dropped at separation.

Each step lists what it does not model, as rule 3 requires.

## 4. Step 3: where OpenRocket places a pod set (second probe)

`PodProbe --positions`, `PodProbe --chute` and `PodLoad` (`reference/rockets/pod-probe/positions.txt`) save, reload and place pod sets read from files:

- **Which parts hold one.** Only a body tube accepts a pod set; a stage, a nose cone, a transition and a pod set do not. A pod's own tube can hold one (pods inside a pod), which the reader leaves out and lists.
- **Front.** By the axial method, as for any child of the tube, with the pod's length the sum of its stacked parts' lengths (0.2 m: absolute, top, middle and bottom with 0.02 m give 0.02, 0.12, 0.27 and 0.42 m).
- **Distance from the axis**, R the tube's radius, r_pod the pod's largest body radius:
  - "coaxial" 0 and "surface" R + r_pod, whatever value is written;
  - "free" the value;
  - "relative" R + value + r_pod. With mixed radii (15 mm and 10 mm, in either order) r_pod is the largest. A negative result is the same ring turned half a turn: −62.5 mm places the pods at 62.5 mm.
- **Recovery.** With pods1's parachute moved into the pods, the mass gains one parachute and the descent is 4.623 m/s, which is two parachutes' (one would give 6.538). So a recovery device in a pod is one per pod.

Tests (`packages/formats/src/ork.pods.test.ts`): every probe file's front and distance to 1e-12; pods1 to pods3 from their files against OpenRocket's mass, CG, C_Nα and CP; the parachute file; a nested pod set listed; a motor in a pod refused.
