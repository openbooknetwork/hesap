// A page names one of these rules in hesap.rule. Each gives y for an x with its coefficients k, the slope there, the
// area function F (whose change from a to b is the area under the curve), and how the rule is written. A writer w
// writes it in TeX or in plain text (format.js).

// poly writes a polynomial's terms [k, power], highest power first. X is x, or a number written in x's place.
function poly(terms, X, w) {
  const symbol = X === 'x', out = [];
  for (const [k, p] of terms) {
    if (!k) continue;
    const size = Math.abs(k), power = p === 0 ? '' : p === 1 ? X : w.pow(X, p);
    // -1.2² would read as a square of -1.2, so a leading minus keeps its 1 once a number stands in for x
    const one = size === 1 && (symbol || k > 0 || out.length);
    const body = p === 0 ? w.n(size) : one ? power : symbol ? `${w.n(size)}${power}` : `${w.n(size)} ${w.times} ${power}`;
    out.push(out.length ? `${k < 0 ? w.minus : '+'} ${body}` : `${k < 0 ? w.minus : ''}${body}`);
  }
  return out.length ? out.join(' ') : '0';
}

const RULES = {
  line: { coefficients: { m: 0.5, c: 1 },
    y: (x, k) => k.m * x + k.c, slope: (x, k) => k.m, F: (x, k) => k.m * x * x / 2 + k.c * x,
    write: (k, X, w) => poly([[k.m, 1], [k.c, 0]], X, w) },
  parabola: { coefficients: { a: 1, b: 0, c: 0 },
    y: (x, k) => (k.a * x + k.b) * x + k.c, slope: (x, k) => 2 * k.a * x + k.b, F: (x, k) => ((k.a * x / 3 + k.b / 2) * x + k.c) * x,
    write: (k, X, w) => poly([[k.a, 2], [k.b, 1], [k.c, 0]], X, w),
    // vertex gives the lowest point, or the highest when a is below 0. With a at 0 the curve is a line, which has none.
    vertex: k => k.a ? [-k.b / (2 * k.a), k.c - k.b * k.b / (4 * k.a)] : null },
  cubic: { coefficients: { a: 0.25, b: 0, c: -1.5, d: 0 },
    y: (x, k) => ((k.a * x + k.b) * x + k.c) * x + k.d, slope: (x, k) => (3 * k.a * x + 2 * k.b) * x + k.c,
    F: (x, k) => (((k.a * x / 4 + k.b / 3) * x + k.c / 2) * x + k.d) * x,
    write: (k, X, w) => poly([[k.a, 3], [k.b, 2], [k.c, 1], [k.d, 0]], X, w) },
  sine: { coefficients: { a: 2, b: 1 },
    y: (x, k) => k.a * Math.sin(k.b * x), slope: (x, k) => k.a * k.b * Math.cos(k.b * x), F: (x, k) => k.b ? -k.a / k.b * Math.cos(k.b * x) : 0,
    write: (k, X, w) => `${Math.abs(k.a) === 1 ? (k.a < 0 ? w.minus : '') : w.n(k.a)} ${w.sin}(${k.b === 1 ? X.replace(/^\((.*)\)$/, '$1') : X === 'x' ? `${w.n(k.b)}x` : `${w.n(k.b)} ${w.times} ${X}`})` },
};
export default RULES;

// bind fills in a rule's coefficients: the rule's own, then the page's, then the sliders'.
export function bind(name, ...over) {
  const r = RULES[name], k = Object.assign({}, r.coefficients, ...over.map(o => Object.fromEntries(Object.entries(o).filter(([id]) => id in r.coefficients))));
  return { k, y: x => r.y(x, k), slope: x => r.slope(x, k), area: (a, b) => r.F(b, k) - r.F(a, k), write: (X, w) => r.write(k, X, w), vertex: () => r.vertex?.(k) ?? null };
}

// left adds up the area of n rectangles from a to b, each as tall as the curve at its left edge.
export const left = (R, a, b, n) => { const w = (b - a) / n; let sum = 0; for (let i = 0; i < n; i++) sum += R.y(a + i * w) * w; return sum; };

// mix gives the rule part way from a to b, as a curve morphs from one rule to the next. Each part mixes linearly.
export const mix = (a, b, t) => ({ y: x => a.y(x) + (b.y(x) - a.y(x)) * t, slope: x => a.slope(x) + (b.slope(x) - a.slope(x)) * t,
  area: (p, q) => a.area(p, q) + (b.area(p, q) - a.area(p, q)) * t });
