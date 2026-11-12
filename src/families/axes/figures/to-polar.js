// A point given by x and y, read as a distance and an angle.
import { axes } from './plane.js';
import { feet } from './point.js';
import { arc, inside, radius, turn } from './polar.js';

const r = v => Math.hypot(...v.P);
const measures = { x: v => v.P[0], y: v => v.P[1], r, angle: v => turn(v.P) };
const formulas = {
  r: (v, m) => { const [x, y] = v.P, sq = n => n < 0 ? `(${m.n(n)})^2` : `${m.n(n)}^2`, sum = x * x + y * y;
    return ['r', '= \\sqrt{x^2 + y^2}', `= \\sqrt{${sq(x)} + ${sq(y)}}`, `= \\sqrt{${m.n(sum)}}`, `${m.rel(r(v))} ${m.n(r(v))}`]; },
};

function draw(ctx) {
  const { board, values, colors, unit, fmt, note } = ctx, P = () => values().P, deg = () => turn(P());
  axes(ctx);
  feet(ctx);
  radius(board, colors, P); arc(board, colors, deg);
  note({ id: 'r', at: () => [P()[0] / 2, P()[1] / 2], near: () => { const t = Math.atan2(P()[1], P()[0]) + Math.PI / 2; return [P()[0] / 2 + unit * 1.5 * Math.cos(t), P()[1] / 2 + unit * 1.5 * Math.sin(t)]; }, say: () => `r = ${fmt(r(values()))}` });
  note({ id: 'angle', at: () => inside(deg(), 0.9), near: () => inside(deg(), 0.9 + unit * 3), say: () => `θ = ${fmt(deg(), 1)}°` });
}

export default { controls: { P: 'point' }, annotations: [], measures, formulas, draw };
