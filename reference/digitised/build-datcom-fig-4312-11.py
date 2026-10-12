#!/usr/bin/env python3
"""Build datcom-figure-4-3-1-2-11.json: two digitising passes of USAF DATCOM (1978) figures 4.3.1.2-11a "Lift on
body in presence of wing, with afterbody, fixed wing incidence, supersonic speeds" and 4.3.1.2-11b "... no
afterbody ...", METHOD 1 (scan p. 1046 = page 126 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf,
rendered at 300 dpi). Ordinate: K_B(W) [beta (C_L_alpha)_e (lambda_e + 1) (b/d - 1)], with (C_L_alpha)_e per radian;
abscissa beta d / c_r_e; curves of beta cot(Lambda_LE). Section 4.3.1.2 C (scan p. 1041, page 4.3.1.2-6) says to use
these charts for nontriangular planforms when beta A_e (1 + lambda_e)(tan(Lambda_LE)/beta + 1) > 4, and figure
4.3.1.2-10 (slender-body theory) otherwise.

Page-pixel calibration (measured on the gridlines of the render):
  11a: x = 954 + 340 v, value = (1474 - y) / 136       (v = beta d / c_r_e; gridlines 0 and 7)
  11b: x = 955 + 339.75 v, value = (2679.5 - y) / 134.9

Both passes of figure 11a are pixel extractions at different column sets (ordered dark runs in a +-6 px window,
bare gridlines removed, clusters sorted top to bottom and assigned to the 18 curves in label order); legend text
and the curve labels (v = 0.45 to 0.6) were removed by hand as listed in DROP, and columns with a missing curve
list it in MISSING. Figure 11b's dashed curves defeat the column extraction below v = 0.9: pass 1 there is the
by-eye polyline of each curve read against the grid (POLY_B), pass 2 is the polyline snapped to the nearest drawn
line pixel by pixel and fitted over +-6 px (the curve labels sit at v = 0.5 to 0.57, so v = 0.5 is not used, and the
0.8 curve's v = 0.6 point fell on the 2.0 gridline and was rejected). Above v = 0.9 both 11b passes are column
extractions. Above v = 2.6 the 11b curves run together in the scan (spacing below the line width) and are not
digitised; the model does not use the chart there. Run with python3 -I from the repository root."""
import json
from pathlib import Path

CURVES_A = ["inf", "10", "7", "4", "3", "2", "1.6", "1.2", "1.0", "0.9", "0.8", "0.7", "0.6", "0.5", "0.4", "0.3",
            "0.2", "0.1"]
CURVES_B = ["inf", "4", "2", "1", "0.8", "0.6", "0.4", "0.2"]

