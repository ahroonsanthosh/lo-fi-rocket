#!/usr/bin/env python3
"""Build datcom-large-angle-charts.json: the USAF DATCOM (1978) charts for the normal force and centre of pressure
of bodies and fins at large angles of attack (plan 0033, HA-1 to HA-10, D-070).

Files: reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf (scan pages 495 to 920; "page N" below is the
PDF page of that file, rendered at 300 dpi with pdftoppm -gray).

Charts and calibrations (pixel -> value, from the gridlines found by a dark-fraction scan and identified by their
printed labels):
- 4.2.1.2-35a (page 381): eta vs body fineness ratio f; x = 978.5 + 35.53 f, eta = 1 - 0.5 (y - 589.5)/706.
- 4.2.1.2-35b (page 381): c_dc vs cross-flow Mach M_c, folded at 1.0: k = 10 M_c (M_c <= 1), k = 20 - 10/M_c (M_c > 1);
  x = 833.5 + 71.05 k, c_dc = 2 - (y - 1800.5)/708.5.
- 4.1.3.3-55a left (page 124): Delta C_Naa (per rad) vs r = tan(alpha)/tan(alpha_CLmax); x = 715.2 + 667.8 r,
  value = 4 - (y - 735)/135.5. Right: D vs r' = tan(alpha_CLmax)/tan(alpha); x = 2251 - 675 r', D = 1 - (y - 734)/270.5.
- 4.1.3.3-55b (page 124): C_N at 90 deg vs aspect ratio, folded at A = 1: k = 10 A (A <= 1), k = 20 - 10/A (A > 1);
  x = 781 + 67.35 k, C_N = 3 - (y - 1952)/268.75.
- 4.1.3.4-23a (page 153): (C_Lmax)_base vs X = (C1 + 1)(A/beta) cos(Lambda_LE); x = 792 + 355.8 X,
  value = 1.7 - (y - 720.5)/714. 4.1.3.4-23b (same page): x = 799.5 + 355.3 X, value = 1.6 - (y - 1899.5)/711.7.

Pass 2 (the table values) is pixel extraction: polylines drawn by eye snapped to the nearest dark run of the drawn
line in every column (the line centre), sampled at the listed abscissae; on steep branches and where curves crowd,
dark-run centres along rows or columns were assigned to curves by their order. Pass 1 is an independent check: by-eye
readings of gridline crossings from zoomed crops (35a, 35b, 55a, 55b, D) or dark-run centres of single columns
midway between gridlines (23a, 23b). Each chart's uncertainty is max(0.01, worst pass-1 disagreement) in its own
ordinate units. Judgement calls are in the notes and in D-070. Run with python3 -I from the repository root; the
TypeScript tables in packages/physics/src/stability/datcom-large-angle-data.ts are checked against the output by a
formats test."""
import json
from pathlib import Path


def interp(points, v):
    for (v0, f0), (v1, f1) in zip(points, points[1:]):
        if v0 - 1e-9 <= v <= v1 + 1e-9:
            return f0 + (f1 - f0) * (v - v0) / (v1 - v0) if v1 != v0 else f0
    raise ValueError(v)


def checks(pass1, pass2):
    out = [{"x": x, "pass1": f, "pass2": round(interp(pass2, x), 4), "disagreement": round(abs(f - interp(pass2, x)), 4)}
           for x, f in pass1]
    worst = max(c["disagreement"] for c in out) if out else 0.0
    return out, worst


# ---------------------------------------------------------------- 4.2.1.2-35a eta(f)
ETA_PASS2 = [[2.05, 0.5592], [2.5, 0.5687], [3.0, 0.5792], [3.5, 0.5894], [4.0, 0.5977], [5.0, 0.6176], [6.0, 0.6334],
             [7.0, 0.6479], [8.0, 0.6614], [9.0, 0.6745], [10.0, 0.6848], [11.0, 0.6965], [12.0, 0.7028], [13.0, 0.7136],
             [14.0, 0.7213], [15.0, 0.7289], [16.0, 0.7338], [17.0, 0.7426], [18.0, 0.7489], [19.0, 0.7519],
             [20.0, 0.7583], [21.0, 0.7632], [22.0, 0.7671], [23.0, 0.771], [24.0, 0.7747], [25.0, 0.7792],
             [26.0, 0.7821], [27.0, 0.7855], [27.9, 0.7878]]
ETA_PASS1 = [[2.05, 0.555], [4, 0.605], [8, 0.669], [12, 0.708], [16, 0.736], [20, 0.758], [24, 0.773], [27.9, 0.787]]

