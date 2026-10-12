#!/usr/bin/env python3
"""Build datcom-figure-4-1-5-1-29.json: two digitising passes of USAF DATCOM (1978) figure 4.1.5.1-29,
"Transonic zero-lift wing wave drag for unswept wings and round-nose airfoils" (full-scan page 750, page 256 of
reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf). Ordinate C_Dw/(t/c)^(5/3), abscissa
xi = sqrt|M^2 - 1|/(t/c)^(1/3) (negative = subsonic), one curve per A (t/c)^(1/3). Run with python3 -I from the
repository root; the output is committed next to it and the TypeScript table in
packages/physics/src/drag/datcom-fin-wave-drag.ts is checked against it by a formats test."""
import json
from pathlib import Path

# Pass 1: read by eye against the grid from the 300 dpi render, before the pixel pass.
PASS1 = {
    "4.0": [[-1.2, 0.05], [-1.1, 0.2], [-1.0, 0.5], [-0.95, 0.9], [-0.9, 1.5], [-0.85, 2.2], [-0.8, 2.8], [-0.75, 3.2], [-0.7, 3.4], [-0.6, 3.5], [-0.4, 3.55], [0, 3.6], [0.4, 3.6], [0.8, 3.55], [1.2, 3.45], [1.4, 3.4]],
    "3.0": [[-1.2, 0.05], [-1.1, 0.15], [-1.0, 0.4], [-0.9, 1.1], [-0.85, 1.7], [-0.8, 2.3], [-0.75, 2.8], [-0.7, 3.1], [-0.6, 3.35], [-0.4, 3.4], [0, 3.45], [0.4, 3.45], [0.8, 3.42], [1.2, 3.38], [1.4, 3.35]],
    "2.0": [[-1.2, 0.05], [-1.0, 0.3], [-0.9, 0.8], [-0.8, 1.7], [-0.75, 2.3], [-0.7, 2.8], [-0.6, 3.2], [-0.5, 3.3], [0, 3.3], [0.4, 3.3], [0.8, 3.3], [1.2, 3.25], [1.4, 3.2]],
    "1.5": [[-1.2, 0.05], [-1.0, 0.25], [-0.9, 0.6], [-0.8, 1.2], [-0.7, 2.1], [-0.6, 2.7], [-0.5, 2.9], [-0.4, 2.95], [0, 3.0], [0.4, 3.02], [0.8, 3.05], [1.2, 3.05], [1.4, 3.05]],
    "1.0": [[-1.2, 0.05], [-1.0, 0.2], [-0.9, 0.45], [-0.8, 0.85], [-0.7, 1.3], [-0.6, 1.65], [-0.5, 1.85], [-0.4, 2.0], [-0.2, 2.2], [0, 2.3], [0.4, 2.45], [0.8, 2.55], [1.2, 2.65], [1.4, 2.7]],
    "0.5": [[-1.2, 0.02], [-1.0, 0.1], [-0.8, 0.3], [-0.6, 0.5], [-0.4, 0.65], [-0.2, 0.8], [0, 0.9], [0.4, 1.0], [0.8, 1.1], [1.2, 1.2], [1.4, 1.25]],
}
# Pass 2: pixel y of each curve at fixed columns of the ruler crop (origin (660, 1100) of the 300 dpi page render);
# calibration: xi = (x - 878)/525 (heavy gridlines every 0.4 at 248, 458, 668, 878, 1088, 1298, 1507),
# value = (876 - y)/212 (gridlines 4 -> 28, 3 -> 240, 2 -> 452, 1 -> 663, 0 -> 876).
COLUMNS = [(248, -1.2), (300, -1.1), (353, -1.0), (405, -0.9), (432, -0.85), (458, -0.8), (484, -0.75), (510, -0.7), (563, -0.6), (615, -0.5), (668, -0.4), (773, -0.2), (878, 0.0), (1088, 0.4), (1298, 0.8), (1507, 1.2), (1612, 1.4)]
PASS2_Y = {
    "4.0": [778, 710, 600, 430, 330, 250, 190, 155, 128, 120, 117, 113, 110, 112, 120, 132, 140],
    "3.0": [790, 735, 648, 510, 420, 330, 265, 215, 160, 142, 138, 135, 133, 135, 140, 150, 155],
    "2.0": [803, 760, 695, 590, 520, 450, 385, 320, 225, 190, 178, 175, 173, 175, 178, 185, 190],
    "1.5": [815, 782, 735, 665, 615, 560, 510, 460, 340, 275, 250, 240, 237, 233, 230, 228, 228],
    "1.0": [833, 812, 785, 745, 715, 680, 640, 600, 500, 465, 440, 410, 385, 350, 320, 300, 292],
    "0.5": [852, 840, 826, 808, 798, 785, 773, 760, 735, 715, 700, 685, 672, 650, 625, 605, 598],
}
ORIGIN_XI = -1.42  # the curves leave the axis at x ~ 137 px (xi = -1.41) in the crop


