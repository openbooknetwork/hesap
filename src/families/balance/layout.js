// This file places the scale's parts: the beam on its stand, a pan at each end of the beam, and the things on each
// pan. A pan's things sit in the pan's own frame, whose 0 is the middle of the plate's top. The view leaves out the
// empty top of the scale's frame, and a tall stack of balloons may rise past it.
export const VIEW = { x: 47, y: 60, width: 386, height: 276 }, PIVOT = { x: 240, y: 240 }, ARM = 120, LIFT = 26, PLATE = 130, FLOOR = 322;
export const TRAY = { x: 240, y: 308, width: 92, height: 24 }, MOST = 12;
const MAX = 12, GAP = 2;

// tilt gives the beam's turn in degrees. The heavier side goes down, and a small difference turns it a little.
export const tilt = (left, right) => MAX * Math.tanh((left - right) / 3);
// pan gives the middle of a pan's plate for a turn of the beam, with the left pan lower for a positive turn
export const pan = (side, deg) => { const t = deg * Math.PI / 180, k = side === 'l' ? -1 : 1; return { x: PIVOT.x + k * ARM * Math.cos(t), y: PIVOT.y - k * ARM * Math.sin(t) - LIFT }; };
// over gives the pan that a point in the scale's frame lies over, or null when it lies over neither
export const over = (p, deg) => ['l', 'r'].find(s => { const c = pan(s, deg); return Math.abs(p.x - c.x) < PLATE / 2 + 24 && p.y > c.y - 190 && p.y < c.y + 44; }) ?? null;

// things lists what one side of an equation puts on its pan: a box for each x, a weight for each 1, and a balloon for
// each one below zero, which pulls the pan up. A count that is large or not whole becomes one block with the count
// written on it. words writes a count of x and a number as text, and reveal is what a box shows in place of x.
export function things(side, s, words, reveal) {
  const out = [], whole = (a, most) => a.d === 1 && Math.abs(a.n) <= most;
  const a = side.x, c = side.c;
  if (whole(a, 6)) for (let i = 0; i < Math.abs(a.n); i++) out.push(a.n > 0 ? { key: `${s}.x${i}`, kind: 'box', label: reveal ?? 'x', w: 36, h: 36 } : { key: `${s}.y${i}`, kind: 'xballoon', balloon: true, label: 'x', r: 16 });
  else { const label = words.xs(a), w = Math.max(36, 14 + 10 * label.length); out.push(a.n > 0 ? { key: `${s}.X`, kind: 'box', label, w, h: 36 } : { key: `${s}.Y`, kind: 'xballoon', balloon: true, label, r: Math.max(16, 4 + 5 * label.length) }); }
  if (whole(c, MOST)) for (let i = 0; i < Math.abs(c.n); i++) out.push(c.n > 0 ? { key: `${s}.c${i}`, kind: 'unit', label: '1', w: 24, h: 24 } : { key: `${s}.b${i}`, kind: 'balloon', balloon: true, label: '1', r: 13 });
  else { const label = words.size(c), w = Math.max(30, 12 + 9 * label.length); out.push(c.n > 0 ? { key: `${s}.C`, kind: 'block', label, w, h: 28 } : { key: `${s}.B`, kind: 'balloon', balloon: true, label, r: Math.max(14, 4 + 5 * label.length) }); }
  return out;
}

// arrange finds each thing's middle on the plate. Weights fill rows from the plate up, and each row is centred.
// Balloons float in rows of five above the highest weight, each on a string tied to the plate.
export function arrange(list) {
  const at = {}, rows = [];
  let row = [], width = 0;
  for (const t of list.filter(t => !t.balloon)) {
    if (row.length && width + GAP + t.w > PLATE) { rows.push(row); row = []; width = 0; }
    width += (row.length ? GAP : 0) + t.w; row.push(t);
  }
  if (row.length) rows.push(row);
  let base = 0;
  for (const r of rows) {
    let x = -(r.reduce((s, t) => s + t.w, 0) + GAP * (r.length - 1)) / 2;
    for (const t of r) { at[t.key] = { x: x + t.w / 2, y: base - t.h / 2 }; x += t.w + GAP; }
    base -= Math.max(...r.map(t => t.h)) + GAP;
  }
  const balloons = list.filter(t => t.balloon);
  balloons.forEach((t, i) => {
    const line = Math.floor(i / 5), n = Math.min(5, balloons.length - line * 5), col = i % 5, x = (col - (n - 1) / 2) * 31 + (line % 2) * 15;
    at[t.key] = { x, y: base - 48 - line * 32 - (col % 2) * 7, anchor: { x: x * 0.45, y: 0 } };
  });
  return list.map(t => ({ ...t, ...at[t.key] }));
}
