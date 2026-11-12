// Where counters sit inside a place, and how the blocks of a figure are set out on the stage.

// cluster sets n counters in short centred rows round the point 0, 0, so a part reads at a glance.
export function cluster(n, gap) {
  const cols = n <= 3 ? n : n === 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5, rows = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols, c = i % cols;
    return { x: (c - (inRow - 1) / 2) * gap, y: (r - (rows - 1) / 2) * gap };
  });
}
// reach gives how far from the middle the counters of a cluster of up to max counters go.
export const reach = (max, gap) => Math.max(0, ...Array.from({ length: max }, (_, n) => Math.max(...cluster(n + 1, gap).map(p => Math.hypot(p.x, p.y)))));

// grid sets counters in rows of cols from the top left, the way a tray holds them.
export const grid = (i, cols, gap) => ({ x: (i % cols + 0.5) * gap, y: (Math.floor(i / cols) + 0.5) * gap });

// heap sets counters in a pile that narrows to the top, with these rows from the bottom.
export const HEAP = [5, 5, 4, 3, 2, 1];
export function heap(i, gap) {
  let row = 0, left = i;
  while (row < HEAP.length - 1 && left >= HEAP[row]) { left -= HEAP[row]; row++; }
  const n = HEAP[row] ?? 1, shift = row % 2 && n === HEAP[row - 1] ? 0.5 : 0;
  return { x: (left - (n - 1) / 2 + shift) * gap * 0.86, y: -row * gap * 0.64 };
}

// The gap between two blocks of a figure.
const SPACE = 28;
// arrange tries each way to set out the blocks, one under another, side by side, or the last block beside the
// others, with each block's own ways, and keeps the one that fits the box w by h at the largest scale.
export function arrange(blocks, w, h) {
  const combos = blocks.reduce((all, ways) => all.flatMap(c => ways.map(v => [...c, v])), [[]]);
  let best = null;
  const offer = (cw, ch, items) => { const scale = Math.min(w / cw, h / ch); if (!best || scale > best.scale + 1e-6) best = { scale, w: cw, h: ch, items }; };
  const column = vs => { const cw = Math.max(...vs.map(v => v.w)); let y = 0; return { w: cw, h: vs.reduce((s, v) => s + v.h, 0) + SPACE * (vs.length - 1), items: vs.map(v => { const it = { v, x: (cw - v.w) / 2, y }; y += v.h + SPACE; return it; }) }; };
  for (const vs of combos) {
    const col = column(vs); offer(col.w, col.h, col.items);
    if (vs.length < 2) continue;
    const rh = Math.max(...vs.map(v => v.h)); let x = 0;
    offer(vs.reduce((s, v) => s + v.w, 0) + SPACE * (vs.length - 1), rh, vs.map(v => { const it = { v, x, y: (rh - v.h) / 2 }; x += v.w + SPACE; return it; }));
    if (vs.length < 3) continue;
    const main = column(vs.slice(0, -1)), side = vs.at(-1), sh = Math.max(main.h, side.h);
    offer(main.w + SPACE + side.w, sh, [...main.items.map(it => ({ ...it, y: it.y + (sh - main.h) / 2 })), { v: side, x: main.w + SPACE, y: (sh - side.h) / 2 }]);
  }
  return best;
}
