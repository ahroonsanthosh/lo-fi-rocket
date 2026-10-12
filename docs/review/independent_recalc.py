#!/usr/bin/env python3
"""Independent recalculation of reference rockets R1 to R4 (review, 2026-10-12).

Standalone: imports no project code and was written without reading the
project's TypeScript formulas or reference/rockets/hand-check-r1.py.
Run with:  python3 docs/review/independent_recalc.py

Inputs (all transcribed by hand):
  * dimensions, materials, positions: reference/rockets/README.md tables;
  * motors: header lines of reference/motors/*.eng (RASP: name, diameter mm,
    length mm, delays, propellant kg, total kg, maker); CG at mid-length and
    aft end flush with the mount (README "Conventions", settings.md);
  * OpenRocket values: reference/rockets/values.csv and components/*.csv;
  * app values: captured by running the repository code as a black box
    (packages/formats parseOrk + parseEng, packages/physics
    rocketMassProperties / componentMassProperties / centreOfPressure at
    Mach 0.3, rollAngle 'worst', finRollReduction false and true) on
    2026-10-12, branch review/independent-physics; pasted in APP below.

Physics sources (reference/docs/; Niskanen PDF page = printed page + 10):
  * Niskanen 2009, eq. (3.19) p. 22: body C_Na = 2/A_ref [A(l) - A(0)].
  * Niskanen 2009, eq. (3.28) p. 24: body CP X_B = [l A(l) - V]/[A(l) - A(0)].
  * Niskanen 2009, eq. (3.29) p. 25: total CP = sum X_i C_Na,i / sum C_Na,i.
  * Niskanen 2009, eqs. (3.30)-(3.32) p. 26: MAC integrals; CP at quarter MAC
    (Barrowman subsonic), evaluated here numerically, not by eq. (3.34).
  * Niskanen 2009, eqs. (3.37)-(3.39) pp. 28-29 (Barrowman 1967 eqs. 3-1 to 3-5,
    PDF pp. 12-13): single fin C_Na with Diederich F_D and the Gothert /
    Prandtl-Glauert factor beta = sqrt(1 - M^2) (Barrowman 1967 eq. 3-4).
    So compressibility IS included for the fins at M = 0.3; body terms
    (3.19) have no Mach dependence.
  * Niskanen 2009, eq. (3.54) p. 34: N = 3 -> 1.50 (C_Na)_1 [1 - 0.15 cos^2(3 theta/2)],
    N = 4 -> 2.00 (C_Na)_1 [1 - 0.06 sin^2(2 theta)]. Reported both without
    the bracket ("unreduced", what OpenRocket 24.12 does per settings.md) and
    at the worst roll angle ("worst").
  * Niskanen 2009, eqs. (3.55)-(3.56) p. 34: K_T(B) = 1 + r_t/(s + r_t).
  * Niskanen 2009, Appendix A eqs. (A.1), (A.2), (A.5), (A.9), (A.10),
    pp. 100-103: cone, tangent ogive, Haack profiles.
Mass properties are first principles (volume x density, centroids by
numerical integration of exact frustum slices of finely sampled profiles).
Shell walls of nose cones are taken as the thickness normal to the surface
(inner surface = inward parallel surface); the conical boat tail likewise.
Shoulders are open (uncapped) tubes; README does not mention caps.
"""

import math

# --------------------------------------------------------------------------
# Materials (README "Conventions"), kg/m^3
RHO = {"paper": 700.0, "balsa": 160.0, "plywood": 600.0, "plastic": 1050.0,
       "fiberglass": 1850.0, "nylon": 1150.0}

MACH = 0.3  # values.csv column "mach"


# --------------------------------------------------------------------------
# Solid-of-revolution helpers: polyline profile (x_k, r_k), x non-decreasing.
# Each segment is a frustum; its volume and first moment are exact.
def frustum(x0, r0, x1, r1):
    h = x1 - x0
    if h <= 0:
        return 0.0, 0.0
    v = math.pi * h / 3.0 * (r0 * r0 + r0 * r1 + r1 * r1)
    # centroid from x0 of a frustum: h (r0^2 + 2 r0 r1 + 3 r1^2) / (4 (r0^2 + r0 r1 + r1^2))
    den = r0 * r0 + r0 * r1 + r1 * r1
    xc = x0 + (h * (r0 * r0 + 2 * r0 * r1 + 3 * r1 * r1) / (4 * den) if den > 0 else h / 2)
    return v, v * xc


