// Ten frames: two rows of five cells. A frame's cells are places for counters, and each cell is a target to tap.
import { svg as el } from '../../kit/dom.js';

// A cell is this wide in the figure's units, about 44px on a phone.
export const CELL = 44;
// Two frames side by side or one above the other stand this far apart.
const BETWEEN = 16;

// tenFrame draws one frame with its top left corner at x, y and gives the middle of each cell.
export function tenFrame(x, y, cell = CELL) {
  const lines = [];
  for (let i = 1; i < 5; i++) lines.push(el('line', { x1: x + i * cell, y1: y, x2: x + i * cell, y2: y + 2 * cell }));
  lines.push(el('line', { x1: x, y1: y + cell, x2: x + 5 * cell, y2: y + cell }));
  const g = el('g', { class: 'counters-frame' }, [el('rect', { class: 'counters-frame-box', x, y, width: 5 * cell, height: 2 * cell, rx: 6 }), ...lines]);
  const cells = Array.from({ length: 10 }, (_, i) => ({ x: x + (i % 5 + 0.5) * cell, y: y + (Math.floor(i / 5) + 0.5) * cell }));
  return { g, cells };
}

// frames gives the ways to set n frames out: side by side, and for two frames also one above the other. Each way has
// its size and draws the frames at a corner, giving the middle of every cell in order.
export function frames(n, cell = CELL) {
  const ways = [{ w: n * 5 * cell + (n - 1) * BETWEEN, h: 2 * cell, at: i => ({ x: i * (5 * cell + BETWEEN), y: 0 }) }];
  if (n > 1) ways.push({ w: 5 * cell, h: n * 2 * cell + (n - 1) * BETWEEN, at: i => ({ x: 0, y: i * (2 * cell + BETWEEN) }) });
  return ways.map(way => ({ w: way.w, h: way.h, draw(x, y) {
    const fs = Array.from({ length: n }, (_, i) => { const p = way.at(i); return tenFrame(x + p.x, y + p.y, cell); });
    return { nodes: fs.map(f => f.g), cells: fs.flatMap(f => f.cells) };
  } }));
}
