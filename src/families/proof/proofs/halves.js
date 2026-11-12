// This proves 1/2 + 1/4 + 1/8 + ... = 1. Each piece fills half of what is left of a square, so the rest keeps halving.
import { box, poly, text } from './shapes.js';

const O = { x: 60, y: 40 }, S = 280;
const terms = n => Array.from({ length: n }, (_, i) => 2 ** (i + 1));

export default {
  controls: { n: { min: 1, max: 10, whole: true } },
  measures: { last: v => 2 ** v.n, sum: v => `${2 ** v.n - 1}/${2 ** v.n}`, gap: v => `1/${2 ** v.n}` },
  formulas: {
    halves: v => {
      const d = 2 ** v.n;
      return [[terms(v.n).map(t => `\\frac{1}{${t}}`).join(' + '), terms(v.n).map(t => `1/${t}`).join(' + ')],
        [`= 1 - \\frac{1}{${d}}`, `= 1 − 1/${d}`], [`= \\frac{${d - 1}}{${d}}`, `= ${d - 1}/${d}`]];
    },
  },
  scene({ n }) {
    const pieces = [poly('frame', [[0, 0], [S, 0], [S, S], [0, S]], { tone: 'frame', at: O })], steps = [], all = [];
    // gap is what is left of the square. Piece k takes its left half when k is odd and its top half when k is even.
    let gap = { x: 0, y: 0, w: S, h: S };
    for (let k = 1; k <= n; k++) {
      const p = k % 2 ? { ...gap, w: gap.w / 2 } : { ...gap, h: gap.h / 2 }, id = `p${k}`, x = O.x + p.x + p.w / 2, y = O.y + p.y + p.h / 2;
      gap = k % 2 ? { ...gap, x: gap.x + p.w, w: p.w } : { ...gap, y: gap.y + p.h, h: p.h };
      pieces.push(box(id, p.w, p.h, { tone: k % 2 ? 'a' : 'b', at: { x, y }, refs: k === n ? ['last', 'sum'] : ['sum'] }));
      const size = Math.min(26, 0.3 * Math.min(p.w, p.h));
      if (size >= 11) pieces.push(text(`${id}-name`, `1/${2 ** k}`, { in: id, size }));
      steps.push({ set: { [id]: { y, show: 1 }, ...(k === 1 ? { frame: { show: 1 } } : {}) } });
      all.push(id);
    }
    const shown = n <= 3 ? terms(n).map(d => `1/${d}`) : ['1/2', '1/4', '…', `1/${2 ** n}`];
    pieces.push(text('eq', `${shown.join(' + ')} = ${2 ** n - 1}/${2 ** n}`, { tone: 'result', at: { x: O.x + S / 2, y: O.y + S + 36 }, size: 22, refs: ['sum'] }));
    steps.push({ set: { eq: { show: 1 } }, hi: [...all, 'eq'] });
    return { view: [400, 400], pieces, steps };
  },
};
