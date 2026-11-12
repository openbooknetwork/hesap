// Shared by the geo and axes families through board.js.
// Places labels as callouts, so they leave the figure in sight: each label goes to a column on the left or right
// edge, stacked in the order of their anchors' heights and pushed apart, with a line from its inner edge to its
// anchor. The layout follows beden's, with the columns on the edges and each label keeping its side.

// The side of each anchor: left or right of the anchors' middle, the two columns within one label of each other.
export function sides(anchors) {
  const shown = anchors.map((a, i) => ({ ...a, i })).filter(a => a.visible), out = anchors.map(() => 'right');
  if (!shown.length) return out;
  const mid = shown.reduce((s, a) => s + a.x, 0) / shown.length;
  const left = shown.filter(a => a.x < mid), right = shown.filter(a => a.x >= mid);
  while (Math.abs(left.length - right.length) > 1) {
    const [from, to, inner] = left.length > right.length ? [left, right, (a, b) => b.x - a.x] : [right, left, (a, b) => a.x - b.x];
    from.sort(inner); to.push(from.shift());
  }
  for (const a of left) out[a.i] = 'left';
  return out;
}

// anchors are screen points { x, y, visible, side }, sizes { w, h } in pixels. Returns per anchor { x, y, from, to },
// the label's corner and its line, or null for a hidden one.
export function callouts(anchors, sizes, { width, height, margin = 8, spacing = 4 }) {
  const out = anchors.map(() => null);
  for (const side of ['left', 'right']) {
    const col = anchors.map((a, i) => ({ ...a, i })).filter(a => a.visible && a.side === side).sort((a, b) => a.y - b.y);
    if (!col.length) continue;
    const h = col.map(a => sizes[a.i].h), top = col.map((a, k) => a.y - h[k] / 2);
    for (let k = 1; k < col.length; k++) top[k] = Math.max(top[k], top[k - 1] + h[k - 1] + spacing);
    const over = top.at(-1) + h.at(-1) - (height - margin);
    if (over > 0) { top[top.length - 1] -= over; for (let k = top.length - 2; k >= 0; k--) top[k] = Math.min(top[k], top[k + 1] - h[k] - spacing); }
    if (top[0] < margin) { const push = margin - top[0]; for (let k = 0; k < top.length; k++) top[k] += push; }
    col.forEach((a, k) => {
      const w = sizes[a.i].w, x = side === 'left' ? margin : width - margin - w, y = top[k];
      out[a.i] = { x, y, from: [side === 'left' ? x + w : x, y + h[k] / 2], to: [a.x, a.y] };
    });
  }
  return out;
}
