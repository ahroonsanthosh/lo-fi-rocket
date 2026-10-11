# Reference rockets

Five rockets built in OpenRocket 24.12 by the headless harness in `tools/openrocket-harness/` and saved here as `.ork` files. Every dimension below is the number given to OpenRocket, in SI, so the designs can be checked by hand without OpenRocket. `values.csv` holds OpenRocket's results, `settings.md` every setting that affects them, `components/<rocket>.csv` OpenRocket's per-component mass and CG, `timeseries/<rocket>-wind<N>.csv` the flight time series, and `hand-checks.md` the independent check of R1.

## Conventions used in every rocket

- Coordinates: x from the nose tip, positive aft (the same convention as `docs/conventions.md`). "Position" is the forward end of the component.
- Materials (bulk density, kg/m³): paper 700, balsa 160, plywood 600, plastic 1050, fiberglass 1850, nylon 1150. These are round reference values, not measured properties.
- Surface finish: OpenRocket "regular paint" (60 µm roughness) on every external component. Fin cross-section: square (OpenRocket default).
- Fins: trapezoidal, trailing edge of the root flush with the aft end of the body tube. Sweep is the leading-edge sweep length (root leading edge to tip leading edge, measured along the axis). Height is the span of one fin from root to tip.
- Parachutes: mass overridden to the stated value, drag coefficient 0.8 set manually, deployment at apogee with no delay. The motor's ejection charge still fires at the stated delay but does not deploy anything.
- Motors: from `reference/motors/`, aft end flush with the aft end of the mount (zero overhang). OpenRocket's RASP loader places the motor CG at the motor's mid-length.
- Rail buttons: two per rocket, nylon, "outer diameter" is the flange diameter, "inner diameter" the shaft diameter; heights as given; screw height 0.
- Reference length for stability: maximum body diameter (OpenRocket default).

## R1 `r1-three-fin-conical` (Estes D12, ejection delay 5 s)

The hand-check rocket: every shape has a closed-form volume and centroid.

| Component | Specification |
| --- | --- |
| Nose cone | Conical, length 0.100, base radius 0.025, solid (filled), balsa |
| Body tube | Length 0.500, outer radius 0.025, wall 0.001, paper; position 0.100 |
| Fins | 3, root chord 0.100, tip chord 0.050, sweep 0.050, height 0.080, thickness 0.003, plywood; root leading edge at 0.500 |
| Nose weight | Mass component 0.030 kg, length 0.020, radius 0.020; position 0.100 (top of the body tube) |
| Launch lug | Length 0.050, outer radius 0.003, wall 0.0005 (inner radius 0.0025), paper; position 0.350 |
| Motor mount | Inner tube, length 0.075, outer radius 0.0125, wall 0.0005, paper; position 0.525 (aft end at 0.600) |
| Centering rings | 2, length 0.005, outer radius 0.024, inner radius 0.0125, paper; positions 0.530 and 0.590 |
| Parachute | Diameter 0.300, CD 0.8, mass 0.010 kg, packed length 0.050, radius 0.020; position 0.200 |
| Overall | Length 0.600, maximum diameter 0.050 |

## R2 `r2-ogive-boattail` (AeroTech G80T, file designation G80NBT, ejection delay 7 s)

