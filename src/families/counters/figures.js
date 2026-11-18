// The blocks a bonds figure is built from: the part-whole diagram, the hands, the list of splits, the lane of pins,
// the car park, and the trays of the challenges. A block offers one or more ways to be set out, each with its size
// and a draw that puts it at a corner. draw gives the block's nodes, its places for counters and the parts the
// scene updates.
import { svg as el } from '../../kit/dom.js';
import { R } from './counter.js';
import { cluster, reach, grid, heap, HEAP } from './places.js';

export const GAP = 38; // Counters in a part or a tray stand this far apart.
const RW = 34; // The radius of the whole's circle.
const DROP = 40; // The gap between the whole's circle and the parts' circles.
const BETWEEN = 20; // The gap between the two parts.

export const txt = (cls, x, y, s = '') => { const t = el('text', { class: cls, x, y }); t.textContent = s; return t; };
const at = (c, p) => ({ x: c.x + p.x, y: c.y + p.y });
const near = (c, rad) => p => Math.hypot(p.x - c.x, p.y - c.y) < rad;

// cup draws a cup that covers a circle of radius r round 0, 0 and the number under it.
function cup(r, foot) {
  const top = -r - 6, w = r * 1.25;
  return el('g', { class: 'counters-cup' }, [
    el('path', { class: 'counters-cup-body', d: `M ${-w} ${foot} L ${-w * 0.78} ${top} Q 0 ${top - 10} ${w * 0.78} ${top} L ${w} ${foot} Z` }),
    el('rect', { class: 'counters-cup-rim', x: -w - 4, y: foot - 10, width: 2 * w + 8, height: 12, rx: 5 }),
    el('rect', { class: 'counters-cup-knob', x: -10, y: top - 18, width: 20, height: 14, rx: 5 }),
  ]);
}

// parts is the diagram whose two part circles hold counters. max gives the most counters each part holds. A part
// with a cup is a small circle whose number shows when the cup lifts.
export function parts({ max: [ml, mr], cupped = false, gap = GAP, r = R }) {
  const radius = m => Math.max(50, reach(m, gap) + r + 6), rl = radius(ml), rr = cupped ? 50 : radius(mr), big = Math.max(rl, rr);
  const w = 2 * rl + BETWEEN + 2 * rr, py = 2 * RW + DROP + big, h = py + big + 30;
  return [{ w, h, draw(x, y) {
    const W = { x: x + w / 2, y: y + RW }, L = { x: x + rl, y: y + py }, Rt = { x: x + 2 * rl + BETWEEN + rr, y: y + py };
    const ring = (c, rad, cls, ref) => el('circle', { class: cls, cx: c.x, cy: c.y, r: rad, 'data-ref': ref });
    const whole = txt('counters-big', W.x, W.y), left = txt('counters-badge', L.x, L.y + rl + 18), right = txt('counters-badge', Rt.x, Rt.y + rr + 18);
    const hidden = txt('counters-big', Rt.x, Rt.y);
    const nodes = [el('line', { class: 'counters-link', x1: W.x, y1: W.y, x2: L.x, y2: L.y }), el('line', { class: 'counters-link', x1: W.x, y1: W.y, x2: Rt.x, y2: Rt.y }),
      ring(W, RW, 'counters-whole', 'whole'), ring(L, rl, 'counters-part', 'first'), ring(Rt, rr, 'counters-part', 'second'), whole, left, ...(cupped ? [hidden] : [right])];
    const place = (c, rad) => ({ pos: (i, n) => at(c, cluster(n, gap)[i]), r, hit: near(c, rad + 30), c, rad });
    const lid = cupped ? cup(rr, rr + 30) : null;
    return { nodes, places: { left: place(L, rl), right: place(Rt, rr) }, refs: { whole, badges: [left, cupped ? null : right], hidden, cup: lid && { g: lid, home: Rt, r: rr } } };
  } }];
}

