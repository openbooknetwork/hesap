// The bar scene: a bar model across the stage, a long bar for the whole split into two parts drawn to scale, the
// first part red on the left and the second part blue on the right. The whole's number stands above the bar over a
// bracket, and each part's number in its part. The reader drags the split or the end in whole steps, covers a number
// with a card, or taps a fact of the family under the bar. The chocolate look breaks a bar of chocolate at the split.
// A challenge draws a fact or two numbers, and the reader sets the bar that holds them.
import { opening, counts, lineOf, LINES, measuresOf, readable, labelKeys, factsListed, family as isFamily, WHOLE } from './bar-model.js';
import { BAR_GOALS, barStart, partsOf, thirdOf, USES } from './bar-goals.js';
import { counter, put } from './counter.js';
import { press } from './move.js';
import { driver } from './driver.js';
import { factsBlock } from './facts.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { drag, nudge } from '../../kit/drag.js';
import { chip, row, check, segment, stepper } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh, another } from '../../kit/random.js';
import { writtenLine, words, reading, SIZE, DASH, FACT_IDS, sameFact, takenBy } from '../../kit/written.js';

const PAD = 14; // The figure keeps this far from the stage's edges, in pixels.
const UNIT_MAX = 48; // A 1 of the bar is at most this long, in pixels.
const FINGER = 44; // A handle, a number to cover and a fact are at least this big, in pixels.
const WHOLE_ROOM = 58; // The room of the whole's number and its bracket above the bar.
const UNDER = 34; // The room under the bar for a number too wide for its part.
const SPACE = 22; // The gap between the bar and the line or the facts under it.
const LINE = SIZE + 12; // The room of a written line.
const BREAK = 8; // The gap between the two pieces of a bar of chocolate.
const DIGIT = 15; // A digit of a part's number is about this wide.
const PAINT = { first: 'counters-a', second: 'counters-b' };
const TWO_UNITS = 14; // The bar of bar-for-two is this many 1s long, as its lengths stand for no count.
const txt = (cls, attrs = {}) => el('text', { class: cls, ...attrs });

