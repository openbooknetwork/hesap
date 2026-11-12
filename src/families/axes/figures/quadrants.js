// The four quadrants the axes cut the plane into. The one the point stands in is shaded.
import { axes } from './plane.js';
import { feet } from './point.js';

const NAMES = [['III', 'II'], ['IV', 'I']]; // by the sign of x, then of y
const quadrant = ([x, y]) => x === 0 || y === 0 ? '–' : NAMES[x > 0 ? 1 : 0][y > 0 ? 1 : 0];
const measures = { x: v => v.P[0], y: v => v.P[1], quadrant: v => quadrant(v.P) };

function draw(ctx) {
  const { board, values, colors, unit, coords, note, spec } = ctx, P = () => values().P, { x, y } = spec.view;
  const shade = board.create('curve', [[0], [0]], { strokeWidth: 0, fillColor: colors.accent, fillOpacity: 0.12, fixed: true, highlight: false });
  shade.updateDataArray = function update() {
    const [px, py] = P(), on = px !== 0 && py !== 0, ex = px > 0 ? x[1] : x[0], ey = py > 0 ? y[1] : y[0];
    this.dataX = on ? [0, ex, ex, 0, 0] : []; this.dataY = on ? [0, 0, ey, ey, 0] : [];
  };
  axes(ctx);
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const at = [sx > 0 ? x[1] * 0.82 : x[0] * 0.82, sy > 0 ? y[1] * 0.82 : y[0] * 0.82];
    board.create('text', [...at, quadrant([sx, sy])], { anchorX: 'middle', anchorY: 'middle', fixed: true, highlight: false, strokeColor: colors.ink2, fontSize: 18 });
  }
  feet(ctx);
  note({ id: 'point', at: P, near: () => [P()[0] + unit * 2.4 * (P()[0] < 0 ? -1 : 1), P()[1] + unit * 1.8 * (P()[1] < 0 ? -1 : 1)], say: () => coords(P()) });
}

export default { controls: { P: 'point' }, annotations: [], measures, formulas: {}, draw };
