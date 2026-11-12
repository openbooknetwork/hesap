// The browser half of the network family. It draws an SVG graph the reader changes with the tools docked under it,
// the readouts beside them, and the values in the text that follow the graph. The driver animates what happens.
import { SIZE, R, HIT, MOST, clamp, inside, far, curve, fresh } from './layout.js';
import * as G from './graph.js';
import { measure, starts, search, found, FORMULA_STANDS } from './measures.js';
import { formatter } from './format.js';
import { BACKDROPS } from './backdrops.js';
import { GOALS, holds } from './goals.js';
import { driver } from './driver.js';
import { svg as el, h, svgPoint } from '../../kit/dom.js';
import { chip, button, segment, stepper, slider, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { drag, nudge } from '../../kit/drag.js';

// Each tool's icon, drawn with lines on a 20 by 20 grid. The tools stand in this order on every page.
const ICONS = {
  walk: 'M3 16C7 16 7 4 11 4s4 12 6 12M14 13l3 3 1-4',
  route: 'M5 18V3h10l-2 4 2 4H5',
  weight: 'M2 13L13 2l5 5L7 18zM6 9l2 2M9 6l2 2',
  paint: 'M10 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z',
  move: 'M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3',
  add: 'M10 6v8M6 10h8M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  join: 'M6.5 13.5l7-7M7 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M18 4.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
  remove: 'M5 5l10 10M15 5L5 15',
};
const ORDER = Object.keys(ICONS);
const toolIcon = t => el('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', class: 'network-icon' }, [el('path', { d: ICONS[t] })]);
const EDITS = ['add', 'join', 'remove', 'walk', 'paint'];

