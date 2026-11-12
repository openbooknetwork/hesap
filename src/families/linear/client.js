// The browser half of the linear family. It shows the plane, whose knobs the reader drags to transform it, the
// readouts and buttons docked under it, and the values in the text that follow it. A page with named matrices has
// Start and a time slider in place of knobs.
import { SCENES, HANDLES, WRAP, keep, steps as stepsOf, snap, context, starts } from './scenes.js';
import { PRESETS, along, mix, same, times, through } from './matrices.js';
import { figure } from './figure.js';
import { driver } from './driver.js';
import { formatter, formulas } from './format.js';
import { GOALS, flat, route } from './goals.js';
import { slider, chip, button, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { player } from '../../kit/play.js';
import { drag as dragOf, nudge as nudgeOf } from '../../kit/drag.js';
import { h } from '../../kit/dom.js';

// Each measure or formula points at these parts of the figure.
const MARKS = { a: ['i'], c: ['i'], i: ['i'], b: ['j'], d: ['j'], j: ['j'], matrix: ['i', 'j'], 'formula-matrix': ['i', 'j'], det: ['square'], area: ['square'],
  'formula-det': ['square'], angle: ['angle'], tilt: ['tilt'], vector: ['vector'], tx: ['vector'], ty: ['vector'], 'formula-image': ['image', 'vector'],
  k: ['k'], 'area-scale': ['k'], centre: ['centre'], P: ['P'], image: ['image'] };
// A worked formula colours the columns of a matrix with \htmlClass, which KaTeX runs only when trusted.
const TRUST = { trust: c => c.command === '\\htmlClass', strict: 'ignore' };
const entries = v => [v.a, v.b, v.c, v.d], asValues = m => ({ a: m[0], b: m[1], c: m[2], d: m[3] });
// The time slider runs from 0 to STEPS.
const STEPS = 1000;
// A move through named matrices waits before each one and then takes MOVE milliseconds.
const MOVE = 1100, WAITS = [450, 250];
const inOutCubic = t => t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;

// timing maps the share of time that has passed to the time t of n named matrices, holding still while it waits.
function timing(n) {
  const parts = Array.from({ length: n }, (_, k) => [WAITS[Math.min(k, 1)], MOVE]), total = parts.flat().reduce((s, x) => s + x, 0);
  return { duration: total, ease: x => {
    let ms = x * total;
    for (const [k, [wait, move]] of parts.entries()) {
      if (ms <= wait) return k / n;
      ms -= wait;
      if (ms <= move) return (k + inOutCubic(ms / move)) / n;
      ms -= move;
    }
    return 1;
  } };
}

export default function linear({ host, box, stage, panel, T, lang, moving, motion }) {
  const fx = driver(motion);
  // values hold what the readouts and the text say, snapped to steps. shown holds what the figure draws, which
  // follows a finger exactly and eases onto the values when let go.
  let spec = null, scene = null, ctx = null, fig = null, values = {}, shown = {}, step = {}, grab = null, frame = 0, pointed = null;
  // clock is the time of a page with named matrices, from 0 where the plane has not moved to 1 where it rests.
  let clock = 1, time = null, chips = [], goal = null, play = null;
  // A challenge has its target number tn and whether its hint shows. calm is set while a panel built again for a new
  // language opens its hint again, which then does not flash.
  let tn = 0, hinting = false, calm = false;
  // The goal line's pop runs in a group of its own, so a line built again for a new language can cut it.
  const pops = motion.group();

  const F = () => formatter(lang());
  const timed = () => spec.named.length > 0;
  // The figure fits its box, which a phone's peek card shortens until the reader closes it.
  const sizer = new ResizeObserver(() => { if (fig) { const r = fig.svg.getBoundingClientRect(); fig.size(r.width, r.height); paint(); } });

  const paint = () => { if (fig.paint(shown) && fig.square && moving() && !grab) motion.pulse(fig.square.firstChild); };
  // refresh writes every value that follows the figure: the readouts, the knobs' spoken values and the text's links.
  function refresh() {
    const f = F(), now = id => f.value(spec, values, id, tn);
    for (const k of chips) {
      if (k.id === 'matrix') { k.tex(f.worked(spec, values, 'matrix'), TRUST); continue; }
      if (k.set(now(k.id)) && moving() && !timed()) motion.flash(k.el);
    }
    for (const k of fig.knobs) k.g.setAttribute('aria-valuetext', Object.keys(HANDLES[k.id].steps).map(key => `${key} ${f.num(values[key])}`).join(', '));
    live(host, { value: now, formula: id => formulas(spec).includes(id) ? f.worked(spec, values, id) : null, katex: TRUST });
    judge();
  }
  // The goal is checked after every change. Once reached it shows, and it stays until a change undoes it.
  const target = () => flat(spec.challenge.targets[tn]);
  function judge() {
    const c = spec.challenge;
    if (!c || !goal) return;
    const now = GOALS[c.goal].reached(entries(values), target(), c.tolerance);
    goal.say(T(`goal_${c.goal}`, { target: c.goal === 'det' ? F().num(target()) : '' }));
    fig.svg.classList.toggle('solved', now);
    if (goal.show(now) && moving()) fx.solve([fig.body, fig.aim ?? fig.square?.firstChild].filter(Boolean));
  }
  const unclue = () => { fig.clue(null); for (const b of panel.querySelectorAll('.lit')) b.classList.remove('lit'); };
  // A hint rings the spot where i belongs, or lights the move that starts the shortest way to the outline.
  function clue() {
    unclue();
    const t = target();
    if (!spec.moves.length) return fig.clue({ x: t[0], y: t[2] });
    const way = route(entries(values), t, spec.moves), b = panel.querySelector(way?.length ? `[data-move="${way[0]}"]` : '[data-act="reset"]');
    b?.classList.add('lit'); if (b && moving() && !calm) motion.flash(b);
  }
  // Another one sets the next target and takes the plane back to its start.
  function another() {
    tn = (tn + 1) % spec.challenge.targets.length;
    if (spec.challenge.goal === 'match') { fig.goal(target()); if (moving()) motion.pulse(fig.aim); }
    restart();
  }
  function restart() { unclue(); hinting = false; goal?.reset(); motion.stop(); settleOn(starts(spec)); refresh(); glide({ duration: 650, ease: 'inOutCubic' }); }
  // New values reach the readouts when they differ from the old ones.
  const settleOn = next => { if (Object.keys(next).some(k => next[k] !== values[k])) { values = next; refresh(); } };

  // The drawn values ease onto the values. A turn or a mirror line goes the short way round.
  function glide(opts) {
    for (const [k, period] of Object.entries(WRAP)) if (k in shown) shown[k] += Math.round((values[k] - shown[k]) / period) * period;
    if (!moving()) { Object.assign(shown, values); return paint(); }
    fx.settle(shown, values, paint, opts);
  }

  // A drag moves a knob by as much as the pointer has moved since it took hold, so a knob does not jump to the
  // finger. The knob stays inside the plane the figure shows.
  function bind(node, id, end) {
    dragOf(node, {
      point: e => fig.plane(e),
      start: p => { motion.stop(); grab = { id, p0: p, k0: HANDLES[id].at(shown, ctx, end), v0: { ...shown } }; box.classList.add('linear-dragging'); },
      move: p => {
        const lim = spec.view - 0.3, clamp = x => Math.min(Math.max(x, -lim), lim);
        const to = { x: clamp(grab.k0.x + p.x - grab.p0.x), y: clamp(grab.k0.y + p.y - grab.p0.y) };
        const raw = HANDLES[grab.id].put(to, grab.v0, ctx), next = { ...shown, ...Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, keep(k, x)])) };
        const snapped = snap(next, step);
        if (scene.fits && !scene.fits(snapped, ctx)) return;
        shown = next;
        cancelAnimationFrame(frame); frame = requestAnimationFrame(paint);
        settleOn(snapped);
      },
      drop: () => { box.classList.remove('linear-dragging'); grab = null; glide(); },
    });
  }
  // The arrow keys move a focused knob a step at a time. A step onto a value the scene rules out takes one more
  // step, past it.
  function nudge(id, x, y) {
    motion.stop();
    const lim = spec.view - 0.3, ok = v => { const p = HANDLES[id].at(v, ctx); return Math.abs(p.x) <= lim && Math.abs(p.y) <= lim && (!scene.fits || scene.fits(v, ctx)); };
    let next = snap({ ...values, ...HANDLES[id].nudge(values, x, y) }, step);
    if (!ok(next)) next = snap({ ...next, ...HANDLES[id].nudge(next, x, y) }, step);
    if (!ok(next)) return;
    settleOn(next); glide({ duration: 260, ease: 'outQuad' });
  }

  // A page with named matrices opens with the plane at rest. Start plays the move from the beginning, the time slider
  // goes back and forth through it, and the readouts follow the plane on the way.
  function at(t) {
    const m = through(spec.named, t);
    clock = t; shown = asValues(m); paint(); settleOn(asValues(m));
    time?.set(Math.round(t * STEPS));
  }
  // A move applies a named matrix to the plane as it is now. The readouts and the goal follow when the move ends. A
  // press during a move cuts it short, and the values take its end while the plane glides there first.
  function apply(id) {
    const was = values;
    motion.stop(); grab = null; unclue();
    if (values !== was) refresh();
    const base = entries(values), from = entries(shown), next = times(PRESETS[id].m, base);
    const done = () => { settleOn(asValues(next)); if (hinting) clue(); };
    if (!moving()) { shown = asValues(next); paint(); return done(); }
    const phases = [...(same(from, base) ? [] : [{ duration: 250, at: t => mix(from, base, t) }]), { duration: 800, at: t => times(along(id, t), base) }];
    fx.morph(phases, m => { shown = asValues(m); paint(); }, done, () => { values = asValues(next); });
  }

  // relabel builds the panel for a new language. It keeps a reached goal without the pop, and an open hint.
  function drawPanel(relabel = false) {
    const c = spec.challenge, was = relabel ? goal : null, reached = !!was?.reached();
    play?.halt();
    goal = c ? goalRow({ T, motion: moving() ? pops : null,
      hint: c.goal === 'match' ? (on, kept) => { hinting = on; calm = !!kept; if (on) clue(); else unclue(); calm = false; return null; } : null,
      another: c.targets.length > 1 ? another : null }) : null;
    hinting = false;
    let ctls = null;
    if (timed()) {
      const { duration, ease } = timing(spec.named.length);
      play = player({ duration, ease, moving, now: () => clock, at });
      time = slider({ id: 'time', label: T('time'), min: 0, max: STEPS, value: Math.round(clock * STEPS), cls: 'linear-time',
        write: v => `${Math.round(v / 10)}%`, input: v => { play.halt(); at(v / STEPS); } });
      // Start plays the whole move from where the plane has not moved, and reduced motion jumps to its end.
      const starter = button({ label: T('start'), act: 'start', primary: true, press: () => { play.halt(); if (moving()) at(0); play.start(); } });
      ctls = row('ctls', [starter, time]);
    } else { play = null; time = null; }
    chips = spec.readout.map(id => chip({ id, label: id === 'matrix' ? null : T(id), cls: id === 'matrix' ? 'linear-matrix' : '' }));
    for (const k of chips) {
      k.el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') fig.mark(MARKS[k.id] ?? [], true); });
      k.el.addEventListener('pointerleave', () => fig.mark(MARKS[pointed] ?? [], !!pointed));
    }
    const acts = [...spec.moves.map(id => { const b = button({ label: T(id), act: 'move', press: () => apply(id) }); b.dataset.move = id; return b; }),
      timed() ? null : button({ label: T('reset'), act: 'reset', glyph: 'reset', press: restart })].filter(Boolean);
    // The controls, the readouts and the buttons share their rows, to leave the figure the height.
    const dock = h('div', { class: 'linear-dock' }, [ctls, chips.length ? row('out', chips) : null, acts.length ? row('acts', acts) : null].filter(Boolean));
    panel.replaceChildren(...[goal?.el, dock].filter(Boolean));
    goal?.keep(was);
    if (reached) goal.show(true);
  }

  function draw() {
    motion.stop(); cancelAnimationFrame(frame); grab = pointed = goal = null; clock = 1; tn = 0; hinting = false;
    scene = SCENES[spec.scene]; ctx = context(spec); step = stepsOf(spec.scene); values = starts(spec);
    fig = figure(spec, T); stage.replaceChildren(fig.svg); motion.adopt(fig.svg); sizer.disconnect(); sizer.observe(fig.svg);
    for (const k of fig.knobs) { bind(k.g, k.id, k.end); nudgeOf(k.g, { step: (x, y) => nudge(k.id, x, -y) }); }
    if (fig.grab) bind(fig.body, fig.grab, 1);
    if (spec.challenge?.goal === 'match') fig.goal(target());
    const r = fig.svg.getBoundingClientRect(); fig.size(r.width, r.height);
    shown = { ...values };
    drawPanel(); refresh(); paint();
  }

  return {
    show(page) { spec = page; draw(); },
    hide() { play?.halt(); cancelAnimationFrame(frame); sizer.disconnect(); grab = null; spec = null; fig = null; stage.replaceChildren(); },
    point(id, on) {
      if (!fig) return;
      pointed = on ? id : null; fig.mark(MARKS[id] ?? [], on);
      for (const k of chips) k.el.classList.toggle('hot', on && k.id === id);
    },
    lang() { if (!spec) return; drawPanel(true); refresh(); },
    theme() {},
  };
}
