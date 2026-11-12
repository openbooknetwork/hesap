// The scenes a page can name. A scene says what turns on the circle, which waves the graph draws, what a page can
// read out and which worked formulas its text can link. Angles are in degrees, and x runs from 0° to 360°.
export const rad = d => d * Math.PI / 180;
export const sin = d => Math.sin(rad(d)), cos = d => Math.cos(rad(d));
// tan has no value where cos is 0, at 90° and 270°.
export const tan = d => Math.abs(cos(d)) < 1e-9 ? null : Math.tan(rad(d));
export const turn = d => ((d % 360) + 360) % 360;

const gcd = (a, b) => b ? gcd(b, a % b) : a;
// piFraction writes a whole angle as a fraction of π when its bottom is 12 or less, so 30° becomes π/6.
export function piFraction(d) {
  if (!Number.isInteger(d) || d <= 0) return null;
  const g = gcd(d, 180), p = d / g, q = 180 / g, top = p === 1 ? '\\pi' : `${p}\\pi`;
  return q > 12 ? null : q === 1 ? top : `\\frac{${top}}{${q}}`;
}

// A measure is an angle (deg) or a plain number (num), with the symbol a readout shows.
const deg = (label, of) => ({ kind: 'deg', label, of }), num = (label, of) => ({ kind: 'num', label, of });
// CONTROLS lists the sliders a scene can take, read out as their symbols.
export const CONTROLS = { amplitude: num('A', v => v.amplitude), frequency: num('k', v => v.frequency), phase: deg('φ', v => v.phase) };
// most is the largest value a slider reaches, so the figure keeps its size while the reader moves it.
const most = (controls, id) => controls[id]?.slider[1] ?? 1;
const square = r => ({ l: r, r, u: r, d: r });

// angles reads the angle in degrees and radians, under the scene's own letter.
const THETA = { x: 'θ', tex: '\\theta' }, X = { x: 'x', tex: 'x' };
const angles = s => ({ angle: deg(s.x, v => v.angle), radians: num(`${s.x} (rad)`, v => rad(v.angle)) });
const radians = s => (v, t) => {
  const a = v.angle, f = piFraction(a);
  return [`${s.tex} = ${t.d(a)}`, `= ${t.n(a, 1)} \\times \\frac{\\pi}{180}`, ...(f ? [`= ${f}`] : []), `${t.rel(rad(a))} ${t.n(rad(a))}`];
};
const pythagoras = (v, t) => {
  const a = v.angle, s2 = sin(a) ** 2, c2 = cos(a) ** 2;
  return [`\\sin^2 ${t.d(a)} + \\cos^2 ${t.d(a)}`, `${t.rel(s2, c2)} ${t.n(s2)} + ${t.n(c2)}`, '= 1'];
};
const trig = { sin: num('sin θ', v => sin(v.angle)), cos: num('cos θ', v => cos(v.angle)) };

// The x nearest to the last one at which an arm turning k times as fast as x points at the angle a. A slow arm does
// not reach every angle in one run of x, and then the point stops at the end nearer to a.
function unturn(k, a, last) {
  const xs = [], gap = b => Math.min(turn(a - b), turn(b - a));
  for (let n = 0; (a + 360 * n) / k <= 360 + 1e-9; n++) xs.push((a + 360 * n) / k);
  if (!xs.length) return gap(0) < gap(360 * k) ? 0 : 360;
  return xs.reduce((b, x) => Math.abs(x - last) < Math.abs(b - last) ? x : b);
}

