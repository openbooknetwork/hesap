// A curve drawn by a rule that gives r for every angle. The reader sweeps the angle and the point traces the curve.
import { dashed, follower } from './plane.js';
import { RAD, at, grid, radius, ray, trace } from './polar.js';

// rule: r from the angle in degrees and the page's values. controls: the sliders beside the angle. backwards: the
// rule gives negative distances.
function curve({ controls, rule, formula, backwards = false, size = 5 }) {
  const r = v => rule(v.angle, v), measures = { r, angle: v => v.angle, radians: v => v.angle * RAD };
  function draw({ board, values, colors, unit, fmt, spec, note, has }) {
    const v = values, here = () => at(r(v()), v().angle);
    grid(board, colors, size); ray(board, colors, size);
    // the whole curve, faint, under the part traced so far
    if (has('whole')) trace(board, t => rule(t, v()), spec.controls.angle.slider[1], { strokeColor: colors.ink2, strokeWidth: 1, dash: 2 });
    trace(board, t => rule(t, v()), () => v().angle, { strokeColor: colors.accent, strokeWidth: 3 });
    // the direction the angle points in: a negative r puts the point behind the origin on this line
    if (backwards) dashed(board, follower(board, () => at(-size, v().angle)), follower(board, () => at(size, v().angle)), colors);
    radius(board, colors, here);
    follower(board, here, { visible: true, size: 5, fillColor: colors.accent, strokeColor: colors.accent });
    // the label stands past the point, on the far side from the origin and clear of the axis numbers
    note({ id: 'r', at: here, near: () => { const [x, y] = here(), far = Math.hypot(x, y) || 1; return [x + unit * 2.4 * (x / far || 1), y + unit * 2.4 * (y / far) + unit * 1.4]; }, say: () => `r = ${fmt(r(v()))}` });
  }
  return { controls: { ...controls, angle: 'slider' }, annotations: ['whole'], measures, formulas: { r: (v, m) => formula(v, m, r(v)) }, draw };
}

// the distance grows in step with the angle, measured in radians
export const spiral = curve({ controls: { a: 'slider' }, rule: (deg, v) => v.a * deg * RAD,
  formula: (v, m, r) => ['r', '= a \\theta', `= ${m.n(v.a)} \\times ${m.n(v.angle * RAD)}`, `${m.rel(r)} ${m.n(r)}`] });
// the distance swings between 4 and -4, k times in a full turn
export const rose = curve({ controls: { k: 'slider' }, backwards: true, rule: (deg, v) => 4 * Math.cos(v.k * deg * RAD),
  formula: (v, m, r) => ['r', '= 4 \\cos(k \\theta)', `= 4 \\cos(${m.n(v.k)} \\times ${m.n(v.angle, 1)}^\\circ)`, `${m.rel(r)} ${m.n(r)}`] });