# ---------------------------------------------------------------- 4.2.1.2-35b c_dc(k)
# k = 0 to 2.5 and 9 to 9.5 lie on the 1.2 and 1.8 gridlines (the snap skips gridline rows); read as on the line.
CDC_PASS2 = [[0.0, 1.2], [1.0, 1.2], [2.0, 1.2], [2.5, 1.2], [3.0, 1.2112], [3.5, 1.2339], [4.0, 1.2638], [4.5, 1.3064],
             [5.0, 1.3613], [5.5, 1.4191], [6.0, 1.4921], [6.5, 1.5896], [7.0, 1.6965], [7.5, 1.7357], [8.0, 1.7698],
             [8.5, 1.7937], [9.0, 1.8], [9.5, 1.8], [10.0, 1.796], [10.5, 1.7739], [11.0, 1.7469], [11.5, 1.7054],
             [12.0, 1.6563], [12.5, 1.6037], [13.0, 1.558], [13.5, 1.5174], [14.0, 1.4969], [14.5, 1.4431],
             [15.0, 1.4074], [15.5, 1.3821], [16.0, 1.3531], [16.5, 1.3307], [17.0, 1.3049], [17.5, 1.2931],
             [18.0, 1.2759], [18.5, 1.2615], [18.9, 1.2549]]
# Rising flank: M_c where the curve crosses the 1.3 ... 1.8 gridlines; falling flank: the curve at 1/M_c gridlines.
CDC_PASS1 = [[4.255, 1.3], [5.10, 1.4], [5.86, 1.5], [6.45, 1.6], [7.09, 1.7], [8.68, 1.8], [11, 1.7535],
             [12, 1.669], [13, 1.566], [14, 1.483], [15, 1.408], [16, 1.354], [17, 1.308], [18, 1.276]]

# ---------------------------------------------------------------- 4.1.3.3-55a Delta C_Naa(r; J)
# Column slices at x = 862, 882, 949, 1016, 1082, 1149, 1216 (r = 0.22, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75): dark-run
# centres y assigned by order. J >= 1 curves are a flat line, then a straight line to (1, 0): the flat value is the mean
# of the slice centres on the flat part, the break is where the straight line through the descending slice points
# (which extrapolates to r = 1.00 +- 0.01 at value 0 for every curve) meets the flat value.
def v55(y):
    return round(4 - (y - 735) / 135.5, 4)


def r55(x):
    return round((x - 715.2) / 667.8, 4)


J_FLAT = {  # J: (flat slice centres y, descending (x, y) points)
    "3": ([892, 891.5, 892, 892], [(1149, 940), (1216, 1039.5)]),
    "2.5": ([920, 919, 919, 918.5], [(1149, 1000.5), (1383, 1277)]),
    "2": ([955.5, 955, 955, 955.5], [(1082, 985.5), (1149, 1050), (1216, 1116)]),
    "1.5": ([1004, 1004, 1004.5, 1005], [(1082, 1051.5), (1149, 1102), (1216, 1153)]),
    "1": ([1057.5, 1057, 1056.5], [(1082, 1112.5), (1149, 1146.5), (1216, 1187)]),
}
J_POINTS_PASS2 = {}
for J, (flat, desc) in J_FLAT.items():
    yf = sum(flat) / len(flat)
    (xa, ya), (xb, yb) = desc[0], desc[-1]
    slope = (yb - ya) / (xb - xa)
    xbreak = xa - (ya - yf) / slope
    J_POINTS_PASS2[J] = [[0.2, v55(yf)], [r55(xbreak), v55(yf)], [1.0, 0.0]]
J_SLICES = {  # J: centres y at r = 0.22, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.786, 0.831 (x = 862 ... 1270)
    "0.5": [1126.5, 1127.5, 1137.5, 1148.5, 1165.5, 1187, 1210, 1214.5, 1231],
    "0.25": [1157, 1159.5, 1165.5, 1175, 1189.5, 1207.5, 1224.5, 1231.5, 1241],
    "0.15": [1197, 1197, 1200.5, 1207, 1213, 1226.5, 1240.5, 1245.5, 1251.5],
    "0": [1249.5, 1247, 1245, 1244.5, 1247.5, 1252, 1258, 1260.5, 1263.5],
    "-1": [1304.5, 1301.5, 1295, 1290, 1286, 1282],
    "-2": [1330.5, 1327, 1318, 1309.5, 1303, 1297, 1291.5, 1288.5, 1286.5],
    "-4": [1408.5, 1399.5, 1376.5, 1354.5, 1341, 1321.5, 1308, 1303.5, 1297.5],
}
R_SLICES = [0.22, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.786, 0.831]
# Beyond r = 0.83 the curves for J = 0.5, 0.25 and 0.15 run together as one line (x = 1300: centre y = 1250, 23 px wide,
# value 0.199 at r = 0.876) and J = 0 lies just below (y = 1266.5, 0.080); all lines then reach (1, 0). The J = -1 curve
# lies on the heavy zero line from r = 0.75. These stretches are read as straight to (1, 0) from the last clean slice.
J_MERGED = {"0.5": [[0.876, 0.199]], "0.25": [[0.876, 0.199]], "0.15": [[0.876, 0.199]], "0": [[0.876, 0.080]]}
for J, ys in J_SLICES.items():
    pts = [[0.2, v55(ys[0])]] + [[r, v55(y)] for r, y in zip(R_SLICES, ys)] + J_MERGED.get(J, []) + [[1.0, 0.0]]
    J_POINTS_PASS2[J] = pts