// numerals is the small diagram over the frames, with a number in each circle. The frames hold the counters.
export function numerals({ cupped = false }) {
  const rp = 32, w = 260, h = 2 * RW + 30 + 2 * rp + 4;
  return [{ w, h, draw(x, y) {
    const W = { x: x + w / 2, y: y + RW }, L = { x: x + rp + 24, y: y + h - rp - 4 }, Rt = { x: x + w - rp - 24, y: L.y };
    const whole = txt('counters-big', W.x, W.y), left = txt('counters-big', L.x, L.y), right = txt('counters-big', Rt.x, Rt.y);
    const nodes = [el('line', { class: 'counters-link', x1: W.x, y1: W.y, x2: L.x, y2: L.y }), el('line', { class: 'counters-link', x1: W.x, y1: W.y, x2: Rt.x, y2: Rt.y }),
      el('circle', { class: 'counters-whole', cx: W.x, cy: W.y, r: RW, 'data-ref': 'whole' }), el('circle', { class: 'counters-part counters-a-ring', cx: L.x, cy: L.y, r: rp, 'data-ref': 'first' }),
      el('circle', { class: 'counters-part counters-b-ring', cx: Rt.x, cy: Rt.y, r: rp, 'data-ref': 'second' }), whole, left, right];
    return { nodes, places: {}, refs: { whole, badges: [left, cupped ? null : right], hidden: right, cup: cupped ? { g: cup(rp, rp + 8), home: Rt, r: rp } : null } };
  } }];
}

// hands are two open hands, each holding one part.
export function hands({ max, gap = 34, r = R }) {
  const rx = Math.max(72, reach(max, gap) + r + 16), ry = rx * 0.76, fingers = 56, apart = 40, side = 26, w = 4 * rx + apart + 2 * side, h = fingers + 2 * ry + 30;
  return [{ w, h, draw(x, y) {
    const one = (cx, out) => {
      const cy = y + fingers + ry, parts = [];
      [-0.56, -0.19, 0.19, 0.56].forEach((k, i) => {
        const fx = cx + k * rx, len = [60, 72, 74, 62][out < 0 ? i : 3 - i];
        parts.push(el('rect', { class: 'counters-hand', x: fx - 15, y: cy - ry - len + 28, width: 30, height: len + 20, rx: 15, transform: `rotate(${k * 14} ${fx} ${cy - ry + 30})` }));
      });
      const tx = cx + out * rx * 0.88, ty = cy + ry * 0.1;
      parts.push(el('ellipse', { class: 'counters-hand', cx: tx, cy: ty, rx: 17, ry: 38, transform: `rotate(${out * 48} ${tx} ${ty + 22})` }));
      parts.push(el('ellipse', { class: 'counters-hand counters-palm', cx, cy, rx, ry }));
      return { g: el('g', {}, parts), c: { x: cx, y: cy + 4 }, cy };
    };
    // Open hands hold their palms up, so the left hand has its thumb on the left and the right hand is its mirror.
    const L = one(x + side + rx, -1), Rt = one(x + side + 3 * rx + apart, 1);
    const left = txt('counters-badge', L.c.x, L.cy + ry + 18), right = txt('counters-badge', Rt.c.x, Rt.cy + ry + 18);
    const place = c => ({ pos: (i, n) => at(c, cluster(n, gap)[i]), r, hit: near(c, rx + 20), c, rad: rx });
    return { nodes: [L.g, Rt.g, left, right], places: { left: place(L.c), right: place(Rt.c) }, refs: { badges: [left, right] } };
  } }];
}

// list holds a slot for every split, from 0 and the whole to the whole and 0, as a column or as rows of four.
export function splits(ways) {
  const sw = 80, sh = 30, step = sh + 6, head = 30;
  const way = (cols) => {
    const rows = Math.ceil(ways / cols), w = cols * sw + (cols - 1) * 8;
    return { w, h: head + rows * step, draw(x, y) {
      const slots = Array.from({ length: ways }, (_, i) => {
        const sx = x + (i % cols) * (sw + 8), sy = y + head + Math.floor(i / cols) * step;
        const rect = el('rect', { class: 'counters-slot-box', x: sx, y: sy, width: sw, height: sh, rx: 6 }), text = txt('counters-slot-text', sx + sw / 2, sy + sh / 2);
        return { g: el('g', { class: 'counters-slot a' }, [rect, text]), text };
      });
      const title = txt('counters-list-title', x + w / 2, y + 10);
      return { nodes: [title, el('g', { 'data-ref': 'found' }, slots.map(s => s.g))], places: {}, refs: { slots, title } };
    } };
  };
  return [way(1), way(ways > 8 ? 4 : 3)];
}

