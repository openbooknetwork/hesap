// The scenes draw with these on a JSXGraph board: the axes, curves, points, segments and filled regions. Every
// position is a function, read again on each update, so the figure follows the values.
const still = { fixed: true, highlight: false };

// anchor makes a point nobody sees, which segments hang on
const anchor = (board, at) => board.create('point', [() => at()[0], () => at()[1]], { ...still, visible: false, withLabel: false, name: '' });

// axes draws the two axes with a tick at every whole number, or every second one on a wide range
export function axes(board, c, view, { y = 'y' } = {}) {
  const every = range => range[1] - range[0] > 13 ? 2 : 1;
  const axis = (to, name, offset, range) => board.create('axis', [[0, 0], to], { ...still, strokeColor: c.ink2, strokeWidth: 1.5, name, withLabel: !!name,
    label: { position: 'rt', offset, strokeColor: c.ink2, highlightStrokeColor: c.ink2, fontSize: 14 },
    ticks: { insertTicks: false, ticksDistance: every(range), minorTicks: 0, majorHeight: 8, drawZero: false, strokeColor: c.rule,
      label: { strokeColor: c.ink2, highlightStrokeColor: c.ink2, fontSize: 12 } } });
  axis([1, 0], 'x', [-14, 14], view.x);
  axis([0, 1], y, [10, -8], view.y);
}

// curve draws the graph of y = f(x) across the view, or from a to b, which may be functions
export const curve = (board, f, attrs, from, to) => board.create('functiongraph', from === undefined ? [x => f(x)] : [x => f(x), from, to], { ...still, ...attrs });
// line draws a straight line through a point with a slope, across the view
export const line = (board, at, slope, attrs) => curve(board, x => at()[1] + slope() * (x - at()[0]), attrs);
export const segment = (board, a, b, attrs) => board.create('segment', [anchor(board, a), anchor(board, b)], { ...still, ...attrs });
export const dot = (board, at, attrs) => board.create('point', [() => at()[0], () => at()[1]], { ...still, name: '', withLabel: false, face: 'o', ...attrs });

// region fills the shape whose outline edge() gives as [xs, ys], and draws it again on each update.
export function region(board, edge, attrs) {
  const r = board.create('curve', [[0], [0]], { ...still, ...attrs });
  r.updateDataArray = function () { [this.dataX, this.dataY] = edge(); };
  return r;
}
// under gives the outline of the region between y = f(x) and the x axis from a to b. A side cuts f to one side.
export function under(f, a, b, side = 0, steps = 120) {
  const X = [a], Y = [0], cut = y => side > 0 ? Math.max(y, 0) : side < 0 ? Math.min(y, 0) : y;
  for (let i = 0; i <= steps; i++) { const x = a + (b - a) * i / steps; X.push(x); Y.push(cut(f(x))); }
  X.push(b); Y.push(0);
  return [X, Y];
}
