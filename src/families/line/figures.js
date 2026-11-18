// The parts of a line figure: the points with their flags, the arcs of the jumps, and the frog, the stones and the
// bank of the opening pages. Every part is drawn in pixels of the stage.
import { svg as el } from '../../kit/dom.js';

const HIT = 22; // The radius that takes a touch round a point, about 44px across.

// pointShape draws a point round 0, 0: a disc for the point and a smaller square for the second, so the disc shows
// round a square on the same mark. A hit area round it takes the touch.
export function pointShape(who, r) {
  const shape = who === 'second'
    ? el('rect', { class: 'line-dot', x: -r * 0.72, y: -r * 0.72, width: r * 1.44, height: r * 1.44, rx: 2 })
    : el('circle', { class: 'line-dot', r });
  return [el('circle', { class: 'line-hit', r: HIT }), shape];
}

// flag draws a pole up from a point and a box with the point's number at its top. set writes the number and the
// pole's length, so two flags over one place stand one above the other.
export function flag(who) {
  const pole = el('line', { class: 'line-pole', x1: 0, x2: 0 }), box = el('rect', { class: 'line-flag-box', height: 24, rx: who === 'second' ? 3 : 12 });
  const text = el('text', { class: 'line-flag-text' });
  const g = el('g', { class: `line-flag line-c-${who}`, 'data-ref': who }, [pole, box, text]);
  return {
    el: g, width: words => 16 + 8.4 * words.length,
    set(words, from, length) {
      const w = 16 + 8.4 * words.length, top = from - length;
      if (text.textContent !== words) text.textContent = words;
      pole.setAttribute('y1', from); pole.setAttribute('y2', top);
      box.setAttribute('x', -w / 2); box.setAttribute('width', w); box.setAttribute('y', top - 24);
      text.setAttribute('x', 0); text.setAttribute('y', top - 12);
    },
  };
}

// arc draws a jump from x1 to x2 at height y, rising h above it, or dipping h below it with down, with a head at
// its end that shows the way it went.
export function arc(x1, x2, y, h, down) {
  const cy = down ? y + 2 * h : y - 2 * h, mx = (x1 + x2) / 2;
  const a = Math.atan2(y - cy, x2 - mx), len = Math.max(4, Math.min(7, Math.abs(x2 - x1) * 0.3)), wide = len * 0.57;
  const bx = x2 - len * Math.cos(a), by = y - len * Math.sin(a), nx = -Math.sin(a) * wide, ny = Math.cos(a) * wide;
  return {
    path: el('path', { class: 'line-arc', d: `M ${x1} ${y} Q ${mx} ${cy} ${x2} ${y}`, pathLength: 1 }),
    head: el('path', { class: 'line-arc-head', d: `M ${x2} ${y} L ${bx + nx} ${by + ny} L ${bx - nx} ${by - ny} Z` }),
  };
}

// frog draws the frog standing on 0, 0, size pixels tall.
export function frog(size) {
  const k = size / 33, at = (x, y) => ({ cx: x * k, cy: y * k });
  return el('g', { class: 'line-frog' }, [
    el('circle', { class: 'line-hit', cy: -size / 2, r: Math.max(HIT, size / 2) }),
    el('ellipse', { class: 'line-frog-leg', ...at(-11, -4), rx: 8 * k, ry: 4 * k }),
    el('ellipse', { class: 'line-frog-leg', ...at(11, -4), rx: 8 * k, ry: 4 * k }),
    el('ellipse', { class: 'line-frog-body', ...at(0, -14), rx: 14 * k, ry: 12 * k }),
    ...[-7, 7].flatMap(x => [el('circle', { class: 'line-frog-eye', ...at(x, -27), r: 5.5 * k }), el('circle', { class: 'line-frog-pupil', ...at(x, -27.5), r: 2.4 * k })]),
    el('path', { class: 'line-frog-mouth', d: `M ${-6 * k} ${-12 * k} Q 0 ${-8 * k} ${6 * k} ${-12 * k}` }),
  ]);
}

// stone draws a stepping stone round x, y, w wide, with its number on it.
export function stone(x, y, w, words, size) {
  return el('g', { class: 'line-stone' }, [
    el('ellipse', { class: 'line-stone-body', cx: x, cy: y, rx: w / 2, ry: w * 0.3 }),
    el('text', { class: 'line-stone-num', x, y, 'font-size': size }, [words]),
  ]);
}

// pond draws the water under the stones from x1 to x2 and from y1 to y2, and the bank, which ends at bank.
export function pond(x1, x2, y1, y2, bank) {
  return [
    el('rect', { class: 'line-water', x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 10 }),
    el('path', { class: 'line-bank', d: `M 0 ${y1 - 6} L ${bank - 8} ${y1 - 6} Q ${bank + 6} ${(y1 + y2) / 2} ${bank - 8} ${y2 + 6} L 0 ${y2 + 6} Z` }),
  ];
}