# Pass 1: by-eye flat values and breaks (J >= 1) and values at r = 0.4 (J <= 0.5) from the 300 dpi crop.
J_PASS1 = {"3": [[0.4, 2.856], [0.599, 2.856]], "2.5": [[0.4, 2.657], [0.546, 2.657]], "2": [[0.4, 2.376], [0.501, 2.376]],
           "1.5": [[0.3, 2.030], [0.459, 2.030]], "1": [[0.3, 1.638], [0.399, 1.638]], "0.5": [[0.4, 1.011]],
           "0.25": [[0.4, 0.812]], "0.15": [[0.4, 0.546]], "0": [[0.4, 0.221]], "-1": [[0.4, -0.118]],
           "-2": [[0.4, -0.280]], "-4": [[0.4, -0.635]]}

D_PASS2 = [[0.0, 0.0], [0.02, -0.0644], [0.05, -0.1605], [0.1, -0.337], [0.15, -0.5225], [0.2, -0.7092], [0.25, -0.8703],
           [0.3, -1.0163], [0.35, -1.1537], [0.4, -1.2643], [0.45, -1.3715], [0.5, -1.4646], [0.525, -1.4843],
           [0.55, -1.5068], [0.575, -1.5339], [0.6, -1.5397], [0.625, -1.5293], [0.65, -1.5028], [0.675, -1.4744],
           [0.7, -1.4045], [0.725, -1.329], [0.75, -1.2307], [0.775, -1.11], [0.8, -0.9809], [0.825, -0.7988],
           [0.85, -0.5819],
           # column slices x = 1660 ... 1595 (r' = 0.876 ... 0.972) near r' = 1, where the curve leaves the zero line
           [0.876, -0.383], [0.898, -0.244], [0.913, -0.18], [0.927, -0.135], [0.942, -0.091], [0.957, -0.055],
           [0.972, -0.0185], [1.0, 0.0]]
D_PASS1 = [[0.8, -0.977], [0.6, -1.54], [0.4, -1.268], [0.2, -0.70]]

# ---------------------------------------------------------------- 4.1.3.3-55b C_N(90 deg) vs k(A)
CN90_PASS2 = [[0.13, 1.834], [0.28, 1.683], [0.5, 1.527], [0.73, 1.411], [1.03, 1.307], [1.32, 1.259], [1.77, 1.216],
              [2.5, 1.195], [5.0, 1.195], [10.0, 1.195], [14.0, 1.195], [15.13, 1.19], [16.62, 1.21], [17.36, 1.238],
              [18.0, 1.2722], [18.5, 1.3194], [19.0, 1.4149], [19.5, 1.5746], [19.8, 1.7445]]
CN90_PASS1 = [[1.0, 1.30], [2.0, 1.2], [5.0, 1.2], [10.0, 1.2], [15.0, 1.2], [18.0, 1.27], [19.0, 1.42]]

