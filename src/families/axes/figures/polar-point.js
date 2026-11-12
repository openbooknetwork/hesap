// A point given by its distance from the origin and its angle from the polar axis. The reader moves it with the
// sliders or by dragging it.
import { axes, dashed, follower } from './plane.js';
import { arc, at, grid, inside, radius, ray, turn } from './polar.js';

const P = v => at(v.r, v.angle);
const measures = { r: v => v.r, angle: v => v.angle, x: v => P(v)[0], y: v => P(v)[1] };
const side = (name, fn) => (v, m) => { const value = measures[name](v);
  return [name, `= r \\${fn} \\theta`, `= ${m.n(v.r)} \\${fn} ${m.n(v.angle, 1)}^\\circ`, `${m.rel(value)} ${m.n(value)}`]; };
const formulas = { x: side('x', 'cos'), y: side('y', 'sin') };

function draw({ board, values, has, colors, unit, fmt, spec, note, handle }) {
  const here = () => P(values()), size = spec.controls.r.slider[1], foot = () => [here()[0], 0];
  if (has('grid')) grid(board, colors, size);
  if (has('legs')) axes({ board, colors, fmt }); else ray(board, colors, size);
  if (has('legs')) {
    // the right triangle whose sides along the axes are x and y
    dashed(board, follower(board, () => [0, 0]), follower(board, foot), colors); dashed(board, follower(board, foot), follower(board, here), colors);
    const below = () => here()[1] >= 0 ? -1 : 1, beside = () => here()[0] >= 0 ? 1 : -1;
    note({ id: 'x', at: () => [here()[0] / 2, 0], near: () => [here()[0] / 2, below() * unit * 1.6], say: () => `x = ${fmt(here()[0])}` });
    note({ id: 'y', at: () => [here()[0], here()[1] / 2], near: () => [here()[0] + beside() * unit * 2.8, here()[1] / 2], say: () => `y = ${fmt(here()[1])}` });
  }
  radius(board, colors, here); arc(board, colors, () => values().angle);
  // the radius label stands off the line, on the side away from the angle's arc
  note({ id: 'r', at: () => at(values().r / 2, values().angle), near: () => { const [x, y] = at(values().r / 2, values().angle), [nx, ny] = at(unit * 1.5, values().angle + 90); return [x + nx, y + ny]; }, say: () => `r = ${fmt(values().r)}` });
  note({ id: 'angle', at: () => inside(values().angle, 0.9), near: () => inside(values().angle, 0.9 + unit * 3), say: () => `θ = ${fmt(values().angle, 1)}°` });
  handle({ at: here, drag: p => ({ r: Math.hypot(...p), angle: turn(p) }) });
}

export default { controls: { r: 'slider', angle: 'slider' }, annotations: ['grid', 'legs'], measures, formulas, draw };
