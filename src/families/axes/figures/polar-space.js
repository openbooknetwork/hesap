// Polar coordinates in space. A cylinder keeps the polar plane as its floor and adds a height. A sphere gives a
// distance from the origin and two angles.
import { space } from './space.js';
import { RAD, at } from './polar.js';

const cos = deg => Math.cos(deg * RAD), sin = deg => Math.sin(deg * RAD);
// the steps of a formula: its name, its rule, the rule with the page's numbers, and the result
const steps = (name, rule, filled, value, m) => [name, `= ${rule}`, `= ${filled}`, `${m.rel(value)} ${m.n(value)}`];
const deg = (m, n) => `${m.n(n, 1)}^\\circ`;

// What both figures draw on the floor: the radius to the point's foot, the circle the foot runs on, the arc of θ,
// and the dashed line from the foot up to the point.
function floor(s, colors, r, theta, height) {
  const foot = () => [...at(r(), theta()), 0];
  s.curve(t => [...at(r(), 360 * t), 0], { strokeColor: colors.rule, strokeWidth: 1.5 });
  s.curve(t => [...at(Math.min(1, r()), theta() * t), 0], { strokeColor: colors.accent, strokeWidth: 2 });
  s.line(s.O, s.XY, { strokeColor: colors.accent, strokeWidth: 2 });
  s.line(s.XY, s.P, { strokeColor: colors.ink2, strokeWidth: 2, dash: 2 });
  return foot;
}

const cyl = v => [...at(v.r, v.angle), v.z];
export const cylinder = {
  controls: { r: 'slider', angle: 'slider', z: 'slider' }, annotations: [],
  measures: { x: v => cyl(v)[0], y: v => cyl(v)[1], r: v => v.r, angle: v => v.angle },
  formulas: {
    x: (v, m) => steps('x', 'r \\cos \\theta', `${m.n(v.r)} \\cos ${deg(m, v.angle)}`, cyl(v)[0], m),
    y: (v, m) => steps('y', 'r \\sin \\theta', `${m.n(v.r)} \\sin ${deg(m, v.angle)}`, cyl(v)[1], m),
  },
  draw(ctx) {
    const { values: v, colors, fmt, note } = ctx, s = space(ctx, { at: () => cyl(v()), walk: false });
    const foot = floor(s, colors, () => v().r, () => v().angle);
    const half = () => s.flat(foot().map(n => n / 2));
    note({ id: 'r', at: half, near: () => { const p = half(); return [p[0] - 0.4, p[1] - 0.9]; }, say: () => `r = ${fmt(v().r)}` });
  },
};

// φ is measured down from the z axis, θ round the floor from the x axis
const ball = v => [v.rho * sin(v['angle-phi']) * cos(v.angle), v.rho * sin(v['angle-phi']) * sin(v.angle), v.rho * cos(v['angle-phi'])];
export const sphere = {
  controls: { rho: 'slider', angle: 'slider', 'angle-phi': 'slider' }, annotations: [],
  measures: { x: v => ball(v)[0], y: v => ball(v)[1], z: v => ball(v)[2], rho: v => v.rho },
  formulas: {
    x: (v, m) => steps('x', '\\rho \\sin \\varphi \\cos \\theta', `${m.n(v.rho)} \\sin ${deg(m, v['angle-phi'])} \\cos ${deg(m, v.angle)}`, ball(v)[0], m),
    y: (v, m) => steps('y', '\\rho \\sin \\varphi \\sin \\theta', `${m.n(v.rho)} \\sin ${deg(m, v['angle-phi'])} \\sin ${deg(m, v.angle)}`, ball(v)[1], m),
    z: (v, m) => steps('z', '\\rho \\cos \\varphi', `${m.n(v.rho)} \\cos ${deg(m, v['angle-phi'])}`, ball(v)[2], m),
  },
  draw(ctx) {
    const { values: v, colors, fmt, note } = ctx, s = space(ctx, { at: () => ball(v()), walk: false }), phi = () => v()['angle-phi'];
    floor(s, colors, () => v().rho * sin(phi()), () => v().angle);
    s.line(s.O, s.P, { strokeColor: colors.ink, strokeWidth: 3 });
    // the arc of φ, from the z axis down to the line to the point
    s.curve(t => { const size = Math.min(1.2, v().rho), tilt = phi() * t; return [size * sin(tilt) * cos(v().angle), size * sin(tilt) * sin(v().angle), size * cos(tilt)]; }, { strokeColor: colors.ink, strokeWidth: 2 });
    const half = () => s.flat(ball(v()).map(n => n / 2));
    note({ id: 'rho', at: half, near: () => { const p = half(); return [p[0] + 0.3, p[1] + 1]; }, say: () => `ρ = ${fmt(v().rho)}` });
  },
};
