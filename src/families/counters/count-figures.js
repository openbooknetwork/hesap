// The blocks a count figure is built from: the place the objects lie in, rows of ten, a closed box with room beside
// it, a pile, a basket, a bus with its stop and a staircase. A block offers one or more ways to be set out, each with
// its size and a draw that puts it at a corner. draw gives the block's nodes, its places for objects and the parts
// the scene updates.
import { svg as el } from '../../kit/dom.js';
import { generator, hash } from '../../kit/random.js';
import { R } from './counter.js';
import { txt } from './figures.js';
import { SEATS, STOP, STEPS } from './count-model.js';

const CELL = 60; // A loose object has a cell this wide of its own, and lies somewhere inside it.
export const ROW = 36; // Counters in rows of ten stand this far apart.
const FIVE = 8; // The extra gap after the fifth counter of a row.
const PAD = 18; // The edge of a tray or a table round its objects.
const near = (b, m = 20) => q => q.x > b.x - m && q.x < b.x + b.w + m && q.y > b.y - m && q.y < b.y + b.h + m;

// scatter lays n objects loose. Each takes a cell of a grid with cells to spare and lies off the cell's middle, and
// the same seed always lays them the same way.
function scatter(n, seed) {
  const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.8))), rows = Math.max(2, Math.ceil(n * 1.25 / cols));
  const rnd = generator(hash(seed)), cells = [...Array(cols * rows).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const spots = cells.slice(0, n).sort((a, b) => a - b).map(c => ({ x: (c % cols + 0.5) * CELL + (rnd() - 0.5) * 16, y: (Math.floor(c / cols) + 0.5) * CELL + (rnd() - 0.5) * 16 }));
  return { w: cols * CELL, h: rows * CELL, spots };
}

// place is the tray, the stall or the sand with n objects lying loose, or the wire with n in a row.
export function place(look, n) {
  if (look === 'wire') return line(look, n);
  const s = scatter(n, `${look}-${n}`), top = look === 'stall' ? 56 : 0, w = s.w + 2 * PAD, h = top + s.h + 2 * PAD;
  return [{ w, h, draw(x, y) {
    const box = { x: x + PAD, y: y + top + PAD, w: s.w, h: s.h }, spots = s.spots.map(p => ({ x: box.x + p.x, y: box.y + p.y }));
    const nodes = look === 'stall' ? [...awning(x, y, w, top), el('rect', { class: 'counters-table', x, y: y + top, width: w, height: h - top, rx: 6 })]
      : [el('rect', { class: `counters-${look}`, x, y, width: w, height: h, rx: look === 'sand' ? 36 : 14 })];
    return { nodes, places: { slots: { pos: i => spots[i], all: spots, box } } };
  } }];
}

// The striped awning over a market stall, with a scalloped edge.
function awning(x, y, w, h) {
  const k = 8, sw = w / k, out = [];
  for (let i = 0; i < k; i++) {
    const sx = x + i * sw;
    out.push(el('path', { class: `counters-awning counters-awning-${i % 2}`, d: `M ${sx} ${y} H ${sx + sw} V ${y + h - 16} A ${sw / 2} 10 0 0 1 ${sx} ${y + h - 16} Z` }));
  }
  return out;
}

// line is a wire between two poles with birds on it.
function line(look, n) {
  const gap = 54, w = n * gap + 2 * PAD + 24, h = 120;
  return [{ w, h, draw(x, y) {
    const l = x + 12, r = x + w - 12, spots = [];
    const nodes = [];
    nodes.push(el('line', { class: 'counters-pole', x1: l, y1: y + 30, x2: l, y2: y + h }), el('line', { class: 'counters-pole', x1: r, y1: y + 30, x2: r, y2: y + h }),
        el('path', { class: 'counters-wire', d: `M ${l} ${y + 48} Q ${(l + r) / 2} ${y + 76} ${r} ${y + 48}` }));
    for (let i = 0; i < n; i++) { const bx = l + PAD + (i + 0.5) * gap, t = (bx - l) / (r - l); spots.push({ x: bx, y: y + 48 + 28 * t * (1 - t) - R * 0.85 }); }
    return { nodes, places: { slots: { pos: i => spots[i], all: spots } } };
  } }];
}

