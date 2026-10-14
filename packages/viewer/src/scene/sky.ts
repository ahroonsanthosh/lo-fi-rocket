/**
 * The photographic sky (plan 3d-0002, D-3D-3). The visible sky is a CC0
 * photograph (Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)", see
 * `assets/ASSETS.md`), the ambient light comes from the same photograph's
 * HDR, and the sun light is placed where the sun is in it, so shadows and
 * highlights agree with the sky. Scenery only: nothing here is a flight value.
 *
 * Mapping (flight frame of docs/conventions.md: x east, y north, z up). A
 * direction d has azimuth θ = atan2(d_y, d_x) (anticlockwise from east) and
 * elevation e = asin(d_z). The equirectangular photograph's column u and
 * row v are u = frac((θ − yaw) / 2π + 1/2) and v = 1/2 + e/π (v = 1 at the
 * zenith); `yaw` turns the photograph about the vertical so that its sun
 * stands at `SUN_AZIMUTH`.
 */
import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three';

/** The sun's column in the photograph (centroid of the pixels above half the peak, 1K HDR). */
export const SKY_SUN_U = 0.5952;
/** The sun's elevation in the photograph, radians (47.8°, the same measurement). */
export const SKY_SUN_ELEVATION = (47.8 * Math.PI) / 180;
/** Where the sun is put: south-east (−45° from east), so the default cameras see the rocket side-lit. */
export const SUN_AZIMUTH = -Math.PI / 4;
/** The photograph's turn about the vertical that puts its sun at `SUN_AZIMUTH`, radians. */
export const SKY_YAW = SUN_AZIMUTH - 2 * Math.PI * (SKY_SUN_U - 0.5);
/** The visible-sky image holds rows from the zenith (v = 1) down to this v (3 % below the horizon). */
export const SKY_IMAGE_V0 = 0.47;
/** The photograph's mean colour just above the horizon, sRGB; used for the haze and the fog. */
export const SKY_HAZE = 0x979cab;
/** Gradient sky colours before the photograph has loaded, sRGB. */
export const SKY_ZENITH = 0x4a7fc4;

/** The unit direction of a point of the photograph (column u, elevation e) after the yaw. */
export function skyDirection(u: number, elevation: number, yaw = SKY_YAW): Vector3 {
  const azimuth = 2 * Math.PI * (u - 0.5) + yaw;
  return new Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
  );
}

/** The photograph's (u, v) for a world direction; the inverse of `skyDirection`. */
export function skyUv(
  d: { readonly x: number; readonly y: number; readonly z: number },
  yaw = SKY_YAW,
): { readonly u: number; readonly v: number } {
  const n = Math.hypot(d.x, d.y, d.z);
  const elevation = Math.asin(Math.max(-1, Math.min(1, d.z / n)));
  const a = (Math.atan2(d.y, d.x) - yaw) / (2 * Math.PI) + 0.5;
  return { u: a - Math.floor(a), v: 0.5 + elevation / Math.PI };
}

/** The direction to the sun in the scene, unit length. */
export const SUN_DIRECTION: Readonly<Vector3> = skyDirection(SKY_SUN_U, SKY_SUN_ELEVATION);

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const MAPPING = /* glsl */ `
const float PI = 3.141592653589793;
uniform float yaw;
vec2 skyUv(vec3 d) {
  float e = asin(clamp(d.z, -1.0, 1.0));
  float u = fract((atan(d.y, d.x) - yaw) / (2.0 * PI) + 0.5);
  return vec2(u, 0.5 + e / PI);
}
`;

const DISPLAY_FRAGMENT = /* glsl */ `
${MAPPING}
uniform sampler2D skyMap;
uniform float hasMap;
uniform vec3 zenith;
uniform vec3 haze;
uniform vec3 sunDir;
uniform float v0;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec2 uv = skyUv(d);
  vec3 col;
  if (hasMap > 0.5) {
    vec3 photo = texture2D(skyMap, vec2(uv.x, (uv.y - v0) / (1.0 - v0))).rgb;
    // Below the photograph's lowest row and under the horizon: the haze, as the fog.
    col = mix(photo, haze, smoothstep(0.0, -0.05, d.z));
  } else {
    col = mix(haze, zenith, pow(clamp(d.z, 0.0, 1.0), 0.55));
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += vec3(1.0, 0.95, 0.85) * (pow(s, 900.0) * 4.0 + pow(s, 16.0) * 0.12);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const LIGHT_FRAGMENT = /* glsl */ `
${MAPPING}
uniform sampler2D lightMap;
uniform float clampTo;
uniform vec3 ground;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // The sky's HDR above the horizon, with the sun's disc clamped out (the directional light
  // carries the sun). Below it a "pure sky" HDRI holds a mirror image of the sky, so the
  // light from below is the ground's bounce instead.
  vec3 c = min(texture2D(lightMap, skyUv(d)).rgb, vec3(clampTo));
  gl_FragColor = vec4(mix(c, ground, smoothstep(0.02, -0.08, d.z)), 1.0);
}
`;

function linear(hex: number): Color {
  return new Color().setHex(hex, SRGBColorSpace);
}

/** The visible sky: a dome the caller keeps centred on the camera. */
export class SkyDome {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor(radius: number) {
    this.material = new ShaderMaterial({
      uniforms: {
        skyMap: { value: null },
        hasMap: { value: 0 },
        zenith: { value: linear(SKY_ZENITH) },
        haze: { value: linear(SKY_HAZE) },
        sunDir: { value: SUN_DIRECTION.clone() },
        yaw: { value: SKY_YAW },
        v0: { value: SKY_IMAGE_V0 },
      },
      vertexShader: VERTEX,
      fragmentShader: DISPLAY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      // The photograph is already a finished picture: shown as it is, not tone-mapped again.
      toneMapped: false,
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 64, 32), this.material);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
  }

  /** Show the photograph (an sRGB texture of the upper hemisphere, see `SKY_IMAGE_V0`). */
  setPhoto(texture: Texture): void {
    const u = this.material.uniforms;
    if (u['skyMap'] !== undefined) u['skyMap'].value = texture;
    if (u['hasMap'] !== undefined) u['hasMap'].value = 1;
  }
}

/**
 * A dome showing the HDR photograph in linear radiance, for the renderer to
 * turn into the scene's image-based lighting (PMREM). Values above
 * `clampTo` (the sun's disc) are cut, since the directional light is the sun;
 * below the horizon the light is a ground bounce colour.
 */
export function buildLightDome(hdr: Texture, clampTo = 6): Mesh {
  const m = new ShaderMaterial({
    uniforms: {
      lightMap: { value: hdr },
      yaw: { value: SKY_YAW },
      clampTo: { value: clampTo },
      // Grass-coloured bounce light from below, linear radiance (a drawing choice).
      ground: { value: new Vector3(0.11, 0.12, 0.07) },
    },
    vertexShader: VERTEX,
    fragmentShader: LIGHT_FRAGMENT,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const mesh = new Mesh(new SphereGeometry(100, 64, 32), m);
  mesh.frustumCulled = false;
  return mesh;
}
