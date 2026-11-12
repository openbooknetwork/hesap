// The browser half of the grid family. It draws a board of numbered cells the reader taps or walks with the arrow
// keys, adds a side drawing for the scenes that have one, and keeps the values in the text in step.
import SCENES from './scenes.js';
import GOALS from './goals.js';
import { formatter, starts } from './format.js';
import { plan, pitch, split, shelf } from './layout.js';
import { span, pairs, mod } from './numbers.js';
import makeDriver from './driver.js';
import { svg as el, h } from '../../kit/dom.js';
import { slider, chip, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';

export default function grid({ host, stage, panel, T, lang, moving, motion: fx }) {
  const text = (cls, say, attrs) => { const t = el('text', { class: cls, ...attrs }); t.textContent = say; return t; };
  const room = h('div', { class: 'grid-stage' }), scroll = h('div', { class: 'grid-scroll' }), board = h('div', { class: 'grid-board' }), aside = h('div', { class: 'grid-aside' });
  scroll.append(board); room.append(scroll, aside); stage.append(room);
  const driver = makeDriver(fx);
  // look holds the classes each cell shows, goal the classes a wave is taking it to, at its place in pixels. tapped is
  // the control a tap sets. run counts the updates, so a stale one knows to stop.
  let spec = null, scene = null, values = {}, nums = [], cells = {}, look = {}, goal = {}, at = {}, layout = null, spots = new Map(), tapped = null;
  let run = 0, pointed = null, hover = null, hot = [];
  // A challenge page keeps its goal, the target it is on (tix in the page's list), whether Hint is on and whether it
  // is solved. line is the challenge's row in the panel.
  let aim = null, target = null, tix = 0, hinted = false, solved = false, line = null, sliders = {}, chips = [];

  const F = () => formatter(lang());
  const label = id => T(`${spec.scene}_${id}`) ?? T(id) ?? id; // A scene may name a control its own way.
  let size = '';
  new ResizeObserver(([e]) => { const now = `${e.contentRect.width}x${e.contentRect.height}`; if (spec && now !== size) { size = now; arrange(false); } }).observe(room);

  // ---------- The board ----------
  function build() {
    tapped = Object.keys(scene.controls).find(id => scene.controls[id] !== 'slider') ?? null;
    nums = span(spec.numbers); cells = {}; look = {}; goal = {}; at = {}; hot = [];
    board.replaceChildren(...nums.map(n => {
      const node = document.createElement(tapped ? 'button' : 'div'), face = document.createElement('span');
      node.className = 'grid-cell'; node.dataset.n = n; node.dataset.d = String(n).length; face.className = 'grid-face'; face.textContent = n;
      if (tapped) { node.type = 'button'; node.tabIndex = -1; node.addEventListener('click', () => tap(n)); }
      node.append(face); cells[n] = { node, face }; look[n] = goal[n] = '';
      return node;
    }));
  }
  const setLook = (n, cls) => { look[n] = cls; cells[n].node.className = cls ? `grid-cell ${cls}` : 'grid-cell'; };
  const faces = ns => ns.map(n => cells[n].face);
  // A wave that is cut short lands at once.
  function land() { driver.halt(); for (const n of nums) if (look[n] !== goal[n]) setLook(n, goal[n]); }

  // This paints the cells for the current values. Most changes show at once. When the scene gives a wave, the cells
  // it visits take their new look batch by batch as it reaches them. It resolves true once the cells show it all.
  // A challenge adds its own classes, such as the stretch it is about and what Hint shows.
  function aimLooks() {
    const paint = scene.paint(values, spec), extra = aim?.paint(values, spec, target, hinted);
    for (const n of nums) goal[n] = extra ? [paint(n), extra(n)].filter(Boolean).join(' ') : paint(n);
  }
  function update(change, was) {
    run++; land(); aimLooks();
    const w = moving() && scene.wave?.(values, spec, change, was), steps = [];
    if (w) for (const n of nums) {
      const changes = look[n] !== goal[n];
      const i = !layout.at(n) ? (changes ? 0 : null) : w.order(n) ?? (changes ? 0 : null); // A cell off the board hides at once.
      if (i != null) (steps[i] ??= []).push(n);
    }
    if (!steps.length) { land(); return Promise.resolve(true); }
    const pace = Math.max(14, Math.min(70, 800 / steps.length));
    return driver.wave(steps.length, pace, i => {
      const pop = [], grow = [];
      for (const n of steps[i] ?? []) {
        if (!goal[n].includes('gone')) (look[n].includes('gone') ? grow : pop).push(cells[n].face);
        setLook(n, goal[n]);
      }
      return { pop, grow };
    });
  }

  // This fits the board to the stage, with the scene's side drawing beside it or under it, and moves every cell to
  // its place. Cells glide when the reader changed the layout, and jump when the screen did.
  function arrange(glide) {
    layout = plan(scene, spec, values);
    const cs = getComputedStyle(room), gap = parseFloat(cs.columnGap) || 0;
    const w = room.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ht = room.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w <= 0 || ht <= 0) return;
    const side = !!scene.aside, { cols, rows } = layout;
    const fit = side ? split(cols, rows, w - gap, ht - gap) : { dir: 'column', pitch: pitch(cols, rows, w, ht) }, p = fit.pitch;
    room.dataset.dir = fit.dir; aside.hidden = !side;
    scroll.style.flex = !side ? '' : `0 0 ${fit.dir === 'row' ? Math.min(cols * p, (w - gap) * 0.58) : Math.min(rows * p, (ht - gap) * 0.6)}px`;
    board.style.setProperty('--cell', `${p}px`); board.style.width = `${cols * p}px`; board.style.height = `${rows * p}px`;
    board.classList.toggle('tiny', p < 24);
    if (!glide) driver.still();
    const still = [], moved = [];
    spots = new Map();
    for (const n of nums) {
      const c = layout.at(n);
      if (!c) continue;
      const to = [c[0] * p, c[1] * p], from = at[n];
      at[n] = to; spots.set(c.join(), n);
      if (!glide || !from || !moving() || look[n].includes('gone')) still.push(cells[n].node);
      else if (from[0] !== to[0] || from[1] !== to[1]) moved.push(cells[n].node);
    }
    const xy = node => at[node.dataset.n];
    if (still.length) driver.place(still, xy);
    if (moved.length) driver.glide(moved, xy);
    if (side) drawAside();
  }

  // The arrow keys walk the focus over the board, cell by cell as the board lays them out.
  board.addEventListener('keydown', e => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key], n = Number(e.target.closest?.('.grid-cell')?.dataset.n);
    if (!step || !tapped || !layout.at(n)) return;
    e.preventDefault(); e.stopPropagation();
    const [c, r] = layout.at(n), next = spots.get([c + step[0], r + step[1]].join());
    if (next != null && !look[next].includes('gone')) { roam(next); cells[next].node.focus(); }
  });
  // One cell takes the Tab key. It is the one the reader chose, else the first.
  function roam(n) { for (const m of nums) cells[m].node.tabIndex = m === n ? 0 : -1; }

  // ---------- What the reader does ----------
  function changed(id, was, relaid) {
    if (scene.settle) values = scene.settle(values);
    if (relaid) arrange(true);
    const done = update(id, was);
    judge(done); refresh(); if (scene.aside) drawAside(id);
    return done;
  }
  // The challenge's line says whether the board reaches the goal. When it first does, the line and the cells that
  // reach it swell once, the cells after the wave that brought them.
  function judge(done) {
    if (!aim) return;
    solved = aim.holds(values, spec, target);
    const first = line.show(solved);
    if (first && moving()) {
      const mine = run;
      done.then(ok => { if (ok && mine === run) driver.pulse(faces(aim.shows(values, spec, target).filter(n => cells[n] && layout.at(n)))); });
    }
  }
  // Another one moves to the next target the board does not reach yet, and clears what the goal starts afresh.
  function another() {
    const { targets } = spec.challenge, fresh = starts(spec), was = values;
    const make = i => ({ ...values, ...Object.fromEntries((aim.fresh ?? []).map(id => [id, fresh[id]])), ...aim.sets?.(targets[i]) });
    let next = (tix + 1) % targets.length;
    for (let k = 1; k <= targets.length; k++) { const i = (tix + k) % targets.length; if (!aim.holds(make(i), spec, targets[i])) { next = i; break; } }
    tix = next; target = targets[tix]; hinted = false; values = make(tix);
    line.reset();
    changed('target', was, false);
  }
  function tap(n) {
    const kind = scene.controls[tapped], was = values, now = values[tapped];
    if (kind === 'tap' && now === n) return;
    values = { ...values, [tapped]: kind === 'many' ? (now.includes(n) ? now.filter(m => m !== n) : [...now, n]) : kind === 'pick' && now === n ? null : n };
    changed(tapped, was, false);
  }
  function slide(id, value) {
    if (values[id] === value) return;
    const was = values; values = { ...values, [id]: value };
    changed(id, was, id === 'columns' || !!scene.layout);
  }

  // ---------- The side drawings ----------
  function drawAside(change) {
    const w = aside.clientWidth, ht = aside.clientHeight;
    if (!w || !ht || aside.hidden) return;
    if (scene.aside === 'rectangles') rectangles(w, ht);
    if (scene.aside === 'clock') clock(w, ht, !!change && change !== 'columns');
  }

  // This draws the rectangles of dots the number makes, one for each pair of factors, under a heading.
  function rectangles(w, ht) {
    const n = values.n, all = pairs(n), top = 30, { s, boxes, height } = shelf(all, w - 8, ht - top - 8, { w: 56, h: 22 }), y = Math.max(0, (ht - top - height) / 2 - 8);
    const r = Math.max(1.4, s * 0.34);
    const groups = all.map(([a, b], i) => {
      const box = boxes[i], x0 = box.x + (box.w - b * s) / 2, y0 = box.y + 22, dots = [];
      for (let yy = 0; yy < a; yy++) for (let x = 0; x < b; x++) dots.push(el('circle', { cx: x0 + (x + 0.5) * s, cy: y0 + (yy + 0.5) * s, r }));
      return el('g', { class: 'shape' }, [text('say', `${a} × ${b}`, { x: box.x + box.w / 2, y: box.y + 14 }), ...dots]);
    });
    const head = text('head', T('dots', { n: F().fmt(n) }), { x: w / 2, y: y + 18 });
    aside.replaceChildren(el('svg', { viewBox: `0 0 ${w} ${ht}` }, [head, el('g', { transform: `translate(4 ${y + top})` }, groups)]));
  }

  // The clock has n places, 0 at the top, each in its remainder's colour. Its hand counts x steps round from 0. It
  // makes a whole turn for each n in x and then moves on by the remainder. The count plays when the reader changes x or n.
  function clock(w, ht, spin) {
    const n = values.n, x = values.x, r = mod(x, n), cx = w / 2, cy = ht / 2, R = Math.min(w, ht) / 2 - 8;
    const dot = Math.min(22, R * 0.26, R * Math.sin(Math.PI / n) * 0.8), ring = R - dot;
    const place = k => { const t = 2 * Math.PI * k / n - Math.PI / 2; return { x: cx + ring * Math.cos(t), y: cy + ring * Math.sin(t) }; };
    const marks = span([0, n - 1]).map(k => {
      const p = place(k);
      return el('g', { class: `mark a grid-c${k + 1}${k === r ? ' on' : ''}` }, [el('circle', { cx: p.x, cy: p.y, r: dot }), text('num', F().fmt(k), { x: p.x, y: p.y, 'font-size': dot * 0.95 })]);
    });
    const hand = el('g', { class: 'hand' }, [el('line', { x1: cx, y1: cy, x2: cx, y2: cy - ring + dot + 4 }), el('circle', { cx, cy: cy - ring + dot + 4, r: 4 })]);
    hand.style.transformBox = 'view-box'; hand.style.transformOrigin = `${cx}px ${cy}px`; hand.style.transform = `rotate(${360 * r / n}deg)`;
    const hub = el('g', { class: 'hub' }, [el('circle', { cx, cy, r: Math.max(16, ring * 0.3) }), text('num', F().fmt(x), { x: cx, y: cy, 'font-size': Math.max(14, ring * 0.24) })]);
    const svg = el('svg', { viewBox: `0 0 ${w} ${ht}` }, [el('circle', { class: 'dial', cx, cy, r: ring }), hand, ...marks, hub]);
    aside.replaceChildren(svg); driver.adopt(svg);
    if (spin && moving()) driver.spin(hand, x / n, () => driver.pop(marks[r]));
  }

  // ---------- The controls and the values ----------
  function drawPanel() {
    const f = F(), list = Object.entries(spec.controls).filter(([, c]) => c.slider);
    if (spec.columns?.slider) list.push(['columns', spec.columns]);
    // A challenge's line comes first. Hint marks the board and has no words of its own.
    line = aim ? goalRow({ T, motion: moving() ? fx : null, hint: on => { hinted = on; update('hint', values); return null; },
      another: spec.challenge.targets.length > 1 ? another : null }) : null;
    sliders = Object.fromEntries(list.map(([id, c]) => [id, slider({ id, label: label(id), min: c.slider[0], max: c.slider[1], step: c.step, value: values[id],
      write: v => f.say(v), input: v => slide(id, v) })]));
    chips = spec.readout.map(id => chip({ id, label: label(id) }));
    for (const k of chips) {
      k.el.addEventListener('pointerenter', () => { if (host.canHover.matches) { hover = k.id; shade(); } });
      k.el.addEventListener('pointerleave', () => { hover = null; shade(); });
    }
    panel.replaceChildren(...[line?.el, list.length ? row('ctls', Object.values(sliders)) : null, chips.length ? row('out', chips) : null].filter(Boolean));
  }

  // The readouts, the slider values and the linked values in the text all follow the board.
  function refresh() {
    const f = F(), now = id => f.value(scene, spec, values, id);
    for (const k of chips) k.set(now(k.id));
    for (const [id, s] of Object.entries(sliders)) if (s.get() !== values[id]) s.set(values[id]);
    if (line) { const [a, b] = aim.says(target).map(f.fmt); line.say(T(`goal-${spec.challenge.goal}`, { a, b })); line.show(solved); }
    live(host, { value: now, formula: id => scene.formulas[id] ? f.worked(scene, spec, values, id) : null });
    if (tapped) roam([values[tapped]].flat().at(-1) ?? nums.find(n => layout?.at(n)));
    shade();
  }

  // The cells a measure counts stand out while the reader points at its readout or at its link in the text.
  function shade() {
    for (const face of hot) face.classList.remove('grid-hot');
    const id = hover ?? pointed, marks = id && (scene.marks?.[id]?.(values, spec) ?? (id in spec.controls && values[id] != null ? [values[id]] : []));
    hot = faces((marks || []).filter(n => cells[n]));
    for (const face of hot) face.classList.add('grid-hot');
    for (const node of panel.querySelectorAll('[data-ref]')) node.classList.toggle('hot', node.dataset.ref === pointed);
  }

  return {
    show(page) {
      ++run; driver.stop();
      spec = page; scene = SCENES[spec.scene]; values = starts(spec);
      aim = spec.challenge ? GOALS[spec.challenge.goal] : null; tix = 0; target = spec.challenge?.targets[0]; hinted = false;
      solved = !!aim?.holds(values, spec, target);
      pointed = hover = null;
      // The new cells take their colours before anything reads their style, so the page opens with no colour fading in.
      build(); layout = plan(scene, spec, values); aimLooks();
      for (const n of nums) setLook(n, goal[n]);
      drawPanel();
      arrange(false); refresh();
      if (scene.aside) drawAside();
    },
    hide() { ++run; driver.stop(); spec = null; board.replaceChildren(); aside.replaceChildren(); },
    point(id, on) { if (!spec) return; pointed = on ? id : null; shade(); },
    // A new panel starts with Hint closed, so the board drops its hint too.
    lang() { if (!spec) return; drawPanel(); if (hinted) { hinted = false; update('hint', values); } refresh(); if (scene.aside) drawAside(); },
  };
}
