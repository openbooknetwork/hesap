// The match scene: two rows of objects paired one to one. The reader draws a line between a counter of each row,
// seats a cup on a saucer, steps a row or stops the music of a game of chairs, and the counters left without a
// partner take a ring.
import { ROWS, GOALS_MAX, idOf, roomOf, opening, linesOf, resize, step, lone, won, counts, same, wordsOf, tagKey, measuresOf, wordsLinked, readingOf, verdictOf, differenceOf } from './match-model.js';
import { writtenLine, words, reading } from '../../kit/written.js';
import { signTile, verdictMark, isTile, nextSign, signShown, signOf } from './reading.js';
import { counter, show, put, R, HIT } from './counter.js';
import { rowsOf, cupsOf, scoreOf, BALL, GAP, CLOSE, WIDE } from './match-figures.js';
import { MATCH_GOALS } from './match-goals.js';
import { carry, press } from './move.js';
import { driver } from './driver.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { stepper, slider, chip, button, row as line, check } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { dice, fresh, another } from '../../kit/random.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';

const MAX = 1.7; // A figure grows to at most this scale on a wide stage.
const PAD = 14; // The figure keeps this far from the stage's edges, in pixels.
const SAUCER = 15; // The radius a saucer is drawn round.
const NEAR = 34; // A cup let go this close to a saucer sits on it.
const rowOf = id => id[0] === 't' ? 'top' : 'bottom', at = id => Number(id.slice(1));
const NAMES = 26; // The room above and below the rows of a trail page for the names of the rows.
const tagWide = words => 24 + 8.4 * words.length; // The width of a row's tag round its words.
const SIGNED = { w: 258, h: 70 }; // The room under the rows for the line of two numbers with a sign.
const far = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export default function match({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const back = el('g'), voids = el('g'), wires = el('g'), rings = el('g'), lower = el('g'), upper = el('g', { class: 'counters-layer' });
  // The tag at the end of each row, in the row's colour.
  const tags = Object.fromEntries(ROWS.map(r => { const pop = el('g', { class: 'a' }, [el('rect', { class: 'counters-rowtag-box', rx: 13 }), el('text', { class: 'counters-rowtag-text' })]); return [r, { pop, g: el('g', { class: `counters-rowtag counters-${r === 'top' ? 'a' : 'b'}`, 'data-ref': `${r}-word`, display: 'none' }, [pop]) }]; }));
  const rubber = el('line', { class: 'counters-rubber', display: 'none' });
  const wordPop = el('g', { class: 'counters-word-pop a' }, [el('rect', { class: 'counters-word-box', rx: 15 }), el('text', { class: 'counters-word-text' })]);
  const word = el('g', { class: 'counters-word', display: 'none' }, [wordPop]);
  // The line under the rows of a page with a sign: the top row's number, the sign, the bottom row's number and the
  // mark that says whether the line is true.
  const tile = signTile(), told = verdictMark(), cards = ROWS.map((r, k) => el('rect', { class: `counters-line-card counters-${k ? 'b' : 'a'}`, x: (k ? 132 : 22) - 23, y: -25, width: 46, height: 50, rx: 8, display: 'none' })), nums = Object.fromEntries(ROWS.map((r, k) => [r, el('text', { class: `counters-line-num counters-${k ? 'b' : 'a'}`, 'data-ref': r, x: k ? 132 : 22 })]));
  const signed = el('g', { display: 'none' }, [...cards, nums.top, el('g', { transform: 'translate(77 0)' }, [tile.el]), nums.bottom, el('g', { transform: 'translate(170 0)' }, [told.el])]);
  press(tile.el, () => { if (!spec || !isTile(spec)) return; s.sign = nextSign(s.sign); if (cs) cs.checked = false; changed(); });
  // The written line of the difference of the rows, which stands where the line of a sign page stands.
  const written = writtenLine();
  const svg = el('svg', { class: 'counters-svg' }, [back, voids, wires, rings, lower, upper, tags.top.g, tags.bottom.g, rubber, word, signed, written.el]);
  stage.appendChild(svg);
  // spec is the page. s holds the counters of each row, the lines the reader drew and how far the Spacing slider
  // stands, from 0 to 1. geo holds the places of the figure, nodes the drawn object of each id, pick the counter a
  // tap chose as the first of a pair, hold the cup the reader carries and ringed the ids that wear a ring.
  let spec = null, s = null, geo = null, area = { w: 0, h: 0 }, nodes = new Map(), pick = null, hold = null, over = null;
  // round is the button of the chairs.
  let chips = [], ringed = new Set(), worded = false, round = null, board = null, goals = [];
  // base is the page as written. On a challenge page spec is base with the rows the goal drew, target is the draw,
  // cs says whether the reader has pressed Check, goal is the challenge's line and solved whether the goal holds.
  let base = null, target = null, cs = null, goal = null, solved = false, steps = [];

  const int = n => numbers(lang()).int(n);
  const cups = () => spec.look === 'cups', chairs = () => spec.look === 'chairs', scores = () => spec.look === 'scoreboard';
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  const partner = id => { const k = rowOf(id) === 'top' ? 0 : 1, l = linesOf(spec, s).find(l => l[k] === at(id)); return l ? idOf(ROWS[1 - k], l[1 - k]) : null; };
  const layout = () => scores() ? scoreOf(GOALS_MAX, [T('match-scoreboard-top'), T('match-scoreboard-bottom')]) : cups() ? cupsOf(roomOf(spec, 'top'), roomOf(spec, 'bottom'))
    : rowsOf({ top: roomOf(spec, 'top'), bottom: roomOf(spec, 'bottom'), ...gaps(), tag: tagRoom(), names: spec.trail ? NAMES : 0, line: spec.sign || spec.written ? SIGNED : undefined });
  // The Spacing slider sets the gap of its row up to twice the gap, and a challenge draws one row wide and one close.
  function gaps() {
    if (spec.spread) return { gap: { [spec.spread]: GAP * (1 + s.spread) }, widest: { [spec.spread]: 2 * GAP } };
    if (spec.wide) return { gap: Object.fromEntries(ROWS.map(r => [r, r === spec.wide ? WIDE : CLOSE])) };
    return {};
  }
  // deal sets the rows as the page opens. A challenge draws its rows, and takes its stepper or its sign from its goal.
  function deal() {
    const c = base.challenge;
    spec = base; cs = null; solved = false;
    if (c) { target = another(MATCH_GOALS[c.goal], c, base, dice(fresh()), target); spec = { ...base, ...MATCH_GOALS[c.goal].page(target) }; cs = { checked: false }; }
    s = { ...opening(spec), spread: 0 }; pick = null; worded = false;
  }
  const holds = () => cs ? MATCH_GOALS[base.challenge.goal].holds({ checked: cs.checked, top: s.top, bottom: s.bottom, sign: s.sign }, spec, base.challenge, target) : { done: false };
  const ends = () => solved && MATCH_GOALS[base.challenge.goal].ends;

  // The tag at a row's end gets the room of its longest words in the page's language, with the greatest number a
  // row can count to.
  function tagRoom() {
    if (cs && MATCH_GOALS[base.challenge.goal].ends) return 6 + tagWide(int(roomOf(spec, 'top')));
    if (spec.word !== true) return 0;
    const n = int(Math.max(roomOf(spec, 'top'), roomOf(spec, 'bottom')));
    return 6 + Math.max(...['same', 'more', 'fewer'].map(w => tagWide(T(`tag-${w}`))), ...(spec.tap ? ['more', 'fewer'].map(w => tagWide(T(`tag-${w}-n`, { n }))) : []));
  }

  // build draws the figure to fit the stage and puts every object in its place.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { geo = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    geo = layout();
    const scale = Math.min(MAX, (area.w - 2 * PAD) / geo.w, (area.h - 2 * PAD) / geo.h);
    svg.setAttribute('viewBox', `${geo.w / 2 - area.w / 2 / scale} ${geo.h / 2 - area.h / 2 / scale} ${area.w / scale} ${area.h / scale}`);
    // A trail page names its rows: the top row is the group now, and the bottom row the group before.
    const names = spec.trail ? [['top', 'now', -1], ['bottom', 'before', 1]].map(([r, key, side]) => { const p = geo[r](0), t = el('text', { class: 'counters-row-name', x: p.x - R, y: p.y + side * (R + 17), 'data-ref': r }); t.textContent = T(`row-${key}`); return t; }) : [];
    const drawn = geo.draw(); board = drawn.refs ?? null;
    back.replaceChildren(...drawn.nodes, ...names);
    signed.setAttribute('display', geo.line && spec.sign ? 'inline' : 'none');
    if (geo.line) signed.setAttribute('transform', `translate(${geo.line.x} ${geo.line.y})`);
    if (geo.line && spec.written) written.at(geo.w / 2, geo.line.y); else written.set(null);
    tile.open(isTile(spec), T('sign')); told.show(isTile(spec) && !cs);
    for (const card of cards) card.setAttribute('display', spec.hidden ? 'inline' : 'none');
    for (const n of nodes.values()) n.tween?.pause();
    lower.replaceChildren(); upper.replaceChildren(); voids.replaceChildren(); nodes = new Map(); ringed = new Set();
    for (const r of ROWS) tags[r].pop.lastChild.textContent = '';
    render('jump');
  }

  // where gives the place of every object on show. A cup with a saucer sits on it.
  function where() {
    const out = new Map();
    for (let i = 0; i < s.bottom; i++) out.set(idOf('bottom', i), geo.bottom(i));
    for (let i = 0; i < s.top; i++) {
      const id = idOf('top', i), to = cups() ? partner(id) : null;
      out.set(id, to ? geo.seat(at(to)) : geo.top(i));
    }
    return out;
  }

  // render moves every object to its place. After a change the reader made, objects glide, arrive and leave.
  function render(how) {
    if (!geo) return;
    geo = layout(); solved = holds().done;
    const to = where(), anim = how === 'move' && moving();
    for (const [id, n] of nodes) if (!to.has(id)) {
      nodes.delete(id); n.tween?.pause();
      if (anim) go.vanish(n.pop, () => n.g.remove()); else n.g.remove();
    }
    for (const [id, p] of to) {
      let n = nodes.get(id);
      if (!n) {
        n = make(id); nodes.set(id, n); (rowOf(id) === 'top' ? upper : lower).append(n.g); put(n, p);
        if (anim) go.pop(n.pop);
        continue;
      }
      if (n === hold || (n.at.x === p.x && n.at.y === p.y)) continue;
      n.tween?.pause();
      if (anim) n.tween = go.tween(n.at, { x: p.x, y: p.y }, () => show(n)); else put(n, p);
    }
    paint(to, anim); refresh();
  }

  // make draws a counter, a cup, a saucer, a player or a chair. The reader pairs counters and carries cups. A
  // counter added since a trace page opened carries a plus, and a counter of a tap page has room for its number.
  function make(id) {
    const top = rowOf(id) === 'top';
    if (cups() && !top) return counter('saucer', 'b', SAUCER);
    if (chairs()) return top ? counter('person', 'a', R, at(id)) : counter('chair', 'b');
    if (scores()) return counter('ball', top ? 'a' : 'b', BALL);
    const n = counter(cups() ? 'mug' : 'disc', top ? 'a' : 'b');
    // A counter added since a trace page opened carries a plus in place of the inner ring.
    if (spec.trace && at(id) >= s.base[rowOf(id)]) { n.g.classList.add('counters-added'); n.pop.append(el('path', { class: 'counters-plus', d: 'M -8 0 H 8 M 0 -8 V 8' })); }
    if (spec.tap) {
      n.tagPop = el('g', { class: 'counters-tag-pop' }, [el('rect', { class: 'counters-tag-box', x: -9, y: -9, width: 18, height: 18, rx: 9 }), el('text', { class: 'counters-tag-text' })]);
      n.tag = el('g', { class: 'counters-tag', transform: `translate(${R * 0.8} ${-R * 1.15})`, display: 'none' }, [n.tagPop]);
      n.g.append(n.tag);
      press(n.g, () => numbered(id));
    }
    if (!cups() && spec.pair === 'auto') return n;
    n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button'); n.g.setAttribute('aria-label', T(cups() ? 'cup' : 'kind-disc'));
    n.g.classList.add('counters-moves');
    carry(n.g, cups() ? carried(id, n) : drawn(id, n));
    return n;
  }

  // A drag from a counter draws a line that follows the finger, and the line stays when it is let go on a counter
  // of the other row that has none. A counter that has a line keeps it until a tap takes it away.
  function drawn(id, n) {
    const aim = q => { const to = aimed(id, q); mark(to); return to; };
    const end = () => { rubber.setAttribute('display', 'none'); mark(null); };
    return {
      point: e => svgPoint(svg, e),
      move(q) {
        if (partner(id)) return;
        const to = aim(q), p = to ? nodes.get(to).at : q;
        for (const [k, v] of Object.entries({ x1: n.at.x, y1: n.at.y, x2: p.x, y2: p.y, display: 'inline' })) rubber.setAttribute(k, v);
      },
      drop(q) { const to = q && !partner(id) ? aim(q) : null; end(); if (to) join(id, to); },
      tap() { end(); tapped(id); },
    };
  }
  // aimed gives the counter of the other row under the point q, when it has no line yet.
  function aimed(id, q) {
    let best = null, d = HIT + 4;
    for (const [to, n] of nodes) if (rowOf(to) !== rowOf(id) && !partner(to) && far(n.at, q) < d) { best = to; d = far(n.at, q); }
    return best;
  }
  // mark shows where a line or a cup would land.
  function mark(id) {
    if (over === id) return;
    nodes.get(over)?.g.classList.remove('counters-over'); nodes.get(id)?.g.classList.add('counters-over'); over = id;
  }
  function join(a, b) {
    const [t, u] = rowOf(a) === 'top' ? [a, b] : [b, a];
    s.lines = [...s.lines.filter(l => l[0] !== at(t) && l[1] !== at(u)), [at(t), at(u)]];
    pick = null; changed();
  }
  const part = id => { s.lines = s.lines.filter(l => l[rowOf(id) === 'top' ? 0 : 1] !== at(id)); pick = null; changed(); };
  // A tap on a paired counter takes its line away. A tap on a counter and then on one of the other row pairs them.
  function tapped(id) {
    if (partner(id)) return part(id);
    if (pick && rowOf(pick) !== rowOf(id)) return join(pick, id);
    pick = pick === id ? null : id; changed();
  }

  // The reader carries a cup. Let go on an empty saucer it sits there, and anywhere else it goes back to the tray.
  // A tap sends a cup of the tray to the first empty saucer, and a cup on a saucer back to the tray.
  function carried(id, n) {
    let dx = 0, dy = 0;
    const saucer = p => { let best = null, d = NEAR; for (let j = 0; j < s.bottom; j++) { const to = idOf('bottom', j), free = !partner(to) || partner(to) === id; if (free && far(geo.seat(j), p) < d) { best = to; d = far(geo.seat(j), p); } } return best; };
    const free = () => Array.from({ length: s.bottom }, (_, j) => idOf('bottom', j)).find(to => !partner(to));
    return {
      point: e => svgPoint(svg, e), raise: () => upper.append(n.g),
      start(q) { n.tween?.pause(); hold = n; dx = n.at.x - q.x; dy = n.at.y - q.y; },
      move(q) { put(n, { x: q.x + dx, y: q.y + dy }); mark(saucer(n.at)); },
      drop(q) {
        hold = null;
        const to = q ? saucer(n.at) : partner(id);
        mark(null);
        if (to) join(id, to); else part(id);
      },
      tap() { hold = null; const to = partner(id) ? null : free(); if (to) join(id, to); else part(id); },
    };
  }

  // A tap on a counter left over gives it the next number. A counter that holds its number shakes it once.
  function numbered(id) {
    if (!lone(spec, s)[rowOf(id)].includes(at(id))) return;
    if (s.said.includes(id)) { if (moving()) go.flash(nodes.get(id)?.tagPop); return; }
    s.said = [...s.said, id]; changed();
  }
  // The button of the chairs stops the music, then takes the player left over out with one chair, and starts a new
  // game once one player is left.
  function turn() {
    if (won(spec, s)) s = { ...opening(spec), spread: 0 };
    else if (s.music) s.music = false;
    else s = { ...resize(resize(s, 'top', s.top - 1), 'bottom', s.bottom - 1), music: true };
    changed();
  }
  const turnWords = () => T(won(spec, s) ? 'chairs-again' : s.music ? 'chairs-stop' : 'chairs-next');

  function changed() { render('move'); }

  // paint draws the pair lines, rings the counters without a partner and shows the words between the rows.
  function paint(to, anim) {
    wires.replaceChildren(...(cups() ? [] : linesOf(spec, s).map(([t, b]) => {
      const p = to.get(idOf('top', t)), q = to.get(idOf('bottom', b));
      return el('line', { class: 'counters-wire', 'data-ref': 'pairs', x1: p.x, y1: p.y, x2: q.x, y2: q.y });
    })));
    lightPairs();
    const l = lone(spec, s), ids = l.ringed ? ROWS.flatMap(r => l[r].map(i => idOf(r, i))) : [];
    rings.replaceChildren(...ids.map(id => {
      const p = to.get(id), r = cups() ? (rowOf(id) === 'top' ? R + 9 : 1.5 * SAUCER + 6) : chairs() ? R + 8 : R + 3.5;
      const c = el('circle', { class: 'counters-lone a', 'data-ref': 'unpaired', cx: p.x, cy: p.y, r });
      if (anim && !ringed.has(id)) go.pop(c);
      return c;
    }));
    ringed = new Set(ids);
    for (const [id, n] of nodes) n.g.classList.toggle('counters-picked', id === pick);
    if (spec.trace) voids.replaceChildren(...ROWS.flatMap(r => Array.from({ length: Math.max(0, s.base[r] - s[r]) }, (_, k) => {
      const p = geo[r](s[r] + k);
      return el('circle', { class: 'counters-void', 'data-ref': 'taken', cx: p.x, cy: p.y, r: R - 2 });
    })));
    if (spec.tap) for (const [id, n] of nodes) {
      const k = s.said.indexOf(id), words = k < 0 ? '' : int(k + 1), text = n.tagPop.lastChild, open = k < 0 && ids.includes(id);
      for (const [name, v] of [['tabindex', 0], ['role', 'button'], ['aria-label', T('kind-disc')]]) if (open) n.g.setAttribute(name, v); else n.g.removeAttribute(name);
      if (text.textContent === words) continue;
      text.textContent = words; n.tag.setAttribute('display', words ? 'inline' : 'none');
      if (words && anim) go.pop(n.tagPop);
    }
    if (chairs()) {
      const sway = s.music && !won(spec, s) && moving();
      for (const [id, n] of nodes) if (rowOf(id) === 'top') { n.pop.classList.toggle('counters-sway', sway); n.pop.style.animationDelay = `${-0.35 * (at(id) % 3)}s`; }
      if (won(spec, s)) { const p = to.get(idOf('top', 0)), crown = el('path', { class: 'counters-crown a', d: 'M -10 -17 L -10 -28 L -5 -22 L 0 -30 L 5 -22 L 10 -28 L 10 -17 Z' }); rings.append(el('g', { transform: `translate(${p.x} ${p.y})` }, [crown])); if (anim) go.pop(crown); }
      if (round) round.querySelector('span').textContent = turnWords();
    }
    if (spec.sign) {
      // The scoreboard writes its scores and its sign on the board, and the rows write theirs on the line under them.
      const sign = signShown(spec, s), flash = part => { if (anim) go.flash(part); };
      // The cards of a challenge keep the numbers of the rows face down until the goal holds.
      const shown = r => spec.hidden && !solved ? '?' : int(s[r]);
      for (const r of ROWS) { const t = board?.[r] ?? nums[r]; if (t.textContent !== shown(r)) { const first = !t.textContent; t.textContent = shown(r); if (!first) flash(t); } }
      if (board) { if (board.sign.textContent !== sign) { board.sign.textContent = sign; flash(board.sign); } }
      else {
        if (tile.set(sign)) flash(tile.pop);
        if (isTile(spec) && told.set(signOf(s.top, s.bottom) === sign, T(verdictOf(spec, s)))) flash(told.el);
      }
      for (const [k, b] of goals.entries()) b.disabled = s[ROWS[k]] >= GOALS_MAX;
    }
    if (spec.written) {
      // The greater row's number comes first, in its row's colour, and the counters left over are the answer.
      const d = differenceOf(spec, s), cls = r => `counters-${r === 'top' ? 'a' : 'b'}`;
      if (written.set({ ...d.line, refs: { a: d.greater, b: d.less, c: 'unpaired' }, cls: { a: cls(d.greater), b: cls(d.less) } }, int) && anim) go.flash(written.el);
    }
    // A challenge that writes the numbers of its rows once it is reached uses the tags for them.
    const ws = ends() ? Object.fromEntries(ROWS.map(r => [r, null])) : spec.word === true ? wordsOf(spec, s) : null;
    for (const r of ROWS) {
      const t = tags[r], text = t.pop.lastChild;
      t.g.setAttribute('display', ws ? 'inline' : 'none');
      if (!ws) continue;
      // The tag stands after the last counter of its row, or after the last empty place.
      const words = ws[r] ? T(tagKey(ws[r]), { n: int(ws[r].n ?? 0) }) : int(s[r]), w = tagWide(words), n = Math.max(s[r], spec.trace ? s.base[r] : 0), p = geo[r](Math.max(0, n - 1));
      for (const [k, v] of Object.entries({ x: -w / 2, y: -13, width: w, height: 26 })) t.pop.firstChild.setAttribute(k, v);
      t.g.setAttribute('transform', `translate(${p.x + (n ? R : -R) + 12 + w / 2} ${p.y})`);
      if (text.textContent !== words) { const first = !text.textContent; text.textContent = words; if (anim && !first) go.flash(t.pop); }
    }
    const on = spec.word === 'same' && same(spec, s);
    word.setAttribute('display', on ? 'inline' : 'none');
    if (on) {
      const text = T('word-same'), w = 30 + 9.4 * text.length, xs = [...to.values()].map(p => p.x);
      wordPop.lastChild.textContent = text;
      for (const [k, v] of Object.entries({ x: -w / 2, y: -15, width: w, height: 30 })) wordPop.firstChild.setAttribute(k, v);
      word.setAttribute('transform', `translate(${(Math.min(...xs) + Math.max(...xs)) / 2} ${geo.mid})`);
      if (anim && !worded) go.pop(wordPop);
    }
    worded = on;
  }

  // refresh writes every value that follows the rows, in the readouts and the text: the counts and the words of the
  // tags.
  function refresh() {
    const st = counts(spec, s), ids = measuresOf(spec), ws = wordsLinked(spec).length ? wordsOf(spec, s) : null;
    const said = { reading: () => spec.written ? reading(differenceOf(spec, s).line, int, T) : T(readingOf(spec, s), { a: int(s.top), b: int(s.bottom) }),
      written: () => words(differenceOf(spec, s).line, int), verdict: () => T(verdictOf(spec, s)) }, value = id => said[id]?.() ?? int(st[id]);
    for (const k of chips) if (k.set(value(k.id)) && moving()) go.flash(k.el);
    judge();
    live(host, { value: id => ids.includes(id) ? value(id) : wordsLinked(spec).includes(id) ? T(tagKey(ws[id.split('-')[0]]), { n: int(ws[id.split('-')[0]].n ?? 0) }) : null });
  }

  // judge writes a challenge's line and whether its goal holds. The counters swell the first time it does.
  function judge() {
    if (!goal) return;
    const name = base.challenge.goal, r = holds();
    goal.say(T(`goal-${name}`));
    for (const st of steps) st.show(r.done);
    if (goal.show(r.done, r.note ? T(`note-${name}-${r.note}`) : undefined) && moving()) go.cheer([...nodes.values()].map(n => n.pop));
  }

  // The panel holds a stepper for each row that has one, the Spacing slider, the button of the chairs and the
  // readouts.
  function drawPanel() {
    // A challenge keeps the number of its stepper out of sight until the goal holds.
    const ctls = ROWS.filter(r => spec[`${r}Ctl`]).map(r => stepper({ shown: !cs || solved, id: r, label: T(`ctl-${r}`), min: spec[`${r}Ctl`].lo, max: spec[`${r}Ctl`].hi, value: s[r], write: int,
      change: v => { s = step(spec, s, r, v); pick = null; if (cs) cs.checked = false; changed(); } }));
    steps = [...ctls];
    if (spec.spread) ctls.push(slider({ id: 'spread', label: T('ctl-spread'), min: 0, max: 100, value: s.spread * 100, output: false,
      write: v => `×${numbers(lang()).fmt(1 + v / 100)}`, input: v => { s.spread = v / 100; render('jump'); } }));
    round = chairs() ? button({ label: turnWords(), act: 'round', primary: true, press: turn }) : null;
    if (round) ctls.push(round);
    // The scoreboard has a button for a goal of each team and one for a new match.
    goals = scores() ? ROWS.map(r => button({ label: T(`score-${r}`), act: `score-${r}`, press: () => { if (s[r] < GOALS_MAX) { s = resize(s, r, s[r] + 1); changed(); } } })) : [];
    if (scores()) ctls.push(...goals, button({ label: T('new-match'), act: 'new-match', press: () => { s = { ...opening(spec), spread: 0 }; changed(); } }));
    // The line of words takes a line of the panel to itself, so the panel keeps its height as the words change.
    chips = spec.readout.map(id => chip({ id, label: T(`match-${spec.trail ? 'trail' : spec.look}-${id}`) ?? T(`match-${id}`) ?? T(id), cls: ['reading', 'written'].includes(id) ? 'counters-chip-wide' : '' }));
    for (const k of chips) if (!['reading', 'written'].includes(k.id)) k.width(k.id === 'verdict' ? 5 : 2);
    // A challenge has its line with Another one and a hint, and a Check button beside its controls.
    goal = null;
    if (cs) {
      const name = base.challenge.goal;
      goal = goalRow({ T, motion: moving() ? fx : null, hint: on => on ? T(`hint-${name}`) : null, another: () => { deal(); drawPanel(); build(); if (!geo) refresh(); } });
      ctls.push(check({ T, press: () => { if (!cs.checked) { cs.checked = true; render('move'); if (!geo) refresh(); } } }));
    }
    panel.replaceChildren(...[goal?.el, ctls.length ? line('ctls', ctls) : null, chips.length ? line('out', chips) : null].filter(Boolean));
  }

  // pairsLit says the reader points at the link pairs, which lights each pair line and the counters at its ends.
  let pairsLit = false;
  function lightPairs() {
    const paired = new Set(linesOf(spec, s).flatMap(([t, b]) => [idOf('top', t), idOf('bottom', b)]));
    for (const [id, n] of nodes) n.g.classList.toggle('counters-paired-lit', pairsLit && paired.has(id));
    for (const w of wires.children) w.classList.toggle('counters-hot', pairsLit);
  }
  function point(id, on) {
    if (!spec) return;
    written.light(id, on, ['written', 'reading']);
    if (id === 'pairs') { pairsLit = on; lightPairs(); }
    for (const part of svg.querySelectorAll(`[data-ref="${id}"]`)) part.classList.toggle('counters-hot', on);
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }
  function stop() { for (const n of nodes.values()) n.tween?.pause(); hold = null; over = null; rubber.setAttribute('display', 'none'); }

  return {
    show(page) {
      stop(); pairsLit = false; base = page; target = null; deal();
      drawPanel(); build();
      if (!geo) refresh();
    },
    hide() {
      stop(); spec = null; base = null; cs = null; goal = null; geo = null; nodes = new Map();
      for (const g of [back, voids, wires, rings, lower, upper]) g.replaceChildren();
      for (const g of [word, tags.top.g, tags.bottom.g, signed]) g.setAttribute('display', 'none');
      for (const r of ROWS) nums[r].textContent = '';
      written.set(null);
    },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); build(); if (!geo) refresh(); },
  };
}
