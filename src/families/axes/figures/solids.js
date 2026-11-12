// The solids: a box, a prism and a pyramid on a regular base, a cylinder, a cone, a sphere, and a cube that unfolds
// into its net. Each is centred on the origin and sized by the page's sliders.
import { follower } from './plane.js';
import { round, stage, steps } from './solid.js';

const PI = Math.PI, GENERATORS = 12, SIDES = 8; // lines drawn down a curved wall, and the most sides a base has

// ---------- a box, and a cube as the box with one edge length ----------
function box(edges, formulas) {
  const size = v => edges.length === 1 ? [v.a, v.a, v.a] : [v.a, v.b, v.c];
  const volume = v => size(v).reduce((p, n) => p * n), surface = v => { const [a, b, c] = size(v); return 2 * (a * b + b * c + c * a); };
  function draw(ctx) {
    const { values, fmt } = ctx, s = stage(ctx), half = () => size(values()).map(n => n / 2);
    const at = (i, j, k) => () => { const [a, b, c] = half(); return [i * a, j * b, k * c]; }, P = (i, j, k) => s.corner(at(i, j, k));
    for (const k of [-1, 1]) s.face([P(-1, -1, k), P(1, -1, k), P(1, 1, k), P(-1, 1, k)]);
    for (const j of [-1, 1]) s.face([P(-1, j, -1), P(1, j, -1), P(1, j, 1), P(-1, j, 1)]);
    for (const i of [-1, 1]) s.face([P(i, -1, -1), P(i, 1, -1), P(i, 1, 1), P(i, -1, 1)]);
    const say = (name, k) => () => `${name} = ${fmt(size(values())[k])}`;
    // a runs along x, b along y and c up z
    s.mark('a', at(-1, 1, -1), at(1, 1, -1), say('a', 0), [0.7, -0.5]);
    if (edges.length > 1) { s.mark('b', at(1, -1, -1), at(1, 1, -1), say('b', 1), [-0.6, -0.6]); s.mark('c', at(1, 1, -1), at(1, 1, 1), say('c', 2), [0.8, 0]); }
  }
  return { controls: Object.fromEntries(edges.map(e => [e, 'slider'])), annotations: [], measures: { volume, surface }, formulas: formulas(volume, surface), draw };
}
export const cube = box(['a'], (volume, surface) => ({
  volume: (v, m) => steps('V', 'a^3', `${m.n(v.a)}^3`, volume(v), m),
  surface: (v, m) => steps('S', '6a^2', `6 \\times ${m.n(v.a)}^2`, surface(v), m),
}));
export const cuboid = box(['a', 'b', 'c'], (volume, surface) => ({
  volume: (v, m) => steps('V', 'abc', `${m.n(v.a)} \\times ${m.n(v.b)} \\times ${m.n(v.c)}`, volume(v), m),
  surface: (v, m) => steps('S', '2(ab + bc + ca)', `2(${m.n(v.a * v.b)} + ${m.n(v.b * v.c)} + ${m.n(v.c * v.a)})`, surface(v), m),
}));

