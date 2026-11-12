// The goals a challenge page can set. Each one says whether a matrix reaches a target, within a tolerance. The
// browser checks the goal after every change, and the build checks that a page does not open with it reached.
import { det, times, same, PRESETS } from './matrices.js';

// A goal names the kind of target it takes and the measures a page must hide, because they would give the answer.
export const GOALS = {
  // The matrix lands the shape on its outline when every entry equals the target's.
  match: { kind: 'matrix', scenes: ['matrix'], hides: [], reached: (m, t, tol) => m.every((x, k) => Math.abs(x - t[k]) <= tol) },
  // The determinant equals the target number.
  det: { kind: 'number', scenes: ['matrix'], hides: ['det', 'area', 'formula-det'], reached: (m, t, tol) => Math.abs(det(m) - t) <= tol },
};
// A target matrix comes from YAML row by row and is used as [a, b, c, d].
export const flat = t => Array.isArray(t) ? t.flat() : t;

// This finds the fewest moves, up to depth of them, that take the matrix from to the matrix to. Each move acts on
// what the moves before it made, so its matrix multiplies from the left.
export function route(from, to, moves, depth = 4) {
  let layer = [{ m: from, path: [] }];
  for (let n = 0; n <= depth; n++) {
    const hit = layer.find(s => same(s.m, to));
    if (hit) return hit.path;
    layer = layer.flatMap(s => moves.map(id => ({ m: times(PRESETS[id].m, s.m), path: [...s.path, id] })));
  }
  return null;
}
