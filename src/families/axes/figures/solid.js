// What the solids share: a view of space the reader can turn, corners that follow the sliders, the faces, edges and
// curves drawn between them, and a marked length with its label.
export function stage({ board, colors, spec, note }) {
  const { x, y, z } = spec.view, hide = { visible: false }, still = { fixed: true, highlight: false };
  const view = board.create('view3d', [[-4.5, -4.5], [9, 8.5], [x, y, z]], { projection: 'parallel', axesPosition: 'none', xPlaneRear: hide, yPlaneRear: hide, zPlaneRear: hide,
    az: { slider: { visible: false, start: 0.6 } }, el: { slider: { visible: false, start: 0.45 } }, bank: { slider: { visible: false } } });
  const corner = f => view.create('point3d', [0, 1, 2].map(k => () => f()[k]), { visible: false, withLabel: false, fixed: true });
  const face = (corners, attrs = {}) => view.create('polygon3d', corners, { ...still, fillColor: colors.accent, fillOpacity: 0.13, borders: { ...still, strokeColor: colors.ink, strokeWidth: 2 }, ...attrs });
  const line = (a, b, attrs = {}) => view.create('line3d', [a, b], { ...still, straightFirst: false, straightLast: false, strokeColor: colors.ink, strokeWidth: 2, ...attrs });
  // a curve in space, given by a point for every t from 0 to 1
  const curve = (f, attrs = {}) => view.create('curve3d', [...[0, 1, 2].map(k => t => f(t)[k]), [0, 1]], { ...still, strokeColor: colors.ink, strokeWidth: 2, ...attrs });
  const flat = p => { const w = view.project3DTo2D(p); return [w[1], w[2]]; };
  // a length the page talks about: a line in the accent colour with its label beside the middle
  const mark = (id, from, to, say, [dx, dy] = [0.5, 0.5], attrs = {}) => {
    line(corner(from), corner(to), { strokeColor: colors.accent, strokeWidth: 4, ...attrs });
    const mid = () => flat(from().map((n, k) => (n + to()[k]) / 2));
    note({ id, at: mid, near: () => { const p = mid(); return [p[0] + dx, p[1] + dy]; }, say });
  };
  return { view, corner, face, line, curve, flat, mark, faint: { strokeColor: colors.ink2, strokeWidth: 1 } };
}

// a point on a circle of radius r at height z, a share t of the way round
export const round = (r, t, z) => [r * Math.cos(2 * Math.PI * t), r * Math.sin(2 * Math.PI * t), z];
// the steps of a formula: its name, its rule, the rule with the page's numbers, and the result
export const steps = (name, rule, filled, value, m) => [name, `= ${rule}`, `= ${filled}`, `${m.rel(value)} ${m.n(value)}`];
