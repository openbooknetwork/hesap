// This proves (a + b)² = a² + 2ab + b². A square of side a + b is cut into a², b² and two rectangles a by b, which
// swap places to show they are the same.
import { box, line, poly, text } from './shapes.js';

const O = { x: 75, y: 50 }, S = 250, GAP = 16;

export default {
  controls: { a: { min: 0.5 }, b: { min: 0.5 } },
  measures: {
    side: v => v.a + v.b, whole: v => (v.a + v.b) ** 2,
    'a-squared': v => v.a ** 2, 'b-squared': v => v.b ** 2, ab: v => v.a * v.b, 'two-ab': v => 2 * v.a * v.b,
  },
  formulas: {
    square: (v, f) => [['(a + b)^2', '(a + b)²'], ['= a^2 + 2ab + b^2', '= a² + 2ab + b²'],
      [`= ${f.tex(v.a)}^2 + 2 \\times ${f.tex(v.a)} \\times ${f.tex(v.b)} + ${f.tex(v.b)}^2`, `= ${f.fmt(v.a)}² + 2 × ${f.fmt(v.a)} × ${f.fmt(v.b)} + ${f.fmt(v.b)}²`],
      [`= ${f.tex(v.a ** 2)} + ${f.tex(2 * v.a * v.b)} + ${f.tex(v.b ** 2)}`, `= ${f.fmt(v.a ** 2)} + ${f.fmt(2 * v.a * v.b)} + ${f.fmt(v.b ** 2)}`],
      [`= ${f.tex((v.a + v.b) ** 2)}`, `= ${f.fmt((v.a + v.b) ** 2)}`]],
  },
  scene({ a, b }, { fmt }) {
    const u = S / (a + b), A = a * u, B = b * u;
    const at = (x, y, turn = 0) => ({ x: O.x + x, y: O.y + y, turn });
    // Each piece sits around its own middle, so a turn spins it in place.
    const home = { 'sq-a': at(A / 2, A / 2), 'rect-1': at(A + B / 2, A / 2), 'rect-2': at(A / 2, A + B / 2), 'sq-b': at(A + B / 2, A + B / 2) };
    const apart = { 'sq-a': [-1, -1], 'rect-1': [1, -1], 'rect-2': [-1, 1], 'sq-b': [1, 1] };
    const moved = (id, dx, dy, turn = 0) => ({ x: home[id].x + dx * GAP, y: home[id].y + dy * GAP, turn });
    const label = (id, say, size = 20) => text(`${id}-name`, say, { in: id, at: { show: 0 }, size });
    const pieces = [
      box('sq-a', A, A, { tone: 'n flat', at: home['sq-a'], refs: ['a-squared'] }), label('sq-a', 'a²'),
      box('rect-1', B, A, { tone: 'n flat', at: home['rect-1'], refs: ['ab', 'two-ab'] }), label('rect-1', 'ab', B < 34 ? 15 : 20),
      box('rect-2', A, B, { tone: 'n flat', at: home['rect-2'], refs: ['ab', 'two-ab'] }), label('rect-2', 'ab', B < 34 ? 15 : 20),
      box('sq-b', B, B, { tone: 'n flat', at: home['sq-b'], refs: ['b-squared'] }), label('sq-b', 'b²'),
      // the cuts grow from the top and from the left
      line('cut-1', [[0, 0], [0, S]], { tone: 'cut', at: { ...at(A, 0), scale: 0 } }),
      line('cut-2', [[0, 0], [S, 0]], { tone: 'cut', at: { ...at(0, A), scale: 0 } }),
      poly('frame', [[0, 0], [S, 0], [S, S], [0, S]], { tone: 'frame', at: at(0, 0) }),
      text('top-a', 'a', { in: 'frame', at: { x: A / 2, y: -17 }, refs: ['a'] }),
      text('top-b', 'b', { in: 'frame', at: { x: A + B / 2, y: -17 }, refs: ['b'] }),
      text('left-a', 'a', { in: 'frame', at: { x: -17, y: A / 2 }, refs: ['a'] }),
      text('left-b', 'b', { in: 'frame', at: { x: -17, y: A + B / 2 }, refs: ['b'] }),
      text('whole', '(a + b)²', { at: at(S / 2, S / 2), size: 26, refs: ['whole'] }),
      text('eq', `${fmt((a + b) ** 2)} = ${fmt(a * a)} + ${fmt(2 * a * b)} + ${fmt(b * b)}`, { tone: 'result', at: at(S / 2, S + GAP + 40), size: 24, refs: ['whole'] }),
    ];
    const ids = Object.keys(home), show = { show: 1 };
    const names = on => Object.fromEntries(ids.map(id => [`${id}-name`, { show: on }]));
    return {
      view: [400, 400], pieces,
      steps: [
        { set: { ...Object.fromEntries(ids.map(id => [id, show])), frame: show, whole: show } },
        { set: { 'cut-1': { show: 1, scale: 1 }, 'cut-2': { show: 1, scale: 1 }, whole: { show: 0 },
          'sq-a': { tone: 'a' }, 'rect-1': { tone: 'ab' }, 'rect-2': { tone: 'ab' }, 'sq-b': { tone: 'b' }, ...names(1) } },
        { set: { ...Object.fromEntries(ids.map(id => [id, moved(id, ...apart[id])])), frame: { show: 0 }, 'cut-1': { show: 0 }, 'cut-2': { show: 0 } } },
        // each rectangle turns a quarter and lands where the other was
        { set: { 'rect-1': moved('rect-2', -1, 1, 90), 'rect-2': moved('rect-1', 1, -1, -90) }, hi: ['rect-1', 'rect-2'] },
        { set: { 'sq-a': home['sq-a'], 'sq-b': home['sq-b'], 'rect-1': { ...home['rect-2'], turn: 90 }, 'rect-2': { ...home['rect-1'], turn: -90 }, frame: show, eq: show },
          hi: [...ids, 'eq'] },
      ],
    };
  },
};
