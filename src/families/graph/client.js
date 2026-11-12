// The browser half of the graph family. It draws one JSXGraph board, or two stacked over the same x, where the reader
// drags points along the curves, docks the sliders and readouts under them and keeps the values in the text in step.
import JXG from 'jsxgraph';
import SCENES from './scenes.js';
import GOALS from './goals.js';
import { mix } from './rules.js';
import { axes } from './plot.js';
import { driver } from './driver.js';
import { formatter, starts as startsOf, ruled, target, reached, measured } from './format.js';
import { slider, chip, button, segment, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live, math } from '../../kit/text.js';
import { h } from '../../kit/dom.js';
import { drag } from '../../kit/drag.js';

export default function graph({ host, stage, panel, T, lang, moving, motion: fx }) {
  // The goal line's pop runs in a group of its own, so a line built again for a new language can cut it.
  const run = driver(fx), pops = fx.group();
  const root = h('div', { class: 'graph-stage' }); stage.appendChild(root);
  // Each view holds a board, its labels and the layer that takes the pointer. blend holds the morph between two rules,
  // grab the handle being dragged and hot the id being pointed at. solved and hinted hold a challenge's state, which
  // the page forgets when the reader leaves it.
  let spec = null, scene = null, values = {}, views = [], handles = [], labels = [], marks = {}, watchers = [], blend = null, grab = null, hot = null;
  let solved = false, hinted = false, tex = [];
  // The panel's parts: the rule picker, the sliders by id, the readouts, the reset button and the challenge's line.
  let rules = null, sliders = {}, chips = [], again = null, goal = null;

  const F = () => formatter(lang());
  const name = id => T(id) ?? id;
  const starts = () => startsOf(spec, values.target);
  const shows = () => spec.challenge && GOALS[spec.challenge.goal].shows;
  const exact = () => ruled(spec, values);
  const drawn = () => blend ? mix(blend.from, exact(), blend.t) : exact();
  const moved = () => Object.entries(starts()).some(([id, x]) => values[id] !== x);
  // JSXGraph writes colours as attributes, so the theme's are read here and the boards drawn again on a switch.
  const colours = () => Object.fromEntries(['ink', 'ink-2', 'accent', 'rule', 'paper'].map(n => [n.replace('-', ''), host.css(`--${n}`)]));
  const screen = (w, at) => { const s = new JXG.Coords(JXG.COORDS_BY_USER, at, w.board).scrCoords; return [s[1], s[2]]; };

  // refresh writes every value that follows the figure: the sliders, the readouts, the captions and the linked text.
  function refresh(flash = false) {
    const f = F(), now = id => f.value(scene, spec, values, id);
    for (const [id, s] of Object.entries(sliders)) s.set(values[id]);
    for (const k of chips) if (k.set(now(k.id) ?? T('none')) && flash && moving()) fx.flash(k.el);
    rules?.set(values.rule);
    if (again) again.disabled = !moved();
    judge();
    live(host, { value: now, formula: id => scene.formulas[id] ? f.worked(scene, spec, values, id) : null });
    // The top caption writes the rule, and the one below says what its view plots.
    views.forEach((w, i) => {
      const say = i ? T(`below_${scene.below}`, { from: f.fmt(spec.from ?? 0) }) : `y = ${exact().write('x', f.tex)}`;
      if (tex[i] === say) return;
      tex[i] = say;
      if (i) w.cap.textContent = say; else math(w.cap, say);
    });
  }

  // A value can come from a slider, a handle or a reset. The scene hears of it, then the boards and numbers follow.
  function set(next, flash = false) {
    const prev = { ...values }; Object.assign(values, next);
    for (const w of watchers) w(prev);
    update(); refresh(flash);
  }
  const update = () => { for (const w of views) w.board.update(); };
  // A dragged value keeps to its slider's range and step.
  const fit = (id, to) => { const { slider: [low, high], step } = spec.controls[id]; return Number(Math.min(high, Math.max(low, low + Math.round((to - low) / step) * step)).toFixed(6)); };

  // Start again morphs a changed rule back, and the sliders glide home, each stepping as its slider does.
  function reset() {
    const to = starts(), ids = Object.keys(spec.controls), tween = Object.fromEntries(ids.map(id => [id, values[id]]));
    if (to.rule !== values.rule) choose(to.rule);
    if (!moving()) return set(to, true);
    run.glide(tween, Object.fromEntries(ids.map(id => [id, to[id]])), () => set(Object.fromEntries(ids.map(id => [id, fit(id, tween[id])]))), () => set(to, true));
  }
  // bend makes the curve drawn now bend into the rule the values hold.
  function bend(was) {
    if (!moving()) return;
    const b = blend = { from: { y: was.y, slope: was.slope, area: was.area }, t: 0 };
    run.morph(b, update, () => { if (blend === b) { blend = null; update(); } });
  }
  // When the reader picks a rule, the curve bends from the one drawn now into the new one.
  function choose(rule) {
    if (rule === values.rule) return;
    const was = drawn();
    values.rule = rule; bend(was);
    set({}, true);
  }

  // A challenge is checked after every change. The line says so once when the goal is reached, and the tick stays
  // until a change undoes it.
  function judge() {
    if (!goal) return;
    // The quiet line says nothing of a goal not reached, so the family says it is not reached yet.
    const now = reached(spec, values), first = goal.show(now, T('not-yet'));
    if (now === solved) return;
    solved = now; shine();
    if (first && moving()) run.glow(marks[shows()] ?? [], update);
  }
  // The parts of the figure that reach the goal stand out while it holds.
  const shine = () => { for (const m of marks[shows()] ?? []) m.el.setAttribute(solved || hot === shows() ? m.on : m.off); };
  // Another one moves to the next target and starts the figure again, and a curve bends into its new shape.
  function another() {
    const was = drawn();
    values = startsOf(spec, (values.target + 1) % spec.challenge.targets.length);
    bend(was);
    set({}, true);
  }

  // relabel builds the panel for a new language. It keeps a reached goal without the pop, and an open hint.
  function drawPanel(relabel = false) {
    const all = [spec.rule].flat(), c = spec.challenge, f = F();
    rules = all.length > 1 ? segment({ id: 'rule', items: all.map(r => [r, name(`rule_${r}`)]), value: values.rule, pick: choose }) : null;
    rules?.el.setAttribute('aria-label', T('rule'));
    sliders = Object.fromEntries(Object.entries(spec.controls).map(([id, s]) => [id, slider({ id, label: name(id), min: s.slider[0], max: s.slider[1], step: s.step,
      value: values[id], write: v => F().fmt(v), input: v => set({ [id]: v }) })]));
    // A value keeps its width as it changes, so the panel and the figure above it stay still.
    const longest = Object.values(spec.controls).map(s => Math.max(...s.slider.map(v => f.fmt(v).length)));
    for (const s of Object.values(sliders)) s.width(Math.max(3, ...longest));
    chips = spec.readout.map(id => {
      const k = chip({ id, label: name(id) }), pair = Array.isArray(measured(scene, spec, id)(values, exact(), spec));
      k.width(pair ? 13 : 5); k.el.hidden = !hinted && !!c?.hint.includes(id);
      return k;
    });
    // On a phone Start again keeps its icon, and its name goes to its tooltip.
    again = button({ label: T('reset'), act: 'reset', glyph: 'reset', compact: true, cls: 'graph-reset', press: reset });
    const out = row('out', c ? chips : [...chips, again]);
    // The readouts' row leaves the panel while Hint hides every readout on it.
    const fill = () => { out.style.display = chips.some(k => !k.el.hidden) ? '' : 'none'; };
    // The page's title states the goal, so the line holds the state, its buttons and Start again.
    const was = relabel ? goal : null;
    goal = c ? goalRow({ T, quiet: true, actions: [again], motion: moving() ? pops : null, another: c.targets?.length > 1 ? another : null,
      hint: c.hint.length ? on => { hinted = on; for (const k of chips) if (c.hint.includes(k.id)) k.el.hidden = !on; fill(); return null; } : null }) : null;
    goal?.keep(was);
    if (goal && relabel && solved) goal.show(true);
    fill();
    panel.replaceChildren(...[goal?.el, rules ? row('ctls', [rules]) : null, Object.keys(sliders).length ? row('ctls', Object.values(sliders)) : null, out].filter(Boolean));
    for (const node of panel.querySelectorAll('[data-ref]')) {
      node.addEventListener('pointerenter', () => { if (host.canHover.matches) point(node.dataset.ref, true); });
      node.addEventListener('pointerleave', () => point(node.dataset.ref, false));
    }
  }

  // Labels sit beside their place on the figure, on the side the scene names, kept inside the view.
  const SIDE = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.7, -0.7], nw: [-0.7, -0.7], se: [0.7, 0.7], sw: [-0.7, 0.7] };
  function place(w) {
    const width = w.plot.clientWidth, height = w.plot.clientHeight;
    if (!width) return; // The stage is hidden, as on a phone's text tab.
    for (const l of labels) {
      if (l.view !== w.i) continue;
      const on = l.visible();
      l.div.hidden = !on; l.div.classList.toggle('hot', !!hot && hot === l.ref);
      if (!on) continue;
      const text = l.say(); if (l.div.textContent !== text) l.div.textContent = text;
      const [x, y] = screen(w, l.at()), [dx, dy] = SIDE[typeof l.side === 'function' ? l.side() : l.side], lw = l.div.offsetWidth, lh = l.div.offsetHeight, gap = 12;
      const left = x + dx * gap - lw / 2 + dx * lw / 2, top = y + dy * gap - lh / 2 + dy * lh / 2;
      l.div.style.transform = `translate(${Math.round(Math.min(width - lw - 2, Math.max(2, left)))}px, ${Math.round(Math.min(height - lh - 2, Math.max(2, top)))}px)`;
    }
  }

  // The reader's pointer on a view takes the handle nearest to it, or the first that is close enough when two sit
  // together, and moves it to the pointer at once, so a tap anywhere on the figure moves the point there.
  function listen(w) {
    const size = (hd, to) => { if (moving()) run.swell(hd.point, to); else hd.point.setAttribute({ size: to }); };
    const move = (hd, [px, py]) => {
      const u = new JXG.Coords(JXG.COORDS_BY_SCREEN, [px, py], w.board).usrCoords, next = {};
      for (const [id, to] of Object.entries(hd.drag([u[1], u[2]]))) next[id] = fit(id, to);
      if (Object.entries(next).some(([id, x]) => values[id] !== x)) set(next);
    };
    drag(w.hit, {
      point: e => { const r = w.box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },
      start: p => {
        const mine = handles.filter(hd => hd.view === w.i);
        if (!mine.length) return false;
        const far = hd => Math.hypot(...screen(w, hd.at()).map((s, k) => s - p[k]));
        grab = mine.find(hd => far(hd) < 22) ?? mine.reduce((a, b) => far(b) < far(a) ? b : a);
        size(grab, 10); move(grab, p);
      },
      move: p => { if (grab) move(grab, p); },
      drop: () => { if (!grab) return; size(grab, 7); grab = null; },
    });
  }

  // A board keeps the page's view whatever its size, so the views below and above share x to the pixel.
  const box = w => [w.r.x[0], w.r.y[1], w.r.x[1], w.r.y[0]];
  const fits = new ResizeObserver(entries => {
    for (const { target: el } of entries) {
      const w = views.find(w => w.plot === el), width = el.clientWidth, height = el.clientHeight;
      if (!w || !width || !height || (w.board.canvasWidth === width && w.board.canvasHeight === height)) continue;
      w.board.resizeContainer(width, height, true, true); w.board.setBoundingBox(box(w), false); w.board.fullUpdate();
    }
  });

  function clear() {
    fits.disconnect();
    for (const w of views) JXG.JSXGraph.freeBoard(w.board);
    root.replaceChildren(); views = []; handles = []; labels = []; marks = {}; watchers = []; blend = null; grab = null; tex = [];
  }
  // Each view gets a board, stacked over the same x, and the scene draws on them through ctx.
  function drawViews() {
    fx.stop(); clear();
    const c = colours(), ranges = [{ x: spec.view.x, y: spec.view.y }, ...(scene.views === 2 ? [{ x: spec.view.x, y: spec.view.below }] : [])];
    root.classList.toggle('graph-two', ranges.length === 2);
    const div = (cls, parent) => { const d = h('div', { class: cls }); parent.appendChild(d); return d; };
    // Every view is in place before any board starts, so each board starts at its own size.
    views = ranges.map((r, i) => {
      const el = div('graph-view', root), cap = div('graph-cap', el), plot = div('graph-plot', el);
      return { i, r, el, cap, plot, box: div('graph-board', plot), layer: div('graph-labels', plot), hit: div('graph-hit', plot) };
    });
    for (const w of views) {
      w.box.id = `graph-board-${w.i}`;
      w.board = JXG.JSXGraph.initBoard(w.box, { boundingbox: box(w), keepaspectratio: false, axis: false, showCopyright: false, showNavigation: false,
        showInfobox: false, pan: { enabled: false }, zoom: { enabled: false }, registerEvents: false });
      axes(w.board, c, w.r, { y: w.i ? '' : 'y' });
      listen(w); fits.observe(w.plot);
    }
    const first = ruled(spec, starts());
    const ctx = {
      boards: views.map(w => w.board), views: ranges, v: () => values, f: drawn, R: exact, c, fmt: n => F().fmt(n), pair: (a, b) => F().pair(a, b), has: a => spec.annotate.includes(a), spec, first,
      word: id => name(id).toLocaleLowerCase(lang()), // word gives a word to write on the figure
      handle({ view = 0, at, drag, ref }) {
        const point = views[view].board.create('point', [() => at()[0], () => at()[1]], { fixed: true, highlight: false, name: '', withLabel: false, face: 'o', size: 7,
          fillColor: c.accent, strokeColor: c.paper, strokeWidth: 2.5 });
        handles.push({ view, at, drag, ref, point });
        return point;
      },
      label({ view = 0, at, say, side, ref = null, visible = () => true }) {
        labels.push({ view, at, say, side, ref, visible, div: div('graph-label', views[view].layer) });
      },
      // mark names what stands out while the text or a readout points at ref.
      mark(ref, el, attrs) {
        const keep = Object.fromEntries(Object.keys(attrs).map(k => [k, el.visProp[k.toLowerCase()]]));
        (marks[ref] ??= []).push({ el, on: attrs, off: keep });
        return el;
      },
      watch: fn => watchers.push(fn),
      settle: rects => { if (moving()) run.settle(rects, update); else for (const r of rects) r.s = 1; },
    };
    scene.draw(ctx);
    const g = spec.challenge && GOALS[spec.challenge.goal];
    g?.draw?.(ctx, { now: () => target(spec, values), all: spec.challenge.targets ?? [{}] }, spec.challenge.tolerance ?? g.tolerance);
    shine();
    for (const w of views) w.board.on('update', () => place(w));
    update();
  }

  function point(id, on) {
    if (!spec) return;
    hot = on ? id : null;
    for (const node of panel.querySelectorAll('[data-ref]')) node.classList.toggle('hot', on && node.dataset.ref === id);
    for (const [ref, list] of Object.entries(marks)) for (const m of list) m.el.setAttribute(ref === hot || (solved && ref === shows()) ? m.on : m.off);
    for (const hd of handles) if (hd !== grab) hd.point.setAttribute({ size: on && hd.ref === id ? 10 : 7 });
    update();
  }

  return {
    show(page) {
      spec = page; scene = SCENES[spec.scene]; hot = null; solved = hinted = false; values = startsOf(spec);
      drawPanel(); drawViews(); refresh();
    },
    hide() { clear(); spec = null; },
    point,
    theme() { if (!spec) return; drawViews(); refresh(); },
    lang() { if (!spec) return; drawPanel(true); tex = []; refresh(); },
  };
}
