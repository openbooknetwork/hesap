// The add scene: two groups of counters in two ten frames, with the written line of their calculation under them. On
// an addition page the first group is round and red and fills the cells from the first, and the second group is
// square and blue and fills the cells after it. The reader joins waiting counters by drag or tap, sends them back,
// sets a group with a stepper or throws two dice. On a take-away page the reader taps counters away, each leaving a
// dashed ring, or steps the number taken away. Two step lines show how a calculation across ten makes ten first. The
// shelf look sells jars of jam into two crates, and the tray look sows the seeds of a packet in a seed tray. A
// challenge writes its calculation open, and its counters move once the reader's numbers are right.
import { DIE, JARS, opening, counts, lineOf, leftOf, stepsOf, LINES, measuresOf, labelKeys, goalKey } from './add-model.js';
import { ADD_GOALS, addStart } from './add-goals.js';
import { counter, show, put, R } from './counter.js';
import { frames, CELL } from './frame.js';
import { waitTray, die, DIE_SIZE, shelfWays, crate, JAR_HIT, seedTray } from './add-figures.js';
import { carry, press } from './move.js';
import { driver } from './driver.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { stepper, chip, button, segment, row, check } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh, another } from '../../kit/random.js';
import { writtenLine, words, reading, widthOf, SIZE, STEP_SIZE, DASH } from '../../kit/written.js';

const MAX = 1.7; // A figure grows to at most this scale on a wide stage.
const PAD = 14; // The figure keeps this far from the stage's edges, in pixels.
const SPACE = 24; // The gap between the blocks of the figure and the written line.
const LINE = SIZE + 12, STEP_LINE = STEP_SIZE + 10; // The room of a written line and of a step line.
const DIE_ROOM = DIE_SIZE + 14; // The room above the frames and the tray for a die.
const NEAR = 16; // A counter let go this close to the frames joins them.
const JAR_R = 19; // A jar is drawn round this radius.
// The ids of the counters: r for the first group, b for the second and j for a jar.
const firstOf = id => id[0] === 'r';
// line makes a written line with the links that mark it whole.
const line = (whole, options) => Object.assign(writtenLine(options), { whole });
const RED_BLUE = { a: 'counters-a', b: 'counters-b' };

