// A 2 by 2 matrix is written [a, b, c, d], row by row. The first column (a, c) is where i lands, and the second
// (b, d) is where j lands. The named matrices a page can offer sit here too.
export const I = [1, 0, 0, 1];
const clean = m => m.map(v => Math.round(v * 1e9) / 1e9 + 0);
export const times = ([a, b, c, d], [e, f, g, h]) => [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h];
export const det = ([a, b, c, d]) => a * d - b * c;
export const mix = (m, n, t) => m.map((v, k) => v + (n[k] - v) * t);
export const same = (m, n) => m.every((v, k) => Math.abs(v - n[k]) < 1e-9);
const rad = deg => deg * Math.PI / 180;
export const turn = deg => [Math.cos(rad(deg)), -Math.sin(rad(deg)), Math.sin(rad(deg)), Math.cos(rad(deg))];
// This is the mirror in the line through the origin at tilt degrees.
export const mirror = deg => [Math.cos(rad(2 * deg)), Math.sin(rad(2 * deg)), Math.sin(rad(2 * deg)), -Math.cos(rad(2 * deg))];

// Each named matrix has a letter for the formulas. A turn moves from the identity through its angles, the others in
// a straight line entry by entry, so a mirror folds the plane flat on its way over.
export const PRESETS = {
  identity: { letter: 'I', m: I },
  'turn-90': { letter: 'R', m: clean(turn(90)), path: t => turn(90 * t) },
  'turn-45': { letter: 'R', m: clean(turn(45)), path: t => turn(45 * t) },
  shear: { letter: 'S', m: [1, 1, 0, 1] },
  mirror: { letter: 'M', m: [-1, 0, 0, 1] },
  'scale-2': { letter: 'D', m: [2, 0, 0, 2] },
  stretch: { letter: 'T', m: [2, 0, 0, 1] },
  squash: { letter: 'Z', m: [1, 2, 0.5, 1] },
};
export const along = (id, t) => PRESETS[id].path?.(t) ?? mix(I, PRESETS[id].m, t);
// The plane goes through named matrices one after the other, each in an equal share of the time t from 0 to 1.
// Each one acts on what the ones before it made.
export const product = ids => ids.reduce((m, id) => times(PRESETS[id].m, m), I);
export function through(ids, t) {
  const n = ids.length, k = Math.min(n - 1, Math.floor(t * n)), s = t * n - k;
  return times(s >= 1 ? PRESETS[ids[k]].m : along(ids[k], s), product(ids.slice(0, k)));
}
