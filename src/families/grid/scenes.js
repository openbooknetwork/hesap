// The scenes a page can name in hesap.scene. A scene says which controls it needs, what it measures, and how every
// number looks for the current values, as a few classes per number. It moves nothing itself. The client finds the
// cells whose look changed and colours them at once, or in a wave when the scene's wave gives one.
// A tap control is a number the reader taps, and there is always one. A pick is a tapped number the reader can clear.
// A many control holds the numbers the reader has marked, and each tap marks or clears one.
// A wave { order: m => step } walks the numbers in its own order. A scene's wave gives one only where the order is
// the idea, such as counting up in steps of n.
import { span, divides, factors, pairs, prime, lcm, mod, least, sieving, spiral } from './numbers.js';

const all = spec => span(spec.numbers);
const top = spec => spec.numbers[1];
const classes = (...names) => names.filter(Boolean).join(' ');
const multiples = (spec, n) => all(spec).filter(m => divides(n, m));
// Tapping n counts up in steps of n, and each multiple lights up as the count reaches it.
const counting = (v, spec, change) => change === 'n' && v.n ? { order: m => divides(v.n, m) ? m / v.n - 1 : null } : null;

// ---------- The multiples of one number ----------
const multiplesScene = {
  controls: { n: 'tap' },
  measures: {
    'count-multiples': (v, spec) => multiples(spec, v.n).length,
    'last-multiple': (v, spec) => Math.floor(top(spec) / v.n) * v.n,
  },
  formulas: {},
  paint: v => m => classes(divides(v.n, m) && 'grid-c1 fill', m === v.n && 'base'),
  wave: counting,
  marks: { n: v => [v.n], 'count-multiples': (v, spec) => multiples(spec, v.n), 'last-multiple': (v, spec) => [Math.floor(top(spec) / v.n) * v.n] },
};

// ---------- The multiples of two numbers, and the ones they share ----------
const shared = (spec, v) => all(spec).filter(m => divides(v.a, m) && divides(v.b, m));
const common = {
  controls: { a: 'slider', b: 'slider' },
  measures: {
    lcm: v => lcm(v.a, v.b),
    product: v => v.a * v.b,
    'count-common': (v, spec) => shared(spec, v).length,
  },
  formulas: {},
  paint: v => m => {
    const a = divides(v.a, m), b = divides(v.b, m);
    return classes(a && b ? 'both' : a ? 'grid-c1 fill' : b && 'grid-c2 fill', m === lcm(v.a, v.b) && 'lcm', (m === v.a || m === v.b) && 'base');
  },
  marks: { a: v => [v.a], b: v => [v.b], lcm: v => [lcm(v.a, v.b)], product: v => [v.a * v.b], 'count-common': (v, spec) => shared(spec, v) },
};

// ---------- The factors of a number, beside the rectangles of dots it makes ----------
const factorsScene = {
  controls: { n: 'tap' },
  measures: {
    factors: v => factors(v.n),
    'count-factors': v => factors(v.n).length,
    rectangles: v => pairs(v.n).length,
  },
  formulas: { pairs: v => [[String(v.n), String(v.n)], ...pairs(v.n).map(([a, b]) => [`= ${a} \\times ${b}`, `= ${a} × ${b}`])] },
  paint: v => m => classes(divides(m, v.n) && 'grid-c2 fill', m === v.n && 'base'),
  marks: { n: v => [v.n], factors: v => factors(v.n), 'count-factors': v => factors(v.n), rectangles: v => factors(v.n) },
  aside: 'rectangles',
};

// ---------- The sieve of Eratosthenes, one prime at a time ----------
// The slider used counts the primes that have crossed out their multiples. 1 is 2, 2 is 3, and so on.
const used = (v, spec) => sieving(top(spec)).slice(0, v.used);
const crossed = (v, spec) => { const done = used(v, spec); return all(spec).filter(m => m > 1 && !prime(m) && done.includes(least(m))); };
const sieve = {
  controls: { used: 'slider' },
  limits: spec => ({ used: [0, sieving(top(spec)).length] }),
  measures: {
    prime: (v, spec) => v.used ? sieving(top(spec))[v.used - 1] : null,
    crossed: (v, spec) => crossed(v, spec).length,
    standing: (v, spec) => all(spec).filter(m => m > 1).length - crossed(v, spec).length,
    'count-primes': (v, spec) => all(spec).filter(prime).length,
  },
  formulas: {},
  // A prime that has done its sieving wears its colour, the current one with a ring. At the end every prime turns
  // purple, and the ones that sieved keep their colour as a ring.
  paint: (v, spec) => {
    const P = sieving(top(spec)), done = P.slice(0, v.used), end = v.used === P.length, now = P[v.used - 1];
    return m => {
      if (m < 2) return 'one';
      if (done.includes(m)) return end ? `prime grid-c${P.indexOf(m) + 1}` : classes(`grid-c${P.indexOf(m) + 1} fill`, m === now && 'now');
      if (prime(m)) return end ? 'prime' : '';
      return done.includes(least(m)) ? `out grid-c${P.indexOf(least(m)) + 1}` : '';
    };
  },
  // One step on the slider visits the prime first and then its multiples in order, the ones crossed out already among
  // them. After the last prime every prime turns purple at once. Any other change shows at once.
  wave: (v, spec, change, was) => {
    const P = sieving(top(spec)), p = P[v.used - 1];
    if (change !== 'used' || v.used !== was.used + 1) return null;
    const last = Math.floor(top(spec) / p) + 2;
    return { order: m => m === p ? 0 : m > p && divides(p, m) ? m / p - 1 : v.used === P.length && prime(m) && m !== p ? last : null };
  },
  marks: {
    prime: (v, spec) => used(v, spec).slice(-1), crossed: (v, spec) => crossed(v, spec), 'count-primes': (v, spec) => all(spec).filter(prime),
    standing: (v, spec) => { const out = crossed(v, spec); return all(spec).filter(m => m > 1 && !out.includes(m)); },
  },
};

