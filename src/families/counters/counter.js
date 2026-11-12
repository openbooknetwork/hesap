// A counter of the family: a disc, a bead or a car, in red or blue. Every scene of the family draws its counters here.
import { svg as el } from '../../kit/dom.js';

// The radius of a counter in the figure's units, and the reach of its touch target, about 44px across on a phone.
export const R = 16, HIT = 22;

function glyph(kind, r) {
  if (kind === 'bead') return [el('circle', { class: 'counters-body', r }), el('circle', { class: 'counters-shine', r: r * 0.32, cx: -r * 0.35, cy: -r * 0.35 })];
  if (kind === 'car') {
    const w = r * 1.5, l = r * 2.5;
    return [el('rect', { class: 'counters-body', x: -w / 2, y: -l / 2, width: w, height: l, rx: r * 0.45 }),
      el('rect', { class: 'counters-glass', x: -w / 2 + 3, y: -l / 2 + l * 0.2, width: w - 6, height: l * 0.2, rx: 3 }),
      el('rect', { class: 'counters-glass', x: -w / 2 + 3, y: l * 0.2, width: w - 6, height: l * 0.14, rx: 3 })];
  }
  return [el('circle', { class: 'counters-body', r }), el('circle', { class: 'counters-ring', r: r * 0.6 })];
}

// A car park holds cars of several colours, so each car takes one of PAINTS by its number.
const PAINTS = 6;

// counter makes the elements of one counter. g takes the place in the figure, and pop takes the motion, because a
// CSS transform on an element would override its transform attribute. n is the counter's number among its kind.
export function counter(kind, colour, r = R, n = 0) {
  const pop = el('g', { class: 'counters-pop a' }, [el('circle', { class: 'counters-hit', r: Math.max(r, HIT) }), ...glyph(kind, r)]);
  const paint = kind === 'car' ? ` counters-paint-${n % PAINTS}` : '';
  const g = el('g', { class: `counters-counter counters-${colour} counters-${kind}${paint}` }, [pop]);
  return { g, pop, at: { x: 0, y: 0 }, colour };
}

// show draws a counter where its at says, and put moves it there.
export const show = c => c.g.setAttribute('transform', `translate(${c.at.x} ${c.at.y})`);
export const put = (c, p) => { c.at.x = p.x; c.at.y = p.y; show(c); };