export default function bar({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const back = el('g'), row_ = el('g', { class: 'counters-bar-row' }), front = el('g');
  const svg = el('svg', { class: 'counters-svg' }, [back, row_, front]);
  stage.appendChild(svg);
  // base is the page as written, and spec the page with the bar a challenge gives it. s holds the bar: its whole, its
  // first part, the number under the card, the number the line finds and whether the reader pressed Check. geo holds
  // the figure as drawn, and dots the counters over the bar.
  let base = null, spec = null, s = null, geo = null, area = { w: 0, h: 0 }, target = null, goal = null, chips = [];
  let block = null, line = null, picked = null, solved = false, dots = [], useSeg = null;
  const lit = new Set();

  const int = n => numbers(lang()).int(n);
  const second = () => s.whole - s.first;
  const drags = h => spec.drag?.includes(h);
  const family = () => isFamily(spec);
  const choc = () => spec.look === 'chocolate';
  const g = () => base.challenge && BAR_GOALS[base.challenge.goal];
  // two says that the page is a bar-for-two challenge, whose bar shows the drawn numbers and a third number.
  const two = () => base.challenge?.goal === 'bar-for-two';
  // The range the end runs over, which the page may narrow.
  const ends = () => spec.end ?? WHOLE;
  // A change of the stage's size during a drag waits for the drag to end, so the figure stays under the finger.
  let held = false, waiting = false;
  const resized = () => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); };
  new ResizeObserver(() => { if (held) waiting = true; else resized(); }).observe(svg);

  // tint gives a line the colours of the parts its numbers count, by the link id of each number. A challenge writes its
  // drawn fact in ink until the goal holds, since the colours would tell which number is the whole.
  const tint = l => {
    const refs = l.refs ?? { a: 'first', b: 'second', c: 'whole' };
    if (g() && !solved) return { ...l, refs, cls: {} };
    return { ...l, refs, cls: Object.fromEntries(Object.entries(refs).filter(([, id]) => PAINT[id]).map(([r, id]) => [r, PAINT[id]])) };
  };

  // deal sets the bar as the page opens. A challenge draws its target and opens on the goal's bar.
  function deal() {
    const c = base.challenge;
    spec = base; picked = null; solved = false;
    if (c) { target = another(BAR_GOALS[c.goal], c, base, dice(fresh()), target); spec = { ...base, ...BAR_GOALS[c.goal].page(target) }; }
    s = { ...opening(spec), ...(c ? barStart(target) : {}), checked: false };
    s.want = s.first; // The first part the reader set.
    block = family() ? factsBlock({ tint, pick }) : null;
    line = spec.written === true ? Object.assign(writtenLine(), { whole: ['written', 'reading'] }) : null;
  }
  const holds = () => g() ? g().holds({ ...s }, spec, base.challenge, target) : { done: false };

  // build draws the figure to fit the stage. Every 1 has the same length: the end's farthest place fills the width on
  // a page whose end drags, and the whole on any other page.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { geo = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    const units = two() ? TWO_UNITS : drags('end') ? ends()[1] : s.whole, endRoom = drags('end') ? FINGER : 0, gap = choc() ? BREAK : 0;
    const u = Math.min(UNIT_MAX, (area.w - 2 * PAD - endRoom - gap) / units);
    const barH = choc() ? Math.max(40, Math.min(u, 56)) : Math.max(44, Math.min(64, u * 1.4));
    const dotR = Math.min(16, u * 0.42), dotRoom = spec.counters ? 2 * dotR + 14 : 0;
    // The block under the bar: the facts in two rows of two as wide as the stage allows, each row tall enough for a
    // finger, or the line.
    let blockAt = null;
    if (block) {
      const room = area.w - 2 * PAD;
      let rowH = LINE, k = 1, way = null;
      for (let i = 0; i < 4; i++) { way = block.ways(rowH)[0]; k = Math.min(1.3, room / way.w); if (rowH * k >= FINGER - 0.5) break; rowH = FINGER / k; }
      blockAt = { k, way: block.ways(rowH)[0], rowH };
    }
    // plan sets the figure out from the top, with its gaps narrowed on a short stage. A stage still too short for it,
    // such as a phone's with the text card open and a hint in the panel, takes the whole figure at a smaller scale.
    const plan = tight => {
      const wholeRoom = tight ? 48 : WHOLE_ROOM, under = (drags('split') ? FINGER : 0) + (tight ? UNDER - 8 : UNDER), space = tight ? 10 : SPACE;
      const top = wholeRoom + dotRoom, figH = top + barH + under, below = block ? space + blockAt.way.h * blockAt.k : line ? space + LINE : 0;
      return { wholeRoom, top, figH, space, pad: tight ? 6 : PAD, H: figH + below };
    };
    let p = plan(false);
    if (p.H > area.h - 2 * p.pad) p = plan(true);
    const f = Math.min(1, (area.h - 2 * p.pad) / p.H), vw = area.w / f, vh = area.h / f;
    svg.setAttribute('viewBox', `${(area.w - vw) / 2} 0 ${vw} ${vh}`);
    const { wholeRoom, top, figH, space } = p;
    const y0 = Math.max(p.pad, (vh - p.H) / 2), x0 = (area.w - (units * u + endRoom + gap)) / 2;
    geo = { u, x0, y0, barTop: y0 + top, barH, dotR, dotY: y0 + wholeRoom + dotR + 4, wholeY: y0 + wholeRoom * 0.31, bracketY: y0 + wholeRoom * 0.69,
      underY: y0 + top + barH + (drags('split') ? FINGER : 0) + (figH - top - barH - (drags('split') ? FINGER : 0)) / 2 + 2, gap,
      // A handle's touch area is a finger wide on the screen at any scale the figure takes, while its knob keeps the
      // figure's scale.
      hit: FINGER / f };
    draw();
    const below = y0 + figH + space;
    if (block) {
      const k = blockAt.k, w = blockAt.way.w * k;
      block.el.setAttribute('transform', `translate(${(area.w - w) / 2} ${below}) scale(${k})`);
      block.at(0, 0, blockAt.way.cols, blockAt.rowH);
    }
    if (line) line.at(area.w / 2, below + LINE / 2 - 6);
    render('jump');
  }

  // draw makes the nodes of the figure once per build, so a drag moves them and keeps the pointer it captured.
  function draw() {
    const part = k => {
      const rect = el('rect', { class: `counters-bar-part${choc() ? ' counters-choc' : ''}`, 'data-ref': k, rx: choc() ? 4 : 0 }), grooves = el('g', { class: 'counters-choc-grooves' });
      const num = txt('counters-bar-num', { 'data-ref': k }), lead = el('line', { class: 'counters-bar-lead' }), badge = el('circle', { class: 'counters-choc-badge', r: 15 });
      return { k, g: el('g', { class: `counters-bar-piece ${PAINT[k]}` }, [rect, grooves, lead, ...(choc() ? [badge] : []), num]), rect, grooves, num, lead, badge };
    };
    const parts = { first: part('first'), second: part('second') };
    const outline = el('rect', { class: 'counters-bar-outline', 'data-ref': 'whole' }), split = el('line', { class: 'counters-bar-split' });
    const bracket = el('path', { class: 'counters-bracket', 'data-ref': 'whole' }), whole = txt('counters-bar-whole', { 'data-ref': 'whole' });
    back.replaceChildren(bracket, whole, parts.first.g, parts.second.g, ...(choc() ? [] : [outline, split]));
    // A card covers one number. Each number is a button on a cover page, and the card lifts with a tap.
    const taps = Object.fromEntries((spec.cover ? ['whole', 'first', 'second'] : []).map(k => {
      const hit = el('rect', { class: 'counters-bar-tap', role: 'button', tabindex: 0, rx: 8 });
      press(hit, () => coverNumber(k));
      return [k, hit];
    }));
    const card = el('g', { class: 'counters-bar-card', role: 'button', tabindex: 0, display: 'none' }, [el('rect', { class: 'counters-bar-card-box', rx: 8 }), txt('counters-bar-card-q', {})]);
    card.lastChild.textContent = '?';
    press(card, lift);
    const handles = {};
    for (const h of spec.drag ?? []) handles[h] = handle(h);
    front.replaceChildren(...Object.values(taps), card, ...Object.values(handles).map(x => x.g), ...(line ? [line.el] : []), ...(block ? [block.el] : []));
    row_.replaceChildren(); dots = [];
    Object.assign(geo, { parts, outline, split, bracket, whole, taps, card, handles });
  }

  // handle makes the split's handle under the bar or the end's handle right of it. A drag moves it in whole steps,
  // and a focused handle moves one step on each arrow key.
  function handle(h) {
    const hit = el('rect', { class: 'counters-handle-hit' });
    const knob = h === 'split' ? el('path', { class: 'counters-knob' }) : el('rect', { class: 'counters-knob', rx: 6 });
    const grip = el('path', { class: 'counters-grip' });
    const node = el('g', { class: 'counters-handle', role: 'slider', tabindex: 0, 'aria-orientation': 'horizontal', 'data-ref': h }, [hit, knob, grip]);
    let dx = 0;
    const at = p => Math.round((p.x + dx - geo.x0) / geo.u);
    drag(node, {
      point: e => svgPoint(svg, e),
      start(p) { held = true; dx = (h === 'split' ? splitX() : endX()) - p.x; },
      move(p) { step(h, at(p)); },
      drop() { held = false; render('jump'); if (waiting) { waiting = false; resized(); } },
    });
    nudge(node, { step: (x, y) => step(h, (h === 'split' ? s.first : s.whole) + (x || -y)) });
    return { g: node, hit, knob, grip };
  }
  // step moves the split to a first part of n, or the end to a whole of n. The end pushes the split along, so each
  // part keeps 1 at least, and the split goes back to where the reader set it as the end grows again. A move takes
  // back a check and lets a picked fact go.
  function step(h, n) {
    const was = [s.whole, s.first];
    if (h === 'split') s.want = s.first = Math.max(1, Math.min(s.whole - 1, n));
    else { s.whole = Math.max(ends()[0], Math.min(ends()[1], n)); s.first = Math.min(s.want, s.whole - 1); }
    if (was[0] === s.whole && was[1] === s.first) return;
    picked = null; s.checked = false;
    render('move');
  }
  const splitX = () => geo.x0 + s.first * geo.u;
  const endX = () => geo.x0 + s.whole * geo.u + geo.gap;
  // shape gives the numbers of the bar, the number that carries a question mark, and the length of each part. The
  // bar of bar-for-two holds the two drawn numbers where the segment puts them and the third number with a question
  // mark until the goal holds. As two parts, the known parts are to scale under the whole. As the whole and a part,
  // the bar is a sketch with the known part and the missing part half and half, since a missing part to scale would
  // give its number by eye. Once the goal holds the reader's family is drawn to scale.
  function shape() {
    if (!two()) return { n: { whole: s.whole, first: s.first, second: second() }, unknown: null, len: { first: s.first * geo.u, second: second() * geo.u } };
    const n = partsOf(target, s.use, s.third), w = TWO_UNITS * geo.u, unknown = solved ? null : s.use === 'parts' ? 'whole' : 'second';
    const real = partsOf(target, s.use, thirdOf(target, s.use)), share = unknown === 'second' ? 0.5 : real.first / (real.first + real.second);
    return { n, unknown, len: { first: w * share, second: w * (1 - share) } };
  }

  // coverNumber puts the card on a number of the bar, and the line turns into the calculation that finds it. lift
  // takes the card off, and the line takes its answer. A key that covered a number moves on to the card.
  function coverNumber(k) {
    const keys = document.activeElement?.classList?.contains('counters-bar-tap');
    s.cover = k; s.found = k;
    render('move');
    if (keys) geo?.card.focus();
  }
  function lift() {
    const keys = document.activeElement === geo?.card, k = s.cover;
    s.cover = null;
    render('move');
    if (keys && k) geo.taps[k]?.focus();
  }
  // pick picks a fact, or lets it go when it is picked already. A challenge's facts take taps once the goal holds.
  function pick(id) {
    if (g() && !solved) return;
    picked = picked === id ? null : id;
    if (geo) render('jump');
  }

  // render puts the bar, its numbers, the counters, the handles and the card where s says, and writes the lines.
  function render(how) {
    const r = holds();
    solved = r.done;
    // A third number that makes the family in the other use solves the goal too, and the segment moves to that use.
    if (r.use && r.use !== s.use) { s.use = r.use; useSeg?.set(r.use); }
    if (!geo) return refresh();
    const anim = how === 'move' && moving(), { u, x0, barTop, barH } = geo, { n, unknown, len } = shape();
    const sx = x0 + len.first, ex = sx + geo.gap + len.second;
    const span = { first: [x0, sx], second: [sx + geo.gap, ex] };
    // A number with a question mark shows the mark, and its part or its bracket is dashed.
    const label = k => s.cover === k ? '' : unknown === k ? '?' : int(n[k]);
    for (const k of ['first', 'second']) geo.parts[k].g.classList.toggle('counters-bar-unknown', unknown === k);
    geo.bracket.classList.toggle('counters-bracket-unknown', unknown === 'whole');
    // The bracket and the whole above the bar.
    const by = geo.bracketY;
    geo.bracket.setAttribute('d', `M ${x0} ${by + 8} V ${by} H ${ex} V ${by + 8} M ${(x0 + ex) / 2} ${by} V ${by - 6}`);
    place(geo.whole, (x0 + ex) / 2, geo.wholeY, label('whole'));
    // Each part: its rect, the grooves of a piece of chocolate, and its number inside it or under it with a line.
    const spots = { whole: { x: (x0 + ex) / 2, y: geo.wholeY } }, room = {}, mid = {};
    for (const k of ['first', 'second']) {
      const [a, b] = span[k], w = b - a;
      room[k] = Math.max(FINGER, String(n[k]).length * DIGIT + 10); mid[k] = (a + b) / 2;
      spots[k] = { x: mid[k], y: w >= String(n[k]).length * DIGIT + 10 ? barTop + barH / 2 : geo.underY, under: w < String(n[k]).length * DIGIT + 10 };
    }
    // Two numbers under the bar that would run together move apart, the first to the left and the second to the right.
    const over = (room.first + room.second) / 2 - (spots.second.x - spots.first.x);
    if (spots.first.under && spots.second.under && over > 0) { spots.first.x -= over / 2; spots.second.x += over / 2; }
    for (const k of ['first', 'second']) {
      const p = geo.parts[k], [a, b] = span[k], spot = spots[k];
      for (const [attr, v] of Object.entries({ x: a, y: barTop, width: b - a, height: barH })) p.rect.setAttribute(attr, v);
      if (choc()) p.grooves.replaceChildren(...Array.from({ length: n[k] - 1 }, (_, i) => el('line', { x1: a + (i + 1) * u, y1: barTop + 3, x2: a + (i + 1) * u, y2: barTop + barH - 3 })));
      place(p.num, spot.x, spot.y, label(k));
      p.lead.setAttribute('display', spot.under ? 'inline' : 'none');
      for (const [attr, v] of Object.entries({ x1: mid[k], y1: barTop + barH, x2: spot.x, y2: spot.y - 12 })) p.lead.setAttribute(attr, v);
      if (choc()) { p.badge.setAttribute('cx', spot.x); p.badge.setAttribute('cy', spot.y); p.badge.setAttribute('display', s.cover === k ? 'none' : 'inline'); }
    }
    if (!choc()) {
      // The outline goes round the known part alone while the second part is a sketch, so its dashes show.
      for (const [attr, v] of Object.entries({ x: x0, y: barTop, width: (unknown === 'second' ? sx : ex) - x0, height: barH })) geo.outline.setAttribute(attr, v);
      for (const [attr, v] of Object.entries({ x1: sx, y1: barTop - 6, x2: sx, y2: barTop + barH + 6 })) geo.split.setAttribute(attr, v);
    }
    // The places a tap covers, and the card on the covered number.
    for (const [k, hit] of Object.entries(geo.taps)) {
      const w = Math.max(FINGER, (k === 'whole' ? 2 : String(n[k]).length) * DIGIT + 16), sp = spots[k];
      for (const [attr, v] of Object.entries({ x: sp.x - w / 2, y: sp.y - FINGER / 2, width: w, height: FINGER })) hit.setAttribute(attr, v);
      hit.setAttribute('aria-label', T(`bar-cover-${k}`));
    }
    geo.card.setAttribute('display', s.cover ? 'inline' : 'none');
    if (s.cover) {
      const sp = spots[s.cover], box = geo.card.firstChild, q = geo.card.lastChild;
      for (const [attr, v] of Object.entries({ x: sp.x - 20, y: sp.y - 20, width: 40, height: 40 })) box.setAttribute(attr, v);
      q.setAttribute('x', sp.x); q.setAttribute('y', sp.y);
      geo.card.setAttribute('aria-label', T('bar-lift'));
    }
    // The handles: the split's under the bar, the end's right of it.
    const hs = geo.handles;
    if (hs.split) {
      const y = barTop + barH, sx = splitX() + geo.gap / 2; // On the chocolate the handle stands under the break.
      for (const [attr, v] of Object.entries({ x: sx - geo.hit / 2, y, width: geo.hit, height: geo.hit })) hs.split.hit.setAttribute(attr, v);
      hs.split.knob.setAttribute('d', `M ${sx} ${y + 4} L ${sx + 12} ${y + 20} V ${y + 34} H ${sx - 12} V ${y + 20} Z`);
      hs.split.grip.setAttribute('d', `M ${sx - 4} ${y + 22} V ${y + 30} M ${sx + 4} ${y + 22} V ${y + 30}`);
      aria(hs.split.g, T('bar-split'), 1, s.whole - 1, s.first);
    }
    if (hs.end) {
      const y = barTop + barH / 2 - Math.max(geo.hit, barH) / 2;
      for (const [attr, v] of Object.entries({ x: ex, y, width: geo.hit, height: Math.max(geo.hit, barH) })) hs.end.hit.setAttribute(attr, v);
      for (const [attr, v] of Object.entries({ x: ex + 6, y: barTop + 4, width: 16, height: barH - 8 })) hs.end.knob.setAttribute(attr, v);
      hs.end.grip.setAttribute('d', `M ${ex + 11} ${barTop + barH / 2 - 7} V ${barTop + barH / 2 + 7} M ${ex + 17} ${barTop + barH / 2 - 7} V ${barTop + barH / 2 + 7}`);
      aria(hs.end.g, T('bar-end'), ends()[0], ends()[1], s.whole);
    }
    if (spec.counters) countersRow(anim);
    // The written line and the facts.
    if (line && line.set(tint(lineOf(spec, s)), int) && anim) go.flash(line.el);
    if (block) {
      const f = g() ? g().facts(target, s, solved) : { first: s.first, second: second(), listed: factsListed(spec) };
      for (const changed of block.set({ ...f, int, T, picked })) if (anim) go.flash(changed);
    }
    light(); refresh();
  }
  const place = (t, x, y, words) => { t.setAttribute('x', x); t.setAttribute('y', y); if (t.textContent !== words) t.textContent = words; };
  const aria = (node, label, lo, hi, v) => { node.setAttribute('aria-label', label); node.setAttribute('aria-valuemin', lo); node.setAttribute('aria-valuemax', hi); node.setAttribute('aria-valuenow', v); node.setAttribute('aria-valuetext', int(v)); };

  // countersRow keeps one counter over each 1 of the bar: round red counters over the first part and square blue
  // counters over the second. A counter that joins the row pops in.
  function countersRow(anim) {
    const kinds = Array.from({ length: s.whole }, (_, i) => i < s.first ? 'disc' : 'square');
    dots = dots.filter((d, i) => { const keep = i < kinds.length && d.kind === kinds[i]; if (!keep) d.n.g.remove(); return keep; });
    for (let i = dots.length; i < kinds.length; i++) {
      const kind = kinds[i], n = counter(kind, kind === 'disc' ? 'a' : 'b', geo.dotR);
      row_.append(n.g); dots.push({ kind, n, part: kind === 'disc' ? 'first' : 'second' });
      if (anim) go.pop(n.pop);
    }
    dots.forEach((d, i) => put(d.n, { x: geo.x0 + (i + 0.5) * geo.u, y: geo.dotY }));
  }

  // shown gives the fact the figure shows: the fact of a link the reader points at, else the fact picked.
  function shown() {
    if (!family() || (g() && !solved)) return null;
    const pointed = [...lit].filter(id => FACT_IDS.includes(id)).at(-1);
    const p = two() ? partsOf(target, s.use, s.third) : { first: s.first, second: second() };
    return pointed ? sameFact(pointed, p.first, p.second) : picked;
  }
  // light marks what each link points at, and shows a fact on the bar: an addition lights both parts and the whole,
  // and a subtraction draws the part it takes away pale with a dashed outline and lights the part left.
  function light() {
    if (!geo) return;
    const f = shown(), away = f && takenBy(f), on = new Set(lit);
    if (f) for (const id of away ? [away === 'first' ? 'second' : 'first'] : ['first', 'second', 'whole']) on.add(id);
    for (const node of back.querySelectorAll('[data-ref]')) node.classList.toggle('counters-hot', on.has(node.dataset.ref));
    for (const k of ['first', 'second']) geo.parts[k].g.classList.toggle('counters-bar-gone', away === k);
    for (const d of dots) d.n.g.classList.toggle('counters-lit', on.has(d.part) || on.has('whole'));
    for (const [h, x] of Object.entries(geo.handles)) x.g.classList.toggle('counters-hot', lit.has(h));
  }

  // refresh writes every value that follows the bar, in the readouts and the text, and judges a challenge.
  function refresh() {
    const ids = measuresOf(spec), c = counts(spec, s);
    const value = id => {
      if (id in LINES) { const l = LINES[id](spec, s); return !l ? DASH : id.startsWith('written') ? words(l, int) : reading(l, int, T); }
      return c[id] == null ? DASH : int(c[id]);
    };
    for (const k of chips) if (k.set(value(k.id)) && moving()) go.flash(k.el);
    live(host, { value: id => ids.includes(id) ? value(id) : null });
    judge();
  }
  // vars gives a challenge's words: its drawn numbers and the reader's bar.
  const vars = () => g().words(base.challenge, target, s, { int, written: l => words(l, int) });
  function judge() {
    if (!goal) return;
    const c = base.challenge, r = holds(), v = vars();
    goal.say(T(r.done ? `goal-${c.goal}-done` : `goal-${c.goal}`, v));
    // A goal reached closes its hint, which gives its room back to the facts that show.
    if (goal.show(r.done, r.note ? T(`note-${c.goal}-${r.note}`, v) : undefined) && goal.hinted()) goal.closeHint();
  }
  const hint = () => T(`hint-${base.challenge.goal}${g().hint ? `-${g().hint(target, s)}` : ''}`, vars());
  // commit presses Check. Once the goal holds the facts fill their places and the bar's parts swell.
  function commit() {
    if (s.checked) return;
    s.checked = true;
    render('move');
    if (solved && moving()) go.cheer([geo?.parts.first.g, geo?.parts.second.g].filter(Boolean));
  }

  // setTwo keeps the use or the third number of bar-for-two, and takes back a check.
  function setTwo(k, v) {
    s[k] = v; s.checked = false; picked = null;
    render('move');
  }

  // name gives a readout or a handle its name: on the chocolate "Squares" or "First piece".
  const name = id => labelKeys(spec, id).map(k => T(k)).find(Boolean) ?? (id.startsWith('written') ? T('written') : T('written-reading'));
  // The panel holds a challenge's line and Check, and the readouts.
  function drawPanel() {
    const c = base.challenge, ctls = [];
    goal = null;
    // bar-for-two sets the use of its two numbers with a segment and the third number with a stepper.
    useSeg = null;
    if (spec.useCtl) ctls.push(useSeg = segment({ id: 'use', label: T('bar-use'), items: USES.map(u => [u, T(`bar-use-${u}`)]), value: s.use, pick: v => setTwo('use', v) }));
    if (spec.thirdCtl) ctls.push(stepper({ id: 'third', label: T('bar-third'), min: spec.thirdCtl.lo, max: spec.thirdCtl.hi, value: s.third, write: int, change: v => setTwo('third', v) }));
    if (c) {
      goal = goalRow({ T, motion: moving() ? fx : null, hint: on => on ? hint() : null,
        another: () => { deal(); drawPanel(); build(); if (!geo) refresh(); } });
      ctls.push(check({ T, press: commit }));
    }
    const wide = id => id in LINES;
    chips = (spec.readout ?? []).filter(id => readable(spec).includes(id)).map(id => chip({ id, label: name(id), cls: wide(id) ? 'counters-chip-wide' : '' }));
    for (const k of chips) if (!wide(k.id)) k.width(2);
    panel.replaceChildren(...[goal?.el, ctls.length ? row('ctls', ctls) : null, chips.length ? row('out', chips) : null].filter(Boolean));
  }

  function point(id, on) {
    if (!spec) return;
    if (on) lit.add(id); else lit.delete(id);
    line?.light(id, on, line.whole);
    block?.light(id, on);
    light();
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }

  return {
    show(page) {
      base = page; target = null; lit.clear(); deal();
      drawPanel(); build();
      if (!geo) render('jump');
    },
    hide() {
      spec = null; base = null; goal = null; geo = null; block = null; line = null; dots = [];
      for (const n of [back, row_, front]) n.replaceChildren();
    },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); build(); if (!geo) render('jump'); },
  };
}
