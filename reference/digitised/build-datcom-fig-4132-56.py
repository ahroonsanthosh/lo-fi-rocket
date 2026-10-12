#!/usr/bin/env python3
"""Build datcom-figure-4-1-3-2-56.json: two digitising passes of USAF DATCOM (1978) figure 4.1.3.2-56, "Wing
supersonic normal-force-curve slope", panels (a) lambda = 0, (c) 1/4, (e) 1/2, (f) 1 (scan pp. 556 to 558 = pages 62 to 64) and (g) rectangular
wings (scan p. 559 = page 65) of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf. Left half: ordinate
tan(Lambda_LE) C_N_alpha against beta/tan(Lambda_LE) (0 to 1); right half: beta C_N_alpha against tan(Lambda_LE)/beta
(1 down to 0); curves of A tan(Lambda_LE). The abscissa is folded into u = beta/tan(Lambda_LE) for u <= 1 and
u = 2 - tan(Lambda_LE)/beta for u > 1, and the ordinate stored as the chart's own (left: tan(Lambda_LE) C_N_alpha,
right: beta C_N_alpha; at u = 1 both equal). Pass 1 was read by eye against the grid from the 300 dpi renders before
the pixel pass; pass 2 is pixel coordinates at 11 columns (u = 0, 0.2, ..., 1.0, 1.2, ..., 2.0) of 2x zoomed strips
with a 10 px ruler, converted by the calibration below. Panels (b) 1/5 and (d) 1/3 are not digitised: taper ratios
between the panels are interpolated linearly in lambda. Run with python3 -I from the repository root."""
import json
from pathlib import Path

