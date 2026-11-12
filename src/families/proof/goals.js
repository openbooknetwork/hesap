// A challenge page names one of these goals, which plays on one proof at one of its steps. holds(state) checks the
// slider values, the target and the dragged pieces' places, and marks(state) names the pieces that reach the goal.
const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.5;

export const GOALS = {
  // This goal asks for a triangle with a given third angle whose other two angles are equal.
  'equal-angles': {
    of: 'angles', step: 1, targets: true, tolerance: 0.5,
    holds: ({ values: v, target, tolerance }) => Math.abs(v.alpha - v.beta) <= tolerance && Math.abs(180 - v.alpha - v.beta - target) <= tolerance,
    marks: () => ['alpha', 'beta', 'gamma'],
    args: ({ target }) => ({ target, rest: 180 - target }),
  },
  // This goal asks for a right triangle whose long side has a given length.
  'long-side': {
    of: 'pythagoras', step: 3, quiet: true, targets: true, tolerance: 0.001,
    holds: ({ values: v, target, tolerance }) => Math.abs(Math.hypot(v.a, v.b) - target) <= tolerance,
    marks: () => ['hole-c'],
    args: ({ target }) => ({ target, c2: target * target }),
  },
  // The four triangles leave two squares when all of them sit as in the proof's second arrangement, or all of them sit
  // in its mirror image.
  'two-squares': {
    of: 'pythagoras', step: 2, drag: ['tri0', 'tri1', 'tri2', 'tri3'],
    holds: ({ at, slots }) => ['second', 'mirror'].some(s => Object.keys(at).every(id => near(at[id], slots[id][s]))),
    marks: ({ at, slots }) => Object.keys(at).every(id => near(at[id], slots[id].second)) ? ['hole-a', 'hole-b'] : ['mirror-b', 'mirror-a'],
    args: () => ({}),
  },
};
