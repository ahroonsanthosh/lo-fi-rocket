#!/usr/bin/env python3
"""Build datcom-figure-4-3-3-1-37.json: USAF DATCOM (1978) figure 4.3.3.1-37 "Wing-body interference correlation
factor - subsonic speeds", R_WB against the fuselage Reynolds number R_l,fus (on the body length) for Mach 0.25, 0.4,
0.6, 0.7, 0.8, 0.85 and 0.9 (page 244 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf, rendered at
300 dpi). Method: section 4.3.3.1 A, eq. 4.3.3.1-a (p. 4.3.3.1-1): R_WB multiplies the exposed wing friction and the
body friction (plan 0081). The text (p. 4.3.3.1-2): "the correlation does not include data below M = 0.25"; data
above R_l,fus 2.4e7 come from the basic method of its reference 2, correlated with flight tests. The curves begin at
R_l,fus 2.8e6 (log 6.45); above 1e8 the Mach 0.25 and 0.4 curves are dashed.

Calibration (the decade lines of the render): log10 R = 6, 7, 8, 9 at x 772, 1312.5, 1853, 2394.5; R_WB = 1.1 at
y 1376.5 and 0.8 at y 2191. The chart is printed on dense log paper, so pass 2 works on a cleaned image: pixels whose
5 x 5 neighbourhood is at least 92 % dark (the curves are 5 to 8 px thick, the gridlines 2 to 3 px). Each curve
segment is then fitted (weighted least squares, cubic in x, quadratic or straight where the segment is short or flat)
to the dark pixels within a window around the pass 1 reading, the window narrowing from 9 to 4 px over five rounds,
so the pixels, not the eye, set the values. Segments: every curve from log 6.45 to 7.45; Mach 0.6 to 0.9 through the
convergence from 7.4 to 7.78; Mach 0.4 from 7.35 to 7.65 and 7.62 to 8.0; Mach 0.25 from 7.5 to 8.0; the common
Mach 0.6 to 0.9 line from 7.82 to 8.8 (extended to 9.0); the dashed Mach 0.4 and 0.25 lines from 8.05 to 8.8 (held
to 9.0). Neighbouring segments agree within 0.005 where they meet. Pass 1: by eye on a 130 dpi render. Run with
python3 -I."""
import json
from pathlib import Path

LOG_RE = [6.45, 6.5, 6.6, 6.7, 6.8, 6.9, 7.0, 7.1, 7.2, 7.3, 7.4, 7.45, 7.5, 7.55, 7.6, 7.65, 7.7, 7.75, 7.8, 7.9, 8.0,
          8.5, 9.0]
