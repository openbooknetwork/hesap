// The add scene: two groups of counters in two ten frames, with the written line of their calculation under them. On
// an addition page the first group is round and red and fills the cells from the first, and the second group is
// square and blue and fills the cells after it. The reader joins waiting counters by drag or tap, sends them back,
// sets a group with a stepper or throws two dice. On a take-away page the reader taps counters away, each leaving a
// dashed ring, or steps the number taken away. Two step lines show how a calculation across ten makes ten first. The
// shelf look sells jars of jam into two crates, and the tray look sows the seeds of a packet in a seed tray. A
// challenge writes its calculation open, and its counters move once the reader's numbers are right. A family page
// writes the four facts of its two groups, and a tap on a fact shows it in the counters or the eggs of the egg box.
// The domino covers a half with a card, and its line finds the covered half. A page with a whole shows outlined places
// for the missing part, which taps fill with counters that carry the numbers of the count. The squad seats players on
// its bench the same way, with no places drawn. An undo page joins the counters of the tray and then takes them back,
// with a second line. A claim page writes a sum the reader claims and checks it by taking the second part away.
import { DIE, JARS, CELLS, BENCH, claims, checked, opening, counts, lineOf, leftOf, askOf, backOf, full, fills, stepsOf, LINES, measuresOf, labelKeys, goalKey, family as isFamily, factsListed } from './add-model.js';
import { ADD_GOALS, addStart } from './add-goals.js';
import { counter, show, put, gone, R } from './counter.js';
import { frames, CELL } from './frame.js';
import { waitTray, die, DIE_SIZE, shelfWays, crate, JAR_HIT, seedTray, eggBox, domino, pitch, bench } from './add-figures.js';
import { factsBlock } from './facts.js';
import { carry, press } from './move.js';
import { driver } from './driver.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { stepper, chip, button, segment, row, check } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh, another } from '../../kit/random.js';
import { writtenLine, words, reading, widthOf, SIZE, STEP_SIZE, DASH, FACT_IDS, sameFact, takenBy } from '../../kit/written.js';

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
// The class that colours each number of a line by the group it counts, on the frames and on the eggs.
const PAINT = { first: 'counters-a', second: 'counters-b', missing: 'counters-b' }, EGG_PAINT = { first: 'counters-egg-a', second: 'counters-egg-b' };
// The verdict under a claim's check says whether the sum is right. It keeps its own size on the screen, in pixels: the
// font, a line, and room for two lines, so a narrow stage wraps it and the figure keeps its scale.
const VERDICT_FONT = 17, VERDICT_LINE = 22, VERDICT_ROOM = 2 * VERDICT_LINE + 14;
const FINGER = 44; // A fact is at least this tall on the screen, in pixels, so a finger finds it.
const FACTS_MAX = 1.3; // The facts grow to at most this scale on a wide stage.