# Figure 11a: page x of the column -> y pixel of each dark cluster, top to bottom.
PASS1_A = {
    1005: [533.1, 587.1, 611.3, 664.5, 704.0, 757.3, 804.2, 856.3, 900.7, 933.8, 963.3, 1006.7, 1062.9, 1107.5, 1162.0, 1232.4, 1298.8, 1388.2],
    1039: [576.5, 632.2, 657.7, 707.7, 745.8, 798.5, 844.0, 890.7, 933.1, 964.5, 995.1, 1035.5, 1087.9, 1133.2, 1184.8, 1251.2, 1316.7, 1401.1],
    1073: [613.8, 669.7, 696.2, 742.7, 787.1, 832.5, 876.2, 915.5, 962.0, 985.2, 1020.6, 1058.2, 1110.9, 1153.9, 1203.8, 1268.2, 1333.3, 1408.5],
    1175: [580.3, 694.6, 749.2, 775.1, 818.9, 854.9, 901.3, 944.3, 988.2, 1022.5, 1047.1, 1075.7, 1111.4, 1159.2, 1199.7, 1244.5, 1299.8, 1359.4, 1424.8],
    1209: [587.2, 717.8, 770.1, 794.2, 838.0, 873.0, 919.3, 962.6, 1005.6, 1039.0, 1064.9, 1092.1, 1127.4, 1171.5, 1210.3, 1254.3, 1308.4, 1365.8, 1428.9],
    1236: [729.5, 786.0, 806.9, 853.4, 885.1, 931.5, 975.0, 1016.6, 1051.0, 1071.2, 1103.0, 1135.8, 1180.5, 1219.5, 1260.5, 1314.0, 1369.0, 1430.3],
    1304: [765.4, 817.2, 838.9, 880.5, 913.4, 959.1, 1000.2, 1075.3, 1096.2, 1126.8, 1157.7, 1199.5, 1234.2, 1272.3, 1323.1, 1374.8, 1431.0],
    1372: [795.2, 844.6, 866.0, 905.3, 937.7, 981.0, 1022.3, 1064.9, 1096.0, 1115.5, 1144.0, 1174.2, 1210.0, 1245.5, 1282.7, 1330.2, 1338.7, 1379.0, 1432.5],
    1440: [821.7, 866.1, 927.7, 961.4, 1000.9, 1040.1, 1082.0, 1112.5, 1132.7, 1160.3, 1188.8, 1222.4, 1253.8, 1291.1, 1339.4, 1383.3, 1433.7],
    1498: [840.4, 884.5, 909.8, 942.5, 975.4, 1018.6, 1052.5, 1094.8, 1124.3, 1141.8, 1170.9, 1199.9, 1229.6, 1260.6, 1297.9, 1343.0, 1387.7, 1435.0],
    1634: [882.2, 923.7, 947.9, 977.0, 1007.2, 1049.3, 1078.8, 1121.8, 1148.8, 1166.2, 1195.8, 1217.5, 1246.5, 1274.5, 1312.5, 1355.4, 1396.2, 1436.0],
    1770: [915.8, 953.0, 974.5, 1005.0, 1032.4, 1070.9, 1102.0, 1139.8, 1166.7, 1185.8, 1209.4, 1233.3, 1261.0, 1287.8, 1325.7, 1365.3, 1403.6, 1438.3],
    1906: [613.3, 676.6, 739.8, 754.0, 817.0, 858.4, 942.7, 977.3, 998.5, 1031.0, 1055.3, 1094.3, 1122.9, 1158.6, 1183.5, 1203.4, 1224.3, 1247.1, 1274.2, 1303.4, 1338.4, 1373.0, 1407.5, 1441.2],
    2042: [609.8, 619.1, 628.5, 671.9, 756.4, 963.6, 999.9, 1021.6, 1054.3, 1074.6, 1114.8, 1139.2, 1175.9, 1200.7, 1217.9, 1237.3, 1260.7, 1289.6, 1313.6, 1349.3, 1378.4, 1409.9, 1444.1],
    2178: [613.6, 750.0, 978.7, 1020.6, 1040.0, 1074.2, 1096.2, 1134.2, 1155.7, 1190.8, 1213.1, 1230.9, 1247.6, 1273.1, 1301.6, 1324.6, 1359.2, 1383.5, 1415.8, 1446.6],
    2280: [988.2, 1033.6, 1052.7, 1089.1, 1109.9, 1147.1, 1165.0, 1202.3, 1223.1, 1237.7, 1254.2, 1279.3, 1308.7, 1331.0, 1365.3, 1386.9, 1418.9, 1447.4],
}
PASS2_A = {
    1022: [548.5, 601.4, 629.6, 681.1, 720.6, 773.4, 819.8, 913.4, 945.2, 974.4, 1018.9, 1070.5, 1117.2, 1171.9, 1240.9, 1307.1, 1393.2],
    1056: [595.1, 655.8, 683.8, 727.0, 763.8, 817.7, 861.0, 907.2, 948.3, 977.5, 1007.0, 1047.8, 1100.2, 1142.1, 1196.1, 1259.7, 1324.5, 1405.5],
    1090: [624.2, 680.7, 706.2, 752.8, 792.0, 843.9, 884.5, 929.9, 969.3, 998.9, 1030.6, 1067.5, 1118.5, 1160.6, 1207.0, 1271.9, 1335.9, 1409.1],
    1192: [588.0, 705.9, 760.3, 783.6, 829.2, 860.1, 910.5, 953.8, 993.9, 1031.5, 1052.9, 1084.2, 1120.0, 1165.6, 1204.8, 1250.0, 1304.5, 1362.7, 1427.1],
    1226: [725.7, 779.1, 800.1, 847.1, 861.5, 879.9, 927.4, 970.2, 1012.0, 1046.1, 1068.2, 1099.0, 1133.5, 1177.1, 1216.2, 1258.8, 1311.8, 1368.2, 1429.8],
    1362: [791.5, 839.7, 862.0, 900.6, 933.3, 977.3, 1018.5, 1062.5, 1092.8, 1112.2, 1140.5, 1171.6, 1207.3, 1243.6, 1281.3, 1329.0, 1338.5, 1378.2, 1431.9],
    1515: [845.9, 889.5, 915.7, 947.0, 979.7, 1023.4, 1056.2, 1097.7, 1128.7, 1146.0, 1173.7, 1201.0, 1231.5, 1262.0, 1299.4, 1343.1, 1388.5, 1434.4],
    1651: [886.6, 928.2, 951.5, 980.6, 1011.4, 1052.6, 1082.8, 1124.2, 1151.5, 1169.1, 1197.2, 1220.0, 1248.5, 1275.5, 1314.6, 1357.0, 1397.8, 1436.9],
    1787: [919.5, 955.9, 977.3, 1009.1, 1034.8, 1074.9, 1104.5, 1143.1, 1168.6, 1188.1, 1212.4, 1234.8, 1262.7, 1289.2, 1327.3, 1366.4, 1403.5, 1438.2],
    1923: [611.8, 628.3, 677.2, 732.5, 756.2, 812.0, 847.5, 946.1, 980.5, 1001.3, 1033.7, 1057.8, 1096.7, 1125.4, 1160.8, 1185.9, 1205.1, 1226.0, 1248.8, 1274.7, 1304.7, 1339.5, 1373.5, 1407.5, 1441.5],
    2059: [610.8, 628.0, 646.5, 658.1, 707.2, 755.3, 849.3, 867.0, 965.7, 1002.0, 1023.3, 1056.9, 1079.2, 1117.5, 1141.3, 1178.3, 1202.0, 1219.9, 1238.9, 1262.6, 1291.6, 1315.8, 1351.1, 1379.6, 1410.4, 1444.8],
    2195: [725.3, 980.0, 1022.6, 1041.6, 1077.6, 1098.2, 1135.7, 1156.6, 1192.3, 1214.6, 1232.1, 1248.3, 1273.2, 1302.4, 1325.1, 1360.0, 1383.5, 1416.1, 1446.5],
    2263: [986.7, 1031.5, 1050.7, 1086.8, 1107.7, 1144.8, 1163.7, 1201.4, 1221.2, 1236.6, 1253.0, 1276.2, 1307.7, 1329.8, 1364.3, 1386.5, 1418.4, 1447.3],
}
# Indices removed before assignment: legend and label text ("beta cot Lambda_LE", "WITH AFTERBODY ... METHOD 1"),
# and one spurious cluster where a dash end sits next to the 0.3 curve (1372, 1362) or a label (1226).
DROP_A = {1175: [0], 1209: [0], 1372: [16], 1906: [0, 1, 2, 3, 4, 5], 2042: [0, 1, 2, 3, 4], 2178: [0, 1],
          1192: [0], 1226: [4], 1362: [16], 1923: [0, 1, 2, 3, 4, 5, 6], 2059: [0, 1, 2, 3, 4, 5, 6, 7], 2195: [0]}
