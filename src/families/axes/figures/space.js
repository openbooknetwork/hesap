// What the figures in space share: three axes the reader can turn, a point, and the walk to it from the origin
// along x, then y, then z. The point stands at the sliders' x, y and z, or where a figure's own rule puts it.
export function space({ board, values, colors, spec, coords, note }, { at = () => [values().x, values().y, values().z], walk = true } = {}) {
  const { x, y, z } = spec.view;
  const axis = name => ({ name, strokeColor: colors.ink2, strokeWidth: 1.5, label: { strokeColor: colors.ink2, fontSize: 14 } }), plane = { polyhedron: { strokeColor: colors.rule, strokeOpacity: 0.8, fillOpacity: 0.06, fillColorArray: [colors.ink2], shader: { enabled: false } } }; // the three back walls, in the theme's tones
  const view = board.create('view3d', [[-4.5, -4.5], [9, 8.5], [x, y, z]], { projection: 'parallel', axesPosition: 'center',
    xAxis: axis('x'), yAxis: axis('y'), zAxis: axis('z'), xPlaneRear: plane, yPlaneRear: plane, zPlaneRear: plane,
    az: { slider: { visible: false, start: 0.9 } }, el: { slider: { visible: false, start: 0.35 } }, bank: { slider: { visible: false } } });
  const hidden = { visible: false, withLabel: false, fixed: true }, corner = f => view.create('point3d', [0, 1, 2].map(k => () => f()[k]), hidden);
  const line = (a, b, attrs) => view.create('line3d', [a, b], { straightFirst: false, straightLast: false, fixed: true, highlight: false, ...attrs });
  const O = corner(() => [0, 0, 0]), X = corner(() => [at()[0], 0, 0]), XY = corner(() => [at()[0], at()[1], 0]);
  const P = view.create('point3d', [0, 1, 2].map(k => () => at()[k]), { name: 'P', size: 5, fixed: true, fillColor: colors.accent, strokeColor: colors.accent, label: { strokeColor: colors.ink, fontSize: 15 } });
  if (walk) for (const [a, b] of [[O, X], [X, XY], [XY, P]]) line(a, b, { strokeColor: colors.accent, strokeWidth: 2, dash: 2 });
  // a curve in space, given by a point for every t from 0 to 1
  const curve = (f, attrs) => view.create('curve3d', [...[0, 1, 2].map(k => t => f(t)[k]), [0, 1]], { fixed: true, highlight: false, ...attrs });
  const flat = p => { const w = view.project3DTo2D(p); return [w[1], w[2]]; };
  note({ id: 'point', at: () => flat(at()), near: () => { const p = flat(at()); return [p[0] + 1.6, p[1] + 0.9]; }, say: () => coords(at()) });
  return { view, O, P, XY, line, curve, flat, at };
}