export default function add({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const back = el('g'), layer = el('g', { class: 'counters-layer' }), front = el('g');
  const dies = [die('first'), die('waiting')];
  const svg = el('svg', { class: 'counters-svg' }, [back, layer, front]);
  // marks holds the outlined places of the missing part.
  const marks = el('g');
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
  // block is the facts of a family page, and picked the fact the reader tapped.
  let block = null, picked = null, verdict = null, verdictW = 0;
  const lit = new Set();

  const int = n => numbers(lang()).int(n);
  const ids = (n, k) => Array.from({ length: n }, () => `${k}${seq++}`);
  // now gives the counts, and whether the figure shows the full ten that a step of making ten needs.
  const now = () => spec.look === 'domino' ? { first: spec.first, second: spec.second, waiting: 0, ten: false, cover: s.cover, found: s.found }
    : { first: s.red.length, second: spec.take ? s.taken.size : s.joined.length + s.later.length, waiting: s.tray.length,
      ten: spec.take ? s.red.slice(10).every(id => s.taken.has(id)) : s.red.length + s.joined.length >= 10, whole: s.whole, done: s.done, claim: s.claim };
  // A page with waiting shows the tray or the packet, and the reader moves its counters unless a challenge moves them.
  const waits = () => spec.waiting != null;
  const moves = () => waits() && !base.challenge;
  const shelf = () => spec.look === 'shelf';
  const family = () => isFamily(spec);
  // A page with a whole and the missing-part challenge put a counter in on a tap of the frames or the bench, and take
  // the last one out on a tap of a counter put in. A page with a whole numbers them and draws places for them.
  const putting = () => fills(spec) || !!spec.put;
  const squad = () => spec.look === 'squad';
  // The facts of a page that puts counters in show once the places are full, or once a challenge's goal holds. Until
  // then its line asks the subtraction.
  const factsShow = st => !putting() || (fills(spec) ? full(st) : solved);
  // tint gives a line the colours of the groups its numbers count, by the link id of each number.
  const tint = l => {
    if (!l) return l;
    const refs = l.refs ?? { a: 'first', b: 'second', c: 'whole' }, paint = spec.look === 'eggs' ? EGG_PAINT : PAINT;
    return { ...l, refs, cls: Object.fromEntries(Object.entries(refs).filter(([, id]) => paint[id]).map(([r, id]) => [r, paint[id]])) };
  };
  // A take-away page whose number taken away has no stepper takes taps on its counters.
  const taps = () => spec.take && !spec.secondCtl && !base.challenge;
  const goalOf = () => ADD_GOALS[base.challenge.goal];
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // deal sets the counters as the page opens. A challenge draws its target and takes its steppers from its goal. A
  // take-away page opens with its second number taken from the last cells, and the shelf with the jars sold in the
  // morning and the afternoon in their crates.
  function deal() {
    const c = base.challenge;
    spec = base; seq = 0; hold = null; solved = false; picked = null;
    marks.replaceChildren(); // The places of another page or target go.
    if (c) { target = another(ADD_GOALS[c.goal], c, base, dice(fresh()), target); spec = { ...base, ...ADD_GOALS[c.goal].page(target) }; }
    s = { answer: addStart(), checked: false };
    place();
    // The written lines: the line of the calculation, on the shelf the line of the jars left, and with written: ten
    // the two steps of making ten.
    const end = claims(spec) ? 'claim' : spec.take ? 'left' : spec.look === 'domino' ? 'whole' : 'sum';
    const main = putting() ? line(!fills(spec) ? [] : family() ? ['written-minus-first', 'reading-minus-first'] : ['written', 'reading'], { cls: { b: 'counters-a', c: 'counters-b' } })
      : line(['written', 'reading'], { refs: { a: 'first', b: 'second', c: end }, cls: spec.take ? { a: 'counters-a' } : spec.look === 'eggs' ? { a: 'counters-egg-a', b: 'counters-egg-b' } : RED_BLUE });
    block = family() ? factsBlock({ tint, pick }) : null;
    lines = putting() ? (spec.written ? [main] : []) : spec.undo ? [main, line(['written-back', 'reading-back'], { refs: { b: 'back', c: 'left' }, cls: { b: 'counters-b' } })]
      : claims(spec) ? [main, line(['written-back', 'reading-back'], { refs: { a: 'claim', b: 'second' }, cls: { b: 'counters-b' } })]
      : !spec.written || family() ? [] : shelf() ? [main, line(['written-left', 'reading-left'], { refs: { b: 'sum', c: 'left' } })]
      : spec.written === 'ten' ? [main, line(['written-to-ten', 'reading-to-ten'], { step: true, refs: { a: 'first', b: 'to-ten' }, cls: spec.take ? { a: 'counters-a' } : RED_BLUE }),
        line(['written-rest', 'reading-rest'], { step: true, refs: { b: 'rest', c: end }, cls: spec.take ? {} : { b: 'counters-b' } })]
      : [main];
    // A claim page says under its check whether the check gives back the first part.
    // Its group takes the place, since the flash's CSS transform on the text would override a transform attribute.
    verdict = claims(spec) ? el('text', { class: 'counters-verdict' }) : null;
    front.replaceChildren(...lines.map(l => l.el), ...(verdict ? [el('g', {}, [verdict])] : []), ...(block ? [block.el] : []), ...dies.map(d => d.g));
  }
  // place sets the counters as the page opens, and stops a run of moving counters.
  function place() {
    const o = opening(spec);
    play++;
    Object.assign(s, { red: [], joined: [], later: [], tray: [], taken: new Set(), jars: [], crate: s.crate ?? 'first', dice: spec.dice ? [o.first, o.waiting] : null, cover: o.cover, found: o.found, whole: o.whole, done: o.done, claim: o.claim });
    if (shelf()) { s.jars = ids(JARS, 'j'); s.red = s.jars.slice(0, o.first); s.joined = s.jars.slice(o.first, o.first + o.second); }
    else if (spec.take) { s.red = ids(o.first, 'r'); s.taken = new Set(s.red.slice(s.red.length - o.second)); }
    else Object.assign(s, { red: ids(o.first, 'r'), joined: ids(o.second, 'b'), tray: ids(o.waiting, 'b') });
  }
  const holds = () => base.challenge ? goalOf().holds({ ...s.answer, put: s.joined.length, checked: s.checked }, spec, base.challenge, target) : { done: false };

  // framesLayout tries the frames side by side and one above the other, or the seed tray, with the tray or the seed
  // packet beside them or under them, and keeps the way that fits the stage at the largest scale. Each die stands
  // over its block.
  function framesLayout(fit) {
    const room = spec.dice ? DIE[1] : spec.second + (spec.waiting ?? 0), tray = waits() ? waitTray(room, spec.look === 'tray') : null, dieH = spec.dice ? DIE_ROOM : 0;
    let best = null;
    for (const fw of spec.look === 'tray' ? [seedTray()] : spec.look === 'eggs' ? [eggBox()] : frames(2)) for (const beside of tray ? [true, false] : [null]) {
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
        // A tap anywhere on the frames puts the next counter in, so a phone needs no aim at a single place.
        const area = putting() ? el('rect', { class: 'counters-press', x: box.x - 6, y: box.y - 6, width: box.w + 12, height: box.h + 12, rx: 8, tabindex: 0, role: 'button' }) : null;
        if (area) press(area, putNext);
        return { nodes: [...fd.nodes, ...(td ? [td.box] : []), ...targets, ...(area ? [area] : [])], cells: fd.cells, frames: box, tray: td, targets, area };
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

  // squadLayout sets the pitch with the bench beside it or under it, the bench in one row, two rows, or one or two
  // columns, and keeps the way that fits the stage at the largest scale, a row first where two ways tie. A tap on the
  // bench seats the next player.
  function squadLayout(fit) {
    // The bench has room for as many players as it may hold, so its size gives nothing away, and it shows no seats.
    const p = pitch(), n = BENCH;
    let best = null;
    for (const cols of new Set([n, Math.ceil(n / 2), 2, 1])) for (const beside of [true, false]) {
      const b = bench(n, Math.min(cols, n));
      const w = beside ? p.w + SPACE + b.w : Math.max(p.w, b.w), h = beside ? Math.max(p.h, b.h) : p.h + SPACE + b.h;
      best = fit(best, w, h, dx => {
        const pd = p.draw(dx + (beside ? 0 : (w - p.w) / 2), beside ? (h - p.h) / 2 : 0);
        const bd = b.draw(dx + (beside ? p.w + SPACE : (w - b.w) / 2), beside ? (h - b.h) / 2 : p.h + SPACE);
        press(bd.area, putNext);
        return { nodes: [...pd.nodes, ...bd.nodes], spots: pd.spots, seats: bd.seats, area: bd.area, targets: [] };
      });
    }
    return best;
  }

  // dominoLayout sets the domino with its whole above it. A tap on a half covers it, and a tap on the card lifts it.
  function dominoLayout(fit) {
    const d = domino(spec.first, spec.second);
    return fit(null, d.w, d.h, dx => {
      const g = d.draw(dx, 0);
      g.halves.forEach((hf, k) => press(hf.g, () => coverHalf(k ? 'second' : 'first')));
      press(g.card, lift);
      return { nodes: g.nodes, domino: g, targets: [] };
    });
  }

  // build draws the figure to fit the stage, with the written lines or the facts under it, and puts every counter in
  // its place.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { geo = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    const room = k => k && spec.written === 'ten' ? STEP_LINE : LINE;
    // The written lines under the figure. A page that puts counters in writes its subtraction in the room of its facts,
    // which take its place once they show.
    const shared = putting() && !!block;
    const under = () => lines.length && !shared ? [{ w: widthOf('00 + 00 = 00'), h: lines.reduce((sum, l, k) => sum + room(k), 0) }] : [{ w: 0, h: 0 }];
    // The facts under the figure take their size from the stage on their own, so the figure keeps its scale. The
    // block keeps its room while its facts are hidden, so the figure keeps one size.
    const facts = block ? factsSize() : null, factsH = (facts ? facts.h : 0) + (verdict ? VERDICT_ROOM : 0);
    // fit keeps the way of setting the figure out that shows it at the largest scale.
    const fit = (best, w, h, draw) => {
      for (const u of under()) {
        const W = Math.max(w, u.w), H = h + (u.h ? SPACE + u.h : 0), scale = Math.min((area.w - 2 * PAD) / W, (area.h - 2 * PAD - factsH) / H);
        if (!best || scale > best.scale + 1e-6) best = { scale, w: W, h: H, top: h, u, draw: () => draw((W - w) / 2) };
      }
      return best;
    };
    const L = shelf() ? shelfLayout(fit) : spec.look === 'domino' ? dominoLayout(fit) : squad() ? squadLayout(fit) : framesLayout(fit);
    const scale = Math.min(MAX, L.scale), H = L.h + factsH / scale;
    svg.setAttribute('viewBox', `${L.w / 2 - area.w / 2 / scale} ${H / 2 - area.h / 2 / scale} ${area.w / scale} ${area.h / scale}`);
    geo = L.draw();
    back.replaceChildren(...geo.nodes, marks);
    for (const d of dies) d.g.setAttribute('display', spec.dice ? 'inline' : 'none');
    let y = L.top + SPACE;
    if (facts) {
      block.el.setAttribute('transform', `translate(${L.w / 2 - facts.w / 2 / scale} ${L.h + SPACE / scale}) scale(${facts.k / scale})`);
      block.at(0, 0, 2, facts.row);
    }
    if (shared) lines.forEach(l => l.at(L.w / 2, L.h + factsH / 2 / scale - 6));
    else lines.forEach((l, k) => { l.at(L.w / 2, y + room(k) / 2 - 6); y += room(k); });
    if (verdict) {
      verdict.parentNode.setAttribute('transform', `translate(${L.w / 2} ${L.h + VERDICT_LINE / scale}) scale(${1 / scale})`);
      verdictW = area.w - 2 * PAD; delete verdict.dataset.words; // The verdict wraps again for the new width.
    }
    for (const n of nodes.values()) n.tween?.pause();
    layer.replaceChildren(); nodes = new Map();
    render('jump');
  }

  // factsSize gives the facts' own scale, as wide as the stage allows and at most FACTS_MAX, the height of a row,
  // tall enough for a finger at that scale, and the room the block takes under the figure, in pixels.
  function factsSize() {
    let row = LINE, k = 1, way = null;
    for (let i = 0; i < 4; i++) { way = block.ways(row)[0]; k = Math.min(FACTS_MAX, (area.w - 2 * PAD) / way.w); if (row * k >= FINGER - 0.5) break; row = FINGER / k; }
    way = block.ways(row)[0];
    return { k, row, w: way.w * k, h: SPACE + way.h * k };
  }

  // where gives the place of every counter. The first group and the joined counters fill the cells in order, and
  // the waiting counters stand in the tray. A counter taken away keeps its cell. A jar on the shelf stands in its
  // own place, and a jar sold stands in its crate in the order it was sold.
  function where() {
    const out = new Map();
    if (spec.look === 'domino') return out;
    if (squad()) {
      s.red.forEach((id, i) => out.set(id, geo.spots[i]));
      s.joined.forEach((id, i) => out.set(id, geo.seats[i]));
      return out;
    }
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
    const kinds = spec.look === 'tray' ? ['seedling', 'sprout'] : spec.look === 'eggs' ? ['egg-brown', 'egg-white'] : squad() ? ['shirt', 'shirt'] : ['disc', 'square'];
    const kind = kinds[firstOf(id) ? 0 : 1], n = counter(kind, firstOf(id) ? 'a' : 'b');
    // A counter of a family page leaves a dashed outline while a picked subtraction takes its group away.
    if (family()) n.pop.append(gone(kind));
    // A counter put in carries the number the count reaches, and a player on the squad wears it on the shirt. The red
    // counters let a tap through to the frames under them, and every player lets a tap through to the bench, so each tap
    // on the bench seats the next player.
    if (putting()) {
      if (squad() || (fills(spec) && !firstOf(id))) { n.pop.append(el('text', { class: 'counters-num' })); n.g.classList.add('counters-numbered'); }
      if (firstOf(id) || squad()) { n.g.classList.add('counters-still'); return n; }
      n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button');
      press(n.g, takeLast);
      return n;
    }
    // A sprout of the tray is a seed while it lies in the packet.
    if (spec.look === 'tray' && !firstOf(id)) n.pop.append(el('ellipse', { class: 'counters-body counters-seed', rx: 5, ry: 7, transform: 'rotate(20)' }));
    if (spec.take) {
      n.pop.append(gone(kind));
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
    if (spec.undo && !s.tray.length) s.done = true;
    changed();
    return true;
  }
  // joinNext joins the next waiting counter, in order or into the row given.
  function joinNext(to = true) { const id = s.tray.at(-1); if (id) moveTo(id, to); }
  // putNext puts a counter in the next place, or in the next cell on a challenge. takeLast takes the last one out, and a
  // key that took it moves on to the counter before it, or to the frames once none is left.
  function putNext() {
    if (s.joined.length >= (fills(spec) ? s.whole - s.red.length : CELLS - s.red.length)) return;
    s.joined.push(...ids(1, 'b'));
    s.checked = false; picked = null;
    changed();
  }
  function takeLast() {
    if (!s.joined.length) return;
    const keys = document.activeElement?.closest?.('.counters-counter');
    s.joined.pop();
    s.checked = false; picked = null;
    changed();
    if (keys) (nodes.get(s.joined.at(-1))?.g ?? geo?.area)?.focus();
  }
  // setWhole steps the whole, which empties the places.
  function setWhole(v) {
    s.whole = v; s.joined.length = 0; picked = null;
    changed();
  }
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
    picked = null;
    if (spec.take && k === 'second') s.taken = new Set(s.red.slice(s.red.length - v));
    else {
      const list = k === 'first' ? s.red : s.joined;
      if (list.length < v) list.push(...ids(v - list.length, k === 'first' ? 'r' : 'b'));
      list.length = v;
      if (spec.take) s.taken = new Set();
      if (fills(spec)) s.joined.length = 0;
    }
    s.checked = false;
    changed();
  }
  // pick picks a fact, or lets it go when it is picked already.
  function pick(id) {
    picked = picked === id ? null : id;
    if (geo) paint(false);
  }
  // coverHalf covers a half of the domino, and the line turns into the calculation that finds it. lift takes the card
  // off, and the line takes its answer. A key that covered a half moves on to the card, and back when it lifts.
  function coverHalf(k) {
    const keys = document.activeElement?.closest?.('.counters-half');
    s.cover = k; s.found = k;
    changed();
    if (keys) geo?.domino.card.focus();
  }
  function lift() {
    const keys = document.activeElement?.closest?.('.counters-domino-card'), k = s.cover;
    s.cover = null;
    changed();
    if (keys && k) geo?.domino.halves[k === 'first' ? 0 : 1].g.focus();
  }
  function changed() { render('move'); }

  // paint turns the dice, writes the lines, opens the empty cells to taps and marks the counters taken away and the
  // jars sold.
  function paint(anim) {
    if (s.dice) dies.forEach((d, k) => d.set(s.dice[k], T('add-die', int(s.dice[k]))));
    const st = now(), steps = stepsOf(spec, st), g = base.challenge && goalOf();
    // A challenge writes its drawn calculation open from the start, and its answer and steps once the goal holds.
    const of = g ? [() => g.line(target, solved), () => solved && g.steps?.(target)[0], () => solved && g.steps?.(target)[1]]
      : [() => spec.look === 'domino' ? tint(lineOf(spec, st)) : fills(spec) ? tint(askOf(spec, st)) : lineOf(spec, st), () => shelf() ? leftOf(spec, st) : spec.undo || claims(spec) ? backOf(spec, st) : steps?.lines[0], () => steps?.lines[1]];
    const facts = factsShow(st);
    lines.forEach((l, k) => { if (l.set((block && facts ? null : of[k]()) || null, int) && anim) go.flash(l.el); });
    if (block) {
      block.el.setAttribute('display', facts ? 'inline' : 'none');
      for (const changed of block.set({ first: st.first, second: st.second, listed: factsListed(spec), int, T, picked })) if (anim && facts) go.flash(changed);
    }
    if (putting()) paintPut(st);
    if (verdict) {
      const right = checked(st), words = T(right ? 'add-claim-right' : 'add-claim-wrong', { back: int(st.claim - st.second), first: int(st.first) });
      if (verdict.dataset.words !== words) { verdict.dataset.words = words; wrap(verdict, words); if (anim) go.flash(verdict); }
      verdict.classList.toggle('counters-verdict-right', right);
    }
    if (geo.domino) paintDomino(st);
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

  // wrap writes a sentence in lines no wider than the stage, at about 0.55 of the font a letter.
  function wrap(text, words) {
    const most = Math.max(10, Math.floor(verdictW / (VERDICT_FONT * 0.55))), rows = [''];
    for (const w of words.split(' ')) {
      if (rows.at(-1) && `${rows.at(-1)} ${w}`.length > most) rows.push(w);
      else rows[rows.length - 1] = rows.at(-1) ? `${rows.at(-1)} ${w}` : w;
    }
    text.replaceChildren(...rows.map((r, k) => { const t = el('tspan', { x: 0, dy: k ? VERDICT_LINE : 0 }); t.textContent = r; return t; }));
  }

  // paintPut draws the places of the missing part still empty, numbers the counters and names what a tap does.
  function paintPut(st) {
    const slots = !fills(spec) || squad() ? [] : geo.cells.slice(st.first + st.second, st.whole), side = squad() ? 36 : R * 1.8;
    marks.replaceChildren(...slots.map(p => el('rect', { class: 'counters-gap-place', x: p.x - side / 2, y: p.y - side / 2, width: side, height: side, rx: 5 })));
    geo.area.setAttribute('aria-label', T(squad() ? 'add-squad-put' : fills(spec) ? 'add-whole-put' : 'add-put'));
    for (const [id, n] of nodes) {
      const k = firstOf(id) ? s.red.indexOf(id) + 1 : st.first + s.joined.indexOf(id) + 1, num = n.pop.querySelector('.counters-num');
      if (num) num.textContent = int(k);
      if (squad()) { n.g.setAttribute('role', 'img'); n.g.setAttribute('aria-label', T(firstOf(id) ? 'add-squad-player' : 'add-squad-bench', int(k))); }
      else if (!firstOf(id)) n.g.setAttribute('aria-label', fills(spec) ? T('add-whole-out', int(k)) : T('add-out'));
    }
  }

  // paintDomino writes the whole above the domino, names each half and puts the card on the covered half.
  function paintDomino(st) {
    const d = geo.domino;
    d.whole.textContent = int(st.first + st.second);
    d.halves.forEach((hf, k) => hf.g.setAttribute('aria-label', T('add-domino-cover', int(k ? st.second : st.first))));
    d.card.setAttribute('display', s.cover ? 'inline' : 'none');
    d.card.setAttribute('aria-label', T('add-domino-lift'));
    if (s.cover) { const hf = d.halves[s.cover === 'first' ? 0 : 1]; d.card.setAttribute('transform', `translate(${hf.x} ${hf.y})`); }
  }

  // light marks the counters of each link the reader points at, and the numbers of the written lines.
  const GROUPS = {
    first: () => s.red, second: () => spec.take ? [...s.taken] : s.joined, sum: () => [...s.red, ...s.joined], whole: () => [...s.red, ...s.joined], waiting: () => s.tray,
    left: () => shelf() ? s.jars.filter(id => !s.red.includes(id) && !s.joined.includes(id)) : spec.take ? s.red.filter(id => !s.taken.has(id)) : spec.undo && s.done ? [...s.red, ...s.joined] : [],
    missing: () => s.joined, back: () => spec.undo && s.done ? s.tray : [],
    // The parts of making ten: on an addition the second group's counters in the first frame and in the second, and
    // on a take away the rings of the second frame and of the first. They light while the steps show.
    'to-ten': () => !stepsOf(spec, now()) ? [] : spec.take ? s.red.slice(10).filter(id => s.taken.has(id)) : [...s.red, ...s.joined].slice(s.red.length, 10),
    rest: () => !stepsOf(spec, now()) ? [] : spec.take ? s.red.slice(0, 10).filter(id => s.taken.has(id)) : [...[...s.red, ...s.joined].slice(10), ...s.later],
  };
  // shown gives the fact the figure shows: the fact of a link the reader points at, else the fact picked. With two
  // equal parts a link to the second of two equal facts shows the first.
  function shown() {
    const pointed = [...lit].filter(id => FACT_IDS.includes(id)).at(-1);
    return pointed ? sameFact(pointed, s.red.length, fills(spec) ? s.whole - s.red.length : s.joined.length) : picked;
  }
  function light() {
    const on = new Set([...lit].flatMap(id => GROUPS[id]?.() ?? [])), f = family() ? shown() : null, away = f && takenBy(f);
    // A fact shows in the counters: an addition lights them all, and a subtraction takes its part away and lights
    // the part left.
    const taken = new Set(away ? GROUPS[away]() : []);
    if (f) for (const id of away ? GROUPS[away === 'first' ? 'second' : 'first']() : GROUPS.whole()) on.add(id);
    for (const [id, n] of nodes) {
      n.g.classList.toggle('counters-lit', on.has(id));
      if (family()) n.g.classList.toggle('counters-taken', taken.has(id));
    }
    // The places stand for the counters of the missing part not put in yet, and light with them.
    const places = lit.has('missing') || lit.has('whole') || (!!f && away !== 'second');
    for (const p of marks.children) p.classList.toggle('counters-hot', places);
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
    return { ...g.words(base.challenge, target, { int }), n: int(a.sum), put: int(s.joined.length), made: int(s.red.length + s.joined.length), calc: words(g.line(target, false), int), line: words(g.line(target, true), int),
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
    if (base.challenge.goal === 'missing-part') {
      render('move');
      if (moving()) go.cheer([...nodes.values()].map(n => n.pop));
      return;
    }
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
    if (spec.claimCtl) ctls.push(stepper({ id: 'claim', label: name('claim'), min: spec.claimCtl.lo, max: spec.claimCtl.hi, value: s.claim, write: int, change: v => { s.claim = v; changed(); } }));
    if (spec.wholeCtl) ctls.push(stepper({ id: 'whole', label: name('whole'), min: spec.wholeCtl.lo, max: spec.wholeCtl.hi, value: s.whole, write: int, change: setWhole }));
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
    block?.light(id, on);
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
      stop(); play++; spec = null; base = null; goal = null; geo = null; nodes = new Map(); lines = []; block = null; picked = null;
      for (const g of [back, layer, front]) g.replaceChildren();
    },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); build(); if (!geo) render('jump'); },
  };
}