// arms are the chain on the circle. Each arm is r long, at an angle, and turns about the tip of the one before it.
// waves are what the graph draws against x. A ghost is a faint guide, a part is a wave the sum adds, and a trace is
// the wave the point draws as the angle grows. join names the wave the point's height lands on.
// bars are the heights at the angle x, which the graph draws as the circle draws its legs.
const SCENES = {
  unit: {
    ...THETA, controls: [], annotations: [], rim: true, legs: { across: 'cos', up: 'sin' }, wedge: 'angle',
    box: () => ({ side: square(1), graph: null }),
    arms: v => [{ r: 1, at: v.angle }],
    measures: { ...angles(THETA), ...trig },
    formulas: { radians: radians(THETA), pythagoras },
  },
  sine: {
    ...THETA, controls: [], annotations: [], legs: { up: 'sin' }, wedge: 'angle', join: 'sin',
    box: () => ({ side: square(1), graph: square(1) }),
    arms: v => [{ r: 1, at: v.angle }],
    waves: () => [{ id: 'sin', tone: 'sin', role: 'trace', f: (v, x) => sin(x) }],
    bars: v => [{ ref: 'sin', tone: 'sin', to: sin(v.angle) }],
    measures: { ...angles(THETA), sin: trig.sin },
    formulas: { radians: radians(THETA) },
  },
  cosine: {
    ...THETA, controls: [], annotations: ['quarter'], legs: { across: 'cos', up: 'sin' }, wedge: 'angle', join: 'sin',
    box: () => ({ side: square(1), graph: { l: 0, r: 0, u: 1.4, d: 1 } }),
    arms: v => [{ r: 1, at: v.angle }],
    waves: () => [{ id: 'cos', tone: 'cos', role: 'trace', f: (v, x) => cos(x) }, { id: 'sin', tone: 'sin', role: 'trace', f: (v, x) => sin(x) }],
    bars: v => [{ ref: 'cos', tone: 'cos', to: cos(v.angle) }, { ref: 'sin', tone: 'sin', to: sin(v.angle) }],
    measures: { ...angles(THETA), ...trig },
    formulas: { radians: radians(THETA), pythagoras },
  },
  // In y = A sin(kx) the arm is A long and turns k times as fast as x runs.
  stretch: {
    ...X, controls: ['amplitude', 'frequency'], annotations: ['period'], legs: { up: 'y' }, wedge: 'turn', unit: true, join: 'y',
    box: c => { const a = most(c, 'amplitude'); return { side: square(a), graph: { l: 0, r: 0, u: a + 0.35, d: a } }; },
    arms: v => [{ r: v.amplitude, at: v.frequency * v.angle }],
    waves: () => [{ id: 'base', role: 'ghost', f: (v, x) => sin(x) }, { id: 'y', tone: 'sin', role: 'trace', f: (v, x) => v.amplitude * sin(v.frequency * x) }],
    bars: v => [{ ref: 'y', tone: 'sin', to: v.amplitude * sin(v.frequency * v.angle) }],
    measures: { ...angles(X), turn: deg('kx', v => v.frequency * v.angle), y: num('y', v => v.amplitude * sin(v.frequency * v.angle)), period: deg('T', v => 360 / v.frequency) },
    formulas: {
      y: (v, t) => { const { amplitude: A, frequency: k, angle: x } = v, y = A * sin(k * x);
        return ['y', '= A \\sin(kx)', `= ${t.n(A)} \\sin(${t.n(k)} \\times ${t.d(x)})`, `= ${t.n(A)} \\sin ${t.d(k * x)}`, `${t.rel(y)} ${t.n(y)}`]; },
      period: (v, t) => ['T = \\frac{360^\\circ}{k}', `= \\frac{360^\\circ}{${t.n(v.frequency)}}`, `${t.rel(360 / v.frequency)} ${t.d(360 / v.frequency)}`],
    },
    drag: (v, a) => unturn(v.frequency, a, v.angle),
  },
  // In y = sin(x + φ) the point sets off from φ.
  shift: {
    ...X, controls: ['phase'], annotations: [], legs: { up: 'y' }, wedge: 'turn', start: true, join: 'y',
    box: () => ({ side: square(1), graph: square(1) }),
    arms: v => [{ r: 1, at: v.angle + v.phase }],
    waves: () => [{ id: 'base', role: 'ghost', f: (v, x) => sin(x) }, { id: 'y', tone: 'sin', role: 'trace', f: (v, x) => sin(x + v.phase) }],
    bars: v => [{ ref: 'y', tone: 'sin', to: sin(v.angle + v.phase) }],
    measures: { ...angles(X), turn: deg('x + φ', v => v.angle + v.phase), y: num('y', v => sin(v.angle + v.phase)) },
    formulas: {
      y: (v, t) => { const { angle: x, phase: p } = v, y = sin(x + p);
        return ['y', '= \\sin(x + \\varphi)', `= \\sin(${t.d(x)} ${p < 0 ? '-' : '+'} ${t.d(Math.abs(p))})`, `= \\sin${x + p < 0 ? `(${t.d(x + p)})` : ` ${t.d(x + p)}`}`, `${t.rel(y)} ${t.n(y)}`]; },
    },
    drag: (v, a) => turn(a - v.phase),
  },
  // In y = A sin(kx + φ) the arm is A long, turns k times as fast as x runs and sets off from φ.
  general: {
    ...X, controls: ['amplitude', 'frequency', 'phase'], annotations: [], legs: { up: 'y' }, wedge: 'turn', unit: true, start: true, join: 'y',
    box: c => { const a = most(c, 'amplitude'); return { side: square(a), graph: square(a) }; },
    arms: v => [{ r: v.amplitude, at: v.frequency * v.angle + v.phase }],
    waves: () => [{ id: 'y', tone: 'sin', role: 'trace', f: (v, x) => v.amplitude * sin(v.frequency * x + v.phase) }],
    bars: v => [{ ref: 'y', tone: 'sin', to: v.amplitude * sin(v.frequency * v.angle + v.phase) }],
    measures: { ...angles(X), turn: deg('kx + φ', v => v.frequency * v.angle + v.phase), y: num('y', v => v.amplitude * sin(v.frequency * v.angle + v.phase)) },
    formulas: {},
    drag: (v, a) => unturn(v.frequency, turn(a - v.phase), v.angle),
  },
  // In y = sin x + A sin(kx) a second arm rides on the tip of the first and turns k times as fast.
  sum: {
    ...X, controls: ['amplitude', 'frequency'], annotations: [], wedge: 'angle', join: 'y',
    box: c => { const r = 1 + most(c, 'amplitude'); return { side: square(r), graph: square(r) }; },
    arms: v => [{ r: 1, at: v.angle, tone: 'sin', ref: 'first' }, { r: v.amplitude, at: v.frequency * v.angle, tone: 'cos', ref: 'second' }],
    waves: () => [{ id: 'first', tone: 'sin', role: 'part', f: (v, x) => sin(x) }, { id: 'second', tone: 'cos', role: 'part', f: (v, x) => v.amplitude * sin(v.frequency * x) },
      { id: 'y', tone: 'sum', role: 'trace', f: (v, x) => sin(x) + v.amplitude * sin(v.frequency * x) }],
    bars: v => { const a = sin(v.angle), b = v.amplitude * sin(v.frequency * v.angle); return [{ ref: 'first', tone: 'sin', to: a }, { ref: 'second', tone: 'cos', from: a, to: a + b }]; },
    measures: { ...angles(X), first: num('sin x', v => sin(v.angle)), second: num('A sin(kx)', v => v.amplitude * sin(v.frequency * v.angle)),
      y: num('y', v => sin(v.angle) + v.amplitude * sin(v.frequency * v.angle)) },
    formulas: {
      y: (v, t) => { const { amplitude: A, frequency: k, angle: x } = v, a = sin(x), b = sin(k * x), y = a + A * b;
        return ['y', '= \\sin x + A \\sin(kx)', `= \\sin ${t.d(x)} + ${t.n(A)} \\sin(${t.n(k)} \\times ${t.d(x)})`, `${t.rel(a, b)} ${t.n(a)} + ${t.n(A)} \\times ${t.p(b)}`, `${t.rel(y)} ${t.n(y)}`]; },
    },
  },
  // The radius, drawn on to the line that touches the circle at its right, meets that line at height tan θ.
  tangent: {
    ...THETA, controls: [], annotations: [], legs: { across: 'cos', up: 'sin' }, wedge: 'angle', tangent: 2.5, join: 'tan', asymptotes: [90, 270],
    box: () => ({ side: { l: 1, r: 1.35, u: 2.5, d: 2.5 }, graph: square(2.5) }),
    arms: v => [{ r: 1, at: v.angle }],
    waves: () => [{ id: 'tan', tone: 'tan', role: 'trace', f: (v, x) => tan(x) }],
    bars: v => [{ ref: 'tan', tone: 'tan', to: tan(v.angle) }],
    measures: { ...angles(THETA), ...trig, tan: num('tan θ', v => tan(v.angle)) },
    formulas: {
      tan: (v, t) => { const a = v.angle, s = sin(a), c = cos(a), q = tan(a);
        return [`\\tan ${t.d(a)}`, `= \\frac{\\sin ${t.d(a)}}{\\cos ${t.d(a)}}`, `${t.rel(s, c)} \\frac{${t.n(s)}}{${t.n(c)}}`, ...(q === null ? [] : [`${t.rel(q)} ${t.n(q)}`])]; },
    },
  },
  // A weight on a spring hangs beside the circle at the height of the point.
  spring: {
    ...THETA, controls: [], annotations: [], legs: { up: 'sin' }, wedge: 'angle', spring: 1.6, join: 'sin',
    box: () => ({ side: { l: 1, r: 1.95, u: 2, d: 1.1 }, graph: { l: 0, r: 0, u: 1.1, d: 1.1 } }),
    arms: v => [{ r: 1, at: v.angle }],
    waves: () => [{ id: 'sin', tone: 'sin', role: 'trace', f: (v, x) => sin(x) }],
    bars: v => [{ ref: 'sin', tone: 'sin', to: sin(v.angle) }],
    measures: { ...angles(THETA), sin: num('sin θ', v => sin(v.angle)) },
    formulas: {},
  },
};
for (const s of Object.values(SCENES)) s.drag ??= (v, a) => a;
export default SCENES;

// A page can read out or link the scene's measures and its sliders.
export const measureOf = (scene, id) => scene.measures[id] ?? (scene.controls.includes(id) ? CONTROLS[id] : null);
