// The distance from the origin to a point in space.
import { space } from './space.js';

const distance = v => Math.hypot(v.x, v.y, v.z);
const formulas = {
  distance: (v, m) => { const sum = v.x ** 2 + v.y ** 2 + v.z ** 2, d = Math.sqrt(sum), sq = n => n < 0 ? `(${m.n(n)})^2` : `${m.n(n)}^2`;
    return ['d', '= \\sqrt{x^2 + y^2 + z^2}', `= \\sqrt{${sq(v.x)} + ${sq(v.y)} + ${sq(v.z)}}`, `= \\sqrt{${m.n(sum)}}`, `${m.rel(d)} ${m.n(d)}`]; },
};

function draw(ctx) {
  const { O, P, line, flat, at } = space(ctx), { colors, fmt, note, values } = ctx;
  line(O, P, { strokeColor: colors.ink, strokeWidth: 3 });
  const half = () => flat(at().map(n => n / 2));
  note({ id: 'distance', at: half, near: () => { const p = half(); return [p[0] - 1.6, p[1] + 0.6]; }, say: () => `d = ${fmt(distance(values()))}` });
}

export default { controls: { x: 'slider', y: 'slider', z: 'slider' }, annotations: [], measures: { distance }, formulas, draw };
