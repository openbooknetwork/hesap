// Each scene's model says what one trial is, which counts it adds to, and which measures a page reads out or links.
// The build checks a page's text with it and the browser runs it.
import { generator, seedOf } from './random.js';

export const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const choose = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return Math.round(c); };
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const reduce = (a, b) => { const g = gcd(a, b) || 1; return [a / g, b / g]; };
const face = rand => 1 + Math.floor(rand() * 6);
// ways2 counts the ways two dice make a sum, which is 1 for 2, 6 for 7 and 1 for 12.
export const ways2 = s => 6 - Math.abs(s - 7);
// The spread of one die's rolls is the square root of 35/12.
export const DIE_SPREAD = Math.sqrt(35 / 12);

// In a measure, kind says how it is written, label names its readout with x put in, and of reads it from the counts.
// A share and a mean read null before the first trial.
const count = (label, of, x) => ({ kind: 'count', label, of, x });
const share = (label, part, x) => ({ kind: 'share', label, x, of: st => st.n ? part(st) / st.n : null });
const chance = (label, num, den, x) => ({ kind: 'chance', label, x, of: st => [num(st), den] });
const number = (label, of, digits, x) => ({ kind: 'number', label, of, digits, x });
// A constant keeps only the digits it needs, as in 3.5 and 1.71.
const fixed = (label, of, digits, x) => ({ kind: 'number', label, of, digits, trim: true, x });
// each makes one measure for each value k, such as count-k and share-k.
const each = (ks, make) => Object.fromEntries(ks.flatMap(k => Object.entries(make(k)).map(([id, m]) => [`${id}-${k}`, m])));

const coin = {
  noun: 'flips',
  start: spec => ({ n: 0, heads: 0, tails: 0, last: null, run: 0, streak: 0, path: new Uint32Array(spec.trials) }),
  trial: rand => rand() < 0.5 ? 'heads' : 'tails',
  add(st, o) {
    st.n++; st[o]++; st.run = o === st.last ? st.run + 1 : 1; st.last = o; st.streak = Math.max(st.streak, st.run);
    st.path[st.n - 1] = st.heads; // path holds the heads after each flip, and the line of shares is drawn from it.
  },
  measures: () => ({
    flips: count('flips', st => st.n), heads: count('heads', st => st.heads), tails: count('tails', st => st.tails),
    'share-heads': share('share-heads', st => st.heads), 'share-tails': share('share-tails', st => st.tails),
    'p-heads': chance('p-heads', () => 1, 2), 'p-tails': chance('p-tails', () => 1, 2),
    streak: count('streak', st => st.streak), gap: count('gap', st => Math.abs(st.heads - st.tails)),
  }),
  formulas: {},
};

const die = {
  noun: 'rolls',
  start: () => ({ n: 0, counts: Array(7).fill(0), last: null }),
  trial: rand => face(rand),
  add(st, o) { st.n++; st.counts[o]++; st.last = o; },
  measures: () => ({
    rolls: count('rolls', st => st.n), 'p-face': chance('p-face', () => 1, 6), expected: fixed('expected', st => st.n / 6, 1),
    ...each(range(1, 6), k => ({ count: count('count-face', st => st.counts[k], k), share: share('share-face', st => st.counts[k], k) })),
  }),
  // The count a face can expect is the number of rolls times 1/6.
  formulas: { expected: (st, f) => [[`\\text{${f.word('expected')}}`, f.word('expected')], [`= ${f.tex(f.int(st.n))} \\times \\tfrac{1}{6}`, `= ${f.int(st.n)} × 1/6`], [`= ${f.tex(f.fmt(st.n / 6, 1))}`, `= ${f.fmt(st.n / 6, 1)}`]] },
};

const dice = {
  noun: 'rolls',
  start: spec => ({ n: 0, counts: Array(13).fill(0), last: null, pick: spec.pick }),
  trial: rand => [face(rand), face(rand)],
  add(st, o) { st.n++; st.counts[o[0] + o[1]]++; st.last = o; },
  measures: () => ({
    rolls: count('rolls', st => st.n), outcomes: count('outcomes', () => 36), pick: count('pick-sum', st => st.pick),
    ...each(range(2, 12), k => ({ count: count('count-sum', st => st.counts[k], k), share: share('share-sum', st => st.counts[k], k),
      ways: count('ways-sum', () => ways2(k), k), p: chance('p-sum', () => ways2(k), 36, k) })),
    'count-pick': count('count-sum', st => st.counts[st.pick], st => st.pick), 'share-pick': share('share-sum', st => st.counts[st.pick], st => st.pick),
    'ways-pick': count('ways-sum', st => ways2(st.pick), st => st.pick), 'p-pick': chance('p-sum', st => ways2(st.pick), 36, st => st.pick),
  }),
  // The chance of the picked sum is its ways out of 36, shown in lowest terms and as a decimal.
  formulas: { 'p-pick': (st, f) => { const w = ways2(st.pick), [a, b] = reduce(w, 36); return [[`P(${st.pick})`, `P(${st.pick})`], [`= \\frac{${w}}{36}`, `= ${w}/36`],
    ...(b === 36 ? [] : [[`= \\frac{${a}}{${b}}`, `= ${a}/${b}`]]), [`\\approx ${f.tex(f.fix(w / 36, 3))}`, `≈ ${f.fix(w / 36, 3)}`]]; } },
};

