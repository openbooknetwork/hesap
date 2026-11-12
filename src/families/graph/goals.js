// A challenge page names one of these goals in hesap.challenge.goal. A goal lists the scenes it suits and checks a
// target from the YAML. Its holds() says whether the figure reaches the target, and it may add measures and draw it.
// holds and the measures take the values v, the rule R, the page's spec, the target t and the tolerance. hides names
// the measures that give the answer away, which a page shows only behind Hint.
import { dot } from './plot.js';
import { left } from './rules.js';

const pairs = p => Array.isArray(p) && p.length > 0 && p.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite));
// miss measures how far the curve passes from the farthest point, up and down
const miss = (R, points) => Math.max(...points.map(([x, y]) => Math.abs(R.y(x) - y)));
// short measures how far n rectangles fall short of the area
const short = (R, s, n) => Math.abs(R.area(s.from, s.to) - left(R, s.from, s.to, n));

export default {
  // The tangent at P lies flat. A target gives the curve's coefficients.
  flat: {
    scenes: ['tangent'], tolerance: 0.1, shows: 'slope', hides: ['slope', 'secant'],
    target: t => !t.coefficients || typeof t.coefficients === 'object' ? null : 'gives the curve as { coefficients: { a: n, ... } }',
    holds: (v, R, s, t, tol) => Math.abs(R.slope(v.x)) <= tol,
  },
  // The curve passes through every marked point. A target marks the points.
  through: {
    scenes: ['plot'], tolerance: 0.15, shows: 'goal', hides: [],
    target: t => pairs(t.points) ? null : 'marks its points as { points: [[x, y], ...] }',
    holds: (v, R, s, t, tol) => miss(R, t.points) <= tol,
    measures: { miss: (v, R, s, t) => miss(R, t.points) },
    // A ring marks each point and fills in once the curve passes through it.
    draw({ boards: [b], R, c, mark }, t, tol) {
      const most = Math.max(...(t.all.map(x => x.points.length)));
      for (let i = 0; i < most; i++) {
        const at = () => t.now().points[i] ?? [NaN, NaN], on = () => !!t.now().points[i] && Math.abs(R().y(at()[0]) - at()[1]) <= tol;
        mark('goal', dot(b, at, { size: 7, strokeColor: c.accent, strokeWidth: 2.5, fillColor: c.accent, fillOpacity: () => on() ? 1 : 0, visible: () => !!t.now().points[i] }), { size: 10 });
      }
    },
  },
  // The goal asks for the fewest rectangles whose sum comes within a distance of the area. A target gives the distance.
  fewest: {
    scenes: ['area'], shows: 'sum', hides: ['difference'],
    target: t => Number.isFinite(t.within) && t.within > 0 ? null : 'gives the distance to come within as { within: n }',
    holds: (v, R, s, t) => short(R, s, v.n) <= t.within && (v.n <= 1 || short(R, s, v.n - 1) > t.within),
    measures: { within: (v, R, s, t) => t.within },
  },
};
