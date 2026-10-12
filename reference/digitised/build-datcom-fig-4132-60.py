#!/usr/bin/env python3
"""Build datcom-figure-4-1-3-2-60.json: USAF DATCOM (1978) figure 4.1.3.2-60 "Supersonic wing lift-curve-slope
correction factor for sonic-leading-edge region" (scan p. 560 = page 66 of
reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf, rendered at 300 dpi). Ordinate
C_N_alpha / (C_N_alpha)_theory; abscissa beta/tan(Lambda_LE) (left, 0 to 1) and tan(Lambda_LE)/beta (right, 1 to 0),
folded into z = beta/tan(Lambda_LE) (z <= 1) or 2 - tan(Lambda_LE)/beta (z > 1) as for figure 4.1.3.2-56. Left-half
curves are labelled Delta y_perp = 0.41, 0.82, 1.24, 2.12, 3.18, 6.95, 16.1 and right-half curves
delta_perp = 4, 8, 12, 20, 30, 50, 70 deg; the chart states Delta y_perp = 5.85 tan(delta_perp) (wedge leading edge),
and the two label sets meet the centre line at the same seven points, so each curve is stored once under its
delta_perp. Step 2 of section 4.1.3.2 C (scan p. 520): multiply the figure 4.1.3.2-56 value by this factor "for wings
approaching the sonic-leading-edge condition".

Calibration (gridlines of the render): left half z = (x - 515.5)/711, right half z = 2 - (1934.5 - x)/708,
value = 0.5 + (1587 - y)/1412. Pass 2 is the ordered dark-run extraction at columns offset from the gridlines; a
column holding k curve crossings below 1.0 is assigned to the last k curves on the left half (large Delta y reach
1.0 first) and, on the right half, to the curves still below 1.0 there (small delta reach 1.0 first; the 70 deg
curve stops at tan(Lambda_LE)/beta = 0.31). Text of the chart (labels, "Delta y = 5.85 tan delta", "for wedge
leading edge only") was removed by hand. Each curve gets an end point at 1.0 extrapolated linearly from its last two
readings; outside its end the factor is 1 (the curves end on the 1.0 line), except the 70 deg curve, which the model
does not extend. Pass 1 is the by-eye reading at the centre line, where the labels sit. Run with python3 -I."""
import json
import math
from pathlib import Path

DELTAS = [4, 8, 12, 20, 30, 50, 70]
LEFT = {  # u: values for the last k curves
    0.38: [0.995], 0.42: [0.949], 0.45: [0.967, 0.911], 0.47: [0.989, 0.943, 0.887],
    0.52: [0.995, 0.975, 0.935, 0.885, 0.834], 0.55: [0.995, 0.975, 0.946, 0.904, 0.855, 0.808],
    0.57: [0.996, 0.983, 0.959, 0.927, 0.886, 0.835, 0.793], 0.62: [0.977, 0.953, 0.928, 0.89, 0.849, 0.801, 0.761],
    0.65: [0.964, 0.936, 0.91, 0.87, 0.829, 0.781, 0.742], 0.68: [0.952, 0.92, 0.892, 0.851, 0.811, 0.762, 0.726],
    0.72: [0.938, 0.9, 0.871, 0.83, 0.788, 0.74, 0.706], 0.75: [0.929, 0.888, 0.857, 0.815, 0.773, 0.725, 0.695],
    0.78: [0.921, 0.877, 0.846, 0.802, 0.76, 0.713, 0.682], 0.82: [0.912, 0.865, 0.83, 0.788, 0.745, 0.699, 0.669],
    0.98: [0.899, 0.839, 0.797, 0.75, 0.702, 0.662, 0.634],
}
RIGHT = {  # w = tan(Lambda_LE)/beta: {delta: value}
    0.98: [0.902, 0.843, 0.8, 0.752, 0.707, 0.665, 0.637], 0.85: [0.926, 0.868, 0.83, 0.783, 0.741, 0.698, 0.665],
    0.75: [0.949, 0.892, 0.856, 0.809, 0.768, 0.722, 0.689], 0.65: [0.974, 0.921, 0.886, 0.838, 0.797, 0.749, 0.714],
    0.62: [0.984, 0.932, 0.896, 0.848, 0.803, 0.756, 0.722], 0.58: [0.996, 0.948, 0.913, 0.86, 0.818, 0.768, 0.734],
    0.55: [None, 0.96, 0.924, 0.87, 0.826, 0.776, 0.742], 0.52: [None, 0.975, 0.938, 0.881, 0.837, 0.785, 0.751],
    0.48: [None, 0.994, 0.956, 0.896, 0.85, 0.797, 0.762], 0.45: [None, None, 0.974, 0.905, 0.861, 0.804, 0.773],
    0.42: [None, None, 0.993, 0.919, 0.873, 0.814, 0.783], 0.38: [None, None, None, 0.937, 0.889, 0.827, 0.797],
    0.35: [None, None, None, 0.953, 0.902, 0.837, 0.806], 0.32: [None, None, None, 0.969, 0.915, 0.847, 0.817],
    0.28: [None, None, None, 0.994, 0.934, 0.861, None], 0.25: [None, None, None, None, 0.951, 0.873, None],
    0.22: [None, None, None, None, 0.968, 0.885, None], 0.18: [None, None, None, None, 0.994, 0.901, None],
    0.15: [None, None, None, None, None, 0.916, None], 0.12: [None, None, None, None, None, 0.933, None],
    0.08: [None, None, None, None, None, 0.954, None], 0.05: [None, None, None, None, None, 0.975, None],
    0.02: [None, None, None, None, None, 0.995, None],
}
# Pass 1, by eye at the centre line (z = 1), where each curve's label sits.
PASS1_CENTRE = [0.90, 0.84, 0.80, 0.75, 0.70, 0.66, 0.63]

