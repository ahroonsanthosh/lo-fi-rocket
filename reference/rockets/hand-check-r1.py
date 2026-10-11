#!/usr/bin/env python3
"""Independent hand check of reference rocket R1 (r1-three-fin-conical).

Computes the liftoff centre of gravity from the plain-number specification in
README.md and the Barrowman centre of pressure from the equations in Niskanen
(2009), chapter 3, as cited in hand-checks.md. It does not use OpenRocket or
any code from packages/. Run with: python3 -I hand-check-r1.py
"""
from math import pi, sqrt, atan, cos

# ---------------- specification (metres, kilograms) ----------------
R = 0.025            # body radius
L_nose = 0.100       # conical nose length (solid balsa)
rho_balsa = 160.0
L_body = 0.500; t_body = 0.001; rho_paper = 700.0
N = 3; c_r = 0.100; c_t = 0.050; x_t = 0.050; s = 0.080; t_fin = 0.003; rho_ply = 600.0
m_noseweight = 0.030; x_noseweight = 0.100; l_noseweight = 0.020
L_lug = 0.050; r_lug_o = 0.003; r_lug_i = 0.0025; x_lug = 0.100 + 0.250
L_mount = 0.075; r_mount_o = 0.0125; t_mount = 0.0005; x_mount = 0.100 + 0.425
L_ring = 0.005; r_ring_o = 0.024; r_ring_i = 0.0125; x_rings = [0.100 + 0.430, 0.100 + 0.490]
m_chute = 0.010; x_chute = 0.100 + 0.100; l_chute = 0.050
m_motor = 0.0426; L_motor = 0.070      # Estes D12 .eng header: total mass 0.0426 kg, length 70 mm
x_motor_aft = L_nose + L_body          # motor aft end flush with the rocket's aft end (overhang 0)

# ---------------- masses and centres of gravity ----------------
parts = []
# Solid cone: V = pi R^2 L / 3, CG at 3L/4 from the tip.
V_nose = pi * R**2 * L_nose / 3
parts.append(("nose cone (solid cone)", rho_balsa * V_nose, 0.75 * L_nose))
# Tube shell: V = pi (R^2 - (R-t)^2) L, CG at mid-length.
V_body = pi * (R**2 - (R - t_body)**2) * L_body
parts.append(("body tube", rho_paper * V_body, L_nose + L_body / 2))
# Trapezoidal fin: planform area A = (c_r + c_t)/2 * s, volume A t, CG at the planform centroid.
A_fin = (c_r + c_t) / 2 * s
# Centroid of the trapezoid measured from the root leading edge, in the chord direction:
# x_c = [ integral over span of (x_LE(y) + c(y)/2) c(y) dy ] / A_fin with x_LE(y) = x_t y/s,
# c(y) = c_r + (c_t - c_r) y/s. Closed form below (evaluated numerically for transparency).
n = 100000
xc_num = 0.0
for k in range(n):
    y = (k + 0.5) / n * s
    c = c_r + (c_t - c_r) * y / s
    x_le = x_t * y / s
    xc_num += (x_le + c / 2) * c * (s / n)
x_c_fin = xc_num / A_fin
x_fin_root_le = L_nose + L_body - c_r      # trailing edge flush with the body tube aft end
parts.append(("fins (3)", N * rho_ply * A_fin * t_fin, x_fin_root_le + x_c_fin))
parts.append(("nose weight", m_noseweight, x_noseweight + l_noseweight / 2))
V_lug = pi * (r_lug_o**2 - r_lug_i**2) * L_lug
parts.append(("launch lug", rho_paper * V_lug, x_lug + L_lug / 2))
V_mount = pi * (r_mount_o**2 - (r_mount_o - t_mount)**2) * L_mount
parts.append(("motor mount tube", rho_paper * V_mount, x_mount + L_mount / 2))
V_ring = pi * (r_ring_o**2 - r_ring_i**2) * L_ring
for x in x_rings:
    parts.append((f"centering ring at {x:.3f}", rho_paper * V_ring, x + L_ring / 2))
parts.append(("parachute (mass override)", m_chute, x_chute + l_chute / 2))

m_struct = sum(m for _, m, _ in parts)
cg_struct = sum(m * x for _, m, x in parts) / m_struct
# Motor: mass from the .eng header, CG at the motor's mid-length (OpenRocket's RASP assumption).
x_motor_cg = x_motor_aft - L_motor / 2
m_launch = m_struct + m_motor
cg_launch = (m_struct * cg_struct + m_motor * x_motor_cg) / m_launch

