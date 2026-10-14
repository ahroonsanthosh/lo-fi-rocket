# OpenRocket 24.12: differences found while validating lo-fi-rocket

Found while comparing lo-fi-rocket's simulator with OpenRocket 24.12, running OpenRocket only as a black box (its source was not read). Each item gives:

- a minimal way to reproduce it;
- what OpenRocket gives;
- what the method it documents gives: Niskanen (2009), _Development of an Open Source Model Rocket Simulation Software_, the thesis OpenRocket implements;
- why it matters.

The probes and their raw output are in `tools/openrocket-harness/src/` and `reference/rockets/`.

Status: draft, growing as the validation campaign runs (2026-10-14).

## 1. Tangent ogive nose cones have almost no pressure drag above Mach 1.3, and none rising below Mach 1

**Reproduce.** A tangent ogive nose cone (shape parameter 1.0), 150 mm long, 25 mm base radius, on a 0.5 m tube of the same radius. Read the nose cone's pressure drag coefficient in the component analysis at zero angle of attack (`NoseProbe.java`, `reference/rockets/drag-probe/values.txt` part 5).

| Mach | OpenRocket (ogive, f = 3) | Thesis (eq. 3.87, B.8) | OpenRocket (cone, f = 3) |
| ---- | ------------------------- | ---------------------- | ------------------------ |
| 0.5  | 0.0016                    | 0.0003                 | 0.0218                   |
| 0.9  | 0.0016                    | 0.0617                 | 0.0748                   |
| 1.0  | 0.0016                    | 0.1644                 | 0.1644                   |
| 1.1  | 0.0755                    | 0.2343                 | 0.2343                   |
| 1.5  | 0.0007                    | 0.1303                 | 0.1303                   |
| 2.0  | 0.0005                    | 0.1042                 | 0.1042                   |
| 3.0  | 0.0003                    | 0.0858                 | 0.0858                   |

**OpenRocket.** The value is flat at its low-speed level up to Mach 1. There is a narrow bump between Mach 1.05 and 1.2, then almost nothing above Mach 1.3. The same holds at fineness 1, 2 and 5. An ogive with shape parameter 0.5 behaves like a cone.

**Thesis.** The ogive's pressure drag is the cone's times 0.72(κ − 0.5)² + 0.82 (Appendix B, eq. B.8), which is 1.0 at κ = 1. Below Mach 1 it rises from the low-speed value by eq. (3.87).

**Why it matters.** A pointed nose has wave drag above Mach 1; near zero is not physical. The tangent ogive is the most common nose shape. A rocket flying near or above Mach 1 behind one has its drag under-predicted, and its apogee over-predicted. On a two-stage high-power example peaking at Mach 0.86, OpenRocket's nose term is 0.0024 against the thesis's 0.091, about 9 % of the total drag coefficient.

## 2. Ellipsoid, power, parabolic and Haack nose cones: no pressure drag at all below Mach 0.9

**Reproduce.** As item 1, with these shapes (`values.txt` part 5).

**OpenRocket.** It gives exactly zero up to Mach 0.9 for power 0.5, parabolic 0.75 and Haack, then a rise from Mach 0.95. The ellipsoid has a small smooth rise.

**Thesis.** Eq. (3.87) rises from the low-speed value (zero for these tangent shapes) to the Mach 1 value of Appendix B.3, Stoney's measured data. The two are close at Mach 1 and above, so this item is minor: the shape of the subsonic rise only.

## 3. The base drag never removes the thrusting motor's area

**Reproduce.** Any rocket with a motor. Its drag coefficient is the same thrusting and coasting, and the same as the static component analysis with the motor in place. The base term is 0.12 + 0.13 M² on the whole base: 0.1213 at Mach 0.1 on a rocket whose base is the reference area (`DragProbe.java`, `values.txt` parts 1 and 2; `PodProbe.java --motors`, `reference/rockets/pod-probe/motors.txt`).

**Thesis.** Page 51: the base drag is computed "subtracting the area of the thrusting motors from the base reference area".

