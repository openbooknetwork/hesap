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

// eggBox draws a box of ten eggs, two rows of five cups, and gives the middle of every cup, the first row first.
export function eggBox() {
  const w = 5 * CELL + 2 * EDGE, h = 2 * CELL + 2 * EDGE;
  return { w, h, draw(x, y) {
    const cells = Array.from({ length: 10 }, (_, i) => ({ x: x + EDGE + (i % 5 + 0.5) * CELL, y: y + EDGE + (Math.floor(i / 5) + 0.5) * CELL }));
    const cups = cells.map(c => el('circle', { class: 'counters-egg-cup', cx: c.x, cy: c.y, r: CELL * 0.42 }));
    return { nodes: [el('rect', { class: 'counters-carton', x, y, width: w, height: h, rx: 12 }), ...cups], cells };
  } };
}

// A half of a domino is DOMINO wide and high, and the whole's number takes WHOLE_ROOM above it. A half sets its pips
// as a die does.
const DOMINO = 112, WHOLE_ROOM = 60;
// domino draws one domino with its two halves side by side and the whole's number above it. The first half shows
// first pips and the second half second pips. Each half is a button, and the card that covers a half carries a
// question mark.
export function domino(first, second) {
  const w = 2 * DOMINO, h = WHOLE_ROOM + DOMINO;
  return { w, h, draw(x, y) {
    const top = y + WHOLE_ROOM, nodes = [el('rect', { class: 'counters-domino', x, y: top, width: w, height: DOMINO, rx: 14 })];
    const halves = [first, second].map((n, k) => {
      const hx = x + k * DOMINO, c = { x: hx + DOMINO / 2, y: top + DOMINO / 2 };
      const pips = PIPS[n].map(([i, j]) => el('circle', { class: 'counters-domino-pip', cx: c.x + i * DOMINO * 0.27, cy: c.y + j * DOMINO * 0.27, r: DOMINO * 0.08 }));
      const g = el('g', { class: `counters-half counters-${k ? 'b' : 'a'}`, role: 'button', tabindex: 0, 'data-ref': k ? 'second' : 'first' },
        [el('rect', { class: 'counters-half-box', x: hx + 4, y: top + 4, width: DOMINO - 8, height: DOMINO - 8, rx: 10 }), ...pips]);
      return { g, x: hx, y: top };
    });
    nodes.push(...halves.map(hf => hf.g), el('line', { class: 'counters-domino-bar', x1: x + DOMINO, y1: top + 12, x2: x + DOMINO, y2: top + DOMINO - 12 }));
    const whole = el('text', { class: 'counters-domino-whole', 'data-ref': 'whole', x: x + w / 2, y: y + WHOLE_ROOM / 2 - 4 });
    const mark = el('text', { class: 'counters-cover-q', x: DOMINO / 2, y: DOMINO / 2 });
    mark.textContent = '?';
    const card = el('g', { class: 'counters-domino-card', role: 'button', tabindex: 0, display: 'none' }, [el('rect', { class: 'counters-domino-card-box', x: 2, y: 2, width: DOMINO - 4, height: DOMINO - 4, rx: 12 }), mark]);
    nodes.push(whole, card);
    return { nodes, halves, whole, card };
  } };
}

// The squad: a football pitch seen from above, the long side across, with a spot for each player of a team, and a
// bench beside it where the players of the missing part sit down in turn.
const PITCH_W = 330, PITCH_H = 230;
const SEAT = 48; // A player on the bench takes this much room, in the figure's units.
// The spots of the players in the order of their shirts: the keeper, four defenders, four in midfield and two up
// front, as fractions of the pitch.
const SPOTS = [[0.07, 0.5], ...[0.25, 0.5].flatMap(x => [0.14, 0.38, 0.62, 0.86].map(y => [x, y])), [0.76, 0.34], [0.76, 0.66]];
export function pitch() {
  return { w: PITCH_W, h: PITCH_H, draw(x, y) {
    const w = PITCH_W, h = PITCH_H, m = 10, box = (bx, bw, bh) => el('rect', { class: 'counters-pitch-line', x: bx, y: y + (h - bh) / 2, width: bw, height: bh });
    const nodes = [el('rect', { class: 'counters-pitch', 'data-ref': 'first', x, y, width: w, height: h, rx: 6 }),
      el('rect', { class: 'counters-pitch-line', x: x + m, y: y + m, width: w - 2 * m, height: h - 2 * m }),
      el('line', { class: 'counters-pitch-line', x1: x + w / 2, y1: y + m, x2: x + w / 2, y2: y + h - m }),
      el('circle', { class: 'counters-pitch-line', cx: x + w / 2, cy: y + h / 2, r: 34 }),
      box(x + m, 48, 130), box(x + w - m - 48, 48, 130)];
    return { nodes, spots: SPOTS.map(([px, py]) => ({ x: x + px * w, y: y + py * h })) };
  } };
}
// bench gives the size of a bench with room for n players in rows of cols, and draws it at a corner with the place of
// each player. Its area takes a tap anywhere on the bench.
export function bench(n, cols) {
  const rows = Math.ceil(n / cols), w = cols * SEAT + 2 * EDGE, h = rows * SEAT + 2 * EDGE;
  return { w, h, draw(x, y) {
    const area = el('rect', { class: 'counters-bench counters-press', 'data-ref': 'missing', x, y, width: w, height: h, rx: 10, tabindex: 0, role: 'button' });
    const seats = Array.from({ length: n }, (_, i) => ({ x: x + EDGE + (i % cols + 0.5) * SEAT, y: y + EDGE + (Math.floor(i / cols) + 0.5) * SEAT }));
    return { nodes: [area], seats, area };
  } };
}