// tenPlace gives the place of counter i in rows of ten, with a gap after the fifth of each row. Every scene that
// lays a number out in rows of ten places its counters here.
export const tenPlace = (i, gap = ROW, five = FIVE) => ({ x: (i % 10 + 0.5) * gap + (i % 10 >= 5 ? five : 0), y: (Math.floor(i / 10) + 0.5) * gap });

// rows stands n counters in rows of ten, with a gap after the fifth of each row and the count of each full row at
// its end. tray is the width of the tray alone, without the counts.
export function rows(n) {
  const lines = Math.ceil(n / 10), inner = 10 * ROW + FIVE, w = inner + 62, h = lines * ROW + 16;
  return [{ w, h, tray: inner + 16, draw(x, y) {
    const ox = x + 8, oy = y + 8, spots = Array.from({ length: n }, (_, i) => { const p = tenPlace(i); return { x: ox + p.x, y: oy + p.y }; });
    const labels = [];
    for (let k = 1; k <= lines; k++) if (n >= 10 * k) labels.push({ t: txt('counters-row-label', ox + inner + 32, oy + (k - 0.5) * ROW), n: 10 * k });
    const nodes = [el('rect', { class: 'counters-tray', x, y, width: inner + 16, height: h, rx: 10 }), ...labels.map(l => l.t)];
    return { nodes, places: { slots: { pos: i => spots[i], all: spots } }, refs: { labels } };
  } }];
}

// sides is a strip of three tiles: the number before, the number in larger type and the number after. The outer
// tiles carry the words less and more and take a tap.
export function sides(less, more) {
  const tw = 92, th = 62, mid = 104, gap = 12, w = 2 * tw + mid + 2 * gap, h = th + 30;
  return [{ w, h, draw(x, y) {
    const tile = (id, tx, wide, words) => {
      const box = el('rect', { class: 'counters-tile-box', x: tx, y: y + 22, width: wide, height: th, rx: 10 });
      const num = txt(`counters-tile-num${id === 'count' ? ' counters-tile-main' : ''}`, tx + wide / 2, y + 22 + th / 2 + 2);
      const g = el('g', { class: 'counters-tile', 'data-ref': id }, [box, num, ...(words ? [txt('counters-tile-word', tx + wide / 2, y + 9, words)] : [])]);
      return { g, num };
    };
    const tiles = { before: tile('before', x, tw, less), count: tile('count', x + tw + gap, mid), after: tile('after', x + tw + gap + mid + gap, tw, more) };
    return { nodes: Object.values(tiles).map(t => t.g), refs: { tiles } };
  } }];
}

// boxRow is a closed box with its number on the front, and room beside it for cap counters in rows of six.
export function boxRow(cap) {
  const bw = 96, bh = 84, cols = Math.min(6, cap), lines = Math.ceil(cap / 6), g = 42, sw = cols * g, sh = lines * g;
  const ways = [{ w: bw + 28 + sw + 12, h: Math.max(bh + 18, sh + 12), side: true }, { w: Math.max(bw, sw + 12), h: bh + 18 + 28 + sh + 12, side: false }];
  return ways.map(way => ({ w: way.w, h: way.h, draw(x, y) {
    const bx = way.side ? x : x + (way.w - bw) / 2, by = way.side ? y + (way.h - bh - 18) / 2 + 18 : y + 18;
    const sx = way.side ? x + bw + 28 + 6 : x + (way.w - sw) / 2, sy = way.side ? y + (way.h - sh) / 2 : by + bh + 28 + 6;
    const strip = { x: sx - 6, y: sy - 6, w: sw + 12, h: sh + 12 };
    const num = txt('counters-box-num', bx + bw / 2, by + bh / 2 + 6);
    const nodes = [el('rect', { class: 'counters-box', x: bx, y: by, width: bw, height: bh, rx: 4, 'data-ref': 'box' }),
      el('path', { class: 'counters-lid', d: `M ${bx - 6} ${by} L ${bx + 8} ${by - 16} L ${bx + bw - 8} ${by - 16} L ${bx + bw + 6} ${by} Z` }),
      el('line', { class: 'counters-tape', x1: bx + bw / 2, y1: by - 16, x2: bx + bw / 2, y2: by + 12 }), num,
      el('rect', { class: 'counters-beside', x: strip.x, y: strip.y, width: strip.w, height: strip.h, rx: 10 })];
    const spots = Array.from({ length: cap }, (_, i) => ({ x: sx + (i % cols + 0.5) * g, y: sy + (Math.floor(i / cols) + 0.5) * g }));
    const beside = { pos: i => spots[i], all: spots, hit: near(strip) };
    return { nodes, places: { beside, slots: beside }, refs: { num } };
  } }));
}

