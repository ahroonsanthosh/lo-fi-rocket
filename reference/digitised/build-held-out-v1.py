#!/usr/bin/env python3
"""Build reference/digitised/held-out-v1.json from the two digitising passes.

Held-out validation data for version 1.0 (CLAUDE.md 6.7 item 1, D-061): six
NACA/NASA datasets that were never used to build, choose or tune anything.
Pass 1 values were read by eye against the printed grid from 250 dpi page
renders (except where stated); pass 2 values are pixel positions read from
the same renders with a 50 px ruler overlay (or 3x zoomed strips with a
10 px ruler), converted by the axis calibrations recorded here. Run with
python3 -I from the repository root; the output is committed next to it.
"""
import json
from pathlib import Path

INCH = 0.0254


def series(points, floor, note=None):
    """points: list of (x, pass1, pass2); value = mean, uncertainty = max(floor, half the worst disagreement)."""
    rows = []
    worst = 0.0
    for x, p1, p2 in points:
        if p1 is None:
            rows.append({"mach": x, "pass1": None, "pass2": p2, "value": p2})
            continue
        d = abs(p1 - p2)
        worst = max(worst, d)
        rows.append({"mach": x, "pass1": p1, "pass2": p2, "value": round((p1 + p2) / 2, 4), "disagreement": round(d, 4)})
    out = {"worst_disagreement": round(worst, 4), "uncertainty": round(max(floor, worst / 2), 4), "points": rows}
    if note:
        out["note"] = note
    return out


def lin(px, p0, v0, p1, v1):
    return v0 + (px - p0) * (v1 - v0) / (p1 - p0)


# ---------------------------------------------------------------- Blue Scout
bs_cp = series([
    (0.6, 0.80, 0.800), (0.7, 0.80, 0.801), (0.8, 0.805, 0.807), (0.85, 0.815, 0.818),
    (0.9, 0.83, 0.832), (0.95, 0.845, 0.846), (1.0, 0.855, 0.854), (1.03, 0.845, 0.846),
], 0.005)
bs_cna = series([
    (0.6, 0.155, 0.158), (0.7, 0.17, 0.170), (0.8, 0.185, 0.182), (0.9, 0.20, 0.198),
    (0.95, 0.215, 0.209), (0.98, 0.23, 0.224), (1.0, 0.225, 0.230), (1.03, 0.20, 0.198),
], 0.005, "per degree; the text gives 0.184 per deg at M 0.8 for the fins-on model, which the pass-2 reading reproduces")
# fig 5(c): alpha = 0 column at x = 1035.5 px (page 21 at 250 dpi); gridlines 59.5 px per 0.1
bs5c_px = {0.6: (520, 430, 0.5, 491, 0.4), 0.8: (833, 786, 0.5, 846, 0.4), 0.9: (1200, 1144.5, 0.6, 1203.5, 0.5),
           1.0: (1555, 1503.5, 0.8, 1563.5, 0.7), 1.03: (1963, 1917.5, 0.8, 1977, 0.7)}
bs5c_p1 = {0.6: 0.355, 0.8: 0.43, 0.9: 0.505, 1.0: 0.71, 1.03: 0.725}
bs_ca = series([(m, bs5c_p1[m], round(lin(y, a, va, b, vb), 4)) for m, (y, a, va, b, vb) in bs5c_px.items()], 0.01)
bs5d_px = {0.6: (579, 556.5, 0.2, 603.5, 0.1), 0.8: (894, 880.5, 0.2, 926.5, 0.1), 0.9: (1247, 1247, 0.2, 1293.5, 0.1),
           1.0: (1690, 1662, 0.5, 1709.5, 0.4), 1.03: (2019, 1987.5, 0.5, 2034.5, 0.4)}
