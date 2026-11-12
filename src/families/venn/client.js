// The browser half of the venn family: an SVG diagram whose elements the reader drags between the sets, the readouts
// docked under it, and the values in the text that follow the diagram. The driver animates what happens.
import { VIEW, BOX, radius, circles, zoneAt, clamp, settle, spots } from './layout.js';
import { measure, evaluate } from './measures.js';
import { GOALS, holds, about } from './goals.js';
import { show, pictured } from './elements.js';
import { driver } from './driver.js';
import { formatter, starts } from './format.js';
import { svg as el, h, svgPoint } from '../../kit/dom.js';
import { chip, button, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';
import { drag, nudge } from '../../kit/drag.js';

export default function venn({ host, box, stage, panel, T, lang, moving, motion: fx }) {
  const go = driver(fx);
  // member: the sets each element is in. at: where each element sits. lit: the readout whose region stays shaded.
  // aim: the challenge's target the reader works on, conds: its conditions, solved: whether the reader met them.
  let spec = null, names = [], cs = [], R = 0, member = {}, at = {}, nodes = {}, rings = {}, zones = [], glides = {}, svg = null, ripples = null, top = null;
  let grab = null, lit = null, hover = null, pointed = null, aim = 0, conds = [], solved = false;
  let goal = null, reads = [], wants = [];

  const F = () => formatter(lang());
  const M = id => measure(id, names, spec.elements);

  // every value that follows the elements: the readouts, the linked values in the text and the challenge's conditions
  function refresh() {
    const f = F(), now = id => f.value(spec, member, id);
    for (const k of reads) {
      const m = M(k.id);
      if (m.kind === 'subset' || m.kind === 'member') k.el.dataset.holds = evaluate(m, member, spec.elements);
      if (k.set(now(k.id)) && moving()) fx.flash(k.el);
    }
    live(host, { value: now, formula: id => f.worked(spec, member, id) });
    for (const e of spec.elements) nodes[e].g.setAttribute('aria-label', `${T(e) ?? e}, ${member[e].join(' ∩ ') || 'U'}`);
    judge();
  }

  // the conditions of the target the reader works on
  const target = () => { const c = spec.challenge; conds = c ? GOALS[c.goal].conditions(c.targets[aim], names).map(x => ({ ...x, m: M(x.id) })) : []; };
  // Each condition shows whether it holds. The reader meets the goal when all of them hold with no element in hand,
  // and the page shows it once, until a change breaks a condition.
  function judge() {
    if (!goal) return;
    const met = conds.map(c => holds(c.m, c.want, member, spec.elements));
    wants.forEach((w, i) => { if (w.dataset.met === 'false' && met[i] && moving()) fx.flash(w); w.dataset.met = met[i]; });
    if (!met.every(Boolean)) solved = false;
    else if (!solved && !grab) {
      solved = true;
      const els = [...new Set(conds.flatMap(c => about(c.m, member, spec.elements)))].map(e => nodes[e].pop);
      if (moving()) go.cheer(els.length ? els : Object.values(rings));
    }
    goal.show(solved);
    box.toggleAttribute('data-solved', solved);
  }

  // The region of one measure is shaded: the readout under the pointer, else the link under it, else the pressed one.
  function shade() {
    const id = hover ?? pointed ?? lit, m = id && M(id);
    for (const z of zones) z.rect.classList.toggle('on', !!m && m.test(z.zone));
    for (const part of panel.querySelectorAll('.hesap-chip[data-ref]')) { part.setAttribute('aria-pressed', part.dataset.ref === lit); part.classList.toggle('hot', part.dataset.ref === pointed); }
    for (const e of spec.elements) nodes[e].g.classList.toggle('hot', e === pointed || e === m?.element);
  }
  // the circles that hold an element stand out while the reader points at it
  const hold = id => { for (const n of names) rings[n].classList.toggle('holds', id != null && member[id].includes(n)); };

  const place = id => nodes[id].g.setAttribute('transform', `translate(${at[id].x} ${at[id].y})`);
  const others = id => [...cs.map(c => c.label), ...spec.elements.filter(e => e !== id).map(e => at[e])];
  const halt = id => { glides[id]?.pause(); delete glides[id]; };
  function glide(id, to) {
    halt(id);
    if (moving()) glides[id] = go.glide(at[id], to, () => place(id)); else { Object.assign(at[id], to); place(id); }
  }
  const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), same = (a, b) => member[a].join() === member[b].join();
  // An element comes to rest on the free spot nearest to where it was let go. In a region with no free spot, the
  // elements there make room: each takes the nearest of the region's new spots, the arriving one first.
  function rest(id) {
    const to = settle(cs, member[id], at[id], others(id)), mates = spec.elements.filter(e => e !== id && same(e, id));
    if (mates.every(e => far(at[e], to) >= 2 * R)) return glide(id, to);
    const free = spots(cs, member[id], mates.length + 1, [...cs.map(c => c.label), ...spec.elements.filter(e => !same(e, id)).map(e => at[e])]);
    for (const e of [id, ...mates]) { free.sort((p, q) => far(p, at[e]) - far(q, at[e])); glide(e, free.shift()); }
  }

  // An element follows the pointer. When it crosses a border the sets change at once, and the diagram shows it.
  function move(id, to) {
    Object.assign(at[id], clamp(to, R)); place(id);
    const was = member[id], now = zoneAt(cs, at[id]);
    if (now.join() === was.join()) return;
    member[id] = now; hold(id); refresh();
    if (!moving()) return;
    const gains = now.length > was.length || now.some(n => !was.includes(n));
    for (const n of names) if (was.includes(n) !== now.includes(n)) go.pulse(rings[n], now.includes(n));
    const ring = el('circle', { class: `venn-ripple ${gains ? 'in' : 'out'}`, cx: at[id].x, cy: at[id].y, r: R }); ripples.append(ring);
    go.ripple(ring, () => ring.remove());
    go.pop(nodes[id].pop);
  }

  function token(id) {
    const face = el('text', { class: 'venn-face', 'font-size': (pictured(id) ? 1.2 : 1) * R }); face.textContent = show(id);
    const pop = el('g', { class: 'pop a' }, [el('g', { class: 'venn-lift' }, [el('circle', { class: 'venn-hit', r: R + 10 }), el('circle', { class: 'venn-disc', r: R }), face])]);
    const tag = el('text', { class: 'venn-tag', y: -R - 10 }), g = el('g', { class: 'venn-el', tabindex: 0, role: 'img', 'data-el': id }, [pop, tag]);
    // The element rises over the others before it takes the pointer, so the drag goes on past the edge of the box.
    drag(g, {
      point: e => svgPoint(svg, e), raise: () => top.append(g),
      start: p => { halt(id); grab = { id, dx: at[id].x - p.x, dy: at[id].y - p.y }; hold(id); },
      move: p => move(id, { x: p.x + grab.dx, y: p.y + grab.dy }),
      drop: () => { grab = null; rest(id); judge(); if (!g.matches(':hover')) hold(null); },
    });
    g.addEventListener('pointerenter', () => { if (!grab) hold(id); }); g.addEventListener('pointerleave', () => { if (!grab) hold(null); });
    // The arrow keys move a focused element, which comes to rest once the keys go quiet.
    const keys = nudge(g, { step: (dx, dy) => { halt(id); move(id, { x: at[id].x + dx * 14, y: at[id].y + dy * 14 }); }, rest: () => rest(id), idle: 900 });
    g.addEventListener('focus', () => hold(id)); g.addEventListener('blur', () => hold(null));
    return { g, pop, tag, keys };
  }

  // where the elements stand for the sets they are in, region by region
  function arrange() {
    const taken = cs.map(c => c.label), to = {};
    for (const e of spec.elements) {
      if (to[e]) continue;
      const mates = spec.elements.filter(o => same(o, e)), free = spots(cs, member[e], mates.length, taken);
      mates.forEach((o, i) => { to[o] = free[i]; }); taken.push(...free);
    }
    return to;
  }

  // the elements go back to where the page opened them
  function restart() { member = starts(spec); const to = arrange(); for (const e of spec.elements) glide(e, to[e]); refresh(); }

  // A challenge's panel opens with its goal and its conditions, each with a tick, in place of the readouts that would
  // give the answer away. A condition about one region shows that region in a small copy of the circles.
  function drawPanel() {
    const f = F(), c = spec.challenge, again = button({ label: T('reset'), act: 'reset', press: restart, cls: 'venn-again' });
    goal = c ? goalRow({ T, motion: moving() ? fx : null, actions: [again],
      another: c.targets.length > 1 ? () => { aim = (aim + 1) % c.targets.length; target(); lit = hover = null; solved = false; drawPanel(); restart(); shade(); } : null }) : null;
    goal?.say(T(`goal-${c.goal}`, { x: c.targets[aim].each }));
    wants = conds.map((x, i) => {
      const say = f.goal(spec, x.id, x.want), tick = h('i', { class: 'venn-tick' });
      return h('button', { type: 'button', class: `hesap-chip venn-want${x.zone ? ' venn-region' : ''}`, 'data-ref': x.id, 'aria-label': say }, x.zone ? [tick, mini(x.zone, i)] : [tick, h('span', {}, say)]);
    });
    // A readout or a condition the reader presses keeps its region shaded until it is pressed again.
    const toggle = id => { lit = lit === id ? null : id; shade(); };
    reads = spec.readout.map(id => chip({ id, label: M(id).label, cls: 'venn-read', press: toggle }));
    for (const w of wants) w.addEventListener('click', () => toggle(w.dataset.ref));
    for (const part of [...wants, ...reads.map(k => k.el)]) {
      part.addEventListener('pointerenter', () => { if (host.canHover.matches) { hover = part.dataset.ref; shade(); } });
      part.addEventListener('pointerleave', () => { hover = null; shade(); });
    }
    panel.replaceChildren(...[goal?.el, row('out', [...wants, ...reads, goal ? null : again])].filter(Boolean));
    for (const e of spec.elements) nodes[e].tag.textContent = T(e) ?? '';
  }

  const disc = c => ({ cx: c.x, cy: c.y, r: c.r }), frame = { ...BOX, rx: 14 };
  // One shape for each region: the box cut down to the circles the region lies in, less the circles it lies outside.
  // key keeps the ids of one drawing apart from another's.
  function regions(zs, key) {
    const defs = el('defs', {}, cs.map(c => el('clipPath', { id: `${key}-in-${c.name}` }, [el('circle', disc(c))])));
    return { defs, shapes: zs.map((zone, i) => {
      const out = cs.filter(c => !zone.includes(c.name)), rect = el('rect', { class: 'venn-zone', ...frame });
      if (out.length) {
        defs.append(el('mask', { id: `${key}-out-${i}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, ...VIEW }, [el('rect', { ...VIEW, fill: '#fff' }), ...out.map(c => el('circle', { ...disc(c), fill: '#000' }))]));
        rect.setAttribute('mask', `url(#${key}-out-${i})`);
      }
      return { zone, rect, shape: zone.reduce((kid, n) => el('g', { 'clip-path': `url(#${key}-in-${n})` }, [kid]), rect) };
    }) };
  }
  // a small copy of the circles with one region filled
  function mini(zone, i) {
    const { defs, shapes: [s] } = regions([zone], `venn-mini-${i}`), xs = cs.flatMap(c => [c.x - c.r, c.x + c.r]), ys = cs.flatMap(c => [c.y - c.r, c.y + c.r]);
    const x = Math.min(...xs) - 6, y = Math.min(...ys) - 6;
    return el('svg', { class: 'venn-mini', viewBox: `${x} ${y} ${Math.max(...xs) + 6 - x} ${Math.max(...ys) + 6 - y}`, 'aria-hidden': 'true' }, [defs, s.shape, ...cs.map(c => el('circle', { class: 'venn-edge', ...disc(c) }))]);
  }

  function draw() {
    glides = {}; grab = lit = hover = pointed = null;
    const { defs, shapes } = regions(Array.from({ length: 2 ** cs.length }, (_, bits) => names.filter((_, i) => bits >> i & 1)), 'venn');
    zones = shapes;
    const letter = (cls, say, p) => { const t = el('text', { class: cls, x: p.x, y: p.y }); t.textContent = say; return t; };
    rings = Object.fromEntries(cs.map(c => [c.name, el('circle', { class: 'venn-ring a', ...disc(c) })]));
    nodes = Object.fromEntries(spec.elements.map(e => [e, token(e)]));
    ripples = el('g'); top = el('g', {}, spec.elements.map(e => nodes[e].g));
    svg = el('svg', { class: 'venn-svg', viewBox: `0 0 ${VIEW.width} ${VIEW.height}` }, [defs, el('rect', { class: 'venn-box', ...frame }), ...zones.map(z => z.shape), letter('venn-name', 'U', { x: BOX.x + 20, y: BOX.y + 26 }),
      ...Object.values(rings), ...cs.map(c => letter('venn-name', c.name, c.label)), ripples, top]);
    stage.replaceChildren(svg); fx.adopt(svg);
    at = arrange(); for (const e of spec.elements) place(e);
    drawPanel(); refresh(); shade();
  }

  // the timers of the arrow keys stop with the page
  function stop() { for (const n of Object.values(nodes)) n.keys.cancel(); glides = {}; grab = null; }

  return {
    show(page) {
      stop();
      spec = page; names = Object.keys(spec.sets); cs = circles(names); R = radius(cs); member = starts(spec); aim = 0; solved = false;
      target(); draw();
    },
    hide() { stop(); spec = null; box.removeAttribute('data-solved'); stage.replaceChildren(); nodes = {}; },
    point(id, on) { if (!spec) return; pointed = on ? id : null; shade(); },
    lang() { if (spec) { drawPanel(); refresh(); shade(); } },
  };
}