// pile heaps up n objects, widest at the bottom. A tap anywhere on it takes the top one.
export function pile(n, label) {
  let wide = 1;
  while (wide * (wide + 1) / 2 < n) wide++;
  const counts = [];
  for (let k = wide, left = n; left > 0; k--) { counts.push(Math.min(k, left)); left -= k; }
  const gx = ROW * 0.92, gy = ROW * 0.72, w = wide * gx + 2 * R + 8, h = 24 + (counts.length - 1) * gy + 2 * R + 14;
  return [{ w, h, draw(x, y) {
    const base = { x: x + w / 2, y: y + h - R - 8 }, spots = [];
    counts.forEach((c, row) => { for (let j = 0; j < c; j++) spots.push({ x: base.x + (j - (c - 1) / 2) * gx, y: base.y - row * gy }); });
    const area = { x, y: y + 24, w, h: h - 24 };
    const press = el('rect', { class: 'counters-press', x: area.x, y: area.y, width: area.w, height: area.h, tabindex: 0, role: 'button', 'data-place': 'pile', 'aria-label': label });
    const nodes = [txt('counters-tray-label', x + w / 2, y + 8, label), el('ellipse', { class: 'counters-heap-floor', cx: base.x, cy: base.y + R + 2, rx: w / 2, ry: 7 }), press];
    return { nodes, places: { pile: { pos: i => spots[i], hit: near(area) } }, refs: { press: [press] } };
  } }];
}

// basket holds up to cap apples in rows of six.
export function basket(cap, label) {
  const cols = 6, g = 36, lines = Math.ceil(cap / cols), w = cols * g + 32, h = 24 + lines * g + 30;
  return [{ w, h, draw(x, y) {
    const top = y + 24, area = { x, y: top, w, h: h - 24 };
    const body = el('path', { class: 'counters-basket', d: `M ${x} ${top + 10} H ${x + w} L ${x + w - 12} ${y + h} H ${x + 12} Z` });
    const weave = [];
    for (let k = 1; k < 4; k++) weave.push(el('line', { class: 'counters-weave', x1: x + 3 * k, y1: top + 10 + k * (h - 34) / 4, x2: x + w - 3 * k, y2: top + 10 + k * (h - 34) / 4 }));
    const press = el('rect', { class: 'counters-press', x: area.x, y: area.y, width: area.w, height: area.h, tabindex: 0, role: 'button', 'data-place': 'basket', 'aria-label': label });
    const spots = Array.from({ length: cap }, (_, i) => ({ x: x + 16 + (i % cols + 0.5) * g, y: top + 18 + (Math.floor(i / cols) + 0.5) * g }));
    const nodes = [txt('counters-tray-label', x + w / 2, y + 8, label), body, ...weave, el('rect', { class: 'counters-rim', x: x - 4, y: top + 4, width: w + 8, height: 12, rx: 6 }), press];
    return { nodes, places: { basket: { pos: i => spots[i], hit: near(area) } }, refs: { press: [press] } };
  } }];
}

