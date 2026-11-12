// Cut into wedges and laid in a row, pointing up and down in turn, a circle becomes nearly a rectangle r tall and πr
// wide. That rectangle gives the circle's area.
import { path, dot, line, poly, text, r2 } from './shapes.js';

const CX = 200, CY = 150;

// a wedge with its tip at the origin and its arc below, so a turn of 180 points it up
function wedge(id, R, angle, more) {
  const sx = r2(R * Math.sin(angle / 2)), sy = r2(R * Math.cos(angle / 2));
  return path(id, `M0 0 L${-sx} ${sy} A${r2(R)} ${r2(R)} 0 0 0 ${sx} ${sy} Z`, more);
}

export default {
  controls: { r: { min: 0.5 }, wedges: { min: 4, max: 60, even: true } },
  measures: { area: v => Math.PI * v.r ** 2, edge: v => 2 * Math.PI * v.r, 'half-edge': v => Math.PI * v.r },
  formulas: {
    circle: (v, f) => {
      const area = Math.PI * v.r ** 2, [rel, sign] = f.rel(area);
      return [['A', 'A'], ['= \\pi r \\times r', '= πr × r'], ['= \\pi r^2', '= πr²'], [`= \\pi \\times ${f.tex(v.r)}^2`, `= π × ${f.fmt(v.r)}²`],
        [`${rel} ${f.tex(area)}`, `${sign} ${f.fmt(area)}`]];
    },
  },
  scene({ r, wedges: N }, { fmt, ranges }) {
    // the widest circle's row fills the view, and a smaller radius draws a smaller circle
    const R = 300 / Math.PI * r / ranges.r.slider[1], step = 360 / N, half = N / 2;
    const w = R * Math.sin(Math.PI / N), h = R * Math.cos(Math.PI / N), top = CY - R / 2, x0 = CX - (N - 1) * w / 2;
    const pieces = [], round = {}, cut = {}, row = {}, ids = [];
    for (let k = 0; k < N; k++) {
      // Wedge k points along `turn`. The lower half (k < N/2) runs from the right round to the left, then the upper.
      const id = `w${k}`, turn = -90 + (k + 0.5) * step, low = k < half, rad = turn * Math.PI / 180;
      pieces.push(wedge(id, R, 2 * Math.PI / N, { tone: `${low ? 'b' : 'a'} flat`, at: { x: CX, y: CY, turn }, refs: ['area'] }));
      ids.push(id);
      round[id] = { show: 1 };
      cut[id] = { x: CX - Math.sin(rad) * 9, y: CY + Math.cos(rad) * 9, tone: low ? 'b' : 'a' };
      // the lower half points down along the top of the row, the upper half points up between them
      const slot = low ? half - 1 - k : k - half;
      row[id] = low ? { x: x0 + 2 * w * slot, y: top, turn: 0 } : { x: x0 + 2 * w * slot + w, y: top + h, turn: 180 };
    }
    const width = Math.PI * R;
    pieces.push(
      dot('rim', R, { tone: 'frame', at: { x: CX, y: CY }, refs: ['edge'] }),
      line('radius', [[0, 0], [R, 0]], { tone: 'mark', at: { x: CX, y: CY }, refs: ['r'] }),
      text('r', 'r', { in: 'radius', at: { x: R / 2, y: -13 }, refs: ['r'] }),
      poly('rect', [[0, 0], [width, 0], [width, R], [0, R]], { tone: 'ghost', at: { x: CX - width / 2, y: top } }),
      text('height', 'r', { in: 'rect', at: { x: -16, y: R / 2 }, refs: ['r'] }),
      text('width', 'πr', { in: 'rect', at: { x: width / 2, y: R + 20 }, refs: ['half-edge'] }),
      text('eq', `π × ${fmt(r)}² ≈ ${fmt(Math.PI * r * r)}`, { tone: 'result', at: { x: CX, y: top + R + 58 }, size: 22, refs: ['area'] }),
    );
    return {
      view: [400, 330], pieces,
      steps: [
        { set: { ...round, rim: { show: 1 }, radius: { show: 1 } } },
        { set: { ...cut, rim: { show: 0 }, radius: { show: 0 } } },
        { set: row },
        { set: { rect: { show: 1 } } },
        { set: { eq: { show: 1 } }, hi: [...ids, 'eq'] },
      ],
    };
  },
};