**Why it matters.** This may be a deliberate choice: a hot plume does not fill the base like a solid surface. If so, saying so in the documentation would help other tools compare against OpenRocket. The effect is the motor's share of the base drag: 3.6 to 11 % of the drag coefficient on the reference rockets.

## 4. Pitch inertia of two pods, and of a motor cluster, leaves out their offset from the axis

**Reproduce.**

- **Two pods.** Two identical pods at 75 mm from the axis (`PodProbe.java`, `reference/rockets/pod-probe/values.txt`). The structure's Iyy and Izz are equal and do not include m r² for the pods. One of the two transverse axes should include it in full: a pod pair has different pitch and yaw inertias.
- **Cluster.** A three-motor cluster (`ClusterProbe.java`, `reference/rockets/cluster-probe/values.txt`). The motors' pitch inertia is 3 × the single motor's (5.67858e-5 kg·m² for three D12s), without their offsets. Their roll inertia does include the offsets.

**Why it matters.** The effect is small on these rockets, under 0.1 % of the pitch inertia, but it is inconsistent with the roll inertia, which includes the offsets.

## 5. Kinematic viscosity about 1.3 % above the 1976 Standard Atmosphere

**Reproduce.** `FlightConditions` defaults (293.15 K, 101325 Pa) give ν = 1.52563e-5 m²/s. Sutherland's law with the 1976 Standard Atmosphere constants (β = 1.458e-6, S = 110.4 K) gives μ = 1.8134e-5 Pa·s and ν = 1.5061e-5 m²/s at that density.

**Why it matters.** It is minor: Reynolds numbers 1.3 % low, skin friction a fraction of a per cent high.

## 6. Apogee of flown amateur rockets predicted high: missing fin and protuberance drag (for discussion)

**Reproduce.** RASAero II's 24 example designs, 21 of which record the apogee the real rocket reached (altimeter or GPS), flown in lo-fi-rocket's OpenRocket-equivalent mode (`docs/reports/rasaero-comparison.md`, D-114). That mode reproduces OpenRocket 24.12's flights within 1.2 % on our reference rockets (D-108). OpenRocket itself was not run on these designs, so the figures are an estimate of OpenRocket's.

**Result.** The predicted apogee is above the measured one on all 21 flights: +9.9 % on average below Mach 0.95 (+2.1 to +21.1 %) and +18.0 % above. RASAero II's own predictions are +0.4 % and +3.9 %.

**Why, term by term against RASAero's drag breakdown.**

- **Body friction:** agrees.
- **Base drag:** the thesis's eq. (3.94) gives about twice RASAero's and the DATCOM's (0.132 against 0.063 on a typical rocket at Mach 0.3). That hides part of what is missing below.
- **Fin friction:** it is computed at the rocket's Reynolds number (thesis eq. 3.85). The DATCOM uses each fin's own mean chord (eq. 4.1.5.1-a), which gives about 1.5 times more on a typical fin.
- **Fin-body interference drag:** none. The thesis ignores it as small (p. 41). RASAero charges about as much again as the fin friction.
- **Rail buttons:** 20 to 30 times below RASAero's for the same guide (section "Not issues" below, and D-108).

**Why it matters.** A predicted coast that is too long leads to an ejection delay that fires after the real apogee. The fin Reynolds number is a small change with a published basis. Measured rail button drag would settle the largest of the differences.

## Not issues, recorded for completeness

- **Rail buttons.** OpenRocket 24.12's drag is that of a button partly sheltered by a turbulent boundary layer; Niskanen's rail pin gives 6 to 10 times more. OpenRocket's is a newer model, not a departure from physics. lo-fi-rocket reproduces it in its comparison mode (D-108).
- **Launch lugs.** OpenRocket's drag does not depend on position and grows linearly with the lug's length. It is not Niskanen's eq. (3.95), and is lower: 0.00755 against 0.01227 on R1 at Mach 0.1. The reason is not known.
