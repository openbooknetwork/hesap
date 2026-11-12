// The scenes a page can name. Each says which fractions it works on, what a text can link (measures and worked
// formulas), what the buttons under it do, and what its picture holds for the current values. The figure draws the
// picture and animates each change.
import { frac, gcd, lcm, simplest, over, compare, add, mixed, shared } from './fraction.js';

const num = x => ({ kind: 'number', x }), sign = s => ({ kind: 'sign', s }), of = (f, kind) => ({ kind, n: f.n, d: f.d });
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const share = f => f.n / f.d;

// These are the measures every fraction of a scene offers, for a fraction named x.
function measures(x) {
  const f = v => v[x];
  return {
    [x]: { of: x, value: f },
    [`top-${x}`]: { of: x, value: v => num(f(v).n), label: 'top' },
    [`bottom-${x}`]: { of: x, value: v => num(f(v).d), label: 'bottom' },
    [`simplest-${x}`]: { of: x, value: v => simplest(f(v)), eq: (v, w) => `${w.f(f(v))} = ${w.f(simplest(f(v)))}` },
    [`gcd-${x}`]: { of: x, value: v => num(gcd(f(v).n, f(v).d)), label: 'gcd' },
    [`decimal-${x}`]: { of: x, value: v => of(f(v), 'decimal'), eq: (v, w) => `${w.f(f(v))} = ${w.dec(f(v))}` },
    [`percent-${x}`]: { of: x, value: v => of(f(v), 'percent'), eq: (v, w) => `${w.f(f(v))} = ${w.pct(f(v))}` },
    [`mixed-${x}`]: { of: x, value: v => of(f(v), 'mixed'), eq: (v, w) => `${w.f(f(v))} = ${w.mixed(f(v))}` },
  };
}
// The worked formulas for a fraction x, as steps: the first is what is worked out, each next one starts with = or a
// sign. w writes them, in TeX for the page or as plain text for the check.
function formulas(x) {
  return {
    [`simplest-${x}`]: (v, w) => { const f = v[x], g = gcd(f.n, f.d);
      return [w.f(f), `= ${w.fx(`${f.n} ${w.div} ${g}`, `${f.d} ${w.div} ${g}`)}`, `= ${w.f(simplest(f))}`]; },
    [`decimal-${x}`]: (v, w) => [w.f(v[x]), `= ${v[x].n} ${w.div} ${v[x].d}`, `= ${w.dec(v[x])}`],
    [`percent-${x}`]: (v, w) => [w.f(v[x]), `= ${w.per(w.fx(`${v[x].n} ${w.times} 100`, v[x].d))}`, `= ${w.pct(v[x])}`],
    [`mixed-${x}`]: (v, w) => { const f = v[x], m = mixed(f);
      if (!m.whole || !m.n) return [w.f(f), `= ${w.mixed(f)}`];
      return [w.f(f), `= ${w.f(frac(m.whole * f.d, f.d))} + ${w.f(frac(m.n, f.d))}`, `= ${m.whole} + ${w.f(frac(m.n, f.d))}`, `= ${w.mixed(f)}`]; },
  };
}

// ---------- the pictures ----------
// The bar runs across the top, the pie sits below it on the left and the fraction's name stands on the right.
const PIE = { cx: 140, cy: 262, r: 106 };
function barAndPie(d, look, name, { tap, fine } = {}) {
  const row = Array.isArray(name); // two names side by side take a smaller type, clear of the pie
  return [
    { kind: 'bar', id: 'bar', of: 'a', x: 30, y: 34, w: 340, h: 78, d, fine, tap, ...look },
    { kind: 'pie', id: 'pie', of: 'a', ...PIE, d, fine, tap, ...look },
    { kind: 'label', id: 'name', of: 'a', x: row ? 328 : 322, y: PIE.cy, size: row ? 32 : 40, value: name },
  ];
}

// ---------- the scenes ----------
// The whole is cut into equal parts, which the reader shades by tapping.
const shade = {
  fractions: ['a'], top: false, view: { width: 400, height: 390 },
  state: v => ({ on: Array.from({ length: v.a.d }, (_, i) => i < v.a.n) }),
  // the parts keep their shading by number when the whole is cut again
  changed(v) { v.on = Array.from({ length: v.a.d }, (_, i) => !!v.on[i]); v.a = frac(v.on.filter(Boolean).length, v.a.d); },
  tap(v, i, mode) { const to = mode ?? !v.on[i]; v.on[i] = to; v.a = frac(v.on.filter(Boolean).length, v.a.d); return to; },
  actions: v => [{ id: 'clear', off: !v.a.n }],
  act: { clear(v) { v.on = v.on.map(() => false); v.a = frac(0, v.a.d); } },
  figure: v => barAndPie(v.a.d, { parts: v.on.map(o => o ? 'a' : null), slide: true }, v.a, { tap: 'toggle' }),
};