def solid_under(pts):
    V = M = 0.0
    for (x0, r0), (x1, r1) in zip(pts, pts[1:]):
        if x1 < x0 - 1e-15:
            raise ValueError("profile x not monotonic (offset cusp)")
        v, m = frustum(x0, r0, x1, r1)
        V += v
        M += m
    return V, M


def inner_offset(xf, rf, dxf, drf, t, u_values, x_end):
    """Inward parallel curve at normal distance t, clipped to r >= 0, extended
    along the axis direction to the plane x = x_end if it ends short of it."""
    raw = []
    for u in u_values:
        x, r, dx, dr = xf(u), rf(u), dxf(u), drf(u)
        n = math.hypot(dx, dr)
        raw.append((x + t * dr / n, r - t * dx / n))
    pts = []
    for (x0, r0), (x1, r1) in zip(raw, raw[1:]):
        if r0 < 0 <= r1:
            f = -r0 / (r1 - r0)
            pts.append((x0 + f * (x1 - x0), 0.0))
        if r1 >= 0:
            pts.append((x1, r1))
    if pts and pts[-1][0] < x_end - 1e-12:
        pts.append((x_end, pts[-1][1]))
    pts = [p for p in pts if p[0] <= x_end + 1e-15]
    return pts


def shell_of_revolution(xf, rf, dxf, drf, t, u0, u1, L, n=40000):
    us = [u0 + (u1 - u0) * i / n for i in range(n + 1)]
    outer = [(xf(u), rf(u)) for u in us]
    inner = inner_offset(xf, rf, dxf, drf, t, us, L)
    Vo, Mo = solid_under(outer)
    Vi, Mi = solid_under(inner)
    return Vo, Mo, Vo - Vi, Mo - Mi


def tube(L, ro, ri):
    return math.pi * (ro * ro - ri * ri) * L


# --------------------------------------------------------------------------
# Nose cone profiles, parametrised by u with analytic derivatives.
def cone_profile(L, R):
    # Niskanen (A.1): r = x R / L
    return (lambda u: u, lambda u: u * R / L, lambda u: 1.0, lambda u: R / L, 0.0, L)


def tangent_ogive_profile(L, R):
    # Niskanen (A.2) rho = (R^2 + L^2)/(2R); (A.5) with kappa = 1:
    # r(x) = sqrt(rho^2 - (L - x)^2) - sqrt(rho^2 - L^2)
    rho = (R * R + L * L) / (2 * R)
    c = math.sqrt(rho * rho - L * L)
    return (lambda u: u,
            lambda u: math.sqrt(rho * rho - (L - u) ** 2) - c,
            lambda u: 1.0,
            lambda u: (L - u) / math.sqrt(rho * rho - (L - u) ** 2),
            0.0, L)


def haack_profile(L, R, k):
    # Niskanen (A.9), (A.10): theta = acos(1 - 2x/L),
    # r = R/sqrt(pi) sqrt(theta - sin(2 theta)/2 + k sin^3 theta); u = theta.
    def g(th):
        return th - math.sin(2 * th) / 2 + k * math.sin(th) ** 3

    def dg(th):
        return 1 - math.cos(2 * th) + 3 * k * math.sin(th) ** 2 * math.cos(th)

    return (lambda th: L * (1 - math.cos(th)) / 2,
            lambda th: R / math.sqrt(math.pi) * math.sqrt(max(g(th), 0.0)),
            lambda th: L * math.sin(th) / 2,
            lambda th: (R / math.sqrt(math.pi)) * dg(th) / (2 * math.sqrt(g(th))) if g(th) > 0 else 1e30,
            0.0, math.pi)


def nose(profile, L, R, material, wall=None, shoulder=None):
    """Returns mass, CG (from nose tip), outer solid volume (for CP)."""
    xf, rf, dxf, drf, u0, u1 = profile
    if wall is None:
        us = [u0 + (u1 - u0) * i / 40000 for i in range(40001)]
        Vo, Mo = solid_under([(xf(u), rf(u)) for u in us])
        Vs, Ms = Vo, Mo
    else:
        # tip of Haack: drf is singular at theta=0; start just after it
        Vo, Mo, Vs, Ms = shell_of_revolution(xf, rf, dxf, drf, wall, u0 + 1e-9, u1, L)
    m = RHO[material] * Vs
    mx = RHO[material] * Ms
    if shoulder is not None:
        Ls, rs, ts = shoulder
        vs = tube(Ls, rs, rs - ts)
        m += RHO[material] * vs
        mx += RHO[material] * vs * (L + Ls / 2)
    return m, mx / m, Vo