export default function network({ host, box, stage, panel, T, lang, moving, motion }) {
  const fx = driver(motion);
  const says = h('div', { class: 'network-say', 'aria-live': 'polite' }), fig = h('div', { class: 'network-fig' });
  stage.append(says, fig);

  // s holds the graph and what the reader did to it. pick is the vertex a join starts from, and chosen the edge whose
  // length the stepper sets. press is the vertex under a held pointer, and tapping a press on an edge or an empty spot.
  // lit, hover and pointed name the readout or link whose parts stand out.
  let spec = null, s = null, tool = null, colour = 0, pick = null, chosen = null, press = null, tapping = null, band = null, next = 'from';
  let lit = null, hover = null, pointed = null, shown = [], said = null, count = 0, drawing = false, zoom = 1;
  let svg = null, layer = {}, nodes = {}, edges = {};
  // goal is the page's goal and start the graph the page opened with. history holds the states before each change,
  // for Undo, and variant is the set of lengths Another one dealt last.
  let goal = null, start = null, solved = false, hinted = false, history = [], variant = 0;
  // The panel's parts that follow the graph.
  // stepName is the stepper's label, which names the chosen edge.
  let row1 = null, chips = [], tools = null, swatches = [], step = null, stepName = null, scrubber = null;

  // f writes numbers and measures in the page's language, and show and lang make it anew.
  let f = formatter('en');
  const fmt = n => f.fmt(n);
  const has = mark => spec.marks.includes(mark) || (hinted && GOALS[spec.goal]?.hint === mark);
  // The line over the figure says what to do and what the last change did.
  const say = (key, vars = {}) => { said = [key, vars]; tell(); };
  const tell = () => { const words = said ? T(`say-${said[0]}`, said[1]) : ''; if (says.textContent !== words) says.textContent = words; };
  const copy = v => JSON.parse(JSON.stringify(v));
  const remember = () => { history.push(copy(s)); if (history.length > 200) history.shift(); };
  // guide says how to use the chosen tool.
  const guide = () => say(tool === 'walk' && s.walk.at ? 'walk-on' : tool === 'route' && s.search != null ? 'search' : tool, { node: s.walk.at });
  const pair = e => { const [p, q] = [e.a, e.b].sort((m, n) => s.order.indexOf(m) - s.order.indexOf(n)); return { p, q }; };
  // back says whether a path drawn from vertex n along edge e runs against the way its curve is drawn.
  const back = (e, n) => pair(e).p !== n;
  const byId = id => s.edges.find(e => e.id === id);
  // The small circle beside a vertex holds its degree or its distance, and marks a distance not settled yet.
  const badge = (n, text, maybe = false) => { const b = nodes[n].badge; b.style.display = text == null ? 'none' : ''; b.lastChild.textContent = text ?? ''; b.classList.toggle('maybe', maybe); };

  // A small figure draws its vertices and labels larger, so a finger can still hit them. zoom says how much larger.
  new ResizeObserver(() => {
    const unit = Math.min(fig.clientWidth, fig.clientHeight) / (SIZE + 24), was = zoom;
    zoom = unit ? Math.min(1.4, Math.max(1, 34 / (2 * R * unit))) : 1;
    if (spec && zoom !== was) place();
  }).observe(fig);

  // ---------- drawing ----------
  const pointer = e => svgPoint(svg, e);
  const nearest = (p, not) => s.order.filter(n => n !== not && far(s.nodes[n], p) < HIT * zoom * 1.2).sort((m, n) => far(s.nodes[m], p) - far(s.nodes[n], p))[0];
  function vertex(id) {
    const label = el('text', { class: 'label' }); label.textContent = id;
    const lift = el('g', { class: 'lift' }, [el('circle', { class: 'hit', r: HIT }), el('circle', { class: 'ring', r: R + 6 }), el('circle', { class: 'disc', r: R }), label]);
    const pop = el('g', { class: 'pop a' }, [lift]);
    const badge = el('g', { class: 'badge', transform: `translate(${R * 0.85} ${-R * 0.85})` }, [el('circle', { r: 11 }), el('text')]);
    const g = el('g', { class: 'node', tabindex: 0, role: 'button', 'data-node': id }, [pop, badge]);
    // A vertex takes the pointer itself, so a drag that leaves it keeps going.
    drag(g, { point: pointer, start: (p, e) => grab(id, p, e), raise: () => { if (tool === 'move') layer.nodes.append(g); }, move: haul, drop: release });
    nudge(g, { step: (dx, dy) => shift(id, dx, dy) });
    g.addEventListener('keydown', e => key(e, { node: id }));
    return { g, pop, badge };
  }
  function link(e) {
    // The label's place is set on the outer group and its bump on the inner one, so a bump leaves the place alone.
    const bubble = el('g', { class: 'bubble a' }, [el('rect', { x: -14, y: -11, width: 28, height: 22, rx: 7 }), el('text')]), tag = el('g', { class: 'tag' }, [bubble]);
    const g = el('g', { class: 'edge a', tabindex: 0, role: 'button', 'data-edge': e.id }, [el('path', { class: 'hit' }), el('path', { class: 'line' }), el('path', { class: 'glow' }), tag]);
    g.addEventListener('keydown', ev => key(ev, { edge: e.id }));
    const [hit, line, glow] = g.querySelectorAll('path');
    return { g, hit, line, glow, tag, bubble, text: tag.querySelector('text') };
  }
  const addNode = id => { nodes[id] = vertex(id); layer.nodes.append(nodes[id].g); fx.adopt(nodes[id].g); };
  const addEdge = e => { edges[e.id] = link(e); layer.edges.append(edges[e.id].g); fx.adopt(edges[e.id].g); };
  // A removed vertex or edge fades while the graph already goes on without it.
  const drop = g => { g.classList.add('gone'); g.removeAttribute('data-node'); g.removeAttribute('data-edge'); if (moving()) fx.fade(g, () => g.remove()); else g.remove(); };

  // place sets where each vertex and edge stands.
  function place() {
    const groups = {};
    for (const e of s.edges) { const { p, q } = pair(e); (groups[p + q] ??= []).push(e); }
    for (const e of s.edges) {
      const { p, q } = pair(e), group = groups[p + q], c = curve(s.nodes[p], s.nodes[q], group.length, group.indexOf(e)), d = edges[e.id];
      for (const path of [d.hit, d.line, d.glow]) path.setAttribute('d', c.d);
      d.tag.setAttribute('transform', `translate(${c.top.x} ${c.top.y}) scale(${zoom})`);
    }
    for (const n of s.order) nodes[n].g.setAttribute('transform', `translate(${s.nodes[n].x} ${s.nodes[n].y}) scale(${zoom})`);
  }

  // decorate marks what the page shows on the graph: degrees, odd vertices, distances, loops, clashes, crossings and
  // faces.
  function decorate() {
    const odd = G.odd(s), loops = has('cycles') ? G.looped(s) : [], clash = G.clashes(s, s.paint), w = s.walk;
    // The search slider shows the distances known after its steps, dashed until the search settles a vertex.
    const run = search(s), dist = has('distance') && s.route.from ? run?.dist ?? G.dijkstra(s, s.route.from).dist : {};
    for (const n of s.order) {
      const d = nodes[n], deg = G.degree(s, n);
      d.badge.classList.toggle('dist', has('distance'));
      if (!has('distance')) badge(n, has('degree') ? fmt(deg) : null);
      else badge(n, s.route.from ? (dist[n] == null ? '∞' : fmt(dist[n])) : null, !!run && !run.done.includes(n));
      d.badge.classList.toggle('dropped', !!run?.dropped.includes(n));
      d.g.classList.toggle('now', run?.now === n);
      d.g.classList.toggle('odd', has('odd') && odd.includes(n));
      d.g.classList.toggle('here', w.at === n);
      d.g.classList.toggle('picked', pick === n);
      d.g.classList.toggle('start', spec.tools.includes('route') && s.route.from === n);
      d.g.classList.toggle('end', spec.tools.includes('route') && s.route.to === n);
      d.g.classList.toggle('clash', clash.some(id => G.ends(byId(id), n)));
      if (s.paint[n] != null) d.g.dataset.paint = s.paint[n]; else delete d.g.dataset.paint;
    }
    for (const e of s.edges) {
      const d = edges[e.id], used = w.used.indexOf(e.id), text = e.w != null ? fmt(e.w) : used >= 0 ? fmt(used + 1) : '';
      d.g.classList.toggle('loop', loops.includes(e.id));
      d.g.classList.toggle('clash', clash.includes(e.id));
      d.g.classList.toggle('used', used >= 0);
      d.g.classList.toggle('chosen', chosen === e.id);
      d.g.classList.toggle('tried', !!run?.tried.includes(e.id));
      d.g.classList.toggle('win', solved && ['tree', 'cheapest-tree'].includes(spec.goal));
      d.tag.style.display = text ? '' : 'none'; d.text.textContent = text;
      d.g.setAttribute('aria-label', T('edge', { a: e.a, b: e.b }));
    }
    // A route the reader's change made lights up from its start, edge by edge, and a freshly drawn graph shows its
    // route at once.
    const r = spec.tools.includes('route') && s.route.to && found(s) ? G.route(s, s.route.from, s.route.to) : null, now = r?.edges ?? [];
    for (const e of s.edges) edges[e.id].g.classList.toggle('path', now.includes(e.id));
    if (moving() && !drawing && r && now.join() !== shown.join()) fx.light(r.edges.map((id, i) => [edges[id].glow, back(byId(id), r.nodes[i])]).filter((_, i) => !shown.includes(now[i])));
    shown = now;
    layer.marks.replaceChildren(...(has('crossings') ? G.crossings(s).map(c => el('path', { class: 'cross', d: `M${c.x - 7} ${c.y - 7}l14 14m0 -14l-14 14` })) : []));
    const fs = has('faces') && G.faces(s);
    layer.faces.replaceChildren(...(fs ? fs.inner.flatMap((loop, i) => {
      const pts = loop.map(n => s.nodes[n]), mid = G.heart(pts);
      const t = el('text', { class: 'face-n', x: mid.x, y: mid.y }); t.textContent = fmt(i + 1);
      return [el('polygon', { class: `face c${i % 4}`, points: pts.map(p => `${p.x},${p.y}`).join(' ') }), t];
    }) : []));
    if (fs) { const t = el('text', { class: 'face-n out', x: 16, y: SIZE - 16 }); t.textContent = fmt(fs.count); layer.faces.append(t); }
  }

  // refresh writes every value that follows the graph: the readouts, the search slider, the stepper and the linked
  // values in the text.
  function refresh() {
    for (const k of chips) if (k.set(f.value(s, k.id)) && moving()) fx.flash(k.el);
    const run = search(s);
    if (scrubber) { scrubber.range.max = run?.steps ?? 0; scrubber.set(s.search); scrubber.range.disabled = !run; }
    if (step) {
      const e = chosen && byId(chosen);
      step.set(e ? e.w : step.get());
      stepName.textContent = e ? `${e.a}–${e.b}` : '';
      if (!e) for (const b of step.el.querySelectorAll('button')) b.disabled = true;
    }
    live(host, { value: id => f.value(s, id), formula: id => f.worked(s, id) });
    for (const n of s.order) nodes[n].g.setAttribute('aria-label', T('node', { node: n, degree: fmt(G.degree(s, n)) }));
  }
  const update = () => { place(); judge(); decorate(); refresh(); shade(); };

  // The goal is checked after every change. Reaching it plays one short effect on what reached it, and the goal's
  // line says Solved until a change breaks the goal.
  function judge() {
    if (!goal || !row1) return;
    const v = goal.check(s, start);
    solved = holds(v);
    row1.say(T(`goal-${spec.goal}`));
    const first = row1.show(solved, typeof v === 'string' ? T(`near-${v}`, { total: fmt(G.total(s)) }) : undefined);
    if (!first || !moving()) return;
    // The effect plays once the change that reached the goal has drawn itself.
    queueMicrotask(() => {
      if (['walked', 'circuit'].includes(spec.goal)) fx.flare(s.walk.used.map(id => edges[id].glow));
      else if (['tree', 'cheapest-tree'].includes(spec.goal)) fx.light(s.edges.map(e => [edges[e.id].glow, back(e, pair(e).p)]));
      else fx.cheer(s.order.map(n => nodes[n].pop));
    });
  }

  // The parts of the graph that one value stands for stand out. That value is the readout under the pointer, else the
  // link under it, else the pressed readout.
  function stands(id) {
    if (s.nodes[id]) return { nodes: [id] };
    if (id.startsWith('formula-')) return FORMULA_STANDS[id.slice(8)]?.(s) ?? {};
    return measure(id, s.order)?.stands(s) ?? {};
  }
  function shade() {
    const id = hover ?? pointed ?? lit, st = id ? stands(id) : {};
    for (const n of s.order) nodes[n].g.classList.toggle('hot', !!st.nodes?.includes(n));
    for (const e of s.edges) edges[e.id].g.classList.toggle('hot', !!st.edges?.includes(e.id));
    layer.faces.classList.toggle('hot', !!st.faces);
    for (const k of chips) { k.el.setAttribute('aria-pressed', k.id === lit); k.el.classList.toggle('hot', k.id === pointed); }
  }

  // ---------- what the tools do ----------
  // A change to the vertices or edges ends a walk on the graph before it.
  function changed() { if (s.walk.at) s.walk = { at: null, used: [], trail: [] }; pick = null; update(); }
  function addVertex(p) {
    if (s.order.length >= MOST) return say('full', { n: MOST });
    const id = fresh(s.order);
    remember(); s.order.push(id); s.nodes[id] = clamp(p); addNode(id); changed();
    if (moving()) fx.pop(nodes[id].pop);
    say('added', { node: id }); verdict();
  }
  function join(a, b) {
    const twice = G.between(s, a, b);
    if (twice.length && (!spec.parallel || twice.length >= 3)) { if (moving()) fx.shake([nodes[a].pop, nodes[b].pop]); pick = null; decorate(); return say('twice', { a, b }); }
    remember();
    const e = { id: `n${++count}`, a, b, w: s.edges.some(f => f.w != null) ? Math.min(Math.max(5, spec.range[0]), spec.range[1]) : null };
    s.edges.push(e); addEdge(e); changed();
    if (moving()) fx.draw(edges[e.id].line, back(e, a));
    say('joined', { a, b }); verdict();
  }
  function removeVertex(n) {
    remember();
    for (const e of s.edges.filter(f => G.ends(f, n))) { drop(edges[e.id].g); delete edges[e.id]; }
    s.edges = s.edges.filter(f => !G.ends(f, n)); s.order = s.order.filter(m => m !== n);
    delete s.nodes[n]; delete s.paint[n]; drop(nodes[n].g); delete nodes[n];
    for (const end of ['from', 'to']) if (s.route[end] === n) s.route[end] = null;
    if (chosen && !byId(chosen)) chosen = null;
    changed(); say('removed', { what: n }); verdict();
  }
  function removeEdge(id) {
    const e = byId(id);
    remember();
    s.edges = s.edges.filter(f => f.id !== id); drop(edges[id].g); delete edges[id];
    if (chosen === id) chosen = null;
    changed(); say('removed', { what: `${e.a}–${e.b}` }); verdict();
  }

  // After a change the page says what the graph has become, where its marks make that the point.
  function verdict() {
    if (has('cycles') && G.pieces(s).length > 1) return say('split', { n: fmt(G.pieces(s).length) });
    if (has('faces') && G.crossings(s).length) say('crossed');
  }

  // A walk crosses each edge once. It starts at a tapped vertex and goes on across an unused edge to the next.
  function cross(e) {
    remember();
    const w = s.walk, from = w.at, to = G.other(e, from);
    w.used.push(e.id); w.trail.push(to); w.at = to;
    update();
    if (moving()) {
      fx.draw(edges[e.id].glow, back(e, from));
      const dot = el('circle', { class: 'walker', r: 7 }); layer.fx.append(dot);
      fx.travel(dot, edges[e.id].hit, back(e, from), () => dot.remove());
    }
    const left = s.edges.length - w.used.length;
    if (!left) return;
    if (!s.edges.some(f => G.ends(f, to) && !w.used.includes(f.id))) { say('stuck', { node: to, left: fmt(left) }); if (moving()) fx.shake([nodes[to].pop]); }
    else say('walk-on', { node: to });
  }
  function walk(t) {
    const w = s.walk;
    if (t.node && !w.at) { remember(); w.at = t.node; w.trail = [t.node]; update(); if (moving()) fx.bump([nodes[t.node].pop]); return say('walk-on', { node: t.node }); }
    if (t.node) {
      if (t.node === w.at) return;
      const e = G.between(s, w.at, t.node).find(f => !w.used.includes(f.id));
      if (e) return cross(e);
      if (moving()) fx.shake([nodes[t.node].pop]);
      return say('no-edge', { a: w.at, b: t.node });
    }
    const e = t.edge && byId(t.edge);
    if (!e) return;
    if (!w.at) return say('walk');
    if (w.used.includes(e.id)) return say('used');
    if (!G.ends(e, w.at)) return say('off', { node: w.at });
    cross(e);
  }
  // Undo puts back the state before the last change, and a step of a walk counts as a change.
  function undo() {
    if (!history.length) return say('nothing');
    s = history.pop(); draw(); say('undone');
  }

  // Picking a route's start begins a new search from it, and picking its end lights the shortest route there.
  function routeTo(n) {
    if (next === 'from') { s.route = { from: n, to: null }; if (s.search != null) s.search = 0; next = 'to'; update(); return say('route-to'); }
    if (n === s.route.from) return;
    s.route.to = n; next = 'from'; update(); routed();
  }
  function routed() {
    if (!s.route.to) return;
    if (!found(s)) return say('search-from', { from: s.route.from });
    const r = G.route(s, s.route.from, s.route.to);
    say(r ? 'routed' : 'no-route', { from: s.route.from, to: s.route.to, length: r && fmt(r.length) });
  }
  // The slider shows the search after its first k steps. Each step settles one vertex and tries the edges out of it.
  function scrub(k) {
    s.search = k; update();
    const run = search(s);
    if (run.ended && s.route.to) return routed();
    if (!k) return say('search');
    say('settles', { k: fmt(k), node: run.now, dist: fmt(run.dist[run.now]) });
  }

  function paint(n) {
    const before = G.clashes(s, s.paint);
    remember();
    if (s.paint[n] === colour) delete s.paint[n]; else s.paint[n] = colour;
    update();
    const added = G.clashes(s, s.paint).filter(id => !before.includes(id)).map(byId);
    if (added.length) {
      if (moving()) fx.shake([...new Set(added.flatMap(e => [e.a, e.b]))].map(m => nodes[m].pop));
      return say('clash', { a: added[0].a, b: added[0].b });
    }
    guide();
  }
  function lengthen(w) {
    const e = chosen && byId(chosen);
    if (!e || w === e.w) return;
    e.w = w;
    update();
    if (moving()) fx.bump([edges[e.id].bubble]);
    routed();
  }

  // tap acts on a vertex, an edge or an empty spot, by pointer or by key.
  function tap(t) {
    if (tool === 'add') return t.at && inside(t.at) ? addVertex(t.at) : null;
    if (tool === 'join') {
      if (t.node && pick && t.node !== pick) return join(pick, t.node);
      pick = t.node && t.node !== pick ? t.node : null; decorate();
      return pick ? say('join-from', { node: pick }) : guide();
    }
    if (tool === 'remove') return t.node ? removeVertex(t.node) : t.edge ? removeEdge(t.edge) : null;
    if (tool === 'walk') return walk(t);
    if (tool === 'route') return t.node ? routeTo(t.node) : null;
    if (tool === 'paint') return t.node ? paint(t.node) : null;
    if (tool === 'weight') { chosen = t.edge ?? null; decorate(); refresh(); return chosen ? say('length', { a: byId(chosen).a, b: byId(chosen).b }) : guide(); }
  }
  // Enter and Space tap a focused vertex or edge. An arrow key on an edge stays in the figure, so the page stays.
  function key(e, t) {
    if (['Enter', ' '].includes(e.key) || (t.edge && e.key.startsWith('Arrow'))) { e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'Enter' || e.key === ' ') tap(t);
  }
  // An arrow key moves a focused vertex while Move is chosen.
  function shift(n, dx, dy) {
    if (tool !== 'move' || !s.nodes[n]) return;
    const p = s.nodes[n];
    remember(); s.nodes[n] = clamp({ x: p.x + dx * 10, y: p.y + dy * 10 }); update();
  }

  // ---------- the pointer ----------
  // A vertex holds the pointer through kit/drag.js. Move drags it, Join stretches a band from it to another vertex,
  // and a press that stays put taps it.
  function grab(n, p) {
    if (press || tapping) return false;
    press = { node: n, from: p, at: p, moved: false };
    if (tool === 'move') { press.dx = s.nodes[n].x - p.x; press.dy = s.nodes[n].y - p.y; }
    if (tool === 'join') { band = el('line', { class: 'band', x1: s.nodes[n].x, y1: s.nodes[n].y, x2: p.x, y2: p.y }); layer.band.append(band); }
  }
  function haul(p) {
    if (!press) return;
    press.at = p;
    if (!press.moved && far(p, press.from) < 6) return;
    if (!press.moved && tool === 'move') remember();
    press.moved = true;
    if (tool === 'move' && s.nodes[press.node]) { s.nodes[press.node] = clamp({ x: p.x + press.dx, y: p.y + press.dy }); update(); }
    if (band) {
      const to = nearest(p, press.node), end = to ? s.nodes[to] : p;
      band.setAttribute('x2', end.x); band.setAttribute('y2', end.y); band.classList.toggle('on', !!to);
      for (const m of s.order) nodes[m].g.classList.toggle('aim', m === to);
    }
  }
  // A drag the browser cancels taps and joins nothing.
  function release(e) {
    if (!press) return;
    const was = press, done = e?.type !== 'pointercancel'; press = null;
    if (was.moved && tool === 'move' && has('faces')) verdict();
    if (band) {
      const to = done && was.moved && nearest(was.at, was.node), b = band; band = null;
      for (const m of s.order) nodes[m].g.classList.remove('aim');
      if (to) { b.remove(); return join(was.node, to); }
      if (moving() && was.moved) fx.retract(b, s.nodes[was.node], () => b.remove()); else b.remove();
      if (done && !was.moved) tap({ node: was.node });
      return;
    }
    if (done && !was.moved && tool !== 'move') tap({ node: was.node });
  }
  // A press on an edge or an empty spot taps it when the pointer comes up near where it went down.
  function down(e) {
    if (e.button || press || tapping) return;
    tapping = { id: e.pointerId, edge: e.target.closest('[data-edge]')?.dataset.edge, from: pointer(e) };
    e.preventDefault();
  }
  function up(e) {
    if (!tapping || e.pointerId !== tapping.id) return;
    const t = tapping; tapping = null;
    if (far(pointer(e), t.from) < 6) tap(t.edge ? { edge: t.edge } : { at: t.from });
  }

  // ---------- the panel ----------
  function choose(t) {
    tool = t; pick = null; box.dataset.tool = t;
    tools?.set(t);
    if (step) step.el.hidden = t !== 'weight';
    if (t !== 'weight') chosen = null;
    if (s) { decorate(); refresh(); guide(); }
  }
  // A readout's label comes long, and short for a phone, which fits the readouts on one row.
  const label = (kind, m) => T(`${kind}-${m.key}`, { node: m.node });
  function drawPanel() {
    const c = spec.challenge;
    // A page with a goal shows the goal's line first, and a challenge adds Hint and Another one.
    row1 = goal ? goalRow({ T, motion: moving() ? motion : null,
      hint: c && T(`hint-${spec.goal}`) ? on => { hinted = on; decorate(); return on ? T(`hint-${spec.goal}`) : null; } : null,
      another: c?.others.length ? () => { variant = (variant + 1) % (c.others.length + 1); row1.reset(); hinted = false; begin(); draw(); say('another'); } : null }) : null;
    // The tools stand in one order on every page, and the page's first tool starts chosen.
    const order = [...spec.tools].sort((p, q) => ORDER.indexOf(p) - ORDER.indexOf(q));
    tools = spec.tools.length > 1 ? segment({ id: 'tool', label: '', items: order.map(t => [t, [toolIcon(t), h('span', {}, T(`tool-${t}`))]]), value: tool, pick: choose }) : null;
    tools?.el.classList.add('network-tools');
    swatches = spec.tools.includes('paint') ? Array.from({ length: spec.palette }, (_, i) => {
      const b = h('button', { type: 'button', class: 'network-swatch', style: `--swatch:var(--network-c${i})`, 'aria-label': T('colour', { n: i + 1 }), 'aria-pressed': String(i === colour) });
      b.addEventListener('click', () => { colour = i; for (const [k, o] of swatches.entries()) o.setAttribute('aria-pressed', String(k === i)); });
      return b;
    }) : [];
    // The stepper's output stays empty while no edge is chosen.
    step = spec.tools.includes('weight') ? stepper({ id: 'length', label: T('tool-weight'), min: spec.range[0], max: spec.range[1], value: spec.range[0], write: v => chosen ? fmt(v) : '', change: lengthen }) : null;
    if (step) { const [less, more] = step.el.querySelectorAll('button'); less.setAttribute('aria-label', T('shorter')); more.setAttribute('aria-label', T('longer')); stepName = step.el.querySelector('span'); }
    const undoer = spec.tools.some(t => EDITS.includes(t)) ? button({ label: T('undo'), act: 'undo', glyph: 'undo', compact: true, press: undo }) : null;
    // The search slider shares a row with the readouts and Start again, so a phone keeps the figure tall.
    scrubber = s.search != null ? slider({ id: 'settled', label: T('settled'), min: 0, max: 0, value: s.search, write: fmt, input: scrub }) : null;
    chips = spec.readout.map(id => {
      const m = measure(id, s.order), k = chip({ id, label: label('m', m), short: label('short', m), press: () => { lit = lit === id ? null : id; shade(); } });
      k.el.addEventListener('pointerenter', () => { if (host.canHover.matches) { hover = id; shade(); } });
      k.el.addEventListener('pointerleave', () => { hover = null; shade(); });
      return k;
    });
    const reset = button({ label: T('reset'), act: 'reset', glyph: 'reset', compact: true, cls: 'network-reset', press: () => { begin(); draw(); } });
    // Undo joins the tools, or the readouts' row on a page with no tools, so the panel keeps to two rows.
    const tools1 = [tools, swatches.length ? h('div', { class: 'network-swatches' }, swatches) : null, step].filter(Boolean);
    panel.replaceChildren(...[row1?.el, tools1.length ? row('ctls', [...tools1, undoer]) : null, row('out', [scrubber, ...chips, tools1.length ? null : undoer, reset])].filter(Boolean));
    if (step) step.el.hidden = tool !== 'weight';
  }

  // begin sets the page's graph as it opens, with the lengths of the set Another one dealt last.
  function begin() { s = starts(spec, variant); start = copy(s); history = []; solved = false; said = null; row1?.show(false); }
  // draw builds the figure for the graph in s.
  function draw() {
    fx.stop(); press = tapping = band = pick = chosen = lit = hover = pointed = null; shown = []; next = 'from';
    const backdrop = (BACKDROPS[spec.backdrop] ?? []).map(([tag, attrs]) => el(tag, attrs));
    layer = Object.fromEntries(['faces', 'edges', 'marks', 'band', 'nodes', 'fx'].map(k => [k, el('g', { class: k })]));
    svg = el('svg', { viewBox: `-12 -12 ${SIZE + 24} ${SIZE + 24}`, class: 'network-svg' }, [el('rect', { class: 'box', x: 0, y: 0, width: SIZE, height: SIZE, rx: 14 }), ...backdrop, ...Object.values(layer)]);
    svg.addEventListener('pointerdown', down); svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', () => { tapping = null; });
    fig.replaceChildren(svg);
    nodes = {}; edges = {};
    for (const n of s.order) addNode(n);
    for (const e of s.edges) addEdge(e);
    box.dataset.tool = tool;
    drawing = true; update(); drawing = false; guide();
    if (has('faces')) verdict();
  }
  // Escape lets go of a picked vertex or edge.
  function escape() { if (spec && (pick || chosen)) { pick = chosen = null; update(); guide(); } }

  return {
    show(page) {
      spec = page; goal = GOALS[spec.goal] ?? null; f = formatter(lang());
      variant = 0; hinted = false; tool = spec.tools[0]; colour = 0; count = 0;
      s = starts(spec, variant);
      drawPanel(); begin(); draw();
    },
    hide() { fx.stop(); spec = null; s = null; row1 = null; fig.replaceChildren(); says.textContent = ''; },
    point(id, on) { if (!spec) return; pointed = on ? id : null; shade(); },
    lang() { if (!spec) return; f = formatter(lang()); drawPanel(); update(); tell(); },
    escape,
  };
}