# ---------------------------------------------------------------- 4.1.3.4-23a/b (C_Lmax)_base
F23A_LEFT = {
    "0": [[0.027, 0.9584], [0.053, 1.0284], [0.073, 1.0845], [0.097, 1.1405], [0.112, 1.1825], [0.135, 1.2245], [0.152, 1.2665], [0.169, 1.2945], [0.184, 1.3225], [0.207, 1.3506], [0.216, 1.3786], [0.229, 1.4066], [0.261, 1.4346], [0.287, 1.4626], [0.315, 1.4906], [0.344, 1.5186], [0.381, 1.5466], [0.45, 1.5865], [0.5, 1.6113], [0.55, 1.6307], [0.6, 1.6412], [0.65, 1.6486], [0.7, 1.6564], [0.75, 1.6489], [0.8, 1.6464], [0.85, 1.6384], [0.9, 1.6261], [0.95, 1.6058]],
    "0.25": [[0.028, 0.8183], [0.051, 0.8884], [0.069, 0.9584], [0.094, 1.0284], [0.118, 1.0845], [0.142, 1.1405], [0.16, 1.1825], [0.183, 1.2245], [0.208, 1.2665], [0.219, 1.2945], [0.242, 1.3225], [0.264, 1.3506], [0.288, 1.3786], [0.316, 1.4066], [0.347, 1.4346], [0.388, 1.4626], [0.436, 1.4906], [0.5, 1.5221], [0.55, 1.5379], [0.6, 1.5503], [0.65, 1.5597], [0.7, 1.5654], [0.75, 1.5668], [0.8, 1.5631], [0.85, 1.5574], [0.9, 1.5476], [0.95, 1.5316], [1.0, 1.5055], [1.04, 1.4871]],
    "0.5": [[0.051, 0.8183], [0.074, 0.8884], [0.129, 1.0284], [0.155, 1.0845], [0.183, 1.1405], [0.207, 1.1825], [0.235, 1.2245], [0.268, 1.2665], [0.294, 1.2945], [0.325, 1.3225], [0.353, 1.3506], [0.385, 1.3786], [0.42, 1.4066], [0.5, 1.4398], [0.55, 1.4561], [0.6, 1.4653], [0.65, 1.4743], [0.7, 1.4781], [0.75, 1.478], [0.8, 1.4754], [0.85, 1.466], [0.9, 1.4514], [0.95, 1.4319], [1.0, 1.4056], [1.04, 1.3806]],
    "0.75": [[0.044, 0.7483], [0.073, 0.8183], [0.104, 0.8884], [0.135, 0.9584], [0.169, 1.0284], [0.207, 1.0845], [0.24, 1.1405], [0.271, 1.1825], [0.315, 1.2245], [0.361, 1.2665], [0.402, 1.2945], [0.448, 1.3225], [0.523, 1.3506], [0.6, 1.3731], [0.65, 1.3823], [0.7, 1.3877], [0.75, 1.3888], [0.8, 1.3876], [0.85, 1.3802], [0.9, 1.3688], [0.95, 1.3527], [1.0, 1.3373], [1.04, 1.3145]],
    "1.0": [[0.032, 0.5382], [0.049, 0.6083], [0.065, 0.6783], [0.084, 0.7483], [0.107, 0.8183], [0.141, 0.8884], [0.169, 0.9584], [0.215, 1.0284], [0.261, 1.0845], [0.326, 1.1405], [0.381, 1.1825], [0.448, 1.2245], [0.537, 1.2665], [0.7, 1.3057], [0.75, 1.3085], [0.8, 1.3043], [0.85, 1.3049], [0.9, 1.2991], [0.95, 1.2865], [1.0, 1.2725], [1.04, 1.258]],
}
# Right labels on the same three drawn lines (left 0.5 -> 0.5, left 0.75 -> 1.0, left >= 1.0 -> >= 1.35).
F23A_RIGHT = {
    "0.5": [[1.04, 1.3806], [1.1, 1.3408], [1.2, 1.2809], [1.3, 1.2214], [1.4, 1.1723], [1.5, 1.1269], [1.6, 1.0901], [1.8, 1.0223], [2.0, 0.9731], [2.2, 0.9414], [2.4, 0.9169], [2.6, 0.8991], [2.8, 0.8835], [3.0, 0.8667], [3.2, 0.8563], [3.4, 0.8499], [3.55, 0.8422]],
    "1.0": [[1.04, 1.3145], [1.1, 1.2875], [1.2, 1.2326], [1.3, 1.1831], [1.4, 1.1401], [1.5, 1.0791], [1.6, 1.0444], [1.8, 0.9871], [2.0, 0.9393], [2.2, 0.9024], [2.4, 0.8761], [2.6, 0.859], [2.8, 0.8447], [3.0, 0.8313], [3.2, 0.8232], [3.4, 0.8137], [3.55, 0.8122]],
    "1.35": [[1.04, 1.258], [1.1, 1.2362], [1.2, 1.1967], [1.3, 1.1531], [1.4, 1.1069], [1.5, 1.0588], [1.6, 1.0265], [1.8, 0.9633], [2.0, 0.9141], [2.2, 0.8772], [2.4, 0.851], [2.6, 0.8359], [2.8, 0.8202], [3.0, 0.81], [3.3, 0.8], [3.5, 0.797]],
}
F23A_PASS1 = {  # column slices x = 970, 1112, 1326, 1539, 1682, 1824 (X = 0.5, 0.9, 1.5, 2.1, 2.5, 2.9)
    "left": {"0": [[0.5, 1.6118], [0.9, 1.6265]], "0.25": [[0.5, 1.5214], [0.9, 1.5473]], "0.5": [[0.5, 1.4395], [0.9, 1.4521]],
             "0.75": [[0.9, 1.3688]], "1.0": [[0.9, 1.2994]]},
    "right": {"0.5": [[1.5, 1.1265], [2.1, 0.9584], [2.5, 0.9052], [2.9, 0.8765]],
              "1.0": [[1.5, 1.0782], [2.1, 0.9192], [2.5, 0.8667], [2.9, 0.8387]],
              "1.35": [[1.5, 1.0578], [2.1, 0.8961], [2.5, 0.8436], [2.9, 0.8148]]},
}
F23B_LEFT = {
    "0": [[0.45, 1.3937], [0.5, 1.4038], [0.55, 1.4191], [0.6, 1.4295], [0.65, 1.4336], [0.7, 1.4421], [0.75, 1.437], [0.8, 1.4326], [0.85, 1.4226], [0.9, 1.4049], [0.95, 1.3885], [1.0, 1.3654], [1.05, 1.3367], [1.1, 1.3051], [1.13, 1.2944]],
    "0.25": [[0.5, 1.3292], [0.55, 1.3438], [0.6, 1.3543], [0.65, 1.3635], [0.7, 1.3687], [0.75, 1.3696], [0.8, 1.3693], [0.85, 1.3597], [0.9, 1.3465], [0.95, 1.3305], [1.0, 1.3104], [1.05, 1.2853], [1.1, 1.258]],
    "0.5": [[0.45, 1.2483], [0.5, 1.2651], [0.55, 1.2789], [0.6, 1.2881], [0.65, 1.2972], [0.8, 1.2963], [0.85, 1.2889], [0.9, 1.2771], [0.95, 1.261], [1.0, 1.2478], [1.05, 1.2252], [1.1, 1.2055]],
    "0.75": [[0.5, 1.1974], [0.55, 1.2024], [0.6, 1.2291], [0.65, 1.2367], [0.7, 1.2432], [0.75, 1.249], [0.8, 1.2473], [0.85, 1.2412], [0.9, 1.2321], [0.95, 1.2191], [1.0, 1.205], [1.05, 1.1935], [1.1, 1.177], [1.13, 1.149]],
    "1.0": [[0.5, 1.1384], [0.65, 1.1834], [0.7, 1.1932], [0.75, 1.1974], [0.8, 1.1971], [0.85, 1.1957], [0.9, 1.187], [0.95, 1.1803], [1.0, 1.175], [1.05, 1.1642], [1.1, 1.1552], [1.13, 1.1483]],
}
# The right family is drawn from X = 1.18 after a gap; it continues the left lines (slope matches across the gap).
F23B_RIGHT = {
    "0.5": [[1.1, 1.2055], [1.3, 1.123], [1.4, 1.1001], [1.5, 1.0741], [1.6, 1.0525], [1.8, 1.0049], [2.0, 0.9722], [2.2, 0.9436], [2.4, 0.9155], [2.8, 0.8804], [3.0, 0.8635], [3.2, 0.8593], [3.5, 0.8455]],
    "1.0": [[1.13, 1.149], [1.3, 1.1047], [1.4, 1.0819], [1.5, 1.0519], [1.6, 1.0281], [1.8, 0.9799], [2.0, 0.9389], [2.2, 0.9009], [2.4, 0.8732], [2.6, 0.8572], [2.8, 0.8424], [3.2, 0.8237]],
    "1.35": [[1.13, 1.1483], [1.3, 1.0861], [1.4, 1.0607], [1.5, 1.0318], [1.6, 1.0047], [1.8, 0.9553], [2.0, 0.9143], [2.2, 0.8788], [2.4, 0.8535], [2.6, 0.8376], [2.8, 0.8219], [3.0, 0.8096], [3.2, 0.802], [3.4, 0.8012]],
}
F23B_PASS1 = {  # column slices x = 977, 1119, 1190 (X = 0.5, 0.9, 1.1); right: slices at X = 1.5, 1.9, 2.3, 2.9
    "left": {"0": [[0.5, 1.404], [0.9, 1.4047], [1.1, 1.3056]], "0.25": [[0.5, 1.3288], [0.9, 1.3464], [1.1, 1.2586]],
             "0.5": [[0.5, 1.2649], [0.9, 1.2768], [1.1, 1.2059]], "0.75": [[0.5, 1.1981], [0.9, 1.2326], [1.1, 1.1778]],
             "1.0": [[0.9, 1.1869], [1.1, 1.1553]]},
    "right": {"0.5": [[1.5, 1.0745], [1.9, 0.9902], [2.3, 0.927], [2.9, 0.8722]],
              "1.0": [[1.5, 1.052], [1.9, 0.9579], [2.3, 0.8855], [2.9, 0.837]],
              "1.35": [[1.5, 1.0323], [1.9, 0.934], [2.3, 0.8651], [2.9, 0.816]]},
}


