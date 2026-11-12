// The goals a challenge page can name in hesap.challenge.goal. A goal says whether the board reaches the target, which
// cells to celebrate, what Hint adds to the board, and which values of the scene the target sets. The page lists the
// targets, and Another one moves to the next.
import { span, divides, prime, lcm, least } from './numbers.js';

const pair = t => Array.isArray(t) && t.length === 2 && t.every(Number.isInteger) && t[0] <= t[1];
const range = ([lo, hi]) => span([lo, hi]);

export default {
  // The reader marks every prime from t[0] to t[1] and nothing else. Hint strikes the numbers in that stretch that
  // have a factor of 2, 3, 5 or 7, and 1.
  'primes-between': {
    scenes: ['mark'],
    target: t => pair(t) ? null : 'write each target as [first, last], such as [50, 70]',
    fresh: ['marks'], // a new target starts with no marks
    holds: (v, spec, t) => { const want = range(t).filter(prime); return v.marks.length === want.length && want.every(m => v.marks.includes(m)); },
    shows: (v, spec, t) => range(t).filter(prime),
    paint: (v, spec, t, hint) => m => m < t[0] || m > t[1] ? 'away' : hint && (m === 1 || !prime(m) && least(m) <= 7) ? 'struck' : '',
    says: t => t,
    reach: (spec, t) => t[0] >= spec.numbers[0] && t[1] <= spec.numbers[1] && range(t).some(prime) ? null : `holds no prime on the grid from ${spec.numbers[0]} to ${spec.numbers[1]}`,
  },
  // The reader slides a and b until their least common multiple is t. Hint rings the numbers the sliders reach that
  // divide t.
  lcm: {
    scenes: ['common'],
    target: t => Number.isInteger(t) && t > 0 ? null : 'write each target as a whole number, such as 36',
    hides: ['lcm'], // This readout would show the answer.
    holds: (v, spec, t) => lcm(v.a, v.b) === t,
    shows: (v, spec, t) => [v.a, v.b, t],
    paint: (v, spec, t, hint) => { const [lo, hi] = spec.controls.a.slider; return m => hint && m >= lo && m <= hi && divides(m, t) ? 'cue' : ''; },
    says: t => [t],
    reach: (spec, t) => { const as = range(spec.controls.a.slider), bs = range(spec.controls.b.slider); return as.some(a => bs.some(b => lcm(a, b) === t)) ? null : `is the least common multiple of no a and b the sliders reach`; },
  },
  // The target names two numbers, and the reader slides the width until the multiples of both stand in columns.
  // Hint rings their least common multiple.
  columns: {
    scenes: ['two'],
    target: t => pair(t) ? null : 'write each target as [a, b], such as [3, 4]',
    sets: t => ({ a: t[0], b: t[1] }),
    holds: v => divides(v.a, v.columns) && divides(v.b, v.columns),
    shows: (v, spec) => span(spec.numbers).filter(m => divides(v.a, m) || divides(v.b, m)),
    paint: (v, spec, t, hint) => m => hint && m === lcm(t[0], t[1]) ? 'lcm' : '',
    says: t => t,
    reach: (spec, t) => spec.columns?.slider && range(spec.columns.slider).some(w => divides(t[0], w) && divides(t[1], w)) ? null : 'has no width on the columns slider that both numbers divide',
  },
};
