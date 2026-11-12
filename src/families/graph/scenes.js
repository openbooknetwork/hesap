// A page names one of these scenes in hesap.scene. Node reads them to check a page, and the browser draws them. A
// scene lists the sliders a page must give it, what it can annotate, its measures and formulas, and draws itself.
// Measures take the values v, the rule R with its coefficients filled in and the page's spec. A formula takes a
// writer w before the spec and gives its steps, which format.js writes in TeX and in plain text.
import { curve, dot, line, region, segment, under } from './plot.js';
import { left } from './rules.js';

const ahead = (v, R) => R.y(v.x);

// A scene's draw gets ctx from the client, which holds: boards (one per view, sharing x), views (their ranges), v() the
// values, f() the rule as drawn (part way between two rules while the curve morphs), R() the rule itself, c the
// colours, fmt and pair to write numbers, has(annotation), spec, word(id) for a word on the figure, and the calls
// handle, label, mark, watch and settle.
const dashed = c => ({ strokeColor: c.ink2, strokeWidth: 1.5, dash: 2 });
const quiet = c => ({ size: 3.5, fillColor: c.ink2, strokeColor: c.ink2 });
// guide draws a dashed line up and down through x across a view, which ties the two views together
const guide = (ctx, i) => segment(ctx.boards[i], () => [ctx.v().x, ctx.views[i].y[0]], () => [ctx.v().x, ctx.views[i].y[1]], dashed(ctx.c));
// away puts a label beside a point on a curve, on the side away from the curve's climb
const away = slope => slope() > 0 ? 'nw' : 'ne';

// plot draws a picture of a rule. It shows the curve, and the point at x with dashed lines to the two axes where x
// and y are read. A page without x shows the curve alone.
const plot = {
  controls: { x: 'slider' },
  optional: { x: ['x', 'y', 'formula-y'] }, // a page may leave out this control and the links that need it
  annotations: ['guides', 'start', 'vertex'],
  measures: { x: v => v.x, y: ahead, vertex: (v, R) => R.vertex() },
  formulas: { y: (v, R, w) => { const y = R.y(v.x); return ['y', `= ${R.write('x', w)}`, `= ${R.write(w.x(v.x), w)}`, `${w.rel(y)} ${w.n(y)}`]; } },
  draw(ctx) {
    const { boards: [b], v, f, R, c, fmt, has, spec } = ctx, P = () => [v().x, f().y(v().x)];
    if (has('start')) curve(b, ctx.first.y, dashed(c)); // the dashed curve stays where the page opened
    curve(b, x => f().y(x), { strokeColor: c.ink, strokeWidth: 3 });
    if (has('vertex')) {
      const V = () => R().vertex() ?? [NaN, NaN];
      ctx.mark('vertex', dot(b, V, { ...quiet(c), size: 5, visible: () => !!R().vertex() }), { size: 8 });
      ctx.label({ at: V, say: () => ctx.word('vertex'), side: () => R().k.a > 0 ? 'sw' : 'nw', ref: 'vertex', visible: () => !!R().vertex() });
    }
    if (!spec.controls.x) return;
    if (has('guides')) {
      segment(b, () => [P()[0], 0], P, dashed(c)); segment(b, () => [0, P()[1]], P, dashed(c));
      ctx.mark('x', dot(b, () => [P()[0], 0], quiet(c)), { size: 6 }); ctx.mark('y', dot(b, () => [0, P()[1]], quiet(c)), { size: 6 });
    }
    ctx.handle({ at: P, drag: ([x]) => ({ x }), ref: 'x' });
    ctx.label({ at: P, say: () => ctx.pair(v().x, R().y(v().x)), side: () => away(() => f().slope(v().x)) });
  },
};

