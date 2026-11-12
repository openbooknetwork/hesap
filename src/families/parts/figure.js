// The picture of a scene: bars, pies, a number line and labels. A scene says what the picture holds, and the figure
// keeps each shape from one change to the next, so a new cut, a moved share or a new label animates from where it was.
import { gcd } from './fraction.js';
import { svg as el } from '../../kit/dom.js';

const TURN = 2 * Math.PI;
const set = (n, attrs) => { for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); };
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

// A cut is keyed by where it falls, as a fraction in lowest terms, so the cut at 1/2 of a half and of four quarters is
// the same line and stays put when the whole is cut again.
const key = (i, d) => { const g = gcd(i, d); return `${i / g}/${d / g}`; };
const cutsOf = d => Array.from({ length: Math.max(d - 1, 0) }, (_, i) => ({ k: key(i + 1, d), at: (i + 1) / d }));
// finesOf() gives the finer cuts inside each part when every part is cut into k pieces.
const finesOf = (d, k) => k > 1 ? Array.from({ length: d * k - 1 }, (_, j) => j + 1).filter(j => j % k).map(j => ({ k: key(j, d * k), at: j / (d * k) })) : [];

// rim() finds a point on a pie's rim, a share of a turn clockwise from the top.
const rim = (s, r, t) => [s.cx + r * Math.sin(t * TURN), s.cy - r * Math.cos(t * TURN)];
function sector(s, a, b) {
  const r = s.r;
  if (b - a <= 1e-6) return 'M0,0';
  if (b - a >= 1 - 1e-6) return `M${s.cx},${s.cy - r}A${r},${r} 0 1 1 ${s.cx},${s.cy + r}A${r},${r} 0 1 1 ${s.cx},${s.cy - r}Z`;
  const [x1, y1] = rim(s, r, a), [x2, y2] = rim(s, r, b);
  return `M${s.cx},${s.cy}L${x1},${y1}A${r},${r} 0 ${b - a > 0.5 ? 1 : 0} 1 ${x2},${y2}Z`;
}

// Bars and pies each draw a share of the whole from its start, a part from a to b, a cut at a share and an outline.
const SHAPE = {
  bar: {
    tag: 'rect', frame: s => el('rect', { class: 'edge', x: s.x, y: s.y, width: s.w, height: s.h, rx: 3 }),
    fill: (s, v) => ({ x: s.x, y: s.y, width: clamp(v, 0, 1) * s.w, height: s.h }),
    part: (s, a, b) => ({ x: s.x + a * s.w, y: s.y, width: Math.max(b - a, 0) * s.w, height: s.h }),
    cut: (s, at, len) => ({ x1: s.x + at * s.w, y1: s.y, x2: s.x + at * s.w, y2: s.y + len * s.h }),
  },
  pie: {
    tag: 'path', frame: s => el('circle', { class: 'edge', cx: s.cx, cy: s.cy, r: s.r }),
    fill: (s, v) => ({ d: sector(s, 0, clamp(v, 0, 1)) }),
    part: (s, a, b) => ({ d: sector(s, a, b) }),
    cut: (s, at, len) => { const [x, y] = rim(s, s.r * len, at); return { x1: s.cx, y1: s.cy, x2: x, y2: y }; },
  },
};

