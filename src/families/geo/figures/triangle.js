// A triangle on three points. Its area takes AB as the base and the distance from C to it as the height.
import { distance, polygon, signedArea } from './polygon.js';

const area = (v, m) => {
  const a = Math.abs(signedArea([v.A, v.B, v.C])), b = distance(v.A, v.B), h = b ? 2 * a / b : 0;
  return ['A', '= \\tfrac{1}{2} \\times b \\times h', `${m.rel(b) === '=' && m.rel(h) === '=' ? '=' : '\\approx'} \\tfrac{1}{2} \\times ${m.n(b)} \\times ${m.n(h)}`, `${m.rel(a)} ${m.n(a)}`];
};

export default polygon({ controls: { A: 'point', B: 'point', C: 'point' }, names: ['A', 'B', 'C'], vertices: v => [v.A, v.B, v.C], formulas: { area } });