# Curves not found in a column (gap of twice the neighbouring spacing at the expected place).
MISSING_A = {1304: ["1.2"], 1440: ["7"], 1022: ["1.2"]}

# Figure 11b below v = 0.9: pass 1 by-eye polylines (page px), pass 2 snapped and fitted y at V_LOW_B.
POLY_B = {
    "inf": [[1025, 1845], [1090, 2000], [1160, 2140], [1230, 2250], [1265, 2296]],
    "4": [[1025, 1970], [1090, 2120], [1115, 2170], [1150, 2220], [1230, 2320], [1265, 2358]],
    "2": [[1025, 2060], [1090, 2200], [1160, 2280], [1265, 2400]],
    "1": [[1025, 2185], [1080, 2280], [1150, 2370], [1265, 2459]],
    "0.8": [[1025, 2260], [1090, 2360], [1180, 2440], [1265, 2505]],
    "0.6": [[1025, 2325], [1100, 2410], [1160, 2470], [1265, 2526]],
    "0.4": [[1025, 2430], [1100, 2490], [1160, 2525], [1265, 2569]],
    "0.2": [[1025, 2545], [1110, 2585], [1200, 2615], [1265, 2626]],
}
V_LOW_B = [0.25, 0.3, 0.35, 0.4, 0.45, 0.6, 0.65, 0.7, 0.8]
SNAP_B = {
    "inf": [1883.2, 1934.2, None, None, 2049.0, None, 2172.7, 2201.2, 2250.4],
    "4": [2006.2, 2044.6, 2079.8, 2121.2, 2149.6, 2232.8, 2256.2, 2277.2, 2313.3],
    "2": [2091.5, 2128.7, 2157.5, 2194.7, 2211.8, 2281.9, 2308.2, 2328.6, 2367.4],
    "1": [2217.0, 2250.6, 2276.8, 2294.7, None, 2380.2, 2395.9, 2411.1, 2435.8],
    "0.8": [2287.9, 2317.5, 2344.4, 2367.2, 2383.4, None, None, 2462.8, 2482.8],
    "0.6": [2350.5, None, None, 2395.1, 2412.7, 2471.2, 2479.6, 2489.2, None],
    "0.4": [2446.6, 2463.2, 2477.6, 2487.8, 2499.3, 2527.1, 2539.7, 2544.6, 2557.6],
    "0.2": [2557.4, 2566.1, 2574.3, 2582.0, 2587.1, 2603.2, None, 2612.1, 2617.2],
}
# Figure 11b from v = 0.9: column extractions (the axis line at y ~ 2680 and legend text removed).
PASS1_B = {
    1362: [2380.5, 2428.3, 2460.6, 2504.3, 2541.8, 2555.3, 2591.0, 2637.2],
    1498: [2453.6, 2485.5, 2514.3, 2544.1, 2569.2, 2586.3, 2611.3, 2646.3],
    1634: [2499.6, 2525.4, 2550.1, 2569.5, 2590.3, 2611.8, 2625.3, 2653.1],
    1770: [2529.0, 2547.9, 2569.4, 2587.0, 2606.9, 2622.1, 2635.9, 2656.2],
    # by eye at x = 1845 (v = 2.62) on a 2.5x strip
    1845: [2544.8, 2561.0, 2578.0, 2599.0, 2613.0, 2626.0, 2640.0, 2658.0],
}
PASS2_B = {
    1261: [2292.3, 2354.6, 2396.0, 2456.1, 2502.3, 2524.7, 2568.2, 2625.1, 2679.9],
    1329: [2357.6, 2408.9, 2442.9, 2492.0, 2530.9, 2548.8, 2585.5, 2634.4, 2679.7],
    1397: [2406.0, 2448.0, 2478.3, 2517.5, 2549.2, 2567.3, 2596.4, 2639.5, 2679.8],
    1465: [2440.0, 2476.7, 2503.1, 2535.5, 2563.6, 2582.8, 2607.8, 2679.9],
    1533: [2466.2, 2497.7, 2524.8, 2549.3, 2575.1, 2594.1, 2613.5, 2648.0, 2679.5],
    1601: [2489.7, 2516.9, 2543.2, 2563.0, 2583.6, 2606.6, 2621.0, 2678.5],
    1669: [2508.8, 2532.8, 2556.7, 2574.7, 2595.3, 2613.5, 2629.5, 2654.1, 2680.1],
    1737: [2523.1, 2545.0, 2565.8, 2583.5, 2602.8, 2620.1, 2634.1, 2680.0],
    1805: [1936.5, 2535.6, 2550.2, 2574.2, 2591.2, 2609.9, 2622.2, 2638.6, 2657.7, 2679.4],
    1873: [2547.5, 2563.7, 2582.7, 2600.8, 2615.5, 2627.5, 2642.3, 2659.5, 2679.4],
}
DROP_B = {1261: [8], 1329: [8], 1397: [8], 1465: [7], 1533: [8], 1601: [7], 1669: [8], 1737: [7], 1805: [0, 9],
          1873: [8]}