def family(curves, pass1):
    out = {}
    for label, pts in curves.items():
        c, worst = checks(pass1.get(label, []), pts)
        out[label] = {"points": pts, "checks": c, "worst_disagreement": worst, "uncertainty": round(max(0.01, worst), 4)}
    return out


doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf",
    "charts": {},
}
c, w = checks(ETA_PASS1, ETA_PASS2)
doc["charts"]["4.2.1.2-35a"] = {"page": 381, "quantity": "eta, ratio of finite- to infinite-cylinder cross-flow drag, vs body fineness ratio (drawn 2.05 to 27.9)",
                                "points": ETA_PASS2, "checks": c, "worst_disagreement": w, "uncertainty": round(max(0.01, w), 4)}
c, w = checks(CDC_PASS1, CDC_PASS2)
doc["charts"]["4.2.1.2-35b"] = {"page": 381, "quantity": "c_dc, steady cross-flow drag coefficient of a circular cylinder, vs k = 10 M_c (M_c <= 1), 20 - 10/M_c (M_c > 1); drawn to k = 18.9 (M_c = 9.1)",
                                "points": CDC_PASS2, "checks": c, "worst_disagreement": w, "uncertainty": round(max(0.01, w), 4)}
jc = {}
for J, pts in J_POINTS_PASS2.items():
    c, w = checks(J_PASS1[J], pts)
    jc[J] = {"points": pts, "checks": c, "worst_disagreement": w, "uncertainty": round(max(0.02, w), 4)}
