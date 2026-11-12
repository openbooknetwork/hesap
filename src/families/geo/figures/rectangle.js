// A rectangle from its width and height, with a corner on the origin.
import { polygon } from './polygon.js';

const formulas = {
  area: (v, m) => ['A', '= w \\times h', `= ${m.n(v.width)} \\times ${m.n(v.height)}`, `= ${m.n(v.width * v.height)}`],
  perimeter: (v, m) => ['P', '= 2 \\times (w + h)', `= 2 \\times (${m.n(v.width)} + ${m.n(v.height)})`, `= ${m.n(2 * (v.width + v.height))}`],
};

export default polygon({ controls: { width: 'slider', height: 'slider' }, count: () => 4, vertices: v => [[0, 0], [v.width, 0], [v.width, v.height], [0, v.height]], formulas });