// the top counts the shaded parts and the bottom the parts of the whole
const fraction = {
  fractions: ['a'], view: { width: 400, height: 390 },
  figure: v => barAndPie(v.a.d, { fill: share(v.a), cls: 'a' }, v.a, { tap: 'set' }),
};

// Every part is cut into the same number of pieces. There are more pieces, and the amount stays the same.
const equal = v => frac(v.a.n * v.pieces, v.a.d * v.pieces);
const equivalent = {
  fractions: ['a'], controls: { pieces: 'slider' }, view: { width: 400, height: 390 },
  measures: { pieces: { value: v => num(v.pieces), label: 'pieces' }, equal: { of: 'a', value: equal, eq: (v, w) => `${w.f(v.a)} = ${w.f(equal(v))}` } },
  formulas: { equal: (v, w) => [w.f(v.a), `= ${w.fx(`${v.a.n} ${w.times} ${v.pieces}`, `${v.a.d} ${w.times} ${v.pieces}`)}`, `= ${w.f(equal(v))}`] },
  figure: v => barAndPie(v.a.d, { fill: share(v.a), cls: 'a' }, v.pieces > 1 ? [v.a, '=', equal(v)] : v.a, { tap: 'set', fine: v.pieces }),
};

// The top and the bottom are divided by a factor they share, one step at a time, until they share none.
const now = v => frac(v.a.n / v.by, v.a.d / v.by);
const trail = v => { const out = [v.a]; for (const p of v.path) out.push(frac(out.at(-1).n / p, out.at(-1).d / p)); return out; };
const simplestScene = {
  fractions: ['a'], view: { width: 400, height: 390 },
  state: () => ({ by: 1, path: [] }),
  changed(v) { v.by = 1; v.path = []; },
  measures: {
    now: { of: 'a', value: now },
    trail: { of: 'a', value: v => ({ kind: 'list', items: trail(v) }), eq: (v, w) => trail(v).map(w.f).join(' = ') },
  },
  actions: v => [...shared(now(v).n, now(v).d).map(p => ({ id: `divide-${p}`, n: p })), { id: 'again', off: v.by === 1 }],
  act: {
    divide(v, p) { v.by *= p; v.path.push(p); },
    again(v) { v.by = 1; v.path = []; },
  },
  figure: v => barAndPie(now(v).d, { fill: share(v.a), cls: 'a' }, now(v)),
};

// These measures count the parts two fractions share when both are cut alike, and write each fraction over them.
const common = {
  common: { value: v => num(lcm(v.a.d, v.b.d)), label: 'common' },
  'common-a': { of: 'a', value: v => over(v.a, lcm(v.a.d, v.b.d)) },
  'common-b': { of: 'b', value: v => over(v.b, lcm(v.a.d, v.b.d)) },
};

