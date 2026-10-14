/**
 * What each part field means, its dimension and its plain label (plan 0062). The keys must be
 * exactly the design file's (COMPONENT_FIELDS in packages/formats, checked by a test), so the tool
 * schemas built from this table accept what a design file accepts and nothing else.
 */
import type { ComponentKind } from '@lo-fi-rocket/formats';
import type { Dimension } from './quantity.js';

export interface FieldSpec {
  readonly label: string;
  /** A quantity's dimension, or the kind of value for the others. */
  readonly type:
    Dimension | 'integer' | 'noseShape' | 'finSection' | 'shoulder' | 'tab' | 'fillet' | 'finShape';
  readonly description: string;
}

const NOSE_SHAPE_TEXT =
  'Profile: conical, ogive, elliptical, parabolic, power or haack (Niskanen 2009 Appendix A).';
const SHAPE_PARAMETER: FieldSpec = {
  label: 'shape parameter',
  type: 'number',
  description:
    'κ of the profile: ogive 0 < κ ≤ 1 (1 = tangent ogive), parabolic 0 ≤ κ ≤ 1, power 0 < κ ≤ 1, Haack 0 ≤ κ ≤ 1/3 (0 = Von Kármán, 1/3 = LV-Haack). Ignored for conical and elliptical.',
};
const DENSITY: FieldSpec = {
  label: 'density',
  type: 'density',
  description:
    "Bulk density of the material. The app has no sourced table of materials: use the maker's figure or a weighed part; if you estimate it, say so with note_assumption.",
};
const TUBE = (what: string): Record<string, FieldSpec> => ({
  length: { label: 'length', type: 'length', description: `Length of the ${what}.` },
  outerRadius: {
    label: 'outer radius',
    type: 'length',
    description: `Outer radius of the ${what} (half the outside diameter).`,
  },
  wallThickness: {
    label: 'wall thickness',
    type: 'length',
    description: `Wall thickness of the ${what}.`,
  },
  density: DENSITY,
  radialOffset: {
    label: 'radial offset',
    type: 'length',
    description: `Distance from the rocket's axis to the ${what}'s own axis; leave out for a tube on the axis.`,
  },
});
const RING = (what: string): Record<string, FieldSpec> => ({
  length: {
    label: 'thickness',
    type: 'length',
    description: `Thickness of the ${what} along the rocket's axis.`,
  },
  outerRadius: {
    label: 'outer radius',
    type: 'length',
    description: `Outer radius of the ${what}.`,
  },
  innerRadius: {
    label: 'inner radius',
    type: 'length',
    description:
      what === 'bulkhead'
        ? 'Inner radius; 0 for a solid bulkhead.'
        : 'Inner radius (the hole for the motor tube).',
  },
  density: DENSITY,
});
const MASS_ITEM = (what: string): Record<string, FieldSpec> => ({
  mass: { label: 'mass', type: 'mass', description: `Mass of the ${what}.` },
  length: {
    label: 'length',
    type: 'length',
    description: `Length the ${what} occupies along the axis.`,
  },
  radius: {
    label: 'radius',
    type: 'length',
    description: `Radius of the ${what} (a solid cylinder).`,
  },
});