curves = {d: [] for d in DELTAS}
for u, vals in LEFT.items():
    for d, v in zip(DELTAS[len(DELTAS) - len(vals):], vals):
        curves[d].append([u, v])
for w, vals in RIGHT.items():
    for d, v in zip(DELTAS, vals):
        if v is not None:
            curves[d].append([round(2 - w, 4), v])
out = {}
for i, d in enumerate(DELTAS):
    pts = sorted(curves[d])
    # Centre line: mean of the two readings 0.02 either side.
    left = [p for p in pts if p[0] == 0.98][0][1]
    right = [p for p in pts if p[0] == 1.02][0][1]
    centre = round((left + right) / 2, 4)
    pts = [p for p in pts if p[0] not in (0.98, 1.02)] + [[1.0, centre]]
    pts.sort()
    (a0, f0), (a1, f1) = pts[0], pts[1]
    start = round(a0 + (1 - f0) * (a1 - a0) / (f1 - f0), 4) if f1 != f0 else a0
    pts = [[start, 1.0]] + pts
    if d != 70:
        (b0, g0), (b1, g1) = pts[-2], pts[-1]
        end = round(b1 + (1 - g1) * (b1 - b0) / (g1 - g0), 4) if g1 != g0 else b1
        pts = pts + [[min(end, 2.0), 1.0]]
    out[str(d)] = {"delta_perp_deg": d, "delta_y_perp": round(5.85 * math.tan(math.radians(d)), 2),
                   "centre_pass1": PASS1_CENTRE[i], "centre_pass2": centre,
                   "centre_disagreement": round(abs(PASS1_CENTRE[i] - centre), 4), "points": pts}
doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.1.3.2-56 step 2 correction, figure 4.1.3.2-60; scan p. 560 = page 66 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf; method text section 4.1.3.2 C, scan pp. 519 to 520 (pages 4.1.3.2-19, -20).",
    "quantity": "C_N_alpha / (C_N_alpha)_theory against z = beta/tan(Lambda_LE) (z <= 1) or 2 - tan(Lambda_LE)/beta (z > 1), curves of delta_perp (leading-edge semiwedge angle normal to the leading edge, deg); Delta y_perp = 5.85 tan(delta_perp)",
    "curves": out,
}
Path(__file__).with_name("datcom-figure-4-1-3-2-60.json").write_text(json.dumps(doc, indent=2) + "\n")
for d, c in out.items():
    print(d, c["delta_y_perp"], c["centre_disagreement"], c["points"][0], c["points"][-1], len(c["points"]))
