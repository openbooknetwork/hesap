// The goals a challenge page can name in challenge.goal. A goal reads the page's challenge fields and the reader's
// state { eq, steps, x }, and it says whether the reader has reached it.
import { alone, level, apply, fits, OPS } from './algebra.js';

export const GOALS = {
  // x stands alone on one side and the scale is level, in at most `most` steps when the page sets it
  solve(c, st) {
    const found = alone(st.eq) && level(st.eq, st.x) ? alone(st.eq) : null;
    return { met: !!found && (c.most === undefined || st.steps <= c.most), found, over: !!found && c.most !== undefined && st.steps > c.most };
  },
};

// fewest searches up to limit for the fewest steps that get x alone with the page's steps and numbers. It returns null
// when x needs more steps than limit.
export function fewest(eq, ops, [lo, hi], limit) {
  let now = [eq];
  for (let depth = 0; depth <= limit; depth++) {
    if (now.some(e => alone(e))) return depth;
    const seen = new Set(), next = [];
    for (const e of now) for (const id of ops) for (let n = lo; n <= hi; n++) {
      const to = apply(e, id, n), key = JSON.stringify(to);
      if (OPS[id] && fits(to) && !seen.has(key)) { seen.add(key); next.push(to); }
    }
    now = next;
  }
  return null;
}