def trapezoid_fin_geom(cr, ct, sweep, span, n=20000):
    """Area, planform centroid x, MAC quantities by numerical integration over y.
    Leading edge x_LE(y) = sweep*y/s, chord c(y) = cr + (ct - cr) y/s."""
    A = Sx = Sc2 = Sxlec = 0.0
    h = span / n
    for i in range(n + 1):
        y = i * h
        w = (1 if i in (0, n) else (4 if i % 2 else 2)) * h / 3  # Simpson
        c = cr + (ct - cr) * y / span
        xle = sweep * y / span
        A += w * c
        Sx += w * c * (xle + c / 2)
        Sc2 += w * c * c
        Sxlec += w * xle * c
    mac = Sc2 / A  # Niskanen (3.30)
    xmac_le = Sxlec / A  # (3.32)
    return A, Sx / A, mac, xmac_le


def fin_cna_single(cr, ct, sweep, span, aref, mach):
    # Niskanen (3.37)-(3.39) = Barrowman 1967 (3-1)-(3-5)
    A, _, _, _ = trapezoid_fin_geom(cr, ct, sweep, span)
    beta = math.sqrt(1 - mach * mach)
    cna0 = 2 * math.pi / beta
    AR = 2 * span * span / A
    gam_c = math.atan((sweep + ct / 2 - cr / 2) / span)  # mid-chord sweep
    FD = AR / ((cna0 / (2 * math.pi)) * math.cos(gam_c))
    return cna0 * FD * (A / aref) * math.cos(gam_c) / (2 + FD * math.sqrt(1 + 4 / FD ** 2))


def fin_roll_bracket_worst(N):
    # Niskanen (3.54) worst-case brackets
    if N == 3:
        return 1.50, 0.85  # min of 1 - 0.15 cos^2(3 theta/2)
    if N == 4:
        return 2.00, 0.94  # min of 1 - 0.06 sin^2(2 theta)
    raise ValueError(N)


def rail_buttons(od, idia, h, base, flange, positions):
    # base cylinder + shaft + flange, nylon; CG axial = mean of button centres
    v = math.pi * (od / 2) ** 2 * (base + flange) + math.pi * (idia / 2) ** 2 * (h - base - flange)
    m = RHO["nylon"] * v * len(positions)
    return m, sum(positions) / len(positions)


def motor_from_eng_header(length_mm, prop, total, aft_end):
    L = length_mm / 1000
    return total, total - prop, aft_end - L / 2