bs5d_p1 = {0.6: 0.155, 0.8: 0.175, 0.9: 0.205, 1.0: 0.44, 1.03: 0.425}
bs_cab = series([(m, bs5d_p1[m], round(lin(y, a, va, b, vb), 4)) for m, (y, a, va, b, vb) in bs5d_px.items()], 0.01)

# ---------------------------------------------------------------- RM-10, E50D28
# fig 8(c): crop origin (395, 1020) of page 34 at 250 dpi; y 82 = 2.0, y 1139.5 = 0 diameters; x 232 = M 1.5, 1290 = M 2.0
rm_cp_px = {1.49: (211, 281, 283), 1.59: (422, 262, 268), 1.78: (824, 214, 232), 1.98: (1247, 118, 140)}
rm_cp_p1 = {1.49: 1.62, 1.59: 1.66, 1.78: 1.78, 1.98: 1.93}
rm_cp_p1_a4 = {1.49: 1.62, 1.59: 1.65, 1.78: 1.76, 1.98: 1.88}
rm_cp2 = series([(m, rm_cp_p1[m], round(lin(y2, 82, 2.0, 1139.5, 0.0), 4)) for m, (x, y2, y4) in rm_cp_px.items()], 0.02)
rm_cp4 = series([(m, rm_cp_p1_a4[m], round(lin(y4, 82, 2.0, 1139.5, 0.0), 4)) for m, (x, y2, y4) in rm_cp_px.items()], 0.02)
# fig 8(d): page 35 at 250 dpi, absolute y: 0.4 gridline 1311.5, zero axis 2148.5; alpha = 0 line 1621, alpha = 2 line 1611.7, alpha = 4 line 1598.3
cd0 = round(lin(1621, 1311.5, 0.4, 2148.5, 0.0), 4)
cd2 = round(lin(1611.7, 1311.5, 0.4, 2148.5, 0.0), 4)
rm_cd = series([(m, 0.250, cd0) for m in (1.49, 1.59, 1.78, 1.98)], 0.005,
               "the plotted lines are straight and Mach independent (the report says so, p. 2); alpha = 2 deg line " + str(cd2))

# ---------------------------------------------------------------- TN 2944 fig 9(b)
# page 34 at 250 dpi: M = 0.8 + (x - 311)/827 (heavy gridlines every 0.2 Mach at 311, 476.5, 641, ..., 1800 = 2.6);
# C_D = 0.30 - (y - 1128)/1468.3 (0.30 line at 1128, zero line at 1568.5). Read from 2x zooms.
tn2944_p2 = [(0.90, 0.171), (0.95, 0.173), (0.968, 0.190), (0.986, 0.207), (0.998, 0.227), (1.010, 0.248), (1.016, 0.261),
             (1.03, 0.260), (1.09, 0.262), (1.15, 0.254), (1.21, 0.249), (1.27, 0.244), (1.33, 0.241), (1.39, 0.239),
             (1.45, 0.236), (1.51, 0.234), (1.57, 0.232), (1.63, 0.231), (1.69, 0.228), (1.81, 0.225), (1.94, 0.222),
             (2.06, 0.220), (2.18, 0.220), (2.30, 0.219), (2.42, 0.219), (2.49, 0.219)]
tn2944_p1 = [(0.9, 0.165), (0.95, 0.18), (0.975, 0.21), (1.0, 0.24), (1.025, 0.255), (1.05, 0.26), (1.1, 0.26), (1.2, 0.25),
             (1.3, 0.245), (1.4, 0.24), (1.5, 0.24), (1.6, 0.235), (1.7, 0.23), (1.8, 0.225), (1.9, 0.225), (2.0, 0.22),
             (2.2, 0.215), (2.4, 0.21)]


def interp(xs, x):
    for (a, va), (b, vb) in zip(xs, xs[1:]):
        if a <= x <= b:
            return lin(x, a, va, b, vb)
    raise ValueError(x)