// Two fractions sit on bars of the same length and on one number line.
const LINE = { x: 80, w: 300 };
const compareScene = {
  fractions: ['a', 'b'], view: { width: 400, height: 370 },
  state: () => ({ same: false }),
  measures: { sign: { value: v => sign(compare(v.a, v.b)), eq: (v, w) => `${w.f(v.a)} ${w.sign(compare(v.a, v.b))} ${w.f(v.b)}` }, ...common },
  formulas: { sign: (v, w) => {
    const L = lcm(v.a.d, v.b.d), s = [w.f(v.a)];
    if (L !== v.a.d) s.push(`= ${w.f(over(v.a, L))}`);
    s.push(`${w.sign(compare(v.a, v.b))} ${w.f(over(v.b, L))}`);
    if (L !== v.b.d) s.push(`= ${w.f(v.b)}`);
    return s;
  } },
  actions: v => [{ id: v.same ? 'own' : 'same' }],
  act: { same(v) { v.same = true; }, own(v) { v.same = false; } },
  figure(v) {
    const L = lcm(v.a.d, v.b.d), cut = f => v.same ? L : f.d, name = f => v.same ? over(f, L) : f, axis = 296;
    const row = (x, y) => [
      { kind: 'bar', id: x, of: x, x: LINE.x, y, w: LINE.w, h: 64, d: cut(v[x]), fill: share(v[x]), cls: x, tap: 'set' },
      { kind: 'label', id: `name-${x}`, of: x, x: 38, y: y + 32, size: 30, value: name(v[x]), cls: x },
      { kind: 'drop', id: `drop-${x}`, of: x, x: LINE.x + share(v[x]) * LINE.w, y1: y + 64, y2: axis, cls: x },
    ];
    return [...row('a', 26), ...row('b', 124), { kind: 'axis', id: 'axis', x: LINE.x, y: axis, w: LINE.w,
      ticks: [{ id: 'a', d: cut(v.a), side: -1, cls: 'a' }, { id: 'b', d: cut(v.b), side: 1, cls: 'b' }],
      marks: [{ id: 'a', at: share(v.a), side: -1, cls: 'a', value: name(v.a) }, { id: 'b', at: share(v.b), side: 1, cls: 'b', value: name(v.b) }] }];
  },
};

// Two fractions are added. A page shows one stage: both bars cut into the same parts, or their shaded parts moved
// into one bar. It opens on the stage before and moves on. A sum over one whole runs on into a second bar.
const sum = v => add(v.a, v.b);
const addScene = {
  fractions: ['a', 'b'], view: { width: 400, height: 392 },
  stages: ['cut', 'join'],
  state: (v, spec) => ({ step: addScene.stages.indexOf(spec.stage) + 1 }),
  opening: v => ({ ...v, step: v.step - 1 }),
  measures: { sum: { value: v => simplest(sum(v)), eq: (v, w) => `${w.f(v.a)} + ${w.f(v.b)} = ${w.f(simplest(sum(v)))}` },
    total: { value: sum, eq: (v, w) => `${w.f(over(v.a, lcm(v.a.d, v.b.d)))} + ${w.f(over(v.b, lcm(v.a.d, v.b.d)))} = ${w.f(sum(v))}` }, ...common },
  formulas: { sum: (v, w) => {
    const L = lcm(v.a.d, v.b.d), s = [`${w.f(v.a)} + ${w.f(v.b)}`], t = sum(v);
    if (L !== v.a.d || L !== v.b.d) s.push(`= ${w.f(over(v.a, L))} + ${w.f(over(v.b, L))}`);
    s.push(`= ${w.f(t)}`);
    if (gcd(t.n, t.d) > 1) s.push(`= ${w.f(simplest(t))}`);
    return s;
  } },
  figure(v) {
    const L = lcm(v.a.d, v.b.d), cut = f => v.step ? L : f.d, name = f => v.step ? over(f, L) : f, x = 86, w = 296, h = 54;
    const na = over(v.a, L).n, nb = over(v.b, L).n, done = v.step === 2;
    // The sum's parts are numbered across both wholes, and each one knows the part of a or b it comes from.
    const part = j => j < na ? 'a' : j < na + nb ? 'b' : null, from = j => j < na ? { id: 'a', i: j } : { id: 'b', i: j - na };
    const whole = k => ({ kind: 'bar', id: `sum-${k}`, of: 'sum', x, y: 236 + k * 84, w, h, d: v.step ? L : 1, ghost: k > 0 && na + nb <= L,
      parts: Array.from({ length: v.step ? L : 1 }, (_, i) => done ? part(k * L + i) : null), from: done ? Array.from({ length: L }, (_, i) => part(k * L + i) && from(k * L + i)) : null });
    return [
      { kind: 'bar', id: 'a', of: 'a', x, y: 22, w, h, d: cut(v.a), fill: share(v.a), cls: 'a', dim: done, tap: 'set' },
      { kind: 'bar', id: 'b', of: 'b', x, y: 120, w, h, d: cut(v.b), fill: share(v.b), cls: 'b', dim: done, tap: 'set' },
      whole(0), whole(1),
      { kind: 'label', id: 'name-a', of: 'a', x: 40, y: 49, size: 28, value: name(v.a), cls: 'a' },
      { kind: 'label', id: 'plus', x: 40, y: 98, size: 26, value: ['+'] },
      { kind: 'label', id: 'name-b', of: 'b', x: 40, y: 147, size: 28, value: name(v.b), cls: 'b' },
      { kind: 'label', id: 'is', x: 40, y: 206, size: 26, value: ['='] },
      { kind: 'label', id: 'name-sum', of: 'sum', x: 40, y: 263, size: 28, value: done ? frac(na + nb, L) : ['?'] },
    ];
  },
};

