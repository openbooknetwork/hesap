// fit places a scene's parts on a stage w by h pixels. The graph goes beside the circle or under it, whichever gives
// the larger circle. s is the pixels in one unit, the radius of the unit circle.
// YLAB is the room for the graph's y labels on its left, and XLAB is the room for half of its last x label on its right.
const YLAB = 34, XLAB = 16, WIDE = 3.4, MOST = 150;

// box gives, in units, how far the circle side reaches left, right, up and down, and how far the graph reaches up and
// down. The graph is at least WIDE units across and at most one turn unrolled at its true length.
export function fit(w, h, { side, graph }) {
  const M = w < 500 ? 10 : 18, GAP = w < 500 ? 20 : 30; // A phone spares smaller margins.
  const sw = side.l + side.r, sh = side.u + side.d;
  if (!graph) {
    const s = Math.min((w - 2 * M) / sw, (h - 2 * M) / sh, MOST);
    return { mode: 'one', s, cx: w / 2 + (side.l - side.r) / 2 * s, cy: h / 2 + (side.u - side.d) / 2 * s };
  }
  const up = Math.max(side.u, graph.u), down = Math.max(side.d, graph.d);
  const beside = Math.min((h - 2 * M) / (up + down), (w - 2 * M - GAP - YLAB - XLAB) / (sw + WIDE), MOST);
  const under = Math.min((h - 2 * M - GAP) / (sh + graph.u + graph.d), (w - 2 * M) / sw, (w - 2 * M - YLAB - XLAB) / WIDE, MOST);
  if (beside >= 0.8 * under) {
    const s = beside, gw = Math.min(w - 2 * M - GAP - YLAB - XLAB - sw * s, 2 * Math.PI * s), x0 = (w - sw * s - GAP - YLAB - gw - XLAB) / 2;
    const cy = (h - (up + down) * s) / 2 + up * s, gx = x0 + sw * s + GAP + YLAB;
    return { mode: 'beside', s, cx: x0 + side.l * s, cy, gx, gw, gy: cy };
  }
  const s = under, gw = Math.min(w - 2 * M - YLAB - XLAB, 2 * Math.PI * s), y0 = (h - (sh + graph.u + graph.d) * s - GAP) / 2;
  return { mode: 'under', s, cx: w / 2 + (side.l - side.r) / 2 * s, cy: y0 + side.u * s, gx: (w - gw + YLAB - XLAB) / 2, gw, gy: y0 + sh * s + GAP + graph.u * s };
}
