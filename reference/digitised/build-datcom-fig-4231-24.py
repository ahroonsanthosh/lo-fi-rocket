#!/usr/bin/env python3
"""Build datcom-figure-4-2-3-1-24.json: USAF DATCOM (1978) figure 4.2.3.1-24 "Transonic fairing for base-pressure
coefficient" (page 42 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf, scan p. 962, rendered at
300 dpi). Ordinate C_D_b/(d_b/d)^2, the base drag on the base area; abscissa Mach number 0.75 to 1.3; six guide
curves, used (section 4.2.3.1 B step 3, p. 4.2.3.1-4) to carry the subsonic base drag at Mach 0.6 (eq. 4.2.3.1-b)
through the transonic range.

Calibration (gridlines of the render): M = 0.7 + (x - 581)/2127, value = (1742 - y)/2122 (0 at y = 1742, 0.05 per
106.1 px). Pass 2: ordered dark runs at columns between the vertical gridlines (M = 0.76, 0.7875, ..., 1.295),
gridline and zero-axis runs removed, the axis labels ("1.1", "1.2", "1.3", "MACH NUMBER", at -0.02 to -0.045 above
M = 1.08) removed by hand. The fourth curve lies on the -0.05 gridline from M = 0.76 to 0.89 and is taken there at
the gridline value read where it leaves it (-0.0511). Pass 1: by-eye values at the gridlines. Run with python3 -I."""
import json
from pathlib import Path

M = [0.76, 0.7875, 0.8125, 0.8375, 0.8625, 0.8875, 0.9125, 0.9375, 0.9625, 0.9875, 1.0125, 1.025, 1.0375, 1.0625,
     1.0875, 1.1125, 1.1375, 1.1625, 1.1875, 1.2125, 1.2375, 1.2625, 1.2875, 1.295]
PASS2 = {
    "c1": [0.1225, 0.1239, 0.1249, 0.1273, 0.13, 0.1337, 0.1411, 0.1497, 0.1639, 0.1878, 0.2198, 0.2338, 0.2253,
           0.1843, 0.1412, 0.116, 0.1038, 0.1, 0.1001, 0.1001, None, 0.1006, 0.1006, 0.1006],
    "c2": [0.065, 0.0665, 0.0679, 0.07, 0.0724, 0.0746, 0.0789, 0.0864, 0.1003, 0.1276, 0.1489, 0.1287, 0.1023,
           0.073, 0.0588, 0.0504, 0.0471, 0.0443, 0.0439, 0.0452, 0.0476, 0.0479, None, None],
    "c3": [0.0099, 0.0107, 0.0116, 0.0132, 0.0142, 0.0159, 0.0198, 0.0263, 0.0373, 0.0595, 0.0451, 0.0237, 0.0105,
           -0.0058, -0.0096, -0.0076, -0.0066, -0.0052, -0.0038, -0.0035, None, None, None, -0.0048],
    "c4": [-0.0511, -0.0511, -0.0511, -0.0511, -0.0511, -0.0511, -0.0488, -0.0432, -0.0345, -0.02, -0.0224, -0.0367,
           -0.0493, -0.0656, -0.0721, -0.0705, -0.0683, -0.0653, -0.0619, -0.0588, -0.0548, -0.0515, -0.0486, -0.0473],
    "c5": [-0.1205, -0.1191, -0.119, -0.1184, -0.1193, -0.1209, -0.124, -0.1303, -0.1415, -0.1598, -0.1875, -0.2001,
           -0.2075, -0.2124, -0.2057, -0.2005, -0.1982, -0.1958, -0.1933, -0.1918, -0.1907, -0.19, -0.1897, -0.1894],
    "c6": [-0.1886, -0.1861, -0.1847, -0.1838, -0.184, -0.186, -0.19, -0.2003, -0.217, -0.2418, -0.2606, -0.2661,
           -0.2685, -0.2649, -0.2568, -0.2504, -0.2486, None, -0.246, -0.2436, -0.2415, -0.2401, -0.2387, -0.2381],
}
# Pass 1 by eye at the gridlines M = 0.8, 0.9, 1.0, 1.1, 1.2, 1.3.
PASS1 = {
    "c1": [0.125, 0.135, 0.20, 0.12, 0.10, 0.10],
    "c2": [0.067, 0.075, 0.14, 0.055, 0.045, 0.05],
    "c3": [0.011, 0.017, 0.065, -0.01, -0.003, -0.005],
    "c4": [-0.05, -0.05, -0.012, -0.072, -0.06, -0.047],
    "c5": [-0.12, -0.12, -0.17, -0.20, -0.192, -0.19],
    "c6": [-0.185, -0.19, -0.25, -0.255, -0.243, -0.238],
}


def interp(pts, x):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1] if x >= pts[-1][0] else pts[0][1]


curves = {}
for name, ys in PASS2.items():
    pts = [[m, y] for m, y in zip(M, ys) if y is not None]
    checks = [{"mach": m, "pass1": p1, "pass2": round(interp(pts, m), 4), "disagreement": round(abs(p1 - interp(pts, m)), 4)}
              for m, p1 in zip([0.8, 0.9, 1.0, 1.1, 1.2, 1.3], PASS1[name])]
    curves[name] = {"start": pts[0][1], "points": pts, "checks": checks,
                    "worst_disagreement": max(c["disagreement"] for c in checks)}
doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.2.3.1-24, page 42 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf (scan p. 962); method section 4.2.3.1 B step 3 (p. 4.2.3.1-4) and sample problem p. 4.2.3.1-7.",
    "quantity": "C_D_b/(d_b/d)^2 (base drag on the base area) against Mach number, six guide curves named c1 (top) to c6 (bottom) by their value at Mach 0.76",
    "curves": curves,
}
Path(__file__).with_name("datcom-figure-4-2-3-1-24.json").write_text(json.dumps(doc, indent=2) + "\n")
for n, c in curves.items():
    print(n, c["start"], c["worst_disagreement"])
