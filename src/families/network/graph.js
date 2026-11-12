// Graph algorithms. A graph is { order, nodes, edges }: the vertex ids in order, where each vertex stands as { x, y },
// and the edges as { id, a, b, w } with w the edge's length, or null when the edges have none.
export const ends = (e, n) => e.a === n || e.b === n;
export const other = (e, n) => e.a === n ? e.b : e.a;
export const degree = (g, n) => g.edges.reduce((k, e) => k + (e.a === n) + (e.b === n), 0);
export const odd = g => g.order.filter(n => degree(g, n) % 2);
export const between = (g, p, q) => g.edges.filter(e => ends(e, p) && ends(e, q));

// the pieces the graph falls into, each a list of vertex ids
export function pieces(g) {
  const up = Object.fromEntries(g.order.map(n => [n, n])), root = n => up[n] === n ? n : (up[n] = root(up[n]));
  for (const e of g.edges) up[root(e.a)] = root(e.b);
  const by = {};
  for (const n of g.order) (by[root(n)] ??= []).push(n);
  return Object.values(by);
}
const joined = (g, p, q) => pieces(g).some(part => part.includes(p) && part.includes(q));
// An edge lies on a loop when its two ends stay joined without it.
export const looped = g => g.edges.filter(e => joined({ ...g, edges: g.edges.filter(f => f !== e) }, e.a, e.b)).map(e => e.id);
export const tree = g => g.order.length > 0 && pieces(g).length === 1 && g.edges.length === g.order.length - 1;
// A walk that crosses every edge once exists when the edges lie in one piece and no more than two vertices are odd.
export const walkable = g => g.edges.length > 0 && pieces(g).filter(p => p.some(n => degree(g, n))).length === 1 && odd(g).length <= 2;

// Dijkstra's search runs from one vertex. Each step settles the nearest unsettled vertex and tries the edges out of
// it. A tie goes to the vertex that comes first in the graph's order.
export function dijkstra(g, from) {
  const dist = { [from]: 0 }, via = {}, done = new Set(), steps = [];
  for (;;) {
    const n = g.order.filter(m => !done.has(m) && dist[m] != null).sort((p, q) => dist[p] - dist[q])[0];
    if (n == null) return { dist, via, steps };
    done.add(n);
    const tries = [];
    for (const e of g.edges) {
      if (!ends(e, n) || done.has(other(e, n))) continue;
      const m = other(e, n), d = dist[n] + (e.w ?? 1), better = dist[m] == null || d < dist[m];
      if (better) { dist[m] = d; via[m] = e.id; }
      tries.push({ edge: e.id, node: m, dist: d, better });
    }
    steps.push({ node: n, dist: dist[n], tries });
  }
}
// The search after its first k steps: the distance known so far to each vertex reached, the vertices settled, the
// vertex the k-th step settled, the edges it tried and the neighbours whose distance dropped.
export function partial(g, from, k) {
  const { steps } = dijkstra(g, from), dist = { [from]: 0 }, last = steps[k - 1];
  for (const st of steps.slice(0, k)) for (const t of st.tries) if (t.better) dist[t.node] = t.dist;
  return { dist, done: steps.slice(0, k).map(st => st.node), now: last?.node ?? null, tried: last?.tries.map(t => t.edge) ?? [],
    dropped: last?.tries.filter(t => t.better).map(t => t.node) ?? [], steps: steps.length, ended: k >= steps.length };
}
// the shortest route between two vertices as its length, vertices and edges, null when none joins them
export function route(g, from, to) {
  if (!g.nodes[from] || !g.nodes[to]) return null;
  const { dist, via } = dijkstra(g, from);
  if (dist[to] == null) return null;
  const nodes = [to], edges = [];
  for (let n = to; n !== from;) { const e = g.edges.find(f => f.id === via[n]); edges.unshift(e.id); n = other(e, n); nodes.unshift(n); }
  return { length: dist[to], nodes, edges };
}

// This finds the smallest total length of a tree that joins every vertex of each piece, by Kruskal's method. It tries
// the edges shortest first and keeps each one that joins two pieces not yet joined.
export function cheapest(g) {
  const up = Object.fromEntries(g.order.map(n => [n, n])), root = n => up[n] === n ? n : (up[n] = root(up[n]));
  let total = 0;
  for (const e of [...g.edges].sort((e, f) => (e.w ?? 1) - (f.w ?? 1))) if (root(e.a) !== root(e.b)) { up[root(e.a)] = root(e.b); total += e.w ?? 1; }
  return total;
}
export const total = g => g.edges.reduce((k, e) => k + (e.w ?? 1), 0);

