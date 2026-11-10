/* Project adaptation: CSS superellipse corners for the existing glass optics.
   CSS uses exponent 2**K. The zero contour and its normal match that curve;
   interior bevel depth is a first-order distance approximation, not an exact
   Euclidean signed-distance field. Circular corners retain the original math. */

const cornerNames = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

function parseShape(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'round') return 1;
  if (text === 'squircle') return 2;
  const match = text.match(/^superellipse\(\s*([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*\)$/);
  const k = match ? Number(match[1]) : NaN;
  // The adopted UI uses convex corners. Concave, bevel and square shapes have
  // different optical geometry and intentionally retain the legacy fallback.
  return Number.isFinite(k) && k >= 1 && k <= 3 ? k : null;
}

export function cornerExponentFromStyle(style) {
  const get = (name) => style.getPropertyValue(name).trim();
  const shapes = cornerNames.map(name => get(`corner-${name}-shape`));
  let parsed;
  if (shapes.every(value => !value)) {
    parsed = [parseShape(get('corner-shape'))];
  } else parsed = shapes.map(parseShape);
  if (parsed[0] === null || parsed.some(k => k !== parsed[0])) return 1;
  if (parsed[0] === 1) return 1;
  // Optical maps support a uniform circular-radius box. Do not infer a
  // superellipse for mixed or elliptical radii from just the first corner.
  const radii = cornerNames.map(name => get(`border-${name}-radius`));
  const first = radii[0].split(/\s+/);
  if (!first[0] || first.length > 2 || (first[1] && first[0] !== first[1]) ||
      first[0].endsWith('%') || radii.some(value => value !== radii[0])) return 1;
  return parsed[0];
}

export function opticalShapeKey(radius, k) {
  // A decimal dot inside an SVG id would be read as a class selector by the
  // existing filter refresh query. Keep fractional shape values CSS-id safe.
  return `r${String(radius).replaceAll('.', '_')}-k${String(k).replaceAll('.', '_')}`;
}

export function createCornerField(width, height, radius, k = 1) {
  const hx = width / 2, hy = height / 2;
  const r = Math.max(0, Math.min(radius, hx, hy));
  const p = 2 ** (Number.isFinite(k) && k >= 1 && k <= 3 ? k : 1);
  return (x, y) => {
    const qx = Math.abs(x) - (hx - r), qy = Math.abs(y) - (hy - r);
    const sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1;
    let sd, nx, ny;
    if (p === 2) {
      // Exact original circular field, including the flat interior branch.
      const mx = Math.max(qx, 0), my = Math.max(qy, 0);
      const ol = Math.hypot(mx, my);
      sd = ol + Math.min(Math.max(qx, qy), 0) - r;
      if (qx > 0 || qy > 0) {
        nx = ol > 1e-6 ? mx / ol * sx : 0;
        ny = ol > 1e-6 ? my / ol * sy : 0;
      } else if (qx > qy) { nx = sx; ny = 0; }
      else { nx = 0; ny = sy; }
    } else if (qx <= 0 || qy <= 0) {
      // Most map pixels are on a straight edge or the flat center. Keep this
      // branch free of powers and match the corner's axis tangent exactly.
      sd = Math.max(qx, qy) - r;
      if (qx > qy) { nx = sx; ny = 0; }
      else { nx = 0; ny = sy; }
    } else {
      const length = (qx ** p + qy ** p) ** (1 / p);
      const gx = (qx / length) ** (p - 1), gy = (qy / length) ** (p - 1);
      const gradientLength = Math.hypot(gx, gy);
      sd = (length - r) / gradientLength;
      nx = gx / gradientLength * sx;
      ny = gy / gradientLength * sy;
    }
    return { nx, ny, s: -sd, inside: sd <= 0 };
  };
}