# --------------------------------------------------------------------------
def build(name):
    comps = []  # (label, mass, cg)
    aero = []   # (label, cna, cp)
    if name == "R1":
        d_ref = 0.050
        m, cg, Vo = nose(cone_profile(0.1, 0.025), 0.1, 0.025, "balsa")
        comps.append(("Nose cone", m, cg))
        comps.append(("Body tube", RHO["paper"] * tube(0.5, 0.025, 0.024), 0.1 + 0.25))
        fins = dict(N=3, cr=0.1, ct=0.05, sweep=0.05, span=0.08, t=0.003, mat="plywood", xle=0.5, rt=0.025)
        comps.append(("Nose weight", 0.030, 0.1 + 0.01))
        comps.append(("Launch lug", RHO["paper"] * tube(0.05, 0.003, 0.0025), 0.35 + 0.025))
        comps.append(("Motor mount tube", RHO["paper"] * tube(0.075, 0.0125, 0.012), 0.525 + 0.0375))
        for p in (0.530, 0.590):
            comps.append((f"Centering ring {p}", RHO["paper"] * tube(0.005, 0.024, 0.0125), p + 0.0025))
        comps.append(("Parachute", 0.010, 0.2 + 0.025))
        motor = motor_from_eng_header(70, 0.0211, 0.0426, 0.600)  # D12 24 70 0-3-5-7 0.0211 0.0426
        nose_L, nose_R = 0.1, 0.025
        boat = None
    elif name == "R2":
        d_ref = 0.054
        m, cg, Vo = nose(tangent_ogive_profile(0.15, 0.027), 0.15, 0.027, "plastic",
                         wall=0.002, shoulder=(0.040, 0.0255, 0.002))
        comps.append(("Nose cone", m, cg))
        comps.append(("Body tube", RHO["paper"] * tube(0.6, 0.027, 0.0255), 0.15 + 0.3))
        fins = dict(N=3, cr=0.12, ct=0.04, sweep=0.08, span=0.07, t=0.003, mat="plywood", xle=0.63, rt=0.027)
        comps.append(("Rail buttons", *rail_buttons(0.010, 0.006, 0.010, 0.002, 0.002, (0.45, 0.70))))
        comps.append(("Motor mount tube", RHO["paper"] * tube(0.13, 0.0155, 0.015), 0.62 + 0.065))
        for p in (0.625, 0.740):
            comps.append((f"Centering ring {p}", RHO["plywood"] * tube(0.005, 0.0255, 0.0155), p + 0.0025))
        comps.append(("Parachute", 0.030, 0.3 + 0.03))
        comps.append(("Payload mass", 0.050, 0.2 + 0.025))
        # Boat tail: conical frustum shell, normal wall 0.0015, open ends cut normal to axis.
        R1b, R2b, Lb, tb, xb = 0.027, 0.018, 0.050, 0.0015, 0.750
        k = (R2b - R1b) / Lb
        dr = tb * math.sqrt(1 + k * k)
        Vo_b, Mo_b = solid_under([(0, R1b), (Lb, R2b)])
        Vi_b, Mi_b = solid_under([(0, R1b - dr), (Lb, R2b - dr)])
        comps.append(("Boat tail", RHO["plastic"] * (Vo_b - Vi_b), xb + (Mo_b - Mi_b) / (Vo_b - Vi_b)))
        boat = (R1b, R2b, Lb, xb, Vo_b)
        motor = motor_from_eng_header(123.825, 0.069, 0.129, 0.750)  # G80NBT 29 123.825 4-7-10 0.069 0.129
        nose_L, nose_R = 0.15, 0.027
    elif name == "R3":
        d_ref = 0.0254
        m, cg, Vo = nose(haack_profile(0.1, 0.0127, 0.0), 0.1, 0.0127, "fiberglass",
                         wall=0.002, shoulder=(0.030, 0.0117, 0.0015))
        comps.append(("Nose cone", m, cg))
        comps.append(("Body tube", RHO["fiberglass"] * tube(0.45, 0.0127, 0.012), 0.1 + 0.225))
        fins = dict(N=3, cr=0.07, ct=0.03, sweep=0.045, span=0.035, t=0.002, mat="fiberglass", xle=0.48, rt=0.0127)
        comps.append(("Rail buttons", *rail_buttons(0.008, 0.004, 0.008, 0.0015, 0.0015, (0.30, 0.50))))
        comps.append(("Nose weight", 0.010, 0.1 + 0.015))
        comps.append(("Parachute", 0.015, 0.15 + 0.04))
        motor = motor_from_eng_header(70, 0.0227, 0.059, 0.550)  # F39T 24 70 3-6-9 .0227 .059
        nose_L, nose_R = 0.1, 0.0127
        boat = None
    elif name == "R4":
        d_ref = 0.066
        m, cg, Vo = nose(tangent_ogive_profile(0.2, 0.033), 0.2, 0.033, "plastic",
                         wall=0.003, shoulder=(0.050, 0.031, 0.003))
        comps.append(("Nose cone", m, cg))
        comps.append(("Body tube", RHO["fiberglass"] * tube(0.8, 0.033, 0.031), 0.2 + 0.4))
        comps.append(("Electronics bay mass", 0.150, 0.3 + 0.05))
        comps.append(("Bulkhead", RHO["plywood"] * tube(0.006, 0.031, 0.0), 0.45 + 0.003))
        comps.append(("Main parachute", 0.100, 0.48 + 0.06))
        comps.append(("Motor mount tube", RHO["paper"] * tube(0.2, 0.0195, 0.018), 0.8 + 0.1))
        for p in (0.810, 0.984):
            comps.append((f"Centering ring {p}", RHO["plywood"] * tube(0.006, 0.031, 0.0195), p + 0.003))
        fins = dict(N=4, cr=0.15, ct=0.06, sweep=0.09, span=0.08, t=0.004, mat="plywood", xle=0.85, rt=0.033)
        comps.append(("Rail buttons", *rail_buttons(0.010, 0.006, 0.010, 0.002, 0.002, (0.60, 0.95))))
        motor = motor_from_eng_header(154, 0.126336, 0.278656, 1.000)  # H123W 38 154 0 0.126336 0.278656
        nose_L, nose_R = 0.2, 0.033
        boat = None
    else:
        raise ValueError(name)

    # Fins: mass and planform centroid
    A, xc, mac, xmac_le = trapezoid_fin_geom(fins["cr"], fins["ct"], fins["sweep"], fins["span"])
    fin_mass = fins["N"] * A * fins["t"] * RHO[fins["mat"]]
    comps.insert(2, (f"Fins ({fins['N']})", fin_mass, fins["xle"] + xc))

    # Aerodynamics
    aref = math.pi * (d_ref / 2) ** 2
    A_base = math.pi * nose_R ** 2
    aero.append(("Nose cone", 2 * (A_base - 0) / aref, (nose_L * A_base - Vo) / (A_base - 0)))
    if boat is not None:
        R1b, R2b, Lb, xb, Vo_b = boat
        A0, Al = math.pi * R1b ** 2, math.pi * R2b ** 2
        aero.append(("Boat tail", 2 * (Al - A0) / aref, xb + (Lb * Al - Vo_b) / (Al - A0)))
    cna1 = fin_cna_single(fins["cr"], fins["ct"], fins["sweep"], fins["span"], aref, MACH)
    mult, worst = fin_roll_bracket_worst(fins["N"])
    ktb = 1 + fins["rt"] / (fins["span"] + fins["rt"])
    fin_cp = fins["xle"] + xmac_le + 0.25 * mac
    fin_unred = ("Fins", ktb * mult * cna1, fin_cp)
    fin_worst = ("Fins (worst roll)", ktb * mult * worst * cna1, fin_cp)

    def total_cp(parts):
        cna = sum(p[1] for p in parts)
        return sum(p[1] * p[2] for p in parts) / cna, cna

    cp_unred, cna_unred = total_cp(aero + [fin_unred])
    cp_worst, cna_worst = total_cp(aero + [fin_worst])

    ms = sum(c[1] for c in comps)
    mxs = sum(c[1] * c[2] for c in comps)
    m_lo, m_bo, mcg = motor
    lo_m = ms + m_lo
    lo_cg = (mxs + m_lo * mcg) / lo_m
    bo_m = ms + m_bo
    bo_cg = (mxs + m_bo * mcg) / bo_m
    comps.append(("Motor at launch", m_lo, mcg))
    return dict(comps=comps, aero=aero + [fin_unred, fin_worst], d_ref=d_ref,
                lo_m=lo_m, lo_cg=lo_cg, bo_m=bo_m, bo_cg=bo_cg,
                cp_unred=cp_unred, cna_unred=cna_unred, cp_worst=cp_worst, cna_worst=cna_worst,
                fin_detail=dict(A=A, mac=mac, xmac_le=xmac_le, cna1=cna1, ktb=ktb))