// A fraction can be more than one whole. Its parts fill a bar, then run on into the next.
const wholes = spec => spec.fractions.a.wholes;
const mixedScene = {
  fractions: ['a'], view: { width: 400, height: 350 },
  figure(v, spec) {
    const W = wholes(spec), d = v.a.d, x = 20, w = 280, h = 70, gap = (330 - W * h) / Math.max(W - 1, 1);
    return Array.from({ length: W }, (_, k) => {
      const y = 10 + k * (h + gap), part = clamp(v.a.n - k * d, 0, d);
      return [
        { kind: 'bar', id: `whole-${k}`, of: 'a', x, y, w, h, d, fill: part / d, cls: 'a', ghost: k > 0 && !part, tap: 'set', base: k * d },
        { kind: 'label', id: `count-${k}`, of: 'a', x: 352, y: y + h / 2, size: 30, value: part === d ? ['1'] : part ? frac(part, d) : [] },
      ];
    }).flat();
  },
};

// A fraction sits on a number line and is written as a decimal and as a percent.
const convert = {
  fractions: ['a'], view: { width: 400, height: 360 },
  figure(v) {
    const x = 60, w = 280, y = 196, at = share(v.a), mark = x + at * w;
    return [
      { kind: 'bar', id: 'bar', of: 'a', x, y: 34, w, h: 72, d: v.a.d, fill: at, cls: 'a', tap: 'set' },
      { kind: 'drop', id: 'drop', of: 'a', x: mark, y1: 106, y2: y, cls: 'a' },
      { kind: 'axis', id: 'axis', x, y, w, tenths: true, ends: true, ticks: [{ id: 'a', d: v.a.d, side: -1, cls: 'a' }], marks: [{ id: 'a', at, side: 1, cls: 'a' }] },
      { kind: 'drop', id: 'lead', of: 'a', x: mark, y1: y + 12, y2: 282, cls: 'a' },
      { kind: 'label', id: 'ways', of: 'a', x: mark, within: [6, 394], y: 312, size: 26, value: [v.a, '=', of(v.a, 'decimal'), '=', of(v.a, 'percent')] },
    ];
  },
};

// The reader places a fraction between two others that a challenge names. Dashed lines carry the two up across the bar,
// and the gap between them is marked on the number line.
const betweenScene = {
  fractions: ['a'], challenge: true, view: { width: 400, height: 320 },
  figure(v) {
    const x = 50, w = 300, y = 232, t = v.target, lo = x + share(t.above) * w, hi = x + share(t.below) * w, at = share(v.a);
    return [
      { kind: 'band', id: 'gap', x1: lo, x2: hi, y, h: 16 },
      { kind: 'bar', id: 'bar', of: 'a', x, y: 70, w, h: 76, d: v.a.d, fill: at, cls: 'a', tap: 'set' },
      { kind: 'drop', id: 'above', x: lo, y1: 48, y2: y, cls: 'b', over: true },
      { kind: 'drop', id: 'below', x: hi, y1: 48, y2: y, cls: 'b', over: true },
      { kind: 'label', id: 'name-above', x: lo - 5, align: 'end', within: [4, 396], y: 24, size: 22, value: t.above, cls: 'b' },
      { kind: 'label', id: 'name-below', x: hi + 5, align: 'start', within: [4, 396], y: 24, size: 22, value: t.below, cls: 'b' },
      { kind: 'axis', id: 'axis', x, y, w, ticks: [{ id: 'a', d: v.a.d, side: -1, cls: 'a' }], marks: [{ id: 'a', at, side: 1, cls: 'a', value: v.a }] },
    ];
  },
};

const SCENES = { shade, fraction, equivalent, simplest: simplestScene, compare: compareScene, add: addScene, mixed: mixedScene, convert, between: betweenScene };
// every scene offers the measures and the formulas of each of its fractions, beside its own
for (const s of Object.values(SCENES)) {
  s.controls ??= {};
  s.measures = Object.assign({}, ...s.fractions.map(measures), s.measures);
  s.formulas = Object.assign({}, ...s.fractions.map(formulas), s.formulas);
}
export default SCENES;
