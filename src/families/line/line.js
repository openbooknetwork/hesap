// The line scene: a number line from left to right with a mark at each step, a point the reader drags along it
// that snaps to the nearest mark, and buttons that jump the point one gap. A page may add a bracket over the tens
// round the point, gaps that open into lines of their own, and label cards for blank marks. The looks stones and
// stones-on-line draw the frog's stepping stones of the opening pages. A challenge page asks the reader to put the
// point on a number.
import { opening, jump, place, pick, open, lay, show as reveal, next, toggleMiddle, estimate as setEstimate, moveStart, writtenOf, isFree, numbered, standing, posOf, slide, labelKeep, settle as settleMarks, gapsKey, sides, SETTLE, arcsOf, jumpsOf, counts, readoutsOf, measuresOf, readingOf, tensOf, gapsOf, numberAt, markOf, labelled, findsOf, shuffled, isStones, gapOn, labelRows, secondTo, drawLine } from './model.js';
import { GOALS } from './goals.js';
import { pointShape, flag, arc, frog, stone, pond, bracket as makeBracket, blankBox, card, house, plaque, van, book, bookmark, BOX, CARD } from './figures.js';
import { lens as makeLens, LENS_H } from './lens.js';
import { svg as el, h, svgPoint } from '../../kit/dom.js';
import { drag, nudge } from '../../kit/drag.js';
import { chip, button, segment, slider, stepper, row, check } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh, another } from '../../kit/random.js';
import { writtenLine, words as writeWords, reading as writeReading, DASH } from '../../kit/written.js';