const means = {
  noun: 'samples',
  // sums counts the samples by the total of their dice, which says where each one's mean sits.
  start: spec => ({ n: 0, size: spec.size, sum: 0, sq: 0, sums: Array(6 * spec.size + 1).fill(0), last: null }),
  trial: (rand, st) => Array.from({ length: st.size }, () => face(rand)),
  add(st, o) { const t = o.reduce((a, b) => a + b, 0), m = t / o.length; st.n++; st.sum += m; st.sq += m * m; st.sums[t]++; st.last = o; },
  measures: () => ({
    samples: count('samples', st => st.n), size: count('size', st => st.size),
    mean: number('mean', st => st.n ? st.sum / st.n : null, 2), spread: number('spread', st => st.n ? Math.sqrt(Math.max(0, st.sq / st.n - (st.sum / st.n) ** 2)) : null, 2),
    'expected-mean': fixed('expected-mean', () => 3.5, 2), 'expected-spread': fixed('expected-spread', st => DIE_SPREAD / Math.sqrt(st.size), 2),
  }),
  // The spread of the means of n dice is the spread of one die over the square root of n.
  formulas: { spread: (st, f) => [[`\\text{${f.word('spread')}}`, f.word('spread')], [`\\approx \\frac{${f.tex(f.fix(DIE_SPREAD, 2))}}{\\sqrt{${st.size}}}`, `≈ ${f.fix(DIE_SPREAD, 2)}/√${st.size}`],
    [`\\approx ${f.tex(f.fix(DIE_SPREAD / Math.sqrt(st.size), 2))}`, `≈ ${f.fix(DIE_SPREAD / Math.sqrt(st.size), 2)}`]] },
};

const galton = {
  noun: 'balls',
  start: spec => ({ n: 0, counts: Array(spec.rows + 1).fill(0), last: null, pick: spec.pick }),
  // A ball's way down has a 0 for left or a 1 for right at each row of pegs. Its bin is the number of rights.
  trial: (rand, st, spec) => Array.from({ length: spec.rows }, () => rand() < 0.5 ? 0 : 1),
  add(st, o) { const k = o.reduce((a, b) => a + b, 0); st.n++; st.counts[k]++; st.last = o; },
  measures: spec => {
    const R = spec.rows, all = 2 ** R;
    return {
      balls: count('balls', st => st.n), rows: count('rows', () => R), bins: count('bins', () => R + 1), paths: count('paths', () => all), pick: count('pick-bin', st => st.pick),
      ...each(range(0, R), k => ({ count: count('count-bin', st => st.counts[k], k), share: share('share-bin', st => st.counts[k], k),
        ways: count('ways-bin', () => choose(R, k), k), p: chance('p-bin', () => choose(R, k), all, k) })),
      'count-pick': count('count-bin', st => st.counts[st.pick], st => st.pick), 'share-pick': share('share-bin', st => st.counts[st.pick], st => st.pick),
      'ways-pick': count('ways-bin', st => choose(R, st.pick), st => st.pick), 'p-pick': chance('p-bin', st => choose(R, st.pick), all, st => st.pick),
    };
  },
  // The chance of the picked bin is the paths that end there out of all the paths.
  formulas: { 'p-pick': (st, f, spec) => { const R = spec.rows, w = choose(R, st.pick), all = 2 ** R;
    return [[`P(${st.pick})`, `P(${st.pick})`], [`= \\frac{\\binom{${R}}{${st.pick}}}{2^{${R}}}`, `= C(${R}, ${st.pick})/2^${R}`], [`= \\frac{${f.tex(f.int(w))}}{${f.tex(f.int(all))}}`, `= ${f.int(w)}/${f.int(all)}`],
      [`\\approx ${f.tex(f.fix(w / all, 3))}`, `≈ ${f.fix(w / all, 3)}`]]; } },
};

// coin and flips share the coin's model. One draws the coin and its tally, and the other the share of heads over time.
export const MODELS = { coin, flips: coin, die, dice, means, galton };
export const SCENES = Object.keys(MODELS);

// runsOf draws every trial of the runs a page shows from one seed, so a seed always gives the same runs.
export function runsOf(spec, seed) {
  const m = MODELS[spec.scene], rand = generator(seed), st = m.start(spec);
  return Array.from({ length: spec.runs ?? 1 }, () => Array.from({ length: spec.trials }, () => m.trial(rand, st, spec)));
}
// replay gives the counts after the first n trials of a run.
export function replay(spec, run, n) {
  const m = MODELS[spec.scene], st = m.start(spec);
  for (let i = 0; i < n; i++) m.add(st, run[i]);
  return st;
}
// countsAt gives the counts after n trials of the first run, with every other run whole in others.
const countsAt = (spec, runs, n) => Object.assign(replay(spec, runs[0], n), { others: runs.slice(1).map(r => replay(spec, r, r.length)) });

// starts gives the counts a page opens with, from its first run at the slider's starting place.
export function starts(spec) {
  const s = { ...spec, size: spec.sizes?.[0] };
  return countsAt(s, runsOf(s, seedOf(spec.seed, 0)), spec.at ?? 0);
}