export default function figure(svg, driver, { moving, say }) {
  const layers = { back: el('g'), shapes: el('g'), labels: el('g'), fx: el('g', { class: 'fx' }) };
  svg.append(...Object.values(layers));
  const items = new Map();
  let anim = false, flights = 0;

  // Cuts move to a new set of places. A cut at a place both share stays. When none is shared they slide to their new
  // places in order, the extra ones in from the end or out to it. Otherwise the new ones sweep in and the old pull back.
  function recut(store, group, next, draw, { slide = false, pair = true, cls = 'cut' } = {}) {
    const make = (k, at, len, opacity) => { const c = { k, at, len, opacity, el: el('line', { class: cls }) }; group.append(c.el); draw(c); return c; };
    if (!anim) { for (const c of store.values()) c.el.remove(); store.clear(); for (const m of next) store.set(m.k, make(m.k, m.at, 1, 1)); return; }
    const out = new Map();
    let old = [...store.values()], fresh = next;
    if (!slide) { for (const m of next) if (store.has(m.k)) out.set(m.k, store.get(m.k)); old = old.filter(c => !out.has(c.k)); fresh = next.filter(m => !out.has(m.k)); }
    old.sort((p, q) => p.at - q.at);
    if (slide || (pair && !out.size && old.length)) {
      old.forEach((c, i) => {
        const m = fresh[i];
        if (m) { c.k = m.k; out.set(m.k, c); driver.move(c, { at: m.at, len: 1, opacity: 1 }, () => draw(c)); }
        else driver.move(c, { at: 1, opacity: 0 }, () => draw(c), 0, () => c.el.remove());
      });
      for (const m of fresh.slice(old.length)) { const c = make(m.k, 1, 1, 0); out.set(m.k, c); driver.move(c, { at: m.at, opacity: 1 }, () => draw(c)); }
    } else {
      for (const c of old) driver.retract(c, () => draw(c), () => c.el.remove());
      for (const m of fresh) { const c = make(m.k, m.at, 0, 0); out.set(m.k, c); driver.sweep(c, () => draw(c), 40 + m.at * 280); }
    }
    store.clear();
    for (const [k, c] of out) store.set(k, c);
  }

  // box() gives the box a part of a bar takes, for a piece that flies to or from it.
  const box = (s, i) => s.kind === 'bar' ? { x: s.x + i / s.d * s.w, y: s.y, width: s.w / s.d, height: s.h } : null;
  // fly() says whether a piece set off, and runs landed once it arrives.
  function fly(src, s, i, cls, landed) {
    const from = items.get(src.id)?.s, a = from && box(from, src.i), b = box(s, i);
    if (!a || !b) return false;
    const piece = el('rect', { class: `piece ${cls}` }), at = { ...a }, draw = () => set(piece, at);
    layers.fx.append(piece); draw();
    driver.fly(at, b, draw, 120 + flights++ * 70, () => { piece.remove(); landed(); });
    return true;
  }

  // ---------- a bar or a pie ----------
  const shape = {
    layer: 'shapes',
    // a shape keeps its place on the page, so its outline is drawn once: under the parts and over them
    make(s) {
      const G = SHAPE[s.kind], g = el('g', { class: 'shape' }), parts = el('g'), fill = el(G.tag, { class: 'fill' }), fines = el('g'), cuts = el('g'), cursor = el('rect', { class: 'cursor', rx: 3 });
      const base = G.frame(s); base.setAttribute('class', 'base');
      g.append(base, parts, fill, fines, cuts, G.frame(s), cursor);
      cursor.style.display = 'none';
      return { g, parts: [], partsG: parts, fill, share: { v: s.fill ?? 0 }, fines: new Map(), finesG: fines, cuts: new Map(), cutsG: cuts, cursor };
    },
    update(it, s) {
      const G = SHAPE[s.kind];
      const solved = it.g.classList.contains('solved'); // the goal's mark outlives the class written below
      it.g.setAttribute('class', `shape ${s.kind} ${s.cls ?? ''}${s.ghost ? ' ghost' : ''}${s.dim ? ' dim' : ''}${s.tap ? ' tap' : ''}${it.hot ? ' hot' : ''}${solved ? ' solved' : ''}`);
      // A share of the whole is shaded from its start.
      const drawFill = () => set(it.fill, G.fill(s, it.share.v));
      it.fill.style.display = s.fill == null ? 'none' : '';
      if (s.fill != null) { if (anim && it.share.v !== s.fill) driver.move(it.share, { v: s.fill }, drawFill); else it.share.v = s.fill; drawFill(); }
      // Parts shaded one by one are numbered in order. A part beyond a new cut folds into the end.
      const want = s.parts ?? [], d = want.length, draw = p => set(p.el, G.part(s, p.a, p.b));
      it.parts.slice(d).forEach(p => anim ? driver.move(p, { a: 1, b: 1 }, () => draw(p), 0, () => p.el.remove()) : p.el.remove());
      it.parts = want.map((cls, i) => {
        let p = it.parts[i];
        if (!p) { p = { a: anim ? 1 : i / d, b: anim ? 1 : (i + 1) / d, cls: null, el: el(G.tag, { class: 'part' }) }; it.partsG.append(p.el); }
        const a = i / d, b = (i + 1) / d;
        if (anim && (p.a !== a || p.b !== b)) driver.move(p, { a, b }, () => draw(p)); else Object.assign(p, { a, b });
        draw(p);
        if (p.cls !== cls) {
          p.cls = cls;
          const shown = () => p.el.setAttribute('class', `part ${p.cls ?? ''}`), landed = () => { if (p.cls === cls) { shown(); driver.pop(p.el); } };
          if (!(anim && cls && s.from?.[i] && fly(s.from[i], s, i, cls, landed))) { shown(); if (anim && cls) driver.pop(p.el); }
        }
        return p;
      });
      const cut = c => set(c.el, { ...G.cut(s, c.at, c.len), opacity: c.opacity });
      recut(it.cuts, it.cutsG, cutsOf(s.d), cut, { slide: !!s.slide });
      recut(it.fines, it.finesG, finesOf(s.d, s.fine ?? 1), cut, { pair: false, cls: 'fine' });
    },
  };

  // ---------- a number line from 0 to 1 ----------
  const axis = {
    layer: 'shapes',
    make() {
      const g = el('g', { class: 'axis' }), line = el('line', { class: 'rule' }), tenths = el('g', { class: 'tenths' }), ends = el('g', { class: 'ends' }), ticks = el('g'), marks = el('g');
      g.append(tenths, line, ticks, ends, marks);
      return { g, line, tenths, ends, ticksG: ticks, ticks: new Map(), marksG: marks, marks: new Map() };
    },
    update(it, s) {
      set(it.line, { x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y });
      if (!it.drawn) {
        it.drawn = true;
        if (s.tenths) for (let k = 1; k < 10; k++) it.tenths.append(el('line', { x1: s.x + k / 10 * s.w, x2: s.x + k / 10 * s.w, y1: s.y, y2: s.y + (k === 5 ? 14 : 9) }));
        const end = (x, y, anchor, text) => { const t = el('text', { x, y, 'text-anchor': anchor }); t.textContent = text; it.ends.append(t); };
        end(s.x - 12, s.y + 6, 'end', say({ kind: 'number', x: 0 })); end(s.x + s.w + 12, s.y + 6, 'start', say({ kind: 'number', x: 1 }));
        if (s.ends) { it.ends.classList.add('two'); end(s.x - 12, s.y + 27, 'end', say({ kind: 'percent', n: 0, d: 1 })); end(s.x + s.w + 12, s.y + 27, 'start', say({ kind: 'percent', n: 1, d: 1 })); }
      }
      // Each fraction's cuts show as ticks, above the line or below it.
      for (const t of s.ticks ?? []) {
        if (!it.ticks.has(t.id)) { const g = el('g', { class: `ticks ${t.cls ?? ''}` }); it.ticksG.append(g); it.ticks.set(t.id, { g, store: new Map() }); }
        const T = it.ticks.get(t.id), draw = c => set(c.el, { x1: s.x + c.at * s.w, x2: s.x + c.at * s.w, y1: s.y, y2: s.y + t.side * c.len * 11, opacity: c.opacity });
        recut(T.store, T.g, cutsOf(t.d), draw, { cls: 'tick' });
      }
      for (const m of s.marks ?? []) {
        if (!it.marks.has(m.id)) {
          const g = el('g', { class: `mark ${m.cls ?? ''}` }), name = el('g', { class: 'label', transform: `translate(0 ${m.side * 40})` });
          g.append(el('circle', { r: 7 }), name); it.marksG.append(g); it.marks.set(m.id, { g, name, pos: { at: m.at }, sig: null });
        }
        const M = it.marks.get(m.id), draw = () => M.g.setAttribute('transform', `translate(${s.x + M.pos.at * s.w} ${s.y})`);
        if (m.value) M.sig = label(M.name, [m.value], 22, M.sig);
        if (anim && M.pos.at !== m.at) driver.move(M.pos, { at: m.at }, draw); else M.pos.at = m.at;
        draw();
      }
    },
  };

  // ---------- a dashed line that ties a share in a bar to its place below ----------
  const drop = {
    layer: 'back',
    make(s) { const line = el('line', { class: `drop ${s.cls ?? ''}` }); return { g: line, pos: { x: s.x } }; },
    update(it, s) {
      const draw = () => set(it.g, { x1: it.pos.x, x2: it.pos.x, y1: s.y1, y2: s.y2 });
      if (anim && it.pos.x !== s.x) driver.move(it.pos, { x: s.x }, draw); else it.pos.x = s.x;
      draw();
    },
  };

  // ---------- a stretch of the number line that a challenge marks ----------
  const band = {
    layer: 'back',
    make(s) { return { g: el('rect', { class: 'band', rx: s.h / 2 }), pos: { x1: s.x1, x2: s.x2 } }; },
    update(it, s) {
      const draw = () => set(it.g, { x: it.pos.x1, width: Math.max(it.pos.x2 - it.pos.x1, 0), y: s.y - s.h / 2, height: s.h });
      if (anim && (it.pos.x1 !== s.x1 || it.pos.x2 !== s.x2)) driver.move(it.pos, { x1: s.x1, x2: s.x2 }, draw); else Object.assign(it.pos, { x1: s.x1, x2: s.x2 });
      draw();
    },
  };

  // ---------- a label: fractions, numbers and signs in a row ----------
  // A label writes its row again only when its words change, and then jumps once.
  function label(g, tokens, size, sig) {
    const now = JSON.stringify(tokens.map(t => typeof t === 'string' ? t : [t.kind, t.n, t.d, t.x, t.s]));
    if (now === sig) return sig;
    g.replaceChildren();
    const text = (cls, s, x, y, words) => { const t = el('text', { class: cls, x, y, 'font-size': s }); t.textContent = words; return t; };
    const width = (t, words, s) => t.getComputedTextLength?.() || words.length * 0.6 * s;
    let x = 0;
    // stack() sets a fraction over its bar, centred on 0.
    const stack = (into, n, d) => {
      const top = text('num', size, 0, -0.2 * size, n), bot = text('den', size, 0, 0.92 * size, d);
      into.append(top, bot);
      const w = Math.max(width(top, String(n), size), width(bot, String(d), size)) + 0.3 * size;
      into.append(el('line', { class: 'vinculum', x1: -w / 2, x2: w / 2, y1: 0, y2: 0, 'stroke-width': Math.max(1.5, size * 0.06) }));
      return w;
    };
    // word() writes words in the text's own type. The digits that repeat for ever carry a combining overline in the
    // plain words, which SVG text leaves out, so the label draws the bar over them itself.
    const word = (into, words) => {
      const chars = [], over = [];
      for (const c of words) if (c === '\u0305') over.push(chars.length - 1); else chars.push(c);
      const said = chars.join(''), t = text(/^[=<>+?]$/.test(said) ? 'sign' : 'word', size, 0, 0.36 * size, said);
      into.append(t);
      if (over.length) try {
        const a = t.getExtentOfChar(over[0]), b = t.getExtentOfChar(over.at(-1));
        into.append(el('line', { class: 'over', x1: a.x, x2: b.x + b.width, y1: -0.5 * size, y2: -0.5 * size, 'stroke-width': Math.max(1.5, size * 0.07) }));
      } catch {} // a label drawn while the stage is hidden has no extents to measure
      return width(t, said, size);
    };
    const row = tokens.map(t => {
      const one = el('g'), k = typeof t === 'string' ? 'text' : t.kind ?? 'frac', whole = Math.floor(t.n / t.d), rest = t.n % t.d;
      g.append(one);
      if (k === 'frac' || (k === 'mixed' && !whole && rest)) return { one, w: stack(one, k === 'frac' ? t.n : rest, t.d) };
      if (k !== 'mixed' || !rest) return { one, w: word(one, k === 'mixed' ? String(whole) : typeof t === 'string' ? t : say(t)) };
      // A mixed number writes its wholes as tall as the fraction beside them.
      const big = text('whole', size * 1.5, 0, 0.53 * size, String(whole)), part = el('g');
      one.append(big, part);
      const bw = width(big, String(whole), size * 1.5), pw = stack(part, rest, t.d), w = bw + 0.1 * size + pw;
      big.setAttribute('x', -w / 2 + bw / 2); part.setAttribute('transform', `translate(${w / 2 - pw / 2} 0)`);
      return { one, w };
    });
    const gap = 0.3 * size, total = row.reduce((sum, r) => sum + r.w, 0) + gap * Math.max(row.length - 1, 0);
    for (const r of row) { r.one.setAttribute('transform', `translate(${x - total / 2 + r.w / 2} 0)`); x += r.w + gap; }
    g.dataset.w = total;
    return now;
  }
  const words = {
    layer: 'labels',
    // the label moves by its own transform, fits by its group's scale and jumps by its row's CSS transform
    make(s) { const g = el('g', { class: 'label' }), fit = el('g'), inner = el('g'); fit.append(inner); g.append(fit); return { g, fit, inner, pos: { x: s.x, y: s.y }, sig: null }; },
    update(it, s) {
      it.g.setAttribute('class', `label ${s.cls ?? ''}${it.hot ? ' hot' : ''}`);
      const was = it.sig;
      it.sig = label(it.inner, [].concat(s.value), s.size, it.sig);
      if (anim && was !== null && was !== it.sig) driver.pop(it.inner);
      // a label held within a span stays inside it, and one wider than the span shrinks to fit
      // a label aligned to a side ends at its x, or starts at it
      const [lo, hi] = s.within ?? [-Infinity, Infinity], w = +it.inner.dataset.w || 0, k = Math.min(1, (hi - lo) / w || 1);
      const shift = { end: -1, start: 1 }[s.align] ?? 0, x = clamp(s.x + shift * w * k / 2, lo + w * k / 2, hi - w * k / 2);
      it.fit.setAttribute('transform', `scale(${k})`);
      const draw = () => it.g.setAttribute('transform', `translate(${it.pos.x} ${it.pos.y})`);
      if (anim && (it.pos.x !== x || it.pos.y !== s.y)) driver.move(it.pos, { x, y: s.y }, draw); else Object.assign(it.pos, { x, y: s.y });
      draw();
    },
  };

  const KINDS = { bar: shape, pie: shape, axis, drop, band, label: words };

  // The picture for the current values. The first call of a page draws it at once.
  function update(list, first = false) {
    anim = moving() && !first; flights = 0;
    const seen = new Set();
    for (const s of list) {
      seen.add(s.id);
      let it = items.get(s.id);
      // a line drawn over the shapes goes in the labels' layer
      if (!it) { it = KINDS[s.kind].make(s); it.kind = s.kind; items.set(s.id, it); layers[s.over ? 'labels' : KINDS[s.kind].layer].append(it.g); }
      it.s = s; KINDS[s.kind].update(it, s);
    }
    for (const [id, it] of items) if (!seen.has(id)) { items.delete(id); anim ? driver.fade(it.g) : it.g.remove(); }
  }

  // The part under a point: of any shape the reader can tap, or of one shape, which a finger already moving over it
  // keeps hold of past its ends.
  function hit(p, only) {
    for (const it of only ? [items.get(only)] : items.values()) {
      const s = it?.s;
      if (!s?.tap) continue;
      if (s.kind === 'bar' && (only || (p.x >= s.x - 2 && p.x <= s.x + s.w + 2 && p.y >= s.y - 10 && p.y <= s.y + s.h + 10)))
        return { s, i: clamp(Math.floor((p.x - s.x) / s.w * s.d), 0, s.d - 1) };
      if (s.kind === 'pie' && (only || Math.hypot(p.x - s.cx, p.y - s.cy) <= s.r + 12)) {
        const t = (Math.atan2(p.x - s.cx, s.cy - p.y) / TURN + 1) % 1;
        return { s, i: Math.min(Math.floor(t * s.d), s.d - 1) };
      }
    }
    return null;
  }
  // the parts of a fraction stand out while the reader points at something about it
  function hot(of) { for (const it of items.values()) { it.hot = !!of && it.s.of === of; it.g.classList.toggle('hot', it.hot); } }
  // cursor() outlines the part a keyboard is on.
  function cursor(id, i) {
    for (const it of items.values()) if (it.cursor) {
      const s = it.s, on = it.s.id === id && i != null && s.kind === 'bar';
      it.cursor.style.display = on ? '' : 'none';
      if (on) set(it.cursor, box(s, i));
    }
  }
  // The shapes that reach a goal stay marked while it holds, and jump once when it is reached.
  // Clearing the mark clears it everywhere, so a target the reader has left behind leaves no mark either.
  function cheer(ids, on) {
    if (!on) { for (const it of items.values()) it.g.classList.remove('solved'); return; }
    const gs = ids.map(id => items.get(id)?.g).filter(Boolean);
    for (const g of gs) g.classList.add('solved');
    if (moving()) driver.cheer(gs);
  }
  return { update, hit, hot, cursor, cheer, shapes: () => [...items.values()].filter(it => it.s.tap).map(it => it.s) };
}
