// The goals a challenge page can name. A page's YAML lists the targets, and a goal reads them, says which scenes it
// works with, sets up each new target, and checks after every change whether the reader has reached it. All of it is
// exact, since fractions have no rounding to allow for.
import { frac, read, compare, add } from './fraction.js';

const num = x => ({ kind: 'number', x });
// value() reads a target's fraction. A whole number counts as a fraction over 1 and shows as that number.
export const value = x => read(x) ?? (/^\d+$/.test(String(x)) ? frac(+x, 1) : null);
const shown = f => f.d === 1 ? num(f.n) : f;
const between = (f, lo, hi) => compare(f, lo) > 0 && compare(f, hi) < 0;

const GOALS = {
  // The bar is cut into a given number of parts, and the reader shades a share equal to the target.
  equal: {
    scenes: ['shade'],
    fields: { shade: 'fraction', parts: 'count' },
    lock: ['d'], // the parts are the target's, so the reader cannot cut the bar again
    round(v, t) { v.a = frac(0, t.parts); },
    holds: (v, t) => v.a.d === t.parts && compare(v.a, t.shade) === 0,
    possible: t => t.shade.n > 0 && t.shade.n <= t.shade.d && t.parts % t.shade.d === 0 ? null
      : `shade ${t.shade.n}/${t.shade.d} cannot be shaded with ${t.parts} parts: give parts a multiple of ${t.shade.d} and a share above 0 and at most 1`,
    say: t => ({ a: t.shade, n: num(t.parts) }),
    hint: t => ({ n: num(t.parts), d: num(t.shade.d), u: frac(1, t.shade.d) }),
    measures: { target: { value: v => v.target.shade }, 'target-parts': { value: v => num(v.target.parts) } },
    shapes: () => ['bar', 'pie'],
  },
  // The reader sets a fraction that lies strictly between two others.
  between: {
    scenes: ['between'],
    fields: { above: 'fraction', below: 'fraction' },
    holds: (v, t) => between(v.a, t.above, t.below),
    // the hint names the smallest denominator the reader can set that has a fraction between the two
    room: (t, [lo, hi]) => { for (let d = lo; d <= hi; d++) for (let n = 0; n <= d; n++) if (between(frac(n, d), t.above, t.below)) return d; return null; },
    possible(t, pg) {
      const [lo, hi] = pg.fractions.a.bottom;
      if (compare(t.above, t.below) >= 0) return `above ${t.above.n}/${t.above.d} is not below below ${t.below.n}/${t.below.d}: write the smaller fraction as above`;
      return this.room(t, [lo, hi]) ? null : `no fraction with a denominator from ${lo} to ${hi} lies between ${t.above.n}/${t.above.d} and ${t.below.n}/${t.below.d}: widen fractions.a.bottom or pick other targets`;
    },
    say: t => ({ a: t.above, b: t.below }),
    hint(t, pg) { return { n: num(this.room(t, pg.fractions.a.bottom)) }; },
    measures: { above: { value: v => v.target.above }, below: { value: v => v.target.below } },
    shapes: () => ['bar'],
  },
  // The reader sets two fractions with different denominators whose sum is the target.
  sum: {
    scenes: ['add'],
    fields: { sum: 'fraction' },
    holds: (v, t) => v.a.n > 0 && v.b.n > 0 && v.a.d !== v.b.d && compare(add(v.a, v.b), t.sum) === 0,
    possible(t, pg) {
      const [A, B] = ['a', 'b'].map(x => pg.fractions[x]);
      for (let p = A.bottom[0]; p <= A.bottom[1]; p++) for (let q = B.bottom[0]; q <= B.bottom[1]; q++) if (p !== q)
        for (let m = 1; m <= A.wholes * p; m++) { const rest = frac(t.sum.n * p - m * t.sum.d, t.sum.d * p); if (rest.n > 0 && (rest.n * q) % rest.d === 0 && rest.n * q / rest.d <= B.wholes * q) return null; }
      return `no two fractions with different denominators in fractions.a.bottom and fractions.b.bottom add up to ${t.sum.n}/${t.sum.d}`;
    },
    say: t => ({ a: shown(t.sum) }),
    hint: t => ({ a: shown(t.sum) }),
    measures: { target: { value: v => shown(v.target.sum) } },
    // the sum's second bar counts once the target is more than one whole
    shapes: t => ['a', 'b', 'sum-0', ...(t.sum.n > t.sum.d ? ['sum-1'] : [])],
  },
};
export default GOALS;

// target() reads a target as the YAML writes it, fractions and all.
export const target = (goal, t) => Object.fromEntries(Object.entries(GOALS[goal].fields).map(([k, kind]) => [k, kind === 'fraction' ? value(t[k]) : Number(t[k])]));