# --------------------------------------------------------------------------
# OpenRocket 24.12: values.csv (zero-wind rows) and components/*.csv
OR = {
    "R1": dict(cg=0.387022, cp=0.487149, stab=2.0025, lo_m=0.190904, bo_m=0.169804, bo_cg=0.364906, d=0.0500,
               comps=[0.010472, 0.053878, 0.032400, 0.030000, 0.000302, 0.002020, 0.004615, 0.004615, 0.010000, 0.042600],
               cgs=[0.075000, 0.350000, 0.561111, 0.110000, 0.375000, 0.562500, 0.532500, 0.592500, 0.225000, 0.565000]),
    "R2": dict(cg=0.484548, cp=0.571037, stab=1.6016, lo_m=0.414484, bo_m=0.345484, bo_cg=0.443897, d=0.0540,
               comps=[0.047206, 0.103908, 0.030240, 0.001113, 0.004360, 0.003864, 0.003864, 0.030000, 0.050000, 0.010929, 0.129000],
               cgs=[0.114915, 0.450000, 0.706667, 0.575000, 0.685000, 0.627500, 0.742500, 0.330000, 0.225000, 0.773275, 0.688088]),
    "R3": dict(cg=0.356248, cp=0.449111, stab=3.6560, lo_m=0.171873, bo_m=0.149173, bo_cg=0.332091, d=0.0254,
               comps=[0.022737, 0.045220, 0.019425, 0.000491, 0.010000, 0.015000, 0.059000],
               cgs=[0.076408, 0.325000, 0.525833, 0.400000, 0.115000, 0.190000, 0.515000]),
    "R4": dict(cg=0.625038, cp=0.807795, stab=2.7690, lo_m=1.365936, bo_m=1.239600, bo_cg=0.594671, d=0.0660,
               comps=[0.111639, 0.595143, 0.080640, 0.150000, 0.010869, 0.100000, 0.024740, 0.006568, 0.006568, 0.001113, 0.278656],
               cgs=[0.151871, 0.600000, 0.944286, 0.350000, 0.453000, 0.540000, 0.900000, 0.813000, 0.987000, 0.775000, 0.923000]),
}
# Index into the OR lists for each script component (R4 OR lists were transcribed in script order,
# i.e. the fin row, 9th in components/r4-scratch-38mm.csv, moved to third place).
OR_ORDER = {
    "R1": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    "R2": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "R3": [0, 1, 2, 3, 4, 5, 6],
    "R4": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  # OR list above already in script order
}

