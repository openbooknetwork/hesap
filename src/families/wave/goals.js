// These are the goals a challenge page can name. judge reads the figure's values and the page's target and says whether
// the reader has reached the goal. A page's YAML gives the targets and the tolerance, in degrees for an angle and in
// units for a height.
import { sin, turn } from './scenes.js';

// near says whether two angles lie within tol degrees of each other round the circle.
const near = (a, b, tol) => Math.min(turn(a - b), turn(b - a)) <= tol;
const on = (x, [from, to], step) => x >= from - 1e-9 && x <= to + 1e-9 && Math.abs((x - from) / step - Math.round((x - from) / step)) < 1e-9;

// spots are angles the point has to reach. With need 1 the point has to stand on one of them, with more it has to
// visit that many, and each one it visits stays found. holds is a goal the figure meets or not at each moment.
export const GOALS = {
  // The point stands where sin θ equals cos θ, which happens at 45° and at 225°.
  equal: { scenes: ['unit', 'cosine'], tolerance: 1, keys: [], spots: () => [45, 225], need: 1 },
  // The point visits both angles from 0° to 360° whose sine is the target height.
  'same-sine': {
    scenes: ['sine'], tolerance: 1, keys: ['height'], need: 2,
    spots: t => { const a = Math.asin(t.height) * 180 / Math.PI; return [turn(a), turn(180 - a)]; },
    check: t => Math.abs(t.height) > 0.02 && Math.abs(t.height) < 0.98 ? null : 'height is 0, 1, −1 or beyond them, pick a height between −0.98 and 0.98 other than 0, so that exactly two angles have it',
  },
  // The reader's wave A sin(kx + φ) lies on the target wave at every x.
  match: {
    scenes: ['general'], tolerance: 0.05, keys: ['amplitude', 'frequency', 'phase'],
    wave: t => x => t.amplitude * sin(t.frequency * x + t.phase),
    holds: (v, t, tol) => { for (let x = 0; x <= 360; x += 2) if (Math.abs(v.amplitude * sin(v.frequency * x + v.phase) - t.amplitude * sin(t.frequency * x + t.phase)) > tol) return false; return true; },
    // The sliders have to reach the target, or the reader cannot solve it.
    check: (t, controls) => { const off = ['amplitude', 'frequency', 'phase'].find(id => !on(t[id], controls[id].slider, controls[id].step)); return off ? `${off} ${t[off]} is not a value its slider reaches, pick one from ${controls[off].slider.join(' to ')} in steps of ${controls[off].step}` : null; },
  },
};

// judge gives the spots found so far and whether the goal holds. found holds the spots visited before.
export function judge(goal, v, t, tol, found = []) {
  if (goal.holds) return { solved: goal.holds(v, t, tol), found: [] };
  const here = goal.spots(t).filter(a => near(v.angle, a, tol));
  if (goal.need === 1) return { solved: here.length > 0, found: here };
  const all = [...new Set([...found, ...here])];
  return { solved: all.length >= goal.need, found: all };
}