tn2944_rows = []
worst_plateau = 0.0
worst_rise = 0.0
for m, p1 in tn2944_p1:
    p2 = round(interp(tn2944_p2, m), 4)
    d = abs(p1 - p2)
    if 0.94 <= m <= 1.03:
        worst_rise = max(worst_rise, d)
    else:
        worst_plateau = max(worst_plateau, d)
    tn2944_rows.append({"mach": m, "pass1": p1, "pass2_interpolated": p2, "disagreement": round(d, 4)})
tn2944_cd = {
    "note": "value series = pass-2 pixel readings (dense in the drag rise); pass 1 compared at its own Mach numbers by interpolating pass 2",
    "worst_disagreement_plateau": round(worst_plateau, 4),
    "worst_disagreement_rise_0.94_to_1.03": round(worst_rise, 4),
    "uncertainty": round(max(0.01, worst_plateau / 2), 4),
    "uncertainty_in_rise": round(max(0.01, worst_rise / 2), 4),
    "comparison": tn2944_rows,
    "points": [{"mach": m, "value": v} for m, v in tn2944_p2],
}
tn2944_cdb = {
    "note": "base drag coefficient, single pixel pass, +-0.01: squares at M 1.0 to 1.1 y 1535 px, 1.2 to 1.3 y 1550, 1.5 to 1.9 y 1530, 2.0 to 2.5 y 1535",
    "uncertainty": 0.01,
    "points": [{"mach": 1.05, "value": 0.023}, {"mach": 1.25, "value": 0.013}, {"mach": 1.7, "value": 0.026}, {"mach": 2.25, "value": 0.023}],
}

# ---------------------------------------------------------------- TN D-3182 model A
# fig 4(a): crop origin (390, 470) of page 14 at 250 dpi, zoomed 2x; M = 1 + (zx - 112)/250.8;
# C_N_alpha = 14 - (zy - 388)/118.75; x_cp/d = 9.2 - (zy - 1220)/607.5
d3182_cna_px = {1.79: (298, 520), 1.88: (322, 540), 1.98: (348, 648), 2.06: (375, 760), 2.0: (366, 696), 2.38: (448, 800),
                2.78: (543, 920), 3.17: (640, 990), 3.47: (712, 1020)}
d3182_cna_p1 = {1.79: 12.8, 1.88: 12.75, 1.98: 11.8, 2.06: 10.9, 2.0: 11.5, 2.38: 10.5, 2.78: 9.5, 3.17: 8.9, 3.47: 8.6}
d3182_cna = series([(m, d3182_cna_p1[m], round(14 - (zy - 388) / 118.75, 3)) for m, (zx, zy) in d3182_cna_px.items()], 0.15,
                   "M 2.0 (10 by 10 ft tunnel) is the mean of two circles at zy 708 and 685 (tests 1 and 1A); the squares are the 8 by 6 ft tunnel at the nominal Mach numbers of Table II")
d3182_cp_px = {1.79: (298, 1437), 1.88: (322, 1492), 1.98: (340, 1493), 2.06: (365, 1525), 2.0: (358, 1502), 2.38: (438, 1620),
               2.78: (540, 1720), 3.17: (640, 1818), 3.47: (712, 1797)}
d3182_cp_p1 = {1.79: 8.85, 1.88: 8.75, 1.98: 8.75, 2.06: 8.7, 2.0: 8.78, 2.38: 8.52, 2.78: 8.35, 3.17: 8.2, 3.47: 8.25}
d3182_cp = series([(m, d3182_cp_p1[m], round(9.2 - (zy - 1220) / 607.5, 3)) for m, (zx, zy) in d3182_cp_px.items()], 0.03,
                  "calibers from station 0 (nose tip), d = 6 in; M 2.0 circles at zy 1470 and 1535 averaged")
