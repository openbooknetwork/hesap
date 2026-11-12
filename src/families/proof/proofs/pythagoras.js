// Four copies of a right triangle in a square of side a + b leave c² empty. Slid into two rectangles, in either pair
// of corners, they leave a² and b².
import { box, poly, text } from './shapes.js';

const O = { x: 55, y: 45 }, S = 290;

export default {
  controls: { a: { min: 0.5 }, b: { min: 0.5 } },
  measures: {
    c: v => Math.hypot(v.a, v.b),
    'a-squared': v => v.a ** 2, 'b-squared': v => v.b ** 2, 'c-squared': v => v.a ** 2 + v.b ** 2,
    side: v => v.a + v.b,
  },
  formulas: {
    pythagoras: (v, f) => [['c^2', 'c²'], ['= a^2 + b^2', '= a² + b²'], [`= ${f.tex(v.a)}^2 + ${f.tex(v.b)}^2`, `= ${f.fmt(v.a)}² + ${f.fmt(v.b)}²`],
      [`= ${f.tex(v.a ** 2)} + ${f.tex(v.b ** 2)}`, `= ${f.fmt(v.a ** 2)} + ${f.fmt(v.b ** 2)}`], [`= ${f.tex(v.a ** 2 + v.b ** 2)}`, `= ${f.fmt(v.a ** 2 + v.b ** 2)}`]],
  },
  scene({ a, b }, { fmt, quiet }) {
    const u = S / (a + b), A = a * u, B = b * u, C = Math.hypot(A, B);
    const at = (x, y, turn = 0) => ({ x: O.x + x, y: O.y + y, turn });
    // the triangle's right angle sits in each corner, then three of them slide to make two rectangles
    const first = [at(0, 0, 0), at(S, 0, 90), at(S, S, 180), at(0, S, -90)];
    const second = [at(0, A, 0), first[1], at(A, S, 180), at(A, A, -90)], mirror = [at(B, 0, 0), at(B, B, 90), at(S, B, 180), first[3]];
    const alone = { x: O.x + S / 2 - A / 3, y: O.y + S / 2 - B / 3, turn: 0 };
    // a square wide enough also writes its area, unless a challenge asks the reader to work it out
    const area = (name, side, value) => side >= 76 && !quiet ? `${name} = ${fmt(value)}` : name;
    const tris = [0, 1, 2, 3].map(i => poly(`tri${i}`, [[0, 0], [A, 0], [0, B]], { tone: 'n', at: alone, refs: ['a', 'b', 'c'] }));
    // the squares left empty sit around their own middles, so they pop up and swell in place
    const h = S / 2, pieces = [
      poly('hole-c', [[A - h, -h], [h, A - h], [B - h, h], [-h, B - h]], { tone: 'c', at: at(h, h), refs: ['c-squared'] }),
      text('c2', area('c²', C, a * a + b * b), { in: 'hole-c', size: 22 }),
      box('hole-a', A, A, { tone: 'a', at: at(A / 2, A / 2), refs: ['a-squared'] }), text('a2', area('a²', A, a * a), { in: 'hole-a' }),
      box('hole-b', B, B, { tone: 'b', at: at(A + B / 2, A + B / 2), refs: ['b-squared'] }), text('b2', area('b²', B, b * b), { in: 'hole-b' }),
      box('mirror-b', B, B, { tone: 'b', at: at(B / 2, B / 2), refs: ['b-squared'] }), text('mirror-b2', area('b²', B, b * b), { in: 'mirror-b' }),
      box('mirror-a', A, A, { tone: 'a', at: at(B + A / 2, B + A / 2), refs: ['a-squared'] }), text('mirror-a2', area('a²', A, a * a), { in: 'mirror-a' }),
      ...tris,
      // the first triangle names its sides
      text('leg-a', 'a', { in: 'tri0', at: { x: A / 2, y: -15 }, refs: ['a'] }),
      text('leg-b', 'b', { in: 'tri0', at: { x: -15, y: B / 2 }, refs: ['b'] }),
      text('leg-c', 'c', { in: 'tri0', at: { x: A / 2 + 17 * B / C, y: B / 2 + 17 * A / C }, refs: ['c'] }),
      poly('frame', [[0, 0], [S, 0], [S, S], [0, S]], { tone: 'frame', at: at(0, 0) }),
      text('top-a', 'a', { in: 'frame', at: { x: A / 2, y: -17 }, refs: ['a'] }),
      text('top-b', 'b', { in: 'frame', at: { x: A + B / 2, y: -17 }, refs: ['b'] }),
      text('right-a', 'a', { in: 'frame', at: { x: S + 17, y: A / 2 }, refs: ['a'] }),
      text('right-b', 'b', { in: 'frame', at: { x: S + 17, y: A + B / 2 }, refs: ['b'] }),
      text('eq', 'a² + b² = c²', { tone: 'result', at: { x: O.x + S / 2, y: O.y + S + 36 }, size: 24 }),
    ];
    const corners = arrangement => Object.fromEntries(arrangement.map((p, i) => [`tri${i}`, { ...p, show: 1 }]));
    // slots says where a reader who drags a triangle can drop it.
    const slots = Object.fromEntries([0, 1, 2, 3].map(i => [`tri${i}`, { first: first[i], second: second[i], mirror: mirror[i] }]));
    return {
      view: [400, 400], pieces, slots,
      steps: [
        { set: { tri0: { show: 1 } } },
        { set: { ...corners(first), frame: { show: 1 }, 'leg-a': { show: 0 }, 'leg-b': { show: 0 }, 'leg-c': { show: 0 } } },
        { set: { 'hole-c': { show: 1 } }, hi: ['hole-c'] },
        { set: { 'hole-c': { show: 0 }, ...corners(second) } },
        { set: { 'hole-a': { show: 1 }, 'hole-b': { show: 1 } }, hi: ['hole-a', 'hole-b'] },
        { set: { eq: { show: 1 } }, hi: ['hole-a', 'hole-b', 'eq'] },
      ],
    };
  },
};
