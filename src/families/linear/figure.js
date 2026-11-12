// The figure of linear draws the plane in SVG when a page opens and paints it again whenever the values move. The
// grid and the shape that move sit in one group, so a move rewrites one transform however many lines it holds.
// One unit of the SVG is one pixel of the screen, so knobs, labels and strokes keep their size on any screen.
import { SCENES, HANDLES, run, context } from './scenes.js';
import { SHAPES, middle } from './shapes.js';
import { det } from './matrices.js';

const NS = 'http://www.w3.org/2000/svg', G = 28; // the grid runs from -G to G, past the edge of a shrunk plane
const el = (tag, attrs = {}, kids = []) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); n.append(...kids.filter(Boolean)); return n; };
const r2 = n => Math.round(n * 100) / 100;
const put = (n, attrs) => { for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, typeof v === 'number' ? r2(v) : v); };
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y }), len = p => Math.hypot(p.x, p.y);
// a stroke keeps its width however far the group around it stretches
const thin = { 'vector-effect': 'non-scaling-stroke' };

export function figure(spec, say) {
  const scene = SCENES[spec.scene], ctx = context(spec), { P } = ctx, O = { x: 0, y: 0 }, matrix = spec.scene === 'matrix';
  let S = 30, flipped = false, box = { w: 400, h: 400 }; // S is the pixels in a unit of the plane, and box is the figure's size.
  const V = p => ({ x: S * p.x, y: -S * p.y });
  const shape = SHAPES[spec.shape], at = ([x, y]) => ({ x: x + P.x, y: y + P.y });
  const outline = shape.rings.map(ring => 'M' + ring.map(p => { const q = at(p); return `${q.x} ${q.y}`; }).join('L') + 'Z').join('');
  const corners = shape.marks.map(at), mid = at([middle(shape).x, middle(shape).y]);

  // The grid has a line for each whole number, nearest the middle first, so it can spread outwards.
  const grid = moving => Array.from({ length: 2 * G + 1 }, (_, n) => n - G).sort((a, b) => Math.abs(a) - Math.abs(b)).flatMap(k => [
    el('line', { x1: k, y1: -G, x2: k, y2: G, class: k ? 'ln' : moving ? 'ax ax-j' : 'ax', ...thin }),
    el('line', { x1: -G, y1: k, x2: G, y2: k, class: k ? 'ln' : moving ? 'ax ax-i' : 'ax', ...thin })]);
  const under = el('g', { class: 'under' }, grid(false)), lines = matrix ? grid(true) : [];
  // The unit square holds a turning arrow, which runs the other way once the plane turns over.
  const square = spec.show.includes('square') && el('g', { 'data-mark': 'square' }, [el('path', { class: 'square a', d: 'M0 0H1V1H0Z', ...thin }),
    el('path', { class: 'spin', d: 'M.6556 .3444A.22 .22 0 1 1 .3444 .3444', ...thin }), el('path', { class: 'spin-head', d: 'M.401 .2878L.3868 .3868L.302 .302Z' })]);
  const body = el('path', { class: 'shape a', d: outline, 'fill-rule': 'evenodd', ...thin });
  const moved = el('g', { class: 'moved' }, [...lines, square, body]);
  const ghost = (!matrix || spec.show.includes('ghost')) && el('g', { class: 'ghost' }, [el('path', { d: outline, 'fill-rule': 'evenodd', ...thin })]);
  // a match challenge draws the outline the shape must land on, and its hint rings the spot where i belongs
  const matching = spec.challenge?.goal === 'match', aim = matching && el('g', { class: 'aim' }, [el('path', { class: 'a', d: outline, 'fill-rule': 'evenodd', ...thin })]);
  const clue = matching && el('circle', { class: 'clue', r: 15 });
  let goal = null, hint = null;
  const fitAim = () => { if (!goal) return; const [a, b, c, d] = goal; aim.setAttribute('transform', `matrix(${r2(S * a)} ${r2(-S * c)} ${r2(S * b)} ${r2(-S * d)} 0 0)`); };
  const fitClue = () => { if (!clue) return; clue.style.display = hint ? '' : 'none'; if (hint) put(clue, { cx: V(hint).x, cy: V(hint).y }); };

  function arrow(cls, mark) {
    const shaft = el('line', { class: 'shaft' }), head = el('path', { class: 'linear-head' });
    return { g: el('g', { class: `linear-arrow ${cls}`, 'data-mark': mark }, [shaft, head]), to(p, q) {
      const a = V(p), b = V(q), L = Math.hypot(b.x - a.x, b.y - a.y), h = Math.min(14, L * 0.5), ux = (b.x - a.x) / (L || 1), uy = (b.y - a.y) / (L || 1);
      const bx = b.x - ux * h, by = b.y - uy * h, w = h * 0.42;
      put(shaft, { x1: a.x, y1: a.y, x2: bx, y2: by });
      put(head, { d: `M${r2(b.x)} ${r2(b.y)}L${r2(bx + uy * w)} ${r2(by - ux * w)}L${r2(bx - uy * w)} ${r2(by + ux * w)}Z` });
    } };
  }
  const line = (cls, mark) => el('line', { class: cls, ...(mark && { 'data-mark': mark }) });
  const dot = (cls, mark) => el('circle', { class: cls, r: 4.5, 'data-mark': mark });
  const name = (text, mark) => { const t = el('text', { class: 'name a', 'data-mark': mark }); t.textContent = text; return t; };
  // A label stands off its point in whichever of 16 directions keeps furthest from what it should not cover: the
  // middle of its shape and the lines that meet at the point. A knob on the point takes more room.
  const label = (t, p, avoid, gap = 18) => {
    const a = V(p), away = avoid.map(q => sub(V(q), a)).filter(d => len(d) > 1).map(d => Math.atan2(d.y, d.x));
    let best = 0, most = -1;
    for (let k = 0; k < 16; k++) {
      const th = 3 * Math.PI / 4 + k * Math.PI / 8, clear = Math.min(Math.PI, ...away.map(w => Math.abs((th - w + 3 * Math.PI) % (2 * Math.PI) - Math.PI)));
      if (clear > most + 1e-6) { most = clear; best = th; }
    }
    const g = gap * (1 + 0.2 * Math.abs(Math.cos(best))), inside = (x, half) => Math.min(Math.max(x, 14 - half), half - 14);
    const q = { x: inside(a.x + Math.cos(best) * g, box.w / 2), y: inside(a.y + Math.sin(best) * g, box.h / 2) };
    put(t, q);
    return { x: q.x / S, y: -q.y / S };
  };
  // P′ is labelled first, and P keeps clear of that label when the two points meet
  const both = (img, avoidP, avoidImage, gap) => {
    const q = label(says.image, img(P), avoidImage, gap);
    label(says.P, P, len(sub(img(P), P)) < 0.6 ? [...avoidP, q] : avoidP);
  };
  const room = id => spec.handles.includes(id) ? 28 : 18;
  const spin = (p, c, deg) => { const r = deg * Math.PI / 180, d = sub(p, c); return { x: c.x + d.x * Math.cos(r) - d.y * Math.sin(r), y: c.y + d.x * Math.sin(r) + d.y * Math.cos(r) }; };

  // Each scene draws its marks over the plane and moves them with the values.
  const marks = el('g', { class: 'marks' }), names = el('g', { class: 'names' });
  const pts = { P: dot('pt', 'P'), image: dot('pt', 'image') }, says = { P: name('P', 'P'), image: name('P′', 'image') };
  const C = v => ({ x: v.cx, y: v.cy });
  let draw;
  if (spec.scene === 'slide') {
    const vec = arrow('vec', 'vector'), trails = corners.map(() => arrow('trail', 'vector'));
    marks.append(...trails.map(t => t.g), vec.g);
    draw = (v, img) => {
      vec.to(P, img(P)); trails.forEach((t, n) => t.to(corners[n], img(corners[n])));
      both(img, [mid, img(P)], [img(mid), P], room('vector'));
    };
  } else if (spec.scene === 'turn' || spec.scene === 'stretch') {
    const turning = spec.scene === 'turn', centre = dot('centre', 'centre'), cName = name('C', 'centre');
    const rays = (turning ? [P, P] : [P, ...corners]).map(() => line('ray', turning ? 'angle' : 'k'));
    const wedge = turning && el('path', { class: 'wedge', 'data-mark': 'angle' }), arc = turning && el('path', { class: 'arc', 'data-mark': 'angle' });
    marks.append(...[wedge, arc, ...rays, centre].filter(Boolean)); names.append(cName);
    draw = (v, img) => {
      const c = C(v), vc = V(c);
      put(centre, { cx: vc.x, cy: vc.y });
      if (turning) {
        // the arc leaves P and reaches P′, so each label keeps clear of the arc's end at its point
        const turnTo = Math.sign(v.angle) * 25;
        label(cName, c, [P, img(P)], room('centre'));
        both(img, [mid, c, spin(P, c, turnTo)], [img(mid), c, spin(img(P), c, -turnTo)], room('angle'));
        const a = V(P), b = V(img(P)), R = len(sub(a, vc)), w = Math.min(28, R * 0.6), sweep = v.angle > 0 ? 0 : 1;
        const on = (p, rr) => { const d = sub(p, vc), n = len(d) || 1; return `${r2(vc.x + d.x / n * rr)} ${r2(vc.y + d.y / n * rr)}`; };
        put(rays[0], { x1: vc.x, y1: vc.y, x2: a.x, y2: a.y }); put(rays[1], { x1: vc.x, y1: vc.y, x2: b.x, y2: b.y });
        put(wedge, { d: `M${r2(vc.x)} ${r2(vc.y)}L${on(a, w)}A${r2(w)} ${r2(w)} 0 0 ${sweep} ${on(b, w)}Z` });
        put(arc, { d: `M${r2(a.x)} ${r2(a.y)}A${r2(R)} ${r2(R)} 0 0 ${sweep} ${r2(b.x)} ${r2(b.y)}` });
        return;
      }
      [P, ...corners].forEach((p, n) => {
        // A ray runs from the centre through a corner and on to its image, wherever the scale factor puts it.
        const ts = [0, 1, v.k], d = sub(p, c), lo = Math.min(...ts), hi = Math.max(...ts), from = V({ x: c.x + d.x * lo, y: c.y + d.y * lo }), to = V({ x: c.x + d.x * hi, y: c.y + d.y * hi });
        put(rays[n], { x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      });
      label(cName, c, [P, ...corners, img(P), ...corners.map(img)], room('centre'));
      both(img, [mid, c, img(P)], [img(mid), c, P], room('factor'));
    };
  } else if (spec.scene === 'mirror') {
    const glass = line('mirror', 'tilt'), perps = [P, ...corners].map(() => line('perp', 'image'));
    marks.append(glass, ...perps);
    draw = (v, img) => {
      const t = v.tilt * Math.PI / 180, a = V({ x: -2 * G * Math.cos(t), y: -2 * G * Math.sin(t) }), b = V({ x: 2 * G * Math.cos(t), y: 2 * G * Math.sin(t) });
      put(glass, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      [P, ...corners].forEach((p, n) => { const q = V(p), w = V(img(p)); put(perps[n], { x1: q.x, y1: q.y, x2: w.x, y2: w.y }); });
      both(img, [mid, img(P)], [img(mid), P]);
    };
  } else {
    const ai = arrow('ai', 'i'), aj = arrow('aj', 'j'), iName = name('i', 'i'), jName = name('j', 'j');
    const walk = spec.show.includes('steps') && [arrow('si step', 'image'), arrow('sj step', 'image')];
    if (walk) marks.append(...walk.map(w => w.g));
    marks.append(aj.g, ai.g); names.append(iName, jName);
    draw = (v, img) => {
      const i = { x: v.a, y: v.c }, j = { x: v.b, y: v.d };
      ai.to(O, i); aj.to(O, j);
      const aimed = goal ? [run({ m: goal, o: O }, mid)] : []; // the labels keep clear of a challenge's outline too
      label(iName, i, [O, j, ...aimed], room('i')); label(jName, j, [O, i, ...aimed], room('j'));
      // the corner P is P.x steps along i and then P.y steps along j
      if (walk) { const xi = { x: P.x * i.x, y: P.x * i.y }; walk[0].to(O, xi); walk[1].to(xi, img(P)); label(says.image, img(P), [img(mid), xi]); }
    };
  }
  const point = matrix ? (spec.show.includes('steps') ? ['image'] : []) : ['P', 'image'];
  marks.append(...point.map(k => pts[k])); names.append(...point.map(k => says[k]));

  const knobs = spec.handles.flatMap(id => (HANDLES[id].ends ?? [1]).map(end => {
    const lift = el('g', { class: 'lift' }, [el('circle', { class: 'hit', r: 22 }), el('circle', { class: 'dot', r: 8 })]);
    return { id, end, g: el('g', { class: `knob k-${id}`, tabindex: 0, role: 'slider', 'aria-label': say(`handle_${id}`), 'data-handle': id }, [lift]) };
  }));
  const svg = el('svg', { class: 'linear-plane' }, [under, ghost, aim, moved, marks, clue, el('g', {}, knobs.map(k => k.g)), names]);
  // the image of the shape is a handle too, when the scene's first handle moves it
  const grab = ['vector', 'angle', 'factor'].includes(spec.handles[0]) ? spec.handles[0] : null;
  if (grab) body.classList.add('grab');

  return {
    svg, knobs, body, grab, square, aim: aim && aim.firstChild,
    // size takes the screen's size in pixels. The origin sits in the middle, and view units fit across the short side.
    size(w, h) {
      S = Math.min(w, h) / (2 * spec.view); box = { w, h };
      put(svg, { viewBox: `${r2(-w / 2)} ${r2(-h / 2)} ${r2(w)} ${r2(h)}` });
      for (const g of [under, ghost].filter(Boolean)) g.setAttribute('transform', `matrix(${r2(S)} 0 0 ${r2(-S)} 0 0)`);
      fitAim(); fitClue();
    },
    // goal takes a match challenge's target as [a, b, c, d], and clue the point its hint rings, or null for none.
    goal(m) { goal = m; fitAim(); },
    clue(p) { hint = p; fitClue(); },
    paint(v) {
      const map = scene.map(v), [a, b, c, d] = map.m, img = p => run(map, p);
      moved.setAttribute('transform', `matrix(${r2(S * a)} ${r2(-S * c)} ${r2(S * b)} ${r2(-S * d)} ${r2(S * map.o.x)} ${r2(-S * map.o.y)})`);
      draw(v, img);
      const p0 = V(P), p1 = V(img(P));
      put(pts.P, { cx: p0.x, cy: p0.y }); put(pts.image, { cx: p1.x, cy: p1.y });
      for (const k of knobs) { const p = V(HANDLES[k.id].at(v, ctx, k.end)); k.g.setAttribute('transform', `translate(${r2(p.x)} ${r2(p.y)})`); }
      const over = det(map.m) < 0;
      if (over !== flipped) { flipped = over; svg.classList.toggle('flipped', over); return true; }
      return false;
    },
    // plane returns the point of the plane under a pointer.
    plane(e) { const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x / S, y: -q.y / S }; },
    mark(ids, on) { for (const n of svg.querySelectorAll('[data-mark]')) n.classList.toggle('hot', on && ids.includes(n.dataset.mark)); },
  };
}
