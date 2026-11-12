// This proves 1 + 2 + ... + n = n(n + 1)/2. A staircase and its copy, turned over, fill an n by n + 1 rectangle.
import { box, group, text } from './shapes.js';

const upTo = n => Array.from({ length: n }, (_, i) => i + 1);

export default {
  controls: { n: { min: 1, max: 9, whole: true } },
  measures: { sum: v => v.n * (v.n + 1) / 2, rectangle: v => v.n * (v.n + 1), 'n-plus-1': v => v.n + 1 },
  formulas: {
    staircase: v => [[upTo(v.n).join(' + '), upTo(v.n).join(' + ')], [`= \\frac{${v.n} \\times ${v.n + 1}}{2}`, `= (${v.n} × ${v.n + 1})/2`],
      [`= ${v.n * (v.n + 1) / 2}`, `= ${v.n * (v.n + 1) / 2}`]],
  },
  scene({ n }, { fmt }) {
    const u = Math.min(340 / (2 * n + 1), 230 / (n + 1)), W = n * u, H = (n + 1) * u, cy = 155;
    // cell places a square in column i (from 1) and row j (from 0 at the foot), around the middle of the rectangle.
    const cell = (i, j) => ({ x: (i - 0.5) * u - W / 2, y: H / 2 - (j + 0.5) * u });
    const side = (W + u) / 2, pieces = [group('A', { at: { x: 200, y: cy } }), group('B', { at: { x: 200, y: cy } })];
    const squares = [], first = {};
    for (const s of ['A', 'B']) for (const i of upTo(n)) for (let j = 0; j < i; j++) {
      const id = `${s}${i}-${j}`;
      pieces.push(box(id, u, u, { in: s, tone: s === 'A' ? 'a' : 'b', at: { ...cell(i, j), show: s === 'A' ? 0 : 1 }, refs: ['sum'] }));
      squares.push(id); if (s === 'A') first[id] = { show: 1 };
    }
    for (const i of upTo(n)) {
      pieces.push(text(`h${i}`, i, { in: 'A', at: { x: cell(i, 0).x, y: H / 2 - i * u - 12 }, size: 15 }));
      first[`h${i}`] = { show: 1 };
    }
    const hide = Object.fromEntries(upTo(n).map(i => [`h${i}`, { show: 0 }]));
    pieces.push(
      text('wide', `n = ${n}`, { at: { x: 200, y: cy + H / 2 + 20 }, refs: ['n'] }),
      text('tall', `n + 1 = ${n + 1}`, { at: { x: 200 + W / 2 + 12, y: cy }, anchor: 'start', refs: ['n-plus-1'] }),
      text('eq', `${n} × ${n + 1} ÷ 2 = ${fmt(n * (n + 1) / 2)}`, { tone: 'result', at: { x: 200, y: cy + H / 2 + 64 }, size: 22, refs: ['sum'] }),
    );
    return {
      view: [400, 380], pieces,
      steps: [
        { set: { A: { show: 1 }, ...first } },
        { set: { A: { x: 200 - side }, B: { x: 200 + side, show: 1 } } },
        { set: { B: { turn: 180 } } },
        { set: { A: { x: 200 }, B: { x: 200 }, ...hide } },
        { set: { wide: { show: 1 }, tall: { show: 1 }, eq: { show: 1 } }, hi: [...squares, 'eq'] },
      ],
    };
  },
};