// secant shows the slope between two points P and Q: the run across, the rise up, and the line through both.
const secant = {
  controls: { p: 'slider', q: 'slider' },
  annotations: [],
  measures: { run: v => v.q - v.p, rise: (v, R) => R.y(v.q) - R.y(v.p), slope: (v, R) => v.q === v.p ? null : (R.y(v.q) - R.y(v.p)) / (v.q - v.p) },
  formulas: { slope: (v, R, w) => {
    const run = v.q - v.p, rise = R.y(v.q) - R.y(v.p);
    return [w.word('slope'), `= ${w.frac(w.word('rise'), w.word('run'))}`, `= ${w.frac(w.n(rise), w.n(run))}`, run ? `${w.rel(rise / run)} ${w.n(rise / run)}` : `= ${w.word('no value')}`];
  } },
  draw(ctx) {
    const { boards: [b], v, f, c, fmt } = ctx, P = () => [v().p, f().y(v().p)], Q = () => [v().q, f().y(v().q)], corner = () => [Q()[0], P()[1]];
    const rise = () => Q()[1] - P()[1], run = () => Q()[0] - P()[0];
    curve(b, x => f().y(x), { strokeColor: c.ink, strokeWidth: 3 });
    ctx.mark('slope', line(b, P, () => rise() / run(), { strokeColor: c.accent, strokeWidth: 2.5, visible: () => run() !== 0 }), { strokeWidth: 5 });
    ctx.mark('run', segment(b, P, corner, { strokeColor: c.ink2, strokeWidth: 2.5 }), { strokeWidth: 5 });
    ctx.mark('rise', segment(b, corner, Q, { strokeColor: c.ink2, strokeWidth: 2.5 }), { strokeWidth: 5 });
    const mid = (a, z) => () => [(a()[0] + z()[0]) / 2, (a()[1] + z()[1]) / 2];
    ctx.label({ at: mid(P, corner), say: () => `${ctx.word('run')} ${fmt(run())}`, side: () => rise() >= 0 ? 's' : 'n', ref: 'run', visible: () => run() !== 0 });
    ctx.label({ at: mid(corner, Q), say: () => `${ctx.word('rise')} ${fmt(rise())}`, side: () => run() >= 0 ? 'e' : 'w', ref: 'rise', visible: () => rise() !== 0 });
    ctx.handle({ at: P, drag: ([x]) => ({ p: x }), ref: 'p' });
    ctx.handle({ at: Q, drag: ([x]) => ({ q: x }), ref: 'q' });
    ctx.label({ at: P, say: () => 'P', side: () => run() >= 0 ? 'nw' : 'ne' });
    ctx.label({ at: Q, say: () => 'Q', side: () => run() >= 0 ? 'nw' : 'ne' });
  },
};

// tangent draws the line that runs the way the curve runs at P. A secant to Q, a gap h further on, closes in on it.
const tangent = {
  controls: { x: 'slider', h: 'slider' },
  optional: { h: ['h', 'secant'] }, // without h the page shows the tangent alone
  annotations: ['step'],
  measures: { x: v => v.x, y: ahead, h: v => v.h, secant: (v, R) => v.h ? (R.y(v.x + v.h) - R.y(v.x)) / v.h : null, slope: (v, R) => R.slope(v.x) },
  formulas: {},
  draw(ctx) {
    const { boards: [b], v, f, c, fmt, has, spec } = ctx, P = () => [v().x, f().y(v().x)], Q = () => [v().x + v().h, f().y(v().x + v().h)];
    const slope = () => f().slope(v().x), gap = !!spec.controls.h;
    curve(b, x => f().y(x), { strokeColor: c.ink, strokeWidth: 3 });
    if (gap) ctx.mark('secant', line(b, P, () => (Q()[1] - P()[1]) / v().h, { ...dashed(c), strokeWidth: 2, visible: () => v().h !== 0 }), { strokeWidth: 4 });
    ctx.mark('slope', line(b, P, slope, { strokeColor: c.accent, strokeWidth: 2.5 }), { strokeWidth: 5 });
    if (has('step')) {
      // one step to the right along the tangent climbs by the slope
      const across = () => [P()[0] + 1, P()[1]], up = () => [P()[0] + 1, P()[1] + slope()];
      segment(b, P, across, { strokeColor: c.ink2, strokeWidth: 2 });
      ctx.mark('slope', segment(b, across, up, { strokeColor: c.accent, strokeWidth: 3 }), { strokeWidth: 5 });
      ctx.label({ at: () => [P()[0] + 0.5, P()[1]], say: () => '1', side: () => slope() >= 0 ? 's' : 'n' });
      ctx.label({ at: () => [P()[0] + 1, P()[1] + slope() / 2], say: () => fmt(slope()), side: 'e', ref: 'slope' });
    }
    ctx.handle({ at: P, drag: ([x]) => ({ x }), ref: 'x' });
    ctx.label({ at: P, say: () => 'P', side: () => away(slope) });
    if (!gap) return;
    ctx.handle({ at: Q, drag: ([x]) => ({ h: x - v().x }), ref: 'h' });
    ctx.label({ at: Q, say: () => 'Q', side: () => away(slope), visible: () => Math.abs(v().h) > 0.25 });
  },
};