// bus is a bus with two decks of six seats, beside a stop where people wait in two rows of five.
export function bus(sign) {
  const win = 46, bw = 6 * win + 74, bh = 2 * 54 + 46, qw = 5 * 36 + 44, qh = 2 * 50 + 70;
  const ways = [{ w: qw + 28 + bw, h: Math.max(bh, qh) + 4, side: true }, { w: Math.max(bw, qw), h: qh + 28 + bh + 4, side: false }];
  return ways.map(way => ({ w: way.w, h: way.h, draw(x, y) {
    const sx = x, sy = way.side ? y + way.h - qh - 4 : y, bx = way.side ? x + qw + 28 : x + (way.w - bw) / 2, by = way.side ? y + way.h - bh - 4 : y + qh + 28;
    const seats = [], queue = [], nodes = [];
    nodes.push(el('rect', { class: 'counters-bus', x: bx, y: by, width: bw, height: bh - 18, rx: 14 }),
      el('rect', { class: 'counters-glass-front', x: bx + bw - 30, y: by + 14, width: 22, height: 54, rx: 5 }),
      el('rect', { class: 'counters-door', x: bx + bw - 30, y: by + 76, width: 22, height: bh - 18 - 84, rx: 3 }));
    for (let deck = 0; deck < 2; deck++) for (let k = 0; k < 6; k++) {
      const wx = bx + 14 + k * win, wy = by + 12 + (1 - deck) * 58;
      nodes.push(el('rect', { class: 'counters-window', x: wx, y: wy, width: win - 6, height: 44, rx: 6 }));
      seats[deck * 6 + k] = { x: wx + (win - 6) / 2, y: wy + 26 };
    }
    for (const wx of [bx + 60, bx + bw - 60]) nodes.push(el('circle', { class: 'counters-wheel', cx: wx, cy: by + bh - 18, r: 18 }));
    const post = sx + 14, word = txt('counters-stop-word', post, sy + 16, sign);
    nodes.push(el('line', { class: 'counters-pole', x1: post, y1: sy + 6, x2: post, y2: sy + qh }), el('rect', { class: 'counters-stop', x: post - 18, y: sy, width: 36, height: 30, rx: 6 }), word,
      el('line', { class: 'counters-kerb', x1: sx, y1: sy + qh, x2: sx + qw, y2: sy + qh }));
    for (let i = 0; i < STOP; i++) queue.push({ x: sx + 44 + (i % 5 + 0.5) * 36, y: sy + 46 + Math.floor(i / 5) * 50 + 22 });
    return { nodes, places: { seats: { pos: i => seats[i], all: seats.slice(0, SEATS) }, stop: { pos: i => queue[i] } }, refs: {} };
  } }));
}

// stairs is a staircase of STEPS steps that climbs to the right, with each step's number on its front. A narrow
// stage takes the steep way, so a phone shows the numbers large enough to read.
export function stairs() {
  return [[21, 15], [15, 19]].map(([tread, rise]) => ({ w: (STEPS + 2) * tread, h: STEPS * rise + 72, draw(x, y) {
    const w = (STEPS + 2) * tread, h = STEPS * rise + 72;
    const x0 = x, y0 = y + h - 6, pts = [`${x0},${y0}`];
    for (let k = 1; k <= STEPS; k++) pts.push(`${x0 + k * tread},${y0 - (k - 1) * rise}`, `${x0 + k * tread},${y0 - k * rise}`);
    pts.push(`${x0 + (STEPS + 2) * tread},${y0 - STEPS * rise}`, `${x0 + (STEPS + 2) * tread},${y0}`);
    const labels = [];
    for (let k = 1; k <= STEPS; k++) labels.push({ t: txt('counters-step-num', x0 + (k + 0.5) * tread, y0 - k * rise + 8), n: k });
    const nodes = [el('polygon', { class: 'counters-stairs', points: pts.join(' ') }), el('line', { class: 'counters-kerb', x1: x0, y1: y0, x2: x0 + w, y2: y0 }), ...labels.map(l => l.t)];
    const spot = k => ({ x: x0 + (k + 0.5) * tread, y: y0 - k * rise });
    // at gives the step under a point, so the walker follows a drag one step at a time.
    const at = q => Math.max(0, Math.min(STEPS, Math.round((q.x - x0) / tread - 0.5)));
    return { nodes, places: { steps: { pos: spot, at } }, refs: { labels } };
  } }));
}