PASS2 = {
    "0.25": [1.0653, 1.066, 1.0682, 1.0708, 1.0734, 1.0753, 1.0761, 1.0752, 1.0721, 1.0663, 1.0571, 1.0512, 1.0392,
             1.0228, 1.0065, 0.9908, 0.9759, 0.9622, 0.95, 0.9319, 0.9244, 0.9201, 0.9201],
    "0.4": [1.0221, 1.0215, 1.022, 1.0243, 1.0279, 1.0324, 1.0373, 1.042, 1.0462, 1.0492, 1.0507, 1.0504, 1.0418,
            1.0312, 1.0186, 1.0028, 0.9978, 0.9933, 0.9892, 0.9824, 0.9772, 0.9762, 0.9762],
    "0.6": [0.9815, 0.9815, 0.9826, 0.9851, 0.9884, 0.9922, 0.9957, 0.9987, 1.0006, 1.0009, 0.999, 0.9991, 1.0006,
            1.0023, 1.0043, 1.0064, 1.0089, 1.0115, 1.0126, 1.0124, 1.0122, 1.0112, 1.0102],
    "0.7": [0.9577, 0.9573, 0.958, 0.9603, 0.9638, 0.9682, 0.973, 0.978, 0.9827, 0.9868, 0.9898, 0.9911, 0.9949,
            0.9985, 1.0019, 1.0051, 1.0081, 1.0109, 1.0126, 1.0124, 1.0122, 1.0112, 1.0102],
    "0.8": [0.9258, 0.9264, 0.928, 0.9303, 0.9335, 0.9375, 0.9424, 0.9482, 0.9551, 0.963, 0.9721, 0.9815, 0.9865,
            0.9913, 0.996, 1.0006, 1.0051, 1.0095, 1.0126, 1.0124, 1.0122, 1.0112, 1.0102],
    "0.85": [0.9019, 0.9034, 0.906, 0.9086, 0.9114, 0.9148, 0.9192, 0.925, 0.9325, 0.9422, 0.9544, 0.9631, 0.9723,
             0.9809, 0.9887, 0.9959, 1.0025, 1.0083, 1.0126, 1.0124, 1.0122, 1.0112, 1.0102],
    "0.9": [0.8691, 0.8697, 0.871, 0.8729, 0.8758, 0.8801, 0.8863, 0.8948, 0.906, 0.9204, 0.9384, 0.9536, 0.9661,
            0.9773, 0.9871, 0.9955, 1.0027, 1.0084, 1.0126, 1.0124, 1.0122, 1.0112, 1.0102],
}
# Pass 1, by eye: [log10 R, R_WB].
PASS1 = {
    "0.25": [[6.45, 1.068], [7.0, 1.075], [7.3, 1.065], [7.5, 1.045], [7.75, 0.96], [7.9, 0.932], [8.5, 0.921]],
    "0.4": [[6.45, 1.02], [6.82, 1.028], [7.0, 1.04], [7.3, 1.045], [7.7, 0.995], [7.85, 0.982], [8.5, 0.976]],
    "0.6": [[6.45, 0.975], [6.82, 0.988], [7.0, 0.995], [7.3, 1.0], [8.5, 1.011]],
    "0.7": [[6.45, 0.955], [6.82, 0.963], [7.0, 0.97], [7.3, 0.985], [8.5, 1.011]],
    "0.8": [[6.45, 0.925], [7.0, 0.94], [7.3, 0.96], [8.5, 1.011]],
    "0.85": [[6.45, 0.9], [7.0, 0.92], [7.3, 0.945], [8.5, 1.011]],
    "0.9": [[6.45, 0.87], [7.0, 0.885], [7.3, 0.92], [8.5, 1.011]],
}
# The DATCOM's own readings of this figure: (Mach, R_l,fus, R_WB, where).
SAMPLES = [
    (0.70, 2.96e6, 0.955, "p. 4.3.3.1-6 (sample problem, M 0.70, R 2.96e6 on p. 4.3.3.1-4)"),
    (0.40, 6.68e6, 1.028, "p. 4.5.3.1-5"),
    (0.60, 6.68e6, 0.988, "p. 4.5.3.1-5"),
    (0.70, 6.68e6, 0.963, "p. 4.5.3.1-5"),
]
MACHS = [0.25, 0.4, 0.6, 0.7, 0.8, 0.85, 0.9]


def interp(xs, ys, x):
    for x0, x1, y0, y1 in zip(xs, xs[1:], ys, ys[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return ys[-1] if x >= xs[-1] else ys[0]


def rwb(mach, re):
    import math
    lr = math.log10(re)
    m = min(max(mach, 0.25), 0.9)
    for m0, m1 in zip(MACHS, MACHS[1:]):
        if m0 <= m <= m1:
            a, b = interp(LOG_RE, PASS2[str(m0)], lr), interp(LOG_RE, PASS2[str(m1)], lr)
            return a + (b - a) * (m - m0) / (m1 - m0)
    raise ValueError(mach)


curves = {}
for name, ys in PASS2.items():
    checks = [{"log10_re": x, "pass1": p1, "pass2": round(interp(LOG_RE, ys, x), 4),
               "disagreement": round(abs(p1 - interp(LOG_RE, ys, x)), 4)} for x, p1 in PASS1[name]]
    curves[name] = {"values": ys, "checks": checks, "worst_disagreement": max(c["disagreement"] for c in checks)}
samples = [{"mach": m, "reynolds": r, "datcom": v, "table": round(rwb(m, r), 4), "difference": round(rwb(m, r) - v, 4),
            "where": w} for m, r, v, w in SAMPLES]
doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.3.3.1-37, page 244 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf; method section 4.3.3.1 A, eq. 4.3.3.1-a (p. 4.3.3.1-1 and -2).",
    "quantity": "R_WB, the wing-body interference correlation factor (subsonic), against log10 of the fuselage Reynolds number on the body length, for Mach 0.25 to 0.9",
    "log10_re": LOG_RE,
    "curves": curves,
    "samples": samples,
    "worst_sample_difference": max(abs(s["difference"]) for s in samples),
}
Path(__file__).with_name("datcom-figure-4-3-3-1-37.json").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps({"worst_pass_disagreement": max(c["worst_disagreement"] for c in curves.values()),
                  "worst_sample_difference": doc["worst_sample_difference"]}))