MISSING_B = {1465: ["0.2"], 1601: ["0.2"], 1737: ["0.2"]}

GRID_A = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.4, 2.8, 3.2, 3.6, 3.85]
GRID_B = [0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6]


def va(y):
    return (1474 - y) / 136


def vb(y):
    return (2679.5 - y) / 134.9


def assign(columns, drop, missing, names, to_v, to_value):
    """Per curve: sorted list of (v, value)."""
    out = {n: [] for n in names}
    for x, ys in columns.items():
        ys = [y for i, y in enumerate(ys) if i not in drop.get(x, [])]
        present = [n for n in names if n not in missing.get(x, [])]
        if len(ys) != len(present):
            raise SystemExit(f"column {x}: {len(ys)} clusters for {len(present)} curves")
        for n, y in zip(present, ys):
            out[n].append((to_v(x), to_value(y)))
    return {n: sorted(p) for n, p in out.items()}


def interp(points, v):
    if not points or v < points[0][0] - 1e-9 or v > points[-1][0] + 1e-9:
        return None
    for (v0, f0), (v1, f1) in zip(points, points[1:]):
        if v0 - 1e-9 <= v <= v1 + 1e-9:
            return f0 + (f1 - f0) * (v - v0) / (v1 - v0) if v1 > v0 else f0
    return points[-1][1] if abs(v - points[-1][0]) < 1e-9 else None