// ---------- a prism and a pyramid on a regular base with n sides of length a ----------
const base = v => v.n * v.a ** 2 / (4 * Math.tan(PI / v.n)), reach = v => v.a / (2 * Math.sin(PI / v.n));
// The base always has SIDES corners. With fewer sides the spare corners stand on the first one, where they add nothing.
const ring = (s, values, z) => Array.from({ length: SIDES }, (_, k) => s.corner(() => { const v = values(); return round(reach(v), (k < v.n ? k : 0) / v.n, z(v)); }));
function onBase(pointed) {
  const volume = v => base(v) * v.h / (pointed ? 3 : 1);
  function draw(ctx) {
    const { values, fmt } = ctx, s = stage(ctx), low = ring(s, values, v => -v.h / 2), next = k => (k + 1) % SIDES;
    s.face(low);
    if (pointed) {
      const tip = s.corner(() => [0, 0, values().h / 2]);
      low.forEach((p, k) => s.face([p, low[next(k)], tip]));
      s.mark('h', () => [0, 0, -values().h / 2], () => [0, 0, values().h / 2], () => `h = ${fmt(values().h)}`, [0.7, 0], { dash: 2, strokeWidth: 3 });
    } else {
      const high = ring(s, values, v => v.h / 2);
      s.face(high); low.forEach((p, k) => s.face([p, low[next(k)], high[next(k)], high[k]]));
      s.mark('h', () => round(reach(values()), 0, -values().h / 2), () => round(reach(values()), 0, values().h / 2), () => `h = ${fmt(values().h)}`, [-0.8, 0]);
    }
    s.mark('a', () => round(reach(values()), 0, -values().h / 2), () => round(reach(values()), 1 / values().n, -values().h / 2), () => `a = ${fmt(values().a)}`, [0.3, -0.7]);
  }
  const third = pointed ? '\\tfrac{1}{3} ' : '';
  return { controls: { n: 'slider', a: 'slider', h: 'slider' }, annotations: [], measures: { base, volume },
    formulas: { volume: (v, m) => steps('V', `${third}Bh`, `${third && `${third}\\times `}${m.n(base(v))} \\times ${m.n(v.h)}`, volume(v), m) }, draw };
}
export const prism = onBase(false), pyramid = onBase(true);

// ---------- a cylinder and a cone ----------
function onCircle(pointed) {
  const volume = v => PI * v.radius ** 2 * v.h / (pointed ? 3 : 1), slant = v => Math.hypot(v.radius, v.h);
  const surface = v => pointed ? PI * v.radius ** 2 + PI * v.radius * slant(v) : 2 * PI * v.radius ** 2 + 2 * PI * v.radius * v.h;
  function draw(ctx) {
    const { values: v, fmt } = ctx, s = stage(ctx), low = () => -v().h / 2, high = () => v().h / 2, tip = s.corner(() => [0, 0, high()]);
    s.curve(t => round(v().radius, t, low()));
    if (!pointed) s.curve(t => round(v().radius, t, high()));
    for (let k = 0; k < GENERATORS; k++) s.line(s.corner(() => round(v().radius, k / GENERATORS, low())), pointed ? tip : s.corner(() => round(v().radius, k / GENERATORS, high())), s.faint);
    s.mark('radius', () => [0, 0, low()], () => round(v().radius, 0.125, low()), () => `r = ${fmt(v().radius)}`, [0.2, -0.6]);
    s.mark('h', () => [0, 0, low()], () => [0, 0, high()], () => `h = ${fmt(v().h)}`, [0.7, 0.2], { dash: 2, strokeWidth: 3 });
  }
  const third = pointed ? '\\tfrac{1}{3} ' : '';
  const formulas = { volume: (v, m) => steps('V', `${third}\\pi r^2 h`, `${third}\\pi \\times ${m.n(v.radius)}^2 \\times ${m.n(v.h)}`, volume(v), m) };
  if (!pointed) formulas.surface = (v, m) => steps('S', '2 \\pi r^2 + 2 \\pi r h', `2 \\pi \\times ${m.n(v.radius)}^2 + 2 \\pi \\times ${m.n(v.radius)} \\times ${m.n(v.h)}`, surface(v), m);
  return { controls: { radius: 'slider', h: 'slider' }, annotations: [], measures: { volume, surface, slant }, formulas, draw };
}
export const cylinder = onCircle(false), cone = onCircle(true);

