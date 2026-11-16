// The count scene: objects counted one by one. The reader taps an object to give it the next number, counts on from
// a closed box, takes counters out of a tray, steps a marker through rows of ten, fills a bus and climbs a staircase.
import { modeOf, sizeOf, counts, contextOf, measuresOf, SEATS, STEPS, SIDES } from './count-model.js';
import { COUNT_GOALS, APPLES, LOOSE, countStart } from './count-goals.js';
import { another } from './goals.js';
import { counter, show, put, R } from './counter.js';
import { arrange } from './places.js';
import { place, rows, boxRow, pile, basket, bus, stairs, sides } from './count-figures.js';
import { carry, press } from './move.js';
import { driver } from './driver.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { nudge } from '../../kit/drag.js';
import { stepper, chip, button, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh } from '../../kit/random.js';

const MAX = 1.7; // A figure grows to at most this scale on a wide stage.
const PAD = 14; // The figure keeps this far from the stage's edges, in pixels.
// The object each look counts, and the colour it takes.
const KIND = { tray: 'disc', stall: 'apple', wire: 'bird', sand: 'shell', bus: 'person', stairs: 'walker' };
const COLOUR = { apple: 'a' };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function count({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const back = el('g'), trail = el('polyline', { class: 'counters-trail' }), layer = el('g', { class: 'counters-layer' });
  const svg = el('svg', { class: 'counters-svg' }, [back, trail, layer]);
  stage.appendChild(svg);
  // spec is the page. s holds its objects: the ids of the fixed places and whether each object is there, the ids of
  // each list, the seats of the bus, the numbers on each object and where the reader dragged one. geo holds the places
  // of the figure as drawn, nodes the drawn object of each id and gaps the empty place of each fixed place. target
  // is a challenge's draw, and cs the reader's answer to it.
  let spec = null, s = null, geo = null, area = { w: 0, h: 0 }, nodes = new Map(), gaps = [], seq = 0, hold = null;
  let goal = null, chips = [], target = null, cs = null;

  const int = n => numbers(lang()).int(n);
  const label = id => T(`${contextOf(spec)}-${id}`) ?? T(id);
  const modeNow = () => spec.challenge?.goal ?? modeOf(spec);
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // begin sets the objects as the page opens, and draws a new target on a challenge page.
  function begin() {
    seq = 0; hold = null;
    s = { ids: [], here: [], lists: { beside: [], pile: [], basket: [], stop: [] }, seats: Array(SEATS).fill(null), tags: new Map(), free: new Map(),
      said: 0, last: 0, box: spec.box ?? 0, marker: spec.marker ?? 0, step: spec.step ?? 0, whole: false };
    const fill = n => Array.from({ length: n }, () => `o${seq++}`);
    const fixed = n => { s.ids = fill(n); s.here = s.ids.map(() => true); };
    const c = spec.challenge;
    if (c) {
      target = another(COUNT_GOALS[c.goal], c, spec, dice(fresh()), target);
      cs = countStart(spec, target);
      if (c.goal === 'fill-basket') s.lists.pile = fill(APPLES);
      else if (c.goal === 'count-on') { s.box = target.box; s.lists.pile = fill(LOOSE); }
      else fixed(target.start);
      return;
    }
    const mode = modeOf(spec);
    if (mode === 'bus') { fill(spec.n).forEach((id, i) => { s.seats[i] = id; }); s.lists.stop = fill(spec.waiting); }
    else if (mode === 'pile') s.lists.pile = fill(spec.pile);
    else if (mode === 'stairs') s.ids = [];
    else fixed(sizeOf(spec));
    if (spec.counted) { s.ids.forEach((id, i) => s.tags.set(id, [i + 1])); s.said = s.ids.length; s.whole = true; }
  }

  const kindOf = id => id === 'walker' ? 'walker' : spec.challenge ? (spec.challenge.goal === 'fill-basket' ? 'apple' : 'disc') : KIND[spec.look];
  // homeOf names the list or the seats an object is in, and otherOf the place a tap sends it to.
  const homeOf = id => s.seats.includes(id) ? 'seats' : Object.keys(s.lists).find(k => s.lists[k].includes(id));
  const otherOf = from => ({ pile: spec.challenge?.goal === 'fill-basket' ? 'basket' : 'beside', beside: 'pile', basket: 'pile', stop: 'seats', seats: 'stop' })[from];

  // measure counts the objects. A challenge shows no counts, so its answer stays hidden.
  function measure() {
    if (spec.challenge) return {};
    return counts(spec, { tags: s.ids.map(id => s.tags.get(id) ?? []), here: s.here, said: s.said, last: s.last, beside: s.lists.beside.length,
      box: s.box, marker: s.marker, step: s.step, riders: s.seats.filter(Boolean).length });
  }

  // blocksOf lists the blocks of the figure, each with the ways it can be set out.
  function blocksOf() {
    const mode = modeNow();
    if (mode === 'fill-basket') return [basket(APPLES, T('basket')), pile(APPLES, T('pile'))];
    if (mode === 'count-on') return [boxRow(LOOSE), pile(LOOSE, T('pile'))];
    if (mode === 'count-back') return [rows(target.start)];
    if (mode === 'bus') return [bus(T('stop-sign'))];
    if (mode === 'stairs') return [stairs()];
    if (mode === 'pile') return [boxRow(spec.pile), pile(spec.pile, T('pile'))];
    if (mode === 'sides') return [rows(100), sides(T('one-less'), T('one-more'))];
    if (spec.box != null) return [boxRow(sizeOf(spec))];
    return [spec.rows ? rows(sizeOf(spec)) : place(spec.look, sizeOf(spec))];
  }

  // build draws the figure to fit the stage and puts every object in its place.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { geo = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    const best = arrange(blocksOf(), Math.max(1, area.w - 2 * PAD), Math.max(1, area.h - 2 * PAD)), scale = Math.min(MAX, best.scale);
    const cx = best.w / 2, cy = best.h / 2;
    svg.setAttribute('viewBox', `${cx - area.w / 2 / scale} ${cy - area.h / 2 / scale} ${area.w / scale} ${area.h / scale}`);
    geo = { places: {}, refs: { press: [] } };
    const drawn = [];
    for (const it of best.items) {
      const d = it.v.draw(it.x, it.y), { press: presses = [], ...refs } = d.refs ?? {};
      drawn.push(...d.nodes); Object.assign(geo.places, d.places ?? {}); Object.assign(geo.refs, refs); geo.refs.press.push(...presses);
    }
    gaps = gapsOf();
    // A sides page outlines the place of the next counter, and a tap on an outer tile steps the group to its number.
    geo.next = modeNow() === 'sides' ? el('circle', { class: 'counters-next', r: R - 2 }) : null;
    for (const [id, by] of [['before', -1], ['after', 1]]) if (geo.refs.tiles) press(geo.refs.tiles[id].g, () => stepTo(s.ids.length + by));
    back.replaceChildren(...drawn, ...gaps, ...(geo.next ? [geo.next] : []));
    for (const n of nodes.values()) n.tween?.pause();
    layer.replaceChildren(); nodes = new Map();
    for (const p of geo.refs.press) press(p, () => { const from = p.dataset.place, id = s.lists[from].at(-1); if (id) moveTo(id, otherOf(from)); });
    render('jump');
  }

  // gapsOf gives an empty place for each fixed place on a page where counters leave the tray. A tap on an empty
  // place puts its counter back.
  function gapsOf() {
    if (!['take', 'count-back'].includes(modeNow())) return [];
    return s.ids.map((id, i) => {
      const p = geo.places.slots.pos(i), g = el('circle', { class: 'counters-gap', cx: p.x, cy: p.y, r: R - 2, tabindex: 0, role: 'button', 'aria-label': T('gap') });
      press(g, () => { if (!s.here[i]) { s.here[i] = true; changed(); } });
      return g;
    });
  }

  // where gives the place of every object on show.
  function where() {
    const out = new Map(), P = geo.places;
    if (P.slots && s.ids.length) s.ids.forEach((id, i) => { if (s.here[i]) out.set(id, freeAt(id) ?? P.slots.pos(i)); });
    for (const name of Object.keys(s.lists)) if (P[name]) s.lists[name].forEach((id, i) => out.set(id, P[name].pos(i)));
    if (P.seats) s.seats.forEach((id, i) => { if (id) out.set(id, P.seats.pos(i)); });
    if (P.steps) out.set('walker', P.steps.pos(s.step));
    return out;
  }
  // A dragged object keeps its place in the tray as a share of the tray's width and height, so it stays put when
  // the figure is drawn again at another size.
  function freeAt(id) {
    const f = s.free.get(id), b = geo.places.slots.box;
    return f && b ? { x: b.x + f.u * b.w, y: b.y + f.v * b.h } : null;
  }

  // render moves every object to its place. After a change the reader made, objects glide, arrive and leave.
  function render(how) {
    if (!geo) return;
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
      if (anim) n.tween = go.tween(n.at, { x: p.x, y: p.y }, () => show(n), id === 'walker' ? 260 : 380); else put(n, p);
    }
    paint(anim); refresh();
  }

  // make draws an object with room for its numbers, and lets the reader tap it or carry it where the page allows.
  function make(id) {
    const kind = kindOf(id), n = counter(kind, COLOUR[kind] ?? 'b', kind === 'walker' ? 22 : R, Number(id.slice(1)) || 0);
    if (kind !== 'walker') {
      const box = el('rect', { class: 'counters-tag-box', x: -9, y: -9, width: 18, height: 18, rx: 9 }), text = el('text', { class: 'counters-tag-text' });
      n.tagPop = el('g', { class: 'counters-tag-pop' }, [box, text]);
      n.tag = el('g', { class: 'counters-tag', transform: `translate(${R * 0.8} ${-R * 1.15})`, display: 'none' }, [n.tagPop]);
      n.g.append(n.tag);
    }
    const mode = modeNow(), fixed = s.ids.includes(id), home = homeOf(id);
    if (kind === 'walker') return walker(n);
    if (mode === 'marker' || mode === 'sides' || spec.counted || (!fixed && !home)) return n;
    n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button'); n.g.setAttribute('aria-label', T(`kind-${kind}`));
    if (fixed && !spec.drag) { press(n.g, () => tapFixed(id)); return n; }
    if (home === 'seats' || home === 'stop') { press(n.g, () => moveTo(id, otherOf(homeOf(id)))); return n; }
    n.g.classList.add('counters-moves');
    let dx = 0, dy = 0;
    carry(n.g, {
      point: e => svgPoint(svg, e), raise: () => layer.append(n.g),
      start(q) { n.tween?.pause(); hold = n; dx = n.at.x - q.x; dy = n.at.y - q.y; },
      move(q) { put(n, { x: q.x + dx, y: q.y + dy }); },
      drop(q) {
        hold = null;
        const p = q && { x: q.x + dx, y: q.y + dy };
        if (fixed) { if (p) lay(id, p); render('move'); return; }
        const to = otherOf(homeOf(id));
        if (p && geo.places[to]?.hit?.(p)) moveTo(id, to); else render('move');
      },
      tap() { hold = null; if (fixed) tapFixed(id); else moveTo(id, otherOf(homeOf(id))); },
    });
    return n;
  }
  // The reader drags the walker along the staircase, and the walker moves to the step under the pointer. The arrow
  // keys move a focused walker one step.
  function walker(n) {
    n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button'); n.g.setAttribute('aria-label', T('kind-walker'));
    n.g.classList.add('counters-moves');
    const go1 = k => { if (k !== s.step) { s.step = k; changed(); } };
    carry(n.g, { point: e => svgPoint(svg, e), move(q) { go1(geo.places.steps.at(q)); }, drop() {}, tap() {} });
    nudge(n.g, { step: (dx, dy) => go1(clamp(s.step + (dx > 0 || dy < 0 ? 1 : -1), 0, STEPS)) });
    return n;
  }
  // lay keeps a dragged object where it was let go, inside the tray.
  function lay(id, p) {
    const b = geo.places.slots.box;
    if (b) s.free.set(id, { u: clamp((p.x - b.x) / b.w, 0.03, 0.97), v: clamp((p.y - b.y) / b.h, 0.03, 0.97) });
  }

  // A tap on an object in a fixed place gives it the next number, gives it one more, shows its own number, or takes
  // it out of the tray. An object that holds its number already shakes its number once.
  function tapFixed(id) {
    const i = s.ids.indexOf(id), tags = s.tags.get(id) ?? [], mode = modeNow();
    if (mode === 'tag' && tags.length) { if (moving()) go.flash(nodes.get(id)?.tagPop); return; }
    if (mode === 'tag' || mode === 'again') { s.said++; s.tags.set(id, [...tags, s.box + s.said]); }
    else if (mode === 'place') { s.last = i + 1; s.tags.set(id, [i + 1]); }
    else if (mode === 'take' || mode === 'count-back') s.here[i] = false;
    changed();
  }
  // moveTo moves an object to a list, or to the first free seat of the bus.
  function moveTo(id, to) {
    const from = homeOf(id);
    if (to === 'seats' && !s.seats.includes(null)) return;
    if (from === 'seats') s.seats[s.seats.indexOf(id)] = null; else s.lists[from].splice(s.lists[from].indexOf(id), 1);
    if (to === 'seats') s.seats[s.seats.indexOf(null)] = id; else s.lists[to].push(id);
    changed();
  }
  // stepTo sets the group of a sides page to n counters, one more or one fewer than it holds.
  function stepTo(n) {
    if (n < SIDES[0] || n > SIDES[1]) return;
    if (n > s.ids.length) { s.ids.push(`o${seq++}`); s.here.push(true); } else { s.ids.pop(); s.here.pop(); }
    changed();
  }
  // A change takes back a challenge's check, so the reader checks again.
  function changed() { if (cs) cs.checked = false; render('move'); }

  // paint writes the numbers on the objects, greys the counters past the marker, shows the empty places and writes the
  // number on the box and the counts at the ends of the rows.
  function paint(anim) {
    const mode = modeNow();
    for (const [id, n] of nodes) {
      if (!n.tag) continue;
      let nums = s.tags.get(id) ?? [];
      if (mode === 'pile') { const k = s.lists.beside.indexOf(id); nums = k < 0 ? [] : [s.box + k + 1]; }
      if (mode === 'marker') {
        const at = s.ids.indexOf(id) + 1;
        nums = at === s.marker ? [at] : [];
        n.g.classList.toggle('counters-pale', at > s.marker); n.g.classList.toggle('counters-marked', at === s.marker);
      }
      tag(n, nums.map(int).join(', '), anim);
    }
    gaps.forEach((g, i) => g.classList.toggle('counters-gap-on', !s.here[i]));
    // The trail joins the counted objects in the order of their numbers.
    const path = spec.path ? s.ids.filter(id => s.tags.get(id)?.length).sort((a, b) => s.tags.get(a)[0] - s.tags.get(b)[0]).map(id => nodes.get(id)?.at).filter(Boolean) : [];
    trail.setAttribute('points', path.map(p => `${p.x},${p.y}`).join(' '));
    if (geo.refs.num) geo.refs.num.textContent = int(s.box);
    for (const l of geo.refs.labels ?? []) l.t.textContent = int(l.n);
    if (mode === 'sides') {
      // The last counter wears the ring, and the count stands at the end of each full row.
      const n = s.ids.length, p = geo.places.slots.pos(n);
      for (const [id, c] of nodes) c.g.classList.toggle('counters-marked', id === s.ids.at(-1));
      geo.next.setAttribute('cx', p.x); geo.next.setAttribute('cy', p.y);
      for (const l of geo.refs.labels) l.t.setAttribute('display', l.n <= n ? 'inline' : 'none');
      for (const [id, v] of [['before', n - 1], ['count', n], ['after', n + 1]]) {
        const t = geo.refs.tiles[id], open = id !== 'count' && v >= SIDES[0] && v <= SIDES[1];
        if (t.num.textContent !== int(v)) { t.num.textContent = int(v); if (anim) go.flash(t.num); }
        t.g.classList.toggle('counters-tile-open', open);
        for (const [name, val] of [['tabindex', 0], ['role', 'button'], ['aria-label', `${T(id === 'before' ? 'one-less' : 'one-more')}: ${int(v)}`]]) if (open) t.g.setAttribute(name, val); else t.g.removeAttribute(name);
      }
    }
  }
  function tag(n, words, anim) {
    const text = n.tagPop.lastChild;
    if (text.textContent === words) return;
    text.textContent = words;
    n.tag.setAttribute('display', words ? 'inline' : 'none');
    const w = Math.max(18, 9 + 7.6 * words.length);
    n.tagPop.firstChild.setAttribute('width', w); n.tagPop.firstChild.setAttribute('x', -w / 2);
    if (words && anim) go.pop(n.tagPop);
  }

  // refresh writes every value that follows the objects, in the readouts and the text, and judges a challenge. The
  // objects swell once when every one of them holds its number.
  function refresh() {
    const st = measure(), words = id => st[id] == null ? '?' : int(st[id]), ids = measuresOf(spec);
    for (const k of chips) if (k.set(words(k.id)) && moving()) go.flash(k.el);
    live(host, { value: id => ids.includes(id) ? words(id) : null });
    const whole = st.total != null;
    if (whole && !s.whole && moving()) go.cheer([...nodes.values()].map(n => n.pop));
    s.whole = whole;
    judge();
  }
  function judge() {
    const c = spec.challenge;
    if (!c || !goal) return;
    const g = COUNT_GOALS[c.goal];
    goal.say(T(`goal-${c.goal}`, g.words(c, target, { int })));
    const r = g.holds({ ...cs, basket: s.lists.basket.length, beside: s.lists.beside.length, left: s.here.filter(Boolean).length }, spec, c, target);
    const first = goal.show(r.done, r.note ? T(`note-${c.goal}-${r.note}`) : undefined);
    if (first && moving()) go.cheer([...nodes.values()].map(n => n.pop));
  }

  // The panel holds a challenge's line, the page's controls and its readouts.
  function drawPanel() {
    const c = spec.challenge, ctls = [];
    goal = null; chips = [];
    if (c) {
      goal = goalRow({ T, motion: moving() ? fx : null, hint: on => on ? T(`hint-${c.goal}`, COUNT_GOALS[c.goal].words(c, target, { int })) : null,
        another: () => { begin(); goal.reset(); build(); if (!geo) refresh(); } });
      ctls.push(button({ label: T('check'), act: 'check', primary: true, press: () => { if (!cs.checked) { cs.checked = true; judge(); } } }));
    } else {
      const step = (id, key, ctl, value, set) => stepper({ id, label: T(key), min: ctl.lo, max: ctl.hi, value, write: int, change: v => { set(v); changed(); } });
      if (spec.boxCtl) ctls.push(step('box', 'ctl-box', spec.boxCtl, s.box, v => { s.box = v; }));
      if (spec.markerCtl) ctls.push(step('count', 'ctl-marker', spec.markerCtl, s.marker, v => { s.marker = v; }));
      if (spec.stepCtl) ctls.push(step('count', 'ctl-step', spec.stepCtl, s.step, v => { s.step = v; }));
      if (spec.clear) ctls.push(button({ label: T('clear'), act: 'clear', press: () => { s.tags.clear(); s.said = 0; s.last = 0; changed(); } }));
      chips = spec.readout.map(id => chip({ id, label: label(id) }));
      for (const k of chips) k.width(3);
    }
    panel.replaceChildren(...[goal?.el, ctls.length ? row('ctls', ctls) : null, chips.length ? row('out', chips) : null].filter(Boolean));
  }

  function point(id, on) {
    if (!spec) return;
    for (const part of svg.querySelectorAll(`[data-ref="${id}"]`)) part.classList.toggle('counters-hot', on);
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }
  function stop() { for (const n of nodes.values()) n.tween?.pause(); hold = null; }

  return {
    show(page) {
      stop(); spec = page; target = null; cs = null;
      begin(); drawPanel(); build();
      if (!geo) refresh();
    },
    hide() { stop(); spec = null; geo = null; back.replaceChildren(); layer.replaceChildren(); trail.setAttribute('points', ''); nodes = new Map(); gaps = []; },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); build(); if (!geo) refresh(); },
  };
}