| Component | Specification |
| --- | --- |
| Nose cone | Tangent ogive (shape parameter 1.0), length 0.150, base radius 0.027, wall 0.002, plastic; aft shoulder length 0.040, radius 0.0255, wall 0.002 |
| Body tube | Length 0.600, outer radius 0.027, wall 0.0015, paper; position 0.150 |
| Boat tail | Conical transition, fore radius 0.027, aft radius 0.018, length 0.050, wall 0.0015, plastic; position 0.750 |
| Fins | 3, root 0.120, tip 0.040, sweep 0.080, height 0.070, thickness 0.003, plywood; root leading edge at 0.630 (flush with the body tube's aft end at 0.750) |
| Rail buttons | 2, outer diameter 0.010, inner diameter 0.006, total height 0.010, base height 0.002, flange height 0.002; positions 0.450 and 0.700 |
| Motor mount | Inner tube, length 0.130, outer radius 0.0155, wall 0.0005, paper; position 0.620 (aft end at 0.750) |
| Centering rings | 2, length 0.005, outer radius 0.0255, inner radius 0.0155, plywood; positions 0.625 and 0.740 |
| Parachute | Diameter 0.450, CD 0.8, mass 0.030 kg, packed length 0.060, radius 0.022; position 0.300 |
| Payload mass | Mass component 0.050 kg, length 0.050, radius 0.020; position 0.200 |
| Overall | Length 0.800, maximum diameter 0.054 |

## R3 `r3-minimum-diameter-24` (AeroTech F39T, ejection delay 6 s)

| Component | Specification |
| --- | --- |
| Nose cone | Von Kármán (LD-Haack, shape parameter 0), length 0.100, base radius 0.0127, wall 0.002, fiberglass; aft shoulder length 0.030, radius 0.0117, wall 0.0015 |
| Body tube | Length 0.450, outer radius 0.0127, wall 0.0007 (inner diameter 0.024 = motor diameter), fiberglass; position 0.100; is the motor mount |
| Fins | 3, root 0.070, tip 0.030, sweep 0.045, height 0.035, thickness 0.002, fiberglass; root leading edge at 0.480 |
| Rail buttons | 2, outer diameter 0.008, inner diameter 0.004, total height 0.008, base height 0.0015, flange height 0.0015; positions 0.300 and 0.500 |
| Nose weight | Mass component 0.010 kg, length 0.030, radius 0.010; position 0.100 |
| Parachute | Diameter 0.300, CD 0.8, mass 0.015 kg, packed length 0.080, radius 0.011; position 0.150 |
| Overall | Length 0.550, maximum diameter 0.0254 |

## R4 `r4-scratch-38mm` (AeroTech H123W, ejection delay 10 s)

A scratch build on a 38 mm mount with an internal layout: electronics mass, bulkhead, main parachute, mount with centering rings.

| Component | Specification |
| --- | --- |
| Nose cone | Tangent ogive (1.0), length 0.200, base radius 0.033, wall 0.003, plastic; aft shoulder length 0.050, radius 0.031, wall 0.003 |
| Body tube | Length 0.800, outer radius 0.033, wall 0.002, fiberglass; position 0.200 |
| Electronics bay mass | Mass component 0.150 kg, length 0.100, radius 0.025; position 0.300 |
| Bulkhead | Length 0.006, outer radius 0.031, plywood; position 0.450 |
| Main parachute | Diameter 0.900, CD 0.8, mass 0.100 kg, packed length 0.120, radius 0.030; position 0.480 |
| Motor mount | Inner tube, length 0.200, outer radius 0.0195, wall 0.0015, paper; position 0.800 (aft end at 1.000) |
| Centering rings | 2, length 0.006, outer radius 0.031, inner radius 0.0195, plywood; positions 0.810 and 0.984 |
| Fins | 4, root 0.150, tip 0.060, sweep 0.090, height 0.080, thickness 0.004, plywood; root leading edge at 0.850 |
| Rail buttons | 2, outer diameter 0.010, inner diameter 0.006, total height 0.010, base height 0.002, flange height 0.002; positions 0.600 and 0.950 |
| Overall | Length 1.000, maximum diameter 0.066 |

## R5 `r5-transonic-min-dia-29` (AeroTech H238T, ejection delay 6 s)

Reaches Mach 1.09 in OpenRocket.

| Component | Specification |
| --- | --- |
| Nose cone | Von Kármán (0), length 0.130, base radius 0.016, wall 0.002, fiberglass; aft shoulder length 0.030, radius 0.0145, wall 0.0015 |
| Body tube | Length 0.550, outer radius 0.016, wall 0.0015 (inner diameter 0.029), fiberglass; position 0.130; is the motor mount |
| Fins | 3, root 0.075, tip 0.025, sweep 0.050, height 0.035, thickness 0.002, fiberglass; root leading edge at 0.605 |
| Rail buttons | 2, outer diameter 0.008, inner diameter 0.004, total height 0.008, base height 0.0015, flange height 0.0015; positions 0.380 and 0.630 |
| Nose weight | Mass component 0.040 kg, length 0.040, radius 0.012; position 0.130 |
| Parachute | Diameter 0.350, CD 0.8, mass 0.020 kg, packed length 0.100, radius 0.014; position 0.190 |
| Overall | Length 0.680, maximum diameter 0.032 |

## Results summary (zero wind, 0.001 s time step; see `values.csv` for both wind rows and more columns)

| Rocket | Motor | Liftoff mass kg | CG m | CP m | Stability cal | Apogee m | Max velocity m/s | Max Mach | Rail exit m/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | D12 | 0.190904 | 0.387022 | 0.487149 | 2.0025 | 167.045 | 61.972 | 0.1822 | 18.456 |
| R2 | G80T | 0.414484 | 0.484548 | 0.571037 | 1.6016 | 820.806 | 245.821 | 0.7237 | 26.611 |
| R3 | F39T | 0.171873 | 0.356248 | 0.449111 | 3.6560 | 832.929 | 233.975 | 0.6887 | 31.639 |
| R4 | H123W | 1.365936 | 0.625038 | 0.807795 | 2.7690 | 692.685 | 136.122 | 0.4007 | 16.825 |
| R5 | H238T | 0.450135 | 0.435530 | 0.526894 | 2.8551 | 1560.531 | 369.487 | 1.0877 | 36.684 |

## Regenerating

```
cd tools/openrocket-harness && ./build.sh
```

The harness is deterministic: it runs every simulation twice and refuses to write results if the two runs differ.
