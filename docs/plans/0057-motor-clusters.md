# Plan 0057: motor clusters (plan 0055 step 3, part 2a)

Decision D-086. Two of OpenRocket's seventeen example designs ("Clustered motors", "Airstart timing") are refused for their motor clusters, and the design model holds one motor.

## What OpenRocket does (black box, `tools/openrocket-harness/src/ClusterProbe.java`, reference/rockets/cluster-probe/values.txt)

- A clustered inner tube is n identical tubes, each holding the same motor; all ignite together.
- The layouts are fixed patterns of unit points, centred on the axis (their sum is zero), scaled by the tube's outer diameter times `<clusterscale>` and rotated by `<clusterrotation>` (degrees): "3-ring" points (±0.5, −0.2887), (0, 0.5774) give (±0.0125, −0.0072), (0, 0.0144) m for a 25 mm tube.
- Masses add: three D12s are 0.1278 kg; three tubes three times one.
- The motors' roll inertia includes each motor's offset from the axis (n (I₁ + m d²)); the pitch inertia does not, and the tubes' inertias are taken on the axis.
- A three-D12 rocket reaches 273.974 m with the reference harness settings (one D12: 85.958 m).

## Change

- `packages/physics`:
  - `MotorMass.cluster` and `MotorSource.cluster`: the offsets (y, z) of each motor's axis from the rocket axis, two or more; absent for one motor on the axis.
  - `motorMassPart`: n times the mass at the same axial CG; roll inertia n I₁ + m Σd²; pitch inertia n I₁ + m Σd²/2 (GEO-15, the parallel axis theorem of N09 §4.2.3 p. 64, the transverse term averaged over the two transverse axes as the axisymmetric model needs). This is the physically complete choice where OpenRocket leaves the pitch term out (as GEO-14 for fin tabs); the difference is listed nowhere because it is not an approximation of ours, and recorded in D-086.
  - Thrust n times one motor's, along the axis: the offsets are centred, so the thrust moments cancel. A layout whose centroid is off the axis is simulated with the thrust on the axis and listed as major (the turning moment is not simulated). A layout without three-fold or higher symmetry (rows, "double") has unequal pitch and yaw inertias; their average is used and listed as minor.
  - Base drag: the area of all n thrusting motors is removed (N09 p. 51, "the thrusting motors"; DRAG-11).
- `packages/formats`:
  - Design `MotorMount.cluster` (validated: two or more finite offsets), passed to the motor mass, the vehicle, the thrust-to-weight (n times the thrust) and the fit check (per tube, unchanged).
  - `.ork`: the cluster layouts table (from the probe), the n tubes placed on the axis (their contents read once per tube), listed as minor (their offsets from the axis are not in their inertias, as OpenRocket), and the mount's motor clustered.
- `packages/app`: the motor shown as "3 × Estes D12" where the design names it.

## Tests

- Physics: GEO-15 by hand for three D12s in the probe's "3-ring" (mass 0.1278 kg, roll inertia 3.58266e-5 kg·m² as OpenRocket, pitch inertia 5.67858e-5 + 1.33125e-5 kg·m²); a design without a cluster bit-identical to before; thrust, mass and base area n times; the approximations for an off-centre and a row layout.
- Formats: the probe's files import with OpenRocket's offsets, launch mass and CG (0.396983731 kg, 0.514652679 m) and apogee within 5 % of 273.974 m; "Clustered motors" imports; the design validates and survives a save and load; bad cluster entries are refused on load.
