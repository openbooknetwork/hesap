// The browser half of the wave family. It draws a point that runs round a circle and the waves its height draws,
// docks the controls under them and keeps the values in the text with the figure. The reader turns the point by
// dragging it or by moving the angle slider.
import SCENES, { rad, sin, cos, tan, turn, measureOf } from './scenes.js';
import { fit } from './layout.js';
import { driver } from './driver.js';
import { formatter, starts } from './format.js';
import { GOALS, judge } from './goals.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { drag, nudge } from '../../kit/drag.js';
import { slider, chip, button, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';

// A dragged point snaps to a multiple of STEP degrees, and shift with an arrow key turns it by STEP.
const STEP = 15;
// A readout's swatch takes the colour of what it measures in the figure.
const TONES = { sin: 'sin', cos: 'cos', tan: 'tan', first: 'sin', second: 'cos', radians: 'arc' };
const RADIANS = { 90: 'π/2', 180: 'π', 270: '3π/2', 360: '2π' };

export default function wave({ host, box: root, stage, panel, T, lang, moving, motion }) {
  const set = (n, attrs) => { for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const svg = el('svg', { class: 'wave-svg' }); stage.appendChild(svg);
  const fx = driver(motion);
  // v holds the values the text and the readouts show. shown holds the sliders as the figure draws them, easing after
  // v. goal is a challenge page's goal, aim the index of its target, drawnTarget the target as drawn, found the spots
  // found and solved whether it is reached. line is the challenge's line in the panel.
  let goal = null, aim = 0, drawnTarget = null, found = [], solved = false, retarget = null, line = null;
  let scrub = null, sliders = [], chips = [], spec = null, scene = null, v = {}, shown = {}, box = null, geo = null, P = null, size = '', pointed = null, easing = null;

  const F = () => formatter(lang());
  new ResizeObserver(() => { if (spec && `${svg.clientWidth}x${svg.clientHeight}` !== size) { build(); frame(); } }).observe(svg);

  // ---------- These helpers say where things are. ----------
  const C = (u, w) => [geo.cx + u * geo.s, geo.cy - w * geo.s]; // C places a point of the circle side, given in units.
  const G = (x, y) => [geo.gx + x / 360 * geo.gw, geo.gy - y * geo.s]; // G places a point of the graph, with x in degrees.
  const seg = (n, [x1, y1], [x2, y2]) => set(n, { x1, y1, x2, y2 });
  const dot = (n, [cx, cy]) => set(n, { cx, cy });
  const show = (n, on) => { n.style.display = on ? '' : 'none'; };
  // arc draws an arc about (x, y) of radius r from angle a0 to a1, anticlockwise. With sector it draws a slice.
  function arc(x, y, r, a0, a1, sector) {
    const span = a1 - a0;
    if (span < 0.05) return '';
    const p = a => `${x + r * Math.cos(rad(a))} ${y - r * Math.sin(rad(a))}`;
    if (span > 359.95) return `M${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}${sector ? 'Z' : ''}`;
    return `${sector ? `M${x} ${y}L` : 'M'}${p(a0)}A${r} ${r} 0 ${span > 180 ? 1 : 0} 0 ${p(a1)}${sector ? 'Z' : ''}`;
  }
  // curve draws a wave from x = a to x = b every 1.5°. It lifts the pen where the wave has no value or runs far off.
  function curve(f, a, b) {
    const far = (box.graph.u + box.graph.d) * 2, out = [];
    let pen = false;
    for (let x = a; ; x = Math.min(x + 1.5, b)) {
      const y = f(x);
      if (y === null || Math.abs(y) > far) pen = false;
      else { const [px, py] = G(x, y); out.push(`${pen ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`); pen = true; }
      if (x >= b) break;
    }
    return out.join('');
  }
  const within = y => y !== null && Math.abs(y) <= box.graph.u + 0.05;

  // ---------- The figure is built once for each layout. ----------
  // build makes everything that keeps its place for a layout, and frame() moves what follows the angle and the sliders.
  function build() {
    const w = svg.clientWidth, ht = svg.clientHeight;
    size = `${w}x${ht}`; svg.setAttribute('viewBox', `0 0 ${w} ${ht}`);
    if (!spec || !w || !ht) { svg.replaceChildren(); P = null; return; }
    geo = fit(w, ht, box);
    const { side, graph } = box, ref = id => ({ 'data-ref': id }), d0 = { ...v, ...shown };
    P = { arms: [], waves: [], bars: [] };
    const sideG = el('g', { class: 'side' }), clip = el('clipPath', { id: 'wave-side' }, [el('rect', rect(C(-side.l - 0.12, side.u + 0.12), C(side.r + 0.3, -side.d - 0.12)))]);
    const defs = el('defs', {}, [clip]);
    sideG.append(seg(el('line', { class: 'axis' }), C(-side.l - 0.08, 0), C(side.r + 0.08, 0)), seg(el('line', { class: 'axis' }), C(0, -side.d - 0.08), C(0, side.u + 0.08)));
    if (scene.unit) sideG.append(el('circle', { class: 'guide', cx: geo.cx, cy: geo.cy, r: geo.s }));
    if (goal?.keys.includes('height')) sideG.append(P.levelC = el('line', { class: 'level' }));
    if (scene.tangent) sideG.append(seg(el('line', { class: 'axis touch' }), C(1, -scene.tangent - 0.1), C(1, scene.tangent + 0.1)));
    P.wedge = el('path', { class: 'wedge', ...ref(scene.wedge) });
    if (scene.rim) P.rim = el('path', { class: 'rim', ...ref('radians') });
    sideG.append(P.wedge, ...(P.rim ? [P.rim] : []));
    if (scene.tangent) {
      P.ray = el('line', { class: 'ray', 'clip-path': 'url(#wave-side)' }); P.tleg = el('line', { class: 'leg t-tan', ...ref('tan') });
      sideG.append(P.ray, P.tleg);
    }
    if (scene.legs?.across) sideG.append(P.across = el('line', { class: 'leg t-cos', ...ref('cos') }));
    if (scene.legs?.up) sideG.append(P.up = el('line', { class: 'leg t-sin', ...ref(scene.legs.up) }));
    if (scene.spring) {
      const x = scene.spring, top = side.u - 0.1;
      sideG.append(seg(el('line', { class: 'ceiling' }), C(x - 0.3, top), C(x + 0.3, top)));
      P.coil = el('path', { class: 'coil' }); P.weight = el('rect', { class: 'weight t-sin', rx: 4, ...ref(scene.legs.up) }); P.level = el('line', { class: 'join' });
      sideG.append(P.level, P.coil, P.weight);
    }
    // Each arm comes with its circle. The tip of the first arm is the handle the reader drags.
    scene.arms(d0).forEach((a, i) => {
      const ring = el('circle', { class: i ? 'ring rides' : 'ring' }), arm = el('line', { class: `arm${a.tone ? ` t-${a.tone}` : ''}`, ...(a.ref ? ref(a.ref) : {}) });
      const tip = el('circle', { class: `tip a${a.tone ? ` t-${a.tone}` : ''}`, r: i ? 6 : 7 });
      P.arms.push({ ring, arm, tip }); sideG.prepend(ring); sideG.append(arm);
    });
    if (scene.start) sideG.append(P.start = el('circle', { class: 'start a', r: 6, ...ref('phase') }));
    if (scene.tangent) sideG.append(P.T = el('circle', { class: 'tip t-tan a', r: 6, ...ref('tan') }), P.Tname = name('T'));
    P.pins = goal?.need > 1 ? Array.from({ length: goal.need }, () => ({ c: el('circle', { class: 'pin a', r: 7 }), g: el('circle', { class: 'pin a', r: 6 }) })) : [];
    sideG.append(...P.pins.map(p => p.c));
    P.hit = el('circle', { class: 'hit' });
    P.grip = el('circle', { class: 'grip', r: 22 });
    P.handle = el('g', { class: 'handle', tabindex: 0, role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': 360, 'aria-label': T('angle') }, [P.grip, P.arms[0].tip]);
    sideG.append(P.hit, ...P.arms.slice(1).map(a => a.tip), P.handle, P.name = name('P'));
    grabbing(P.hit); grabbing(P.handle); keys(P.handle);

    const parts = [defs, sideG];
    if (graph) {
      const gg = el('g', { class: 'graph' }), top = graph.u + 0.1, low = graph.d + 0.1;
      defs.append(el('clipPath', { id: 'wave-graph' }, [el('rect', rect(G(-4, top), G(364, -low)))]));
      for (let y = 1; y <= Math.max(graph.u, graph.d) + 1e-9; y++) for (const sg of [1, -1]) if ((sg > 0 ? graph.u : graph.d) >= y) {
        gg.append(seg(el('line', { class: 'guide' }), G(0, sg * y), G(360, sg * y)), label('tick y', G(0, sg * y), `${sg < 0 ? '−' : ''}${y}`));
      }
      gg.append(seg(el('line', { class: 'axis' }), G(0, 0), G(360, 0)), seg(el('line', { class: 'axis' }), G(0, -graph.d - 0.08), G(0, graph.u + 0.08)));
      for (const x of geo.gw / 4 < 46 ? [180, 360] : [90, 180, 270, 360]) gg.append(seg(el('line', { class: 'axis' }), G(x, 0).map((n, i) => i ? n - 4 : n), G(x, 0).map((n, i) => i ? n + 4 : n)), label('tick x', G(x, 0), spec.axis === 'radians' ? RADIANS[x] : `${x}°`));
      for (const x of scene.asymptotes ?? []) gg.append(seg(el('line', { class: 'guide asymptote' }), G(x, -graph.d - 0.08), G(x, graph.u + 0.08)));
      const curves = el('g', { 'clip-path': 'url(#wave-graph)' });
      if (goal?.keys.includes('height')) gg.append(P.levelG = el('line', { class: 'level' }));
      if (goal?.wave) curves.append(P.target = el('path', { class: 'wave-target' }));
      for (const wv of scene.waves()) {
        const tone = wv.tone ? ` t-${wv.tone}` : '', full = el('path', { class: `wave-${wv.role === 'trace' ? 'ahead' : wv.role}${tone}`, ...ref(wv.id) });
        const trace = wv.role === 'trace' ? el('path', { class: `trace${tone}`, ...ref(wv.id) }) : null;
        curves.append(full, ...(trace ? [trace] : [])); P.waves.push({ ...wv, full, trace });
      }
      gg.append(curves);
      if (spec.annotate.includes('quarter')) {
        const y = 1.22, a = G(0, y), b = G(90, y);
        gg.append(el('path', { class: 'mark', d: `M${a[0]} ${G(0, 1.04)[1]}V${a[1]}H${b[0]}V${G(90, 1.04)[1]}`, ...ref('quarter') }), label('mark-label', [(a[0] + b[0]) / 2, a[1] - 6], '90°', 'auto'));
      }
      if (spec.annotate.includes('period')) gg.append(P.period = el('path', { class: 'mark', ...ref('period') }), P.periodName = label('mark-label', [0, 0], 'T', 'auto'));
      for (const b of scene.bars(d0)) { const bar = el('line', { class: `bar t-${b.tone}`, ...ref(b.ref) }); P.bars.push(bar); gg.append(bar); }
      if (scene.start) gg.append(P.from = el('line', { class: 'join' }), P.zero = el('circle', { class: 'start a', r: 6, ...ref('phase') }));
      gg.append(P.join = el('line', { class: 'join' }));
      const main = P.waves.find(wv => wv.id === scene.join);
      gg.append(P.q = el('circle', { class: `q a t-${main.tone}`, r: 6.5, ...ref(main.id) }), ...P.pins.map(p => p.g));
      parts.push(gg);
    }
    parts.push(P.fx = el('g'));
    svg.replaceChildren(...parts); motion.adopt(svg); P.drawn = ''; marks();
    if (pointed) hot(pointed, true);
  }
  const rect = ([x1, y1], [x2, y2]) => ({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
  function label(cls, [x, y], text, base) {
    const t = el('text', { class: cls, x: cls === 'tick y' ? x - 8 : x, y: cls === 'tick x' ? y + 8 : y }); t.textContent = text;
    if (base) t.setAttribute('dominant-baseline', base);
    return t;
  }
  const name = say => { const t = el('text', { class: 'letter' }); t.textContent = say; return t; };
  // A challenge marks its target height or wave on the figure, and the spots the reader has found.
  function marks() {
    if (!goal || !P) return;
    P.target?.setAttribute('d', curve(goal.wave(drawnTarget), 0, 360));
    if (P.levelG) { seg(P.levelG, G(0, drawnTarget.height), G(360, drawnTarget.height)); seg(P.levelC, C(-box.side.l - 0.08, drawnTarget.height), C(box.side.r + 0.08, drawnTarget.height)); }
    P.pins.forEach((p, i) => {
      const a = found[i], seen = a !== undefined;
      show(p.c, seen); show(p.g, seen);
      if (seen) { dot(p.c, C(cos(a), sin(a))); dot(p.g, G(a, sin(a))); }
    });
  }

  // frame moves what follows the angle and the sliders.
  function frame() {
    if (!P) return;
    const d = { ...v, ...shown }, arms = scene.arms(d), x = v.angle;
    let u = 0, w = 0;
    arms.forEach((a, i) => {
      const p = P.arms[i], from = C(u, w);
      dot(p.ring, from).setAttribute('r', Math.max(a.r * geo.s, 0.5));
      u += a.r * cos(a.at); w += a.r * sin(a.at);
      seg(p.arm, from, C(u, w)); dot(p.tip, C(u, w));
      if (!i) { P.tip1 = { u, w }; dot(P.grip, C(u, w)); }
    });
    const first = arms[0], { u: u1, w: w1 } = P.tip1, centre = C(0, 0);
    dot(P.hit, centre).setAttribute('r', first.r * geo.s + 24);
    P.wedge.setAttribute('d', arc(...centre, Math.min(0.3 * first.r * geo.s, 30), 0, turn(first.at) || (first.at ? 360 : 0), true));
    P.rim?.setAttribute('d', arc(...centre, geo.s, 0, x));
    if (P.across) seg(P.across, centre, C(u1, 0));
    if (P.up) seg(P.up, C(u1, 0), C(u1, w1));
    // The letter stands outside the circle a little ahead of the point, clear of the legs and of T.
    const ahead = Math.atan2(w1, u1) + 0.7;
    set(P.name, { x: C(u1, w1)[0] + Math.cos(ahead) * 20, y: C(u1, w1)[1] - Math.sin(ahead) * 20 });
    let lift = { u, w }; // lift is where the height the graph draws comes from.
    if (scene.tangent) {
      const t = tan(first.at), dir = cos(first.at) < 0 ? -1 : 1, far = 9;
      seg(P.ray, C(-dir * far * cos(first.at), -dir * far * sin(first.at)), C(dir * far * cos(first.at), dir * far * sin(first.at)));
      const seen = within(t);
      show(P.T, seen); show(P.Tname, seen); show(P.tleg, t !== null);
      if (t !== null) seg(P.tleg, C(1, 0), C(1, Math.max(-scene.tangent - 0.1, Math.min(scene.tangent + 0.1, t))));
      if (seen) { dot(P.T, C(1, t)); set(P.Tname, { x: C(1, t)[0] + 16, y: C(1, t)[1] }); }
      lift = seen ? { u: 1, w: t } : null;
    }
    if (scene.spring) {
      const sx = scene.spring, top = box.side.u - 0.1, low = w1 + 0.14, n = 9, [px] = C(sx, 0), wd = 0.13 * geo.s;
      const ys = Array.from({ length: n + 1 }, (_, i) => C(0, top - 0.08 - (top - 0.08 - low - 0.04) * i / n)[1]);
      P.coil.setAttribute('d', `M${px} ${C(0, top)[1]}L${px} ${ys[0]}` + ys.slice(1, -1).map((y, i) => `L${px + (i % 2 ? -wd : wd)} ${y}`).join('') + `L${px} ${ys[n]}L${px} ${C(0, low)[1]}`);
      const [wx, wy] = C(sx, w1); set(P.weight, { x: wx - 0.2 * geo.s, y: wy - 0.14 * geo.s, width: 0.4 * geo.s, height: 0.28 * geo.s });
      seg(P.level, C(u1, w1), [wx, wy]); // The weight stays level with P.
    }
    if (P.start) dot(P.start, C(cos(d.phase), sin(d.phase)));
    // The handle tells a screen reader where it stands.
    set(P.handle, { 'aria-valuenow': Math.round(x), 'aria-valuetext': F().deg(Math.round(x)) });
    if (box.graph) graphFrame(d, x, lift);
  }

  function graphFrame(d, x, lift) {
    const key = JSON.stringify(shown) + size;
    // The full waves change only with the sliders.
    if (P.drawn !== key) { P.drawn = key; for (const wv of P.waves) wv.full.setAttribute('d', curve(t => wv.f(d, t), 0, 360)); }
    for (const wv of P.waves) wv.trace?.setAttribute('d', curve(t => wv.f(d, t), 0, x));
    const bars = scene.bars({ ...d, angle: x }), side = bars.filter(b => b.from === undefined).length > 1;
    bars.forEach((b, i) => {
      const n = P.bars[i], to = b.to === null ? null : Math.max(-box.graph.d - 0.1, Math.min(box.graph.u + 0.1, b.to)), dx = side ? (i - (bars.length - 1) / 2) * 6 : 0;
      show(n, to !== null);
      if (to !== null) seg(n, G(x, b.from ?? 0).map((c, j) => j ? c : c + dx), G(x, to).map((c, j) => j ? c : c + dx));
    });
    const main = P.waves.find(wv => wv.id === scene.join), y = main.f(d, x), seen = within(y);
    show(P.q, seen); show(P.join, seen && !!lift);
    if (seen) dot(P.q, G(x, y));
    if (seen && lift) seg(P.join, C(lift.u, lift.w), G(x, y));
    if (P.period) {
      const k = Math.min(360, 360 / d.frequency), y0 = box.graph.u - 0.12, [a, top] = G(0, y0), [b] = G(k, y0), foot = G(0, y0 - 0.12)[1];
      P.period.setAttribute('d', `M${a} ${foot}V${top}H${b}V${foot}`); set(P.periodName, { x: (a + b) / 2, y: top - 6 });
    }
    // The start dot on the circle joins the one on the graph when the two stand level.
    if (P.zero) { const z = G(0, sin(d.phase)); dot(P.zero, z); seg(P.from, C(cos(d.phase), sin(d.phase)), z); show(P.from, geo.mode === 'beside'); }
  }

  // ---------- The reader drags, scrubs or uses the keys. ----------
  const pointerAngle = e => { const p = svgPoint(svg, e); return turn(Math.atan2(geo.cy - p.y, p.x - geo.cx) * 180 / Math.PI); };
  // A dragged point lands on a whole degree, and on a multiple of 15° when it comes within 2° of one.
  function snap(x) {
    x = Math.round(Math.max(0, Math.min(360, x)));
    const near = Math.round(x / STEP) * STEP;
    return Math.abs(near - x) <= 2 ? near : x;
  }
  function setAngle(x) { v.angle = x; scrub.set(x); frame(); refresh(); }
  // A drag on the point or anywhere near the circle turns the point, and the goal is judged when the drag ends.
  function grabbing(n) {
    drag(n, {
      point: pointerAngle,
      start: a => { if (!spec) return false; svg.classList.add('dragging'); P.handle.focus({ preventScroll: true }); setAngle(snap(scene.drag(v, a))); },
      move: a => setAngle(snap(scene.drag(v, a))),
      drop: () => { svg.classList.remove('dragging'); assess(); },
    });
  }
  // The arrow keys turn a focused point a degree, or 15° with shift.
  function keys(n) {
    nudge(n, { step: (dx, dy, e) => { setAngle(Math.max(0, Math.min(360, Math.round(v.angle) + (dx || -dy) * (e.shiftKey ? STEP : 1)))); assess(); } });
  }

  // ---------- The panel and the text follow the figure. ----------
  function drawPanel() {
    const f = F(), c = spec.challenge;
    // A slider counts for a challenge when the reader lets go of it, so sweeping past an answer finds nothing.
    scrub = slider({ id: 'angle', label: scene.x, min: 0, max: 360, step: 1, value: v.angle, cls: 'wave-scrub', write: x => f.deg(x), input: setAngle, change: assess });
    scrub.range.setAttribute('aria-label', T('angle')); scrub.width(5);
    const reset = button({ label: T('reset'), act: 'reset', glyph: 'reset', compact: true, press: rewind });
    sliders = scene.controls.map(id => {
      const k = spec.controls[id], s = slider({ id, label: T(id), min: k.slider[0], max: k.slider[1], step: k.step, value: v[id], write: x => f.value(scene, { [id]: x }, id), change: assess,
        input: x => { v[id] = x; easing?.pause(); if (moving()) easing = fx.ease(shown, { [id]: x }, frame); else { shown[id] = x; frame(); } refresh(); } });
      s.width(5);
      return s;
    });
    chips = spec.readout.map(id => {
      const tone = toneOf(id), k = chip({ id, label: measureOf(scene, id).label, swatch: tone ? `wave-sw-${tone}` : null });
      k.width(4.6);
      return k;
    });
    line = c ? goalRow({ T, motion: moving() ? motion : null, hint: on => on ? T(`hint-${c.goal}`) : null, another: c.targets.length > 1 ? another : null }) : null;
    panel.replaceChildren(...[line?.el, row('ctls', [scrub, reset]), sliders.length ? row('ctls', sliders) : null, chips.length ? row('out', chips) : null].filter(Boolean));
    if (line) status();
    for (const n of panel.querySelectorAll('[data-ref]')) {
      n.addEventListener('pointerenter', () => { if (host.canHover.matches) hot(n.dataset.ref, true); });
      n.addEventListener('pointerleave', () => { if (host.canHover.matches) hot(n.dataset.ref, false); });
    }
  }
  // A readout takes the colour of what it measures, and y takes the colour of its wave.
  const toneOf = id => TONES[id] ?? (id === 'y' ? scene.waves().find(wv => wv.id === 'y').tone : null);

  // rewind takes the point and the sliders back to where the page opened, and forgets the spots found.
  function rewind() {
    easing?.pause(); found = []; solved = false;
    v = starts(spec); shown = only(v);
    scrub.set(v.angle);
    for (const s of sliders) s.set(v[s.el.dataset.ref]);
    frame(); refresh(); marks(); if (goal) status();
  }
  const only = values => Object.fromEntries(scene.controls.map(id => [id, values[id]]));

  // refresh writes every value that follows the figure, in the readouts and in the text.
  function refresh() {
    const f = F();
    for (const k of chips) k.set(f.value(scene, v, k.id));
    live(host, { value: id => f.value(scene, v, id), formula: id => scene.formulas[id] ? f.worked(scene, v, id) : null });
  }

  // ---------- A challenge page judges its goal. ----------
  const target = () => spec.challenge.targets[aim];
  // The goal is judged when a drag or a slider move ends, on each arrow key and on a new target.
  function assess() {
    if (!goal) return;
    const was = solved, before = found.length;
    ({ solved, found } = judge(goal, v, target(), spec.challenge.tolerance, found));
    if (found.length !== before || solved !== was) { marks(); status(); }
    if (!moving()) return;
    if (solved && !was) cheer();
    else if (goal.need > 1 && found.length > before) ripple(P.pins[found.length - 1]);
  }
  // A reached goal shows once. Rings spread from what reached it, and a matched wave glows.
  function cheer() {
    if (!P) return;
    if (goal.holds) { fx.glow(P.waves.find(wv => wv.id === scene.join).trace); ring(P.q); }
    else if (goal.need > 1) P.pins.forEach(ripple);
    else ring(P.arms[0].tip);
  }
  const ripple = p => { if (p) { ring(p.c); ring(p.g); } };
  function ring(n) {
    const r = el('circle', { class: 'ripple', cx: n.getAttribute('cx'), cy: n.getAttribute('cy'), r: 9 });
    P.fx.append(r); fx.ripple(r);
  }
  // The goal line says the goal, or what was found once it is reached. A goal of two spots counts the ones found.
  function status() {
    const id = spec.challenge.goal;
    line.say(T(solved ? `done-${id}` : `goal-${id}`, { height: F().fmt(target().height ?? 0) }));
    line.show(solved, goal.need > 1 ? T('found', { n: found.length, need: goal.need }) : undefined);
  }
  // Another one steps to the next target the figure does not already meet, and the marks ease to it.
  function another() {
    const ts = spec.challenge.targets, from = aim;
    for (let i = 1; i <= ts.length; i++) { aim = (from + i) % ts.length; if (!judge(goal, v, target(), spec.challenge.tolerance).solved) break; }
    found = []; solved = false; retarget?.pause();
    if (moving()) retarget = fx.ease(drawnTarget, target(), marks); else { drawnTarget = { ...target() }; marks(); }
    status(); assess();
  }

  // What a readout, a slider or a link measures stands out in the figure while the reader points at it.
  function hot(id, on) {
    id = id?.replace(/^formula-/, '');
    for (const n of root.querySelectorAll('[data-ref]')) if (n.dataset.ref === id) n.classList.toggle('hot', on);
  }

  return {
    show(page) {
      easing = retarget = null; pointed = null;
      spec = page; scene = SCENES[spec.scene];
      v = starts(spec); shown = only(v); box = scene.box(spec.controls);
      goal = spec.challenge ? GOALS[spec.challenge.goal] : null; aim = 0; drawnTarget = goal && { ...target() }; found = []; solved = false;
      drawPanel(); build(); frame(); refresh();
    },
    hide() { spec = null; P = null; svg.replaceChildren(); },
    point(id, on) { if (!spec) return; pointed = on ? id : null; hot(id, on); },
    lang() { if (spec) { drawPanel(); build(); frame(); refresh(); } },
  };
}
