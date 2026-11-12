// The distance between two points: the long side of a right triangle whose short sides run along the axes.
import { axes, dashed, follower } from './plane.js';

const dx = v => Math.abs(v.B[0] - v.A[0]), dy = v => Math.abs(v.B[1] - v.A[1]);
const measures = { dx, dy, distance: v => Math.hypot(dx(v), dy(v)) };
const formulas = {
  distance: (v, m) => { const sum = dx(v) ** 2 + dy(v) ** 2, d = Math.sqrt(sum);
    return ['d', '= \\sqrt{\\Delta x^2 + \\Delta y^2}', `= \\sqrt{${m.n(dx(v))}^2 + ${m.n(dy(v))}^2}`, `= \\sqrt{${m.n(sum)}}`, `${m.rel(d)} ${m.n(d)}`]; },
};

function draw({ board, values, colors, unit, fmt, note }) {
  const A = () => values().A, B = () => values().B, C = () => [B()[0], A()[1]], mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  // which way each label steps aside: away from the triangle
  const up = () => B()[1] >= A()[1] ? 1 : -1, right = () => B()[0] >= A()[0] ? 1 : -1;
  axes({ board, colors, fmt });
  const a = follower(board, A), b = follower(board, B), c = follower(board, C);
  dashed(board, a, c, colors); dashed(board, c, b, colors);
  board.create('segment', [a, b], { strokeColor: colors.accent, strokeWidth: 3, fixed: true, highlight: false });
  note({ id: 'dx', at: () => mid(A(), C()), near: () => { const p = mid(A(), C()); return [p[0], p[1] - up() * unit * 1.4]; }, say: () => `Δx = ${fmt(dx(values()))}` });
  note({ id: 'dy', at: () => mid(C(), B()), near: () => { const p = mid(C(), B()); return [p[0] + right() * unit * 2.6, p[1]]; }, say: () => `Δy = ${fmt(dy(values()))}` });
  note({ id: 'distance', at: () => mid(A(), B()), near: () => { const p = mid(A(), B()); return [p[0] - right() * unit * 2.2, p[1] + up() * unit * 1.4]; }, say: () => `d = ${fmt(measures.distance(values()))}` });
}

export default { controls: { A: 'point', B: 'point' }, annotations: [], measures, formulas, draw };
