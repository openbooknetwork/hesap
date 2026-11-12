// The scenes a page can name, as machine/<scene>: what each one's controls are, what it computes, and the SVG it
// builds. A scene moves nothing itself. It tells the driver what happens in which order, and the driver animates it.
import RULES from './rules.js';
import { svg as el } from '../../kit/dom.js';

const text = (cls, say = '', attrs = {}) => { const t = el('text', { class: cls, ...attrs }); t.textContent = say; return t; };
export const VIEW = { width: 400, height: 580 };

// A token carries one value, which write puts in words. The class "a" marks what the driver animates. A run moves the
// token, and a reached goal pops its inner group, so the two never animate the same element.
function token(layer, kind, write) {
  const label = text(''), pop = el('g', { class: 'pop a' }, [el('circle', { class: 'halo', r: 32 }), el('circle', { class: 'disc', r: 22 }), label]);
  const g = el('g', { class: `tok a ${kind}` }, [pop]);
  layer.append(g);
  return { g, pop, say(v) { const words = write(v); label.textContent = words; label.setAttribute('font-size', words.length > 2 ? 15 : 20); } };
}
// An output token that reached the goal keeps a ring and pops.
const wins = tok => (v, on) => { tok.g.classList.toggle('win', on); return tok.pop; };

// A machine: a funnel on top, a chute below, a screen with its rule and two gears.
function machine(layer, name, at) {
  const rule = text('rule', '', { y: -3 }), gear = x => el('g', { class: 'gear', transform: `translate(${x}, 24)` }, [el('circle', { class: 'teeth', r: 12 }), el('circle', { class: 'hub', r: 4 })]);
  const face = el('g', { class: 'face a' }, [el('rect', { class: 'screen', x: -44, y: -26, width: 88, height: 46, rx: 6 }), rule]);
  const g = el('g', { class: 'mach a' }, [
    el('polygon', { class: 'funnel', points: '-52,-78 52,-78 28,-48 -28,-48' }), el('rect', { class: 'chute', x: -24, y: 46, width: 48, height: 18 }),
    el('rect', { class: 'pipe', x: -80, y: -62, width: 12, height: 16 }), el('rect', { class: 'shell', x: -92, y: -48, width: 184, height: 96, rx: 14 }),
    face, text('name', name, { y: 37 }), gear(-66), gear(66),
  ]);
  layer.append(g);
  return { g, face, at, show(label) { rule.textContent = label; }, mouth: () => ({ x: at.x, y: at.y - 78 }), exit: () => ({ x: at.x, y: at.y + 70 }) };
}

const hide = { opacity: 0, scale: 1 }, rest = m => ({ x: m.at.x, y: m.at.y, scale: 1, opacity: 1 });
// one value through one machine: in at the funnel, out at the chute
async function through(d, alive, m, { tin, from, tout, to, result, pace = 1 }) {
  await d.feed(tin.g, { from, mouth: m.mouth(), inside: m.at }, pace); if (!alive()) return false;
  tout.say(result);
  await d.emit(tout.g, { exit: m.exit(), to }, pace);
  return alive();
}

// ---------- one machine ----------
// lone builds the one machine of single and mystery. Its screen shows face(v).
function lone(layer, face, write) {
  const m = machine(layer, 'f', { x: 200, y: 290 }), tin = token(layer, 'in', write), tout = token(layer, 'out', write), from = { x: 200, y: 60 }, to = { x: 200, y: 510 };
  const out = v => RULES[v.rule].apply(v.x);
  return { m, tout,
    start(d, v) { m.show(face(v)); tin.say(v.x); d.place(m.g, rest(m)); d.place(tin.g, { ...from, scale: 1, opacity: 1 }); d.place(tout.g, { ...m.exit(), ...hide }); },
    end(d, v) { this.start(d, v); tout.say(out(v)); d.place(tin.g, { ...m.at, ...hide }); d.place(tout.g, { ...to, scale: 1, opacity: 1 }); },
    play: (d, v, alive) => through(d, alive, m, { tin, from, tout, to, result: out(v) }),
  };
}
const single = {
  controls: { x: 'slider', rule: 'rule' },
  measures: { out: v => RULES[v.rule].apply(v.x) },
  formulas: { out: (v, m) => [`f(${m.n(v.x)})`, `= ${m.rule(v.rule, m.n(v.x))}`, `= ${m.n(RULES[v.rule].apply(v.x))}`] },
  build(layer, spec, write) { const s = lone(layer, v => RULES[v.rule].label, write); s.solved = wins(s.tout); return s; },
};