doc["charts"]["4.1.3.3-55a-left"] = {"page": 124, "quantity": "Delta C_Naa per rad vs tan(alpha)/tan(alpha_CLmax), curves of J; drawn from 0.2, all curves end at (1, 0); converged beyond 0.75, read as straight to (1, 0)",
                                     "curves": jc}
c, w = checks(D_PASS1, D_PASS2)
doc["charts"]["4.1.3.3-55a-right"] = {"page": 124, "quantity": "D vs tan(alpha_CLmax)/tan(alpha) (1 at the stall, 0 at 90 deg)",
                                      "points": D_PASS2, "checks": c, "worst_disagreement": w, "uncertainty": round(max(0.02, w), 4)}
c, w = checks(CN90_PASS1, CN90_PASS2)
doc["charts"]["4.1.3.3-55b"] = {"page": 124, "quantity": "C_N at 90 deg vs k = 10 A (A <= 1), 20 - 10/A (A > 1); drawn from A = 0.013 to A = 50",
                                "points": CN90_PASS2, "checks": c, "worst_disagreement": w, "uncertainty": round(max(0.01, w), 4)}
doc["charts"]["4.1.3.4-23a"] = {"page": 153, "quantity": "(C_Lmax)_base vs X = (C1 + 1)(A/beta) cos(Lambda_LE), maximum thickness at or forward of 35 % chord",
                                "left_until": 1.04, "left": family(F23A_LEFT, F23A_PASS1["left"]), "right": family(F23A_RIGHT, F23A_PASS1["right"])}
doc["charts"]["4.1.3.4-23b"] = {"page": 153, "quantity": "(C_Lmax)_base vs X, maximum thickness between 35 and 50 % chord",
                                "left_until": 1.13, "left": family(F23B_LEFT, F23B_PASS1["left"]), "right": family(F23B_RIGHT, F23B_PASS1["right"])}

# ---------------------------------------------------------------- 4.1.3.4-24a, -24b, -25a, -25b (pages 154, 155)
# Two passes in datcom-4134-passes.json (pass 1 by eye from ruler crops, pass 2 pixel centres through a per-gridline
# calibration; its notes list every bridged or extrapolated sample). Assembled here:
# - 24a: the M = 0.4 line starts at a free end at x = 5.44; below it all three Mach curves share the drawn trunk, so
#   the M = 0.4 curve takes the trunk to x = 4.5 (where the M = 0.6 curve leaves it) and is linear from there to its start.
# - 25b: the left family (parameter A cos(Lambda_LE)[1 + (2 lambda)^2] = 0, 2, ..., 9 and the "10-30" envelope) and the
#   Mach curves meet at x = 4.4 on the zero line (hidden by the gridline; drawing consistent within 0.15 deg): every left
#   curve ends and every Mach curve starts at (4.4, 0).
P4134 = json.loads(Path(__file__).with_name("datcom-4134-passes.json").read_text())["figures"]


