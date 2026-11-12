// Where things sit in the figure: the box the vertices stand in, x and y from 0 to 400 with y down, and the path of
// each edge.
export const SIZE = 400, R = 18, HIT = 27, MOST = 15;
export const clamp = p => ({ x: Math.min(Math.max(p.x, R + 4), SIZE - R - 4), y: Math.min(Math.max(p.y, R + 4), SIZE - R - 4) });
export const inside = p => p.x >= 0 && p.x <= SIZE && p.y >= 0 && p.y <= SIZE;
export const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// An edge runs from the end that comes first in the graph's order. Several edges between the same two vertices bow
// apart, so each stays in sight. k is how many there are, and i is which one this is.
export function curve(p, q, k = 1, i = 0) {
  const off = (i - (k - 1) / 2) * 38, dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
  const top = { x: (p.x + q.x) / 2 - dy / len * off, y: (p.y + q.y) / 2 + dx / len * off };
  return { d: `M${p.x} ${p.y}Q${2 * top.x - (p.x + q.x) / 2} ${2 * top.y - (p.y + q.y) / 2} ${q.x} ${q.y}`, top };
}

// the first letter no vertex has yet
export const fresh = order => [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(n => !order.includes(n));
