// These helpers draw in SVG in the stage's own pixels. They make labels, an axis whose top grows as counts come in,
// bars that ease to their counts, die faces and stacks of dots. Every colour is a theme token in client.css.
import { svg as el } from '../../kit/dom.js';

// A label's size goes in its style, where the stylesheet's size for all text gives way to it.
export const label = ({ size, ...attrs }, words) => {
  const t = el('text', attrs, [words]);
  if (size) t.style.fontSize = `${size}px`;
  return t;
};
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A shown value eases toward its target each frame, at the same pace however often the frames come. A frame of
// endless length, which a reader who asked for less motion gets, puts it there at once.
export const ease = (now, to, dt, ms = 110) => dt === Infinity || Math.abs(to - now) < 1e-3 * Math.max(1, Math.abs(to)) ? to : now + (to - now) * (1 - Math.exp(-dt / ms));
// nice rounds v up to a top for an axis, in the steps 1, 2, 5, 10, 20, 50 and so on.
export function nice(v) { if (v <= 1) return 1; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
export const stepOf = top => nice(top / 5);
// roomy rounds v up in finer steps, such as 4, 5, 6, 8, 10, 15, 20 and 30, so the bars keep most of the height.
function roomy(v) { const p = 10 ** Math.floor(Math.log10(Math.max(v, 1))); return [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find(m => m * p >= v) * p; }

// A bar rises from its baseline up to y, and its top corners are rounded.
function barPath(x, y, w, base) {
  const r = Math.min(4, w / 2, Math.max(0, base - y));
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

// A die face has seven places for pips, and each face shows some of them.
const PIPS = [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]];
const FACES = { 1: [3], 2: [1, 5], 3: [1, 3, 5], 4: [0, 1, 5, 6], 5: [0, 1, 3, 5, 6], 6: [0, 1, 2, 4, 5, 6] };
export function dieFace(size, cls = 'die') {
  const s = size, pips = PIPS.map(([x, y]) => el('circle', { class: 'pip', cx: x * s * 0.27, cy: y * s * 0.27, r: s * 0.095 }));
  const g = el('g', { class: cls }, [el('rect', { class: 'body', x: -s / 2, y: -s / 2, width: s, height: s, rx: s * 0.2 }), ...pips]);
  g.show = n => pips.forEach((p, i) => { p.style.display = FACES[n]?.includes(i) ? '' : 'none'; });
  return g;
}

// fitDots finds the size of a dot so the tallest stack fits. Dots sit in columns side by side in a slot of width w,
// and the stack rises up to height h.
export function fitDots(most, w, h, biggest = 10) {
  for (let d = biggest; d > 1.5; d -= 0.5) { const cols = Math.max(1, Math.floor(w / d)), rows = Math.ceil(most / cols); if (rows * d <= h) return { d, cols }; }
  return { d: 1.5, cols: Math.max(1, Math.floor(w / 1.5)) };
}
// dotAt says where the i-th dot of a stack sits, measured from the middle of the slot at its foot.
export const dotAt = (i, { d, cols }) => ({ x: ((i % cols) - (cols - 1) / 2) * d, y: -(Math.floor(i / cols) + 0.5) * d });

// A chart of one bar for each key, with a y axis that grows to hold them. box is the space for the plot, its axis
// numbers and the keys' labels underneath. keyLabel draws a key's label at x, y. marker is 'line' for one expected
// value across the chart, 'ticks' for one on each bar.
export function barChart(box, { keys, keyLabel, marker = null, legend = [], least = 5, onKey = null, fmt = String }) {
  const g = el('g', { class: 'chart' }), left = 34, top = legend.length ? 30 : 16, under = 30;
  const px = box.x + left, pw = box.w - left - 6, py = box.y + top, ph = box.h - top - under, base = py + ph, slot = pw / keys.length, bw = Math.min(slot * 0.62, 40);
  const grid = el('g', { class: 'grid' }), bars = {}, layer = el('g'), marks = el('g', { class: 'expect' });
  g.append(grid, el('line', { class: 'axis', x1: px, x2: px + pw, y1: base, y2: base }), layer, marks);
  // A legend sits over the plot at its right, with a swatch for the bars and a line for the expected counts. settle
  // places it.
  for (const [kind, words] of [...legend].reverse()) g.append(label({ class: 'key-words', y: box.y + 12, 'text-anchor': 'end' }, words),
    kind === 'bar' ? el('rect', { class: 'swatch', y: box.y + 6, width: 10, height: 10, rx: 2 }) : el('line', { class: 'expect-key', y1: box.y + 11, y2: box.y + 11 }));
  keys.forEach((k, i) => {
    const cx = px + slot * (i + 0.5), rect = el('path', { class: 'bar' }), num = label({ class: 'num', x: cx, 'text-anchor': 'middle' }, '');
    const hit = el('rect', { class: 'hit', x: cx - slot / 2, y: py - 8, width: slot, height: ph + under + 8 });
    const one = bars[k] = { g: el('g', { class: 'col', 'data-key': k }, [hit, rect, num]), rect, num, cx, now: 0, to: 0, mark: null };
    if (onKey) { one.g.classList.add('pickable'); onKey(one.g, k); }
    layer.append(one.g); g.append(keyLabel(k, cx, base + 17));
    if (marker === 'ticks') { one.mark = el('line', { class: 'tick', x1: cx - slot * 0.42, x2: cx + slot * 0.42 }); marks.append(one.mark); }
  });
  const line = marker === 'line' ? marks.appendChild(el('line', { class: 'tick', x1: px, x2: px + pw })) : null;
  let top$ = least, topNow = least, expect = [], expectNow = [], dirty = true, placed = false;
  const y = v => base - v / topNow * ph;

  // The legend's swatches go beside its words, which have a width once the chart is in the page.
  function settle() {
    let lx = box.x + box.w - 6;
    for (const t of g.querySelectorAll('.key-words')) {
      t.setAttribute('x', lx); lx -= t.getComputedTextLength() + 6;
      const key = t.nextSibling;
      if (key.tagName === 'rect') { key.setAttribute('x', lx - 10); lx -= 24; } else { key.setAttribute('x1', lx - 16); key.setAttribute('x2', lx); lx -= 30; }
    }
    placed = true;
  }
  function draw() {
    if (!placed && g.isConnected) settle();
    grid.replaceChildren();
    const step = stepOf(top$);
    for (let v = 0; v <= topNow * 1.001; v += step) grid.append(el('line', { x1: px, x2: px + pw, y1: y(v), y2: y(v) }), label({ class: 'tickv', x: px - 6, y: y(v) }, fmt(v)));
    for (const k of keys) {
      const b = bars[k], top = y(b.now);
      b.rect.setAttribute('d', barPath(b.cx - bw / 2, top, bw, base));
      b.num.setAttribute('y', Math.min(top, base) - 5);
    }
    if (line) { const v = y(expectNow[0] ?? 0); line.setAttribute('y1', v); line.setAttribute('y2', v); line.style.opacity = expect[0] ? 1 : 0; }
    if (marker === 'ticks') keys.forEach((k, i) => { const m = bars[k].mark, v = y(expectNow[i] ?? 0); m.setAttribute('y1', v); m.setAttribute('y2', v); m.style.opacity = expect[i] ? 1 : 0; });
  }
  return {
    g, bars, base, py, ph,
    // set gives the counts and the expected values the bars ease toward, or stand at with snap.
    set(values, expected = [], snap = false) {
      keys.forEach((k, i) => { bars[k].to = values[i]; bars[k].num.textContent = values[i] ? fmt(values[i]) : ''; });
      expect = expected; top$ = roomy(Math.max(least, ...values, ...expected.map(v => v * 1.1)));
      if (snap) { for (const k of keys) bars[k].now = bars[k].to; topNow = top$; expectNow = [...expect]; }
      dirty = true;
    },
    // tick draws one frame and returns true while anything still moves.
    tick(dt) {
      let moving = false;
      const go = (now, to) => { const v = ease(now, to, dt); if (v !== to) moving = true; return v; };
      topNow = go(topNow, top$);
      for (const k of keys) bars[k].now = go(bars[k].now, bars[k].to);
      expectNow = expect.map((v, i) => go(expectNow[i] ?? 0, v));
      if (moving || dirty) draw();
      dirty = false;
      return moving;
    },
  };
}
