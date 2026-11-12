// The browser half of the proof family. It draws an SVG stage whose pieces move through one step of a proof, with a
// time slider and the size sliders docked under it. The book's own arrows turn to the next step, which is a page. A
// challenge page shows one step and checks a goal after every change the reader makes.
import PROOFS from './proofs/index.js';
import { GOALS } from './goals.js';
import { before, states } from './steps.js';
import makeDriver from './driver.js';
import { formatter, starts } from './format.js';
import { r2 } from './proofs/shapes.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { slider, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live as liveText } from '../../kit/text.js';
import { player } from '../../kit/play.js';
import { drag, nudge } from '../../kit/drag.js';

// LONG is how long a step plays in ms, SNAP how near to a place a dropped piece must land to snap to it, and STEPS
// the places of the time slider.
const LONG = 1700, SNAP = 48, STEPS = 1000;

export default function proof({ host, stage, panel, T, lang, moving, motion }) {
  const driver = makeDriver(motion);
  // at counts the step on show from 0, and t is how far through that step the figure stands, from 0 to 1. live holds
  // each piece's state as it is drawn now.
  let spec = null, proof = null, values = {}, scene = null, all = [], at = 0, t = 1, live = {}, nodes = {}, svg = null;
  let lit = new Set(), pointed = null;
  // challenge holds the goal, its targets and aim, the index of the one asked now, whether it holds, and the dragged
  // pieces' places.
  let challenge = null, grab = null, keys = [];
  let time = null, sliders = {}, goal = null;

  const F = () => formatter(lang());
  const last = () => all.length - 1;

  function shape(p) {
    const cls = 'proof-sh', points = () => p.points.map(q => q.join(',')).join(' ');
    if (p.shape === 'poly') return el('polygon', { class: cls, points: points() });
    if (p.shape === 'line') return el('polyline', { class: cls, points: points() });
    if (p.shape === 'path') return el('path', { class: cls, d: p.d });
    if (p.shape === 'dot') return el('circle', { class: cls, r: p.r });
    if (p.shape !== 'text') return null;
    const n = el('text', { class: cls, style: `font-size:calc(var(--k) * ${p.size}px)`, 'text-anchor': p.anchor ?? 'middle' }); n.textContent = p.say; return n;
  }
  // build draws the pieces for the values now. Each is a <g> the steps move, inside the <g> of the piece that holds it.
  function build() {
    for (const k of keys) k.cancel();
    keys = [];
    scene = proof.scene(values, { fmt: F().fmt, ranges: spec.controls, quiet: challenge?.goal.quiet }); all = states(scene);
    at = challenge ? challenge.goal.step - 1 : spec.step === 'last' || !spec.step ? last() : Math.min(spec.step - 1, last());
    svg = el('svg', { class: challenge?.goal.drag ? 'proof-svg proof-drags' : 'proof-svg', viewBox: `0 0 ${scene.view[0]} ${scene.view[1]}` });
    nodes = {};
    for (const p of scene.pieces) {
      const sh = shape(p), g = el('g', { 'data-piece': p.id }, sh ? [sh] : []);
      nodes[p.id] = { g, p, kids: [] };
      if (p.in) nodes[p.in].kids.push(p.id);
      (p.in ? nodes[p.in].g : svg).append(g);
    }
    for (const id of challenge?.goal.drag ?? []) draggable(id);
    stage.replaceChildren(svg); sized.disconnect(); sized.observe(svg);
  }
  // The figure scales with the stage, and its words less so: a phone's stay readable and a wide screen's stay modest.
  const sized = new ResizeObserver(([{ target, contentRect: box }]) => {
    if (box.width && scene) target.style.setProperty('--k', Math.min(1.25, Math.max(0.8, 1.1 / Math.min(box.width / scene.view[0], box.height / scene.view[1]))));
  });

  // draw draws a piece as it is now. A text turns back by every turn that holds it, so it stays upright.
  const held = id => { let turn = 0; for (let p = nodes[id].p.in; p; p = nodes[p].p.in) turn += live[p].turn; return turn; };
  function draw(id) {
    const s = live[id], n = nodes[id], text = n.p.shape === 'text';
    n.g.setAttribute('transform', `translate(${r2(s.x)} ${r2(s.y)}) rotate(${r2(text ? -held(id) : s.turn)}) scale(${r2(Math.max(0, s.scale))})`);
    n.g.setAttribute('opacity', r2(Math.min(1, Math.max(0, s.show))));
    n.g.style.visibility = s.show < 0.01 ? 'hidden' : '';
    if (!text && n.kids.length) upright(id);
  }
  const upright = id => { for (const k of nodes[id].kids) if (nodes[k].p.shape === 'text') draw(k); else upright(k); };
  const drawAll = () => { for (const p of scene.pieces) draw(p.id); };
  // A piece's classes give its shape and its tone in the step, lit for the result, hot for what the text points at,
  // and grab for a piece the reader can drag.
  function paint() {
    const drags = challenge?.goal.drag ?? [];
    for (const p of scene.pieces) {
      const tones = String(live[p.id].tone ?? '').split(' ').filter(Boolean).map(x => `proof-${x}`);
      nodes[p.id].g.setAttribute('class', ['proof-pc', `proof-${p.shape}`, ...tones, lit.has(p.id) && 'proof-lit', pointed && p.refs?.includes(pointed) && 'proof-hot',
        drags.includes(p.id) && 'proof-grab', grab?.id === p.id && 'drag'].filter(Boolean).join(' '));
    }
  }
  const shapes = ids => [...ids].map(id => nodes[id].g.querySelector(':scope > .proof-sh')).filter(Boolean);
  const copy = state => Object.fromEntries(Object.entries(state).map(([id, s]) => [id, { ...s }]));
  // The step's result stands out once the step has played through, and swells when it has just played.
  function light(swell) {
    lit = new Set(t >= 1 ? scene.steps[at].hi ?? [] : []); paint();
    if (swell && lit.size && moving()) driver.pulse(shapes(lit));
  }
  // A challenge shows its step whole, with the dragged pieces where the reader put them.
  function snap() {
    live = copy(all[at]);
    for (const [id, spot] of Object.entries(challenge.spots)) Object.assign(live[id], spot);
    drawAll(); check();
  }

  // frame draws the step at time t. Each piece that the step changes takes its own stretch of the time, one starting
  // after another, and a piece that appears where it stands grows from small.
  const ease = x => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2, mix = (a, b, x) => a + (b - a) * x;
  function frame() {
    const from = at ? all[at - 1] : before(scene), to = all[at];
    const changed = scene.pieces.filter(p => ['x', 'y', 'turn', 'scale', 'show'].some(k => Math.abs(from[p.id][k] - to[p.id][k]) > 1e-6));
    const gap = Math.min(0.05, 0.45 / Math.max(1, changed.length)), span = 1 - gap * Math.max(0, changed.length - 1);
    live = copy(t > 0 ? to : from);
    changed.forEach((p, i) => {
      const a = from[p.id], b = to[p.id], x = ease(Math.min(1, Math.max(0, (t - i * gap) / span)));
      const moves = ['x', 'y', 'turn'].some(k => Math.abs(a[k] - b[k]) > 1e-6), pops = a.show < 0.01 && b.show > 0 && !moves && p.shape !== 'group';
      Object.assign(live[p.id], { x: mix(a.x, b.x, x), y: mix(a.y, b.y, x), turn: mix(a.turn, b.turn, x),
        scale: pops ? mix(b.scale * 0.3, b.scale, x) : mix(a.scale, b.scale, x), show: mix(a.show, b.show, Math.min(1, x * 2.5)) });
    });
    drawAll(); light(false);
    time?.set(Math.round(t * STEPS));
  }
  // A step in which pieces slide or turn plays once as its page opens. A step that only shows something has no motion.
  const slides = () => { const from = at ? all[at - 1] : before(scene), to = all[at]; return scene.pieces.some(p => ['x', 'y', 'turn'].some(k => Math.abs(from[p.id][k] - to[p.id][k]) > 1e-6)); };
  const play = player({ duration: LONG, moving, now: () => t, at: x => { t = x; frame(); if (x >= 1) light(true); } });

  // check runs after every change. When the goal comes to hold, what reaches it shows, swells once and stays lit.
  // When the goal stops holding, the figure goes back to how the step has it.
  function check() {
    const c = challenge, state = { values, target: c.targets[c.aim], tolerance: c.tolerance, at: c.spots, slots: scene.slots };
    const solved = c.goal.holds(state), marks = solved ? c.goal.marks(state) : [], fresh = solved !== c.solved;
    const gone = c.marks.filter(id => !marks.includes(id) && live[id]);
    c.solved = solved; c.marks = marks; lit = new Set(marks); paint(); drawGoal();
    const changes = [...marks.map(id => [id, 1]), ...gone.map(id => [id, all[at][id].show])].map(([id, show]) => ({ id, now: live[id], to: { ...live[id], show, scale: 1 } }));
    if (!fresh || !moving()) { for (const { id, now, to } of changes) { Object.assign(now, to); draw(id); } return; }
    driver.go(changes, draw, () => { if (c.solved && c.marks === marks) driver.pulse(shapes(marks)); });
  }

  // A piece the goal lets the reader drag follows the pointer. Dropped near one of its places, it snaps there.
  function draggable(id) {
    const g = nodes[id].g;
    g.setAttribute('tabindex', 0); g.setAttribute('role', 'img'); g.setAttribute('aria-label', T('piece'));
    drag(g, {
      point: e => svgPoint(svg, e),
      start: p => { driver.halt(live[id]); grab = { id, dx: live[id].x - p.x, dy: live[id].y - p.y }; },
      // The piece rises over the others before the pointer is captured.
      raise: () => { svg.append(g); paint(); },
      move: p => move(id, p.x + grab.dx, p.y + grab.dy),
      drop: () => { grab = null; paint(); drop(id); },
    });
    // The arrow keys move a focused piece, which drops once the keys go quiet.
    keys.push(nudge(g, { step: (dx, dy) => { driver.halt(live[id]); move(id, live[id].x + dx * 12, live[id].y + dy * 12); }, rest: () => drop(id), idle: 700 }));
  }
  function move(id, x, y) {
    Object.assign(live[id], { x: Math.min(scene.view[0], Math.max(0, x)), y: Math.min(scene.view[1], Math.max(0, y)) }); draw(id);
  }
  function drop(id) {
    const c = challenge, s = live[id], far = q => Math.hypot(q.x - s.x, q.y - s.y);
    const [name, spot] = Object.entries(scene.slots[id]).sort(([, p], [, q]) => far(p) - far(q))[0];
    if (far(spot) <= SNAP) {
      c.named[id] = name; c.spots[id] = { x: spot.x, y: spot.y };
      if (moving()) driver.glide(s, spot, () => draw(id)); else { Object.assign(s, c.spots[id]); draw(id); }
    }
    else { c.named[id] = null; c.spots[id] = { x: s.x, y: s.y }; }
    check();
  }
  // After a slider moves, a piece on a place keeps it, and a piece off every place goes back to where it started.
  function respot() {
    const c = challenge;
    c.spots = Object.fromEntries((c.goal.drag ?? []).map(id => { c.named[id] ??= 'first'; const p = scene.slots[id][c.named[id]]; return [id, { x: p.x, y: p.y }]; }));
  }

  // refresh writes every value that follows the sliders: their outputs and the linked values in the text.
  function refresh() {
    const f = F();
    for (const [id, s] of Object.entries(sliders)) s.show(values[id]);
    liveText(host, { value: id => f.value(proof, values, id), formula: id => f.worked(proof, values, id) });
  }

  // words gives the values a goal's or a hint's string puts in for the target asked now.
  function words() {
    const f = F(), c = challenge;
    return Object.fromEntries(Object.entries(c.goal.args({ target: c.targets[c.aim] })).map(([k, v]) => [k, f.fmt(v)]));
  }
  // drawGoal writes the goal and whether it holds.
  function drawGoal() {
    goal.say(T(`goal-${spec.challenge.goal}`, words()));
    goal.show(challenge.solved);
  }

  function drawPanel() {
    const f = F(), c = challenge;
    goal = c ? goalRow({ T, motion: moving() ? motion : null,
      hint: on => on ? T(`hint-${spec.challenge.goal}`, words()) : null,
      // Another one asks for the next target in the page's list that the figure does not reach already.
      another: c.targets.length > 1 ? () => {
        const state = i => ({ values, target: c.targets[i], tolerance: c.tolerance, at: c.spots, slots: scene.slots });
        const order = c.targets.map((_, i) => (c.aim + 1 + i) % c.targets.length);
        c.aim = order.find(i => !c.goal.holds(state(i))) ?? order[0]; goal.reset(); check();
      } : null }) : null;
    // The time slider holds the step where the reader puts it.
    time = !c && slides() ? slider({ id: 'time', label: T('time'), min: 0, max: STEPS, value: Math.round(t * STEPS), output: false,
      write: v => `${f.fmt(v / 10, 0)}%`, input: v => { play.halt(); t = v / STEPS; frame(); } }) : null;
    // A size slider redraws the pieces for its value at the step on show.
    sliders = Object.fromEntries(Object.entries(spec.controls).filter(([, k]) => k.slider).map(([id, k]) => {
      const write = v => f.value(proof, { ...values, [id]: v }, id);
      const s = slider({ id, label: T(id), min: k.slider[0], max: k.slider[1], step: k.step, value: values[id], write, input: v => {
        values[id] = v; play.halt(); driver.stop(); build(); if (challenge) { respot(); snap(); } else frame(); refresh();
      } });
      s.width(Math.max(write(k.slider[0]).length, write(k.slider[1]).length));
      return [id, s];
    }));
    panel.replaceChildren(...[goal?.el, time && row('ctls', [time]), Object.keys(sliders).length ? row('ctls', Object.values(sliders)) : null].filter(Boolean));
    refresh(); if (c) drawGoal();
  }

  function stop() { play.halt(); driver.stop(); for (const k of keys) k.cancel(); grab = null; }

  return {
    show(page) {
      stop();
      spec = page;
      const c = spec.challenge, g = c && GOALS[c.goal];
      challenge = c ? { goal: g, targets: c.targets ?? [null], aim: 0, tolerance: c.tolerance ?? g.tolerance, solved: false, marks: [], named: {}, spots: {} } : null;
      proof = PROOFS[spec.of]; values = starts(spec.controls); t = 1; build();
      if (challenge) { respot(); drawPanel(); return snap(); }
      drawPanel();
      if (moving() && slides()) { t = 0; frame(); play.start(); } else frame();
    },
    hide() { stop(); sized.disconnect(); spec = null; scene = null; stage.replaceChildren(); },
    point(id, on) {
      pointed = on ? id : null;
      if (scene) paint();
      for (const node of panel.querySelectorAll('[data-ref]')) node.classList.toggle('hot', on && node.dataset.ref === id);
    },
    lang() { if (spec) { build(); drawPanel(); if (challenge) snap(); else frame(); } },
  };
}
