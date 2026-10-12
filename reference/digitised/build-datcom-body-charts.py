#!/usr/bin/env python3
"""Build datcom-body-charts.json: two digitising passes of the USAF DATCOM (1978) supersonic body charts
figure 4.2.1.1-21a/b (normal-force-curve slope of ogive-cylinders and cone-cylinders, scan p. 835 = page 341 of
reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf) and figure 4.2.2.1-23a/b (centre of pressure of
ogive- and cone-cylinders, scan p. 907 = page 413 of the same file). Abscissa u = beta/f_N on the left half
(u <= 1) and u = 2 - f_N/beta on the right half (1 < u <= 2), so the chart runs from u = 0.4 (beta/f_N = 0.4) to
u = 1.5 (f_N/beta = 0.5). Curves are labelled by f_A/f_N. Pass 1 was read by eye against the grid from the 300 dpi
renders; pass 2 is pixel coordinates from ruler-overlaid crops converted by the gridline calibrations below.
Run with python3 -I from the repository root; the TypeScript tables in packages/physics/src/stability/datcom-body.ts
are checked against the output by a formats test."""
import json
from pathlib import Path

PASS1 = json.loads("""{
 "21a_ogive_cna": {"0": [[0.4,2.5],[0.6,2.45],[0.8,2.35],[1.0,2.22],[1.2,2.0],[1.4,1.85],[1.5,1.8]],
   "0.4": [[0.4,2.8],[0.6,2.85],[0.8,2.78],[1.0,2.66],[1.2,2.5],[1.4,2.3],[1.5,2.22]],
   "0.8": [[0.4,2.8],[0.6,2.9],[0.8,2.95],[1.0,2.92],[1.2,2.8],[1.4,2.65],[1.5,2.6]],
   "1.2": [[0.4,2.8],[0.6,2.95],[0.8,3.05],[1.0,3.1],[1.2,3.05],[1.4,2.85],[1.5,2.75]],
   "2": [[0.4,2.85],[0.6,3.05],[0.8,3.2],[1.0,3.28],[1.2,3.25],[1.4,2.95],[1.5,2.8]],
   "3": [[0.4,2.9],[0.6,3.1],[0.8,3.3],[1.0,3.4],[1.1,3.4],[1.2,3.35],[1.4,3.05],[1.5,2.85]]},
 "21b_cone_cna": {"0": [[0.4,1.92],[0.6,1.85],[0.7,1.8],[0.8,1.8],[1.0,1.8],[1.2,1.8],[1.5,1.8]],
   "0.4": [[0.4,2.6],[0.6,2.5],[0.8,2.42],[1.0,2.35],[1.2,2.32],[1.5,2.32]],
   "0.8": [[0.4,2.75],[0.6,2.78],[0.8,2.8],[1.0,2.78],[1.2,2.72],[1.5,2.7]],
   "1.2": [[0.4,2.8],[0.6,2.95],[0.8,3.05],[1.0,3.08],[1.2,3.05],[1.5,3.0]],
   "2": [[0.4,2.85],[0.6,3.05],[0.8,3.2],[1.0,3.28],[1.2,3.3],[1.5,3.32]],
   "3": [[1.05,3.3],[1.2,3.35],[1.4,3.45],[1.5,3.5]]},
 "23a_ogive_xcp": {"0": [[0.4,0.54],[0.6,0.535],[0.8,0.53],[1.0,0.525],[1.2,0.52],[1.35,0.51]],
   "0.4": [[0.4,0.42],[0.6,0.43],[0.8,0.44],[1.0,0.445],[1.2,0.455],[1.35,0.46]],
   "0.8": [[0.4,0.35],[0.6,0.365],[0.8,0.385],[1.0,0.4],[1.2,0.415],[1.35,0.425]],
   "1.2": [[0.4,0.3],[0.6,0.32],[0.8,0.34],[1.0,0.36],[1.2,0.38],[1.35,0.4]],
   "1.6": [[0.4,0.245],[0.6,0.27],[0.8,0.295],[1.0,0.32],[1.2,0.345],[1.35,0.365]],
   "2": [[0.4,0.21],[0.6,0.24],[0.8,0.265],[1.0,0.29],[1.2,0.32],[1.35,0.34]]},
 "23b_cone_xcp": {"0": [[0.0,0.665],[0.4,0.665],[0.8,0.665],[1.0,0.665],[1.4,0.665],[1.45,0.665]],
   "0.5": [[0.15,0.48],[0.3,0.53],[0.4,0.55],[0.6,0.555],[0.8,0.555],[1.0,0.55],[1.2,0.545],[1.4,0.535],[1.45,0.53]],
   "1": [[0.2,0.37],[0.4,0.41],[0.6,0.44],[0.8,0.46],[1.0,0.47],[1.2,0.465],[1.4,0.45],[1.45,0.44]],
   "2": [[0.5,0.265],[0.7,0.3],[0.9,0.33],[1.0,0.345],[1.1,0.36],[1.2,0.375],[1.3,0.39],[1.4,0.4],[1.5,0.4]],
   "3": [[0.8,0.2],[1.0,0.23],[1.2,0.265],[1.4,0.3],[1.45,0.31]],
   "4": [[0.95,0.16],[1.1,0.19],[1.3,0.225],[1.45,0.25]]}}""")

