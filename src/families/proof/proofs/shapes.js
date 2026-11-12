// The proofs draw with these shapes. A shape sits in its own coordinates, and a step moves it with x, y, turn (degrees,
// clockwise on screen) and scale, so a proof writes each shape once and only says where it goes.
export const r2 = n => Math.round(n * 100) / 100;
const rad = deg => deg * Math.PI / 180;

export const poly = (id, points, more = {}) => ({ id, shape: 'poly', points: points.map(([x, y]) => [r2(x), r2(y)]), ...more });
export const line = (id, points, more = {}) => ({ id, shape: 'line', points: points.map(([x, y]) => [r2(x), r2(y)]), ...more });
export const path = (id, d, more = {}) => ({ id, shape: 'path', d, ...more });
export const dot = (id, r, more = {}) => ({ id, shape: 'dot', r: r2(r), ...more });
export const group = (id, more = {}) => ({ id, shape: 'group', ...more });
// a text stays upright whatever turns the pieces that hold it
export const text = (id, say, more = {}) => ({ id, shape: 'text', say: String(say), size: 18, ...more });

// box makes a rectangle of width w and height h around its own middle.
export const box = (id, w, h, more = {}) => poly(id, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], more);

// slice cuts a slice of a disc with its tip at the origin. It runs from the direction `from` to `to`, in degrees
// counterclockwise from the right on screen.
export function slice(id, R, from, to, more = {}) {
  const at = deg => `${r2(R * Math.cos(rad(deg)))} ${r2(-R * Math.sin(rad(deg)))}`;
  return path(id, `M0 0 L${at(from)} A${r2(R)} ${r2(R)} 0 ${to - from > 180 ? 1 : 0} 0 ${at(to)} Z`, more);
}