// A bowling pin's outline, standing on 0, 0.
const PIN = 'M -7 0 C -13 -12 -12 -26 -6 -36 C -4 -40 -5 -44 -5 -48 C -6 -56 -3 -62 0 -62 C 3 -62 6 -56 5 -48 C 5 -44 4 -40 6 -36 C 12 -26 13 -12 7 0 Z';
const RUN = 84; // The length of lane in front of the head pin that the ball rolls along.
// pins stand at the end of a lane in rows of 4, 3, 2 and 1, and the ball rests at the near end. Cell 0 is the head pin
// at the front.
export function pins() {
  const dx = 58, dy = 46, w = 4 * dx + 56, h = 70 + 3 * dy + 40 + RUN;
  return [{ w, h, draw(x, y) {
    const spots = [], order = [[3, 1], [2, 2], [1, 3], [0, 4]];
    for (const [row, n] of order) for (let k = 0; k < n; k++) spots.push({ x: x + w / 2 + (k - (n - 1) / 2) * dx, y: y + 70 + row * dy });
    const lane = el('rect', { class: 'counters-lane', x, y: y + 2, width: w, height: h - 4, rx: 10 });
    const pinsOf = spots.map((p, i) => {
      const body = el('g', { class: 'counters-pin-body' }, [el('path', { class: 'counters-pin-shape', d: PIN }), el('rect', { class: 'counters-pin-stripe', x: -5, y: -44, width: 10, height: 3 }), el('rect', { class: 'counters-pin-stripe', x: -5, y: -39, width: 10, height: 3 })]);
      const g = el('g', { class: 'counters-pin', transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'data-cell': i }, [el('rect', { class: 'counters-hit', x: -27, y: -48, width: 54, height: 54 }), el('ellipse', { class: 'counters-spot', rx: 10, ry: 4 }), body]);
      return { g, body, tilt: { a: 0 }, x: p.x, y: p.y };
    });
    // The ball goes behind the pins, so a pin it reaches covers it. It rolls from rest to past the back row.
    // The outer group takes the ball's place, and the inner one takes the pop, whose CSS transform would replace it.
    const look = el('g', {}, [el('circle', { class: 'counters-ball-shape', r: 15 }),
      ...[[-4, -6], [3, -7], [-1, 0]].map(([cx, cy]) => el('circle', { class: 'counters-ball-hole', cx, cy, r: 2.4 }))]);
    const ball = el('g', { class: 'counters-ball' }, [look]);
    const rest = { x: x + w / 2, y: y + h - 26 }, end = { y: y + 30 };
    // The pins at the back are drawn first, so the front pins stand before them.
    return { nodes: [lane, ball, ...[...pinsOf].reverse().map(p => p.g)], places: {}, refs: { pins: pinsOf, lane, ball: { g: ball, look, rest, end } } };
  } }];
}

// The car park has two rows of ten spaces, an aisle between them, and an entrance on the left with a sign.
export function park() {
  const sw = 42, sh = 64, aisle = 76, left = 82, w = left + 10 * sw, h = 2 * sh + aisle;
  return [{ w, h, draw(x, y) {
    const cells = Array.from({ length: 20 }, (_, i) => ({ x: x + left + (i % 10 + 0.5) * sw, y: y + (i < 10 ? sh / 2 : sh + aisle + sh / 2) }));
    const lines = [];
    for (const row of [0, 1]) for (let k = 0; k <= 10; k++) {
      const lx = x + left + k * sw, ly = y + row * (sh + aisle);
      lines.push(el('line', { class: 'counters-bay', x1: lx, y1: ly, x2: lx, y2: ly + sh }));
    }
    const spaces = cells.map((c, i) => el('rect', { class: 'counters-space', x: c.x - sw / 2, y: c.y - sh / 2, width: sw, height: sh, tabindex: 0, role: 'button', 'data-cell': i }));
    const ground = el('rect', { class: 'counters-ground', x, y, width: w, height: h, rx: 10 });
    const road = el('line', { class: 'counters-road', x1: x + 12, y1: y + sh + aisle / 2, x2: x + w - 12, y2: y + sh + aisle / 2 });
    const gate = { x: x + left / 2, y: y + sh + aisle / 2 };
    const word = txt('counters-sign-word', x + left / 2, y + 16), num = txt('counters-sign-num', x + left / 2, y + 40);
    const sign = el('g', { class: 'counters-sign', 'data-ref': 'empty' }, [el('rect', { class: 'counters-sign-box', x: x + 8, y: y + 2, width: left - 16, height: 56, rx: 6 }), word, num]);
    return { nodes: [ground, road, ...spaces, ...lines, sign], places: { cells: { pos: i => cells[i], r: R, all: cells }, gate: { pos: () => gate, r: R } },
      refs: { spaces, sign: { word, num }, cells, gate, aisle: p => p.y > y + sh - 4 && p.y < y + sh + aisle + 4 } };
  } }];
}

