"""Merge the two digitisation passes of TR R-100 Figure 12 (D-053): convert pass 2 pixels
to values through its calibration, pair with pass 1 at common Mach numbers, record the
disagreement per point, and write the merged data the model reads (mean of the passes,
with the disagreement and a per-curve uncertainty = max(|pass1 - pass2|/2, 0.005))."""
import json, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
p1 = json.load(open('tr-r-100-figure-12-pass1.json'))
p2 = json.load(open('tr-r-100-figure-12-pass2.json'))
cal = p2['calibration']
def yval(panel, px):
    y = cal['b']['y'] if panel == 'b' else cal['a']['y'][panel]
    hi, lo = (y['0.1'], y['0']) if panel != 'b' else (y['0.1'], y['0'])
    return (lo - px) / (lo - hi) * 0.1
# Curve identity in panel (b). Both passes read panel (b) with the panel-(a) line-style rule
# (solid = Von Karman, dashed = x^3/4). The report's text (p. 13, "Nose shapes") describes the
# x^3/4 nose as showing "the early drag rise and early sharp peak drag and the rapid decrease of
# drag with Mach number" and the Von Karman nose as "late drag rise, 'soft' peak and low
# peak-drag level, and decreasing supersonic drag". In panel (b) the solid curve has the early
# sharp peak (0.12 at Mach 1.05) and the dashed curve the late soft rise, and the values of the
# solid curve agree with panel (a)'s x^3/4 (configuration 61, identified by its leader and
# square symbols) within 0.008 above Mach 1 (0.017 in the rise at Mach 0.95, where panel (b)'s
# Mach scale is three times coarser) while the dashed curve agrees with panel (a)'s Von Karman
# (configuration 60) within 0.011. The panel-(b) line styles are therefore the reverse of
# panel (a)'s, and the readings are relabelled here: the pass files keep the keys under which
# they were read, the merged file carries the corrected identity (D-055).
PANEL_B_IDENTITY = {"von-karman-b": "power-3/4-b", "power-3/4-b": "von-karman-b"}
merged = {"source": p1['source'], "passes": [p1['method'], p2['method']], "note": "value = mean of the two passes; disagreement = |pass1 - pass2|; uncertainty = max(disagreement/2, 0.005) per curve as the larger of half the worst disagreement and the grid reading floor. Panel (b) curves: the keys 'von-karman-b' and 'power-3/4-b' of the pass files are swapped here (the panel-(b) line styles are the reverse of panel (a)'s; see merge-tr-r-100.py and D-055); the merged keys name the correct nose.", "curves": {}}
worst_all = 0
for name, c2 in p2['pixel_readings'].items():
    c1 = p1['curves'][name]
    v1 = {round(m, 3): v for m, v in c1['points']}
    pts = []
    worst = 0
    for m, px in c2['points']:
        v2 = round(yval(c2['panel'], px), 4)
        m = round(m, 3)
        if m in v1:
            d = abs(v1[m] - v2)
            worst = max(worst, d)
            pts.append({"mach": m, "pass1": v1[m], "pass2": v2, "value": round((v1[m] + v2) / 2, 4), "disagreement": round(d, 4)})
        else:
            pts.append({"mach": m, "pass1": None, "pass2": v2, "value": v2, "disagreement": None})
    worst_all = max(worst_all, worst)
    out = PANEL_B_IDENTITY.get(name, name)
    merged['curves'][out] = {"panel": c2['panel'], "read_as": name, "worst_disagreement": round(worst, 4), "uncertainty": round(max(worst / 2, 0.005), 4), "points": pts}
    print(f"{name:14s} -> {out:14s} worst disagreement {worst:.3f}  n={len(pts)}")
print("worst over all curves", round(worst_all, 3))
# Cross-panel check of the two noses that appear in both panels.
def at(curve, m):
    pts = {p['mach']: p['value'] for p in merged['curves'][curve]['points']}
    return pts.get(m)
cross = {}
for a, b in (("power-3/4", "power-3/4-b"), ("von-karman-a", "von-karman-b")):
    rows = []
    for m in (0.9, 0.95, 1.0, 1.05, 1.1, 1.2, 1.4, 1.6, 2.0):
        va, vb = at(a, m), at(b, m)
        if va is not None and vb is not None:
            rows.append({"mach": m, "panel_a": va, "panel_b": vb, "difference": round(vb - va, 4)})
    cross[a] = rows
    print(a, "vs", b, "max |difference|", max(abs(r['difference']) for r in rows))
merged['cross_panel_check'] = {"note": "the same nose read in both panels after the identity correction; the model uses the panel (a) curves (finer scale) for these two noses", "comparison": cross}
json.dump(merged, open('tr-r-100-figure-12.json', 'w'), indent=1)
