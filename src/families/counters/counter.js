// A counter of the family: a disc, a bead, a car, or one of the objects the count scene counts, such as an apple or a
// bird. Every scene of the family draws its counters here.
import { svg as el } from '../../kit/dom.js';

// The radius of a counter in the figure's units, and the reach of its touch target, about 44px across on a phone.
export const R = 16, HIT = 22;

// The objects of the count scene. Each stands round 0, 0 inside a circle of radius r, apart from the walker, who
// stands on 0, 0.
const OBJECTS = {
  apple: r => [el('path', { class: 'counters-stem', d: `M 0 ${-r * 0.7} Q 1 ${-r * 1.05} 4 ${-r * 1.2}` }), el('ellipse', { class: 'counters-leaf', cx: r * 0.42, cy: -r * 1.02, rx: r * 0.34, ry: r * 0.16, transform: `rotate(-25 ${r * 0.42} ${-r * 1.02})` }),
    el('path', { class: 'counters-body', d: `M 0 ${-r * 0.62} C ${r * 0.5} ${-r * 0.95} ${r * 1.05} ${-r * 0.6} ${r * 0.95} 0 C ${r * 0.88} ${r * 0.62} ${r * 0.4} ${r * 0.98} 0 ${r * 0.82} C ${-r * 0.4} ${r * 0.98} ${-r * 0.88} ${r * 0.62} ${-r * 0.95} 0 C ${-r * 1.05} ${-r * 0.6} ${-r * 0.5} ${-r * 0.95} 0 ${-r * 0.62} Z` }),
    el('ellipse', { class: 'counters-shine', cx: -r * 0.4, cy: -r * 0.25, rx: r * 0.16, ry: r * 0.28 })],
  bird: r => [el('path', { class: 'counters-body', d: `M ${-r * 1.15} ${-r * 0.1} L ${-r * 0.55} ${-r * 0.15} Q ${-r * 0.2} ${-r * 0.75} ${r * 0.45} ${-r * 0.55} Q ${r * 0.95} ${-r * 0.95} ${r * 1.05} ${-r * 0.35} L ${r * 1.35} ${-r * 0.25} L ${r * 1.0} ${-r * 0.1} Q ${r * 0.85} ${r * 0.6} ${-r * 0.1} ${r * 0.55} Q ${-r * 0.6} ${r * 0.4} ${-r * 0.75} ${r * 0.1} Z` }),
    el('circle', { class: 'counters-eye', cx: r * 0.72, cy: -r * 0.48, r: r * 0.1 }), el('path', { class: 'counters-feet', d: `M ${-r * 0.1} ${r * 0.5} L ${-r * 0.1} ${r * 0.85} M ${r * 0.25} ${r * 0.5} L ${r * 0.25} ${r * 0.85}` })],
  shell: r => [el('path', { class: 'counters-body', d: `M 0 ${r * 0.9} L ${-r * 0.95} ${-r * 0.05} Q ${-r * 0.75} ${-r * 0.95} 0 ${-r * 0.95} Q ${r * 0.75} ${-r * 0.95} ${r * 0.95} ${-r * 0.05} Z` }),
    el('path', { class: 'counters-ribs', d: [-0.6, -0.3, 0, 0.3, 0.6].map(k => `M 0 ${r * 0.8} L ${k * r * 1.1} ${-r * 0.8}`).join(' ') }),
    el('rect', { class: 'counters-body', x: -r * 0.32, y: r * 0.72, width: r * 0.64, height: r * 0.3, rx: r * 0.1 })],
  person: r => [el('path', { class: 'counters-body', d: `M ${-r * 0.8} ${r} Q ${-r * 0.8} ${r * 0.05} 0 ${r * 0.05} Q ${r * 0.8} ${r * 0.05} ${r * 0.8} ${r} Z` }),
    el('circle', { class: 'counters-skin', cy: -r * 0.42, r: r * 0.42 })],
  walker: r => [el('path', { class: 'counters-legs', d: `M ${-r * 0.2} ${-r} L ${-r * 0.3} 0 M ${r * 0.2} ${-r} L ${r * 0.35} 0` }),
    el('rect', { class: 'counters-body', x: -r * 0.45, y: -r * 2.05, width: r * 0.9, height: r * 1.2, rx: r * 0.35 }),
    el('circle', { class: 'counters-skin', cy: -r * 2.5, r: r * 0.42 })],
  // A cup seen from the side with its handle, and a saucer seen from above the table's edge.
  mug: r => [el('path', { class: 'counters-handle', d: `M ${r * 0.62} ${-r * 0.4} Q ${r * 1.3} ${-r * 0.35} ${r * 1.12} ${r * 0.2} Q ${r * 0.98} ${r * 0.55} ${r * 0.56} ${r * 0.45}` }),
    el('path', { class: 'counters-body', d: `M ${-r * 0.72} ${-r * 0.75} L ${r * 0.72} ${-r * 0.75} L ${r * 0.56} ${r * 0.78} Q 0 ${r * 0.95} ${-r * 0.56} ${r * 0.78} Z` }),
    el('ellipse', { class: 'counters-shine', cy: -r * 0.75, rx: r * 0.72, ry: r * 0.17 })],
  // A chair seen from the side: its back, its seat and two legs.
  chair: r => [el('path', { class: 'counters-legs', d: `M ${-r * 0.55} ${r * 0.15} L ${-r * 0.55} ${r} M ${r * 0.6} ${r * 0.15} L ${r * 0.6} ${r}` }),
    el('rect', { class: 'counters-body', x: -r * 0.75, y: -r, width: r * 0.4, height: r * 1.3, rx: r * 0.15 }),
    el('rect', { class: 'counters-body', x: -r * 0.75, y: -r * 0.05, width: r * 1.55, height: r * 0.4, rx: r * 0.15 })],
  // A football: a ball in its team's colour with a patch.
  ball: r => [el('circle', { class: 'counters-body', r }), el('path', { class: 'counters-patch', d: `M 0 ${-r * 0.5} L ${r * 0.48} ${-r * 0.15} L ${r * 0.3} ${r * 0.42} L ${-r * 0.3} ${r * 0.42} L ${-r * 0.48} ${-r * 0.15} Z` })],
  saucer: r => [el('ellipse', { class: 'counters-body', rx: r * 1.5, ry: r * 0.5 }), el('ellipse', { class: 'counters-well', rx: r * 0.8, ry: r * 0.24 })],
};