# Pass 2 calibrations (crop pixel coordinates; crops of the 300 dpi renders with origins (700, 600), (700, 1800),
# (950, 580), (950, 1700) for 21a, 21b, 23a, 23b):
#   21a: u = (x - 38)/677 (u = 1 at the heavy line x = 715); C_N_alpha = 4 - (y - 35.5)/338 (4 at y 35.5, 2 at 711)
#   21b: u = (x - 38)/675.5 (u = 1 at 713.5); C_N_alpha = 4 - (y - 35)/344 (3 at 379, 2 at 723)
#   23a: u = (x - 37.5)/680 (1 at 717.5); x_cp/l_B = 0.6 - (y - 15.5)/1357.5 (0.6 at 15.5, 0 at 830)
#   23b: u = (x - 36.5)/678.5 (1 at 715); x_cp/l_B = 0.7 - (y - 18.5)/1351 (0.7 at 18.5, 0 at 964)
CAL = {
    "21a_ogive_cna": (38, 677, lambda y: 4 - (y - 35.5) / 338),
    "21b_cone_cna": (38, 675.5, lambda y: 4 - (y - 35) / 344),
    "23a_ogive_xcp": (37.5, 680, lambda y: 0.6 - (y - 15.5) / 1357.5),
    "23b_cone_xcp": (36.5, 678.5, lambda y: 0.7 - (y - 18.5) / 1351),
}
PASS2_PX = {
    "21a_ogive_cna": {
        "3": [(309, 430), (444, 350), (580, 290), (715, 250), (850, 260), (986, 360), (1053, 420)],
        "2": [(309, 440), (444, 375), (580, 325), (715, 290), (850, 300), (986, 380), (1053, 440)],
        "1.2": [(309, 445), (444, 395), (580, 365), (715, 345), (850, 345), (986, 420), (1053, 475)],
        "0.8": [(309, 450), (444, 420), (580, 400), (715, 390), (850, 400), (986, 470), (1053, 525)],
        "0.4": [(309, 455), (444, 455), (580, 465), (715, 490), (850, 525), (986, 575), (1053, 605)],
        "0": [(309, 545), (444, 570), (580, 600), (715, 630), (850, 665), (986, 715), (1053, 760)],
    },
    "21b_cone_cna": {
        "3": [(750, 265), (850, 250), (986, 230), (1053, 222)],
        "2": [(309, 435), (444, 380), (580, 320), (715, 300), (850, 290), (986, 275), (1053, 268)],
        "1.2": [(309, 440), (444, 400), (580, 365), (715, 352), (850, 358), (986, 375), (1053, 380)],
        "0.8": [(309, 460), (444, 445), (580, 440), (715, 455), (850, 462), (986, 465), (1053, 465)],
        "0.4": [(309, 515), (444, 540), (580, 570), (715, 595), (850, 602), (986, 603), (1053, 603)],
        "0": [(309, 735), (444, 755), (580, 770), (715, 773), (850, 773), (986, 773), (1053, 773)],
    },
    "23a_ogive_xcp": {
        "0": [(309, 95), (444, 100), (580, 108), (717, 118), (853, 130), (940, 140)],
        "0.4": [(309, 258), (444, 240), (580, 225), (717, 212), (853, 205), (950, 202)],
        "0.8": [(309, 350), (444, 328), (580, 305), (717, 282), (853, 262), (950, 250)],
        "1.2": [(309, 425), (444, 398), (580, 370), (717, 342), (853, 318), (950, 300)],
        "1.6": [(309, 495), (444, 462), (580, 428), (717, 395), (853, 365), (950, 342)],
        "2": [(309, 545), (444, 505), (580, 468), (717, 435), (853, 400), (950, 372)],
    },
    "23b_cone_xcp": {
        "0": [(36, 68), (309, 68), (580, 68), (715, 68), (850, 68), (1020, 68)],
        "0.5": [(140, 318), (175, 290), (240, 250), (309, 222), (444, 215), (580, 215), (715, 218), (850, 225), (986, 238), (1020, 245)],
        "1": [(175, 462), (309, 415), (444, 375), (580, 345), (715, 325), (850, 330), (986, 345), (1020, 355)],
        "2": [(380, 600), (444, 580), (580, 530), (715, 490), (780, 478), (850, 460), (986, 432), (1050, 425)],
        "3": [(575, 690), (715, 640), (850, 598), (986, 560), (1020, 548)],
        "4": [(675, 755), (715, 740), (850, 690), (986, 640), (1020, 625)],
    },
}