print("Component masses and CG positions (x from nose tip):")
for name, m, x in parts:
    print(f"  {name:28s} m = {m:.6f} kg   x_cg = {x:.6f} m")
print(f"  {'motor D12 at launch':28s} m = {m_motor:.6f} kg   x_cg = {x_motor_cg:.6f} m")
print(f"structure mass = {m_struct:.6f} kg, structure CG = {cg_struct:.6f} m")
print(f"liftoff mass   = {m_launch:.6f} kg, liftoff CG   = {cg_launch:.6f} m")

# ---------------- Barrowman centre of pressure ----------------
A_ref = pi * R**2
M = 0.3
beta = sqrt(1 - M**2)
# Nose cone: CN_alpha = 2 [A(l) - A(0)]/A_ref = 2 (Niskanen eq. 3.19); CP of a cone at 2L/3 (eq. 3.28 with V = pi R^2 L/3).
CNa_nose = 2.0 * (pi * R**2 - 0.0) / A_ref
V_cone = pi * R**2 * L_nose / 3
X_nose = L_nose - V_cone / (pi * R**2)            # eq. 3.28: X = l - V/A(l)  (X = 2L/3 for a cone)
# Body tube: A(l) = A(0), so CN_alpha = 0.
# Fins: Niskanen eq. 3.34 for the CP of a trapezoidal fin (from the root leading edge).
X_f = x_t / 3 * (c_r + 2 * c_t) / (c_r + c_t) + (1 / 6) * (c_r**2 + c_t**2 + c_r * c_t) / (c_r + c_t)
X_fins = x_fin_root_le + X_f
# Single-fin CN_alpha, Niskanen eq. 3.37 with eqs. 3.38 to 3.40 (Diederich), subsonic:
# CN_alpha0 = 2 pi / beta, F_D = AR / (CN_alpha0/(2 pi) cos Gamma_c) with AR = 2 s^2 / A_fin.
Gamma_c = atan((x_t + c_t / 2 - c_r / 2) / s)      # mid-chord sweep angle
AR = 2 * s**2 / A_fin
CNa0 = 2 * pi / beta
F_D = AR / (CNa0 / (2 * pi) * cos(Gamma_c))
CNa_1 = CNa0 * F_D * (A_fin / A_ref) * cos(Gamma_c) / (2 + F_D * sqrt(1 + 4 / F_D**2))
# N = 3 fins, Niskanen eq. 3.54: (CN_alpha)_3 = 1.50 (CN_alpha)_1 [1 - 0.15 cos^2(3/2 theta)].
CNa_3_max = 1.50 * CNa_1                            # roll angle where the cosine term vanishes
CNa_3_min = 1.50 * CNa_1 * (1 - 0.15)               # roll angle where it is largest
# Fin-body interference, Niskanen eqs. 3.55 and 3.56: K_T(B) = 1 + r_t/(s + r_t).
K_TB = 1 + R / (s + R)
for label, CNa_fins in (("no roll reduction (factor 1.50)", CNa_3_max), ("15 % roll reduction (factor 1.275)", CNa_3_min)):
    CNa_fins_B = K_TB * CNa_fins
    CNa_total = CNa_nose + CNa_fins_B
    X_cp = (CNa_nose * X_nose + CNa_fins_B * X_fins) / CNa_total
    print(f"\nCP with {label}:")
    print(f"  nose: CN_alpha = {CNa_nose:.4f}, X = {X_nose:.6f} m")
    print(f"  fins: Gamma_c = {Gamma_c*180/pi:.3f} deg, AR = {AR:.4f}, beta = {beta:.6f}, CN_alpha0 = {CNa0:.4f}, F_D = {F_D:.4f}")
    print(f"        (CN_alpha)_1 = {CNa_1:.4f}, (CN_alpha)_N = {CNa_fins:.4f}, K_T(B) = {K_TB:.6f}, (CN_alpha)_T(B) = {CNa_fins_B:.4f}")
    print(f"        X_f = {X_f:.6f} m from root LE, X_fins = {X_fins:.6f} m from nose tip")
    print(f"  total CN_alpha = {CNa_total:.4f}, CP = {X_cp:.6f} m, stability = {(X_cp - cg_launch) / (2 * R):.4f} cal")