// the edges whose two ends share a colour, given paint, the colour of each painted vertex
export const clashes = (g, paint) => g.edges.filter(e => paint[e.a] != null && paint[e.a] === paint[e.b]).map(e => e.id);
// the fewest colours that leave no edge between two vertices of one colour, found by trying each count in turn
export function fewest(g) {
  const near = Object.fromEntries(g.order.map(n => [n, g.edges.filter(e => ends(e, n)).map(e => other(e, n))])), paint = {};
  const fill = (i, k) => {
    if (i === g.order.length) return true;
    const n = g.order[i];
    for (let c = 0; c < k; c++) {
      if (near[n].some(m => paint[m] === c)) continue;
      paint[n] = c;
      if (fill(i + 1, k)) return true;
    }
    delete paint[n];
    return false;
  };
  for (let k = 1; k <= g.order.length; k++) if (fill(0, k)) return k;
  return 0;
}

// the pairs of straight edges that cross, with the point where they cross
const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
export function crossings(g) {
  const out = [];
  g.edges.forEach((e, i) => { for (const f of g.edges.slice(i + 1)) {
    if (ends(f, e.a) || ends(f, e.b)) continue;
    const [p, q, r, s] = [e.a, e.b, f.a, f.b].map(n => g.nodes[n]), d1 = side(r, s, p), d2 = side(r, s, q);
    if (d1 * d2 >= 0 || side(p, q, r) * side(p, q, s) >= 0) continue;
    const t = d1 / (d1 - d2);
    out.push({ e: e.id, f: f.id, x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
  } });
  return out;
}

// The faces of a drawing with no crossings, as loops of vertices, null while edges cross. Each loop follows the
// boundary of one region, turning to the next edge round each vertex. A loop with positive area bounds an inner
// face, the others run round the outside, which counts as one more face.
export function faces(g) {
  if (crossings(g).length) return null;
  const angle = (n, m) => Math.atan2(g.nodes[m].y - g.nodes[n].y, g.nodes[m].x - g.nodes[n].x);
  const round = Object.fromEntries(g.order.map(n => [n, g.edges.filter(e => ends(e, n)).sort((e, f) => angle(n, other(e, n)) - angle(n, other(f, n)))]));
  const seen = new Set(), inner = [];
  for (const e of g.edges) for (const from of [e.a, e.b]) {
    const loop = [];
    for (let f = e, n = from; !seen.has(`${f.id}:${n}`);) {
      seen.add(`${f.id}:${n}`); loop.push(n);
      const m = other(f, n), list = round[m];
      f = list[(list.indexOf(f) - 1 + list.length) % list.length]; n = m;
    }
    const area = loop.reduce((k, n, i) => { const p = g.nodes[n], q = g.nodes[loop[(i + 1) % loop.length]]; return k + p.x * q.y - q.x * p.y; }, 0) / 2;
    if (loop.length && area > 1) inner.push(loop);
  }
  return { inner, count: inner.length + 1 };
}

// the point deepest inside a polygon, as far as it can be from its sides, where a face's number goes
export function heart(pts) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y), sides = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  const within = q => sides.reduce((k, [p, r]) => k ^ ((p.y > q.y) !== (r.y > q.y) && q.x < p.x + (q.y - p.y) * (r.x - p.x) / (r.y - p.y)), false);
  const gap = (q, [p, r]) => { const dx = r.x - p.x, dy = r.y - p.y, t = Math.max(0, Math.min(1, ((q.x - p.x) * dx + (q.y - p.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(q.x - p.x - t * dx, q.y - p.y - t * dy); };
  let best = { x: xs.reduce((a, b) => a + b) / xs.length, y: ys.reduce((a, b) => a + b) / ys.length }, most = 0;
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 5) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 5) {
    const q = { x, y }, d = within(q) ? Math.min(...sides.map(sd => gap(q, sd))) : 0;
    if (d > most) { most = d; best = q; }
  }
  return best;
}
