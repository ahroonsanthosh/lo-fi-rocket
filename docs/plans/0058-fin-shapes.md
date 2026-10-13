# Plan 0058: elliptical and freeform fins (plan 0055 step 2, physics)

Decision D-087. OpenRocket's elliptical and freeform fin sets are stood in as nothing (major, D-084), so a rocket with them flies without fins. Niskanen gives the aerodynamics of any thin planform (§3.2.2 pp. 25 to 30, §3.3.2, §3.4.2, §3.4.4); this plan implements it. The `.ork` import is plan 0059.

## Model

- `TrapezoidFinSetComponent.shape`: absent for the trapezoid (unchanged, bit-identical); `{ kind: 'elliptical' }`, a half ellipse of the root chord and span, c(y) = c_r √(1 − (y/s)²) centred on the root's mid-chord; `{ kind: 'freeform', points }`, a polygon in fin coordinates (x aft from the root leading edge, y outward from the root), from (0, 0) to (c_r, 0). The root chord and span must agree with the shape.
- `finPlanform(c)`, one place for every planform quantity, the trapezoid's from its existing closed forms:
  - area A_fin (the true area; the normal force uses it, p. 28), the chord c(y) from the leading to the trailing edge (filled across a jagged edge, p. 27) and its area for the MAC integrals;
  - MAC c̄, y_MAC, x_MAC,LE, eqs. (3.30) to (3.32); the subsonic CP at x_MAC,LE + c̄/4 (p. 26);
  - mid-chord sweep Γ_c, the average of the angles between the mid-points of consecutive chords (p. 29), and the leading-edge angle Γ_L, averaged the same way (p. 50);
  - the strip integrals ∫ c(y)(r_t + y)ⁿ dy of the roll damping, eq. (3.69).
    For a polygon every integrand is a polynomial on each span segment between vertices, integrated exactly by five-point Gauss–Legendre per segment; for the ellipse, the closed forms (A = π c_r s/4, c̄ = 8 c_r/(3π), y_MAC = 4s/(3π), x_MAC,LE = c_r/2 − c̄/2, Γ_c = 0) and the substitution y = s sin θ for the rest.
- Mass (GEO-16): the plate's area, first and second moments, exact for a polygon by Green's theorem and in closed form for the ellipse; the same thin-plate inertia as GEO-10.
- Barrowman (BAR-5 to BAR-8, BAR-10), Niskanen supersonic (BAR-11), drag (DRAG-2 friction, DRAG-9 and DRAG-10 fin pressure), pitch damping (AERO-4) and roll damping (AERO-5, AERO-6) read the planform.
- Methods written for trapezoids only (the DATCOM supersonic fin and carry-over, BAR-12 with DATCOM, the DATCOM fin wave drag's quarter-chord sweep, the large-angle method DATCOM 4.1.3.3 and its reversed planform, the TN 4197 flutter speed) use an equivalent trapezoid: the same span, root chord and area (tip chord 2A/s − c_r, at least 0), swept so that its quarter-MAC point is the planform's. Listed as minor for every elliptical or freeform fin set.

## Tests

- A freeform polygon of a trapezoid gives the trapezoid's planform quantities, mass and fin term to 1e-12.
- The ellipse's closed forms by hand; the polygon of 2000 points round an ellipse converges to them.
- A jagged polygon: the true area for the normal force and the filled area for the CP (p. 28).
- The equivalent trapezoid matches area and CP; the approximation is listed.
- Property: no shape moves the CP forward when added (CLAUDE.md 7.3).
- No golden output changes (trapezoids unchanged).
