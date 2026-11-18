// The lens: a window above the point that shows about a dozen gaps of the line around it at full size, for a line whose
// gaps are too narrow to tell apart on the stage. It draws the marks, the labels and the arcs the line has there.
import { svg as el } from '../../kit/dom.js';
import { arc, house, plaque } from './figures.js';

const GAP = 21, SPAN = 16, H = 84, LINE = -56; // The lens's gap, its width in gaps, its height and the height of its line.
export const LENS_H = H + 8; // The room the lens and its tip take above the point.
let made = 0;

// lens makes the window. Its group stands with the middle of its foot at 0, 0. draw shows the line around the place
// c, counted in marks, on a line of n gaps. label gives the words of mark k, or null for a short mark, and arcs are
// the jumps of the point.
export function lens() {
  const w = GAP * SPAN, id = `line-lens-${++made}`;
  const inner = el('g', { 'clip-path': `url(#${id})` }), tip = el('path', { class: 'line-lens-tip', d: 'M -8 -1 L 0 8 L 8 -1 Z' });
  const g = el('g', { class: 'line-lens', 'aria-hidden': 'true', display: 'none' }, [
    el('defs', {}, [el('clipPath', { id }, [el('rect', { x: -w / 2, y: -H, width: w, height: H, rx: 10 })])]),
    el('rect', { class: 'line-lens-box', x: -w / 2, y: -H, width: w, height: H, rx: 10 }), tip, inner,
  ]);
  return {
    el: g, w,
    show(on) { g.setAttribute('display', on ? 'inline' : 'none'); },
    // at moves the lens so that it stays on the stage, with its tip over the point at x.
    at(x, y, lo, hi) { const cx = Math.max(lo + w / 2, Math.min(hi - w / 2, x)); g.setAttribute('transform', `translate(${cx} ${y})`); tip.setAttribute('transform', `translate(${x - cx} 0)`); },
    // On the street look the lens shows the houses with their door numbers in place of the marks.
    draw(c, n, label, arcs, street = false) {
      const x = k => (k - c) * GAP, lo = Math.max(0, Math.floor(c - SPAN / 2 - 1)), hi = Math.min(n, Math.ceil(c + SPAN / 2 + 1)), kids = [];
      if (street) {
        kids.push(el('rect', { class: 'line-road', x: Math.max(-w / 2, x(0) - GAP / 2), y: LINE + 14, width: Math.min(w / 2, x(n) + GAP / 2) - Math.max(-w / 2, x(0) - GAP / 2), height: 8 }));
        for (let k = lo; k <= hi; k++) { kids.push(house(x(k), LINE + 14, GAP * 0.8, 22)); const words = label(k); if (words !== null) kids.push(plaque(x(k), LINE - 16, words, 11)); }
        kids.push(el('path', { class: 'line-dot line-c-point', d: `M -6 ${LINE + 26} L 0 ${LINE + 18} L 6 ${LINE + 26} Z` }));
        return inner.replaceChildren(...kids);
      }
      kids.push(el('line', { class: 'line-axis', x1: Math.max(-w / 2, x(0)), x2: Math.min(w / 2, x(n)), y1: LINE, y2: LINE }));
      for (let k = lo; k <= hi; k++) {
        const words = label(k), long = words !== null;
        kids.push(el('line', { class: 'line-mark', x1: x(k), x2: x(k), y1: LINE - (long ? 9 : 5), y2: LINE + (long ? 9 : 5) }));
        if (long) kids.push(el('text', { class: 'line-label', x: x(k), y: LINE + 18, 'font-size': 12 }, [words]));
      }
      for (const a of arcs) if (Math.max(a.from, a.to) >= lo && Math.min(a.from, a.to) <= hi) {
        // A jump to the left dips under the labels, with its head clear of them.
        const part = arc(x(a.from), x(a.to), a.dir < 0 ? LINE + 33 : LINE - 4, a.dir < 0 ? 6 : 8, a.dir < 0);
        kids.push(part.path, part.head);
      }
      kids.push(el('circle', { class: 'line-dot line-c-point', r: 7, cy: LINE }));
      inner.replaceChildren(...kids);
    },
  };
}