def interp(pts, x):
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if a <= x <= b:
            return va + (x - a) * (vb - va) / (b - a)
    raise ValueError(x)


curves = {}
for key, ys in PASS2_Y.items():
    rows = []
    worst = 0.0
    for (px, xi), y in zip(COLUMNS, ys):
        p2 = round((876 - y) / 212, 3)
        p1 = round(interp(PASS1[key], xi), 3)
        d = abs(p1 - p2)
        worst = max(worst, d)
        rows.append({"xi": xi, "pass1": p1, "pass2": p2, "value": round((p1 + p2) / 2, 3), "disagreement": round(d, 3)})
    points = [[ORIGIN_XI, 0.0]] + [[r["xi"], r["value"]] for r in rows]
    curves[key] = {"aspect_parameter": float(key), "worst_disagreement": round(worst, 3), "uncertainty": round(max(0.05, worst / 2), 3), "rows": rows, "points": points}

out = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.1.5.1-29, full-scan page 750 = page 256 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf (section 4.1.5.1 B, pp. 4.1.5.1-7 to -10). Chart references: Rand RM 604, NACA TR 1253.",
    "quantity": "C_Dw/(t/c)^(5/3) against xi = sqrt|M^2-1|/(t/c)^(1/3) (negative subsonic, positive supersonic) for A (t/c)^(1/3) = 0.5, 1.0, 1.5, 2.0, 3.0, 4.0; C_Dw on the wing planform area",
    "method": {
        "pass1": "read by eye against the printed grid from the 300 dpi render before the pixel pass; interpolated linearly to the pass-2 columns where it was read at other abscissae",
        "pass2": "pixel coordinates of the curves at 17 columns of a ruler-overlaid crop, converted by the gridline calibration recorded in build-datcom-fig-4151-29.py",
        "value": "mean of the passes; uncertainty per curve = max(0.05, half the worst disagreement) in the ordinate",
        "origin": "every curve starts at the axis at xi = -1.42 (both passes); above xi = 1.4 the chart ends",
        "check": "the DATCOM sample problem (p. 4.1.5.1-9) reads the chart at A (t/c)^(1/3) = 1.568: 0.07 at xi -1.34, 0.58 at -1.11, 1.10 at -0.97, 1.95 at -0.80, 2.75 at -0.57, 3.02 at 0, 3.10 at 0.82, 3.12 at 1.17, 3.13 at 1.45 (the last beyond the chart); the physics test compares the interpolated table with these",
    },
    "curves": curves,
}
Path(__file__).with_name("datcom-figure-4-1-5-1-29.json").write_text(json.dumps(out, indent=2) + "\n")
print("wrote")
for key, c in curves.items():
    print(key, "worst", c["worst_disagreement"], "unc", c["uncertainty"])
    print("  points:", c["points"])
