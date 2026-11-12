// The measures a page reads out and its text links, by id. A state is the graph with what the reader did to it:
// paint (each painted vertex's colour), walk (the vertex the walk is at and the edges it used), route (its ends) and
// search (how many steps of the search the slider shows, null on a page with no search slider).
import * as G from './graph.js';

const all = s => ({ nodes: s.order }), every = s => ({ edges: s.edges.map(e => e.id) });
// the search the slider shows, null on a page with no search slider
export const search = s => s.search == null || !s.route.from ? null : G.partial(s, s.route.from, s.search);
// the route counts as found once the search has settled its end, or ended without reaching it
export const found = s => { const run = search(s); return !run || run.ended || run.done.includes(s.route.to); };
const shortest = s => found(s) ? G.route(s, s.route.from, s.route.to) : null;
const known = (s, f) => !s.route.to ? null : found(s) ? f(shortest(s)) : null;
// a slow count is kept for the graph it was worked out for
const kept = (f, last = {}) => s => { const key = s.order.join() + s.edges.map(e => e.a + e.b).join(); if (last.key !== key) Object.assign(last, { key, v: f(s) }); return last.v; };
const fewest = kept(G.fewest);
const faces = s => G.faces(s);

// each measure: its kind, its value for a state, and what it stands for in the figure
const MEASURES = {
  nodes: ['count', s => s.order.length, all],
  edges: ['count', s => s.edges.length, every],
  'degree-sum': ['count', s => s.order.reduce((k, n) => k + G.degree(s, n), 0), all],
  'odd-nodes': ['count', s => G.odd(s).length, s => ({ nodes: G.odd(s) })],
  components: ['count', s => G.pieces(s).length, all],
  extra: ['count', s => s.edges.length - s.order.length + G.pieces(s).length, s => ({ edges: G.looped(s) })],
  tree: ['truth', G.tree, every],
  walk: ['truth', G.walkable, s => ({ nodes: G.odd(s) })],
  used: ['count', s => s.walk.used.length, s => ({ edges: s.walk.used })],
  from: ['name', s => s.route.from, s => ({ nodes: [s.route.from] })],
  to: ['name', s => s.route.to, s => ({ nodes: [s.route.to] })],
  total: ['count', G.total, every],
  distance: ['length', s => known(s, r => r?.length ?? Infinity), s => ({ nodes: shortest(s)?.nodes ?? [], edges: shortest(s)?.edges ?? [] })],
  path: ['path', s => known(s, r => r?.nodes ?? []), s => ({ nodes: shortest(s)?.nodes ?? [], edges: shortest(s)?.edges ?? [] })],
  colours: ['count', s => new Set(s.order.map(n => s.paint[n]).filter(c => c != null)).size, s => ({ nodes: s.order.filter(n => s.paint[n] != null) })],
  conflicts: ['count', s => G.clashes(s, s.paint).length, s => { const es = G.clashes(s, s.paint); return { edges: es, nodes: s.edges.filter(e => es.includes(e.id)).flatMap(e => [e.a, e.b]) }; }],
  uncoloured: ['count', s => s.order.filter(n => s.paint[n] == null).length, s => ({ nodes: s.order.filter(n => s.paint[n] == null) })],
  chromatic: ['count', fewest, all],
  crossings: ['count', s => G.crossings(s).length, s => ({ edges: G.crossings(s).flatMap(c => [c.e, c.f]) })],
  faces: ['count', s => faces(s)?.count ?? null, () => ({ faces: true })],
  euler: ['count', s => { const f = faces(s); return f && s.order.length - s.edges.length + f.count; }, () => ({ faces: true })],
};
export const NAMES = [...Object.keys(MEASURES), 'degree-<vertex>'];

// the measure an id names, null when it names none of these. key picks its label.
export function measure(id, order) {
  if (MEASURES[id]) { const [kind, value, stands] = MEASURES[id]; return { id, key: id, kind, value, stands }; }
  const n = /^degree-([A-Z])$/.exec(id)?.[1];
  if (!n || !order.includes(n)) return null;
  return { id, key: 'degree', node: n, kind: 'count', value: s => G.degree(s, n), stands: s => ({ nodes: [n], edges: s.edges.filter(e => G.ends(e, n)).map(e => e.id) }) };
}

// The worked formulas a text can link: the handshake rule, the edges a tree has and Euler's formula. Each step is a
// [tex, words] pair with its numbers written by N, the numbers of kit/format.js.
export const FORMULAS = {
  handshake: (s, N) => { const ds = s.order.map(m => G.degree(s, m)), sum = s.order.map(m => `d(${m})`).join(' + '), total = ds.reduce((a, b) => a + b, 0), E = s.edges.length;
    const twice = [`= 2 \\times ${N.tex(E)}`, `= 2 × ${N.fmt(E)}`];
    return s.order.length ? [[sum, sum], [`= ${ds.map(d => N.tex(d)).join(' + ')}`, `= ${ds.map(d => N.fmt(d)).join(' + ')}`], [`= ${N.tex(total)}`, `= ${N.fmt(total)}`], twice]
      : [[N.tex(0), N.fmt(0)], twice]; },
  tree: (s, N) => { const E = s.edges.length, V = s.order.length;
    return [['E - (V - 1)', 'E − (V − 1)'], [`= ${N.tex(E)} - (${N.tex(V)} - 1)`, `= ${N.fmt(E)} − (${N.fmt(V)} − 1)`], [`= ${N.tex(E - V + 1)}`, `= ${N.fmt(E - V + 1)}`]]; },
  euler: (s, N) => { const F = faces(s), V = s.order.length, E = s.edges.length, head = ['V - E + F', 'V − E + F'];
    return F ? [head, [`= ${N.tex(V)} - ${N.tex(E)} + ${N.tex(F.count)}`, `= ${N.fmt(V)} − ${N.fmt(E)} + ${N.fmt(F.count)}`], [`= ${N.tex(V - E + F.count)}`, `= ${N.fmt(V - E + F.count)}`]]
      : [head, [`= ${N.tex(V)} - ${N.tex(E)} + {?}`, `= ${N.fmt(V)} − ${N.fmt(E)} + ?`]]; },
};
export const FORMULA_STANDS = { handshake: all, tree: every, euler: () => ({ faces: true }) };

// the state a page opens with, and with the lengths of a challenge's k-th further set when k is above 0
export const starts = (spec, k = 0) => ({
  order: [...spec.graph.order], nodes: Object.fromEntries(spec.graph.order.map(id => [id, { ...spec.graph.nodes[id] }])),
  edges: spec.graph.edges.map((e, i) => ({ ...e, w: k ? spec.challenge.others[k - 1][i] : e.w })), paint: {}, walk: { at: null, used: [], trail: [] }, route: { from: spec.route?.from ?? null, to: spec.route?.to ?? null }, search: spec.search ?? null,
});