// slope draws the curve over its slope curve, which plots the slope at each x as a height as the reader moves x.
const slope = {
  views: 2, below: 'slope',
  controls: { x: 'slider' },
  annotations: ['tangent', 'whole'],
  measures: { x: v => v.x, y: ahead, slope: (v, R) => R.slope(v.x) },
  formulas: {},
  draw(ctx) {
    const { boards: [top, low], views, v, f, c, fmt, has } = ctx, P = () => [v().x, f().y(v().x)], S = () => [v().x, f().slope(v().x)];
    guide(ctx, 0); guide(ctx, 1);
    curve(top, x => f().y(x), { strokeColor: c.ink, strokeWidth: 3 });
    if (has('tangent')) ctx.mark('slope', line(top, P, () => f().slope(v().x), { strokeColor: c.accent, strokeWidth: 2.5 }), { strokeWidth: 5 });
    if (has('whole')) curve(low, x => f().slope(x), dashed(c));
    ctx.mark('slope', curve(low, x => f().slope(x), { strokeColor: c.accent, strokeWidth: 3 }, () => views[1].x[0], () => v().x), { strokeWidth: 5 });
    ctx.handle({ at: P, drag: ([x]) => ({ x }), ref: 'x' });
    ctx.handle({ view: 1, at: S, drag: ([x]) => ({ x }), ref: 'slope' });
    ctx.label({ at: P, say: () => 'P', side: () => away(() => f().slope(v().x)) });
    ctx.label({ view: 1, at: S, say: () => `${ctx.word('slope')} ${fmt(f().slope(v().x))}`, side: () => S()[1] > (views[1].y[0] + views[1].y[1]) / 2 ? 'se' : 'ne', ref: 'slope' });
  },
};