// ---------- a sphere ----------
const ballVolume = v => 4 / 3 * PI * v.radius ** 3, ballSurface = v => 4 * PI * v.radius ** 2;
export const sphere = {
  controls: { radius: 'slider' }, annotations: [], measures: { volume: ballVolume, surface: ballSurface },
  formulas: {
    volume: (v, m) => steps('V', '\\tfrac{4}{3} \\pi r^3', `\\tfrac{4}{3} \\pi \\times ${m.n(v.radius)}^3`, ballVolume(v), m),
    surface: (v, m) => steps('S', '4 \\pi r^2', `4 \\pi \\times ${m.n(v.radius)}^2`, ballSurface(v), m),
  },
  draw(ctx) {
    const { board, values: v, colors, fmt } = ctx, s = stage(ctx);
    s.curve(t => round(v().radius, t, 0));
    // circles through the poles, and two circles of latitude
    for (const turn of [0, PI / 2]) s.curve(t => { const across = v().radius * Math.cos(2 * PI * t); return [across * Math.cos(turn), across * Math.sin(turn), v().radius * Math.sin(2 * PI * t)]; }, s.faint);
    for (const up of [-0.6, 0.6]) s.curve(t => round(v().radius * Math.sqrt(1 - up * up), t, v().radius * up), s.faint);
    // The outline: a circle on the page. A circle in space is drawn as an oval whose long half is its true radius,
    // so the widest reach of the equator gives the outline's size for any view.
    const centre = () => s.flat([0, 0, 0]), wide = () => { const c = centre(); let most = 0; for (let k = 0; k < 72; k++) { const p = s.flat(round(v().radius, k / 72, 0)); most = Math.max(most, Math.hypot(p[0] - c[0], p[1] - c[1])); } return most; };
    board.create('circle', [follower(board, centre), wide], { fixed: true, highlight: false, strokeColor: colors.ink, strokeWidth: 2, fillColor: colors.accent, fillOpacity: 0.1 });
    s.mark('radius', () => [0, 0, 0], () => round(v().radius, 0.125, 0), () => `r = ${fmt(v().radius)}`, [0.2, -0.6]);
  },
};

// ---------- a cube that unfolds ----------
// fold runs from 0, the flat net, to 100, the closed cube. Each wall turns up about its edge of the floor, and the
// lid turns about the top edge of one wall.
export const net = {
  controls: { a: 'slider', fold: 'slider' }, annotations: [], measures: { surface: v => 6 * v.a ** 2, face: v => v.a ** 2 },
  formulas: { surface: (v, m) => steps('S', '6a^2', `6 \\times ${m.n(v.a)}^2`, 6 * v.a ** 2, m) },
  draw(ctx) {
    const { values: v, fmt } = ctx, s = stage(ctx), turn = () => v().fold / 100 * PI / 2, h = () => v().a / 2;
    // the flat net is longest along x, so it slides back to stay in the middle of the view
    const P = f => s.corner(() => { const [x, y, z] = f(v().a, turn()); return [x - h() * (1 - v().fold / 100), y, z - h()]; });
    const quad = fs => s.face(fs.map(P));
    quad([-1, 1].flatMap(j => (j < 0 ? [-1, 1] : [1, -1]).map(i => a => [i * a / 2, j * a / 2, 0])));
    // a wall on the side (i, j) of the floor: its lower edge is the hinge, its upper edge swings up
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const hinge = e => a => [i * a / 2 + (i ? 0 : e * a / 2), j * a / 2 + (j ? 0 : e * a / 2), 0];
      const far = e => (a, t) => { const [x, y] = hinge(e)(a); return [x + i * a * Math.cos(t), y + j * a * Math.cos(t), a * Math.sin(t)]; };
      quad([hinge(-1), hinge(1), far(1), far(-1)]);
    }
    // the lid hangs on the wall at +x and turns as far again
    const edge = e => (a, t) => [a / 2 + a * Math.cos(t), e * a / 2, a * Math.sin(t)];
    const lid = e => (a, t) => { const [x, y, z] = edge(e)(a, t); return [x + a * Math.cos(2 * t), y, z + a * Math.sin(2 * t)]; };
    quad([edge(-1), edge(1), lid(1), lid(-1)]);
    s.mark('a', () => [h() - h() * (1 - v().fold / 100), -h(), -h()], () => [h() - h() * (1 - v().fold / 100), h(), -h()], () => `a = ${fmt(v().a)}`, [-0.5, -0.6]);
  },
};