# App (black-box run, see module docstring). cp = OpenRocket-equivalent mode
# (finRollReduction false), cp_worst = displayed mode (finRollReduction true).
APP = {
    "R1": dict(lo_m=0.19090388920368925, lo_cg=0.38702203640970867, bo_m=0.16980388920368925, bo_cg=0.3649063178041683,
               cp=0.48722722193360385, cna=17.450582103807466, cp_worst=0.4788899319030703, cna_worst=15.132994788236346,
               nose_m=0.010471975511965966, nose_cg=0.07500000000000008, nose_cp=0.06666666666666668, fin_cp=0.5416666666666666),
    "R2": dict(lo_m=0.4144846069904699, lo_cg=0.4845474120966774, bo_m=0.3454846069904699, bo_cg=0.44389649514940893,
               cp=0.5712331688919446, cna=11.687249901179399, cp_worst=0.5529292826408363, cna_worst=10.067495749335823,
               nose_m=0.04720680281872009, nose_cg=0.11491447158746321, nose_cp=0.0692633812615167, fin_cp=0.685,
               boat_m=0.010928811903515677, boat_cg=0.7732749060776123, boat_cp=0.7733333333333331),
    "R3": dict(lo_m=0.17187391015264974, lo_cg=0.3562473867820576, bo_m=0.14917391015264975, bo_cg=0.3320897823030998,
               cp=0.4491969753292375, cna=14.579137125685829, cp_worst=0.43976137987727326, cna_worst=12.692266556832955,
               nose_m=0.022737716025305874, nose_cg=0.07640740489276503, nose_cp=0.04999999999999995, fin_cp=0.5126666666666667),
    "R4": dict(lo_m=1.3659369708564806, lo_cg=0.6250376395443932, bo_m=1.2396009708564806, bo_cg=0.594670308721386,
               cp=0.8079730630269426, cna=15.193718354858161, cp_worst=0.8020117161255755, cna_worst=14.40209525356667,
               nose_m=0.11163995482942848, nose_cg=0.15187030171046442, nose_cp=0.09250734708492132, fin_cp=0.9164285714285714),
}


def pct(a, b):
    return 100.0 * (a - b) / b


