// What the polar figures share: the grid of circles and rays, the radius to a point, the arc of its angle and a
// curve traced up to an angle.
import { follower } from './plane.js';

export const RAD = Math.PI / 180;
// where a distance and an angle in degrees put a point
export const at = (r, deg) => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
// the angle of a point in degrees, from 0 up to 360
export const turn = ([x, y]) => (Math.atan2(y, x) / RAD + 360) % 360;
const still = { fixed: true, highlight: false };
const words = (board, p, say, colors) => board.create('text', [...p, say], { ...still, anchorX: 'middle', anchorY: 'middle', strokeColor: colors.ink2, fontSize: 12 });

// the polar axis: the ray every angle is measured from
export function ray(board, colors, size) {
  board.create('segment', [follower(board, () => [0, 0]), follower(board, () => [size + 0.35, 0])], { ...still, strokeColor: colors.ink2, strokeWidth: 1.5, lastArrow: true });
  for (let k = 1; k <= size; k++) words(board, [k, -0.32], String(k), colors);
}
// a circle for every whole distance and a ray every 30°
export function grid(board, colors, size) {
  for (let k = 1; k <= size; k++) board.create('circle', [follower(board, () => [0, 0]), k], { ...still, strokeColor: colors.rule, strokeWidth: 1, fillOpacity: 0 });
  for (let deg = 0; deg < 360; deg += 30) {
    board.create('segment', [follower(board, () => [0, 0]), follower(board, () => at(size, deg))], { ...still, strokeColor: colors.rule, strokeWidth: 1 });
    words(board, at(size + 0.55, deg), `${deg}°`, colors);
  }
}
// the straight line from the origin to a point
export const radius = (board, colors, P) => board.create('segment', [follower(board, () => [0, 0]), follower(board, P)], { ...still, strokeColor: colors.accent, strokeWidth: 3 });
// r = f(angle in degrees) drawn from 0 to an angle, which may be a function
export const trace = (board, f, to, attrs) => board.create('curve', [t => at(f(t), t)[0], t => at(f(t), t)[1], 0, to], { ...still, ...attrs });
// the arc that shows an angle, near the origin
export const arc = (board, colors, deg, size = 0.9) => trace(board, () => size, deg, { strokeColor: colors.accent, strokeWidth: 2 });
// where an angle's label stands: on its bisector, past the arc
export const inside = (deg, size = 1.6) => at(size, deg / 2);