// ---------- one machine with its rule hidden until the reader names it ----------
const mystery = {
  controls: { x: 'slider', guess: 'guess' },
  state: { rule: 'double' }, // a challenge hides its own rule here
  measures: { out: v => RULES[v.rule].apply(v.x) },
  formulas: {}, // a worked formula would show the rule
  build(layer, spec, write) {
    const s = lone(layer, v => v.guess === v.rule ? RULES[v.rule].label : '?', write);
    // The screen shows the rule once the reader names it, and pops.
    s.solved = (v, on) => { s.m.show(on ? RULES[v.rule].label : '?'); s.m.g.classList.toggle('win', on); return s.m.face; };
    return s;
  },
};

// ---------- two machines in a row, which the reader can swap ----------
const order = v => v.swapped ? ['g', 'f'] : ['f', 'g'];
const chained = v => { const [a, b] = order(v), mid = RULES[v[a]].apply(v.x); return { a, b, mid, out: RULES[v[b]].apply(mid) }; };
const chain = {
  controls: { x: 'slider', f: 'rule', g: 'rule' },
  state: { swapped: false },
  switches: { swap: 'swapped' }, // each action and the state it flips
  measures: { mid: v => chained(v).mid, out: v => chained(v).out },
  formulas: { out: (v, m) => { const { a, b, mid, out } = chained(v); return [`${b}(${a}(${m.n(v.x)}))`, `= ${b}(${m.n(mid)})`, `= ${m.rule(v[b], m.n(mid))}`, `= ${m.n(out)}`]; } },
  build(layer, spec, write) {
    const top = { x: 200, y: 160 }, low = { x: 200, y: 395 }, from = { x: 200, y: 34 }, between = { x: 200, y: 278 }, to = { x: 200, y: 525 };
    const M = { f: machine(layer, 'f', top), g: machine(layer, 'g', low) }, tin = token(layer, 'in', write), tmid = token(layer, 'in', write), tout = token(layer, 'out', write);
    const seat = v => { const [a, b] = order(v); M[a].at = top; M[b].at = low; return [M[a], M[b]]; };
    return {
      start(d, v) {
        const [first, second] = seat(v);
        for (const k of ['f', 'g']) { M[k].show(RULES[v[k]].label); d.place(M[k].g, rest(M[k])); }
        tin.say(v.x);
        d.place(tin.g, { ...from, scale: 1, opacity: 1 }); d.place(tmid.g, { ...first.exit(), ...hide }); d.place(tout.g, { ...second.exit(), ...hide });
      },
      end(d, v) { this.start(d, v); const c = chained(v); tout.say(c.out); d.place(tin.g, { ...top, ...hide }); d.place(tout.g, { ...to, scale: 1, opacity: 1 }); },
      solved: wins(tout),
      async play(d, v, alive) {
        const [first, second] = seat(v), c = chained(v);
        if (!await through(d, alive, first, { tin, from, tout: tmid, to: between, result: c.mid })) return false;
        return through(d, alive, second, { tin: tmid, from: between, tout, to, result: c.out });
      },
      actions: {
        // the machines trade places, then the value runs through them in the new order
        async swap(d, v) { const [first, second] = seat(v); if (await d.swap(first.g, second.g, top, low)) v.swapped = !v.swapped; },
      },
    };
  },
};

