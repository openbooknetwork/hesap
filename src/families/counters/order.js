// The order scene: two numbers compared and three numbers put in order. The reader moves two markers along one
// count of 100, lays two numbers out as blocks of rows of ten, or drags three number cards into places.
import { ROWS, CARDS, opening, isCards, counts, decides, between, ordered, measuresOf, readingOf, verdictOf, pinShift, drawCards } from './order-model.js';
import { readingLine, signTile, verdictMark, isTile, nextSign, signShown, signOf } from './reading.js';
import { show, put, R } from './counter.js';
import { rows } from './count-figures.js';
import { dot, block, card, BLOCK, CARD } from './order-figures.js';
import { txt } from './figures.js';
import { carry, press } from './move.js';
import { driver } from './driver.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { slider, stepper, chip, button, row as line } from '../../kit/panel.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh } from '../../kit/random.js';

const PAD = 14; // The figure keeps this far from the stage's edges, in pixels.
// The top number is the first number, in red, and the bottom number the second, in blue. The colour is a second
// cue: the first number stands left or above, and the second right or below.
const COLOUR = { top: 'a', bottom: 'b' };
const LINE = 44; // The room under a figure for the line of words.
const far = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export default function order({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const svg = el('svg', { class: 'counters-svg' });
  stage.appendChild(svg);
  // spec is the page and s its numbers, or the places of its cards. fig is the figure as drawn: its size, the
  // greatest scale it takes and a paint that follows s. reveal is the button of a covered page.
  let spec = null, s = null, fig = null, area = { w: 0, h: 0 }, chips = [], reveal = null, cards = [];

  const int = n => numbers(lang()).int(n);
  const words = () => T(readingOf(spec, s), { a: int(s.top), b: int(s.bottom) });
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // build draws the page's figure to fit the stage.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    for (const c of cards) c.tween?.pause();
    cards = [];
    if (!area.w || !area.h) { fig = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    fig = isCards(spec) ? cardsFig() : spec.show === 'count' ? countFig() : blocksFig();
    const scale = Math.min(fig.max, (area.w - 2 * PAD) / fig.w, (area.h - 2 * PAD) / fig.h);
    svg.setAttribute('viewBox', `${fig.w / 2 - area.w / 2 / scale} ${fig.h / 2 - area.h / 2 / scale} ${area.w / scale} ${area.h / scale}`);
    svg.replaceChildren(...fig.nodes);
    fig.paint(false); refresh();
  }

  // One count of 100 in rows of ten with a marker on each number. The counters up to the less number are filled
  // grey. The counters after it up to the greater number are hollow, with a heavy outline in that number's colour.
  function countFig() {
    const top = 18, tray = rows(100)[0], d = tray.draw(0, top), at = i => d.places.slots.pos(i);
    for (const l of d.refs.labels) l.t.textContent = int(l.n);
    const dots = Array.from({ length: 100 }, (_, i) => dot('b', R, at(i)));
    // A marker is a frame round its counter and a pin that holds the number. The first number has a ring and a round
    // pin above its counter, the second a square frame and a square pin below, so the two differ without their colours.
    const pins = ROWS.map((r, k) => {
      const half = R + 5.5, ring = k ? el('rect', { class: `counters-pin-ring counters-${COLOUR[r]}`, width: 2 * half, height: 2 * half, rx: 4 }) : el('circle', { class: `counters-pin-ring counters-${COLOUR[r]}`, r: R + 2.5 });
      const box = el('rect', { class: 'counters-pin-box', y: -10, height: 20, rx: k ? 3 : 10 }), num = el('text', { class: 'counters-pin-num' });
      return { r, k, ring, box, num, g: el('g', { class: `counters-pin counters-${COLOUR[r]}`, 'data-ref': r }, [box, num]) };
    });
    const said = readingLine(tray.tray / 2, top + tray.h + LINE / 2 + 4);
    said.show(spec.reading);
    return {
      w: tray.w, h: top + tray.h + (spec.reading ? LINE : 0), max: 1.7,
      nodes: [...d.nodes, ...dots, ...pins.map(p => p.ring), ...pins.map(p => p.g), said.el],
      paint() {
        const lo = Math.min(s.top, s.bottom), hi = Math.max(s.top, s.bottom), big = COLOUR[s.top > s.bottom ? 'top' : 'bottom'];
        dots.forEach((g, i) => { const cls = `counters-counter ${i < lo ? 'counters-both' : i < hi ? `counters-${big} counters-hollow` : 'counters-pale'}`; if (g.getAttribute('class') !== cls) g.setAttribute('class', cls); });
        const shift = pinShift(s);
        for (const p of pins) {
          const c = at(s[p.r] - 1), text = int(s[p.r]), w = 14 + 8 * text.length;
          if (p.k) { p.ring.setAttribute('x', c.x - R - 5.5); p.ring.setAttribute('y', c.y - R - 5.5); } else { p.ring.setAttribute('cx', c.x); p.ring.setAttribute('cy', c.y); }
          p.num.textContent = text; p.box.setAttribute('x', -w / 2); p.box.setAttribute('width', w);
          p.g.setAttribute('transform', `translate(${c.x + shift[p.r] * (w / 2 + 1)} ${c.y + (p.k ? 1 : -1) * R * 1.3})`);
        }
        said.say(words());
      },
    };
  }

  // Two blocks side by side, each a number in rows of ten. A frame surrounds the rows that decide, and a covered
  // page hides the rows, the frame and the line until the reader asks for them.
  function blocksFig() {
    const tiled = isTile(spec), between = tiled ? 62 : 28, w = 2 * BLOCK.w + between, blocks = ROWS.map((r, k) => ({ r, ...block(r, COLOUR[r], k * (BLOCK.w + between)) }));
    const said = readingLine(w / 2, BLOCK.h + LINE / 2 + 4), low = BLOCK.h + (spec.reading ? LINE : 0);
    // The sign tile stands between the two numbers, and the mark that says true or false under the blocks.
    const tile = signTile(74), mark = verdictMark(), extra = [];
    if (tiled) {
      extra.push(el('g', { transform: `translate(${w / 2} ${BLOCK.num})` }, [tile.el]), el('g', { transform: `translate(${w / 2 - 44} ${low + 24})` }, [mark.el]));
      tile.open(true, T('sign'));
      press(tile.el, () => { s.sign = nextSign(s.sign); fig.paint(true); refresh(); });
    }
    return {
      w, h: low + (tiled ? 44 : 0), max: 2.4,
      nodes: [...blocks.flatMap(b => b.nodes), said.el, ...extra],
      paint(anim) {
        const kind = spec.decide && s.open ? decides(s) : null;
        for (const b of blocks) { b.set(s[b.r], int(s[b.r])); b.frame(kind, s[b.r]); b.cover(!s.open); }
        said.show(spec.reading && s.open); said.say(words());
        if (reveal) reveal.disabled = s.open;
        if (tiled) { const turned = tile.set(signShown(spec, s)), told = mark.set(signOf(s.top, s.bottom) === s.sign, T(verdictOf(spec, s))); if (anim && moving()) { if (turned) go.flash(tile.pop); if (told) go.flash(mark.el); } }
      },
    };
  }

  // Three number cards in a tray above three places. A card let go on a place sits there and trades with a card
  // that holds the place, and anywhere else it goes back to the tray. A tap sends a card to the first empty place,
  // or back to the tray.
  function cardsFig() {
    const gap = 22, edge = 12, w = CARDS * CARD.w + (CARDS - 1) * gap + 2 * edge, trayH = CARD.h + 2 * edge, py = trayH + 50 + CARD.h / 2;
    const x = k => edge + k * (CARD.w + gap) + CARD.w / 2, home = i => ({ x: x(i), y: trayH / 2 }), spot = k => ({ x: x(k), y: py });
    const posOf = i => s.place[i] == null ? home(i) : spot(s.place[i]);
    const labels = [txt('counters-place-word', x(0), trayH + 32, T('least')), txt('counters-place-word', x(CARDS - 1), trayH + 32, T('greatest'))];
    const places = Array.from({ length: CARDS }, (_, k) => el('rect', { class: 'counters-place', x: x(k) - CARD.w / 2, y: py - CARD.h / 2, width: CARD.w, height: CARD.h, rx: 9 }));
    const says = Array.from({ length: CARDS - 1 }, (_, k) => txt('counters-between', (x(k) + x(k + 1)) / 2, py + CARD.h / 2 + 22));
    const frame = el('rect', { class: 'counters-decide', x: edge - 6, y: py - CARD.h / 2 - 6, width: w - 2 * edge + 12, height: CARD.h + 12, rx: 12, display: 'none' });
    const tick = el('path', { class: 'counters-tick a', d: 'M -9 0 l 6 7 l 12 -14', display: 'none' }), tickAt = el('g', { transform: `translate(${x(1)} ${trayH + 30})` }, [tick]);
    const layer = el('g', { class: 'counters-layer' });
    let hold = null, done = false;
    const sit = (i, k) => { const j = s.place.indexOf(k); if (j >= 0 && j !== i) s.place[j] = s.place[i]; s.place[i] = k; };
    cards = s.cards.map((n, i) => {
      const pop = el('g', { class: 'counters-pop a' }, card(n, int(n))), g = el('g', { class: 'counters-card counters-moves', tabindex: 0, role: 'button', 'aria-label': int(n) }, [pop]);
      const c = { g, pop, at: { x: 0, y: 0 } };
      let dx = 0, dy = 0;
      carry(g, {
        point: e => svgPoint(svg, e), raise: () => layer.append(g),
        start(q) { c.tween?.pause(); hold = c; dx = c.at.x - q.x; dy = c.at.y - q.y; },
        move(q) { put(c, { x: q.x + dx, y: q.y + dy }); },
        drop(q) {
          hold = null;
          if (q) { const k = Array.from({ length: CARDS }, (_, k) => k).sort((a, b) => far(spot(a), c.at) - far(spot(b), c.at))[0]; if (far(spot(k), c.at) < CARD.h * 0.6) sit(i, k); else s.place[i] = null; }
          fig.paint(true);
        },
        tap() { hold = null; const free = Array.from({ length: CARDS }, (_, k) => k).find(k => !s.place.includes(k)); s.place[i] = s.place[i] == null && free !== undefined ? free : null; fig.paint(true); },
      });
      put(c, posOf(i)); layer.append(g);
      return c;
    });
    return {
      w, h: py + CARD.h / 2 + 38, max: 1.7,
      nodes: [el('rect', { class: 'counters-tray', x: 0, y: 0, width: w, height: trayH, rx: 12 }), ...labels, ...places, frame, tickAt, ...says, layer],
      paint(anim) {
        const glide = anim && moving();
        cards.forEach((c, i) => {
          const p = posOf(i);
          if (c === hold || (c.at.x === p.x && c.at.y === p.y)) return;
          c.tween?.pause();
          if (glide) c.tween = go.tween(c.at, p, () => show(c)); else put(c, p);
        });
        says.forEach((t, k) => { const rel = between(spec, s, k), text = rel ? T(`is-${rel}`) : ''; if (t.textContent !== text) { t.textContent = text; if (text && glide) go.flash(t); } });
        const now = ordered(spec, s);
        for (const part of [frame, tick]) part.setAttribute('display', now ? 'inline' : 'none');
        if (now && !done && glide) { go.pop(tick); go.cheer(cards.map(c => c.pop)); }
        done = now;
      },
    };
  }

  // refresh writes every value that follows the numbers, in the readouts and the text.
  function refresh() {
    const st = counts(spec, s), ids = measuresOf(spec), value = id => id === 'reading' ? words() : id === 'verdict' ? T(verdictOf(spec, s)) : int(st[id]);
    for (const k of chips) if (k.set(value(k.id)) && moving()) go.flash(k.el);
    live(host, { value: id => ids.includes(id) ? value(id) : null });
  }
  // A change of a number closes the covers of a covered page.
  function set(r, v) { s[r] = v; if (spec.cover) s.open = false; fig?.paint(true); refresh(); }

  // The panel holds a slider or a stepper for each number that has one, the button of a covered page and the readouts.
  function drawPanel() {
    const ctls = isCards(spec) ? [] : ROWS.filter(r => spec[`${r}Ctl`]).map(r => {
      const c = spec[`${r}Ctl`], opts = { id: r, label: T(`order-${r}`), min: c.lo, max: c.hi, value: s[r], write: int };
      if (c.kind === 'stepper') return stepper({ ...opts, change: v => set(r, v) });
      const sl = slider({ ...opts, input: v => set(r, v) }); sl.width(3);
      return sl;
    });
    // New numbers puts three other cards in the tray and empties the places.
    if (spec.draw) ctls.push(button({ label: T('new-numbers'), act: 'new-numbers', press: () => { s = { ...opening(spec), cards: drawCards(dice(fresh()), s.cards) }; build(); } }));
    reveal = spec.cover ? button({ label: T('show-rows'), act: 'reveal', primary: true, press: () => { s.open = true; fig?.paint(true); refresh(); } }) : null;
    // The line of words takes a line of the panel to itself, so the panel keeps its height as the words change.
    chips = spec.readout.map(id => chip({ id, label: T(`order-${id}`) ?? T(`match-${id}`), cls: id === 'reading' ? 'counters-chip-wide' : '' }));
    for (const k of chips) if (k.id !== 'reading') k.width(k.id === 'verdict' ? 5 : 3);
    panel.replaceChildren(...[ctls.length ? line('ctls', ctls) : null, reveal ? line('acts', [reveal]) : null, chips.length ? line('out', chips) : null].filter(Boolean));
  }

  function point(id, on) {
    if (!spec) return;
    for (const part of svg.querySelectorAll(`[data-ref="${id}"]`)) part.classList.toggle('counters-hot', on);
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }

  return {
    // A page that asks for a draw and names no cards opens on a draw, a new one each time.
    show(page) { spec = page; s = opening(spec); if (spec.draw && !spec.cards) s.cards = drawCards(dice(fresh())); drawPanel(); build(); if (!fig) refresh(); },
    hide() { for (const c of cards) c.tween?.pause(); cards = []; spec = null; fig = null; svg.replaceChildren(); },
    point,
    lang() { if (!spec) return; drawPanel(); build(); if (!fig) refresh(); },
  };
}
