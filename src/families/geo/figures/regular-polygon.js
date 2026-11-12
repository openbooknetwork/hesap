// A regular polygon of n sides of one length, centred on the origin with a side along the bottom.
import { polygon } from './polygon.js';

function vertices({ n: sides, side }) {
  const n = Math.round(sides);
  const step = Math.PI * 2 / n, r = side / (2 * Math.sin(Math.PI / n)), first = -Math.PI / 2 - step / 2;
  return Array.from({ length: n }, (_, k) => [r * Math.cos(first + k * step), r * Math.sin(first + k * step)]);
}

const formulas = {
  angle: (v, m) => { const n = Math.round(v.n), a = (n - 2) * 180 / n;
    return ['\\alpha', '= \\frac{(n - 2) \\times 180^\\circ}{n}', `= \\frac{(${n} - 2) \\times 180^\\circ}{${n}}`, `${m.rel(a)} ${m.n(a)}^\\circ`]; },
  area: (v, m) => { const n = Math.round(v.n), a = n * v.side ** 2 / (4 * Math.tan(Math.PI / n));
    return ['A', '= \\frac{n \\times s^2}{4 \\times \\tan(180^\\circ / n)}', `= \\frac{${n} \\times ${m.n(v.side)}^2}{4 \\times \\tan(180^\\circ / ${n})}`, `${m.rel(a)} ${m.n(a)}`]; },
};

export default polygon({ controls: { n: 'slider', side: 'slider' }, alike: true, count: controls => controls.n.slider[1], vertices, formulas });