# fig 5(a): crop origin (660, 420) of page 15, zoomed 2x; M = 1 + (zx - 204.5)/249.2; C_A = 0.6 - (zy - 70)/2380
d3182_ca_px = {1.79: (398, 252), 1.88: (420, 323), 1.98: (443, 383), 2.06: (475, 440), 2.0: (450, 420), 2.38: (545, 535),
               2.78: (650, 668), 3.17: (745, 780), 3.47: (830, 872)}
d3182_ca_p1 = {1.79: 0.525, 1.88: 0.50, 1.98: 0.465, 2.06: 0.455, 2.0: 0.45, 2.38: 0.40, 2.78: 0.35, 3.17: 0.31, 3.47: 0.265}
d3182_ca = series([(m, d3182_ca_p1[m], round(0.6 - (zy - 70) / 2380, 4)) for m, (zx, zy) in d3182_ca_px.items()], 0.01,
                  "axial force at zero normal force, sting mounted with base pressure measured; whether the base term is removed is stated in the report's symbols (C_A, no correction noted)")

# ---------------------------------------------------------------- TM X-1661 figure 4 (M 2.01)
# crop origin (515, 390) of page 16 at 250 dpi; a.c. percent = 90 - (x - 229)/22.15 (heavy gridlines 229, 452, 672, 894, 1114 = 90, 80, 70, 60, 50 %)
x1661_px = {"config1": {"conical_lowAR": 615, "conical_highAR": 492, "ogive_lowAR": 585, "ogive_highAR": 497, "spherical_lowAR": 672, "spherical_highAR": 545},
            "config2": {"conical_lowAR": 585, "conical_highAR": 512, "ogive_lowAR": 575, "ogive_highAR": 508, "spherical_lowAR": 643, "spherical_highAR": 563}}
x1661_p1 = {"config1": {"conical_lowAR": 73.5, "conical_highAR": 78.5, "ogive_lowAR": 74.5, "ogive_highAR": 78.5, "spherical_lowAR": 70.5, "spherical_highAR": 76.0},
            "config2": {"conical_lowAR": 73.0, "conical_highAR": 78.0, "ogive_lowAR": 74.0, "ogive_highAR": 78.0, "spherical_lowAR": 71.5, "spherical_highAR": 75.0}}
x1661_ac = {}
for cfg, d in x1661_px.items():
    rows = {}
    worst = 0.0
    for k, px in d.items():
        p2 = round(90 - (px - 229) / 22.15, 2)
        p1 = x1661_p1[cfg][k]
        worst = max(worst, abs(p1 - p2))
        rows[k] = {"pass1": p1, "pass2": p2, "value": round((p1 + p2) / 2, 2)}
    x1661_ac[cfg] = {"worst_disagreement": round(worst, 2), "uncertainty": round(max(0.5, worst / 2), 2), "points": rows}
x1661_ca = {
    "note": "figure 2(a) C_A at alpha = 0 for configuration 1, single pixel pass (crop origin (440, 1640) of page 10; C_A = 0.6 - (y - 35)/1170; alpha = 0 at x 344): the low and high aspect ratio curves overlap near alpha = 0, so the symbol identification carries +-0.015",
    "uncertainty": 0.015,
    "points": {"ogive_off": 0.301, "conical_off": 0.329, "ogive_lowAR": 0.422, "conical_lowAR": 0.433, "ogive_highAR": 0.485, "conical_highAR": 0.493},
    "pass1_by_eye": {"ogive_off": 0.31, "conical_off": 0.33, "ogive_lowAR": 0.43, "conical_lowAR": 0.49, "ogive_highAR": 0.49, "conical_highAR": 0.50},
    "pass1_note": "the pass-1 conical low-AR value (0.49) read the wrong curve; both passes are kept and the pixel pass is used",
}

