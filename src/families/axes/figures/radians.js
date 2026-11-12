// An angle measured by its arc: the radian is the angle whose arc is as long as the radius.
import { follower } from './plane.js';
import { RAD, arc, at, inside, trace, turn } from './polar.js';

const radians = v => v.angle * RAD, length = v => v.r * radians(v);
const measures = { r: v => v.r, angle: v => v.angle, radians, arc: length };
const formulas = {
  radians: (v, m) => ['\\theta', `= ${m.n(v.angle, 1)}^\\circ \\times \\frac{\\pi}{180^\\circ}`, `${m.rel(radians(v))} ${m.n(radians(v))}`],
  arc: (v, m) => ['s', '= r \\theta', `= ${m.n(v.r)} \\times ${m.n(radians(v))}`, `${m.rel(length(v))} ${m.n(length(v))}`],
};

function draw({ board, values, colors, unit, fmt, note, handle }) {
  const v = values, here = () => at(v().r, v().angle), still = { fixed: true, highlight: false }, O = follower(board, () => [0, 0]);
  board.create('circle', [O, () => v().r], { ...still, strokeColor: colors.rule, strokeWidth: 1.5, fillOpacity: 0 });
  for (const end of [() => [v().r, 0], here]) board.create('segment', [O, follower(board, end)], { ...still, strokeColor: colors.ink2, strokeWidth: 2 });
  // the arc the angle cuts from the circle
  trace(board, () => v().r, () => v().angle, { strokeColor: colors.accent, strokeWidth: 4 });
  arc(board, colors, () => v().angle, 0.7);
  note({ id: 'r', at: () => [v().r / 2, 0], near: () => [v().r / 2, -unit * 1.5], say: () => `r = ${fmt(v().r)}` });
  note({ id: 'arc', at: () => at(v().r, v().angle / 2), near: () => at(v().r + unit * 3.4, v().angle / 2), say: () => `s = ${fmt(length(v()))}` });
  note({ id: 'radians', at: () => inside(v().angle, 0.7), near: () => inside(v().angle, 0.7 + unit * 3.4), say: () => `θ = ${fmt(radians(v()))}` });
  handle({ at: here, drag: p => ({ angle: turn(p) }) });
}

export default { controls: { r: 'slider', angle: 'slider' }, annotations: [], measures, formulas, draw };