// ---------- Primes and multiples in a grid of any width ----------
const firstRow = (v, spec) => spec.numbers[0] + v.columns;
const width = {
  controls: { n: 'pick' },
  measures: {
    // This counts the columns that hold a prime below the first row.
    'prime-columns': (v, spec) => new Set(all(spec).filter(m => prime(m) && m >= firstRow(v, spec)).map(m => (m - spec.numbers[0]) % v.columns)).size,
  },
  formulas: {},
  paint: v => m => classes(prime(m) ? 'prime' : v.n && divides(v.n, m) && 'grid-c2 fill', m === v.n && 'base'),
  wave: counting,
  marks: { n: v => v.n ? [v.n] : [], 'prime-columns': (v, spec) => all(spec).filter(m => prime(m) && m >= firstRow(v, spec)) },
};

// ---------- Every number takes the colour of what is left after dividing by n ----------
const alike = (v, spec) => all(spec).filter(m => mod(m, v.n) === mod(v.x, v.n));
const remainders = {
  controls: { n: 'slider', x: 'tap' },
  limits: { n: [2, 8] }, // each remainder needs a colour, and there are eight
  min: 0, // the grid may start at 0, which is the remainder of every multiple of n
  measures: {
    remainder: v => mod(v.x, v.n),
    quotient: v => Math.floor(v.x / v.n),
    'count-remainder': (v, spec) => alike(v, spec).length,
  },
  formulas: { division: v => { const q = Math.floor(v.x / v.n), r = mod(v.x, v.n); return [[String(v.x), String(v.x)], [`= ${q} \\times ${v.n} + ${r}`, `= ${q} × ${v.n} + ${r}`]]; } },
  paint: v => m => classes(`grid-c${mod(m, v.n) + 1} fill`, m === v.x && 'base'),
  marks: { x: v => [v.x], n: (v, spec) => all(spec).filter(m => mod(m, v.n) === 0), remainder: alike, quotient: v => [v.x], 'count-remainder': alike },
  aside: 'clock',
};

// ---------- The Ulam spiral winds the numbers round 1 and marks the primes ----------
const side = v => v.size, count = v => v.size ** 2;
// This lists the numbers on the two diagonals through n.
const diagonals = v => { const [x, y] = spiral(v.n); return span([1, count(v)]).filter(m => { const [a, b] = spiral(m); return Math.abs(a - x) === Math.abs(b - y); }); };
const spiralScene = {
  controls: { size: 'slider', n: 'pick' },
  layout: v => { const k = (side(v) - 1) / 2; return { cols: side(v), rows: side(v), at: m => m <= count(v) ? spiral(m).map(c => c + k) : null }; },
  // A tapped number that the spiral no longer reaches is let go.
  settle: v => v.n > count(v) ? { ...v, n: null } : v,
  measures: {
    numbers: v => count(v),
    'count-primes': v => span([1, count(v)]).filter(prime).length,
    'diagonal-primes': v => v.n ? diagonals(v).filter(prime).length : null,
  },
  formulas: {},
  paint: v => {
    const on = v.n ? new Set(diagonals(v)) : null;
    return m => m > count(v) ? 'gone' : classes(prime(m) && 'prime', m === 1 && 'one', on?.has(m) && 'diag', m === v.n && 'base');
  },
  marks: { numbers: v => span([1, count(v)]), 'count-primes': v => span([1, count(v)]).filter(prime), 'diagonal-primes': v => v.n ? diagonals(v).filter(prime) : [] },
};

// ---------- A challenge lets the reader mark numbers ----------
const mark = {
  controls: { marks: 'many' },
  measures: { marked: v => v.marks.length },
  formulas: {},
  paint: v => m => v.marks.includes(m) ? 'prime' : '',
  marks: { marked: v => v.marks },
};

// ---------- A challenge colours the multiples of two numbers and leaves their least common multiple bare ----------
const two = {
  controls: { a: 'slider', b: 'slider' },
  measures: {},
  formulas: {},
  paint: v => m => {
    const a = divides(v.a, m), b = divides(v.b, m);
    return classes(a && b ? 'both' : a ? 'grid-c1 fill' : b && 'grid-c2 fill', (m === v.a || m === v.b) && 'base');
  },
};

export default { multiples: multiplesScene, common, factors: factorsScene, sieve, width, remainders, spiral: spiralScene, mark, two };