function glyph(kind, r) {
  if (OBJECTS[kind]) return OBJECTS[kind](r);
  // A grown seedling with two large leaves, and a small sprout with two small ones, so the two groups of the seed
  // tray differ by size and shape.
  if (kind === 'seedling') return [el('path', { class: 'counters-plant-stem', d: `M 0 ${r * 0.95} L 0 ${-r * 0.35}` }),
    el('ellipse', { class: 'counters-body', cx: -r * 0.45, cy: -r * 0.45, rx: r * 0.55, ry: r * 0.3, transform: `rotate(-30 ${-r * 0.45} ${-r * 0.45})` }),
    el('ellipse', { class: 'counters-body', cx: r * 0.45, cy: -r * 0.6, rx: r * 0.55, ry: r * 0.3, transform: `rotate(30 ${r * 0.45} ${-r * 0.6})` })];
  if (kind === 'sprout') return [el('path', { class: 'counters-plant-stem', d: `M 0 ${r * 0.95} L 0 ${r * 0.3}` }),
    el('ellipse', { class: 'counters-body', cx: -r * 0.25, cy: r * 0.2, rx: r * 0.27, ry: r * 0.15, transform: `rotate(-30 ${-r * 0.25} ${r * 0.2})` }),
    el('ellipse', { class: 'counters-body', cx: r * 0.25, cy: r * 0.12, rx: r * 0.27, ry: r * 0.15, transform: `rotate(30 ${r * 0.25} ${r * 0.12})` })];
  // A jar of jam with its lid. The lid takes the colour of the crate the jar was sold into.
  if (kind === 'jar') return [el('rect', { class: 'counters-jar-glass', x: -r * 0.78, y: -r * 0.72, width: r * 1.56, height: r * 1.72, rx: r * 0.32 }),
    el('rect', { class: 'counters-jam', x: -r * 0.62, y: -r * 0.36, width: r * 1.24, height: r * 1.2, rx: r * 0.22 }),
    el('rect', { class: 'counters-jar-lid', x: -r * 0.86, y: -r * 1.08, width: r * 1.72, height: r * 0.46, rx: r * 0.12 })];
  // A square counter tells the second group of counters/add from the round first group by its shape.
  if (kind === 'square') return [el('rect', { class: 'counters-body', x: -r * 0.9, y: -r * 0.9, width: r * 1.8, height: r * 1.8, rx: r * 0.22 }), el('rect', { class: 'counters-ring', x: -r * 0.52, y: -r * 0.52, width: r * 1.04, height: r * 1.04, rx: r * 0.1 })];
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
  const paint = kind === 'car' || kind === 'person' ? ` counters-paint-${n % PAINTS}` : '';
  const g = el('g', { class: `counters-counter counters-${colour} counters-${kind}${paint}` }, [pop]);
  return { g, pop, at: { x: 0, y: 0 }, colour };
}

// show draws a counter where its at says, and put moves it there.
export const show = c => c.g.setAttribute('transform', `translate(${c.at.x} ${c.at.y})`);
export const put = (c, p) => { c.at.x = p.x; c.at.y = p.y; show(c); };
