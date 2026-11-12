// A scene is a kind of transformation a page shows. Each lists its values with their defaults, the handles that set
// them, and the measures and formulas a page can name.
import { I, turn, mirror, product } from './matrices.js';

// A map is a matrix m and then a shift by o. about keeps the point c where it is.
const ZERO = { x: 0, y: 0 };
const about = (m, c) => ({ m, o: { x: c.x - m[0] * c.x - m[1] * c.y, y: c.y - m[2] * c.x - m[3] * c.y } });
export const run = ({ m, o }, p) => ({ x: m[0] * p.x + m[1] * p.y + o.x, y: m[2] * p.x + m[3] * p.y + o.y });
const POINT = ['P', 'image'];
// a centre on the shape's corner would leave that corner nowhere to turn or stretch
const apart = (v, { P }) => Math.hypot(v.cx - P.x, v.cy - P.y) >= 0.5;
// a scale factor of 0 puts P′ under the centre's knob, where the reader could not take hold of it again
const open = (v, ctx) => apart(v, ctx) && v.k !== 0;

export const SCENES = {
  slide: { values: { tx: 0, ty: 0 }, handles: ['vector'], map: v => ({ m: I, o: { x: v.tx, y: v.ty } }),
    measures: ['vector', 'tx', 'ty', ...POINT], formulas: ['image'] },
  turn: { values: { angle: 0, cx: 0, cy: 0 }, handles: ['angle', 'centre'], fits: apart,
    map: v => about(turn(v.angle), { x: v.cx, y: v.cy }), measures: ['angle', 'centre', ...POINT], formulas: [] },
  mirror: { values: { tilt: 90 }, handles: ['tilt'], map: v => ({ m: mirror(v.tilt), o: ZERO }), measures: ['tilt', ...POINT], formulas: [] },
  stretch: { values: { k: 1, cx: 0, cy: 0 }, handles: ['factor', 'centre'], fits: open,
    map: v => about([v.k, 0, 0, v.k], { x: v.cx, y: v.cy }), measures: ['k', 'area-scale', 'centre', ...POINT], formulas: ['image'] },
  matrix: { values: { a: 1, b: 0, c: 0, d: 1 }, handles: ['i', 'j'], map: v => ({ m: [v.a, v.b, v.c, v.d], o: ZERO }),
    measures: ['matrix', 'a', 'b', 'c', 'd', 'i', 'j', 'det', 'area', ...POINT], formulas: ['matrix', 'det', 'image'] },
};

const deg = (p, c = ZERO) => Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI;
const centre = v => ({ x: v.cx, y: v.cy });
// A handle is a knob in the figure. at is where it sits, put the values it sets when the reader moves it to a point,
// nudge the values an arrow key sets, and steps the step each value snaps to. The context holds P, the shape's
// corner, and view, half the width of the figure. A mirror line has a knob at each end.
export const HANDLES = {
  vector: { at: (v, { P }) => ({ x: P.x + v.tx, y: P.y + v.ty }), put: (p, v, { P }) => ({ tx: p.x - P.x, ty: p.y - P.y }),
    nudge: (v, x, y) => ({ tx: v.tx + x, ty: v.ty + y }), steps: { tx: 1, ty: 1 } },
  centre: { at: centre, put: p => ({ cx: p.x, cy: p.y }), nudge: (v, x, y) => ({ cx: v.cx + x, cy: v.cy + y }), steps: { cx: 1, cy: 1 } },
  angle: { at: (v, { P }) => run(SCENES.turn.map(v), P), put: (p, v, { P }) => ({ angle: deg(p, centre(v)) - deg(P, centre(v)) }),
    nudge: (v, x, y) => ({ angle: v.angle + 15 * (x + y) }), steps: { angle: 15 } },
  tilt: { ends: [1, -1], at: (v, { view }, end = 1) => ({ x: end * (view - 0.8) * Math.cos(v.tilt * Math.PI / 180), y: end * (view - 0.8) * Math.sin(v.tilt * Math.PI / 180) }),
    put: p => ({ tilt: deg(p) }), nudge: (v, x, y) => ({ tilt: v.tilt + 15 * (x + y) }), steps: { tilt: 15 } },
  factor: { at: (v, { P }) => run(SCENES.stretch.map(v), P),
    put: (p, v, { P }) => { const u = { x: P.x - v.cx, y: P.y - v.cy }; return { k: ((p.x - v.cx) * u.x + (p.y - v.cy) * u.y) / (u.x ** 2 + u.y ** 2) }; },
    nudge: (v, x, y) => ({ k: v.k + 0.5 * (x + y) }), steps: { k: 0.5 } },
  i: { at: v => ({ x: v.a, y: v.c }), put: p => ({ a: p.x, c: p.y }), nudge: (v, x, y) => ({ a: v.a + x / 2, c: v.c + y / 2 }), steps: { a: 0.5, c: 0.5 } },
  j: { at: v => ({ x: v.b, y: v.d }), put: p => ({ b: p.x, d: p.y }), nudge: (v, x, y) => ({ b: v.b + x / 2, d: v.d + y / 2 }), steps: { b: 0.5, d: 0.5 } },
};

// A turn wraps round, a mirror line too after half a turn, and a scale factor stops at its ends.
export const WRAP = { angle: 360, tilt: 180 };
const RANGE = { k: [-2, 3] };
const tidy = x => Math.round(x * 1e6) / 1e6 + 0;
export function keep(key, x) {
  if (key === 'angle') { const r = ((x % 360) + 360) % 360; return tidy(r > 180 ? r - 360 : r); }
  if (key === 'tilt') return tidy(((x % 180) + 180) % 180);
  return tidy(RANGE[key] ? Math.min(Math.max(x, RANGE[key][0]), RANGE[key][1]) : x);
}
// Every value of a scene snaps to the step its handle gives it.
export const steps = scene => Object.assign({}, ...SCENES[scene].handles.map(h => HANDLES[h].steps));
export const snap = (v, step) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keep(k, step[k] ? Math.round(x / step[k]) * step[k] : x)]));

// A page holds its corner P and half the width of its figure.
export const context = spec => ({ P: { x: spec.at[0], y: spec.at[1] }, view: spec.view });
// These are the values a page opens with. A page with named matrices comes to rest on their product.
export function starts(spec) {
  const v = { ...SCENES[spec.scene].values, ...spec.start };
  if (spec.matrix) [[v.a, v.b], [v.c, v.d]] = spec.matrix;
  if (spec.named?.length) [v.a, v.b, v.c, v.d] = product(spec.named);
  return v;
}