def p2(fig, curve):
    return [[round(x, 4), round(v, 4)] for x, v in P4134[fig]["curves"][curve]["pass2"]]


def unc(fig, curve, floor):
    return round(max(floor, P4134[fig]["curves"][curve]["worst_disagreement"]), 4)


trunk = [p for p in p2("4.1.3.4-24a", "M<=0.2") if p[0] <= 4.5]
doc["charts"]["4.1.3.4-24a"] = {"page": 154, "quantity": "Delta C_Lmax vs (C2 + 1) A tan(Lambda_LE), curves of Mach number (0.2 means M <= 0.2); drawn to x = 13.77",
    "curves": {"0.2": {"points": p2("4.1.3.4-24a", "M<=0.2"), "uncertainty": unc("4.1.3.4-24a", "M<=0.2", 0.01)},
               "0.4": {"points": trunk + p2("4.1.3.4-24a", "M=0.4"), "uncertainty": unc("4.1.3.4-24a", "M=0.4", 0.01)},
               "0.6": {"points": p2("4.1.3.4-24a", "M=0.6"), "uncertainty": unc("4.1.3.4-24a", "M=0.6", 0.01)}}}
doc["charts"]["4.1.3.4-24b-C1"] = {"page": 154, "quantity": "C1 vs taper ratio", "points": p2("4.1.3.4-24b_C1", "C1"), "uncertainty": unc("4.1.3.4-24b_C1", "C1", 0.01)}
doc["charts"]["4.1.3.4-24b-C2"] = {"page": 154, "quantity": "C2 vs taper ratio", "points": p2("4.1.3.4-24b_C2", "C2"), "uncertainty": unc("4.1.3.4-24b_C2", "C2", 0.01)}
doc["charts"]["4.1.3.4-25a"] = {"page": 155, "quantity": "(alpha_CLmax)_base in degrees vs (C1 + 1)(A/beta) cos(Lambda_LE), drawn to 3.6",
    "points": p2("4.1.3.4-25a", "alpha_CLmax_base"), "uncertainty": unc("4.1.3.4-25a", "alpha_CLmax_base", 0.1)}
left25 = {}
for label, name in (("0", "P=0"), ("2", "P=2"), ("3", "P=3"), ("4", "P=4"), ("5", "P=5"), ("6", "P=6"), ("7", "P=7"),
                    ("8", "P=8"), ("9", "P=9"), ("10", "P=10-30")):
    pts = [p for p in p2("4.1.3.4-25b", name) if p[0] < 4.4] + [[4.4, 0.0]]
    left25[label] = {"points": pts, "uncertainty": unc("4.1.3.4-25b", name, 0.15)}
right25 = {}
for label, name in (("0.2", "M<=0.2"), ("0.4", "M=0.4"), ("0.6", "M=0.6")):
    right25[label] = {"points": [[4.4, 0.0]] + p2("4.1.3.4-25b", name), "uncertainty": unc("4.1.3.4-25b", name, 0.15)}
doc["charts"]["4.1.3.4-25b"] = {"page": 155, "quantity": "Delta alpha_CLmax in degrees vs (C2 + 1) A tan(Lambda_LE): left of 4.4 curves of A cos(Lambda_LE)[1 + (2 lambda)^2] (10 = the printed 10-30 envelope), right of 4.4 curves of Mach number",
    "left_until": 4.4, "left": left25, "right": right25}

# ---------------------------------------------------------------- 4.1.4.3-21a to -24b (pages 221 to 224)
# Two passes in datcom-4143-passes.json (its notes list every merged, obscured or interpolated stretch). Assembled here:
# - 22a: the lower-left labels are A = 1, 2, 2.5, 4 and the upper-right A = 2, 4, 6 (2 and 2.5 merge at X = 3.92). The
#   A = 1 curve ends at X = 5.20 and the A = 6 curve starts at X = 6.52; where a curve is not drawn the nearest drawn one
#   is used (A = 1 takes the A = 2 line beyond 5.20, A = 6 the A = 4 line below 6.52).
# - 22b: the eleventh, unlabelled line (A tan(Lambda_LE) = 10 by sequence) is not used; 9 is the highest label.
# - 23 and 24b: abscissae (stability index, aspect-ratio index) sorted ascending; curves of the ratio named; the ratio-1
#   curves are zero (DATCOM step 3, p. 4.1.4.3-4), the 24b "1.0" label sits on the zero line.
P4143 = json.loads(Path(__file__).with_name("datcom-4143-passes.json").read_text())["figures"]