def poly_y(pts, x):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    raise ValueError(x)


def chart(p1, p2, names, grid):
    curves = {}
    for n in names:
        rows = []
        worst = 0.0
        for v in grid:
            a, b = interp(p1[n], v), interp(p2[n], v)
            if a is None and b is None:
                raise SystemExit(f"curve {n} has no reading at v = {v}")
            if a is None or b is None:
                value = a if b is None else b
                d = None
            else:
                value = (a + b) / 2
                d = abs(a - b)
                worst = max(worst, d)
            rows.append({"v": v, "pass1": None if a is None else round(a, 3), "pass2": None if b is None else round(b, 3),
                         "value": round(value, 3), "disagreement": None if d is None else round(d, 3)})
        curves[n] = {"beta_cot_le": None if n == "inf" else float(n), "worst_disagreement": round(worst, 3),
                     "uncertainty": round(max(0.05, worst / 2), 3), "rows": rows,
                     "points": [[r["v"], r["value"]] for r in rows]}
    return curves


a1 = assign(PASS1_A, DROP_A, MISSING_A, CURVES_A, lambda x: (x - 954) / 340, va)
a2 = assign(PASS2_A, DROP_A, MISSING_A, CURVES_A, lambda x: (x - 954) / 340, va)
fig_a = chart(a1, a2, CURVES_A, GRID_A)

b1 = assign(PASS1_B, {}, {}, CURVES_B, lambda x: (x - 955) / 339.75, vb)
b2 = assign(PASS2_B, DROP_B, MISSING_B, CURVES_B, lambda x: (x - 955) / 339.75, vb)
for n in CURVES_B:
    low1 = [(v, vb(poly_y(POLY_B[n], 955 + 339.75 * v))) for v in V_LOW_B + [0.9]]
    low2 = [(v, vb(y)) for v, y in zip(V_LOW_B, SNAP_B[n]) if y is not None]
    b1[n] = sorted(low1 + b1[n])
    b2[n] = sorted(low2 + b2[n])
fig_b = chart(b1, b2, CURVES_B, GRID_B)

doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figures 4.3.1.2-11a (with afterbody) and 4.3.1.2-11b (no afterbody), METHOD 1, section 4.3.1.2 C; scan p. 1046 = page 126 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf. Applicability: section 4.3.1.2 C, scan p. 1041 (page 4.3.1.2-6).",
    "quantity": "K_B(W) [beta (C_L_alpha)_e (lambda_e + 1) (b/d - 1)] with (C_L_alpha)_e per radian, against v = beta d / c_r_e, for curves of beta cot(Lambda_LE) ('inf' = unswept leading edge)",
    "method": {
        "calibration": "11a: x = 954 + 340 v, value = (1474 - y)/136; 11b: x = 955 + 339.75 v, value = (2679.5 - y)/134.9 (page pixels of the 300 dpi render)",
        "figure_11a": "pass 1 and pass 2 are ordered-dark-run extractions at two different column sets; labels, legend and spurious clusters removed by hand (DROP_A), missing curves listed (MISSING_A); each pass interpolated linearly in v onto the grid; the curve labels between v = 0.45 and 0.6 leave no reading there, so both passes interpolate across that span",
        "figure_11b": "below v = 0.9: pass 1 by-eye polylines, pass 2 polylines snapped to the drawn line; from v = 0.9: two column extractions (pass 1 at v = 1.2, 1.6, 2.0, 2.4 plus a by-eye column at v = 2.62; pass 2 every 0.2 from 0.9 to 2.7)",
        "value": "mean of the passes where both read; uncertainty per curve = max(0.05, half the worst disagreement), in ordinate units",
        "domain": "11a: v = 0.2 to 3.85. 11b: v = 0.25 to 2.6; the 11b curves start at v = 0.2 and run together above v = 2.7 in the scan",
    },
    "figure_11a": {"afterbody": True, "curves": fig_a},
    "figure_11b": {"afterbody": False, "curves": fig_b},
}
Path(__file__).with_name("datcom-figure-4-3-1-2-11.json").write_text(json.dumps(doc, indent=2) + "\n")
for key, fig in (("11a", fig_a), ("11b", fig_b)):
    print(key, {n: (c["worst_disagreement"], c["uncertainty"]) for n, c in fig.items()})