// area estimates the area under the curve from the page's from to its to with n rectangles, each as tall as the
// curve at its left edge.
const area = {
  needs: ['from', 'to'],
  controls: { n: 'slider' },
  annotations: [],
  measures: { n: v => v.n, width: (v, R, s) => (s.to - s.from) / v.n, sum: (v, R, s) => left(R, s.from, s.to, v.n),
    area: (v, R, s) => R.area(s.from, s.to), difference: (v, R, s) => R.area(s.from, s.to) - left(R, s.from, s.to, v.n) },
  formulas: {},
  draw(ctx) {
    const { boards: [b], v, f, c, spec: s } = ctx, most = s.controls.n.slider[1];
    // A rectangle's height eases from where it starts to the curve's, as s goes from 0 to 1. More rectangles split
    // the old ones: each new one starts at the height of the old one it came from.
    const rect = Array.from({ length: most }, () => ({ from: 0, s: 1 })), shown = { n: v().n };
    const width = n => (s.to - s.from) / n, edge = (i, n) => s.from + i * width(n);
    const height = (i, n = shown.n) => rect[i].from + (f().y(edge(i, n)) - rect[i].from) * rect[i].s;
    ctx.mark('area', region(b, () => under(x => f().y(x), s.from, s.to), { strokeWidth: 0, fillColor: c.ink2, fillOpacity: 0.18 }), { fillOpacity: 0.4 });
    for (let i = 0; i < most; i++) ctx.mark('sum', region(b, () => {
      if (i >= shown.n) return [[], []];
      const x = edge(i, shown.n), h = height(i), w = width(shown.n);
      return [[x, x, x + w, x + w, x], [0, h, h, 0, 0]];
    }, { strokeColor: c.accent, strokeWidth: 1.5, fillColor: c.accent, fillOpacity: 0.3 }), { fillOpacity: 0.55 });
    curve(b, x => f().y(x), { strokeColor: c.ink, strokeWidth: 3 });
    for (const x of [s.from, s.to]) segment(b, () => [x, 0], () => [x, f().y(x)], dashed(c));
    ctx.watch(() => {
      if (v().n === shown.n) return;
      const was = shown.n, old = rect.slice(0, was).map((_, i) => height(i, was)), n = shown.n = v().n;
      for (let i = 0; i < n; i++) rect[i] = { from: old[Math.min(was - 1, Math.floor((i + 0.5) * was / n))], s: 0 };
      ctx.settle(rect.slice(0, n));
    });
  },
};

// accumulate shades the area from the page's from up to x, and plots it below as x moves. The slope of the area
// curve is the height of the curve above it.
const accumulate = {
  views: 2, below: 'area', needs: ['from'],
  controls: { x: 'slider' },
  annotations: ['tangent', 'whole'],
  measures: { x: v => v.x, height: ahead, area: (v, R, s) => R.area(s.from, v.x), slope: ahead },
  formulas: {},
  draw(ctx) {
    const { boards: [top, low], v, f, c, fmt, has, spec: s } = ctx, P = () => [v().x, f().y(v().x)], A = () => [v().x, f().area(s.from, v().x)];
    guide(ctx, 0); guide(ctx, 1);
    // the area above the axis counts up and the area below it counts down, so they are shaded apart
    ctx.mark('area', region(top, () => under(x => f().y(x), s.from, v().x, 1), { strokeWidth: 0, fillColor: c.accent, fillOpacity: 0.3 }), { fillOpacity: 0.55 });
    ctx.mark('area', region(top, () => under(x => f().y(x), s.from, v().x, -1), { strokeWidth: 0, fillColor: c.ink2, fillOpacity: 0.3 }), { fillOpacity: 0.55 });
    curve(top, x => f().y(x), { strokeColor: c.ink, strokeWidth: 3 });
    ctx.mark('height', segment(top, () => [v().x, 0], P, { strokeColor: c.accent, strokeWidth: 3 }), { strokeWidth: 6 });
    if (has('whole')) curve(low, x => f().area(s.from, x), dashed(c));
    ctx.mark('area', curve(low, x => f().area(s.from, x), { strokeColor: c.accent, strokeWidth: 3 }, () => s.from, () => v().x), { strokeWidth: 5 });
    if (has('tangent')) ctx.mark('slope', line(low, A, () => f().y(v().x), { strokeColor: c.ink, strokeWidth: 2 }), { strokeWidth: 4 });
    ctx.handle({ at: P, drag: ([x]) => ({ x }), ref: 'x' });
    ctx.handle({ view: 1, at: A, drag: ([x]) => ({ x }), ref: 'area' });
    ctx.label({ at: () => [v().x, f().y(v().x) / 2], say: () => `${ctx.word('height')} ${fmt(f().y(v().x))}`, side: 'e', ref: 'height', visible: () => Math.abs(f().y(v().x)) > 0.05 });
    ctx.label({ view: 1, at: A, say: () => `${ctx.word('slope')} ${fmt(f().y(v().x))}`, side: () => f().y(v().x) > 0 ? 'nw' : 'sw', ref: 'slope' });
  },
};

export default { plot, secant, tangent, slope, area, accumulate };
