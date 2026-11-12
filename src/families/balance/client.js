// The browser half of the balance family. It draws a scale whose pans hold boxes of unknown weight x, weights and
// balloons, sets the equation the scale stands for above it under the steps taken so far, and docks the controls
// under it. The driver animates what happens.
import * as A from './algebra.js';
import { VIEW, PIVOT, ARM, LIFT, PLATE, FLOOR, TRAY, MOST, tilt, pan, over, things, arrange } from './layout.js';
import { driver as motions } from './driver.js';
import { formatter, starts } from './format.js';
import { GOALS } from './goals.js';
import { svg as el, h, svgPoint } from '../../kit/dom.js';
import { button, stepper, row as group } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live, math } from '../../kit/text.js';
import { drag } from '../../kit/drag.js';

const SIDES = ['l', 'r'];
// KaTeX may set \htmlClass, which the family writes itself to colour a step's own terms.
const KATEX = { strict: false, trust: c => c.command === '\\htmlClass' };
const tex = (node, t) => math(node, t, false, KATEX);

export default function balance({ host, stage, panel, T, lang, moving, motion: fx }) {
  const driver = motions(fx);
  const div = (cls, tag = 'div') => h(tag, { class: cls });
  const lines = div('balance-lines'), sheet = div('balance-sheet'), grid = div('balance-grid'), layerFx = div('balance-fx'), fig = div('balance-fig');
  sheet.append(grid, layerFx); lines.append(sheet); stage.append(lines, fig);

  // These hold the page and its model: the equation it opens with, what a box weighs, the lines so far as
  // { eq, op, n }, the number the steps use, and whether the check is showing.
  let spec = null, start = null, X = 1, steps = [], amount = 1, checking = false;
  // list holds the equations a challenge page sets one after another, and which is the index of the one it shows.
  let list = [], which = 0;
  // These hold the scale: the beam, the dial, each pan with the things on it by key, the beam's turn, the layer a held
  // weight moves in, and the weight the pointer holds.
  let svg = null, beam = null, dial = null, tray = null, pans = {}, angle = { t: 0 }, layer = null, grab = null;
  let run = 0, told = 0, timer = 0, busy = false, pointed = null;
  // These hold the panel's parts: the goal's line, the number picker, the steppers of the pans and the buttons.
  let goalLine = null, picker = null, sides = {}, ops = [], undoBtn = null, checkBtn = null;

  const F = () => formatter(lang());
  const now = () => steps[steps.length - 1].eq;
  const solved = eq => { const v = A.alone(eq); return v && A.level(eq, X) ? v : null; };
  // A page without a challenge has the goal solve with no limit on the steps.
  const goal = () => GOALS[spec.challenge?.goal ?? 'solve'](spec.challenge ?? {}, { eq: now(), steps: steps.length - 1, x: X });
  const rel = eq => (A.level(eq, X) ? '=' : '\\neq');
  const last = () => grid.querySelector('.balance-row.now');
  new ResizeObserver(() => { if (spec && !busy) mark(false); }).observe(lines);

  // Each step adds a line to the equation, and the lines share a grid so their equals signs line up.
  function line(cls, op) {
    const r = div(`balance-row ${cls}`), o = div('balance-op', 'span');
    if (op) tex(o, op);
    r.append(o, ...['l', 'rel', 'r'].map(k => div(`balance-cell ${k}`, 'span')));
    return r;
  }
  // KaTeX sets each token of a line in its cell.
  function fill(r, tokens) {
    const cells = Object.fromEntries(['l', 'rel', 'r'].map(k => [k, r.querySelector(`.balance-cell.${k}`)]));
    for (const c of Object.values(cells)) c.replaceChildren();
    for (const t of tokens) {
      const s = div(`balance-tok${t.sign ? ' sign' : ''}${t.unary ? ' unary' : ''}${t.op ? ' op' : ''}`, 'span');
      s.dataset.key = t.key; tex(s, t.tex);
      cells[t.key === 'rel' ? 'rel' : t.key[0]].append(s);
    }
  }
  // rows draws every line as the model has it, with no motion.
  function rows() {
    layerFx.replaceChildren(); grid.replaceChildren();
    steps.forEach((s, i) => { const r = line(i === steps.length - 1 ? 'now' : 'was', s.op && A.said(s.op, s.n)); fill(r, A.line(s.eq, rel(s.eq))); grid.append(r); });
    if (checking) { const v = solved(now()), r = line('check', `x=${A.signed(v)}`); fill(r, A.checked(start, v)); grid.append(r); }
    lines.scrollTop = lines.scrollHeight;
  }

  const rect = n => n.getBoundingClientRect();
  // snapshot notes where each token of a line stands now, so the token can move from there.
  const snapshot = r => new Map([...(r?.querySelectorAll('.balance-tok') ?? [])].map(t => [t.dataset.key, { el: t, tex: t.dataset.tex, at: rect(t), font: getComputedStyle(t).fontSize }]));
  // Tokens that are gone fade away from where they stood.
  function ghosts(before) {
    const at = rect(sheet);
    for (const b of before.values()) {
      const g = b.el.cloneNode(true); g.classList.add('ghost'); g.removeAttribute('style');
      Object.assign(g.style, { left: `${b.at.left - at.left}px`, top: `${b.at.top - at.top}px`, fontSize: b.font });
      layerFx.append(g); driver.exit(g, () => g.remove());
    }
  }
  // A line goes over to new tokens. A token on both moves from where it stood, a new one pops in, a step's own tokens
  // a little later, and the rest fade away.
  function morph(r, before, tokens, late = 0) {
    fill(r, tokens);
    if (!moving()) return;
    let k = 0;
    for (const t of r.querySelectorAll('.balance-tok')) {
      const b = before.get(t.dataset.key);
      if (b && b.tex === t.dataset.tex) { const n = rect(t); driver.move(t, b.at.left - n.left, b.at.top - n.top, n.height ? b.at.height / n.height : 1); before.delete(t.dataset.key); }
      else driver.enter(t, t.matches('.op') || t.querySelector('.op') ? late + 70 * k++ : 0);
    }
    ghosts(before);
  }

  // The goal's line says what the page asks and whether the reader has reached it. The last line of the equation
  // keeps a frame round it while the goal holds. Both are drawn with motion when the reader gets there.
  function mark(draw) {
    layerFx.querySelector('.balance-frame')?.remove();
    const g = goal(), ch = spec.challenge, r = last();
    goalLine.say(ch?.most === 1 ? T('goal_one') : ch?.most ? T('goal_most', { n: ch.most }) : T('goal_solve'));
    goalLine.show(g.met, g.over ? T('over', { k: steps.length - 1 }) : undefined);
    if (!r || !g.met) return;
    const toks = [...r.querySelectorAll('.balance-tok')].map(rect), at = rect(sheet), pad = 8;
    if (!toks.length) return;
    const x = Math.min(...toks.map(b => b.left)) - at.left - pad, y = Math.min(...toks.map(b => b.top)) - at.top - pad / 2;
    const w = Math.max(...toks.map(b => b.right)) - at.left + pad - x, ht = Math.max(...toks.map(b => b.bottom)) - at.top + pad / 2 - y;
    const edge = el('rect', { x: 1.5, y: 1.5, width: w - 3, height: ht - 3, rx: 10, pathLength: 1 });
    const f = el('svg', { class: 'balance-frame', width: w, height: ht }, [edge]);
    Object.assign(f.style, { left: `${x}px`, top: `${y}px` });
    layerFx.append(f);
    if (!draw || !moving()) return;
    driver.frame(edge);
    const ring = div('balance-ring'); Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${ht}px` }); layerFx.append(ring);
    driver.ripple(ring, () => ring.remove());
    // The box that stands alone nods on its pan.
    for (const s of SIDES) for (const [k, it] of pans[s].items) if (/\.x0$/.test(k)) driver.nod(it.a, 350);
    driver.pulse(checkBtn, 500);
  }

  function build() {
    const R = 58, on = deg => `${PIVOT.x + R * Math.sin(deg * Math.PI / 180)} ${PIVOT.y - R * Math.cos(deg * Math.PI / 180)}`;
    dial = el('g', { class: 'dial' }, [el('path', { class: 'arc', d: `M${on(-20)} A${R} ${R} 0 0 1 ${on(20)}` }), el('line', { class: 'mark', x1: PIVOT.x, y1: PIVOT.y - R - 7, x2: PIVOT.x, y2: PIVOT.y - R + 7 })]);
    beam = el('g', { class: 'beam' }, [el('line', { class: 'needle', x1: PIVOT.x, y1: PIVOT.y, x2: PIVOT.x, y2: PIVOT.y - R + 3 }),
      el('rect', { class: 'bar', x: PIVOT.x - ARM - 7, y: PIVOT.y - 5, width: 2 * ARM + 14, height: 10, rx: 5 }),
      ...[-1, 1].map(k => el('circle', { class: 'end', cx: PIVOT.x + k * ARM, cy: PIVOT.y, r: 5 }))]);
    pans = Object.fromEntries(SIDES.map(s => {
      const sky = el('g'), stack = el('g'), plate = el('rect', { class: 'plate', x: -PLATE / 2, y: 0, width: PLATE, height: 7, rx: 3.5 });
      return [s, { g: el('g', { class: `pan ${s}` }, [el('line', { class: 'post', x1: 0, y1: 7, x2: 0, y2: LIFT }), sky, plate, stack]), sky, stack, items: new Map() }];
    }));
    tray = null;
    if (spec.drag) {
      const label = el('text', { class: 'tray-label', x: TRAY.x, y: TRAY.y + 1 });
      tray = el('g', { class: 'tray' }, [...[-26, 0, 26].map((dx, i) => el('rect', { class: 'body spare', x: TRAY.x + dx - 10, y: TRAY.y - TRAY.height / 2 - 14 + (i % 2) * 3, width: 20, height: 20, rx: 3 })),
        el('rect', { class: 'box', x: TRAY.x - TRAY.width / 2, y: TRAY.y - TRAY.height / 2, width: TRAY.width, height: TRAY.height, rx: 6 }), label]);
      // A weight taken out of the tray moves under the pointer, and the tray keeps the pointer while it does.
      drag(tray, { point, move: hold, drop: release,
        start(p) { if (grab) return false; checking = false; begin(); grab = { it: thing({ key: 'held', kind: 'unit', label: '1', w: 24, h: 24, x: p.x, y: p.y }), dx: 0, dy: 0 }; },
        raise() { lift(grab.it); } });
    }
    layer = el('g', { class: 'held' });
    svg = el('svg', { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`, class: spec.drag ? 'drags' : '' }, [
      el('line', { class: 'floor', x1: VIEW.x + 12, y1: FLOOR, x2: VIEW.x + VIEW.width - 12, y2: FLOOR }),
      el('path', { class: 'stand', d: `M${PIVOT.x - 7} ${PIVOT.y} L${PIVOT.x + 7} ${PIVOT.y} L${PIVOT.x + 34} ${FLOOR} L${PIVOT.x - 34} ${FLOOR} Z` }),
      dial, beam, el('circle', { class: 'pivot', cx: PIVOT.x, cy: PIVOT.y, r: 7 }), pans.l.g, pans.r.g, ...(tray ? [tray] : []), layer]);
    fig.replaceChildren(svg);
    angle = { t: 0 }; pose(); words();
  }
  const words = () => { const t = tray?.querySelector('.tray-label'); if (t) t.textContent = T('tray'); };

  // pose sets the beam at its turn and each pan at its end, and it lights the dial's mark while the beam is level.
  function pose() {
    beam.setAttribute('transform', `rotate(${-angle.t} ${PIVOT.x} ${PIVOT.y})`);
    for (const s of SIDES) { const p = pan(s, angle.t); pans[s].g.setAttribute('transform', `translate(${p.x} ${p.y})`); }
    dial.classList.toggle('level', Math.abs(angle.t) < 0.25);
  }
  // The beam turns to the weights of eq's two sides.
  function swing(eq, animate = moving()) {
    const t = tilt(A.weight(eq.l, X), A.weight(eq.r, X));
    if (!animate) { angle.t = t; pose(); return; }
    driver.tilt(angle, t, pose);
  }

  // A thing on a pan is a box, a weight, a block with its count, or a balloon on a string tied to the plate.
  function thing(t) {
    const a = el('g', { class: 'a' }), label = el('text', { class: 'label' }), it = { a, label, t, pos: { x: t.x ?? 0, y: t.y ?? 0 } };
    it.g = el('g', { class: `thing ${t.kind}`, 'data-key': t.key }, [a]);
    if (t.balloon) { it.line = el('line', { class: 'string' }); a.append(it.line, el('path', { class: 'knot', d: `M0 ${t.r - 2} l-4 7 h8 z` }), el('circle', { class: 'skin', r: t.r }), label); }
    else { it.body = el('rect', { class: 'body', rx: t.kind === 'unit' ? 3 : 5 }); a.append(it.body, label); }
    dress(it);
    if (spec.drag && t.kind === 'unit') grabbable(it);
    return it;
  }
  function dress(it) {
    const t = it.t, say = t.balloon ? `−${t.label}` : t.label;
    it.label.textContent = say; it.label.classList.toggle('var', t.label === 'x'); // A lone x is set like the x in the equation.
    if (it.body) for (const [k, v] of Object.entries({ x: -t.w / 2, y: -t.h / 2, width: t.w, height: t.h })) it.body.setAttribute(k, v);
  }
  function put(it) {
    it.g.setAttribute('transform', `translate(${it.pos.x} ${it.pos.y})`);
    if (it.line && it.anchor) for (const [k, v] of Object.entries({ x1: 0, y1: it.t.r + 5, x2: it.anchor.x - it.pos.x, y2: it.anchor.y - it.pos.y })) it.line.setAttribute(k, v);
  }
  const unsaid = it => it.label.textContent !== (it.t.balloon ? `−${it.t.label}` : it.t.label);

  // A pan goes over to the things of one side. Things on both slide to their new places, new ones arrive and the
  // others leave. reveal is what the boxes show in place of x.
  function lay(s, side, { reveal, animate = moving() } = {}) {
    const p = pans[s], next = arrange(things(side, s, F(), reveal)), keep = new Set(next.map(t => t.key));
    for (const [k, it] of p.items) if (!keep.has(k)) {
      p.items.delete(k);
      if (!animate) { it.g.remove(); continue; }
      driver.leave(it.a, it.t.balloon, () => it.g.remove());
    }
    for (const t of next) {
      let it = p.items.get(t.key);
      if (!it) {
        it = thing(t); it.anchor = t.anchor; p.items.set(t.key, it); (t.balloon ? p.sky : p.stack).append(it.g); put(it);
        if (animate) driver.arrive(it.a, t.balloon);
        continue;
      }
      const was = it.t; it.t = t; it.anchor = t.anchor;
      if (!animate) { it.a.removeAttribute('style'); dress(it); Object.assign(it.pos, { x: t.x, y: t.y }); put(it); continue; }
      if (unsaid(it) || was.w !== t.w) driver.turn(it.a, () => dress(it));
      if (it.pos.x !== t.x || it.pos.y !== t.y) driver.glide(it.pos, t, () => put(it)); else put(it);
    }
  }
  // The scale shows the last line, or the first line with the value in each box while the check is showing.
  function scene(animate) {
    const v = checking && solved(now()), eq = v ? start : now();
    for (const s of SIDES) lay(s, eq[s], { reveal: v ? F().say(v) : undefined, animate });
    swing(eq, animate);
  }

  // Every action starts here. Motion still running jumps to its end and a held weight is let go, so the action
  // starts from what the model says. The test it returns stays true until the next action.
  function begin() {
    const mine = ++run; busy = false; fx.stop();
    if (grab) { grab.it.g.remove(); grab = null; }
    rows(); scene(false); mark(false); refresh();
    return () => mine === run;
  }
  const end = alive => { if (alive()) busy = false; };

  // A step does the same to both sides. The line shows the step acting on it, the left pan changes and the beam
  // tips, the right pan changes and the beam comes back level, and then the line works out to the new equation.
  async function step(id) {
    const from = now(), n = amount, to = A.apply(from, id, n);
    if (!A.fits(to)) return;
    checking = false;
    const alive = begin(), before = snapshot(last());
    steps.push({ eq: to, op: id, n }); rows();
    if (!moving()) { scene(false); refresh(); return mark(false); }
    busy = true; refresh(false);
    for (const c of grid.querySelector('.balance-row.now').previousElementSibling.children) driver.settle(c);
    driver.enter(last().querySelector('.balance-op'), 120);
    morph(last(), before, A.acting(from, id, n), 200);
    await driver.wait(750); if (!alive()) return;
    lay('l', to.l); swing({ l: to.l, r: from.r });
    await driver.wait(600); if (!alive()) return;
    lay('r', to.r); swing(to);
    await driver.wait(800); if (!alive()) return;
    morph(last(), snapshot(last()), A.line(to));
    await driver.wait(520); if (!alive()) return;
    end(alive); refresh(); mark(true);
  }

  // Undo goes back one step and Start again goes back to the first line. The pans change together, so the beam stays
  // level.
  async function back(all) {
    if (steps.length < 2) return;
    checking = false;
    const alive = begin(), before = snapshot(last());
    steps = all ? steps.slice(0, 1) : steps.slice(0, -1);
    rows(); refresh();
    if (!moving()) { scene(false); return mark(false); }
    busy = true; morph(last(), before, A.line(now(), rel(now()))); scene(true);
    await driver.wait(600); if (!alive()) return;
    mark(false); end(alive);
  }

  // The check puts the value back into the first equation, on the line under the last and in each box on the scale.
  // Pressed again it goes away.
  async function check() {
    if (!checking && !solved(now())) return;
    const alive = begin(), before = snapshot(grid.querySelector('.balance-row.check'));
    checking = !checking; rows(); refresh();
    if (!moving()) { scene(false); return mark(false); }
    busy = true; scene(true); mark(false);
    if (!checking) { ghosts(before); return end(alive); }
    const r = grid.querySelector('.balance-row.check'), v = solved(now());
    fill(r, A.substituted(start, v)); r.querySelectorAll('.balance-tok, .balance-op').forEach((t, i) => driver.enter(t, 60 * i));
    await driver.wait(1300); if (!alive()) return;
    morph(r, snapshot(r), A.checked(start, v), 0);
    await driver.wait(500); end(alive);
  }

  // On a drag page the reader changes one pan at a time, and the line changes in place.
  function retell(was) {
    layerFx.querySelector('.balance-frame')?.remove();
    morph(last(), snapshot(last()), A.line(now(), rel(now())));
    refresh();
    const mine = ++told, r = run;
    busy = true;
    clearTimeout(timer);
    timer = setTimeout(() => { if (mine !== told || r !== run || grab) return; mark(!was && !!solved(now())); busy = false; }, moving() ? 650 : 0);
  }
  const count = s => now()[s].c.n;
  const edit = (s, d) => { const eq = now(); steps[0].eq = { ...eq, [s]: { x: eq[s].x, c: A.q(eq[s].c.n + d) } }; };
  // The panel's steppers put one weight on a pan or take one off.
  function nudge(s, d) {
    if (!d || count(s) + d < 0 || count(s) + d > MOST) return;
    checking = false; begin();
    const was = solved(now());
    edit(s, d); lay(s, now()[s]); swing(now()); retell(was);
  }

  const point = e => svgPoint(svg, e);
  // A weight on a pan can be picked up. The pan is lighter at once and the beam tips.
  function grabbable(it) {
    drag(it.g, { point, move: hold, drop: release,
      start(p) {
        const plate = it.g.closest('.pan');
        if (grab || !plate) return false; // This weight is in the hand or on its way off the pan.
        const s = plate.classList.contains('l') ? 'l' : 'r', key = it.g.dataset.key;
        if (pans[s].items.get(key) !== it) return false;
        const was = solved(now());
        checking = false; begin();
        pans[s].items.delete(key); rekey(s);
        const o = pan(s, angle.t); it.pos = { x: it.pos.x + o.x, y: it.pos.y + o.y };
        edit(s, -1);
        grab = { it, dx: it.pos.x - p.x, dy: it.pos.y - p.y, after: () => { lay(s, now()[s]); swing(now()); retell(was); } };
      },
      raise() { lift(it); grab.after(); } });
  }
  // The held weight moves into the top layer. The kit captures the pointer after this, since a move lets go of it.
  function lift(it) { layer.append(it.g); put(it); it.g.classList.add('drag'); }
  function hold(p) {
    if (!grab) return;
    const it = grab.it;
    it.pos.x = p.x + grab.dx; it.pos.y = p.y + grab.dy; put(it);
    const s = over(it.pos, angle.t);
    for (const k of SIDES) pans[k].g.classList.toggle('drop', k === s && count(k) < MOST);
  }
  // A weight let go over a pan lands on it, anywhere else it goes back into the tray.
  function release() {
    if (!grab) return;
    const it = grab.it, s = over(it.pos, angle.t), was = solved(now());
    grab = null; it.g.classList.remove('drag');
    for (const k of SIDES) pans[k].g.classList.remove('drop');
    if (s && count(s) < MOST) {
      const key = `${s}.c${count(s)}`, o = pan(s, angle.t);
      edit(s, 1); it.t = { ...it.t, key }; it.g.dataset.key = key; it.pos = { x: it.pos.x - o.x, y: it.pos.y - o.y };
      pans[s].items.set(key, it); pans[s].stack.append(it.g); put(it);
      lay(s, now()[s]); swing(now()); retell(was);
      return;
    }
    if (!moving()) { it.g.remove(); return; }
    const home = { x: TRAY.x, y: TRAY.y - TRAY.height / 2 - 8 };
    driver.glide(it.pos, home, () => put(it), 320);
    driver.leave(it.a, false, () => it.g.remove(), 200);
  }
  // The weights left on a pan take the keys 0, 1, 2 ... in the order they stood.
  function rekey(s) {
    const p = pans[s], units = [...p.items].filter(([k]) => /\.c\d+$/.test(k)).sort((a, b) => +a[0].split('.c')[1] - +b[0].split('.c')[1]);
    for (const [k] of units) p.items.delete(k);
    units.forEach(([, it], i) => { const k = `${s}.c${i}`; it.g.dataset.key = k; it.t = { ...it.t, key: k }; p.items.set(k, it); });
  }

  function drawPanel() {
    const f = F(), [lo, hi] = spec.amount.range;
    // A challenge's line stands above the controls. A page without one says Solved beside its buttons and nothing
    // before that.
    goalLine = goalRow({ T, motion: moving() ? fx : null, another: list.length > 1 ? another : null, quiet: !spec.challenge });
    const foot = acts => spec.challenge ? group('acts', acts) : h('div', { class: 'balance-foot' }, [goalLine.el, group('acts', acts)]);
    const head = spec.challenge ? goalLine.el : null;
    const reset = button({ label: T('reset'), act: 'reset', glyph: 'reset', press: () => (spec.drag ? restart() : back(true)) });
    checkBtn = button({ label: T('check'), act: 'check', press: check });
    if (spec.drag) {
      sides = Object.fromEntries(SIDES.map(s => [s, stepper({ id: s === 'l' ? 'left' : 'right', label: T(s === 'l' ? 'left' : 'right'), min: 0, max: MOST, value: count(s), write: v => f.say(A.q(v)), change: v => nudge(s, v - count(s)) })]));
      ops = []; picker = null; undoBtn = null;
      panel.replaceChildren(...[head, group('ctls', [sides.l, sides.r]), foot([reset, checkBtn])].filter(Boolean));
      return;
    }
    // The steps share a caption, and each button sets its step in KaTeX.
    ops = spec.ops.map(id => { const b = button({ label: '', act: `op-${id}`, cls: 'balance-do', press: () => step(id) }); b.dataset.op = id; return b; });
    const both = h('div', { class: 'balance-both', role: 'group', 'aria-label': T('both') }, [h('span', { class: 'hesap-seg-name' }, T('both')), ...ops]);
    picker = stepper({ id: 'amount', label: T('number'), min: lo, max: hi, value: amount, write: v => F().say(A.q(v)), change: v => { amount = v; refresh(!busy); } });
    undoBtn = button({ label: T('undo'), act: 'undo', glyph: 'undo', press: () => back(false) });
    sides = {};
    panel.replaceChildren(...[head, group('ctls', [both, picker]), foot([undoBtn, reset, checkBtn])].filter(Boolean));
  }
  // Another one sets the next equation of the challenge's list, with no steps taken yet.
  async function another() {
    checking = false;
    const alive = begin(), before = snapshot(last());
    which = (which + 1) % list.length; start = A.equation(list[which]); X = A.value(A.solve(start)); steps = [{ eq: start, op: null }];
    goalLine.reset(); rows(); refresh();
    if (!moving()) { scene(false); return mark(false); }
    busy = true; morph(last(), before, A.line(start)); scene(true);
    await driver.wait(700); if (!alive()) return;
    mark(false); end(alive);
  }
  // A drag page starts again with the weights it opened with.
  function restart() {
    checking = false; begin();
    const was = solved(now()); steps = [{ eq: start, op: null }];
    scene(true); retell(was);
  }

  // The panel and the values in the text follow the model. While a step plays, the text keeps the values from before
  // it and the check waits, so neither gives away the result early.
  function refresh(text = true) {
    const f = F(), st = { eq: now(), steps: steps.length - 1, x: X };
    if (text) live(host, { value: id => f.value(st, id) });
    picker?.set(amount);
    for (const b of ops) {
      const id = b.dataset.op;
      tex(b.querySelector('span'), A.said(id, amount));
      b.disabled = !A.fits(A.apply(now(), id, amount));
      b.setAttribute('aria-label', T(`do_${id}`, { n: f.say(A.q(amount)) }));
    }
    for (const s of Object.keys(sides)) sides[s].set(count(s));
    if (undoBtn) undoBtn.disabled = steps.length < 2;
    checkBtn.disabled = (busy && !text) || (!checking && !solved(now())); checkBtn.setAttribute('aria-pressed', checking);
    shade();
  }

  // What a link in the text stands for lights up in the figure while the reader points at it.
  function shade() {
    const r = last(), id = pointed;
    for (const s of SIDES) pans[s].g.classList.toggle('hot', id === (s === 'l' ? 'left' : 'right'));
    for (const c of r?.querySelectorAll('.balance-cell') ?? []) c.classList.toggle('hot', id === 'equation' || id === 'solution' || (id === 'left' && c.matches('.l')) || (id === 'right' && c.matches('.r')));
    grid.classList.toggle('hot', id === 'steps');
    dial.classList.toggle('hot', id === 'scale');
  }

  function stop() { ++run; busy = false; grab = null; clearTimeout(timer); }

  return {
    show(page) {
      stop(); spec = page;
      const st = starts(spec); start = st.eq; X = st.x; steps = [{ eq: start, op: null }]; checking = false;
      list = [spec, ...(spec.challenge?.more ?? [])]; which = 0;
      amount = spec.amount.start ?? spec.amount.range[0];
      lines.classList.toggle('solo', !spec.ops.length);
      build(); drawPanel(); rows(); refresh(); mark(false);
      for (const s of SIDES) lay(s, start[s], { animate: false });
      swing(start, false);
    },
    hide() { stop(); spec = null; },
    point(id, on) { if (!spec) return; pointed = on ? id : null; shade(); },
    lang() { if (!spec) return; drawPanel(); words(); refresh(!busy); mark(false); },
  };
}
