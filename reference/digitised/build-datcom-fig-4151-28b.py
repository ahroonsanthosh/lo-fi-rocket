#!/usr/bin/env python3
"""Build datcom-figure-4-1-5-1-28b.json: USAF DATCOM (1978) figure 4.1.5.1-28b "Lifting-surface correlation factor
for subsonic minimum drag", R_LS against cos(Lambda_(t/c)max) for Mach <= 0.25, 0.6, 0.8 and 0.9 (page 255 of
reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf, rendered at 300 dpi). Method: section 4.1.5.1 A,
eq. 4.1.5.1-a (p. 4.1.5.1-1); used in eq. 4.3.3.1-a for a wing-body (plan 0081).

Only the solid curves are read; the DATCOM uses the dashed ones for the inboard panels of non-straight-tapered wings
below cos 0.65, which a rocket's fin set is not.

Calibration (gridlines of the render): cos = 0.40 at x 718 to 1.00 at x 1987, every 0.05 (13 lines, interpolated
piecewise); R_LS = 1.4 at y 1725 to 0.6 at y 2578.5, every 0.1 (9 lines, piecewise). Pass 2: ordered dark runs in
columns every 0.00625 in cos, the horizontal gridlines masked; a column is kept when exactly four runs remain after the
dashed lines (1.2, 1.11, 1.0 and 0.92 between cos 0.45 and 0.65 or 0.8) are removed, the label zone (cos 0.775 to
0.845) is filled by prediction from the accepted neighbours within 5 px, and points more than 4 px off their
neighbours' line are dropped. Below the first traced column (0.519 for M 0.9, 0.55 for M 0.6) the value is
extrapolated linearly; pass 1 confirms it. Values here are pass 2 resampled every 0.025 in cos. Pass 1: by eye at
cos 0.5 to 1.0 on a 110 dpi render. Run with python3 -I."""
import json
from pathlib import Path

COS = [round(0.5 + 0.025 * i, 3) for i in range(21)]
PASS2 = {
    "0.25": [0.8131, 0.8299, 0.8523, 0.8678, 0.8888, 0.906, 0.9267, 0.9438, 0.9648, 0.9814, 0.9997, 1.0144, 1.0288,
             1.0389, 1.0493, 1.0558, 1.0614, 1.0619, 1.0642, 1.067, 1.067],
    "0.6": [0.8852, 0.9038, 0.9224, 0.941, 0.9638, 0.9814, 1.0056, 1.0209, 1.0437, 1.0614, 1.0809, 1.0935, 1.108,
            1.1197, 1.13, 1.1371, 1.1427, 1.1437, 1.1455, 1.1484, 1.1484],
    "0.8": [0.9972, 1.0205, 1.0393, 1.0581, 1.0772, 1.0935, 1.1136, 1.1305, 1.1512, 1.1653, 1.1845, 1.198, 1.2136,
            1.2244, 1.2347, 1.2418, 1.2479, 1.2516, 1.2545, 1.2573, 1.2573],
    "0.9": [1.093, 1.1127, 1.1338, 1.1493, 1.17, 1.185, 1.2061, 1.2211, 1.2408, 1.2549, 1.2742, 1.2873, 1.3022,
            1.3168, 1.329, 1.3364, 1.3444, 1.35, 1.3547, 1.3575, 1.3575],
}
# Pass 1, by eye at cos 0.5, 0.6, 0.7, 0.8, 0.9, 1.0.
PASS1_COS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
PASS1 = {
    "0.25": [0.81, 0.885, 0.965, 1.03, 1.06, 1.07],
    "0.6": [0.88, 0.96, 1.04, 1.105, 1.14, 1.15],
    "0.8": [1.00, 1.075, 1.15, 1.21, 1.245, 1.26],
    "0.9": [1.10, 1.165, 1.24, 1.30, 1.34, 1.36],
}
# The DATCOM's own readings of this figure in its sample problems: (Mach, cos, R_LS, where).
SAMPLES = [
    (0.13, 0.6639, 0.934, "p. 4.1.5.1-3, inboard panel (M <= 0.25 curve)"),
    (0.13, 0.9505, 1.067, "p. 4.1.5.1-3, outboard panel"),
    (0.70, 0.8572, 1.180, "p. 4.3.3.1-5, outboard panel"),
    (0.4, 0.6521, 0.960, "p. 4.5.3.1-5, wing"),
    (0.6, 0.6521, 1.002, "p. 4.5.3.1-5, wing"),
    (0.7, 0.6521, 1.058, "p. 4.5.3.1-5, wing"),
    (0.4, 1.0, 1.105, "p. 4.5.3.1-5, horizontal tail"),
    (0.6, 1.0, 1.150, "p. 4.5.3.1-5, horizontal tail"),
    (0.7, 1.0, 1.205, "p. 4.5.3.1-5, horizontal tail"),
    (0.4, 0.7034, 1.000, "p. 4.5.3.1-5, vertical tail"),
    (0.6, 0.7034, 1.044, "p. 4.5.3.1-5, vertical tail"),
    (0.7, 0.7034, 1.098, "p. 4.5.3.1-5, vertical tail"),
]


def interp(xs, ys, x):
    for x0, x1, y0, y1 in zip(xs, xs[1:], ys, ys[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return ys[-1] if x >= xs[-1] else ys[0]


def rls(mach, cos):
    machs = [0.25, 0.6, 0.8, 0.9]
    m = min(max(mach, 0.25), 0.9)
    for m0, m1 in zip(machs, machs[1:]):
        if m0 <= m <= m1:
            a, b = interp(COS, PASS2[str(m0)], cos), interp(COS, PASS2[str(m1)], cos)
            return a + (b - a) * (m - m0) / (m1 - m0)
    raise ValueError(mach)


curves = {}
for name, ys in PASS2.items():
    checks = [{"cos": c, "pass1": p1, "pass2": round(interp(COS, ys, c), 4),
               "disagreement": round(abs(p1 - interp(COS, ys, c)), 4)} for c, p1 in zip(PASS1_COS, PASS1[name])]
    curves[name] = {"values": ys, "checks": checks, "worst_disagreement": max(c["disagreement"] for c in checks)}
samples = [{"mach": m, "cos": c, "datcom": v, "table": round(rls(m, c), 4), "difference": round(rls(m, c) - v, 4),
            "where": w} for m, c, v, w in SAMPLES]
doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.1.5.1-28b, page 255 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf; method section 4.1.5.1 A, eq. 4.1.5.1-a, and eq. 4.3.3.1-a.",
    "quantity": "R_LS, the lifting-surface correlation factor for subsonic minimum drag, against cos(Lambda_(t/c)max); solid curves for Mach <= 0.25, 0.6, 0.8, 0.9",
    "cos": COS,
    "curves": curves,
    "samples": samples,
    "worst_sample_difference": max(abs(s["difference"]) for s in samples),
}
Path(__file__).with_name("datcom-figure-4-1-5-1-28b.json").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps({"worst_pass_disagreement": max(c["worst_disagreement"] for c in curves.values()),
                  "worst_sample_difference": doc["worst_sample_difference"]}))