export default function add({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const back = el('g'), layer = el('g', { class: 'counters-layer' }), front = el('g');
  const dies = [die('first'), die('waiting')];
  const svg = el('svg', { class: 'counters-svg' }, [back, layer, front]);
  stage.appendChild(svg);
  // base is the page as written, and spec the page with the steppers a challenge gives it. s holds the ids of the
  // counters of each place: red in the frames, joined in the frames after them, later in the second frame of a split
  // page and tray beside them, the tray or the seed packet. A take-away
  // page holds the ids taken away in taken, and the shelf holds the jars of the morning in red, those of the
  // afternoon in joined and the crate the segment picks. A challenge holds the numbers of its steppers in answer, and
  // play counts the runs of its moving counters, so a change of a stepper stops a run. geo holds the places of the
  // figure as drawn, and lines the written lines of the page.
  let base = null, spec = null, s = null, geo = null, area = { w: 0, h: 0 }, nodes = new Map(), seq = 0, hold = null;
  let chips = [], goal = null, target = null, solved = false, lines = [], play = 0;
  const lit = new Set();

  const int = n => numbers(lang()).int(n);
  const ids = (n, k) => Array.from({ length: n }, () => `${k}${seq++}`);
  // now gives the counts, and whether the figure shows the full ten that a step of making ten needs.
  const now = () => ({ first: s.red.length, second: spec.take ? s.taken.size : s.joined.length + s.later.length, waiting: s.tray.length,
    ten: spec.take ? s.red.slice(10).every(id => s.taken.has(id)) : s.red.length + s.joined.length >= 10 });
  // A page with waiting shows the tray or the packet, and the reader moves its counters unless a challenge moves them.
  const waits = () => spec.waiting != null;
  const moves = () => waits() && !base.challenge;
  const shelf = () => spec.look === 'shelf';
  // A take-away page whose number taken away has no stepper takes taps on its counters.
  const taps = () => spec.take && !spec.secondCtl && !base.challenge;
  const goalOf = () => ADD_GOALS[base.challenge.goal];
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // deal sets the counters as the page opens. A challenge draws its target and takes its steppers from its goal. A
  // take-away page opens with its second number taken from the last cells, and the shelf with the jars sold in the
  // morning and the afternoon in their crates.
  function deal() {
    const c = base.challenge;
    spec = base; seq = 0; hold = null; solved = false;
    if (c) { target = another(ADD_GOALS[c.goal], c, base, dice(fresh()), target); spec = { ...base, ...ADD_GOALS[c.goal].page(target) }; }
    s = { answer: addStart(), checked: false };
    place();
    // The written lines: the line of the calculation, on the shelf the line of the jars left, and with written: ten
    // the two steps of making ten.
    const end = spec.take ? 'left' : 'sum', main = line(['written', 'reading'], { refs: { a: 'first', b: 'second', c: end }, cls: spec.take ? { a: 'counters-a' } : RED_BLUE });
    lines = !spec.written ? [] : shelf() ? [main, line(['written-left', 'reading-left'], { refs: { b: 'sum', c: 'left' } })]
      : spec.written === 'ten' ? [main, line(['written-to-ten', 'reading-to-ten'], { step: true, refs: { a: 'first', b: 'to-ten' }, cls: spec.take ? { a: 'counters-a' } : RED_BLUE }),
        line(['written-rest', 'reading-rest'], { step: true, refs: { b: 'rest', c: end }, cls: spec.take ? {} : { b: 'counters-b' } })]
      : [main];
    front.replaceChildren(...lines.map(l => l.el), ...dies.map(d => d.g));
  }
  // place sets the counters as the page opens, and stops a run of moving counters.
  function place() {
    const o = opening(spec);
    play++;
    Object.assign(s, { red: [], joined: [], later: [], tray: [], taken: new Set(), jars: [], crate: s.crate ?? 'first', dice: spec.dice ? [o.first, o.waiting] : null });
    if (shelf()) { s.jars = ids(JARS, 'j'); s.red = s.jars.slice(0, o.first); s.joined = s.jars.slice(o.first, o.first + o.second); }
    else if (spec.take) { s.red = ids(o.first, 'r'); s.taken = new Set(s.red.slice(s.red.length - o.second)); }
    else Object.assign(s, { red: ids(o.first, 'r'), joined: ids(o.second, 'b'), tray: ids(o.waiting, 'b') });
  }
  const holds = () => base.challenge ? goalOf().holds({ ...s.answer, checked: s.checked }, spec, base.challenge, target) : { done: false };

  // framesLayout tries the frames side by side and one above the other, or the seed tray, with the tray or the seed
  // packet beside them or under them, and keeps the way that fits the stage at the largest scale. Each die stands
  // over its block.
  function framesLayout(fit) {
    const room = spec.dice ? DIE[1] : spec.second + (spec.waiting ?? 0), tray = waits() ? waitTray(room, spec.look === 'tray') : null, dieH = spec.dice ? DIE_ROOM : 0;
    let best = null;
    for (const fw of spec.look === 'tray' ? [seedTray()] : frames(2)) for (const beside of tray ? [true, false] : [null]) {
      let w, h, f, t = null;
      if (beside === null) { w = fw.w; h = dieH + fw.h; f = { x: 0, y: dieH }; }
      else if (beside) { const hh = Math.max(fw.h, tray.h); w = fw.w + SPACE + tray.w; h = dieH + hh; f = { x: 0, y: dieH + (hh - fw.h) / 2 }; t = { x: fw.w + SPACE, y: dieH + (hh - tray.h) / 2 }; }
      else { w = Math.max(fw.w, tray.w); h = dieH + fw.h + SPACE + dieH + tray.h; f = { x: (w - fw.w) / 2, y: dieH }; t = { x: (w - tray.w) / 2, y: dieH + fw.h + SPACE + dieH }; }
      best = fit(best, w, h, dx => {
        const fd = fw.draw(f.x + dx, f.y), td = tray && t ? tray.draw(t.x + dx, t.y) : null, box = { x: f.x + dx, y: f.y, w: fw.w, h: fw.h };
        const over = (x, y, bw) => `translate(${x + bw / 2} ${y - DIE_ROOM + DIE_SIZE / 2})`;
        dies[0].g.setAttribute('transform', over(box.x, box.y, box.w));
        if (td) dies[1].g.setAttribute('transform', over(t.x + dx, t.y, tray.w));
        // A tap on an empty cell joins the next waiting counter, so a phone needs no aim at a single counter. On a
        // split seed tray it sows the seed in the row of that cell.
        const row = i => spec.look === 'tray' && spec.split ? (i < 10 ? 'first' : 'second') : true;
        const targets = moves() ? fd.cells.map((c, i) => { const rect = el('rect', { class: 'counters-cell', x: c.x - CELL / 2, y: c.y - CELL / 2, width: CELL, height: CELL, rx: 4 }); press(rect, () => joinNext(row(i))); return rect; }) : [];
        return { nodes: [...fd.nodes, ...(td ? [td.box] : []), ...targets], cells: fd.cells, frames: box, tray: td, targets };
      });
    }
    return best;
  }
  // shelfLayout sets the shelf above its two crates, which stand side by side or one above the other.
  function shelfLayout(fit) {
    const named = ['first', 'second'].map(k => crate(JARS, T(`add-shelf-${k}`), k));
    let best = null;
    for (const sw of shelfWays(JARS)) for (const k of [0, 1]) for (const beside of [true, false]) {
      const crates = named.map(ways => ways[k]), one = crates[0];
      const cw = beside ? 2 * one.w + SPACE : one.w, ch = beside ? one.h : 2 * one.h + SPACE;
      const w = Math.max(sw.w, cw), h = sw.h + SPACE + ch;
      best = fit(best, w, h, dx => {
        const sd = sw.draw(dx + (w - sw.w) / 2, 0), x0 = dx + (w - cw) / 2, y0 = sw.h + SPACE;
        const cd = crates.map((c, i) => c.draw(beside ? x0 + i * (c.w + SPACE) : x0, beside ? y0 : y0 + i * (c.h + SPACE)));
        // A tap on the shelf sells its last jar, and a tap on a crate puts the crate's last jar back.
        press(sd.area, () => { const id = s.jars.filter(j => !s.red.includes(j) && !s.joined.includes(j)).at(-1); if (id) sell(id); });
        cd.forEach((c, i) => press(c.box, () => { const id = (i ? s.joined : s.red).at(-1); if (id) sell(id); }));
        return { nodes: [...sd.nodes, ...cd.flatMap(c => c.nodes)], shelf: sd.pos, crates: cd, targets: [] };
      });
    }
    return best;
  }

  // build draws the figure to fit the stage, with the written lines under it, and puts every counter in its place.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { geo = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    const room = k => k && spec.written === 'ten' ? STEP_LINE : LINE;
    const lineW = lines.length ? widthOf('00 + 00 = 00') : 0, lineH = lines.length ? SPACE + lines.reduce((sum, l, k) => sum + room(k), 0) : 0;
    // fit keeps the way of setting the figure out that shows it at the largest scale.
    const fit = (best, w, h, draw) => {
      const W = Math.max(w, lineW), H = h + lineH, scale = Math.min((area.w - 2 * PAD) / W, (area.h - 2 * PAD) / H);
      return !best || scale > best.scale + 1e-6 ? { scale, w: W, h: H, top: h, draw: () => draw((W - w) / 2) } : best;
    };
    const L = shelf() ? shelfLayout(fit) : framesLayout(fit), scale = Math.min(MAX, L.scale);
    svg.setAttribute('viewBox', `${L.w / 2 - area.w / 2 / scale} ${L.h / 2 - area.h / 2 / scale} ${area.w / scale} ${area.h / scale}`);
    geo = L.draw();
    back.replaceChildren(...geo.nodes);
    for (const d of dies) d.g.setAttribute('display', spec.dice ? 'inline' : 'none');
    let y = L.top + SPACE;
    lines.forEach((l, k) => { l.at(L.w / 2, y + room(k) / 2 - 6); y += room(k); });
    for (const n of nodes.values()) n.tween?.pause();
    layer.replaceChildren(); nodes = new Map();
    render('jump');
  }

  // where gives the place of every counter. The first group and the joined counters fill the cells in order, and
  // the waiting counters stand in the tray. A counter taken away keeps its cell. A jar on the shelf stands in its
  // own place, and a jar sold stands in its crate in the order it was sold.
  function where() {
    const out = new Map();
    if (shelf()) {
      s.jars.forEach((id, i) => out.set(id, geo.shelf(i)));
      [s.red, s.joined].forEach((list, k) => list.forEach((id, i) => out.set(id, geo.crates[k].pos(i))));
      return out;
    }
    [...s.red, ...s.joined].forEach((id, i) => out.set(id, geo.cells[i]));
    s.later.forEach((id, i) => out.set(id, geo.cells[10 + i]));
    s.tray.forEach((id, i) => out.set(id, geo.tray.pos(i)));
    return out;
  }

  // render moves every counter to its place. After a change the reader made, counters glide, arrive and leave.
  function render(how) {
    solved = holds().done;
    if (!geo) return refresh();
    const to = where(), anim = how === 'move' && moving();
    let k = 0;
    for (const [id, n] of nodes) if (!to.has(id)) {
      nodes.delete(id); n.tween?.pause();
      if (anim) go.vanish(n.pop, () => n.g.remove()); else n.g.remove();
    }
    for (const [id, p] of to) {
      let n = nodes.get(id);
      if (!n) {
        n = make(id); nodes.set(id, n); layer.append(n.g); put(n, p);
        if (anim) go.pop(n.pop, 25 * k++);
        continue;
      }
      if (n === hold || (n.at.x === p.x && n.at.y === p.y)) continue;
      n.tween?.pause();
      if (anim) n.tween = go.tween(n.at, { x: p.x, y: p.y }, () => show(n)); else put(n, p);
    }
    paint(anim); refresh();
  }

  // make draws a counter or a jar. A jar sells and comes back by tap. A counter of a take-away page with taps goes
  // and comes back by tap, and carries the dashed ring it leaves. A counter of the second group on a page with a tray
  // goes between the tray and the frames by drag and by tap.
  function make(id) {
    if (id[0] === 'j') {
      const n = counter('jar', 'plain', JAR_R);
      n.pop.prepend(el('rect', { class: 'counters-hit', x: -JAR_HIT.w / 2, y: -JAR_HIT.h / 2, width: JAR_HIT.w, height: JAR_HIT.h }));
      n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button');
      press(n.g, () => sell(id));
      return n;
    }
    const kinds = spec.look === 'tray' ? ['seedling', 'sprout'] : ['disc', 'square'], n = counter(kinds[firstOf(id) ? 0 : 1], firstOf(id) ? 'a' : 'b');
    // A sprout of the tray is a seed while it lies in the packet.
    if (spec.look === 'tray' && !firstOf(id)) n.pop.append(el('ellipse', { class: 'counters-body counters-seed', rx: 5, ry: 7, transform: 'rotate(20)' }));
    if (spec.take) {
      n.pop.append(el('circle', { class: 'counters-void counters-gone', r: R - 2 }));
      if (taps()) { n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button'); press(n.g, () => takeAway(id)); }
      return n;
    }
    if (firstOf(id) || !moves()) return n;
    n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button');
    n.g.classList.add('counters-moves');
    let dx = 0, dy = 0;
    carry(n.g, {
      point: e => svgPoint(svg, e), raise: () => layer.append(n.g),
      start(q) { n.tween?.pause(); hold = n; dx = n.at.x - q.x; dy = n.at.y - q.y; },
      move(q) { put(n, { x: q.x + dx, y: q.y + dy }); },
      drop(q) { hold = null; if (!q || !moveTo(id, onFrames({ x: q.x + dx, y: q.y + dy }))) render('move'); },
      tap() { hold = null; moveTo(id, s.tray.includes(id)); },
    });
    return n;
  }
  // onFrames says where a counter let go at p lands: 'first' or 'second' for the frame under it on a split page,
  // true for the frames on any other page, and null off the frames.
  const inside = (b, p) => p.x > b.x - NEAR && p.x < b.x + b.w + NEAR && p.y > b.y - NEAR && p.y < b.y + b.h + NEAR;
  function onFrames(p) {
    if (!inside(geo.frames, p)) return null;
    if (!spec.split) return true;
    const box = k => { const cs = geo.cells.slice(10 * k, 10 * k + 10), xs = cs.map(c => c.x), ys = cs.map(c => c.y); return { x: Math.min(...xs) - CELL / 2, y: Math.min(...ys) - CELL / 2, w: Math.max(...xs) - Math.min(...xs) + CELL, h: Math.max(...ys) - Math.min(...ys) + CELL }; };
    const d = k => { const b = box(k); return Math.hypot(p.x - (b.x + b.w / 2), p.y - (b.y + b.h / 2)); };
    return d(0) <= d(1) ? 'first' : 'second';
  }
  // moveTo joins a waiting counter to the frames, where it takes the next empty cell, or sends a joined counter back
  // to the tray. On a split page a counter joins the frame it lands on, and the first frame once it is full passes
  // it on to the second. It says whether the counter moved.
  function moveTo(id, to) {
    const from = [s.tray, s.joined, s.later].find(list => list.includes(id));
    const into = !to ? s.tray : !spec.split || (to !== 'second' && s.red.length + s.joined.length < 10) ? s.joined : s.later;
    if (!from || (to && from !== s.tray) || (!to && from === s.tray)) return false;
    from.splice(from.indexOf(id), 1); into.push(id);
    changed();
    return true;
  }
  // joinNext joins the next waiting counter, in order or into the row given.
  function joinNext(to = true) { const id = s.tray.at(-1); if (id) moveTo(id, to); }
  // takeAway takes a counter away, or puts back the counter of a ring.
  function takeAway(id) {
    if (s.taken.has(id)) s.taken.delete(id); else s.taken.add(id);
    s.checked = false;
    changed();
    if (moving()) go.pop(nodes.get(id)?.pop);
  }
  // sell moves a jar on the shelf into the crate the segment picks, and a jar in a crate back to its place.
  function sell(id) {
    const from = [s.red, s.joined].find(list => list.includes(id));
    if (from) from.splice(from.indexOf(id), 1);
    else (s.crate === 'first' ? s.red : s.joined).push(id);
    changed();
  }

  // roll throws both dice: the first die's counters fill the frames, the second die's wait in the tray, and the
  // counters joined before go.
  function roll() {
    const d = dice(fresh()), a = d.int(...DIE), b = d.int(...DIE);
    s = { ...s, red: ids(a, 'r'), joined: [], tray: ids(b, 'b'), dice: [a, b] };
    changed();
    if (moving()) for (const x of dies) go.pop(x.pop);
  }
  // setGroup sets a number with its stepper. On an addition page it sets a group, and the second group's counters move
  // on or back to stay after the first group's. On a take-away page the first number puts every counter back, and the
  // number taken away takes counters from the last cell back.
  function setGroup(k, v) {
    if (spec.take && k === 'second') s.taken = new Set(s.red.slice(s.red.length - v));
    else {
      const list = k === 'first' ? s.red : s.joined;
      if (list.length < v) list.push(...ids(v - list.length, k === 'first' ? 'r' : 'b'));
      list.length = v;
      if (spec.take) s.taken = new Set();
    }
    s.checked = false;
    changed();
  }
  function changed() { render('move'); }

  // paint turns the dice, writes the lines, opens the empty cells to taps and marks the counters taken away and the
  // jars sold.
  function paint(anim) {
    if (s.dice) dies.forEach((d, k) => d.set(s.dice[k], T('add-die', int(s.dice[k]))));
    const st = now(), steps = stepsOf(spec, st), g = base.challenge && goalOf();
    // A challenge writes its drawn calculation open from the start, and its answer and steps once the goal holds.
    const of = g ? [() => g.line(target, solved), () => solved && g.steps?.(target)[0], () => solved && g.steps?.(target)[1]]
      : [() => lineOf(spec, st), () => shelf() ? leftOf(spec, st) : steps?.lines[0], () => steps?.lines[1]];
    lines.forEach((l, k) => { if (l.set(of[k]() || null, int) && anim) go.flash(l.el); });
    const used = new Set([...where().values()].map(p => geo.cells?.indexOf(p)));
    geo.targets.forEach((t, i) => t.setAttribute('display', !used.has(i) && s.tray.length ? 'inline' : 'none'));
    for (const [id, n] of nodes) {
      if (spec.take) {
        n.g.classList.toggle('counters-taken', s.taken.has(id));
        if (taps()) n.g.setAttribute('aria-label', T(s.taken.has(id) ? 'add-take-ring' : 'add-take-counter'));
      } else if (id[0] === 'j') {
        const k = s.red.includes(id) ? 'first' : s.joined.includes(id) ? 'second' : null;
        n.g.classList.toggle('counters-a', k === 'first'); n.g.classList.toggle('counters-b', k === 'second');
        n.g.setAttribute('aria-label', k ? T('add-sold-jar', T(`add-shelf-${k}`)) : T('add-shelf-jar'));
      } else if (!firstOf(id) && waits()) {
        n.g.classList.toggle('counters-in-packet', spec.look === 'tray' && s.tray.includes(id));
        if (moves()) n.g.setAttribute('aria-label', T(`add-${spec.look === 'tray' ? 'seed' : 'counter'}-${s.tray.includes(id) ? 'waiting' : 'joined'}`));
      }
    }
    light();
  }

  // light marks the counters of each link the reader points at, and the numbers of the written lines.
  const GROUPS = {
    first: () => s.red, second: () => spec.take ? [...s.taken] : s.joined, sum: () => [...s.red, ...s.joined], waiting: () => s.tray,
    left: () => shelf() ? s.jars.filter(id => !s.red.includes(id) && !s.joined.includes(id)) : spec.take ? s.red.filter(id => !s.taken.has(id)) : [],
    // The parts of making ten: on an addition the second group's counters in the first frame and in the second, and
    // on a take away the rings of the second frame and of the first. They light while the steps show.
    'to-ten': () => !stepsOf(spec, now()) ? [] : spec.take ? s.red.slice(10).filter(id => s.taken.has(id)) : [...s.red, ...s.joined].slice(s.red.length, 10),
    rest: () => !stepsOf(spec, now()) ? [] : spec.take ? s.red.slice(0, 10).filter(id => s.taken.has(id)) : [...[...s.red, ...s.joined].slice(10), ...s.later],
  };
  function light() {
    const on = new Set([...lit].flatMap(id => GROUPS[id]?.() ?? []));
    for (const [id, n] of nodes) n.g.classList.toggle('counters-lit', on.has(id));
    for (const d of dies) d.g.classList.toggle('counters-hot', lit.has(d.g.dataset.ref));
    for (const part of back.querySelectorAll('[data-ref]')) part.classList.toggle('counters-hot', lit.has(part.dataset.ref));
  }

  // refresh writes every value that follows the counters, in the readouts and the text, and judges a challenge.
  function refresh() {
    const st = counts(spec, now()), ids = measuresOf(spec);
    const value = id => {
      const line = LINES[id]?.(spec, now());
      if (id in LINES) return !line ? DASH : id.startsWith('written') ? words(line, int) : reading(line, int, T);
      return st[id] == null ? DASH : int(st[id]);
    };
    for (const k of chips) if (k.set(value(k.id)) && moving()) go.flash(k.el);
    live(host, { value: id => ids.includes(id) ? value(id) : null });
    judge();
  }
  // vars gives a challenge's words: its numbers, the reader's numbers and step, and the lines of its done line.
  function vars() {
    const g = goalOf(), a = s.answer, steps = g.steps?.(target);
    return { ...g.words(base.challenge, target, { int }), n: int(a.sum), calc: words(g.line(target, false), int), line: words(g.line(target, true), int),
      step: target.sign ? words({ a: target.a, sign: target.sign, b: a.toTen, open: true }, int) : '', x: int(a.toTen), y: int(a.rest), toTen: steps ? words(steps[0], int) : '', rest: steps ? words(steps[1], int) : '' };
  }
  function judge() {
    if (!goal) return;
    const c = base.challenge, r = holds(), v = vars();
    const key = k => goalKey(k, target, x => T(x) != null);
    goal.say(T(r.done ? `goal-${c.goal}-done` : key(`goal-${c.goal}`), v));
    goal.show(r.done, r.note ? T(key(`note-${c.goal}-${r.note}`), v) : undefined);
  }
  // hint gives the hint of a challenge, which on steps-to-ten differs for an addition and a subtraction.
  const hint = () => T(`hint-${base.challenge.goal}${target.sign ? `-${target.sign === '+' ? 'plus' : 'minus'}` : ''}`, vars());

  // check commits the reader's numbers. Once they are right the counters move: find-sum fills the frames with the
  // first group and then joins the second, and steps-to-ten moves the to-ten counters and then the rest.
  function commit() {
    if (s.checked) return;
    s.checked = true;
    if (!holds().done) return render('move');
    const run = play, g = base.challenge.goal, t = target;
    const first = g === 'find-sum' ? () => { s.red = ids(t.a, 'r'); } : t.sign === '+' ? () => { s.joined.push(...s.tray.splice(-toTen())); } : () => { for (const id of s.red.slice(-toTen())) s.taken.add(id); };
    const then = g === 'find-sum' ? () => { s.joined = ids(t.b, 'b'); } : t.sign === '+' ? () => { s.joined.push(...s.tray.splice(0)); } : () => { for (const id of s.red.slice(10 - (t.b - toTen()), 10).reverse()) s.taken.add(id); };
    first(); render('move');
    const last = () => { if (run !== play || !spec) return; then(); render('move'); if (moving()) go.cheer([...nodes.values()].map(n => n.pop)); };
    if (moving()) setTimeout(last, 650); else last();
  }
  const toTen = () => target.sign === '+' ? 10 - target.a : target.a - 10;
  // setAnswer keeps the number of a challenge's stepper. A change takes the check back and puts the counters as the
  // page opened.
  function setAnswer(k, v) {
    s.answer[k] = v;
    if (s.checked) { s.checked = false; place(); }
    changed();
  }

  // name gives a readout or a stepper its name in the page's context, such as "Taken away" or "Morning".
  const name = id => labelKeys(spec, id).map(k => T(k)).find(Boolean) ?? (id.startsWith('written') ? T('written') : id.startsWith('reading') ? T('written-reading') : T(`add-${id}`));
  // The panel holds a challenge's line, the steppers, the segment of the shelf, Roll and Check, and the readouts. The
  // written lines and their words take a line of the panel each, so the panel keeps its height as they change.
  function drawPanel() {
    const c = base.challenge, ctls = [];
    for (const k of ['first', 'second']) {
      const r = spec[`${k}Ctl`];
      if (r) ctls.push(stepper({ id: k, label: name(k), min: r.lo, max: r.hi, value: now()[k], write: int, change: v => setGroup(k, v) }));
    }
    // A challenge's own steppers: Sum, Makes ten and The rest.
    for (const [id, k] of [['sum', 'sum'], ['to-ten', 'toTen'], ['rest', 'rest']]) {
      const r = spec[`${k}Ctl`];
      if (r) ctls.push(stepper({ id, label: name(id), min: r.lo, max: r.hi, value: s.answer[k], write: int, change: v => setAnswer(k, v) }));
    }
    if (shelf()) ctls.push(segment({ id: 'crate', label: T('add-shelf-crate'), items: ['first', 'second'].map(k => [k, T(`add-shelf-${k}`)]), value: s.crate, pick: v => { s.crate = v; } }));
    if (spec.dice) ctls.push(button({ label: T('add-roll'), act: 'roll', primary: true, press: roll }));
    goal = null;
    if (c) {
      goal = goalRow({ T, motion: moving() ? fx : null, hint: on => on ? hint() : null,
        another: () => { deal(); drawPanel(); build(); if (!geo) refresh(); } });
      ctls.push(check({ T, press: commit }));
    }
    const wide = id => id in LINES;
    chips = spec.readout.map(id => chip({ id, label: name(id), cls: wide(id) ? 'counters-chip-wide' : '' }));
    for (const k of chips) if (!wide(k.id)) k.width(2);
    panel.replaceChildren(...[goal?.el, ctls.length ? row('ctls', ctls) : null, chips.length ? row('out', chips) : null].filter(Boolean));
  }

  function point(id, on) {
    if (!spec) return;
    if (on) lit.add(id); else lit.delete(id);
    for (const l of lines) l.light(id, on, l.whole);
    if (geo) light();
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }
  function stop() { for (const n of nodes.values()) n.tween?.pause(); hold = null; }

  return {
    show(page) {
      stop(); base = page; target = null; lit.clear(); deal();
      drawPanel(); build();
      if (!geo) render('jump');
    },
    hide() {
      stop(); play++; spec = null; base = null; goal = null; geo = null; nodes = new Map(); lines = [];
      for (const g of [back, layer, front]) g.replaceChildren();
    },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); build(); if (!geo) render('jump'); },
  };
}