# ---------------------------------------------------------------- NACA RM L8A05 figure 8(a)
# page 22 rotated -90 deg at 250 dpi (2556 x 1955): M = 0.5 + (x - 270)/1969; C_D = 0.4 - (y - 210)/1967.5
l8_px = [(515, 780), (590, 768), (650, 770), (700, 745), (765, 750), (830, 760), (905, 768), (975, 775), (1005, 780), (1040, 785),
         (1070, 788), (1100, 790), (1140, 798), (1170, 800), (1205, 770), (1240, 718), (1270, 668), (1305, 628), (1340, 598),
         (1375, 575), (1410, 558), (1440, 550), (1505, 537), (1540, 533), (1595, 522)]
l8_p2 = [(round(0.5 + (x - 270) / 1969, 3), round(0.4 - (y - 210) / 1967.5, 4)) for x, y in l8_px]
l8_p3 = [(0.63, 0.11), (0.70, 0.115), (0.72, 0.125), (0.75, 0.122), (0.80, 0.118), (0.85, 0.112), (0.90, 0.107), (0.95, 0.102),
         (0.97, 0.113), (1.0, 0.155), (1.02, 0.185), (1.05, 0.21), (1.08, 0.225), (1.1, 0.23), (1.15, 0.237), (1.17, 0.241)]
l8_p1 = {0.6: 0.10, 0.7: 0.10, 0.8: 0.105, 0.85: 0.11, 0.9: 0.13, 0.95: 0.175, 1.0: 0.215, 1.05: 0.245, 1.1: 0.265, 1.15: 0.28, 1.19: 0.29}
l8_rows = []
worst3 = 0.0
for m, p3 in l8_p3:
    p2 = round(interp(l8_p2, m), 4)
    worst3 = max(worst3, abs(p3 - p2))
    l8_rows.append({"mach": m, "pass3_by_eye": p3, "pass2_interpolated": p2, "disagreement": round(abs(p3 - p2), 4)})
l8a05_cd = {
    "note": "model A circles. Pass 1 was read from an 80 dpi contact-sheet thumbnail and is kept for the record but disagrees with the two full-resolution passes by up to 0.07 in the drag rise; the pixel pass (pass 2) is the value series and pass 3 (by eye from the unmarked 250 dpi render, after pass 2) is the check",
    "pass1_thumbnail": [{"mach": m, "value": v} for m, v in l8_p1.items()],
    "worst_disagreement_pass2_pass3": round(worst3, 4),
    "uncertainty": round(max(0.01, worst3 / 2), 4),
    "comparison": l8_rows,
    "points": [{"mach": m, "value": v} for m, v in l8_p2],
}

