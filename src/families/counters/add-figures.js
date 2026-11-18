// The parts of an add figure besides the ten frames: the tray where counters of the second group wait, a die, and the
// shelf and the crates of the jam shelf.
import { svg as el } from '../../kit/dom.js';
import { CELL } from './frame.js';

const EDGE = 8; // The border of a tray, a shelf or a crate round its objects.

// waitTray gives the size of a tray that holds n counters in rows of up to five, two rows while they fit, and draws
// it at a corner with the place of each counter. A packet is the paper seed packet of the seed tray, with a folded top.
export function waitTray(n, packet = false) {
  const cols = Math.max(1, Math.min(5, Math.ceil(n / 2))), rows = Math.max(1, Math.ceil(n / cols));
  const w = cols * CELL + 2 * EDGE, h = rows * CELL + 2 * EDGE;
  return { w, h, draw(x, y) {
    const box = packet ? el('g', { class: 'counters-packet', 'data-ref': 'waiting' }, [el('rect', { class: 'counters-packet-paper', x, y: y - 14, width: w, height: h + 14, rx: 4 }),
      el('path', { class: 'counters-packet-fold', d: `M ${x} ${y - 4} H ${x + w}` })])
      : el('rect', { class: 'counters-tray', 'data-ref': 'waiting', x, y, width: w, height: h, rx: 10 });
    const pos = i => ({ x: x + EDGE + (i % cols + 0.5) * CELL, y: y + EDGE + (Math.floor(i / cols) + 0.5) * CELL });
    return { box, pos, area: { x, y, w, h } };
  } };
}

// The dots of each face of a die, in steps of a third of the face from its middle.
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export const DIE_SIZE = 44;

// die draws a die with its middle at 0, 0 of its own group. set turns it to a face and says whether the face changed.
export function die(ref) {
  const s = DIE_SIZE, dots = el('g'), pop = el('g', { class: 'a' }, [el('rect', { class: 'counters-die-box', x: -s / 2, y: -s / 2, width: s, height: s, rx: 9 }), dots]);
  const g = el('g', { class: 'counters-die', 'data-ref': ref, role: 'img' }, [pop]);
  let face = null;
  return {
    g, pop,
    set(n, label) {
      g.setAttribute('aria-label', label);
      if (face === n) return false;
      face = n;
      dots.replaceChildren(...PIPS[n].map(([i, j]) => el('circle', { class: 'counters-pip', cx: i * s * 0.27, cy: j * s * 0.27, r: s * 0.09 })));
      return true;
    },
  };
}

// The shelf and its crates: a shop shelf holds a jar in each of its places, on one board or on two boards of five,
// and two crates under it hold the jars sold, each in rows of five.
const SLOT = 44, JAR_ROW = 48, BOARD = 10, LABEL = 22;
export function shelfWays(n) {
  return [n, Math.ceil(n / 2)].map(cols => {
    const rows = Math.ceil(n / cols), w = cols * SLOT + 2 * EDGE, h = rows * (JAR_ROW + BOARD) + (rows - 1) * EDGE;
    return { w, h, draw(x, y) {
      const boards = Array.from({ length: rows }, (_, r) => el('rect', { class: 'counters-shelf-board', 'data-ref': 'left', x, y: y + r * (JAR_ROW + BOARD + EDGE) + JAR_ROW, width: w, height: BOARD, rx: 3 }));
      const pos = i => ({ x: x + EDGE + (i % cols + 0.5) * SLOT, y: y + Math.floor(i / cols) * (JAR_ROW + BOARD + EDGE) + JAR_ROW / 2 + 2 });
      // A tap anywhere on the shelf sells a jar, so a phone needs no aim at a single jar.
      const area = el('rect', { class: 'counters-press', x, y, width: w, height: h });
      return { nodes: [area, ...boards], pos, area };
    } };
  });
}
// crate gives the ways to draw a crate named label that holds n jars, in rows of five or in rows of three for a
// narrow stage, with its name above it.
export function crate(n, label, ref) {
  return [5, 3].map(cols => {
    const rows = Math.ceil(n / cols), w = cols * SLOT + 2 * EDGE, h = LABEL + rows * JAR_ROW + 2 * EDGE;
    return { w, h, draw(x, y) {
      const name = el('text', { class: 'counters-crate-name', 'data-ref': ref, x: x + w / 2, y: y + LABEL / 2 - 2 });
      name.textContent = label;
      const box = el('rect', { class: 'counters-crate counters-press', 'data-ref': ref, x, y: y + LABEL, width: w, height: h - LABEL, rx: 6 });
      const pos = i => ({ x: x + EDGE + (i % cols + 0.5) * SLOT, y: y + LABEL + EDGE + (Math.floor(i / cols) + 0.5) * JAR_ROW });
      return { nodes: [box, name], pos, box };
    } };
  });
}
// A jar takes a touch in the whole of its place, a slot wide and a row of jars high.
export const JAR_HIT = { w: SLOT, h: JAR_ROW };

// seedTray draws a seed tray of two rows of ten cells, each cell of bare soil, and gives the middle of every cell,
// the first row first.
export function seedTray() {
  const w = 10 * CELL + 2 * EDGE, h = 2 * CELL + 2 * EDGE;
  return { w, h, draw(x, y) {
    const cells = Array.from({ length: 20 }, (_, i) => ({ x: x + EDGE + (i % 10 + 0.5) * CELL, y: y + EDGE + (Math.floor(i / 10) + 0.5) * CELL }));
    const soil = cells.map(c => el('rect', { class: 'counters-soil', x: c.x - CELL / 2 + 2, y: c.y - CELL / 2 + 2, width: CELL - 4, height: CELL - 4, rx: 4 }));
    return { nodes: [el('rect', { class: 'counters-seedtray', x, y, width: w, height: h, rx: 8 }), ...soil], cells, box: { x, y, w, h } };
  } };
}