export const PART_FIELDS: Readonly<Record<ComponentKind, Readonly<Record<string, FieldSpec>>>> = {
  noseCone: {
    shape: { label: 'shape', type: 'noseShape', description: NOSE_SHAPE_TEXT },
    length: {
      label: 'length',
      type: 'length',
      description: 'Length from the tip to the base, without the shoulder.',
    },
    baseRadius: { label: 'base radius', type: 'length', description: 'Outer radius at the base.' },
    density: DENSITY,
    shapeParameter: SHAPE_PARAMETER,
    wallThickness: {
      label: 'wall thickness',
      type: 'length',
      description: 'Wall thickness of a hollow nose cone; leave out for a solid one.',
    },
    aftShoulder: {
      label: 'shoulder',
      type: 'shoulder',
      description:
        'The shoulder that fits into the body tube: length, radius (outer) and wall thickness.',
    },
  },
  transition: {
    shape: { label: 'shape', type: 'noseShape', description: NOSE_SHAPE_TEXT },
    length: { label: 'length', type: 'length', description: 'Length along the axis.' },
    foreRadius: {
      label: 'fore radius',
      type: 'length',
      description: 'Outer radius at the forward end.',
    },
    aftRadius: { label: 'aft radius', type: 'length', description: 'Outer radius at the aft end.' },
    density: DENSITY,
    shapeParameter: SHAPE_PARAMETER,
    wallThickness: {
      label: 'wall thickness',
      type: 'length',
      description: 'Wall thickness of a hollow transition; leave out for a solid one.',
    },
  },
  bodyTube: TUBE('body tube'),
  innerTube: TUBE('inner tube'),
  launchLug: TUBE('launch lug'),
  centeringRing: RING('centering ring'),
  bulkhead: RING('bulkhead'),
  massComponent: MASS_ITEM('mass (ballast, altimeter, payload)'),
  parachute: MASS_ITEM('packed parachute or streamer'),
  finSet: {
    count: {
      label: 'number of fins',
      type: 'integer',
      description: 'Number of fins, equally spaced round the body.',
    },
    rootChord: { label: 'root chord', type: 'length', description: 'Chord along the body.' },
    tipChord: {
      label: 'tip chord',
      type: 'length',
      description: 'Chord at the tip (0 for a pointed fin).',
    },
    sweep: {
      label: 'sweep',
      type: 'length',
      description:
        'Leading-edge sweep length: axial distance from the root leading edge to the tip leading edge.',
    },
    span: { label: 'span', type: 'length', description: 'Height of one fin from root to tip.' },
    thickness: { label: 'thickness', type: 'length', description: 'Fin thickness.' },
    density: DENSITY,
    bodyRadius: {
      label: 'body radius at the root',
      type: 'length',
      description:
        'Outer radius of the body where the fins sit; worked out from the body tube there when left out.',
    },
    crossSection: {
      label: 'cross-section',
      type: 'finSection',
      description: 'Edge profile: square, rounded, airfoil, wedge or double-wedge.',
    },
    shearModulus: {
      label: 'shear modulus',
      type: 'pressure',
      description:
        'Shear modulus of the fin material, for the flutter speed only; flutter is not evaluated without it.',
    },
    tab: {
      label: 'fin tab',
      type: 'tab',
      description:
        'Tab into the body: height inward from the body surface, length along the axis, fore offset aft of the root leading edge. Mass only.',
    },
    fillet: {
      label: 'fin fillets',
      type: 'fillet',
      description:
        'Fillets along both sides of each fin root: {radius, density} (e.g. {"radius":"6 mm","density":"680 kg/m3"} for cardboard-filled glue). Mass only, by exact geometry (GEO-19).',
    },
    shape: {
      label: 'planform',
      type: 'finShape',
      description:
        'A planform other than the trapezoid: {"kind":"elliptical"}, or {"kind":"freeform","points":[{x,y},…]} from the root leading edge (0,0) round to the root trailing edge (rootChord,0), x aft and y outward. The root chord and span must agree with it.',
    },
  },
  railButton: {
    count: {
      label: 'number of buttons',
      type: 'integer',
      description: 'Number of rail buttons in a line.',
    },
    outerDiameter: {
      label: 'outer diameter',
      type: 'length',
      description: 'Diameter of the base and the flange.',
    },
    innerDiameter: {
      label: 'inner diameter',
      type: 'length',
      description: 'Diameter of the shaft between them.',
    },
    totalHeight: {
      label: 'total height',
      type: 'length',
      description: 'Height from the body surface to the top of the flange.',
    },
    baseHeight: { label: 'base height', type: 'length', description: 'Height of the base.' },
    flangeHeight: { label: 'flange height', type: 'length', description: 'Height of the flange.' },
    density: DENSITY,
    bodyRadius: {
      label: 'body radius',
      type: 'length',
      description:
        'Outer radius of the body under the buttons; worked out from the body tube there when left out.',
    },
    separation: {
      label: 'separation',
      type: 'length',
      description: 'Distance between successive buttons along the axis.',
    },
  },
};

/** What a part kind is, for the tool descriptions. */
export const PART_KINDS: Readonly<Record<ComponentKind, string>> = {
  noseCone: 'nose cone',
  transition: 'transition (shoulder or boat tail between two diameters)',
  bodyTube: 'body tube (sets the outline)',
  innerTube: 'inner tube (motor mount tube, coupler)',
  launchLug: 'launch lug on the outside of the body',
  centeringRing: 'centering ring',
  bulkhead: 'bulkhead',
  massComponent: 'mass item inside the rocket (altimeter, ballast, payload)',
  parachute: 'packed parachute or streamer (its mass; the canopy is set with set_recovery)',
  finSet: 'fin set',
  railButton: 'rail buttons',
};
