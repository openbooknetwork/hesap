// An equation is data here: each side holds a count of x and a number, both fractions { n, d }. A step does the same to
// both sides, so the x that makes the sides weigh the same stays the same.
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const q = (n, d = 1) => { const g = gcd(n, d) || 1, s = d < 0 ? -1 : 1; return { n: (s * n / g) || 0, d: s * d / g }; };
export const add = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => q(a.n * b.n, a.d * b.d);
export const div = (a, b) => q(a.n * b.d, a.d * b.n);
export const same = (a, b) => a.n === b.n && a.d === b.d;
export const value = a => a.n / a.d;
const abs = a => q(Math.abs(a.n), a.d), ONE = q(1);

// equation reads a page's equation from its YAML, { left: { x, number }, right: { x, number } }
export const equation = spec => ({ l: { x: q(spec.left.x), c: q(spec.left.number) }, r: { x: q(spec.right.x), c: q(spec.right.number) } });

// OPS says what each step does to one side, with n the number the reader picked. The x steps add or take n boxes.
export const OPS = {
  subtract: (s, n) => ({ x: s.x, c: sub(s.c, n) }),
  add: (s, n) => ({ x: s.x, c: add(s.c, n) }),
  'subtract-x': (s, n) => ({ x: sub(s.x, n), c: s.c }),
  'add-x': (s, n) => ({ x: add(s.x, n), c: s.c }),
  divide: (s, n) => ({ x: div(s.x, n), c: div(s.c, n) }),
  multiply: (s, n) => ({ x: mul(s.x, n), c: mul(s.c, n) }),
};
export const apply = (e, op, n) => ({ l: OPS[op](e.l, q(n)), r: OPS[op](e.r, q(n)) });
// fits says whether a step's numbers stay small enough to read
export const fits = e => [e.l.x, e.l.c, e.r.x, e.r.c].every(a => Math.abs(a.n) < 1000 && a.d < 1000);

// solve finds the x that makes both sides weigh the same, and it returns null when no single x does
export const solve = e => { const a = sub(e.l.x, e.r.x); return a.n ? div(sub(e.r.c, e.l.c), a) : null; };
export const weight = (s, x) => value(s.x) * x + value(s.c);
export const level = (e, x) => Math.abs(weight(e.l, x) - weight(e.r, x)) < 1e-9;
// alone returns the number on the other side when x stands alone on one side, else null
export function alone(e) {
  const lone = s => same(s.x, ONE) && !s.c.n, bare = s => !s.x.n;
  return lone(e.l) && bare(e.r) ? e.r.c : lone(e.r) && bare(e.l) ? e.l.c : null;
}

// num and xs write TeX for a number and for a count of x, both at least 0
const num = a => (a.d === 1 ? `${a.n}` : `\\frac{${a.n}}{${a.d}}`);
const xs = a => (same(a, ONE) ? 'x' : a.d === 1 ? `${a.n}x` : `\\frac{${a.n === 1 ? '' : a.n}x}{${a.d}}`);
export const signed = a => (a.n < 0 ? `-${num(abs(a))}` : num(a));
const op = tex => `\\htmlClass{op}{${tex}}`;

// terms writes one side as tokens, a sign and a size for each term, keyed so a term keeps its key from line to line.
// wrap writes a term's size inside what a step does to it.
export function terms(side, s, wrap = t => t) {
  const out = [];
  for (const [k, v, tex] of [['x', side.x, xs], ['c', side.c, num]]) {
    if (!v.n) continue;
    if (out.length || v.n < 0) out.push({ key: `${s}.${k}s`, tex: v.n < 0 ? '-' : '+', sign: true, unary: !out.length });
    out.push({ key: `${s}.${k}`, tex: wrap(tex(abs(v))) });
  }
  return out.length ? out : [{ key: `${s}.0`, tex: wrap('0') }];
}
export const line = (e, rel = '=') => [...terms(e.l, 'l'), { key: 'rel', tex: rel }, ...terms(e.r, 'r')];

// acting writes the line while a step acts on it. The term a step adds or takes stands at the end of each side, and a
// product or a quotient wraps every term.
export function acting(e, id, n) {
  const added = { subtract: ['-', `${n}`], add: ['+', `${n}`], 'subtract-x': ['-', xs(q(n))], 'add-x': ['+', xs(q(n))] }[id];
  const side = (v, s) => added ? [...terms(v, s), { key: `${s}.os`, tex: added[0], sign: true, op: true }, { key: `${s}.o`, tex: added[1], op: true }]
    : terms(v, s, id === 'multiply' ? t => `${op(`${n}\\cdot`)}${t}` : t => (t.includes('\\frac') ? `${t}${op(`\\div ${n}`)}` : `\\frac{${t}}{${op(n)}}`));
  return [...side(e.l, 'l'), { key: 'rel', tex: '=' }, ...side(e.r, 'r')];
}
// said writes a step as it stands beside its line and on its button
export const said = (id, n) => ({ subtract: `-${n}`, add: `+${n}`, 'subtract-x': `-${xs(q(n))}`, 'add-x': `+${xs(q(n))}`, divide: `\\div ${n}`, multiply: `\\times ${n}` }[id]);

// The check writes the first equation with the value in place of x, then what each side comes to.
export function substituted(e, v) {
  const put = a => op(a.n < 0 ? `(${signed(a)})` : num(a));
  const side = (s, k) => terms(s, k, t => t).map(t => (t.key.endsWith('.x') ? { ...t, tex: same(abs(s.x), ONE) ? put(v) : `${num(abs(s.x))} \\cdot ${put(v)}` } : t));
  return [...side(e.l, 'l'), { key: 'rel', tex: '=' }, ...side(e.r, 'r')];
}
export const checked = (e, v) => {
  const at = s => add(mul(s.x, v), s.c);
  return [{ key: 'l.v', tex: signed(at(e.l)) }, { key: 'rel', tex: '=' }, { key: 'r.v', tex: signed(at(e.r)) }, { key: 'r.ok', tex: op('\\checkmark') }];
};
