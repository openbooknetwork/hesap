// Where things sit in the diagram: the circles for one, two or three sets, the region a point lies in, and a free
// spot for an element inside a region.
export const VIEW = { width: 420, height: 400 }, BOX = { x: 8, y: 8, width: 404, height: 384 };
// an element's radius: three circles leave small regions, so their elements are smaller
export const radius = cs => cs.length > 2 ? 15 : 19;

// each circle as x, y, radius and the direction its letter stands in
const CIRCLES = {
  1: [[210, 205, 132, -0.71, -0.71]],
  2: [[150, 205, 118, -0.71, -0.71], [270, 205, 118, 0.71, -0.71]],
  3: [[148, 152, 102, -0.71, -0.71], [272, 152, 102, 0.71, -0.71], [210, 258, 102, 0, 1]],
};
export const circles = names => names.map((name, i) => {
  const [x, y, r, dx, dy] = CIRCLES[names.length][i];
  return { name, x, y, r, label: { x: x + dx * (r + 15), y: y + dy * (r + 15) } };
});

const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// the sets a point lies in
export const zoneAt = (cs, p) => cs.filter(c => far(c, p) < c.r).map(c => c.name);
// a point kept inside the box, an element's radius from its edge
export const clamp = (p, r) => ({ x: Math.min(Math.max(p.x, BOX.x + r), BOX.x + BOX.width - r), y: Math.min(Math.max(p.y, BOX.y + r), BOX.y + BOX.height - r) });
// how far inside a region a point sits: its distance to the nearest border, below zero outside the region
const depth = (cs, zone, p) => Math.min(p.x - BOX.x, BOX.x + BOX.width - p.x, p.y - BOX.y, BOX.y + BOX.height - p.y,
  ...cs.map(c => zone.includes(c.name) ? c.r - far(c, p) : far(c, p) - c.r));

// the point deepest inside a region, where its first element goes
function heart(cs, zone) {
  let best = null, most = -Infinity;
  for (let y = BOX.y; y <= BOX.y + BOX.height; y += 6) for (let x = BOX.x; x <= BOX.x + BOX.width; x += 6) {
    const d = depth(cs, zone, { x, y });
    if (d > most) { most = d; best = { x, y }; }
  }
  return best;
}

// The free spot nearest to want inside a region: clear of the borders and of the other elements. A crowded region
// lets its elements stand closer, and a full one leaves the element where it is.
export function settle(cs, zone, want, others) {
  const r = radius(cs);
  for (const [edge, gap] of [[r + 4, 2 * r + 4], [r + 2, 2 * r], [r * 0.6, r], [1, 0]]) {
    for (let rho = 0; rho < 420; rho += 4) {
      const n = Math.max(1, Math.round(rho * Math.PI / 4));
      for (let k = 0; k < n; k++) {
        const t = 2 * Math.PI * k / n, p = { x: want.x + rho * Math.cos(t), y: want.y + rho * Math.sin(t) };
        if (depth(cs, zone, p) >= edge && others.every(o => far(o, p) >= gap)) return p;
      }
    }
  }
  return want;
}

// Spots for count elements in one region. They fill it one by one from its middle, and when that leaves two of
// them touching they stand in a ring round the middle, which a small region has room for.
export function spots(cs, zone, count, others) {
  const r = radius(cs), mid = heart(cs, zone), one = [];
  for (let i = 0; i < count; i++) one.push(settle(cs, zone, mid, [...others, ...one]));
  if (one.every((p, i) => one.every((q, j) => i === j || far(p, q) >= 2 * r))) return one;
  for (const [edge, gap] of [[r + 4, 2 * r + 4], [r + 2, 2 * r]]) for (let rho = gap / 2; rho < 90; rho += 2) {
    if (2 * rho * Math.sin(Math.PI / count) < gap) continue;
    for (let turn = 0; turn < 12; turn++) {
      const ring = Array.from({ length: count }, (_, i) => { const t = 2 * Math.PI * (i + turn / 12) / count; return { x: mid.x + rho * Math.cos(t), y: mid.y + rho * Math.sin(t) }; });
      if (ring.every(p => depth(cs, zone, p) >= edge && others.every(o => far(o, p) >= gap))) return ring;
    }
  }
  return one;
}
