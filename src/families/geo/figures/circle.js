// A circle on the origin from its radius, with a sector cut by an angle at the centre.
const RAD = Math.PI / 180;
const measures = {
  area: v => Math.PI * v.radius ** 2,
  circumference: v => 2 * Math.PI * v.radius,
  diameter: v => 2 * v.radius,
  'sector-area': v => Math.PI * v.radius ** 2 * v.angle / 360,
  'arc-length': v => 2 * Math.PI * v.radius * v.angle / 360,
};

// each formula keeps π as a symbol up to its last step, so doubling the radius shows 4π turn into 16π
const formulas = {
  area: (v, m) => ['A', '= \\pi r^2', `= \\pi \\times ${m.n(v.radius)}^2`, `= ${m.n(v.radius ** 2)}\\pi`, `\\approx ${m.n(measures.area(v))}`],
  circumference: (v, m) => ['C', '= 2 \\pi r', `= 2 \\pi \\times ${m.n(v.radius)}`, `= ${m.n(2 * v.radius)}\\pi`, `\\approx ${m.n(measures.circumference(v))}`],
  'sector-area': (v, m) => ['A_s', '= \\frac{\\theta}{360^\\circ} \\times \\pi r^2', `= \\frac{${m.n(v.angle)}^\\circ}{360^\\circ} \\times ${m.n(v.radius ** 2)}\\pi`, `\\approx ${m.n(measures['sector-area'](v))}`],
  'arc-length': (v, m) => ['L', '= \\frac{\\theta}{360^\\circ} \\times 2 \\pi r', `= \\frac{${m.n(v.angle)}^\\circ}{360^\\circ} \\times ${m.n(2 * v.radius)}\\pi`, `\\approx ${m.n(measures['arc-length'](v))}`],
};

function draw({ board, values, has, colors, unit, fmt, note }) {
  const r = () => values().radius, t = () => values().angle * RAD;
  const fixed = { fixed: true, highlight: false };
  const centre = board.create('point', [0, 0], { ...fixed, name: 'O', size: 3, fillColor: colors.ink2, strokeColor: colors.ink2, label: { strokeColor: colors.ink, fontSize: 15, offset: [-16, -12] } });
  const follower = at => board.create('point', [() => at()[0], () => at()[1]], { ...fixed, visible: false, withLabel: false });
  const start = follower(() => [r(), 0]), end = follower(() => [r() * Math.cos(t()), r() * Math.sin(t())]);

  const shape = board.create('circle', [centre, r], { ...fixed, strokeColor: colors.ink, strokeWidth: 2, fillColor: colors.accent, fillOpacity: has('area') ? 0.08 : 0 });
  if (has('sector')) {
    board.create('sector', [centre, start, end], { ...fixed, strokeColor: colors.accent, strokeWidth: 2, fillColor: colors.accent, fillOpacity: 0.25 });
    board.create('angle', [start, centre, end], { ...fixed, radius: unit * 1.6, withLabel: false, strokeColor: colors.accent, fillColor: colors.accent, fillOpacity: 0.35 });
    note({ id: 'angle', at: () => [Math.cos(t() / 2) * unit, Math.sin(t() / 2) * unit], near: () => [Math.cos(t() / 2) * unit * 2.8, Math.sin(t() / 2) * unit * 2.8], say: () => `${fmt(values().angle, 1)}°` });
    note({ id: 'sector-area', at: () => [Math.cos(t() / 2) * r() * 0.7, Math.sin(t() / 2) * r() * 0.7], near: () => [Math.cos(t() / 2) * r() * 0.7, Math.sin(t() / 2) * r() * 0.7], say: () => `A(s) = ${fmt(measures['sector-area'](values()))}` });
  }
  if (has('radius')) {
    board.create('segment', [centre, start], { ...fixed, strokeColor: colors.ink, strokeWidth: 2 });
    note({ id: 'radius', at: () => [r() / 2, 0], near: () => [r() / 2, -unit * 0.9], say: () => `r = ${fmt(r())}` });
  }
  if (has('area')) note({ id: 'area', at: () => [-r() / 2, -r() / 2], near: () => [-r() / 2, -r() / 2], say: () => `A = ${fmt(measures.area(values()))}` });
  return { shape };
}

export default { controls: { radius: 'slider', angle: 'slider' }, annotations: ['area', 'radius', 'sector'], measures, formulas, draw };