def main():
    for name in ("R1", "R2", "R3", "R4"):
        r = build(name)
        o = OR[name]
        a = APP[name]
        d = r["d_ref"]
        st_ind = (r["cp_unred"] - r["lo_cg"]) / d
        st_ind_w = (r["cp_worst"] - r["lo_cg"]) / d
        st_app = (a["cp"] - a["lo_cg"]) / d
        st_app_w = (a["cp_worst"] - a["lo_cg"]) / d
        print("=" * 100)
        print(f"{name}  (d_ref = {d} m, Mach {MACH}, alpha 0)")
        print(f"{'quantity':<34}{'independent':>13}{'app':>13}{'OpenRocket':>13}{'ind-OR %':>10}{'app-OR %':>10}{'app-ind %':>10}")
        rows = [
            ("liftoff mass kg", r["lo_m"], a["lo_m"], o["lo_m"]),
            ("liftoff CG m", r["lo_cg"], a["lo_cg"], o["cg"]),
            ("burnout mass kg", r["bo_m"], a["bo_m"], o["bo_m"]),
            ("burnout CG m", r["bo_cg"], a["bo_cg"], o["bo_cg"]),
            ("CP m (unreduced 3.54)", r["cp_unred"], a["cp"], o["cp"]),
            ("stability cal (unreduced)", st_ind, st_app, o["stab"]),
            ("CP m (worst roll, 3.54)", r["cp_worst"], a["cp_worst"], None),
            ("stability cal (worst roll)", st_ind_w, st_app_w, None),
            ("burnout stability (unreduced)", (r["cp_unred"] - r["bo_cg"]) / d, (a["cp"] - a["bo_cg"]) / d,
             (o["cp"] - o["bo_cg"]) / d),
            ("total C_Na (unreduced)", r["cna_unred"], a["cna"], None),
            ("total C_Na (worst roll)", r["cna_worst"], a["cna_worst"], None),
        ]
        for lab, i, ap, orv in rows:
            ors = f"{orv:13.6f}" if orv is not None else f"{'-':>13}"
            p1 = f"{pct(i, orv):10.4f}" if orv is not None else f"{'-':>10}"
            p2 = f"{pct(ap, orv):10.4f}" if orv is not None else f"{'-':>10}"
            print(f"{lab:<34}{i:13.6f}{ap:13.6f}{ors}{p1}{p2}{pct(ap, i):10.4f}")
        print("-- aerodynamic contributions (independent)")
        for lab, cna, cp in r["aero"]:
            print(f"   {lab:<22} C_Na {cna:10.5f}  CP {cp:9.6f} m")
        fd = r["fin_detail"]
        print(f"   fin: A={fd['A']:.6e} m^2, MAC={fd['mac']:.6f}, x_MAC,LE={fd['xmac_le']:.6f}, "
              f"(C_Na)_1={fd['cna1']:.5f}, K_T(B)={fd['ktb']:.6f}")
        print(f"   app: nose CP {a['nose_cp']:.6f}, fin CP {a['fin_cp']:.6f}"
              + (f", boat tail CP {a['boat_cp']:.6f}" if 'boat_cp' in a else ""))
        print("-- components: independent vs OpenRocket (components csv)")
        print(f"   {'component':<26}{'mass ind':>11}{'mass OR':>11}{'d%':>9}{'CG ind':>11}{'CG OR':>11}{'d mm':>9}")
        for (lab, m, cg), k in zip(r["comps"], OR_ORDER[name]):
            mo, co = o["comps"][k], o["cgs"][k]
            flag = "  <-- >0.5 %" if abs(pct(m, mo)) > 0.5 else ""
            print(f"   {lab:<26}{m:11.6f}{mo:11.6f}{pct(m, mo):9.3f}{cg:11.6f}{co:11.6f}{1000 * (cg - co):9.3f}{flag}")
        if "nose_m" in a:
            nm, ncg = r["comps"][0][1], r["comps"][0][2]
            print(f"   app nose cone: mass {a['nose_m']:.6f} ({pct(a['nose_m'], nm):+.3f} % vs ind), CG {a['nose_cg']:.6f}")
        if "boat_m" in a:
            bm = [c for c in r["comps"] if c[0] == "Boat tail"][0]
            print(f"   app boat tail: mass {a['boat_m']:.6f} ({pct(a['boat_m'], bm[1]):+.3f} % vs ind), CG {a['boat_cg']:.6f}")

    # Sensitivity: nose-cone and boat-tail wall convention (normal vs radial thickness)
    print("=" * 100)
    print("Sensitivity: shell wall measured radially (r_in = r_out - t) instead of normal to the surface")
    for lab, L, R, t, sh in (("R2 ogive", 0.15, 0.027, 0.002, (0.04, 0.0255, 0.002)),
                             ("R4 ogive", 0.2, 0.033, 0.003, (0.05, 0.031, 0.003))):
        xf, rf, _, _, _, _ = tangent_ogive_profile(L, R)
        n = 40000
        outer = [(L * i / n, rf(L * i / n)) for i in range(n + 1)]
        inner = [(x, max(r - t, 0.0)) for x, r in outer]
        Vo, Mo = solid_under(outer)
        Vi, Mi = solid_under(inner)
        vs = tube(sh[0], sh[1], sh[1] - sh[2])
        m = RHO["plastic"] * (Vo - Vi + vs)
        cg = (RHO["plastic"] * (Mo - Mi + vs * (L + sh[0] / 2))) / m
        print(f"   {lab}: radial-wall mass {m:.6f} kg, CG {cg:.6f} m")


if __name__ == "__main__":
    main()
