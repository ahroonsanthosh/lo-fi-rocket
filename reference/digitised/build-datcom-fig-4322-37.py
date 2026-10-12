#!/usr/bin/env python3
"""Build datcom-figure-4-3-2-2-37.json: USAF DATCOM (1978) figure 4.3.2.2-37 "Aerodynamic-center locations for lift
carryover of wing onto body at supersonic speeds when beta A_e (1 + lambda_e)(1 + 1/(beta cot Lambda_LE)) >= 4.0",
panels (a) with afterbody and (b) no afterbody (scan p. 1127 = page 207 of
reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf, rendered at 300 dpi). Ordinate (x'_ac / c_r_e)_B(W),
measured from the leading edge of the exposed root chord; abscissa beta d / c_r_e (0 to 2.8); curves of
beta cot(Lambda_LE): (a) inf, 1, 0.1 (they separate only above beta d / c_r_e = 1.6), (b) 0.2 and inf.

Only the most forward curve of each panel is digitised: 0.1 in (a), inf in (b). The model uses it for every
beta cot(Lambda_LE), which places the carry-over force at or ahead of the chart's value for the actual sweep and so
can only understate the stability margin (decision D-065). The forward and aft curves differ by at most 0.07 root
chords in (a) and 0.02 in (b).

Calibration (gridlines of the 300 dpi render): (a) x = 647 + 567.68 v, value = 0.4 + 1.6 (1351 - y)/917;
(b) x = 644 + 568.21 v, value = 0.5 + 0.2 (2425 - y)/456.
Pass 2 is the lowest dark run at two columns 5 or 6 px either side of each abscissa, taken as the bottom edge plus
half the 6 px line width, averaged over the two columns. Pass 1 is the by-eye reading of where the curve crosses
the printed gridlines (done before the pixel pass). Run with python3 -I from the repository root."""
import json
from pathlib import Path

PASS2 = {
    "a": [[0.0, 0.5], [0.1, 0.559], [0.2, 0.612], [0.3, 0.668], [0.4, 0.72], [0.5, 0.78], [0.6, 0.823],
          [0.7, 0.868], [0.8, 0.911], [0.9, 0.956], [1.0, 1.0], [1.1, 1.043], [1.2, 1.083], [1.3, 1.124],
          [1.4, 1.163], [1.5, 1.199], [1.6, 1.24], [1.7, 1.28], [1.8, 1.318], [1.9, 1.354], [2.0, 1.396],
          [2.2, 1.465], [2.4, 1.535], [2.6, 1.604], [2.8, 1.672]],
    "b": [[0.0, 0.5], [0.05, 0.526], [0.1, 0.543], [0.15, 0.56], [0.2, 0.575], [0.25, 0.59], [0.3, 0.6015],
          [0.35, 0.613], [0.4, 0.6225], [0.5, 0.6375], [0.6, 0.6485], [0.7, 0.655], [0.8, 0.6605], [0.9, 0.665],
          [1.0, 0.668], [1.2, 0.6686], [1.5, 0.6695], [2.0, 0.67], [2.5, 0.6713], [2.8, 0.672]],
}
# By-eye gridline crossings (v, value) of the same curve.
PASS1 = {
    "a": [[0.0, 0.5], [0.18, 0.6], [0.56, 0.8], [1.0, 1.0], [1.5, 1.2], [2.02, 1.4], [2.6, 1.6]],
    "b": [[0.0, 0.5], [0.12, 0.55], [0.3, 0.6], [0.62, 0.65], [1.0, 0.667], [2.8, 0.672]],
}


def interp(points, v):
    for (v0, f0), (v1, f1) in zip(points, points[1:]):
        if v0 <= v <= v1:
            return f0 + (f1 - f0) * (v - v0) / (v1 - v0)
    raise ValueError(v)


out = {}
for key in ("a", "b"):
    checks = [{"v": v, "pass1": f, "pass2": round(interp(PASS2[key], v), 4),
               "disagreement": round(abs(f - interp(PASS2[key], v)), 4)} for v, f in PASS1[key]]
    worst = max(c["disagreement"] for c in checks)
    out[key] = {"afterbody": key == "a", "curve": "0.1" if key == "a" else "inf", "points": PASS2[key],
                "checks": checks, "worst_disagreement": worst, "uncertainty": round(max(0.01, worst), 4)}

doc = {
    "source": "USAF Stability and Control DATCOM (1978 revision), figure 4.3.2.2-37 (a) with afterbody, (b) no afterbody; scan p. 1127 = page 207 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0921-1350.pdf; used by step 6 of the supersonic wing-body a.c. method, section 4.3.2.2 C (scan p. 1102, page 4.3.2.2-12).",
    "quantity": "(x'_ac / c_r_e)_B(W): a.c. of the wing-lift carry-over on the body aft of the exposed-root-chord leading edge, in exposed root chords, against beta d / c_r_e; valid for beta A_e (1 + lambda_e)(1 + 1/(beta cot Lambda_LE)) >= 4",
    "method": "pass 2 pixel extraction (bottom edge of the lowest curve plus half the line width), pass 1 by-eye gridline crossings; only the most forward curve of each panel (D-065)",
    "panels": out,
}
Path(__file__).with_name("datcom-figure-4-3-2-2-37.json").write_text(json.dumps(doc, indent=2) + "\n")
for k, p in out.items():
    print(k, p["worst_disagreement"], p["checks"])
