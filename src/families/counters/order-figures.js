// The parts of an order figure: a counter drawn small, a block of rows of ten with its number, and a number card.
import { svg as el } from '../../kit/dom.js';
import { txt } from './figures.js';
import { tenPlace } from './count-figures.js';

// dot is a counter of radius r that takes no touch, in the family's colour a or b.
export const dot = (colour, r, p) => el('g', { class: `counters-counter counters-${colour}`, transform: `translate(${p.x} ${p.y})` },
  [el('circle', { class: 'counters-body', r }), el('circle', { class: 'counters-ring', r: r * 0.6 })]);

const GAP = 22, FIVE = 4, DOT = 9, PAD = 8; // A block's counters, the gap after the fifth and the edge round them.
const NUM = 46; // The room above a block for its number.
export const BLOCK = { w: 10 * GAP + FIVE + 2 * PAD, h: NUM + 10 * GAP + 2 * PAD, num: NUM / 2 - 2 };

// block draws a number's room for 100 counters in rows of ten at x, 0, with the number above it. set lays n
// counters out, with the full rows solid and the last row lighter. frame surrounds the full rows, the last row or
// the whole block, cover hides the rows.
export function block(row, colour, x) {
  const num = txt(`counters-block-num counters-${colour}`, x + BLOCK.w / 2, BLOCK.num), top = NUM + PAD;
  num.setAttribute('data-ref', row);
  const dots = Array.from({ length: 100 }, (_, i) => { const p = tenPlace(i, GAP, FIVE); return dot(colour, DOT, { x: x + PAD + p.x, y: top + p.y }); });
  const held = el('g', {}, dots), edge = el('rect', { class: 'counters-decide', rx: 8, display: 'none' });
  const lid = el('g', { class: 'counters-cover', display: 'none' }, [el('rect', { x, y: NUM, width: BLOCK.w, height: BLOCK.h - NUM, rx: 10 }), txt('counters-cover-mark', x + BLOCK.w / 2, NUM + (BLOCK.h - NUM) / 2, '?')]);
  return {
    nodes: [el('rect', { class: 'counters-tray', x, y: NUM, width: BLOCK.w, height: BLOCK.h - NUM, rx: 10 }), held, edge, lid, num],
    set(n, words) {
      num.textContent = words;
      dots.forEach((d, i) => { d.setAttribute('display', i < n ? 'inline' : 'none'); d.classList.toggle('counters-light', i >= Math.floor(n / 10) * 10); });
    },
    // kind is rows, last or all, or null for no frame. An empty run of rows keeps a thin frame at its place.
    frame(kind, n) {
      edge.setAttribute('display', kind ? 'inline' : 'none');
      if (!kind) return;
      const full = Math.floor(n / 10), from = kind === 'last' ? full : 0, rows = kind === 'last' ? 1 : kind === 'rows' ? full : 10, m = kind === 'all' ? PAD : 3;
      for (const [k, v] of Object.entries({ x: x + PAD - m, y: top + from * GAP - m, width: BLOCK.w - 2 * PAD + 2 * m, height: rows * GAP + 2 * m })) edge.setAttribute(k, v);
    },
    cover(on) { lid.setAttribute('display', on ? 'inline' : 'none'); held.setAttribute('display', on ? 'none' : 'inline'); },
  };
}

export const CARD = { w: 84, h: 108 };
// card draws a number card round 0, 0: the number, and under it the number in small rows of ten.
export function card(n, words) {
  const g = 5.6, left = -5 * g - 0.8, top = -CARD.h / 2 + 40, full = Math.floor(n / 10) * 10;
  const minis = Array.from({ length: n }, (_, i) => { const p = tenPlace(i, g, 1.6); return el('circle', { class: `counters-mini${i >= full ? ' counters-light' : ''}`, cx: left + p.x, cy: top + p.y, r: 2.2 }); });
  return [el('rect', { class: 'counters-card-box', x: -CARD.w / 2, y: -CARD.h / 2, width: CARD.w, height: CARD.h, rx: 9 }), txt('counters-card-num', 0, -CARD.h / 2 + 21, words), ...minis];
}
