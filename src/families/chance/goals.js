// The goals a challenge page can set. Each goal names the scene it works on, checks what a page declares for it,
// and tests the counts and the reader's choices. words and note give the values its UI strings put in. A goal with
// whole set judges whole runs, so its page shows every trial and has no slider. The build and the browser both use
// this file.
import { ways2, DIE_SPREAD } from './models.js';

const spreadOf = st => Math.sqrt(Math.max(0, st.sq / st.n - (st.sum / st.n) ** 2));

export const GOALS = {
  // The picked sum of two dice comes up with the target probability, written as a fraction such as [1, 12].
  'sum-chance': {
    scenes: ['dice'], varies: true,
    problem(c) {
      if (!c.targets?.length) return 'targets lists no probabilities, write fractions such as [1, 12]';
      const bad = c.targets.find(t => !Array.isArray(t) || t.length !== 2 || !t.every(Number.isInteger) || t[1] <= 0);
      if (bad) return `targets lists ${JSON.stringify(bad)}, write each probability as a fraction such as [1, 12]`;
      const none = c.targets.find(([a, b]) => ![...Array(11)].some((_, i) => ways2(i + 2) * b === 36 * a));
      return none ? `targets lists ${none.join('/')}, which no sum of two dice comes up with, pick a number of cells out of 36` : null;
    },
    // The sum the reader tapped counts, and the one under the mouse only shows.
    test: (st, spec, c, [a, b]) => ({ done: ways2(st.pick) * b === 36 * a }),
    words: (c, [a, b]) => ({ x: `${a}/${b}` }),
  },
  // Every run on show keeps its share of heads within band of one half over the second half of its flips so far.
  // Several runs must pass at once, so a short run that stays inside by luck does not reach the goal.
  'share-band': {
    scenes: ['flips'], varies: false, sets: true, // The reader sets the number of flips, so the page has no Start.
    problem(c, spec) {
      if (!(c.band > 0 && c.band < 0.5)) return 'band is missing, write how far from one half the share may go, such as 0.05';
      if (spec.runs < 3) return `runs is ${spec.runs}, show 3 runs or more so that one lucky run cannot reach the goal`;
      // At the slider's end the band is three spreads of the share wide at the middle of the run, so most runs pass.
      const need = Math.ceil(2 * (1.5 / c.band) ** 2);
      return spec.trials < need ? `trials is ${spec.trials}, and runs stay inside a band of ${c.band} only from about ${need} flips, raise trials to ${need}` : null;
    },
    test(st, spec, c) {
      if (!st.n) return { done: false };
      const paths = [st.path, ...(st.others ?? []).map(o => o.path)], from = Math.ceil(st.n / 2);
      // left holds, for each run, the flip where its share left the band, or 0 for a run that stays inside.
      const left = paths.map(p => { for (let k = from; k <= st.n; k++) if (Math.abs(p[k - 1] / k - 0.5) > c.band + 1e-9) return k; return 0; });
      const inside = left.filter(k => !k).length, miss = left.findIndex(k => k);
      return inside === paths.length ? { done: true } : { done: false, note: ['inside', [inside, paths.length]], miss: [miss, left[miss]] };
    },
    words: (c, t, f, spec) => ({ x: f.fmt(c.band, 2), n: f.int(spec.runs) }),
    note: ([x, n], f) => ({ x: f.int(x), n: f.int(n) }),
  },
  // A whole run of samples has a spread inside the target range, such as [0.5, 0.7].
  'spread-range': {
    scenes: ['means'], varies: true, whole: true,
    problem(c, spec) {
      if (!c.targets?.length) return 'targets lists no ranges, write ranges of the spread such as [0.5, 0.7]';
      const bad = c.targets.find(t => !Array.isArray(t) || t.length !== 2 || !(t[0] >= 0 && t[1] > t[0]));
      if (bad) return `targets lists ${JSON.stringify(bad)}, write each range as [low, high] with low below high`;
      // A range holds the spread that one of the sample sizes gives, so the reader can reach it.
      const none = c.targets.find(([lo, hi]) => !spec.sizes.some(s => DIE_SPREAD / Math.sqrt(s) >= lo && DIE_SPREAD / Math.sqrt(s) <= hi));
      return none ? `targets lists ${JSON.stringify(none)}, which holds the spread of none of the sizes ${spec.sizes.join(', ')}, the spread of size n is about 1.71/√n` : null;
    },
    test(st, spec, c, [lo, hi]) {
      if (st.n < spec.trials) return { done: false };
      const s = spreadOf(st);
      return s >= lo && s <= hi ? { done: true } : { done: false, note: ['spread-was', s] };
    },
    words: (c, [lo, hi], f, spec) => ({ a: f.fmt(lo, 2), b: f.fmt(hi, 2), n: f.int(spec.trials) }),
    note: (s, f) => f.fix(s, 2),
  },
};

// targetOf gives the target a challenge sets at the start, or after the reader asks for another one.
export const targetOf = (c, i) => c.targets?.[i % c.targets.length] ?? null;
