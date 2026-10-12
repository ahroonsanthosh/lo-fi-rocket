"""Generate packages/physics/src/stability/datcom-large-angle-data.ts from reference/digitised/datcom-large-angle-charts.json. Usage: python3 -I tools/gen-datcom-large-angle-data.py <repository root>; then run prettier on the output."""
import json, sys
root = sys.argv[1]
d = json.load(open(f'{root}/reference/digitised/datcom-large-angle-charts.json'))['charts']
def pts(p): return '[' + ', '.join(f'[{a}, {b}]' for a, b in p) + ']'
out = ['''/**
 * Digitised USAF DATCOM (1978) charts for the normal force and centre of
 * pressure of bodies and fins at large angles of attack (plan 0033, HA-1 to
 * HA-10, D-070). Generated from
 * `reference/digitised/datcom-large-angle-charts.json` (build script
 * `build-datcom-large-angle.py` beside it, two passes per chart); a formats
 * test checks every number against that file. Values are pass 2 (pixel
 * extraction); `uncertainty` is the larger of 0.01 (0.02 for figure 55a) and the
 * worst disagreement with pass 1, in ordinate units.
 */

export type ChartPoints = readonly (readonly [number, number])[];

export interface LabelledCurve {
  /** The curve's label (J, Δy, ...). */
  readonly label: number;
  readonly uncertainty: number;
  readonly points: ChartPoints;
}

export interface TwoFamilyChart {
  /** Abscissa up to which the left label set applies (all five curves drawn). */
  readonly leftUntil: number;
  readonly left: readonly LabelledCurve[];
  readonly right: readonly LabelledCurve[];
}
''']
def single(name, key, doc):
    c = d[key]
    out.append(f'/** {doc} Uncertainty {c["uncertainty"]}. */\nexport const {name}: ChartPoints = Object.freeze({pts(c["points"])});\n')
def curves(cs):
    items = sorted(cs.items(), key=lambda kv: float(kv[0]))
    return '[\n' + ''.join(f'  {{ label: {float(k)}, uncertainty: {v["uncertainty"]}, points: {pts(v["points"])} }},\n' for k, v in items) + ']'
single('DATCOM_FIGURE_4212_35A', '4.2.1.2-35a', 'Figure 4.2.1.2-35a: [body fineness ratio, η].')
single('DATCOM_FIGURE_4212_35B', '4.2.1.2-35b', 'Figure 4.2.1.2-35b: [k, c_dc], k = 10 M_c for M_c ≤ 1 and 20 − 10/M_c above.')
out.append(f'/** Figure 4.1.3.3-55a left: ΔC_Naa (per rad) against tan α/tan α_CLmax, curves of J (ascending). */\nexport const DATCOM_FIGURE_4133_55A: readonly LabelledCurve[] = ({curves(d["4.1.3.3-55a-left"]["curves"])});\n')
single('DATCOM_FIGURE_4133_55A_D', '4.1.3.3-55a-right', 'Figure 4.1.3.3-55a right: [tan α_CLmax/tan α, D].')
single('DATCOM_FIGURE_4133_55B', '4.1.3.3-55b', 'Figure 4.1.3.3-55b: [k, C_N at 90°], k = 10 A for A ≤ 1 and 20 − 10/A above.')
for name, key, doc in (('DATCOM_FIGURE_4134_23A', '4.1.3.4-23a', 'maximum thickness at or forward of 35 % chord'), ('DATCOM_FIGURE_4134_23B', '4.1.3.4-23b', 'maximum thickness between 35 and 50 % chord')):
    c = d[key]
    out.append(f'/** Figure {key}: (C_Lmax)_base against (C₁ + 1)(A/β) cos Λ_LE, curves of Δy; {doc}. */\nexport const {name}: TwoFamilyChart = {{\n  leftUntil: {c["left_until"]},\n  left: {curves(c["left"])},\n  right: {curves(c["right"])},\n}};\n')

if '4.1.3.4-24a' in d:
    out.append(f'/** Figure 4.1.3.4-24a: ΔC_Lmax against (C₂ + 1) A tan Λ_LE, curves of Mach number (0.2 is M ≤ 0.2). */\nexport const DATCOM_FIGURE_4134_24A: readonly LabelledCurve[] = ({curves(d["4.1.3.4-24a"]["curves"])});\n')
    single('DATCOM_FIGURE_4134_24B_C1', '4.1.3.4-24b-C1', 'Figure 4.1.3.4-24b: [taper ratio, C₁].')
    single('DATCOM_FIGURE_4134_24B_C2', '4.1.3.4-24b-C2', 'Figure 4.1.3.4-24b: [taper ratio, C₂].')
    single('DATCOM_FIGURE_4134_25A', '4.1.3.4-25a', 'Figure 4.1.3.4-25a: [(C₁ + 1)(A/β) cos Λ_LE, (α_CLmax)_base in degrees].')
    c = d['4.1.3.4-25b']
    out.append(f'/** Figure 4.1.3.4-25b: Δα_CLmax (degrees) against (C₂ + 1) A tan Λ_LE; left curves of A cos Λ_LE [1 + (2λ)²] (10 is the printed 10-30 envelope), right curves of Mach number. */\nexport const DATCOM_FIGURE_4134_25B: TwoFamilyChart = {{\n  leftUntil: {c["left_until"]},\n  left: {curves(c["left"])},\n  right: {curves(c["right"])},\n}};\n')

if '4.1.4.3-21a' in d:
    single('DATCOM_FIGURE_4143_21A', '4.1.4.3-21a', 'Figure 4.1.4.3-21a: [Δy, (x_cp/c_r)₁] (drawn from Δy = 0.157).')
    single('DATCOM_FIGURE_4143_21B', '4.1.4.3-21b', 'Figure 4.1.4.3-21b: [taper ratio, C₃].')
    for name, key, doc in (('DATCOM_FIGURE_4143_22A', '4.1.4.3-22a', 'Δ(x_cp/c_r)₂ against (C₃ + 1) A tan Λ_LE, curves of A'),
                           ('DATCOM_FIGURE_4143_22B', '4.1.4.3-22b', 'stability index against taper ratio, lines of A tan Λ_LE'),
                           ('DATCOM_FIGURE_4143_23A', '4.1.4.3-23a', 'Δ(x_cp/c_r)₃ against stability index, curves of tan α/tan α_CLmax'),
                           ('DATCOM_FIGURE_4143_23B', '4.1.4.3-23b', 'Δ(x_cp/c_r)₃ against stability index, curves of tan α_CLmax/tan α'),
                           ('DATCOM_FIGURE_4143_24A', '4.1.4.3-24a', 'aspect-ratio index against taper ratio, curves of A cos Λ_LE'),
                           ('DATCOM_FIGURE_4143_24B_PRE', '4.1.4.3-24b-pre', 'Δ(x_cp/c_r)₄ against aspect-ratio index, curves of tan α/tan α_CLmax'),
                           ('DATCOM_FIGURE_4143_24B_POST', '4.1.4.3-24b-post', 'Δ(x_cp/c_r)₄ against aspect-ratio index, curves of tan α_CLmax/tan α')):
        out.append(f'/** Figure {key.replace("-pre","").replace("-post","")}: {doc}. */\nexport const {name}: readonly LabelledCurve[] = ({curves(d[key]["curves"])});\n')
open(f'{root}/packages/physics/src/stability/datcom-large-angle-data.ts', 'w').write('\n'.join(out))