# Per panel: y of the value-7 gridline (top) and value-0 gridline (bottom) in page pixels.
CAL = {"a": (525, 1517.5), "c": (524, 1516.5), "e": (492.5, 1487.5), "f": (1734, 2726)}
U = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0]
# Pass 2: y pixel of each curve at the 11 columns (None where the curve does not exist or is unreadable).
PASS2_Y = {
    "a": {
        "6": [605, 605, 645, 715, 785, 865, 905, 940, 955, 955, 950],
        "5": [605, 620, 690, 760, 830, 905, 925, 945, 955, 955, 950],
        "4": [605, 660, 735, 805, 875, 945, 950, 950, 950, 950, 950],
        "3": [605, 700, 780, 855, 925, 990, 975, 960, 952, 950, 950],
        "2": [605, 745, 825, 900, 975, 1035, 1010, 990, 970, 955, 950],
        "1": [1300, 1295, 1290, 1280, 1270, 1255, 1215, 1150, 1060, 980, 950],
        "0.5": [1405, 1405, 1400, 1395, 1390, 1385, 1370, 1330, 1240, 1080, 950],
        "0.25": [1460, 1460, 1458, 1455, 1452, 1450, 1445, 1425, 1370, 1230, 950],
    },
    "c": {
        "6": [695, 690, 700, 720, 800, 865, 855, 870, 905, 940, 950],
        "5": [705, 705, 720, 775, 855, 920, 905, 915, 935, 948, 950],
        "4": [715, 715, 735, 810, 885, 960, 940, 940, 945, 948, 950],
        "3": [735, 740, 780, 860, 930, 1000, 975, 965, 955, 950, 950],
        "2": [755, 770, 820, 895, 965, 1035, 1005, 985, 965, 955, 950],
        "1": [1300, 1295, 1285, 1270, 1260, 1240, 1195, 1120, 1035, 975, 950],
        "0.5": [1405, 1403, 1400, 1395, 1392, 1385, 1365, 1320, 1230, 1075, 950],
        "0.25": [1458, 1458, 1456, 1454, 1452, 1450, 1442, 1420, 1360, 1220, 950],
    },
    "e": {
        "6": [760, 760, 762, 765, 820, 870, 860, 870, 900, 935, 945],
        "5": [770, 770, 772, 790, 860, 925, 910, 912, 930, 945, 948],
        "4": [785, 785, 790, 830, 900, 960, 945, 940, 945, 948, 948],
        "3": [800, 800, 820, 875, 940, 1005, 975, 960, 950, 948, 948],
        "2": [900, 905, 940, 985, 1030, 1060, 1025, 990, 965, 952, 948],
        "1": [1250, 1248, 1245, 1238, 1230, 1215, 1170, 1095, 1020, 965, 948],
        "0.5": [1370, 1368, 1365, 1362, 1358, 1350, 1330, 1290, 1200, 1060, 948],
        "0.25": [1435, 1434, 1432, 1430, 1428, 1425, 1418, 1400, 1340, 1200, 948],
    },
    "f": {
        "6": [2080, 2080, 2085, 2085, 2070, 2045, 2040, 2060, 2105, 2140, 2160],
        "5": [2100, 2100, 2105, 2105, 2095, 2090, 2080, 2095, 2125, 2150, 2160],
        "4": [2130, 2125, 2135, 2140, 2140, 2135, 2125, 2130, 2145, 2158, 2160],
        "3": [2185, 2180, 2185, 2195, 2200, 2210, 2190, 2175, 2165, 2160, 2160],
        "2": [2270, 2275, 2290, 2300, 2305, 2320, 2270, 2225, 2190, 2168, 2160],
        "1": [2480, 2478, 2475, 2465, 2450, 2430, 2370, 2290, 2215, 2175, 2160],
        "0.5": [2595, 2593, 2590, 2585, 2578, 2570, 2550, 2500, 2410, 2270, 2160],
        "0.25": [2655, 2655, 2652, 2650, 2648, 2645, 2638, 2615, 2550, 2420, 2160],
    },
}
# Pass 1 by eye (value at the same columns).
PASS1 = {
    "a": {
        "6": [6.4, 6.4, 6.2, 5.6, 5.2, 4.6, 4.3, 4.1, 4.0, 4.0, 4.0],
        "5": [6.4, 6.3, 5.8, 5.3, 4.8, 4.3, 4.2, 4.05, 4.0, 4.0, 4.0],
        "4": [6.4, 6.0, 5.5, 5.0, 4.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
        "3": [6.4, 5.7, 5.2, 4.7, 4.2, 3.7, 3.8, 3.9, 4.0, 4.0, 4.0],
        "2": [6.4, 5.4, 4.9, 4.35, 3.8, 3.4, 3.6, 3.75, 3.9, 4.0, 4.0],
        "1": [1.55, 1.55, 1.6, 1.65, 1.75, 1.85, 2.1, 2.6, 3.2, 3.8, 4.0],
        "0.5": [0.8, 0.8, 0.8, 0.85, 0.9, 0.95, 1.05, 1.3, 1.95, 3.1, 4.0],
        "0.25": [0.4, 0.4, 0.4, 0.42, 0.45, 0.47, 0.5, 0.65, 1.05, 2.0, 4.0],
    },
    "c": {
        "6": [5.8, 5.8, 5.75, 5.6, 5.05, 4.6, 4.7, 4.55, 4.3, 4.05, 4.0],
        "5": [5.7, 5.7, 5.6, 5.25, 4.65, 4.2, 4.3, 4.25, 4.1, 4.0, 4.0],
        "4": [5.6, 5.6, 5.5, 5.0, 4.45, 3.9, 4.05, 4.05, 4.0, 4.0, 4.0],
        "3": [5.5, 5.45, 5.2, 4.6, 4.15, 3.6, 3.8, 3.9, 3.95, 4.0, 4.0],
        "2": [5.35, 5.3, 4.9, 4.4, 3.9, 3.4, 3.6, 3.75, 3.9, 4.0, 4.0],
        "1": [1.5, 1.55, 1.6, 1.7, 1.8, 1.95, 2.25, 2.8, 3.4, 3.85, 4.0],
        "0.5": [0.8, 0.8, 0.8, 0.85, 0.9, 0.95, 1.05, 1.4, 2.0, 3.1, 4.0],
        "0.25": [0.4, 0.4, 0.42, 0.43, 0.45, 0.47, 0.52, 0.7, 1.1, 2.1, 4.0],
    },
    "e": {
        "6": [5.2, 5.2, 5.2, 5.15, 4.7, 4.35, 4.45, 4.4, 4.15, 4.0, 4.0],
        "5": [5.1, 5.1, 5.05, 4.95, 4.4, 4.0, 4.1, 4.1, 4.0, 4.0, 4.0],
        "4": [4.95, 4.95, 4.9, 4.65, 4.1, 3.7, 3.85, 3.9, 3.95, 4.0, 4.0],
        "3": [4.85, 4.85, 4.7, 4.3, 3.85, 3.4, 3.65, 3.8, 3.95, 4.0, 4.0],
        "2": [4.15, 4.1, 3.85, 3.55, 3.2, 3.0, 3.25, 3.5, 3.8, 3.95, 4.0],
        "1": [1.65, 1.65, 1.7, 1.75, 1.8, 1.9, 2.2, 2.75, 3.3, 3.8, 4.0],
        "0.5": [0.8, 0.8, 0.85, 0.85, 0.9, 0.95, 1.1, 1.4, 2.05, 3.0, 4.0],
        "0.25": [0.4, 0.4, 0.4, 0.42, 0.43, 0.45, 0.5, 0.65, 1.05, 2.05, 4.0],
    },
    "f": {
        "6": [4.55, 4.55, 4.5, 4.5, 4.6, 4.8, 4.85, 4.7, 4.4, 4.15, 4.0],
        "5": [4.4, 4.4, 4.35, 4.35, 4.45, 4.5, 4.55, 4.45, 4.25, 4.05, 4.0],
        "4": [4.2, 4.25, 4.15, 4.1, 4.1, 4.15, 4.2, 4.2, 4.1, 4.0, 4.0],
        "3": [3.8, 3.85, 3.8, 3.75, 3.7, 3.65, 3.75, 3.85, 3.95, 4.0, 4.0],
        "2": [3.2, 3.15, 3.05, 3.0, 2.95, 2.9, 3.2, 3.5, 3.8, 3.95, 4.0],
        "1": [1.75, 1.75, 1.8, 1.85, 1.95, 2.1, 2.5, 3.1, 3.6, 3.9, 4.0],
        "0.5": [0.9, 0.9, 0.95, 1.0, 1.05, 1.1, 1.25, 1.6, 2.25, 3.3, 4.0],
        "0.25": [0.5, 0.5, 0.5, 0.5, 0.55, 0.55, 0.6, 0.8, 1.25, 2.2, 4.0],
    },
}
LAMBDA = {"a": 0.0, "c": 0.25, "e": 0.5, "f": 1.0}

# The u = 2 column is the right axis, where every curve ends on the 4.0 gridline (beta C_N_alpha = 4 for
# tan(Lambda_LE)/beta = 0). The gridline was measured in the page renders at y = 953.5 (a), 948.5 (c), 919.5 (e),
# 2159.5 (f); the pass-2 readings at u = 2 are those measured values (the by-eye 948 first written for panel (e)
# was the label position, 28.5 px below the line, and was replaced; the u = 1.8 readings of panel (e) keep their
# read values and their disagreement with pass 1).
END_Y = {"a": 953.5, "c": 948.5, "e": 919.5, "f": 2159.5}

panels = {}
for key, curves in PASS2_Y.items():
    y7, y0 = CAL[key]
    out = {}
    for atan, ys in curves.items():
        rows = []
        worst = 0.0
        for u, y, p1 in zip(U, ys, PASS1[key][atan]):
            if u == 2.0:
                y = END_Y[key]
            p2 = round(7 * (y0 - y) / (y0 - y7), 3)
            d = abs(p1 - p2)
            worst = max(worst, d)
            rows.append({"u": u, "pass1": p1, "pass2": p2, "value": round((p1 + p2) / 2, 3), "disagreement": round(d, 3)})
        out[atan] = {"a_tan_le": float(atan), "worst_disagreement": round(worst, 3), "uncertainty": round(max(0.1, worst / 2), 3), "rows": rows, "points": [[r["u"], r["value"]] for r in rows]}
    panels[key] = {"taper_ratio": LAMBDA[key], "curves": out}

# Panel (g) rectangular wings (Lambda = 0, lambda = 1), scan p. 559 = page 65 of the same file. Left half: C_N_alpha/A
# against A beta (0 to 1); right half: beta C_N_alpha against 1/(A beta) (1 to 0), drawn as one straight line from
# 2.0 at 1/(A beta) = 1 to 4.0 at 0 (both ends on gridline intersections), i.e. beta C_N_alpha = 4 - 2/(A beta).
# Calibration of the 300 dpi render: x = 661 + 713.5 (A beta), value = (2524.5 - y)/283 (gridlines 0 and 5).
# Pass 1 by eye; pass 2 the dark-run centre at +-4 px of each column (gridline rows removed).
G_AB = [0.0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0]
G_PASS2_Y = [2073.0, 2078.2, 2082.2, 2086.5, 2091.0, 2084.3, 2070.0, 2048.0, 2026.7, 2012.7, 1997.6, 1986.0, 1975.0,
             1964.7, 1961.0, 1959.5, 1958.5]
G_PASS1 = [1.6, 1.58, 1.57, 1.56, 1.55, 1.56, 1.6, 1.68, 1.77, 1.82, 1.88, 1.92, 1.97, 1.99, 2.0, 2.0, 2.0]
g_rows = []
for ab, y, p1 in zip(G_AB, G_PASS2_Y, G_PASS1):
    p2 = round((2524.5 - y) / 283, 3)
    g_rows.append({"a_beta": ab, "pass1": p1, "pass2": p2, "value": round((p1 + p2) / 2, 3),
                   "disagreement": round(abs(p1 - p2), 3)})
panel_g = {
    "left": {"quantity": "C_N_alpha / A per radian against A beta, A beta <= 1", "rows": g_rows,
             "points": [[r["a_beta"], r["value"]] for r in g_rows],
             "worst_disagreement": max(r["disagreement"] for r in g_rows)},
    "right": {"quantity": "beta C_N_alpha per radian against 1/(A beta), A beta >= 1",
              "line": "straight line through (1/(A beta), beta C_N_alpha) = (1, 2) and (0, 4): beta C_N_alpha = 4 - 2/(A beta)"},
}

doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.1.3.2-56 (section 4.1.3.2 C), panels (a) lambda = 0, (c) 1/4, (e) 1/2, (f) 1; scan pp. 556 to 558 = pages 62 to 64 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf. Theory of references 20 to 25 of that section (linear theory, slender-wing theory below A beta = 1/4).",
    "quantity": "tan(Lambda_LE) C_N_alpha (left, u <= 1) or beta C_N_alpha (right, u > 1), per radian, on the wing planform area, for curves of A tan(Lambda_LE); u = beta/tan(Lambda_LE) for u <= 1, u = 2 - tan(Lambda_LE)/beta for u > 1",
    "method": {
        "pass1": "read by eye against the printed grid from the 300 dpi renders before the pixel pass",
        "pass2": "pixel y of each curve at 11 columns of 2x zoomed strips with a 10 px ruler, converted by the 7 and 0 gridline calibration per panel; the u = 2 end point of every curve is the measured 4.0 gridline (END_Y in the build script)",
        "value": "mean; uncertainty per curve = max(0.1, half the worst disagreement) per radian in the chart ordinate",
        "panels_not_digitised": "(b) lambda = 1/5 and (d) 1/3: the model interpolates linearly in lambda between the digitised panels; panel (g) rectangular wings is the lambda = 1, Lambda = 0 limit of (f)",
        "curve_identity": "the A tan(Lambda_LE) labels sit on the curves at the u = 1 axis of every panel; the dashed 'unswept T.E.' and 'sonic T.E.' lines are boundaries, not curves, and were not digitised",
    },
    "panels": panels,
    "panel_g": panel_g,
}
Path(__file__).with_name("datcom-figure-4-1-3-2-56.json").write_text(json.dumps(doc, indent=2) + "\n")
for key, p in panels.items():
    print(key, {k: (c["worst_disagreement"], c["uncertainty"]) for k, c in p["curves"].items()})
