// This file does fraction maths with exact integers. A fraction is { n, d } with n ≥ 0 and d ≥ 1, kept as written.
// Nothing here rounds, so a check in the build and the page in the browser agree on every value.

export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const lcm = (a, b) => a / gcd(a, b) * b;
export const frac = (n, d) => ({ n, d });
export const simplest = f => { const g = gcd(f.n, f.d); return frac(f.n / g, f.d / g); };
// over() writes the same amount over d parts, when d is a multiple of the fraction's denominator.
export const over = (f, d) => frac(f.n * d / f.d, d);
// compare() gives -1, 0 or 1 as a is less than, equal to or more than b.
export const compare = (a, b) => Math.sign(a.n * b.d - b.n * a.d);
export const add = (a, b) => { const d = lcm(a.d, b.d); return frac(over(a, d).n + over(b, d).n, d); };
// mixed() splits off the wholes, so 7/4 is 1 and 3/4.
export const mixed = f => ({ whole: Math.floor(f.n / f.d), n: f.n % f.d, d: f.d });
// shared() lists the prime factors two numbers share, each once. 12 and 18 share 2 and 3.
export function shared(a, b) {
  const out = [];
  for (let g = gcd(a, b), p = 2; g > 1; p++) if (g % p === 0) { out.push(p); while (g % p === 0) g /= p; }
  return out;
}

// expand() writes n/d as a decimal by long division. It returns the whole part, the digits that come once and the
// digits that repeat for ever.
export function expand(n, d) {
  const whole = Math.floor(n / d), digits = [], seen = new Map();
  let r = n % d;
  while (r && !seen.has(r)) { seen.set(r, digits.length); r *= 10; digits.push(Math.floor(r / d)); r %= d; }
  const at = r ? seen.get(r) : digits.length;
  return { whole, once: digits.slice(0, at).join(''), repeat: digits.slice(at).join('') };
}

// written() and read() turn a fraction into the words a page writes, such as 3/4, and back.
export const written = f => `${f.n}/${f.d}`;
export const read = s => { const m = /^(\d+)\/(\d+)$/.exec(String(s).trim()); return m && +m[2] > 0 ? frac(+m[1], +m[2]) : null; };
