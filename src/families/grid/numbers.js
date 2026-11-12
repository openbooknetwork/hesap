// This file holds the arithmetic the scenes colour by, such as multiples, factors, primes, gcd, lcm, remainders and
// the places of the Ulam spiral. They are plain functions, so the build and the browser compute the same numbers.
export const span = ([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
export const divides = (d, m) => d > 0 && m % d === 0;
export const factors = n => span([1, n]).filter(d => divides(d, n));
// pairs lists each a × b = n with a ≤ b, one for each rectangle of dots n makes.
export const pairs = n => factors(n).filter(d => d * d <= n).map(d => [d, n / d]);
export function prime(n) { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }
export const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const lcm = (a, b) => a / gcd(a, b) * b;
export const mod = (n, d) => ((n % d) + d) % d;
// least finds the smallest prime that divides n, which is the prime that crosses n out in the sieve.
export function least(n) { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; }
// The sieve uses the primes whose square is at most top on the numbers up to top. Every number left standing after
// them is prime.
export const sieving = top => span([2, Math.floor(Math.sqrt(top))]).filter(prime);

// spiral finds the place of n on the Ulam spiral. 1 sits at (0, 0) and 2 to its right, and the spiral turns up and
// anticlockwise. y grows downwards, as on the screen.
export function spiral(n) {
  const k = Math.ceil((Math.sqrt(n) - 1) / 2), side = 2 * k;
  let end = (2 * k + 1) ** 2;
  if (n > end - side) return [k - (end - n), k];          // n is on the bottom row, walked to the right
  end -= side;
  if (n > end - side) return [-k, k - (end - n)];         // n is in the left column, walked down
  end -= side;
  if (n > end - side) return [-k + (end - n), -k];        // n is on the top row, walked to the left
  return [k, -k + (end - side - n)];                      // n is in the right column, walked up
}