def interp(pts, x):
    pts = sorted(pts)
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if a <= x <= b:
            return va + (x - a) * (vb - va) / (b - a)
    raise ValueError(x)


charts = {}
for chart, curves in PASS2_PX.items():
    x0, sx, fy = CAL[chart]
    floor = 0.05 if "cna" in chart else 0.005
    out_curves = {}
    for key, px in curves.items():
        rows = []
        worst = 0.0
        for x, y in px:
            u = round((x - x0) / sx, 3)
            p2 = round(fy(y), 4)
            p1 = round(interp(PASS1[chart][key], u), 4)
            d = abs(p1 - p2)
            worst = max(worst, d)
            rows.append({"u": u, "pass1": p1, "pass2": p2, "value": round((p1 + p2) / 2, 4), "disagreement": round(d, 4)})
        out_curves[key] = {"parameter": float(key), "worst_disagreement": round(worst, 4), "uncertainty": round(max(floor, worst / 2), 4), "rows": rows, "points": [[r["u"], r["value"]] for r in rows]}
    charts[chart] = out_curves

out = {
    "source": "USAF Stability and Control DATCOM (1978 revision): figures 4.2.1.1-21a and -21b (section 4.2.1.1 C, scan p. 835 = page 341 of reference/docs/usaf-datcom-1978-dtic-adb072483-pp0495-0920.pdf) and figures 4.2.2.1-23a and -23b (section 4.2.2.1 C, scan p. 907 = page 413 of the same file)",
    "quantities": {
        "21a_ogive_cna": "C_N_alpha per radian on the maximum frontal area of an ogive-cylinder body, curves of f_A/f_N",
        "21b_cone_cna": "the same for a cone-cylinder body",
        "23a_ogive_xcp": "x_cp/l_B (fraction of the ogive-cylinder body length) at supersonic speeds, curves of f_A/f_N",
        "23b_cone_xcp": "the same for a cone-cylinder body",
    },
    "abscissa": "u = beta/f_N for u <= 1, u = 2 - f_N/beta for u > 1 (the charts fold at beta/f_N = 1); beta = sqrt(M^2 - 1)",
    "validity": "DATCOM p. 4.2.1.1-4: ogive-cylinder 1.28 < M < 5.04, 1.5 < f_N < 7, 0 <= f_A/f_N <= 3.87; cone-cylinder 1.36 < M < 5.04, 2.5 < f_N < 7, 0 <= f_A/f_N <= 3.17; the charts themselves run from beta/f_N = 0.4 to f_N/beta = 0.5",
    "method": {
        "pass1": "read by eye against the printed grid from the 300 dpi renders before the pixel pass; interpolated linearly to the pass-2 abscissae",
        "pass2": "pixel coordinates of each curve at fixed columns of a ruler-overlaid crop converted by the gridline calibration in build-datcom-body-charts.py",
        "value": "mean of the passes; uncertainty per curve = max(floor, half the worst disagreement), floor 0.05 per radian for C_N_alpha and 0.005 of body length for x_cp",
    },
    "charts": charts,
}
Path(__file__).with_name("datcom-body-charts.json").write_text(json.dumps(out, indent=2) + "\n")
for chart, curves in charts.items():
    print(chart, {k: (v["worst_disagreement"], v["uncertainty"]) for k, v in curves.items()})
