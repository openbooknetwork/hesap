// A quadrilateral on four points. Its area is the sum of the two triangles on the diagonal that runs inside it.
import { polygon, signedArea } from './polygon.js';

const area = (v, m) => {
  const abc = signedArea([v.A, v.B, v.C]), acd = signedArea([v.A, v.C, v.D]), inside = abc * acd >= 0;
  const [one, two] = (inside ? [abc, acd] : [signedArea([v.A, v.B, v.D]), signedArea([v.B, v.C, v.D])]).map(Math.abs);
  return ['A', `= A_{${inside ? 'ABC' : 'ABD'}} + A_{${inside ? 'ACD' : 'BCD'}}`, `${m.rel(one) === '=' && m.rel(two) === '=' ? '=' : '\\approx'} ${m.n(one)} + ${m.n(two)}`, `${m.rel(one + two)} ${m.n(one + two)}`];
};

export default polygon({ controls: { A: 'point', B: 'point', C: 'point', D: 'point' }, names: ['A', 'B', 'C', 'D'], vertices: v => [v.A, v.B, v.C, v.D], formulas: { area } });