// ---------- one machine over a whole list ----------
const mapped = (v, items) => items.map(RULES[v.rule].apply);
const map = {
  controls: { rule: 'rule' },
  items: true, // the page lists the numbers it works through
  measures: { out: (v, spec) => mapped(v, spec.items) },
  formulas: {},
  build(layer, spec, write) {
    const xs = spec.items.map((_, i) => 200 + (i - (spec.items.length - 1) / 2) * 76), m = machine(layer, 'f', { x: 200, y: 290 });
    const ins = spec.items.map(() => token(layer, 'in', write)), outs = spec.items.map(() => token(layer, 'out', write));
    return {
      start(d, v) { m.show(RULES[v.rule].label); d.place(m.g, rest(m));
        spec.items.forEach((n, i) => { ins[i].say(n); d.place(ins[i].g, { x: xs[i], y: 56, scale: 1, opacity: 1 }); d.place(outs[i].g, { ...m.exit(), ...hide }); }); },
      end(d, v) { this.start(d, v); mapped(v, spec.items).forEach((n, i) => { outs[i].say(n); d.place(ins[i].g, { ...m.at, ...hide }); d.place(outs[i].g, { x: xs[i], y: 520, scale: 1, opacity: 1 }); }); },
      async play(d, v, alive) {
        const results = mapped(v, spec.items);
        for (let i = 0; i < results.length; i++) if (!await through(d, alive, m, { tin: ins[i], from: { x: xs[i], y: 56 }, tout: outs[i], to: { x: xs[i], y: 520 }, result: results[i], pace: 1.8 })) return false;
        return true;
      },
    };
  },
};

// ---------- a machine that makes machines ----------
const maker = {
  controls: { n: 'slider', x: 'slider' },
  measures: { out: v => v.x + v.n },
  formulas: { out: (v, m) => [`h(${m.n(v.x)})`, `= ${m.n(v.x)} + ${m.n(v.n)}`, `= ${m.n(v.x + v.n)}`] },
  build(layer, spec, write) {
    const make = machine(layer, 'make', { x: 200, y: 150 }), h = machine(layer, 'h', { x: 200, y: 400 });
    const tn = token(layer, 'in', write), tx = token(layer, 'in', write), tout = token(layer, 'out', write), fromN = { x: 200, y: 28 }, fromX = { x: 336, y: 300 }, to = { x: 200, y: 530 };
    // A change of x alone runs x through the h that make has built already.
    return {
      start(d, v, changed) {
        const built = changed === 'x';
        make.show('+ n'); h.show(`+ ${write(v.n)}`); tn.say(v.n); tx.say(v.x); d.place(make.g, rest(make)); d.place(tout.g, { ...h.exit(), ...hide });
        d.place(h.g, built ? rest(h) : { ...make.exit(), scale: 0.15, opacity: 0 }); d.place(tn.g, built ? { ...make.at, ...hide } : { ...fromN, scale: 1, opacity: 1 });
        d.place(tx.g, { ...fromX, scale: 1, opacity: built ? 1 : 0 });
      },
      end(d, v) { this.start(d, v, 'x'); tout.say(v.x + v.n); d.place(tx.g, { ...h.at, ...hide }); d.place(tout.g, { ...to, scale: 1, opacity: 1 }); },
      solved: wins(tout),
      async play(d, v, alive, changed) {
        if (changed !== 'x') {
          await d.feed(tn.g, { from: fromN, mouth: make.mouth(), inside: make.at }); if (!alive()) return false;
          await d.assemble(h.g, { from: make.exit(), to: h.at }); if (!alive()) return false;
          d.place(tx.g, { ...fromX, scale: 1, opacity: 1 });
        }
        return through(d, alive, h, { tin: tx, from: fromX, tout, to, result: v.x + v.n });
      },
    };
  },
};

export default { single, mystery, chain, map, maker };
