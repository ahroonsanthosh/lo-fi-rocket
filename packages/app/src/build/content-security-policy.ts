/**
 * The site's Content-Security-Policy (plan 0061 step 1, D-090), written into the built page as a
 * `<meta http-equiv>` tag because GitHub Pages cannot send headers.
 *
 * The page may run only its own scripts and workers, and may contact only the outside services
 * listed here: the ThrustCurve.org motor catalogue, the OpenStreetMap place search, and the map
 * and terrain tile providers of the 3D replay. Anything else (an injected script, a plugin, an
 * unexpected host) is blocked by the browser. A test checks that every host the source code
 * contacts is listed, so a new service cannot break the site in production unnoticed.
 *
 * A meta tag cannot carry `frame-ancestors` (browsers ignore it there), so framing of the page by
 * another site is not blocked; the page has no account or secret a framing site could abuse
 * (docs/known-limitations.md). The development server runs without the policy: it injects inline
 * scripts for hot reloading.
 */

/** Outside services the page fetches data from, each with what it is for. */
export const CONNECT_HOSTS: Readonly<Record<string, string>> = {
  'https://www.thrustcurve.org': 'motor search and download (ThrustCurve.org API)',
  'https://nominatim.openstreetmap.org': 'place search for the launch site (3D replay)',
  'https://server.arcgisonline.com': 'Esri World Imagery tiles (3D replay)',
  'https://tiles.maps.eox.at': 'Sentinel-2 cloudless tiles (3D replay)',
  'https://tile.openstreetmap.org': 'OpenStreetMap street tiles (3D replay)',
  'https://s3.amazonaws.com': 'terrain height tiles (AWS Terrain Tiles, 3D replay)',
};

/** Map tile hosts, also shown as images by the launch-site map. */
const IMAGE_HOSTS = [
  'https://server.arcgisonline.com',
  'https://tiles.maps.eox.at',
  'https://tile.openstreetmap.org',
];

const DIRECTIVES: readonly (readonly [string, readonly string[]])[] = [
  ['default-src', ["'none'"]],
  ['script-src', ["'self'"]],
  ['worker-src', ["'self'"]],
  // React sets inline styles through the style property, which the policy allows; no <style>
  // element or style attribute is written into the markup.
  ['style-src', ["'self'"]],
  ['font-src', ["'self'"]],
  ['img-src', ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS]],
  ['connect-src', ["'self'", ...Object.keys(CONNECT_HOSTS)]],
  ['manifest-src', ["'self'"]],
  ['object-src', ["'none'"]],
  ['base-uri', ["'none'"]],
  ['form-action', ["'none'"]],
];

/** The policy text for the meta tag. */
export const CONTENT_SECURITY_POLICY = DIRECTIVES.map(
  ([name, sources]) => `${name} ${sources.join(' ')}`,
).join('; ');
