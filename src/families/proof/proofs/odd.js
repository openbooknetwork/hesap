// The first n odd numbers add up to n². Each odd number of dots wraps an L around the square before it.
import { dot, text, poly } from './shapes.js';

const odds = n => Array.from({ length: n }, (_, i) => 2 * i + 1);

export default {
  controls: { n: { min: 1, max: 9, whole: true } },
  measures: { sum: v => v.n ** 2, last: v => 2 * v.n - 1 },
  formulas: { odd: v => [[odds(v.n).join(' + '), odds(v.n).join(' + ')], [`= ${v.n}^2`, `= ${v.n}²`], [`= ${v.n ** 2}`, `= ${v.n ** 2}`]] },
  scene({ n }, { fmt }) {
    const g = Math.min(56, 280 / n), x0 = 200 - (n - 1) * g / 2, y0 = 200 - (n - 1) * g / 2 + 4;
    const pieces = [], steps = [];
    pieces.push(poly('frame', [[-g / 2, -g / 2], [n * g - g / 2, -g / 2], [n * g - g / 2, n * g - g / 2], [-g / 2, n * g - g / 2]], { tone: 'frame', at: { x: x0, y: y0 } }));
    const all = [];
    for (let L = 1; L <= n; L++) {
      // The dots arrive down the new column, then left along the new row.
      const cells = [...Array.from({ length: L }, (_, j) => [L - 1, j]), ...Array.from({ length: L - 1 }, (_, i) => [L - 2 - i, L - 1])];
      const set = {};
      for (const [i, j] of cells) {
        const id = `d${i}-${j}`, x = x0 + i * g, y = y0 + j * g;
        // The first dot appears in place. A later dot slides in from outside the square. The column's dots come from the right and the row's from below.
        const from = L === 1 ? { x, y } : { x: i === L - 1 ? x + g : x, y: j === L - 1 ? y + g : y };
        pieces.push(dot(id, g * 0.3, { tone: L % 2 ? 'a' : 'b', at: from, refs: L === n ? ['last'] : [] }));
        set[id] = { x, y, show: 1 };
        all.push(id);
      }
      pieces.push(text(`k${L}`, 2 * L - 1, { at: { x: x0 + (L - 1) * g, y: y0 - g / 2 - 16 }, size: 16, refs: L === n ? ['last'] : [] }));
      set[`k${L}`] = { show: 1 };
      steps.push({ set });
    }
    pieces.push(text('eq', `${n} × ${n} = ${fmt(n * n)}`, { tone: 'result', at: { x: 200, y: y0 + n * g - g / 2 + 32 }, size: 22, refs: ['sum'] }));
    steps.push({ set: { frame: { show: 1 }, eq: { show: 1 } }, hi: [...all, 'frame', 'eq'] });
    return { view: [400, 400], pieces, steps };
  },
};
