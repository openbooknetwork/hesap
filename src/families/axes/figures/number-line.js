// A point on the number line. Its coordinate says which side of zero it is on, and its distance from zero how far.
import { axes, follower } from './plane.js';

const measures = { x: v => v.P[0], distance: v => Math.abs(v.P[0]) };
const formulas = { distance: (v, m) => ['|x|', `= |${m.n(v.P[0])}|`, `= ${m.n(Math.abs(v.P[0]))}`] };

function draw({ board, values, colors, unit, fmt, note }) {
  const x = () => values().P[0];
  axes({ board, colors, fmt }, { y: false });
  board.create('segment', [follower(board, () => [0, 0]), follower(board, () => [x(), 0])], { strokeColor: colors.accent, strokeWidth: 4, fixed: true, highlight: false });
  note({ id: 'x', at: () => [x(), 0], near: () => [x(), unit * 2.2], say: () => `x = ${fmt(x())}` });
}

// the point stays on the line
export default { controls: { P: 'point' }, annotations: [], measures, formulas, draw, constrain: (id, at) => [at[0], 0] };
