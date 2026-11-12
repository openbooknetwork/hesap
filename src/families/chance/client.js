// The browser half of the chance family. It draws a scene of coins, dice or pegs in SVG and docks Start, a slider
// and the readouts under it. Start runs the trials of a seeded run one after another, and the slider goes back and
// forth through the same run.
import { MODELS, runsOf, replay } from './models.js';
import { formatter } from './format.js';
import { seedOf } from './random.js';
import { GOALS, targetOf } from './goals.js';
import { svg as el } from '../../kit/dom.js';
import SCENES from './scenes.js';
import { slider, chip, button, segment, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { player } from '../../kit/play.js';

// The slider runs from 0 to STEPS, and the trials grow with the square of its place, so the first trials of a long
// run get room of their own.
const STEPS = 1000;
// A whole run takes this many milliseconds to play.
const PLAY = 7000;
const KEYS = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

export default function chance({ host, box, stage, panel, T, lang, moving, motion: fx }) {
  const svg = el('svg', { class: 'chance-svg' }); stage.appendChild(svg);
  // decl holds the page's declarations, and spec holds them with the reader's choices. runs holds every trial of the
  // runs on show, others the counts of every run after the first, and st the counts of the first run's first n
  // trials. chosen is the sum or bin the reader picked, and hover is the one under the mouse. aim is the index of the
  // challenge's target.
  let decl = null, spec = null, model = null, measures = {}, runs = null, others = [], st = null, view = null, run = 0, n = 0;
  let size = 1, chosen = null, hover = null, raf = 0, prev = 0, area = { w: 0, h: 0 }, aim = 0;
  let time = null, chips = [], goal = null, starter = null;

  const F = () => formatter(lang());
  const nOf = v => Math.round(spec.trials * (v / STEPS) ** 2), vOf = k => Math.round(STEPS * Math.sqrt(k / spec.trials));
  // A new size draws the scene again from its counts.
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // Frames run while a value still glides toward the counts. A reader who asked for less motion gets one frame of
  // endless length, which puts every value in place.
  function frame(t) {
    raf = 0;
    if (!view) return;
    const dt = prev ? Math.min(t - prev, 100) : 16; prev = t;
    if (view.tick(moving() ? dt : Infinity)) raf = requestAnimationFrame(frame); else prev = 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // A new run draws every trial from the next seed, and the scene shows as many of them as the slider asks for.
  function begin() {
    spec = { ...decl, size, pick: chosen };
    const seed = seedOf(spec.seed, run); box.dataset.seed = seed;
    runs = runsOf(spec, seed); others = runs.slice(1).map(r => replay(spec, r, r.length));
    st = counts(); goal?.reset(); build(); refresh();
  }
  function counts() {
    const s = replay(spec, runs[0], n); s.others = others;
    if (s.pick !== undefined) s.pick = hover ?? chosen;
    return s;
  }
  // seek shows the first k trials. A key and Start move the slider's thumb to the new count, and a drag leaves it
  // under the pointer.
  function seek(k, thumb) {
    n = Math.max(0, Math.min(spec.trials, k));
    if (thumb) time.range.value = vOf(n);
    time?.show(Number(time.range.value));
    st = counts(); view?.sync(st); refresh(); wake();
  }
  // Start plays the run from the slider's place to its end. A run that has ended starts again with fresh numbers.
  const play = player({ duration: PLAY, moving, now: () => vOf(n) / STEPS, onState: on => { if (starter) starter.disabled = on; },
    at: t => { time.range.value = Math.round(t * STEPS); seek(nOf(Number(time.range.value)), false); } });
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { view = null; return; } // A phone is showing the text, so the scene is drawn when the stage shows again.
    svg.setAttribute('viewBox', `0 0 ${area.w} ${area.h}`);
    // A phone keeps a button of the page's own in the stage's top right corner, and the scene leaves it clear.
    view = SCENES[spec.scene]({ w: area.w, h: area.h, corner: host.phone.matches ? 54 : 0, spec, st, T, f: F(), pick });
    svg.replaceChildren(view.g);
    judge(); wake();
  }
  // A sum or a bin the reader taps stays picked, and one under the mouse shows while the mouse is there.
  function pick(k, hovering) {
    if (st.pick === undefined) return;
    if (hovering) hover = k; else { chosen = k; hover = null; }
    st.pick = hover ?? chosen; view.pick(st.pick); refresh();
  }

  // widest gives the widest a readout's value gets, so the panel keeps its size as the counts grow.
  const widest = (m, f, st0) => m.kind === 'count' ? f.int(10 ** String(decl.trials).length - 1).length : m.kind === 'share' ? 5 : m.kind === 'number' ? 4 : f.write(m, st0).length;
  // was is the goal's line before a change of language, whose state the new line keeps.
  function drawPanel(was = null) {
    const f = F(), st0 = model.start({ ...decl, size, pick: chosen }), c = decl.challenge;
    play.halt();
    // A challenge's line comes first.
    goal = c ? goalRow({ T, motion: moving() ? fx : null, hint: on => on ? T(`hint-${c.goal}`) : null,
      another: GOALS[c.goal].varies && c.targets.length > 1 ? () => { aim++; refresh(); } : null }) : null;
    // A page that judges whole runs shows every trial and has no slider. A page whose goal is a number of trials
    // keeps the slider as the reader's choice, and every other page with a slider gets Start.
    const starts = !decl.whole && !GOALS[c?.goal]?.sets;
    time = decl.whole ? null : slider({ id: model.noun, label: T(model.noun), min: 0, max: STEPS, value: vOf(n), write: v => f.int(nOf(v)),
      input: v => { play.halt(); seek(nOf(v), false); } });
    if (time) {
      time.width(f.int(decl.trials).length);
      // An arrow key adds or takes away one trial.
      time.range.addEventListener('keydown', e => { if (!KEYS[e.key]) return; e.preventDefault(); play.halt(); seek(n + KEYS[e.key], true); });
    }
    starter = starts ? button({ label: T('start'), act: 'start', primary: true, press: () => play.start(() => { run++; n = 0; time.range.value = 0; begin(); }) }) : null;
    const sizes = decl.sizes ? segment({ id: 'size', label: T('size'), items: decl.sizes.map(s => [s, f.int(s)]), value: size, pick: v => { size = Number(v); begin(); } }) : null;
    const again = starts ? null : button({ label: T('new-run'), act: 'new', glyph: 'reset', compact: true, press: () => { run++; begin(); } });
    chips = decl.readout.map(id => { const k = chip({ id }); k.width(widest(measures[id], f, st0)); return k; });
    for (const k of chips) {
      k.el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') point(k.id, true); });
      k.el.addEventListener('pointerleave', () => point(k.id, false));
    }
    panel.replaceChildren(...[goal?.el, row('ctls', [sizes, starter, time, again]), chips.length ? row('out', chips) : null].filter(Boolean));
    goal?.keep(was);
  }
  // refresh writes every value that follows the counts, in the readouts and the text.
  function refresh() {
    const f = F();
    for (const k of chips) { const m = measures[k.id]; k.name(T(m.label, typeof m.x === 'function' ? m.x(st) : m.x)); k.set(f.write(m, st)); }
    live(host, { value: id => measures[id] ? f.write(measures[id], st) : null, formula: id => f.worked(spec, st, id) });
    judge();
  }
  // The challenge's line says the goal and whether the counts and the reader's choices reach it. The parts that
  // reach it cheer once, and the line keeps saying so until a change undoes it.
  function judge() {
    const c = spec.challenge;
    if (!c || !goal) return;
    const f = F(), g = GOALS[c.goal], target = targetOf(c, aim);
    const r = g.test({ ...st, pick: chosen ?? st.pick }, spec, c, target);
    goal.say(T(`goal-${c.goal}`, g.words(c, target, f, spec)));
    const first = goal.show(r.done, r.note ? T(`note-${r.note[0]}`, g.note(r.note[1], f)) : undefined), parts = view?.goal?.(r) ?? [];
    if (first && moving()) fx.cheer(parts);
  }
  function point(id, on) {
    if (!spec) return;
    view?.hot(id, on);
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }
  function stop() { play.halt(); cancelAnimationFrame(raf); raf = 0; view = null; }

  return {
    show(page) {
      stop();
      spec = decl = page;
      model = MODELS[spec.scene]; measures = model.measures(spec);
      run = 0; n = spec.at; size = spec.sizes?.[0]; chosen = spec.pick ?? null; hover = null; aim = 0;
      drawPanel(); begin();
    },
    hide() { stop(); spec = null; svg.replaceChildren(); },
    point,
    lang() { if (!spec) return; drawPanel(goal); build(); refresh(); },
  };
}