const FONT = 10, APART = 4; // The least size of a label, and the least room between two labels, in pixels.
// A line whose gaps are narrower than this shows the lens while the point moves. A house of the street needs more
// room than a mark to be read, so the street shows the lens below a wider gap.
const NARROW = 8, NARROW_STREET = 24;
const LENS_STAYS = 1600; // The lens stays this long after the last jump, in milliseconds.
const STILL = 4; // A press that moves less than this many pixels leaves the point or the card where it is.
const POLE = 16, FLAG = 24, STACK = 30; // A flag's pole, its box, and how far a second flag over the same place rises.
const LONG = 11, SHORT = 6; // Half the height of a long mark and of a short mark.
const BOOK_TOP = 34; // The bookmark stands this far above the edge of the book.
const WHO = ['point', 'second'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function line({ host, stage, panel, T, lang, moving, motion }) {
  const fx = motion.group();
  const svg = el('svg', { class: 'line-svg' });
  stage.appendChild(svg);
  // base is the page as written, and spec the page with the line a challenge drew. s is its state. geo is the
  // figure's layout in pixels, and parts the elements paint moves. held is the point or card under the reader's
  // finger, glide a jump or a snap on its way, and looking whether the lens shows. On a challenge page target is the
  // draw and goal the challenge's line.
  let base = null, spec = null, s = null, geo = null, parts = null, chips = [], jumps = null, held = null, glide = null, area = { w: 0, h: 0 };
  let looking = false, timer = 0, target = null, goal = null, solved = false, acts = {}, kb = null, drawn = null;
  const int = n => numbers(lang()).int(n);
  const num = (k, st = s) => numberAt(spec, k, st.step);
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // wide gives the width of the widest of the words at size 1, measured in the label's own type.
  function wide(words, cls = 'line-label') {
    const probe = el('text', { class: cls, 'font-size': 100 }), widths = [];
    svg.append(probe);
    for (const w of words) { probe.textContent = w; widths.push(probe.getComputedTextLength()); }
    probe.remove();
    return Math.max(1, ...widths) / 100;
  }
  // The marks that carry labels. A challenge that draws its line shows every label once its goal holds, so its
  // labels are set to fit all of them.
  // The middle's label shows while its mark does.
  const mid = k => spec.middle && k === gapsOf(spec) / 2;
  const shown = (k, st = s) => labelled(spec, num(k, st)) || (spec.reveal && solved) || (mid(k) && st.middle);
  const sized = k => labelled(spec, num(k)) || spec.reveal || mid(k);
  const street = () => spec.look === 'street';

  // layout fits the line to the stage: the gap between marks, the sizes that follow it, and the height of the line
  // with the bands above and below it, so the figure stands in the middle of the stage.
  function layout(W, H) {
    const n = gapsOf(spec), stones = isStones(spec), onLine = spec.look !== 'stones';
    // A blank box at an end of the line keeps its whole width on the stage.
    const gap = gapOn(W - (spec.blank.length ? BOX.w : 0) - (street() ? 8 : 0), n, stones), x0 = (W - n * gap) / 2;
    const big = gap >= 34, r = big ? 11 : 9, arcH = clamp(gap * 0.42, Math.min(10, gap * 1.5), 26);
    const sw = Math.min(gap * 0.86, 58), fs = Math.min(Math.max(gap * 0.9, 26), 46);
    let top, bottom, g = { gap, x0, r, arcH, sw, fs, n, x: k => x0 + k * gap, narrow: gap < (spec.look === 'street' ? NARROW_STREET : NARROW) && onLine && !isFree(spec), font: big ? 16 : 14, rows: 1 };
    // A house of the street is about as wide as its gap, and a flag stands over its door number.
    g.houseH = clamp(gap * 1.1, 12, 36); g.flagFrom = street() ? -(g.houseH + 30) : spec.look === 'book' ? -BOOK_TOP : -r;
    if (!onLine) {
      g.stoneY = 0; g.arcY = -fs * 0.95; g.downY = sw * 0.3 + 6;
      g.water = [-sw * 0.3 - 14, g.downY + (spec.jump ? 2 * arcH * 0.5 + 12 : 8)];
      top = g.arcY - arcH - 8; bottom = g.water[1] + 8;
    } else {
      // Every labelled mark keeps its label. The labels take one row where they fit it, and two rows where not.
      const ks = Array.from({ length: n + 1 }, (_, k) => k).filter(sized);
      const spacing = gap * Math.min(n, ...ks.slice(1).map((k, i) => k - ks[i]));
      Object.assign(g, labelRows(wide(ks.map(k => int(num(k)))), spacing, { base: g.font, least: FONT, apart: APART }));
      g.row = new Map(ks.map((k, i) => [k, g.rows === 2 ? i % 2 : 0]));
      g.labelY = 26 + g.font / 2; g.arcY = -6;
      if (street()) g.labelY = -(g.houseH + 16);
      let y = street() ? 34 : Math.max(g.labelY + g.font / 2 + (g.rows === 2 ? g.font + 3 : 0), spec.blank.length ? g.labelY + BOX.h / 2 : 0) + 6;
      if (spec.jump) { g.downY = y + 6; y = g.downY + g.arcH + 6; }
      if (spec.reading || spec.moved) { g.readingY = y + 22; y += 46; }
      if (spec.written) { g.writtenY = y + 32; y += 64; }
      if (spec.open) { g.openTop = y; g.openY = y + 56; y = g.openY + 40; }
      if (spec.cards) {
        const per = Math.max(1, Math.floor((W - 20) / (CARD.w + 8))), all = s.cards.length, row0 = y + 30 + CARD.h / 2;
        g.home = i => { const r0 = Math.floor(i / per), inRow = Math.min(per, all - r0 * per), c = i % per; return { x: W / 2 + (c - (inRow - 1) / 2) * (CARD.w + 8), y: row0 + r0 * (CARD.h + 10) }; };
        y += 30 + Math.ceil(all / per) * (CARD.h + 10);
      }
      bottom = y;
      // A challenge's point shows its flag once the goal holds, and a find page's once the reader presses Show, with
      // the flag of the number to find over it.
      const flags = spec.flag || spec.challenge || spec.find != null || spec.estimate != null ? -g.flagFrom + POLE + FLAG + (spec.second != null || spec.find != null || spec.challenge ? STACK : 0) : r;
      g.lensY = street() ? g.labelY - 14 : -r - 6;
      top = -Math.max(flags, spec.jump ? 6 + arcH + 4 : 0, g.narrow ? -g.lensY + LENS_H : 0, spec.bracket ? 30 : 0) - 8;
      if (stones) {
        // The stones stand over the line, each over the mark of its number, with the frog on the stone over the point.
        g.water = [0, -(spec.jump ? arcH + 18 : 20)];
        g.stoneY = g.water[1] - sw * 0.3 - 10; g.water[0] = g.stoneY - sw * 0.3 - 10;
        top = g.stoneY - fs - 8;
      }
    }
    const tall = bottom - top;
    g.y0 = tall < H ? (H - tall) / 2 - top : 8 - top;
    return g;
  }

  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    fx.stop(); held = null; glide = null; kb = null;
    if (!area.w || !area.h) { geo = null; parts = null; svg.replaceChildren(); refresh(); return; } // A phone is showing the text.
    svg.setAttribute('viewBox', `0 0 ${area.w} ${area.h}`);
    svg.replaceChildren();
    const g = geo = layout(area.w, area.h), y0 = g.y0, nodes = [], onLine = spec.look !== 'stones';
    parts = { points: {}, flags: {}, labels: new Map(), marks: new Map(), cards: [] };
    if (isStones(spec)) {
      const [wy1, wy2] = g.water;
      nodes.push(...pond(g.x(0) + g.gap * 0.45, Math.min(g.x(g.n) + g.gap * 0.6, area.w - 6), y0 + wy1, y0 + wy2, g.x(0) + g.gap * 0.42));
      for (let k = 1; k <= g.n; k++) nodes.push(stone(g.x(k), y0 + g.stoneY, g.sw, int(k), Math.min(g.font, g.sw * 0.5)));
      if (onLine) for (let k = 0; k <= g.n; k++) nodes.push(el('line', { class: 'line-guide', x1: g.x(k), x2: g.x(k), y1: y0 + wy2 + 2, y2: y0 - 14 }));
    }
    if (spec.open) nodes.push(...gaps());
    if (street()) {
      // The street: a road, a house at each mark, and the door numbers on plaques over the doors.
      nodes.push(el('rect', { class: 'line-road', x: g.x(0) - Math.min(g.gap / 2, 12), y: y0 + 2, width: g.n * g.gap + 2 * Math.min(g.gap / 2, 12), height: 22 }));
      for (let k = 0; k <= g.n; k++) {
        nodes.push(house(g.x(k), y0, Math.min(g.gap * 0.84, 30), g.houseH));
        if (labelled(spec, num(k))) { const p = plaque(g.x(k), y0 + g.labelY, int(num(k)), Math.max(FONT, Math.min(g.font, 13))); parts.labels.set(k, p); nodes.push(p); }
      }
    } else if (onLine) {
      // The book is the edge of its pages between its two covers. Every other line is a line with an arrow's room.
      if (spec.look === 'book') nodes.push(...book(g.x(0), g.x(g.n), y0));
      else nodes.push(el('line', { class: 'line-axis', x1: g.x(0) - Math.min(14, g.gap / 2), x2: g.x(g.n) + Math.min(14, g.gap / 2), y1: y0, y2: y0 }));
      // A labelled mark is long and carries its number, a mark without a label is short, and a blank mark has a box.
      for (let k = 0; k <= g.n; k++) {
        const n = num(k), long = labelled(spec, n), half = long ? LONG : SHORT;
        // An unmarked line has its two end marks alone, and the middle's label when it shows.
        if (isFree(spec) && !long) { if (sized(k)) { const t = el('text', { class: 'line-label', x: g.x(k), y: y0 + g.labelY, 'font-size': g.font }, [int(n)]); parts.labels.set(k, t); nodes.push(t); } continue; }
        if (spec.look !== 'book') { const m = el('line', { class: `line-mark${long ? '' : ' line-short'}`, x1: g.x(k), x2: g.x(k), y1: y0 - half, y2: y0 + half }); parts.marks.set(k, m); nodes.push(m); }
        if (sized(k)) { const t = el('text', { class: 'line-label', x: g.x(k), y: y0 + g.labelY + (g.row.get(k) ? g.font + 3 : 0), 'font-size': g.font }, [int(n)]); parts.labels.set(k, t); nodes.push(t); }
        if (spec.blank.includes(n)) { const box = blankBox(g.x(k), y0 + g.labelY, Math.min(BOX.w, g.gap - 6)); parts.labels.set(k, box); nodes.push(box); }
      }
      // The estimate mark rises well above a long mark, with a diamond at its top, so it shows on an end mark too.
      if (spec.estimate != null) {
        const top = y0 - LONG - 20;
        parts.estimate = el('g', { class: 'line-estimate', 'data-ref': 'estimate' }, [
          el('line', { y1: top, y2: y0 + LONG + 4 }), el('path', { d: `M 0 ${top - 9} L 5 ${top - 4} L 0 ${top + 1} L -5 ${top - 4} Z` }),
        ]);
        nodes.push(parts.estimate);
      }
      if (spec.middle) { const k = g.n / 2; parts.middle = el('line', { class: 'line-mark line-middle', 'data-ref': 'middle', x1: g.x(k), x2: g.x(k), y1: y0 - LONG - 4, y2: y0 + LONG }); nodes.push(parts.middle); }
    }
    if (spec.bracket) { parts.bracket = makeBracket(); nodes.push(parts.bracket.el); }
    parts.arcs = el('g', { class: 'line-arcs', 'data-ref': 'jumps' });
    nodes.push(parts.arcs);
    if (spec.reading || spec.moved) { parts.reading = el('text', { class: 'line-reading', 'data-ref': spec.moved ? 'gaps' : 'reading', x: area.w / 2, y: y0 + g.readingY }); nodes.push(parts.reading); }
    if (spec.moved) nodes.push(...handles());
    const layer = el('g', { class: 'line-points' });
    if (isStones(spec)) { parts.frog = el('g', { 'data-ref': spec.look === 'stones' ? 'point' : null }, [frog(g.fs)]); layer.append(parts.frog); }
    if (onLine && s.at !== null) for (const who of WHO.filter(w => w === 'point' || spec.second != null)) {
      // The point of the street is a van, which shows the number of its house on its side.
      // The point of the book is a bookmark. The point of an estimate page stays where it is.
      // On a page with start the point moves by the jump buttons alone.
      const shape = street() ? van(14) : null, still = spec.estimate != null || (who === 'point' && spec.start != null);
      const kids = shape ? shape.nodes : spec.look === 'book' ? bookmark(BOOK_TOP) : pointShape(who, g.r);
      const p = el('g', { class: `${still ? 'line-fixed' : 'line-point'} line-c-${who}`, 'data-ref': who, tabindex: still ? null : 0, role: still ? null : 'slider', 'aria-label': T(street() ? 'van' : spec.look === 'book' ? 'bookmark' : `${who}-name`), 'aria-valuemin': still ? null : num(0), 'aria-valuemax': still ? null : num(g.n) }, kids);
      if (shape) parts.van = shape;
      parts.points[who] = p; layer.append(p);
      if (!still) grab(p, who, layer);
      if ((spec.flag || spec.challenge || spec.find != null || spec.estimate != null) && !shape) parts.flags[who] = flag(who);
    }
    if (spec.find != null || goalFlags()) parts.flags.find = flag('find');
    // The second flag and the flag of the number to find lie under the point's, so their poles pass behind its flag
    // when they stack.
    nodes.push(...['find', 'second', 'point'].filter(w => parts.flags[w]).map(w => parts.flags[w].el));
    if (spec.start != null) nodes.push(ring());
    nodes.push(layer);
    if (spec.written) { parts.written = null; parts.writtenAt = el('g', { class: 'line-written' }); nodes.push(parts.writtenAt); }
    if (parts.keys) nodes.push(...parts.keys);
    if (spec.cards) nodes.push(cards());
    if (g.narrow) { parts.lens = makeLens(); nodes.push(parts.lens.el); }
    svg.replaceChildren(...nodes);
    paint();
  }

  // gaps makes a target over each gap of the line. A tap opens the gap under the line as a line of its own, from
  // its left mark to its right mark with a mark for every number between, and a tap on the open gap closes it.
  function gaps() {
    const g = geo, y0 = g.y0, hits = [];
    parts.opened = el('g', { class: 'line-opened' });
    for (let k = 0; k < g.n; k++) {
      const t = el('rect', { class: 'line-gap', x: g.x(k), y: y0 - 22, width: g.gap, height: 22 + g.labelY + g.font / 2, tabindex: 0, role: 'button', 'data-gap': k });
      const act = () => { s = open(s, k); paint(); };
      t.addEventListener('click', act);
      t.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); act(); });
      hits.push(t);
    }
    parts.gaps = hits;
    return [parts.opened, ...hits];
  }
  // drawOpen draws the open gap again under the line, at the width of the stage, joined to its marks above.
  function drawOpen(st) {
    const g = geo, y0 = g.y0;
    for (const t of parts.gaps) { const k = Number(t.dataset.gap), a = num(k, st), b = num(k + 1, st); t.setAttribute('aria-label', T('open-gap', { a: int(a), b: int(b) })); t.setAttribute('aria-pressed', st.open === k); }
    if (st.open === null) return parts.opened.replaceChildren();
    const k = st.open, a = num(k, st), b = num(k + 1, st), m = b - a, x1 = g.x(0), x2 = g.x(g.n), y = y0 + g.openY, x = j => x1 + (x2 - x1) * j / m;
    const below = y0 + g.labelY + g.font / 2 + 4, ws = Array.from({ length: m + 1 }, (_, j) => int(a + j)), fit = labelRows(wide(ws), (x2 - x1) / m, { base: 14, least: FONT, apart: APART });
    const kids = [
      el('line', { class: 'line-funnel', x1: g.x(k), y1: below, x2: x1, y2: y - LONG }), el('line', { class: 'line-funnel', x1: g.x(k + 1), y1: below, x2: x2, y2: y - LONG }),
      el('line', { class: 'line-open-gap', x1: g.x(k), x2: g.x(k + 1), y1: y0, y2: y0 }),
      el('line', { class: 'line-axis', x1, x2, y1: y, y2: y }),
    ];
    for (let j = 0; j <= m; j++) {
      kids.push(el('line', { class: 'line-mark', x1: x(j), x2: x(j), y1: y - 9, y2: y + 9 }));
      kids.push(el('text', { class: 'line-label', x: x(j), y: y + 22 + (fit.rows === 2 && j % 2 ? fit.font + 3 : 0), 'font-size': fit.font }, [ws[j]]));
    }
    parts.opened.replaceChildren(...kids);
  }

  // cards lays the label cards out in their row under the line. A card the reader drops on its own blank mark stays
  // there as its label, and a card dropped anywhere else slides back to the row. By keys, Enter picks a card up, Left
  // and Right carry it from one blank box to the next, Enter lays it and Escape puts it back.
  function cards() {
    const layer = el('g', { class: 'line-cards' }), boxes = [...spec.blank].sort((a, b) => a - b);
    parts.cards = s.cards.map((n, i) => {
      const face = el('g', {}, card(int(n))), g = el('g', { class: 'line-card', tabindex: s.placed.includes(n) ? -1 : 0, role: 'button', 'aria-label': T('card', int(n)) }, [face]), c = { n, i, g, face, at: s.placed.includes(n) ? sitting(n) : homeOf(i) };
      let dx = 0, dy = 0;
      drag(g, {
        point: e => svgPoint(svg, e), raise: () => layer.append(g),
        start(p) { if (s.placed.includes(n)) return false; c.tween?.pause(); held = { card: c, from: p, moved: false }; dx = c.at.x - p.x; dy = c.at.y - p.y; },
        move(p) {
          if (!held) return;
          if (!held.moved && Math.hypot(p.x - held.from.x, p.y - held.from.y) < STILL) return;
          held.moved = true; c.at = { x: p.x + dx, y: p.y + dy }; put(c);
        },
        drop() { if (!held) return; held = null; layDown(c, blankAt(c.at)); },
      });
      // Raising the card moves it in the page, which takes its focus, so the focus comes back and blur lets it be.
      let raising = false;
      const carry = () => { const m = boxes[kb.i]; c.at = { x: geo.x((m - spec.from) / spec.step), y: geo.y0 + geo.labelY - CARD.h * 0.7 }; put(c); };
      g.addEventListener('keydown', e => {
        const side = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); e.stopPropagation();
          if (s.placed.includes(n)) return;
          if (kb?.card === c) { const m = boxes[kb.i]; kb = null; return layDown(c, m); }
          if (kb) home(kb.card);
          kb = { card: c, i: 0 }; c.tween?.pause();
          raising = true; layer.append(g); g.focus(); raising = false;
          carry();
        } else if (side) {
          // Left and Right stop at every card, carried or not, so the book does not turn the page.
          e.preventDefault(); e.stopPropagation();
          if (kb?.card === c) { kb.i = clamp(kb.i + side, 0, boxes.length - 1); carry(); }
        } else if (e.key === 'Escape' && kb?.card === c) {
          e.preventDefault(); e.stopPropagation(); kb = null; home(c);
        }
      });
      g.addEventListener('blur', () => { if (!raising && kb?.card === c) { kb = null; home(c); } });
      put(c); layer.append(g);
      return c;
    });
    return layer;
  }
  // layDown lays a card on the blank mark m. It stays on its own mark, and goes back to the row from any other.
  function layDown(c, m) {
    const was = s.placed.length;
    if (m !== null) s = lay(spec, s, c.n, m);
    if (s.placed.length > was) { c.at = sitting(c.n); put(c); c.g.setAttribute('tabindex', -1); if (moving()) motion.pop(c.face); paint(); return; }
    home(c);
  }
  // A card that sits on its mark stands in the mark's label box.
  const sitting = n => ({ x: geo.x((n - spec.from) / spec.step), y: geo.y0 + geo.labelY });
  // The row's places are measured from the line, as the rest of the layout is.
  const homeOf = i => { const p = geo.home(i); return { x: p.x, y: p.y + geo.y0 }; };
  const put = c => c.g.setAttribute('transform', `translate(${c.at.x} ${c.at.y})`);
  // home slides a card back to its place in the row.
  function home(c) {
    const to = homeOf(c.i);
    if (!moving()) { c.at = { ...to }; put(c); return; }
    c.tween = fx.run(c.at, { ...to, duration: 260, ease: 'outCubic', onUpdate: () => put(c) });
  }
  // blankAt gives the number of the blank mark nearest a card's place, or null when the card is far from them all.
  function blankAt(p) {
    const g = geo, reach = Math.max(g.gap / 2, BOX.w / 2 + 6);
    let best = null, far = Infinity;
    for (const n of spec.blank) { const d = Math.abs(g.x((n - spec.from) / spec.step) - p.x); if (d < far) { far = d; best = n; } }
    return far <= reach && Math.abs(p.y - (g.y0 + g.labelY)) < CARD.h + 10 ? best : null;
  }

  // grab lets the reader drag a point along the line. It follows the finger and snaps to the nearest mark when the
  // reader lets go. The arrow keys move a focused point one mark.
  function grab(node, who, layer) {
    drag(node, {
      point: e => svgPoint(svg, e), raise: () => layer.append(node),
      start(p, e) {
        // Where the second point's touch area lies over the start's ring, a press nearer the start's mark goes to the
        // ring, which takes the same pointer for its drag.
        if (who === 'second' && parts.ring && Math.abs(p.x - xm(s.base)) < Math.abs(p.x - xm(s.second))) {
          parts.ring.dispatchEvent(new PointerEvent('pointerdown', { pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, clientX: e.clientX, clientY: e.clientY, button: 0, buttons: 1, bubbles: true }));
          return false;
        }
        settle(); held = { who, x: xm(onMark(who)), from: p.x, moved: false };
      },
      move(p) {
        if (!held) return;
        if (!held.moved && Math.abs(p.x - held.from) < STILL) return;
        held.moved = true; held.x = clamp(p.x, who === 'second' ? xm(secondTo(spec, s, 0)) : geo.x(0), geo.x(geo.n)); look(true); paint();
      },
      drop() {
        if (!held) return;
        const h0 = held; held = null;
        if (!h0.moved) return paint();
        // On an unmarked line the point stays where it is let go, and on a marked line it snaps to the nearest mark.
        const k = nearest(h0.x);
        s = place(s, who, who === 'second' ? secondTo(spec, s, k) : k); look(false);
        if (isFree(spec)) paint(); else go({ who, from: h0.x, to: xm(k), hop: false }, 140);
      },
    });
    nudge(node, { step(dx, dy) { settle(); const k = clamp(onMark(who) + (dx || -dy), 0, geo.n); s = place(s, who, who === 'second' ? secondTo(spec, s, k) : k); look(false); paint(); } });
  }
  // handles makes a touch band for each mark between the ends, as wide as the stretch halfway to each neighbour and
  // at least 44px tall, under the point so the point keeps its own dot. A dragged mark slides between its neighbours
  // and stays where the reader lets it go. Each mark also has a key stand-in after the point, so Tab reaches the point
  // first and then the marks from left to right, and the arrow keys move a focused mark a tenth of a gap.
  function handles() {
    const g = geo, top = g.y0 - LONG, h = Math.max(44, g.labelY + g.font / 2 + 6 + LONG);
    parts.handles = new Map(); parts.keys = [];
    // A mark stops where its label's drawn box would come closer than 10px to its neighbour's. Half a pixel on each
    // side covers the text landing on fractions of a pixel.
    const keep = labelKeep(spec, area.w, j => (parts.labels.get(j)?.getBBox().width ?? 0) + 1);
    const out = [];
    for (let k = 1; k < g.n; k++) {
      const band = el('rect', { class: 'line-band', y: top, height: h }), node = el('g', { class: 'line-handle', 'data-mark': k }, [band]);
      drag(node, {
        point: e => svgPoint(svg, e),
        start(p) { settle(); held = { mark: k, dx: xm(k) - p.x, from: p.x, moved: false }; },
        move(p) {
          if (!held) return;
          if (!held.moved && Math.abs(p.x - held.from) < STILL) return;
          held.moved = true; s = slide(spec, s, k, (p.x + held.dx - g.x0) / g.gap, keep); paint();
        },
        drop() { if (!held) return; held = null; s = settleMarks(s); paint(); },
      });
      const key = el('g', { class: 'line-mark-key', tabindex: 0, role: 'slider', 'aria-label': T('mark-name', int(num(k))), 'aria-valuenow': num(k), 'aria-valuemin': num(k - 1), 'aria-valuemax': num(k + 1) });
      key.addEventListener('focus', () => node.classList.add('line-focus'));
      key.addEventListener('blur', () => node.classList.remove('line-focus'));
      nudge(key, { step(dx) { if (!dx) return; s = settleMarks(slide(spec, s, k, posOf(s, k) + dx * SETTLE, keep)); paint(); } });
      parts.handles.set(k, { g: key, band });
      parts.keys.push(key);
      out.push(node);
    }
    return out;
  }
  // ring draws the start of the jumps: a ring in the point's colour round its mark, larger than the point, with a
  // touch area about 44px across. A drag or the arrow keys move it one mark at a time and carry the point and its
  // arcs along. The start of a challenge stays where it is.
  function ring() {
    const fixed = !!spec.challenge;
    const node = el('g', { class: `line-start line-c-point${fixed ? '' : ' line-moves'}`, 'data-ref': 'start', tabindex: fixed ? null : 0, role: fixed ? null : 'slider', 'aria-label': T('start'), 'aria-valuemin': num(0), 'aria-valuemax': num(geo.n) }, [
      el('circle', { class: 'line-hit', r: 22 }), el('circle', { class: 'line-ring', r: geo.r + 7 }),
    ]);
    parts.ring = node;
    if (fixed) return node;
    const to = k => { settle(); s = moveStart(spec, s, k); paint(); };
    drag(node, {
      point: e => svgPoint(svg, e),
      start() { settle(); held = { start: true }; },
      move(p) { if (held?.start) to(Math.round(clamp((p.x - geo.x0) / geo.gap, 0, geo.n))); },
      drop() { held = null; paint(); },
    });
    nudge(node, { step(dx) { if (dx) to(s.base + dx); } });
    return node;
  }
  const onMark = who => who === 'second' ? s.second : s.at;
  // nearest gives the mark a point snaps to: the nearest where the marks stand, or the place itself on an unmarked line.
  function nearest(x) {
    if (spec.moved) return Array.from({ length: geo.n + 1 }, (_, k) => k).reduce((a, b) => Math.abs(xm(b) - x) < Math.abs(xm(a) - x) ? b : a);
    const k = clamp((x - geo.x0) / geo.gap, 0, geo.n);
    return isFree(spec) ? k : Math.round(k);
  }
  // xm gives the place of mark k where it stands, off its place on a page with moved marks.
  const xm = (k, st = s) => geo.x(posOf(st, k));
  // goalFlags says whether the page's goal shows where its number is once it holds.
  const goalFlags = () => !!(spec.challenge && GOALS[spec.challenge.goal].flags);
  // look shows the lens while the reader drags, and for a moment after the point lands, so the mark can be read.
  function look(dragging) {
    if (!geo?.narrow) return;
    looking = true; clearTimeout(timer);
    if (!dragging) timer = setTimeout(() => { looking = false; paint(); }, LENS_STAYS);
  }

  // press jumps the point one gap, and the frog hops with it.
  function press(dir) {
    if (held) return;
    settle();
    const next = jump(spec, s, dir);
    if (!next) return;
    const from = geo ? xm(s.at) : null, adds = jumpsOf(next) > jumpsOf(s);
    s = next; look(false);
    if (geo) go({ who: 'point', from, to: xm(s.at), hop: isStones(spec), adds }, 320);
    else refresh();
  }
  // go runs a glide of a point from one place to the next. Without motion the point is there at once.
  function go(g, duration) {
    if (!moving()) { paint(); return; }
    glide = { ...g, o: { t: 0 } };
    const end = () => { glide = null; paint(); };
    fx.run(glide.o, { t: 1, duration, ease: 'inOutSine', onUpdate: paint }, end, end);
    paint();
  }
  // settle ends a glide on its way, so a new press starts from where the point stands.
  function settle() { if (glide) fx.stop(); }

  // where gives the place a point is drawn: under the finger, on its way, or on its mark.
  function where(who) {
    if (held?.who === who && held.moved) return { x: held.x, lift: 0 };
    if (glide?.who === who) { const t = glide.o.t; return { x: glide.from + (glide.to - glide.from) * t, lift: glide.hop ? Math.sin(Math.PI * t) * geo.arcH * 1.6 : 0 }; }
    return { x: xm(onMark(who)), lift: 0 };
  }
  // now is the state the readouts show: a point under the finger reads the mark it would snap to.
  const now = () => held?.who && held.moved ? place(s, held.who, held.who === 'second' ? secondTo(spec, s, nearest(held.x)) : nearest(held.x)) : s;

  function paint() {
    if (!spec) return;
    solved = holds().done;
    if (geo && parts) draw();
    refresh();
  }
  function draw() {
    const g = geo, y0 = g.y0, st = now();
    // The arcs run over the gaps the point has jumped. The newest one draws itself while the point is on its way.
    const arcs = arcsOf(st).flatMap((a, i, all) => {
      const down = a.dir < 0, y = y0 + (down ? g.downY : g.arcY), part = arc(xm(a.from, st), xm(a.to, st), y, g.arcH, down);
      if (glide?.adds && i === all.length - 1) { part.path.setAttribute('stroke-dasharray', '1 1'); part.path.setAttribute('stroke-dashoffset', 1 - glide.o.t); part.head.setAttribute('opacity', glide.o.t > 0.9 ? 1 : 0); }
      return g.narrow ? [part.path] : [part.path, part.head];
    });
    parts.arcs.replaceChildren(...arcs);
    const at = {};
    for (const who of Object.keys(parts.points)) {
      const p = where(who), n = num(who === 'second' ? st.second : st.at);
      at[who] = { x: p.x, words: int(Math.round(n)) };
      parts.points[who].setAttribute('transform', `translate(${p.x} ${y0})`);
      // A point that carries no number tells a screen reader where it stands, on a number or between two.
      // The fixed point of an estimate page keeps its number to itself until Show writes it.
      if (spec.estimate != null) { if (st.shown) parts.points[who].setAttribute('aria-valuenow', Math.round(n)); else parts.points[who].removeAttribute('aria-valuenow'); }
      else if (numbered(spec)) parts.points[who].setAttribute('aria-valuenow', Math.round(n));
      else {
        const w = standing(spec, who === 'second' ? { ...st, at: st.second } : st);
        parts.points[who].setAttribute('aria-valuenow', Math.round(n * 100) / 100);
        parts.points[who].setAttribute('aria-valuetext', w.between ? T('between', { a: int(w.between[0]), b: int(w.between[1]) }) : int(w.on));
      }
    }
    if (parts.frog) {
      const p = where('point');
      parts.frog.setAttribute('transform', `translate(${p.x} ${y0 + g.stoneY - g.sw * 0.1 - p.lift})`);
    }
    // A second flag that would cover the first stands one place higher. A challenge's flag shows while the goal holds.
    // Show reveals the number at the point on its flag, or on the van, and a flag over the place of the number to find.
    const fl = parts.flags, from = y0 + g.flagFrom, near = (who, x, words) => fl.point && Math.abs(at.point.x - x) < (fl.point.width(at.point.words) + fl[who].width(words)) / 2 + 4;
    if (fl.point) { fl.point.set(at.point.words, from, POLE); fl.point.el.setAttribute('display', spec.flag || ((solved || st.shown) && numbered(spec) && spec.challenge?.goal !== 'jump-to') ? 'inline' : 'none'); }
    if (fl.second) fl.second.set(at.second.words, from, POLE + (near('second', at.second.x, at.second.words) ? STACK : 0));
    if (fl.find) {
      const n = spec.challenge ? target.target : findsOf(spec)[st.find], open = st.shown || (solved && goalFlags());
      at.find = { x: g.x(markOf(spec, n, st.step)), words: int(n) };
      fl.find.set(at.find.words, from, POLE + (open && near('find', at.find.x, at.find.words) ? STACK : 0));
      fl.find.el.setAttribute('display', open ? 'inline' : 'none');
    }
    if (parts.van) parts.van.say(st.shown ? at.point.words : null);
    if (parts.middle) parts.middle.setAttribute('display', st.middle ? 'inline' : 'none');
    // The estimate mark stays hidden while the reader sets the estimate, and Show draws it at the estimate's place.
    if (parts.estimate) { parts.estimate.setAttribute('transform', `translate(${g.x(markOf(spec, st.estimate, st.step))} 0)`); parts.estimate.setAttribute('display', st.shown ? 'inline' : 'none'); }
    // A line whose labels show once its goal holds makes those marks long with them, as a labelled mark is long.
    if (spec.reveal) for (const [k, m] of parts.marks) { const long = shown(k, st), half = long ? LONG : SHORT; m.setAttribute('class', `line-mark${long ? '' : ' line-short'}`); m.setAttribute('y1', y0 - half); m.setAttribute('y2', y0 + half); }
    for (const who of Object.keys(fl)) fl[who].el.setAttribute('transform', `translate(${at[who].x} 0)`);
    // The labels a challenge keeps back show once its goal holds. The bracket lights the labels of its two tens.
    const tens = spec.bracket && st.at !== null ? tensOf(spec, st) : null, lit = tens ? [tens.before, tens.after] : [];
    for (const [k, t] of parts.labels) if (t.tagName === 'text') { t.setAttribute('display', shown(k, st) ? 'inline' : 'none'); t.classList.toggle('line-lit', lit.includes(num(k, st))); }
    if (parts.bracket) parts.bracket.set(tens ? g.x((tens.before - spec.from) / spec.step) : null, tens ? g.x((tens.after - spec.from) / spec.step) : null, y0 - g.r - 4);
    if (parts.gaps) drawOpen(st);
    if (parts.lens && parts.points.point) {
      // The lens gives way to the flags of a goal reached or of Show.
      const show = looking && !solved && !st.shown;
      parts.lens.show(show);
      if (show) {
        const x = at.point.x;
        parts.lens.at(x, y0 + g.lensY, 4, area.w - 4);
        parts.lens.draw((x - g.x0) / g.gap, g.n, k => shown(k, st) ? int(num(k, st)) : null, arcsOf(st), street());
      }
    }
    // The ring of the start stands round its mark. The written line follows the jumps, and a challenge shows it once
    // its goal holds. Its numbers take the colour of the point or the second point they write.
    if (parts.ring) { parts.ring.setAttribute('transform', `translate(${xm(st.base, st)} ${y0})`); parts.ring.setAttribute('aria-valuenow', num(st.base, st)); }
    if (parts.writtenAt) {
      const w = writtenOf(spec, st), order = `${w.ids.a}|${w.ids.b}`;
      if (parts.writtenOrder !== order) {
        const cls = Object.fromEntries(Object.entries(w.ids).filter(([, id]) => id === 'start' || id === 'second').map(([role, id]) => [role, id === 'start' ? 'line-c-point' : 'line-c-second']));
        parts.written = writtenLine({ refs: w.ids, cls }); parts.writtenOrder = order;
        parts.writtenAt.replaceChildren(parts.written.el); parts.written.at(area.w / 2, y0 + g.writtenY);
      }
      parts.written.set(spec.challenge && !solved ? null : w, int);
    }
    if (parts.reading) fit(parts.reading, spec.moved ? T(gapsKey(st)) : words(st), area.w - 24);
    // The marks, their labels and their touch bands stand where the marks stand.
    if (spec.moved) {
      for (const [k, m] of parts.marks) { m.setAttribute('x1', xm(k, st)); m.setAttribute('x2', xm(k, st)); parts.labels.get(k)?.setAttribute('x', xm(k, st)); }
      for (const [k, h] of parts.handles) {
        const a = (xm(k - 1, st) + xm(k, st)) / 2, b = (xm(k, st) + xm(k + 1, st)) / 2;
        h.band.setAttribute('x', a); h.band.setAttribute('width', b - a);
        h.g.setAttribute('aria-valuetext', T(sides(st, k)));
      }
    }
    if (jumps) { jumps.left.disabled = !jump(spec, s, -1); jumps.right.disabled = !jump(spec, s, 1); }
    if (acts.show) acts.show.disabled = s.shown;
    if (acts.next) acts.next.disabled = !s.shown;
    acts.middle?.setAttribute('aria-pressed', s.middle);
  }
  // fit writes the line of words and makes its type smaller where it would run past the stage's sides.
  function fit(text, said, room) {
    if (text.textContent === said) return;
    text.textContent = said; text.style.fontSize = '';
    const long = text.getComputedTextLength();
    if (long > room) text.style.fontSize = `${Math.max(12, 20 * room / long)}px`;
  }
  const words = st => { const r = readingOf(spec, st); return T(r.key, { a: int(r.a), b: int(r.b) }); };

  // goalWords writes a goal's hint or note: its string with its numbers in the page's language, and the calculation of
  // jump-to as the kit writes it.
  const goalWords = ({ key, vars }) => T(key, { ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, int(v)])), calc: target?.sign ? writeWords({ a: target.start, sign: target.sign, b: target.n, open: true }, int) : '' });

  // holds asks the page's goal whether the point is on the target, once the reader has pressed Check.
  const holds = () => goal ? GOALS[spec.challenge.goal].holds({ checked: s.checked, point: num(s.at) }, spec, spec.challenge, target) : { done: false };

  // refresh writes every value that follows the figure, in the readouts, the challenge's line and the text. Every
  // goal speaks with the line and the notes of place.
  function refresh() {
    const st = now(), c = counts(spec, st), ids = measuresOf(spec), w = writtenOf(spec, st), value = id => id === 'gaps' ? T(gapsKey(st)) : id === 'written' ? writeWords(w, int) : id === 'reading' ? (w ? writeReading(w, int, T) : words(st)) : c[id] === null ? DASH : int(c[id]);
    const shows = id => id === 'placed' ? T('placed-of', { n: int(c.placed), all: int(spec.blank.length) }) : value(id);
    for (const k of chips) if (k.set(shows(k.id)) && moving() && !held) motion.flash(k.el);
    if (goal) {
      const r = holds();
      // A goal with a done line of its own says it, such as place-unmarked, which holds near the number.
      // jump-to names its calculation without the answer, from the kit's written line, and has notes of its own.
      const name = spec.challenge.goal, says = { target: int(target.target) }, jumpTo = name === 'jump-to';
      const asks = jumpTo ? T('goal-jump', { start: int(target.start), calc: writeWords({ a: target.start, sign: target.sign, b: target.n, open: true }, int) }) : T(`goal-${name}`, says) ?? T('goal-place', says);
      goal.say(r.done ? T(`goal-${name}-done`, says) ?? T('goal-place-done', says) : asks);
      if (goal.show(r.done, r.note ? goalWords(GOALS[name].note(target, r.note, { point: num(s.at) })) : undefined) && moving() && parts?.points.point) motion.pop(parts.points.point.lastElementChild);
    }
    live(host, { value: id => ids.includes(id) ? value(id) : null });
  }

  // The panel holds the challenge's line, the step picker, the jump buttons, Check and the readouts. The two jump
  // buttons keep to one row.
  function drawPanel() {
    const jumper = (dir, key, sign) => {
      const b = h('button', { type: 'button', class: 'hesap-btn line-jump', 'data-act': key }, dir < 0 ? [h('b', { 'aria-hidden': 'true' }, sign), h('span', {}, T(key))] : [h('span', {}, T(key)), h('b', { 'aria-hidden': 'true' }, sign)]);
      b.addEventListener('click', () => press(dir));
      return b;
    };
    jumps = spec.jump ? { left: jumper(-1, 'jump-left', '−'), right: jumper(1, 'jump-right', '+') } : null;
    const ctls = [];
    // A pick of the step keeps the gaps, the point's mark and its jumps, and writes every label again.
    if (spec.stepCtl) ctls.push(segment({ id: 'step', label: T('step'), items: spec.stepCtl.items.map(v => [v, int(v)]), value: s.step, pick: v => { s = pick(s, Number(v)); build(); } }));
    if (jumps) ctls.push(h('div', { class: 'line-jumps' }, [jumps.left, jumps.right]));
    // Middle draws the middle's mark and takes it away. Show reveals where the number to find is, and Next asks for
    // the next number of the list once the reader has seen this one.
    acts = {};
    const act = (key, change, primary = false) => button({ label: T(key), act: key, primary, press: () => { settle(); s = change(s); paint(); } });
    if (spec.middle === 'button') ctls.push(acts.middle = act('middle', toggleMiddle));
    // The estimate steps or slides, and moves its mark. The book names its Show button for the book.
    if (spec.estimateCtl) {
      const c = spec.estimateCtl, opts = { id: 'estimate', label: T('estimate'), min: c.lo, max: c.hi, value: s.estimate, write: int };
      const change = v => { s = setEstimate(s, v); paint(); };
      ctls.push(c.kind === 'stepper' ? stepper({ ...opts, change }) : slider({ ...opts, input: change }));
    }
    if (spec.find != null || spec.estimate != null) ctls.push(acts.show = act(spec.look === 'book' ? 'open-book' : 'show', reveal, true));
    if (findsOf(spec).length > 1) ctls.push(acts.next = act('next', st => next(spec, st)));
    // New line draws another line with its labels, boxes and cards, and takes every placed card back.
    if (base.draw) ctls.push(button({ label: T('new-line'), act: 'new-line', press: () => { deal(); drawPanel(); build(); } }));
    goal = null;
    if (spec.challenge) {
      const name = spec.challenge.goal;
      goal = goalRow({ T, motion: moving() ? motion : null, hint: on => on ? goalWords(GOALS[name].hint(target, spec)) : null, another: () => { deal(); drawPanel(); build(); } });
      ctls.push(check({ T, press: () => { if (!s.checked) { s = { ...s, checked: true }; paint(); } } }));
    }
    // A find page shows the number to place in a Find readout of its own, before the readouts it names.
    const ids = [...new Set([...(spec.find != null ? ['find'] : []), ...spec.readout])].filter(id => readoutsOf(spec).includes(id));
    // The written line's words take the kit's name, In words.
    chips = ids.map(id => chip({ id, label: T(id === 'reading' && spec.written ? 'written-reading' : id), short: T(`${id}-short`), cls: ['written', 'reading'].includes(id) ? 'line-chip-wide' : '' }));
    for (const k of chips) k.width(k.id === 'placed' ? 6 : 3);
    panel.replaceChildren(...[goal?.el, ctls.length ? row('ctls', ctls) : null, chips.length ? row('out', chips) : null].filter(Boolean));
  }
  // deal sets the page's state as it opens. A challenge draws its target, another one each time, and a goal that
  // draws its line gives the page that line.
  function deal() {
    looking = false; clearTimeout(timer); solved = false;
    const c = base.challenge, g = c ? GOALS[c.goal] : null;
    target = g ? another(g, c, base, dice(fresh()), target) : null;
    spec = g?.page ? { ...base, ...g.page(target) } : base;
    // A page with draw takes a line of label cards drawn at random, another one at each New line.
    if (base.draw) { drawn = drawLine(dice(fresh()), drawn); spec = { ...base, from: drawn.from, to: drawn.to, step: drawn.step, labels: drawn.labels, blank: drawn.blank, cards: drawn.cards, point: false }; }
    s = opening(spec); kb = null;
    // The cards of cards: true come in a new order each time, never the order of their marks.
    if (spec.cards === true) s = { ...s, cards: shuffled(s.cards, dice(fresh())) };
  }

  function point(id, on) {
    if (!spec) return;
    for (const part of svg.querySelectorAll(`[data-ref="${id}"]`)) part.classList.toggle('line-hot', on);
    parts?.written?.light(id, on, ['written', 'reading']);
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }

  return {
    show(page) { fx.stop(); base = page; target = null; drawn = null; held = null; glide = null; deal(); drawPanel(); build(); },
    hide() { fx.stop(); clearTimeout(timer); base = null; spec = null; geo = null; parts = null; held = null; glide = null; goal = null; svg.replaceChildren(); },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); build(); },
  };
}