// bracket draws the bracket over the line from the ten before the point to the ten after it, plain with no mark
// between its ends, as two halves that the text can point at one by one. set moves it from x1 to x2 at height y, or
// hides it with null.
export function bracket() {
  const before = el('path', { class: 'line-bracket', 'data-ref': 'ten-before' }), after = el('path', { class: 'line-bracket', 'data-ref': 'ten-after' });
  const g = el('g', {}, [before, after]);
  return {
    el: g,
    set(x1, x2, y) {
      g.setAttribute('display', x1 === null ? 'none' : 'inline');
      if (x1 === null) return;
      const m = (x1 + x2) / 2, top = y - 10;
      before.setAttribute('d', `M ${x1} ${y} V ${top} H ${m}`);
      after.setAttribute('d', `M ${x2} ${y} V ${top} H ${m}`);
    },
  };
}

export const BOX = { w: 40, h: 26 }; // An empty label box, and a label card a little larger.
export const CARD = { w: 46, h: 34 };
// blankBox draws an empty label box round x, y, narrower where the gaps are narrow.
export const blankBox = (x, y, w) => el('rect', { class: 'line-blank', x: x - w / 2, y: y - BOX.h / 2, width: w, height: BOX.h, rx: 5 });
// card draws a label card round 0, 0 with its number, and a hit area about 44px tall.
export const card = words => [
  el('rect', { class: 'line-hit', x: -CARD.w / 2, y: -24, width: CARD.w, height: 48 }),
  el('rect', { class: 'line-card-box', x: -CARD.w / 2, y: -CARD.h / 2, width: CARD.w, height: CARD.h, rx: 6 }),
  el('text', { class: 'line-card-num' }, [words]),
];

// house draws a house standing on x, y, w wide and h tall, with a door. A house with a number carries it on a
// plaque over its door, which plaque draws at size font.
export function house(x, y, w, h) {
  const roof = h * 0.4, d = Math.max(2, w * 0.28);
  return el('g', { class: 'line-house' }, [
    el('path', { class: 'line-house-body', d: `M ${x - w / 2} ${y} V ${y - h + roof} L ${x} ${y - h} L ${x + w / 2} ${y - h + roof} V ${y} Z` }),
    el('rect', { class: 'line-door', x: x - d / 2, y: y - Math.min(h * 0.45, h - roof), width: d, height: Math.min(h * 0.45, h - roof) }),
  ]);
}
export function plaque(x, y, words, font) {
  const w = 8 + 0.62 * font * words.length;
  return el('g', { class: 'line-plaque' }, [el('rect', { x: x - w / 2, y: y - font * 0.75, width: w, height: font * 1.5, rx: 3 }), el('text', { x, y, 'font-size': font }, [words])]);
}
// van draws a small van on the road in front of the houses, round 0, dy, with a marker that points at its house, the
// number of its house on its side and a hit area about 44px across. say writes the number, or takes it away with null.
export function van(dy) {
  const words = el('text', { class: 'line-van-num', x: -2, y: dy });
  const g = [
    el('rect', { class: 'line-hit', x: -22, y: dy - 22, width: 44, height: 44 }),
    el('path', { class: 'line-van-tip', d: `M -4 ${dy - 8} L 0 ${dy - 13} L 4 ${dy - 8} Z` }),
    el('path', { class: 'line-dot', d: `M -13 ${dy + 6} V ${dy - 7} H 6 L 13 ${dy - 1} V ${dy + 6} Z` }),
    el('circle', { class: 'line-wheel', cx: -8, cy: dy + 7, r: 2.6 }), el('circle', { class: 'line-wheel', cx: 8, cy: dy + 7, r: 2.6 }),
    words,
  ];
  return { nodes: g, say(n) { words.textContent = n ?? ''; } };
}

// book draws the edge of a closed book from x1 to x2 at height y: the edge of its pages between its two covers,
// with no mark along it.
export const book = (x1, x2, y) => [
  el('rect', { class: 'line-book-pages', x: x1, y: y - 9, width: x2 - x1, height: 18 }),
  el('line', { class: 'line-book-leaf', x1, x2, y1: y - 3, y2: y - 3 }), el('line', { class: 'line-book-leaf', x1, x2, y1: y + 3, y2: y + 3 }),
  el('rect', { class: 'line-book-cover', x: x1 - 7, y: y - 12, width: 7, height: 24, rx: 2 }),
  el('rect', { class: 'line-book-cover', x: x2, y: y - 12, width: 7, height: 24, rx: 2 }),
];
// bookmark draws a ribbon that stands top pixels above the edge round 0, 0, with a hit area about 44px across.
export const bookmark = top => [
  el('rect', { class: 'line-hit', x: -22, y: -top - 6, width: 44, height: top + 20 }),
  el('path', { class: 'line-dot', d: `M -6 8 V ${-top} L 0 ${-top + 6} L 6 ${-top} V 8 Z` }),
];