def q2(fig, curve):
    return sorted([[round(x, 4), round(v, 4)] for x, v in P4143[fig]["curves"][curve]["pass2"]])


def qu(fig, curve, floor):
    return round(max(floor, P4143[fig]["curves"][curve]["worst_disagreement"]), 4)


doc["charts"]["4.1.4.3-21a"] = {"page": 221, "quantity": "(x_cp/c_r)_1 vs Delta y; drawn from 0.157", "points": q2("4.1.4.3-21a", "single"), "uncertainty": qu("4.1.4.3-21a", "single", 0.01)}
doc["charts"]["4.1.4.3-21b"] = {"page": 221, "quantity": "C3 vs taper ratio", "points": q2("4.1.4.3-21b", "single"), "uncertainty": qu("4.1.4.3-21b", "single", 0.01)}
a1, a2, a25, a4, a6 = (q2("4.1.4.3-22a", c) for c in ("A=1", "A=2", "A=2.5", "A=4", "A=6"))
a1 = a1 + [p for p in a2 if p[0] > a1[-1][0]]
a6 = [p for p in a4 if p[0] < a6[0][0]] + a6
doc["charts"]["4.1.4.3-22a"] = {"page": 222, "quantity": "Delta(x_cp/c_r)_2 vs (C3 + 1) A tan(Lambda_LE), curves of A",
    "curves": {"1": {"points": a1, "uncertainty": qu("4.1.4.3-22a", "A=1", 0.01)}, "2": {"points": a2, "uncertainty": qu("4.1.4.3-22a", "A=2", 0.01)},
               "2.5": {"points": a25, "uncertainty": qu("4.1.4.3-22a", "A=2.5", 0.01)}, "4": {"points": a4, "uncertainty": qu("4.1.4.3-22a", "A=4", 0.01)},
               "6": {"points": a6, "uncertainty": qu("4.1.4.3-22a", "A=6", 0.01)}}}
doc["charts"]["4.1.4.3-22b"] = {"page": 222, "quantity": "stability index vs taper ratio, lines of A tan(Lambda_LE)",
    "curves": {str(k): {"points": q2("4.1.4.3-22b", f"A tan LE = {k}"), "uncertainty": qu("4.1.4.3-22b", f"A tan LE = {k}", 0.02)} for k in range(10)}}
for fig, key, page, labels in (("4.1.4.3-23a", "tan a/tan a_CLmax", 223, (".2", ".3", ".4", ".6", ".8")),
                               ("4.1.4.3-23b", "tan a_CLmax/tan a", 223, (".6", ".8"))):
    doc["charts"][fig] = {"page": page, "quantity": f"Delta(x_cp/c_r)_3 vs stability index, curves of {key}",
        "curves": {"0" + l: {"points": q2(fig, f"{key} = {l}"), "uncertainty": qu(fig, f"{key} = {l}", 0.01)} for l in labels}}
doc["charts"]["4.1.4.3-24a"] = {"page": 224, "quantity": "aspect-ratio index vs taper ratio, curves of A cos(Lambda_LE)",
    "curves": {k: {"points": q2("4.1.4.3-24a", f"A cos LE = {k}"), "uncertainty": qu("4.1.4.3-24a", f"A cos LE = {k}", 0.01)}
               for k in (".25", ".50", "1", "1.5", "2", "3", "4", "5", "6")}}
for fig, key, labels in (("4.1.4.3-24b-pre", "tan a/tan a_CLmax", (".2", ".3", ".4", ".6", ".8")),
                         ("4.1.4.3-24b-post", "tan a_CLmax/tan a", (".6", ".8"))):
    doc["charts"][fig] = {"page": 224, "quantity": f"Delta(x_cp/c_r)_4 vs aspect-ratio index, curves of {key}",
        "curves": {"0" + l: {"points": q2("4.1.4.3-24b", f"{key} = {l}"), "uncertainty": qu("4.1.4.3-24b", f"{key} = {l}", 0.01)} for l in labels}}

Path(__file__).with_name("datcom-large-angle-charts.json").write_text(json.dumps(doc, indent=1) + "\n")
for k, v in doc["charts"].items():
    if "curves" in v:
        print(k, {j: c.get("worst_disagreement", c["uncertainty"]) for j, c in v["curves"].items()})
    elif "left" in v:
        print(k, {s: {j: c.get("worst_disagreement", c["uncertainty"]) for j, c in v[s].items()} for s in ("left", "right")})
    else:
        print(k, v.get("worst_disagreement", v["uncertainty"]))
