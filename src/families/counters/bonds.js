// The bonds scene: a whole and its two parts. Counters sit in the parts of a diagram, in two hands, in ten frames, as
// pins in a lane or as cars in a car park. The reader drags them between parts, taps cells, sets a part or the whole,
// swaps the parts, fills a frame and lifts a cup, and a list logs each split found.
import { modeOf, capOf, opening, counts, lay, blueOf, contextOf, measuresOf } from './model.js';
import { GOALS, PILE, challengeStart, another } from './goals.js';
import { counter, show, put, R } from './counter.js';
import { frames } from './frame.js';
import { arrange } from './places.js';
import { parts, numerals, hands, splits, pins, park, trays, trayPile } from './figures.js';
import { carry, press } from './move.js';
import { driver } from './driver.js';
import { svg as el, svgPoint } from '../../kit/dom.js';
import { slider, stepper, chip, button, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { numbers } from '../../kit/format.js';
import { dice, fresh } from '../../kit/random.js';

const MAX = 1.7; // A figure grows to at most this scale on a wide stage.
const PAD = 14; // The figure keeps this far from the stage's edges, in pixels.
const LIFT = -0.8; // A lifted cup rises this far, in radii of the part it covers, and fades so the part shows.

export default function bonds({ host, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  const back = el('g'), layer = el('g', { class: 'counters-layer' }), over = el('g');
  const svg = el('svg', { class: 'counters-svg' }, [back, layer, over]);
  stage.appendChild(svg);
  // spec is the page. s holds the counters: the ids in each place and the colour of each id. st holds the counts,
  // geo the places and parts of the figure as drawn, and nodes the drawn counter of each id. target is the
  // challenge's draw, and cs the reader's answer to it.
  let spec = null, s = null, st = null, geo = null, area = { w: 0, h: 0 }, nodes = new Map(), seq = 0, hold = null;
  let goal = null, chips = [], target = null, cs = null, blueCtl = null, liftBtn = null, fillBtn = null, cupAt = null, pinned = [];

  const int = n => numbers(lang()).int(n);
  const label = id => T(`${contextOf(spec)}-${id}`) ?? T(id);
  const mode = () => modeOf(spec);
  const newId = colour => { const id = `k${seq++}`; s.colour[id] = colour; return id; };
  const many = (n, colour) => Array.from({ length: n }, () => newId(colour));
  new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (spec && (Math.round(r.width) !== area.w || Math.round(r.height) !== area.h)) build(); }).observe(svg);

  // begin sets the counters as the page opens, and draws a new target on a challenge page.
  function begin() {
    seq = 0; hold = null;
    const c = spec.challenge;
    if (c) {
      target = another(GOALS[c.goal], c, spec, dice(fresh()), target);
      cs = challengeStart(); s = { colour: {} };
      if (c.goal === 'make-whole') Object.assign(s, { red: many(target.part, 'a'), blue: [] });
      else Object.assign(s, { left: many(target.part, 'a'), tray: [], pile: many(PILE, 'b') });
      return;
    }
    const o = opening(spec);
    if (mode() === 'parts') { s = o; return; }
    s = { ...o, colour: {} };
    s.cells = o.cells.map(c => c ? newId(c.colour) : null);
    if (spec.look === 'cars') s.gate = newId('a');
  }

  // relay lays red and then blue counters in the cells, and a counter that keeps its colour keeps its id.
  function relay(red, blue) {
    const was = s.cells;
    s.cells = lay(spec, red, blue, i => was[i] ? { id: was[i], colour: s.colour[was[i]] } : null, () => `k${seq++}`).map(c => {
      if (c) s.colour[c.id] = c.colour;
      return c?.id ?? null;
    });
  }

  // measure counts the counters. A challenge shows no counts, so its answer stays hidden.
  function measure() {
    if (spec.challenge) return {};
    if (mode() === 'parts') return counts(spec, s);
    return counts(spec, { ...s, cells: s.cells.map(id => id && { colour: s.colour[id] }) });
  }

  // blocksOf lists the blocks of the figure, each with the ways it can be set out.
  function blocksOf() {
    const c = spec.challenge, most = spec.wholeCtl?.hi ?? spec.whole ?? 0, out = [];
    if (c?.goal === 'make-whole') {
      out.push({ role: 'trays', ways: trays({ red: Math.min(c.part[1], c.whole - 1), blue: c.whole, labels: [T('two-first'), T('two-second')] }) }, { role: 'frames', ways: frames(spec.frames) });
    } else if (c) {
      out.push({ role: 'diagram', ways: parts({ max: [Math.min(c.part?.[1] ?? 19, c.whole[1] - 1), 0], cupped: true, gap: 26, r: 11 }) }, { role: 'tray', ways: trayPile({ size: PILE, labels: [T('tray'), T('pile')] }) });
    } else if (spec.look === 'hands') out.push({ role: 'diagram', ways: hands({ max: most }) });
    else if (spec.look === 'pins') out.push({ role: 'pins', ways: pins() });
    else if (spec.look === 'cars') out.push({ role: 'park', ways: park() });
    else if (mode() === 'parts') out.push({ role: 'diagram', ways: parts({ max: [most, most] }) });
    else {
      if (spec.look === 'diagram') out.push({ role: 'diagram', ways: numerals({ cupped: spec.cup }) });
      out.push({ role: 'frames', ways: frames(spec.frames) });
    }
    if (spec.list) {
      const ways = mode() === 'parts' ? most + 1 : capOf(spec) + 1;
      out.push({ role: 'list', ways: splits(ways) });
    }
    return out;
  }

  // build draws the figure to fit the stage and puts every counter in its place.
  function build() {
    const r = svg.getBoundingClientRect(); area = { w: Math.round(r.width), h: Math.round(r.height) };
    if (!area.w || !area.h) { geo = null; return; } // A phone is showing the text, so the figure is drawn when the stage shows.
    const blocks = blocksOf(), best = arrange(blocks.map(b => b.ways), Math.max(1, area.w - 2 * PAD), Math.max(1, area.h - 2 * PAD)), scale = Math.min(MAX, best.scale);
    const cx = best.w / 2, cy = best.h / 2;
    svg.setAttribute('viewBox', `${cx - area.w / 2 / scale} ${cy - area.h / 2 / scale} ${area.w / scale} ${area.h / scale}`);
    geo = { places: {}, refs: {} };
    const drawn = [], lids = [];
    best.items.forEach((it, i) => {
      const role = blocks[i].role, d = it.v.draw(it.x, it.y);
      drawn.push(...d.nodes);
      if (d.cells) geo.places.cells = { pos: k => d.cells[k], r: R, all: d.cells };
      Object.assign(geo.places, d.places ?? {});
      geo.refs[role] = d.refs ?? {};
      if (d.refs?.cup) lids.push(d.refs.cup.g);
    });
    back.replaceChildren(...drawn, ...targets()); over.replaceChildren(...lids);
    for (const n of nodes.values()) n.tween?.pause();
    layer.replaceChildren(); nodes = new Map();
    svg.classList.toggle('counters-tapping', !!spec.tap);
    cupAt = null; pinned = [];
    wire(); render('jump');
  }

  // targets gives a tap target for each cell of a frame on a page where the reader taps cells.
  function targets() {
    if (!spec.tap || !geo.places.cells) return [];
    return geo.places.cells.all.map((c, i) => {
      const t = el('rect', { class: 'counters-cell', x: c.x - 22, y: c.y - 22, width: 44, height: 44, rx: 4, tabindex: 0, role: 'button', 'aria-label': T('cell', int(i + 1)) });
      press(t, () => tapCell(i));
      return t;
    });
  }

  // wire lets the reader tap the pins, the spaces of the car park, the tray, the pile and the cup.
  function wire() {
    for (const p of geo.refs.pins?.pins ?? []) press(p.g, () => tapCell(Number(p.g.dataset.cell)));
    for (const sp of geo.refs.park?.spaces ?? []) press(sp, () => parkIn(Number(sp.dataset.cell)));
    for (const t of geo.refs.tray?.press ?? []) press(t, () => { const from = t.dataset.place, id = s[from].at(-1); if (id) tapAt(id, from); });
    const cup = geo.refs.diagram?.cup;
    if (cup) { cup.g.setAttribute('tabindex', 0); cup.g.setAttribute('role', 'button'); cup.g.setAttribute('aria-label', T('cup')); press(cup.g, lift); }
  }

  // where gives the place of every counter on show.
  function where() {
    const out = new Map(), P = geo.places, c = spec.challenge;
    const packed = name => (s[name] ?? []).forEach((id, i, all) => out.set(id, { ...P[name].pos(i, all.length), r: P[name].r }));
    if (c?.goal === 'make-whole') {
      if (!cs.checked) { packed('red'); packed('blue'); return out; }
      // A check drops the red and then the blue counters into the cells, and the blue ones with no cell stay out.
      const all = [...s.red, ...s.blue], cap = P.cells.all.length;
      all.slice(0, cap).forEach((id, i) => out.set(id, { ...P.cells.pos(i), r: R }));
      all.slice(cap).forEach((id, i) => out.set(id, { ...P.blue.pos(i), r: R }));
      return out;
    }
    if (c) { packed('left'); packed('tray'); packed('pile'); return out; }
    if (mode() === 'parts') { packed('left'); packed('right'); return out; }
    if (spec.look === 'pins') return out;
    s.cells.forEach((id, i) => { if (id) out.set(id, { ...P.cells.pos(i), r: R }); });
    if (s.gate) out.set(s.gate, { ...P.gate.pos(), r: R });
    return out;
  }

  // render moves every counter to its place. After a change the reader made, counters glide, arrive and leave.
  function render(how) {
    if (!geo) return;
    st = measure();
    const to = where(), anim = how === 'move' && moving();
    let k = 0;
    for (const [id, n] of nodes) if (!to.has(id)) {
      nodes.delete(id); n.tween?.pause();
      if (anim) leave(n); else n.g.remove();
    }
    for (const [id, p] of to) {
      let n = nodes.get(id);
      if (!n) {
        n = make(id, p); nodes.set(id, n); layer.append(n.g); put(n, p);
        if (anim) go.pop(n.pop, 25 * k++);
        continue;
      }
      if (n === hold || (n.at.x === p.x && n.at.y === p.y)) continue;
      n.tween?.pause();
      if (anim) n.tween = go.tween(n.at, { x: p.x, y: p.y }, () => show(n)); else put(n, p);
    }
    paint(anim); refresh();
  }
  // A car drives back to the entrance as it leaves, and any other counter shrinks away.
  function leave(n) {
    const gone = () => n.g.remove();
    if (spec.look !== 'cars') return go.vanish(n.pop, gone);
    const gate = geo.places.gate.pos();
    n.tween = go.tween(n.at, { x: gate.x, y: gate.y }, () => show(n), 320);
    go.vanish(n.pop, gone);
  }

  // make draws a counter and lets the reader carry it, where the page allows.
  function make(id, p) {
    const n = counter(spec.look === 'hands' ? 'bead' : spec.look === 'cars' ? 'car' : 'disc', s.colour[id], p.r, Number(String(id).replace(/\D/g, '')) || 0);
    const c = spec.challenge;
    const homes = c?.goal === 'hidden-part' ? ['tray', 'pile'] : !c && mode() === 'parts' ? ['left', 'right'] : spec.look === 'cars' ? ['cells', 'gate'] : null;
    const from = () => homes?.find(h => h === 'cells' ? s.cells.includes(id) : h === 'gate' ? s.gate === id : s[h]?.includes(id));
    if (!homes || !from()) return n;
    n.g.setAttribute('tabindex', 0); n.g.setAttribute('role', 'button'); n.g.setAttribute('aria-label', T(spec.look === 'cars' ? 'car' : 'counter'));
    n.g.classList.add('counters-moves');
    let dx = 0, dy = 0;
    carry(n.g, {
      point: e => svgPoint(svg, e), raise: () => layer.append(n.g),
      start(q) { if (!from()) return false; n.tween?.pause(); hold = n; dx = n.at.x - q.x; dy = n.at.y - q.y; },
      move(q) { put(n, { x: q.x + dx, y: q.y + dy }); },
      drop(q) { hold = null; if (!q || !dropAt(id, from(), { x: q.x + dx, y: q.y + dy }, homes)) render('move'); },
      tap() { hold = null; tapAt(id, from()); },
    });
    return n;
  }

  // dropAt moves a counter to the place it was let go over, and says whether it moved.
  function dropAt(id, from, q, homes) {
    if (spec.look === 'cars') {
      const cells = geo.places.cells.all, i = cells.findIndex(c => Math.abs(c.x - q.x) < 21 && Math.abs(c.y - q.y) < 32);
      if (i >= 0 && !s.cells[i]) { take(id, from); s.cells[i] = id; if (from === 'gate') s.gate = newId('a'); return changed(); }
      if (from === 'cells' && i < 0 && geo.refs.park.aisle(q)) { take(id, from); return changed(); }
      return false;
    }
    const to = homes.find(h => h !== from && geo.places[h].hit?.(q));
    if (!to) return false;
    take(id, from); s[to].push(id); lower();
    return changed();
  }
  // A tap moves a counter to the other part, to the tray or back to the pile. A tap on a parked car drives it out,
  // and a tap on the waiting car parks it in the free space nearest the entrance.
  function tapAt(id, from) {
    if (spec.look === 'cars') {
      if (from === 'cells') { take(id, from); return changed(); }
      const gate = geo.places.gate.pos(), free = geo.places.cells.all.map((c, i) => ({ i, d: Math.hypot(c.x - gate.x, c.y - gate.y) })).filter(c => !s.cells[c.i]).sort((a, b) => a.d - b.d)[0];
      if (free) parkIn(free.i);
      return;
    }
    const to = { left: 'right', right: 'left', tray: 'pile', pile: 'tray' }[from];
    take(id, from); s[to].push(id); lower();
    changed();
  }
  function take(id, from) {
    if (from === 'cells') s.cells[s.cells.indexOf(id)] = null;
    else if (from === 'gate') s.gate = null;
    else s[from].splice(s[from].indexOf(id), 1);
  }
  // A change to the tray puts a lifted cup back, so the reader lifts it again to check.
  function lower() { if (spec.challenge?.goal === 'hidden-part' && cs.lifted) { cs.lifted = false; liftWords(); } }

  // A tap on a cell adds a counter of the page's part or takes it away. A tap on a pin knocks it down or stands it up.
  function tapCell(i) {
    if (spec.look === 'pins') { s.cells[i] = s.cells[i] ? null : newId('a'); return changed(); }
    const colour = spec.tap === 'second' ? 'b' : 'a', id = s.cells[i];
    if (!id) s.cells[i] = newId(colour);
    else if (s.colour[id] === colour) s.cells[i] = null;
    else return;
    changed();
  }
  // parkIn drives the waiting car into a free space.
  function parkIn(i) {
    if (s.cells[i]) return;
    s.cells[i] = s.gate; s.gate = newId('a');
    changed();
  }

  // changed logs the split the reader made and moves the counters. It says true for the drop that called it.
  function changed() {
    if (spec.list) { const first = measure().first; if (!s.found.includes(first)) s.found.push(first); }
    render('move');
    return true;
  }

  // paint writes the numbers of the figure and sets its cup, list, pins and sign.
  function paint(anim) {
    const d = geo.refs.diagram, c = spec.challenge;
    if (d) {
      const whole = c ? target.whole : st.whole, hidden = c ? target.whole - target.part : st.second;
      if (d.whole) d.whole.textContent = int(whole);
      const [a, b] = d.badges;
      if (a) a.textContent = int(c ? target.part : st.first);
      if (b) b.textContent = int(st.second);
      if (d.cup) { d.hidden.textContent = int(hidden); cup(anim); }
    }
    const list = geo.refs.list;
    if (list) {
      // The list keeps a slot for the largest whole the page reaches and shows the slots of the whole on show.
      const first = st.first, whole = mode() === 'parts' ? st.whole : capOf(spec);
      list.title.textContent = T(mode() === 'parts' ? 'list-splits' : 'list-pairs', int(whole));
      list.slots.forEach((slot, i) => {
        slot.g.toggleAttribute('hidden', i > whole);
        const found = s.found.includes(i), words = found ? T('pair', { a: int(i), b: int(whole - i) }) : '';
        if (slot.text.textContent !== words) { slot.text.textContent = words; if (found && anim) go.pop(slot.g); }
        slot.g.classList.toggle('counters-found', found); slot.g.classList.toggle('counters-now', i === first);
      });
    }
    for (const [i, p] of (geo.refs.pins?.pins ?? []).entries()) {
      const up = !!s.cells[i], was = pinned[i];
      p.g.classList.toggle('counters-down', !up); p.g.setAttribute('aria-label', T(up ? 'pin-up' : 'pin-down', int(i + 1)));
      const a = up ? 0 : 80, draw = () => p.body.setAttribute('transform', `rotate(${p.tilt.a}) scale(${1 - p.tilt.a / 400})`);
      if (was !== undefined && was !== up && anim) { p.tween?.pause(); p.tween = go.tween(p.tilt, { a }, draw, 420, up ? 'outBack' : 'outBounce'); }
      else { p.tilt.a = a; draw(); }
      pinned[i] = up;
    }
    // A knocked pin lies behind the pins still standing, and the pins at the back stand behind those in front.
    const lane = geo.refs.pins?.lane;
    if (lane) for (const p of [...geo.refs.pins.pins].reverse().sort((a, b) => !!s.cells[a.g.dataset.cell] - !!s.cells[b.g.dataset.cell])) lane.parentNode.appendChild(p.g);
    const sign = geo.refs.park?.sign;
    if (sign) { sign.word.textContent = T('free'); if (sign.num.textContent !== int(st.empty)) { sign.num.textContent = int(st.empty); if (anim) go.flash(sign.num); } }
    if (c?.goal === 'make-whole') for (const [i, id] of s.blue.entries()) nodes.get(id)?.g.classList.toggle('counters-over', cs.checked && s.red.length + i >= geo.places.cells.all.length);
  }

  // cup sets the cup over the hidden part, or lifted off it.
  function cup(anim) {
    const d = geo.refs.diagram.cup, up = spec.challenge ? cs.lifted : s.lifted;
    const to = up ? { x: 0, y: LIFT * d.r, o: 0.18 } : { x: 0, y: 0, o: 1 };
    const draw = () => { d.g.setAttribute('transform', `translate(${d.home.x + cupAt.x} ${d.home.y + cupAt.y})`); d.g.style.opacity = cupAt.o; };
    d.g.setAttribute('aria-pressed', String(up));
    if (!cupAt) { cupAt = { ...to }; return draw(); }
    if (cupAt.x === to.x && cupAt.y === to.y) return draw();
    cupAt.tween?.pause();
    if (anim) cupAt.tween = go.tween(cupAt, to, draw, 480, 'outBack'); else { Object.assign(cupAt, to); draw(); }
  }
  // lift raises the cup or puts it back. Under a lifted cup, a page's blue counters swell when they match the part.
  function lift() {
    if (spec.challenge) cs.lifted = !cs.lifted; else s.lifted = !s.lifted;
    liftWords(); render('move');
    if (!spec.challenge && s.lifted && st.added === st.second && moving()) go.cheer(s.cells.filter(id => id && s.colour[id] === 'b').map(id => nodes.get(id)?.pop).filter(Boolean));
  }
  const liftWords = () => { if (liftBtn) liftBtn.querySelector('span').textContent = T((spec.challenge ? cs.lifted : s.lifted) ? 'lower' : 'lift'); };

  // refresh writes every value that follows the counters, in the readouts and the text, and judges a challenge.
  function refresh() {
    for (const k of chips) if (k.set(int(st[k.id])) && moving()) go.flash(k.el);
    const ids = measuresOf(spec);
    live(host, { value: id => ids.includes(id) ? int(st[id]) : null });
    judge();
  }
  function judge() {
    const c = spec.challenge;
    if (!c || !goal) return;
    const g = GOALS[c.goal], words = g.words(c, target, { int });
    goal.say(T(c.goal === 'make-whole' && spec.frames > 1 ? 'goal-make-whole-two' : `goal-${c.goal}`, words));
    const r = g.holds({ ...cs, blue: s.blue?.length ?? 0, tray: s.tray?.length ?? 0 }, spec, c, target);
    const first = goal.show(r.done, r.note ? T(`note-${r.note}`) : undefined);
    if (first && moving()) go.cheer([...nodes.values()].filter(n => c.goal === 'make-whole' ? !n.g.classList.contains('counters-over') : s.tray.some(id => nodes.get(id) === n)).map(n => n.pop));
  }

  // The panel holds a challenge's line, the page's controls and its readouts.
  function drawPanel() {
    const c = spec.challenge, ctls = [];
    goal = blueCtl = liftBtn = fillBtn = null; chips = [];
    if (c) {
      goal = goalRow({ T, motion: moving() ? fx : null, hint: on => on ? T(`hint-${c.goal}`, GOALS[c.goal].words(c, target, { int })) : null,
        another: () => { begin(); goal.reset(); blueCtl?.set(0); liftWords(); build(); } });
      if (c.goal === 'make-whole') {
        blueCtl = slider({ id: 'blue', label: T('blue'), min: 0, max: c.whole, value: 0, write: int, input: setBlue, change: setBlue });
        blueCtl.width(2);
        ctls.push(blueCtl, button({ label: T('check'), act: 'check', primary: true, press: () => { if (cs.checked) return; cs.checked = true; render('move'); } }));
      } else ctls.push(liftBtn = button({ label: T('lift'), act: 'lift', primary: true, press: lift }));
    } else {
      if (spec.wholeCtl) ctls.push(stepper({ id: 'whole', label: T('ctl-whole'), min: spec.wholeCtl.lo, max: spec.wholeCtl.hi, value: spec.whole, write: int, change: setWhole }));
      const f = spec.firstCtl;
      if (f?.kind === 'slider') { const k = slider({ id: 'first', label: label('first'), min: f.lo, max: f.hi, value: spec.first, write: int, input: setFirst }); k.width(2); ctls.push(k); }
      if (f?.kind === 'stepper') ctls.push(stepper({ id: 'first', label: label('first'), min: f.lo, max: f.hi, value: spec.first, write: int, change: setFirst }));
      if (spec.swap) ctls.push(button({ label: T('swap'), act: 'swap', press: () => { [s.left, s.right] = [s.right, s.left]; changed(); } }));
      if (spec.fill) ctls.push(fillBtn = button({ label: T(s.extra ? 'unfill' : 'fill'), act: 'fill', press: fill }));
      if (spec.cup) ctls.push(liftBtn = button({ label: T(s.lifted ? 'lower' : 'lift'), act: 'lift', press: lift }));
      chips = spec.readout.map(id => chip({ id, label: label(id) }));
      for (const k of chips) k.width(2);
    }
    panel.replaceChildren(...[goal?.el, ctls.length ? row('ctls', ctls) : null, chips.length ? row('out', chips) : null].filter(Boolean));
  }

  // A blue count the reader sets puts that many blue counters in their tray and takes back the last check.
  function setBlue(v) {
    if (v === s.blue.length && !cs.checked) return;
    cs.checked = false;
    while (s.blue.length < v) s.blue.push(newId('b'));
    s.blue.length = v;
    render('move');
  }
  // A new whole adds blue counters to the second part or takes them away, and the list starts again.
  function setWhole(v) {
    if (mode() === 'parts') {
      while (s.left.length + s.right.length < v) s.right.push(newId('b'));
      while (s.left.length + s.right.length > v) (s.right.length ? s.right : s.left).pop();
      s.found = [];
    } else relay(spec.first, v - spec.first);
    changed();
  }
  function setFirst(v) { relay(v, blueOf(spec, v, spec.whole)); changed(); }
  // fill puts ten red counters in the second frame, or takes them out again.
  function fill() {
    s.extra = !s.extra;
    for (let i = 10; i < 20; i++) s.cells[i] = s.extra ? newId('a') : null;
    fillBtn.querySelector('span').textContent = T(s.extra ? 'unfill' : 'fill');
    changed();
  }

  function point(id, on) {
    if (!spec) return;
    for (const part of svg.querySelectorAll(`[data-ref="${id}"]`)) part.classList.toggle('counters-hot', on);
    for (const part of panel.querySelectorAll('[data-ref]')) part.classList.toggle('hot', on && part.dataset.ref === id);
  }
  function stop() { for (const n of nodes.values()) n.tween?.pause(); hold = null; }

  return {
    show(page) {
      stop(); spec = page; target = null;
      begin(); st = measure(); drawPanel(); build();
      if (!geo) refresh();
    },
    hide() { stop(); spec = null; geo = null; back.replaceChildren(); layer.replaceChildren(); over.replaceChildren(); nodes = new Map(); },
    point,
    lang() { if (!spec) return; const was = goal; drawPanel(); goal?.keep(was); liftWords(); build(); if (!geo) refresh(); },
  };
}