out = {
    "purpose": "Held-out validation data for version 1.0 (CLAUDE.md 6.7 item 1, D-061): never used to build, choose or tune the model. Digitised by Claude on 2026-10-12 from NTRS copies in reference/docs/. The ARCAS CP data of TN D-4013 and TN D-4014 were used to choose the transonic fin interpolation (D-056) and are no longer independent; they are kept in wind-tunnel-validation.json and reported separately.",
    "method": {
        "pass1": "values read by eye against the printed grid from the 250 dpi page renders before the pixel pass (exception: L8A05, see its note)",
        "pass2": "pixel coordinates of gridlines and of the curve or symbol transcribed from the same renders with a 50 px ruler overlay (or 3x zoomed strips with a 10 px ruler), converted by the axis calibration recorded with each series",
        "uncertainty": "the larger of half the worst disagreement between passes and the reading floor (0.5 % body length or 0.02 diameters for CP, 0.01 for a force coefficient, 0.15 per radian for C_N_alpha)",
        "curve_identity_check": "every digitised panel was re-read against its legend and the report text before pass 2: Blue Scout fig 8(a) solid line = fins on (text: C_N_alpha 0.184 per deg at M 0.8 confirms the curve); RM E50D28 fig 8(c) and (d) curves are labelled by angle of attack on the plot; TN 2944 fig 9(b) lower band = 73.25 in models A, B, C, E (legend in the panel), C_D_T above C_D_B; TN D-3182 fig 4(a) and 5(a) symbols by roll angle and tunnel (legend); TM X-1661 fig 4 symbols by fin aspect ratio (legend), fig 2(a) by nose and fin (legend); L8A05 fig 8(a) model A circles (legend)",
    },
    "blue_scout_tn_d_1958": {
        "source": "NASA TN D-1958 (1963), 1/15-scale Blue Scout model, Langley 8-foot transonic pressure tunnel, Mach 0.60 to 1.03, Reynolds number 3.18e6 to 4.12e6 per foot; configuration D = body + fins, no flare, no protuberances, delta_f = 0 (figure 8(a) PDF page 31, solid 'fins on' curve; figure 5(c) PDF page 21 and 5(d) PDF page 22, circles)",
        "reference": "coefficients on 0.0388 sq ft (d = 2.67 in); x_cp as a fraction of the overall length 57.72 in (apex to fin trailing edge); moment reference 66.3 % of length",
        "reynolds_per_foot": {"0.6": 3.18e6, "1.03": 4.12e6, "note": "linear in Mach between the two, from the test conditions"},
        "x_cp_over_l": bs_cp,
        "cn_alpha_per_deg": bs_cna,
        "ca_alpha0": bs_ca,
        "ca_base_alpha0": bs_cab,
        "geometry_inches": {
            "note": "figure 1(a) (PDF pages 9 to 10): spherical nose tip r = 0.43 on a 22 deg half-angle cone of length 2.56 to diameter 2.06; cylinder 2.06 to station 29.69; conical transition 29.69 to 32.90 from 2.06 to 2.67; cylinder 2.67 to the base at 57.25 (fin trailing edge 0.47 beyond, overall 57.72); four fins: root chord 2.42, tip chord 0.47, exposed span 2.40, leading edge sweep 45 deg, single-wedge section with 8 deg included angle, leading-edge radius 0.017, root leading edge at station 54.76 (wedge thickness at the root trailing edge 2.42 tan 8 deg = 0.34, taken as the mean thickness 0.17 for the drag section 'square')",
            "modelling": "the spherical tip is replaced by the sharp 22 deg cone (apex 0.43/sin(22 deg) - 0.43 = 0.72 in ahead of the sphere centre; the virtual apex is station 0 of the drawing within 0.1 in); the fins' root trailing edge overhangs the base by 0.47 in",
        },
    },
    "rm10_naca_rm_e50d28": {
        "source": "NACA RM E50D28 (Luidens and Simon 1950), half-scale RM-10 with four fins, Lewis 8 by 6 ft supersonic tunnel, Mach 1.49, 1.59, 1.78, 1.98, Reynolds number 29.1, 29.2, 29.5, 31.1e6 on the body length; figure 8(c) (PDF page 34) centre of pressure against Mach at alpha 2, 4, 6, 7 deg; figure 8(d) (PDF page 35) drag coefficient against Mach at alpha 0 to 7 deg",
        "reference": "coefficients on the maximum cross-section (d = 6 in); centre of pressure in diameters ahead of the base (station 73.25 in)",
        "reynolds_on_length": {"1.49": 29.1e6, "1.59": 29.2e6, "1.78": 29.5e6, "1.98": 31.1e6},
        "cp_diameters_ahead_of_base_alpha2": rm_cp2,
        "cp_diameters_ahead_of_base_alpha4": rm_cp4,
        "cd_alpha0": rm_cd,
        "geometry_inches": {
            "note": "figure 2 (PDF page 19): parabolic body b = x sqrt(c/2) (2 - x/45), c = 2/15^2, 0 <= x <= 73.25 (maximum diameter 6 at x = 45, base radius 1.818; 0.25 in removed from the nose, overall 73 in); four fins of circular-arc profile, t/c 0.10 normal to the leading edge: leading edge swept 60 deg from the normal at station 64.5, parallelogram planform with streamwise chord 9.07 (4.54 normal to the edges, TN 2944 figure 1 gives 0.0504 L with L = 90), tip at radius 8.95, thickness 0.454; wetted area 1033 sq in, volume 1291 cu in",
            "modelling": "nose = parabolic series K = 1, length 45, radius 3 (the removed 0.25 in tip is kept: 0.3 % of length); boattail = the same parabola continued, which the unclipped parabolic transition (K = 1) of GEO-7 reproduces exactly (b = 3 - u^2/675 for u = x - 45); fins: root chord 9.07 (8.75 on the body, the rest behind the base), tip chord 9.07, sweep 11.86 at the tip, span 6.85 from the mean root radius 2.10, cross-section 'airfoil'",
        },
    },
    "rm10_flight_naca_tn_2944": {
        "source": "NACA TN 2944 (Evans 1953), compilation; figure 9(b) (PDF page 34): total and base drag coefficient of the 73.25 in free-flight RM-10 models A, B, C, E (magnesium alloy, polished, four fins) against Mach 0.9 to 2.5 at alpha = 0; figure 10 (PDF page 35): Reynolds number on the body length against Mach for each model",
        "reference": "coefficients on the maximum cross-section (d = 6 in); free flight, so the base drag is included in C_D_T",
        "reynolds_on_length": {"note": "figure 10, 73.25 in models: A 20e6 at M 0.93 to 58e6 at 1.5; B 16e6 at 1.0 to 76e6 at 2.0; C and E 15e6 at 1.2 to 78e6 at 2.5; used piecewise: A below 1.5, B 1.5 to 2.0, C/E above 2.0", "A": [[0.93, 20e6], [1.5, 58e6]], "B": [[1.0, 16e6], [2.0, 76e6]], "CE": [[1.2, 15e6], [2.5, 78e6]]},
        "geometry": "the E50D28 half-scale geometry (73.25 in flight models are the same shape, Table I PDF page 19)",
        "cd_total": tn2944_cd,
        "cd_base": tn2944_cdb,
        "caveat": "TN 2944 reports unexplained differences between wind-tunnel results with fins attached and flight results (summary): the flight C_D_T is about 0.03 below the 8 by 6 ft tunnel value at Mach 1.5 to 2.0 (figure 13)",
    },
    "tn_d_3182_model_A": {
        "source": "NASA TN D-3182 (Yuska 1966), one-fifth scale model A of a sounding rocket second stage, Lewis 10 by 10 ft (M 2.0 to 3.47, Re 2.34e6 to 2.49e6 per ft) and 8 by 6 ft (M 1.79 to 2.06, Re 4.9e6 to 5.03e6 per ft) supersonic tunnels; figure 4(a) (PDF page 14): C_N_alpha at zero normal force and centre of pressure against Mach; figure 5(a) (PDF page 15): C_A at zero normal force; Table II (PDF page 8) test conditions",
        "reference": "coefficients on the body cross-section (d = 6 in); C_N_alpha per radian; x_cp in calibers from station 0",
        "reynolds_per_foot": {"1.79": 5.03e6, "1.88": 5.0e6, "1.98": 4.9e6, "2.06": 5.03e6, "2.0": 2.49e6, "2.38": 2.47e6, "2.78": 2.34e6, "3.17": 2.41e6, "3.47": 2.47e6},
        "cn_alpha_per_rad": d3182_cna,
        "x_cp_over_d": d3182_cp,
        "ca_zero_normal_force": d3182_ca,
        "geometry_inches": {
            "note": "figure 1 (PDF page 9): nose 25.9 long with the coordinate table (station, radius): (1.143, 0.306), (1.905, 0.449), (3.810, 0.754), (5.714, 1.023), (7.619, 1.278), (9.524, 1.523), (11.428, 1.759), (13.333, 1.986), (15.238, 2.204), (17.143, 2.414), (19.048, 2.614), (20.952, 2.793), (22.857, 2.927), (23.810, 2.970), (24.000, 2.975), (24.762, 2.994), (25.900, 3.000), described in the text as approximately a three-quarter-power nose; cylinder radius 3.0 to station 65.9; four fins of 77.66 sq in total planform (section B): root chord 9.15, tip chord 6.54, exposed span 4.38, leading edge swept 45 deg, thick wedge section of 10 deg included angle with a blunt trailing edge (tip trailing-edge thickness 0.57 = 6.54 tan 5 deg), leading-edge radius 0.1; the fin trailing edge at the base",
            "modelling": "nose = power series fitted to the coordinate table by least maximum error (the exponent is computed and recorded in the model file); fins: root 9.15, tip 6.54, sweep 4.38, span 4.38, thickness 0.69 (mean of the root and tip trailing-edge thicknesses 0.80 and 0.57), cross-section 'square' (blunt base), root leading edge at 56.75; the wedge lift effect that the report adds (its reference 2) is not in Barrowman's method",
        },
    },
    "tm_x_1661_config1": {
        "source": "NASA TM X-1661 (1968), half-scale ARCAS variants at Mach 2.01, Reynolds number 9.8e6 per metre; figure 4 (PDF page 16): aerodynamic-centre location in percent body length for low angles of attack, configurations 1 (l/d 18.20) and 2 (23.77) with conical, ogive and spherical noses and low (basic) and high aspect ratio fins; figure 2(a) (PDF page 10): C_A against alpha for configuration 1",
        "reference": "percent of body length from the nose; coefficients on the body cross-section",
        "aerodynamic_centre_percent": x1661_ac,
        "ca_alpha0_config1": x1661_ca,
        "geometry": "configuration 1 with the ogive nose and low aspect ratio fins is the TN D-4013 short model (fineness ratio 18.2): ARCAS_COMPONENTS of wind-tunnel-models.ts; the conical (7.5 deg half-angle) and spherical (r = 2.907 cm) noses and the high aspect ratio fins (about 2.6 exposed) are recorded but not modelled",
    },
    "naca_rm_l8a05_fineness_7_87": {
        "source": "NACA RM L8A05 (1948), free flight, fin-stabilised parabolic body of fineness ratio 7.87 (basic parabola of fineness ratio 10 cut at 61 in), model A, Mach 0.58 to 1.19; figure 8(a) (PDF page 24): total drag coefficient on the maximum frontal area; figure 6 (PDF page 21): Reynolds number on the body length 17e6 at M 0.62 to 55e6 at 1.19",
        "reference": "coefficients on the maximum cross-section (d = 7.76 in); free flight: base included",
        "reynolds_on_length": [[0.62, 17e6], [1.19, 55e6]],
        "cd_total_model_A": l8a05_cd,
        "geometry_inches": {
            "note": "figure 1(a) (PDF page 9): profile Y = Ymax - 0.002577 X^2 with Ymax = 3.88 at station 38.8 (diameters at stations 0, 8, 16, 24, 32, 38.8, 48, 56, 61: 0, 2.87, 5.08, 6.62, 7.52, 7.76, 7.35, 6.30, 5.15); three untapered fins swept 60 deg, circular-arc section t/c 0.10 normal to the leading edge, chord 4.625 normal to the leading edge (9.25 streamwise), tip radius 8.65, thickness 0.4625, wooden models; the fin trailing edge at the root is at the base",
            "modelling": "nose = parabolic series K = 1, length 38.8, radius 3.88; boattail = unclipped parabolic transition K = 1 from 3.88 to 2.61 over 22.2 (the equation gives 2.61 at station 61 where the drawing lists 5.15/2 = 2.575); fins: root chord 9.25 (root leading edge at 51.75), tip chord 9.25, span 5.9 from the mean root radius 2.75, sweep 10.2, cross-section 'airfoil', count 3",
        },
    },
}
path = Path(__file__).with_name("held-out-v1.json")
path.write_text(json.dumps(out, indent=2) + "\n")
print("wrote", path)