// trays holds the red counters of a challenge above the blue ones the reader sets. A tray holds rows of ten with a
// gap after five, the way a ten frame groups them.
const TG = 36, TEN = 10 * TG + 8;
const inRows = i => ({ x: (i % 10 + 0.5) * TG + (i % 10 >= 5 ? 8 : 0), y: (Math.floor(i / 10) + 0.5) * TG });
export function trays({ red, blue, labels }) {
  const tray = n => Math.ceil(n / 10) * TG + 16, a = tray(red), b = tray(blue), w = TEN + 16;
  return [{ w, h: 24 + a + 16 + 24 + b, draw(x, y) {
    const one = (oy, h, label) => ({
      nodes: [txt('counters-tray-label', x + w / 2, oy + 8, label), el('rect', { class: 'counters-tray', x, y: oy + 24, width: w, height: h, rx: 8 })],
      place: { pos: i => at({ x: x + 8, y: oy + 32 }, inRows(i)), r: R },
    });
    const A = one(y, a, labels[0]), B = one(y + 24 + a + 16, b, labels[1]);
    return { nodes: [...A.nodes, ...B.nodes], places: { red: A.place, blue: B.place }, refs: {} };
  } }];
}

// tray and pile: the reader builds a part in the tray from a pile of counters.
export function trayPile({ size, labels }) {
  const rows = Math.ceil(size / 5), t = { w: 5 * TG + 16, h: rows * TG + 16 }, p = { w: HEAP[0] * TG * 0.86 + 2 * R + 8, h: (HEAP.length - 1) * TG * 0.64 + 2 * R + 12 };
  const make = (side) => ({ w: side ? t.w + 24 + p.w : Math.max(t.w, p.w), h: 24 + (side ? Math.max(t.h, p.h) : t.h + 44 + p.h), draw(x, y) {
    const tx = side ? x : x + (this.w - t.w) / 2, ty = y + 24, px = side ? x + t.w + 24 : x + (this.w - p.w) / 2, py = side ? y + 24 + Math.max(t.h, p.h) - p.h : ty + t.h + 44;
    const box = { x: tx, y: ty, w: t.w, h: t.h }, base = { x: px + p.w / 2, y: py + p.h - R - 6 };
    const inBox = (b, q) => q.x > b.x - 16 && q.x < b.x + b.w + 16 && q.y > b.y - 16 && q.y < b.y + b.h + 16;
    // A tap on the tray or the pile anywhere moves one counter, so a phone needs no aim at a single counter.
    const tray = el('rect', { class: 'counters-tray counters-press', x: tx, y: ty, width: t.w, height: t.h, rx: 8, tabindex: 0, role: 'button', 'data-place': 'tray', 'aria-label': labels[0] });
    const pile = el('rect', { class: 'counters-press', x: px, y: py, width: p.w, height: p.h, tabindex: 0, role: 'button', 'data-place': 'pile', 'aria-label': labels[1] });
    const nodes = [txt('counters-tray-label', tx + t.w / 2, y + 8, labels[0]), tray,
      txt('counters-tray-label', px + p.w / 2, side ? y + 8 : py - 16, labels[1]), el('ellipse', { class: 'counters-heap-floor', cx: base.x, cy: base.y + R + 2, rx: p.w / 2, ry: 7 }), pile];
    return { nodes, places: { tray: { pos: i => at({ x: tx + 8, y: ty + 8 }, grid(i, 5, TG)), r: R, hit: q => inBox(box, q) },
      pile: { pos: i => at(base, heap(i, TG)), r: R, hit: q => inBox({ x: px, y: py, w: p.w, h: p.h }, q) } }, refs: { press: [tray, pile] } };
  } });
  return [make(true), make(false)];
}
