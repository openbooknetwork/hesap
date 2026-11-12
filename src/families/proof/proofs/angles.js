// The angles of a triangle add up to a straight angle. Its three corners, torn off, meet at one point of a line.
import { slice, line, poly, text } from './shapes.js';

const BASE = 225, P = { x: 200, y: 312 }, rad = deg => deg * Math.PI / 180;

export default {
  controls: { alpha: { min: 5 }, beta: { min: 5 } },
  // two sliders whose largest values add up to 180° or more could leave no third angle
  check: c => c.alpha.slider[1] + c.beta.slider[1] < 180 ? null : `controls.alpha and controls.beta reach ${c.alpha.slider[1]}° and ${c.beta.slider[1]}°, keep their largest values under 180° together`,
  units: { alpha: '°', beta: '°', gamma: '°', sum: '°' },
  measures: { gamma: v => 180 - v.alpha - v.beta, sum: () => 180 },
  formulas: {
    angles: (v, f) => [['\\alpha + \\beta + \\gamma', 'α + β + γ'],
      [`= ${f.tex(v.alpha)}^\\circ + ${f.tex(v.beta)}^\\circ + ${f.tex(180 - v.alpha - v.beta)}^\\circ`, `= ${f.fmt(v.alpha)}° + ${f.fmt(v.beta)}° + ${f.fmt(180 - v.alpha - v.beta)}°`],
      ['= 180^\\circ', '= 180°']],
  },
  scene({ alpha, beta }, { fmt }) {
    const gamma = 180 - alpha - beta, side = Math.sin(rad(beta)) / Math.sin(rad(gamma));
    // The triangle gets a base of 1, then it is scaled to fit and set on its base.
    const unit = [[0, 0], [1, 0], [side * Math.cos(rad(alpha)), -side * Math.sin(rad(alpha))]];
    const left = Math.min(0, unit[2][0]), wide = Math.max(1, unit[2][0]) - left, k = Math.min(300 / wide, 180 / -unit[2][1]);
    const [A, B, C] = unit.map(([x, y]) => [200 + (x - left - wide / 2) * k, BASE + y * k]);
    const length = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]), d = Math.min(54, 0.4 * Math.min(length(A, B), length(B, C), length(C, A)));
    const G = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
    // Each corner lists its angle, its vertex, and the way it faces, counterclockwise from the right. On the line A
    // keeps facing right, C turns to follow A, and B keeps facing as it did.
    const corners = [['alpha', 'α', alpha, A, 0, 0, 'a'], ['beta', 'β', beta, B, 180 - beta, 180 - beta, 'b'], ['gamma', 'γ', gamma, C, 180 + alpha, alpha, 'c']];
    const pieces = [poly('tri', [A, B, C], { tone: 'n' }), line('line', [[-170, 0], [170, 0]], { tone: 'mark', at: { ...P, scale: 0 } })];
    const torn = {}, met = {}, here = {};
    for (const [id, name, angle, V, faces, onLine, tone] of corners) {
      const mid = rad(angle / 2), L = d + 14;
      pieces.push(slice(id, d, 0, angle, { tone, at: { x: V[0], y: V[1], turn: -faces }, refs: [id] }));
      pieces.push(text(`${id}-name`, name, { in: id, at: { x: L * Math.cos(mid), y: -L * Math.sin(mid) }, size: 20, refs: [id] }));
      here[id] = { show: 1 };
      const out = Math.hypot(V[0] - G[0], V[1] - G[1]);
      torn[id] = { x: V[0] + (V[0] - G[0]) / out * 16, y: V[1] + (V[1] - G[1]) / out * 16, scale: 1.08 };
      met[id] = { x: P.x, y: P.y, turn: -onLine, scale: 1 };
    }
    pieces.push(text('eq', `${fmt(alpha)}° + ${fmt(beta)}° + ${fmt(gamma)}° = 180°`, { tone: 'result', at: { x: 200, y: P.y + 42 }, size: 22, refs: ['sum'] }));
    return {
      view: [400, 380], pieces,
      steps: [
        { set: { tri: { show: 1 }, ...here } },
        { set: { ...torn, tri: { tone: 'ghost' } } },
        { set: { ...met, line: { show: 1, scale: 1 } } },
        { set: { eq: { show: 1 } }, hi: ['alpha', 'beta', 'gamma', 'eq'] },
      ],
    };
  },
};
