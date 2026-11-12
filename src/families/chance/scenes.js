// What each scene draws in the stage's own pixels from the counts so far. sync draws the counts the slider asks for,
// more or fewer than before, and tick eases the values that glide.
import { label, clamp, ease, nice, stepOf, barChart, dieFace, fitDots, dotAt } from './charts.js';
import { svg as el } from '../../kit/dom.js';
import { range, choose, ways2, DIE_SPREAD } from './models.js';

const sum = o => o.reduce((a, b) => a + b, 0);
// The reader picks k by pointing at this element or tapping it.
function pickable(node, k, pick) {
  node.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') pick(k, true); });
  node.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pick(null, true); });
  node.addEventListener('click', () => pick(k, false));
}
const hotOn = (nodes, on) => { for (const n of nodes) n?.classList.toggle('hot', on); };

// A coin shows how the last flip landed, and a tally counts its faces in groups of four strokes with a fifth across
// them.
function coin({ w, h, spec, st, T, f }) {
  const g = el('g'), wide = w > h * 1.1 && w >= 560; // A phone stacks its parts even when the stage is short.
  const A = wide ? { x: 0, y: 0, w: w * 0.42, h } : { x: 0, y: 0, w, h: h * 0.46 };
  const B = wide ? { x: w * 0.42, y: 0, w: w * 0.58, h } : { x: 0, y: h * 0.46, w, h: h * 0.54 };
  const r = clamp(Math.min(A.w, A.h) * 0.2, 28, 84), cx = A.x + A.w / 2, cy = wide ? A.y + A.h * 0.5 : A.y + A.h - r - 22;
  const side = el('circle', { class: 'face', r }), letter = label({ class: 'letter', size: r * 0.9 }, '');
  const body = el('g', { class: 'coin', transform: `translate(${cx} ${cy})` }, [side, el('circle', { class: 'ring', r: r * 0.8 }), letter]);
  g.append(el('ellipse', { class: 'shadow', cx, cy: cy + r + 12, rx: r * 0.85, ry: r * 0.14 }), body);
  const show = face => { side.setAttribute('class', `face ${face}`); letter.textContent = T(`face-${face}`); };

  // Each face has a row of tally marks in lines that wrap, drawn as small as it takes to hold most of a run.
  const pad = 16, cap = Math.ceil(spec.trials * 0.62), rows = {};
  let s = 1, per = 1, lineH = 32, gw = 38;
  for (s = 1; s > 0.4; s -= 0.05) {
    gw = 38 * s; lineH = 32 * s; per = Math.max(1, Math.floor((B.w - 2 * pad) / gw));
    if (2 * (36 + Math.ceil(Math.ceil(cap / 5) / per) * lineH) + 12 <= B.h - 24) break;
  }
  const rowH = 36 + Math.ceil(Math.ceil(cap / 5) / per) * lineH, y0 = B.y + Math.max(12, (B.h - 2 * rowH - 12) / 2);
  ['heads', 'tails'].forEach((face, i) => {
    const y = y0 + i * (rowH + 12), marks = el('g');
    const chip = el('g', {}, [el('circle', { class: `face ${face}`, r: 12 }), label({ class: 'letter', size: 13 }, T(`face-${face}`))]);
    const head = el('g', { class: 'row-head' }, [el('g', { transform: `translate(${B.x + pad + 12} ${y + 14})` }, [chip]),
      label({ class: 'row-name', x: B.x + pad + 32, y: y + 14 }, T(face))]);
    const num = label({ class: 'row-count', x: B.x + B.w - pad, y: y + 14 }, '');
    g.append(head, num, marks);
    rows[face] = { y, marks, head, num };
  });
  function addMark(face) {
    const row = rows[face], i = row.marks.childElementCount;
    const grp = Math.floor(i / 5), j = i % 5, x = B.x + pad + (grp % per) * gw + 5 * s, top = row.y + 34 + Math.floor(grp / per) * lineH, bot = top + 22 * s, mg = 6.5 * s;
    // Four strokes stand, and the fifth crosses them.
    const [x1, y1, x2, y2] = j < 4 ? [x + j * mg, top, x + j * mg + (j % 2 ? 1 : -1) * s, bot] : [x - 4 * s, bot - 3 * s, x + 3 * mg + 4 * s, top + 3 * s];
    row.marks.append(el('line', { class: `mark ${face}`, x1, y1, x2, y2 }));
  }
  function sync(now) {
    for (const face of ['heads', 'tails']) {
      const row = rows[face], want = Math.min(now[face], cap);
      while (row.marks.childElementCount > want) row.marks.lastChild.remove();
      while (row.marks.childElementCount < want) addMark(face);
      row.num.textContent = f.int(now[face]);
    }
    show(now.last ?? 'heads');
  }
  sync(st);
  return {
    g, sync, tick: () => false, pick() {},
    hot(id, on) { hotOn(id === 'heads' || id === 'tails' ? [rows[id].head, rows[id].num] : id === 'flips' ? [body] : [], on); },
  };
}

// A line shows the share of heads after each flip and settles toward one half. The funnel around one half holds
// the share in about 19 runs out of 20. A page with several runs draws a line for each.
function flips({ w, h, spec, st, T, f }) {
  const g = el('g'), px = 46, pw = w - px - 52, py = 40, ph = h - py - 48, base = py + ph, Y = v => base - v * ph;
  const axisTo = n => nice(Math.max(10, n)), many = (st.others?.length ?? 0) > 0;
  let X$ = axisTo(st.n), Xnow = X$, dirty = true;
  const X = k => px + k / Xnow * pw;
  const grid = el('g', { class: 'grid' }), xs = el('g', { class: 'grid' });
  for (const v of [0, 0.25, 0.5, 0.75, 1]) grid.append(el('line', { x1: px, x2: px + pw, y1: Y(v), y2: Y(v) }), label({ class: 'tickv', x: px - 6, y: Y(v) }, f.fmt(v, 2)));
  const half = el('line', { class: 'half', x1: px, x2: px + pw, y1: Y(0.5), y2: Y(0.5) });
  const funnel = el('path', { class: 'funnel' }), tip = label({ class: 'end-label' }, '');
  const lines = [st, ...(st.others ?? [])].map(() => ({ line: el('path', { class: many ? 'share many' : 'share' }), dot: el('circle', { class: 'end', r: many ? 3.5 : 5 }) }));
  const head = el('g', {}, [label({ class: 'axis-title', x: px - 6, y: 18, 'text-anchor': 'start' }, T('axis-share-heads')), label({ class: 'axis-title', x: px + pw, y: h - 10, 'text-anchor': 'end' }, T('axis-flips'))]);
  // The challenge's band reaches band either side of one half, over the second half of the flips so far.
  const band = spec.challenge ? el('rect', { class: 'band' }) : null;
  const miss = el('circle', { class: 'miss', r: 7 });
  miss.style.display = 'none';
  g.append(funnel, grid, ...(band ? [band] : []), half, xs, el('line', { class: 'axis', x1: px, x2: px + pw, y1: base, y2: base }),
    ...lines.map(l => l.line), ...lines.map(l => l.dot), tip, head, miss);
  let now = st, missAt = null;
  function draw() {
    xs.replaceChildren();
    const step = stepOf(X$), n = now.n;
    for (let k = step; k <= Xnow * 1.001; k += step) xs.append(label({ class: 'tickh', x: X(k), y: base + 16 }, f.int(k)));
    // The funnel spans one half, give or take one over the square root of the flips.
    const up = [], down = [];
    for (let j = 0; j <= 90; j++) { const k = Math.max(1, Xnow * j / 90), d = 1 / Math.sqrt(k); up.push(`${X(k).toFixed(1)},${Y(Math.min(1, 0.5 + d)).toFixed(1)}`); down.unshift(`${X(k).toFixed(1)},${Y(Math.max(0, 0.5 - d)).toFixed(1)}`); }
    funnel.setAttribute('d', `M${up.join('L')}L${down.join('L')}Z`);
    const every = Math.max(1, Math.floor(n / (pw * 1.5)));
    [now, ...(now.others ?? [])].forEach(({ path }, i) => {
      const pts = [], { line, dot } = lines[i];
      for (let k = 1; k <= n; k += every) pts.push(`${X(k).toFixed(1)},${Y(path[k - 1] / k).toFixed(1)}`);
      if (n && (n - 1) % every) pts.push(`${X(n).toFixed(1)},${Y(path[n - 1] / n).toFixed(1)}`);
      line.setAttribute('d', pts.length ? `M${pts.join('L')}` : '');
      dot.style.display = n ? '' : 'none';
      if (n) { dot.setAttribute('cx', X(n)); dot.setAttribute('cy', Y(path[n - 1] / n)); }
    });
    tip.style.display = n && !many ? '' : 'none';
    if (n && !many) {
      const x = X(n), y = Y(now.path[n - 1] / n);
      tip.setAttribute('x', x + 9); tip.setAttribute('y', clamp(y, py + 8, base - 8)); tip.textContent = f.fix(now.path[n - 1] / n, 3);
    }
    if (band) {
      const a = X(Math.ceil(n / 2)), b = spec.challenge.band;
      band.style.display = n ? '' : 'none';
      Object.entries({ x: a, width: Math.max(0, X(n) - a), y: Y(0.5 + b), height: Y(0.5 - b) - Y(0.5 + b) }).forEach(([k, v]) => band.setAttribute(k, v));
    }
    miss.style.display = missAt ? '' : 'none';
    if (missAt) { const [i, k] = missAt, p = (i ? now.others[i - 1] : now).path; miss.setAttribute('cx', X(k)); miss.setAttribute('cy', Y(p[k - 1] / k)); }
  }
  return {
    g, sync: s => { now = s; X$ = axisTo(s.n); dirty = true; },
    tick(dt) { const was = Xnow; Xnow = ease(Xnow, X$, dt, 160); const moving = Xnow !== X$; if (moving || was !== Xnow || dirty) draw(); dirty = false; return moving; },
    pick() {},
    hot(id, on) { hotOn(id === 'p-heads' ? [half] : id.startsWith('share') ? lines.flatMap(l => [l.line, l.dot]) : [], on); },
    // The band lights up when every run stays inside it, and a ring marks where a run left it.
    goal(r) {
      band?.classList.toggle('solved', r.done);
      missAt = r.miss ?? null; draw();
      return band ? [band] : [];
    },
  };
}

// A die shows the face of the last roll.
function restingDie(size, at) {
  const face = dieFace(size), body = el('g', { transform: `translate(${at.x} ${at.y})` }, [face]);
  const shadow = el('ellipse', { class: 'shadow', cx: at.x, cy: at.y + size * 0.62, rx: size * 0.48, ry: size * 0.09 });
  return { nodes: [shadow, body], body, show: n => face.show(n) };
}

// One die shows the last roll, and a bar for each face grows as its rolls come in, beside the count each face can
// expect.
function die({ w, h, st, T, f }) {
  const g = el('g'), wide = w > h * 1.1 && w >= 560; // A phone stacks its parts even when the stage is short.
  const A = wide ? { x: 0, y: 0, w: w * 0.34, h } : { x: 0, y: 0, w, h: h * 0.32 };
  const C = wide ? { x: w * 0.34, y: 20, w: w * 0.66 - 12, h: h - 36 } : { x: 6, y: h * 0.32, w: w - 12, h: h * 0.68 - 6 };
  const s = clamp(Math.min(A.w, A.h) * 0.42, 44, 110), at = { x: A.x + A.w / 2, y: wide ? A.y + A.h * 0.5 : A.y + A.h - s / 2 - 18 };
  const one = restingDie(s, at), keys = {};
  const chart = barChart(C, {
    keys: range(1, 6), marker: 'line', fmt: f.int, legend: [['bar', T('legend-rolls')], ['line', T('legend-expected')]],
    keyLabel: (k, x, y) => { const d = dieFace(18, 'die key'); d.show(k); keys[k] = el('g', {}, [d]); return el('g', { transform: `translate(${x} ${y})` }, [keys[k]]); },
  });
  g.append(...one.nodes, chart.g);
  const sync = (now, snap) => { one.show(now.last ?? 5); chart.set(range(1, 6).map(k => now.counts[k]), [now.n / 6], snap); };
  sync(st, true);
  return {
    g, sync, tick: dt => chart.tick(dt),
    pick() {},
    hot(id, on) {
      const k = Number(id.split('-')[1]);
      hotOn(id === 'expected' || id === 'p-face' ? [chart.g.querySelector('.expect')] : id === 'rolls' ? [one.body] : chart.bars[k] ? [chart.bars[k].g] : [], on);
    },
  };
}

// Two dice show the last roll. A grid shows the 36 ways they can land and lights the cells of the picked sum, and a
// bar counts each sum.
function dice({ w, h, corner, st, T, f, pick }) {
  const g = el('g'), wide = w > h * 1.1 && w >= 560; // A phone stacks its parts even when the stage is short.
  let D, G, C;
  if (wide) { D = { x: 0, y: 0, w: w * 0.44, h: h * 0.28 }; G = { x: 0, y: h * 0.28, w: w * 0.44, h: h * 0.72 }; C = { x: w * 0.44 + 8, y: 20, w: w * 0.56 - 20, h: h - 36 }; }
  else { const top = h * 0.46; D = { x: 0, y: 0, w: w * 0.36, h: top }; G = { x: w * 0.36, y: 0, w: w * 0.64 - corner, h: top }; C = { x: 6, y: top, w: w - 12, h: h - top - 4 }; }
  const ds = clamp(Math.min(D.w / 2.7, D.h * 0.36), 24, 64), mid = { x: D.x + D.w / 2, y: D.y + D.h * 0.44 };
  const two = [restingDie(ds, { x: mid.x - ds * 0.62, y: mid.y }), restingDie(ds, { x: mid.x + ds * 0.62, y: mid.y })];
  const total = label({ class: 'total', x: mid.x, y: mid.y + ds * 0.62 + 22 }, '');
  g.append(...two.flatMap(d => d.nodes), total);

  // The grid runs the first die down the side and the second along the top, and each cell holds the sum of the two.
  const size = Math.min(G.w, G.h) - 12, cell = size / 7, gx = G.x + (G.w - size) / 2, gy = G.y + (G.h - size) / 2, cells = [];
  const grid = el('g', { class: 'outcomes' });
  grid.append(label({ class: 'plus', x: gx + cell / 2, y: gy + cell / 2 }, '+'));
  for (let i = 1; i <= 6; i++) for (const [x, y] of [[gx + (i + 0.5) * cell, gy + cell / 2], [gx + cell / 2, gy + (i + 0.5) * cell]]) {
    const d = dieFace(cell * 0.6, 'die key'); d.show(i); grid.append(el('g', { transform: `translate(${x} ${y})` }, [d]));
  }
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
    const box = el('rect', { class: 'box', x: gx + b * cell + 1, y: gy + a * cell + 1, width: cell - 2, height: cell - 2, rx: 3 });
    const one = el('g', { class: 'cell', 'data-sum': a + b }, [box, label({ class: 'sum', x: gx + (b + 0.5) * cell, y: gy + (a + 0.5) * cell, size: clamp(cell * 0.42, 9, 15) }, f.int(a + b))]);
    pickable(one, a + b, pick); grid.append(one); cells.push({ a, b, one });
  }
  g.append(grid);
  const chart = barChart(C, {
    keys: range(2, 12), marker: 'ticks', fmt: f.int, legend: [['bar', T('legend-rolls')], ['line', T('legend-expected')]],
    keyLabel: (k, x, y) => label({ class: 'key', x, y }, f.int(k)), onKey: (node, k) => pickable(node, k, pick),
  });
  g.append(chart.g);
  function rest(o) {
    two[0].show(o?.[0] ?? 3); two[1].show(o?.[1] ?? 4);
    total.textContent = o ? `${f.int(o[0])} + ${f.int(o[1])} = ${f.int(o[0] + o[1])}` : '';
    for (const c of cells) c.one.classList.toggle('last', !!o && c.a === o[0] && c.b === o[1]);
  }
  function lit(k) {
    for (const c of cells) c.one.classList.toggle('on', c.a + c.b === k);
    for (const [key, b] of Object.entries(chart.bars)) b.g.classList.toggle('on', Number(key) === k);
  }
  const sync = (now, snap) => { st = now; rest(now.last); chart.set(range(2, 12).map(k => now.counts[k]), range(2, 12).map(k => now.n * ways2(k) / 36), snap); };
  lit(st.pick); sync(st, true);
  // A measure's id names a sum or the picked one, as in ways-7, count-pick and pick.
  const parts = id => { const [what, k] = id.split('-'), n = id === 'pick' || k === 'pick' ? st.pick : Number(k); return { what, n }; };
  return {
    g, sync, tick: dt => chart.tick(dt),
    pick: lit,
    // The cells of a sum that reaches the goal take a frame of their own.
    goal(r) { grid.classList.toggle('solved', r.done); return r.done ? cells.filter(c => c.a + c.b === st.pick).map(c => c.one) : []; },
    hot(id, on) {
      const { what, n } = parts(id);
      if (id === 'outcomes') return hotOn(cells.map(c => c.one), on);
      if (id === 'rolls') return hotOn(two.map(d => d.body), on);
      hotOn([...(what === 'ways' || what === 'p' ? cells.filter(c => c.a + c.b === n).map(c => c.one) : []), chart.bars[n]?.g], on);
    },
  };
}

// Each sample of dice adds its mean as a dot to a dot plot, and the plot's mean and spread follow below the axis. The
// dice show the last sample, and a ring marks its dot.
function means({ w, h, corner, spec, st, T, f }) {
  const g = el('g'), n = st.size, pad = 16, room = w - 2 * pad - 2 * corner;
  const per = n <= 8 || room / n >= 32 ? n : Math.ceil(n / 2), lines = Math.ceil(n / per), ds = clamp(Math.min(room / per - 6, 40), 14, 40);
  const strip = lines * (ds + 6), top = 14 + strip, axisY = h - 76, plotTop = top + 22, plotH = axisY - plotTop - 4;
  const X = v => pad + 10 + (v - 0.6) / 5.8 * (w - 2 * pad - 20);
  // A mean of n dice moves in steps of 1/n. Each bin is 1/q wide, with q a divisor of n up to 4, so every bin
  // catches the same number of those steps.
  const q = n === 1 ? 1 : [4, 3, 2].find(d => n % d === 0) ?? n, binOf = total => Math.round((total / n - 1) * q), bins = Array.from({ length: 5 * q + 1 }, () => []), gap = X(1 + 1 / q) - X(1);
  const sd = DIE_SPREAD / Math.sqrt(n), peak = n === 1 ? 1 / 6 : Math.min(1, (1 / q) / (sd * Math.sqrt(2 * Math.PI)));
  const slot = Math.min(gap * 0.92, 48); // A stack a few dots wide reads as a column.
  let fit = fitDots(spec.trials * peak * 1.2, slot, plotH, 11);

  const dice = Array.from({ length: n }, (_, i) => {
    const d = dieFace(ds), x = w / 2 + ((i % per) - (Math.min(per, n) - 1) / 2) * (ds + 6), y = 14 + ds / 2 + Math.floor(i / per) * (ds + 6);
    const spin = el('g', { transform: `translate(${x} ${y})` }, [d]); g.append(spin); return { d, spin };
  });
  const axis = el('g', { class: 'grid' }, [el('line', { class: 'axis', x1: X(0.6), x2: X(6.4), y1: axisY, y2: axisY })]);
  for (let v = 1; v <= 6; v++) axis.append(el('line', { class: 'tickm', x1: X(v), x2: X(v), y1: axisY, y2: axisY + 5 }), label({ class: 'tickh', x: X(v), y: axisY + 17 }, f.int(v)));
  const dots = el('g', { class: 'dots' });
  const meanLine = el('line', { class: 'mean-line', y1: plotTop - 6, y2: axisY }), fulcrum = el('path', { class: 'fulcrum', d: 'M0,0L-8,12L8,12Z' });
  const meanText = label({ class: 'stat', y: axisY + 37 }, ''), spread = el('path', { class: 'spread' }), spreadText = label({ class: 'stat', y: axisY + 62 }, '');
  const fulcrumAt = el('g', {}, [fulcrum]), meanG = el('g', {}, [meanLine, fulcrumAt, meanText]), spreadG = el('g', {}, [spread, spreadText]);
  g.append(axis, dots, meanG, spreadG);
  let now = st, mean = 3.5, spr = 0, latest = null;

  const place = (dot, b, i) => { const p = dotAt(i, fit); dot.setAttribute('cx', X(1 + b / q) + p.x); dot.setAttribute('cy', axisY - 2 + p.y); dot.setAttribute('r', fit.d * 0.42); };
  function refit() {
    const most = Math.max(...bins.map(b => b.length));
    if (Math.ceil(most / fit.cols) * fit.d <= plotH) return;
    fit = fitDots(most * 1.25, slot, plotH, fit.d);
    bins.forEach((b, k) => b.forEach((dot, i) => place(dot, k, i)));
  }
  function addDot(b, dot = el('circle', { class: 'dot' })) { dots.append(dot); bins[b].push(dot); place(dot, b, bins[b].length - 1); refit(); }
  // A bin's dots stack in the order the samples came, so the last sample's dot sits on top of its bin.
  function sync(s) {
    now = s;
    const want = Array(bins.length).fill(0);
    s.sums.forEach((c, total) => { if (c) want[binOf(total)] += c; });
    want.forEach((c, b) => { while (bins[b].length > c) bins[b].pop().remove(); while (bins[b].length < c) addDot(b); });
    latest?.classList.remove('last');
    latest = s.last ? bins[binOf(sum(s.last))].at(-1) : null;
    latest?.classList.add('last');
    dice.forEach((d, i) => d.d.show(s.last ? s.last[i] : 1 + (i * 2) % 6));
  }
  function draw() {
    const on = now.n > 0, x = X(mean);
    meanG.style.display = spreadG.style.display = on ? '' : 'none';
    if (!on) return;
    meanLine.setAttribute('x1', x); meanLine.setAttribute('x2', x);
    fulcrumAt.setAttribute('transform', `translate(${x} ${axisY + 1})`);
    const right = x < w * 0.62;
    meanText.setAttribute('x', x + (right ? 14 : -14)); meanText.setAttribute('text-anchor', right ? 'start' : 'end');
    meanText.textContent = `${T('mean')} ${f.fix(now.sum / now.n, 2)}`;
    const a = X(mean - spr), b = X(mean + spr), y = axisY + 50;
    spread.setAttribute('d', `M${a},${y - 5}V${y + 5}M${a},${y}H${b}M${b},${y - 5}V${y + 5}`);
    spreadText.setAttribute('x', clamp((a + b) / 2, 60, w - 60)); spreadText.setAttribute('text-anchor', 'middle');
    spreadText.textContent = `${T('spread')} ${f.fix(Math.sqrt(Math.max(0, now.sq / now.n - (now.sum / now.n) ** 2)), 2)}`;
  }
  const target = () => now.n ? [now.sum / now.n, Math.sqrt(Math.max(0, now.sq / now.n - (now.sum / now.n) ** 2))] : [3.5, 0];
  sync(st); [mean, spr] = target(); draw();
  return {
    g, sync,
    tick(dt) {
      const [m, v] = target();
      mean = ease(mean, m, dt, 140); spr = ease(spr, v, dt, 140);
      draw();
      return mean !== m || spr !== v;
    },
    pick() {},
    goal(r) { spreadG.classList.toggle('solved', r.done); return [spread]; },
    hot(id, on) { hotOn(id.includes('mean') ? [meanG] : id.includes('spread') ? [spreadG] : id === 'size' ? dice.map(d => d.spin) : id === 'samples' ? [dots] : [], on); },
  };
}

// Balls fall through a board of pegs. Each ball goes left or right at every row and lands in a bin, and the bins
// build a bell. A trail shows the way the last ball went.
function galton({ w, h, spec, st, T, f, pick }) {
  const R = spec.rows, g = el('g'), pad = 12, under = 34, cx = w / 2;
  const sx = Math.min((w - 2 * pad) / (R + 1), 56), y0 = 38, room = h - y0 - under - 8, sy = Math.min(sx * 0.82, room * 0.5 / R);
  const pegR = clamp(sx * 0.07, 1.8, 3.5), yb = y0 + (R - 1) * sy + sy * 0.8, floor = h - under;
  const binX = k => cx + (k - R / 2) * sx, pegX = (r, j) => cx + (j - r / 2) * sx, all = 2 ** R;
  let fit = fitDots(spec.trials * choose(R, Math.floor(R / 2)) / all * 1.15, sx * 0.86, floor - yb - 8, 9);
  const br = () => fit.d * 0.45;

  const pegs = el('g', { class: 'pegs' }), rowsOf = [];
  for (let r = 0; r < R; r++) { const row = el('g'); for (let j = 0; j <= r; j++) row.append(el('circle', { class: 'peg', cx: pegX(r, j), cy: y0 + r * sy, r: pegR })); pegs.append(row); rowsOf.push(row); }
  const funnel = el('path', { class: 'funnel-top', d: `M${cx - sx},6L${cx - sx * 0.3},${y0 - 14}M${cx + sx},6L${cx + sx * 0.3},${y0 - 14}` });
  const walls = el('g', { class: 'walls' }, [el('line', { x1: binX(0) - sx / 2, x2: binX(R) + sx / 2, y1: floor, y2: floor })]);
  for (let k = 0; k <= R + 1; k++) walls.append(el('line', { x1: binX(k) - sx / 2, x2: binX(k) - sx / 2, y1: yb, y2: floor }));
  const binsG = el('g'), stacks = [], labels = el('g');
  for (let k = 0; k <= R; k++) {
    const wash = el('rect', { class: 'wash', x: binX(k) - sx / 2 + 1, y: yb, width: sx - 2, height: floor - yb }), balls = el('g', { class: 'stack' });
    const hit = el('rect', { class: 'hit', x: binX(k) - sx / 2, y: yb - 6, width: sx, height: floor - yb + under + 6 });
    const bin = el('g', { class: 'bin pickable', 'data-key': k }, [wash, balls, hit]);
    pickable(bin, k, pick); binsG.append(bin);
    const num = label({ class: 'key', x: binX(k), y: floor + 14 }, f.int(k)), ways = label({ class: 'ways', x: binX(k), y: floor + 28, size: clamp(sx * 0.32, 8, 11) }, f.int(choose(R, k)));
    labels.append(num, ways);
    stacks.push({ bin, balls, num, ways, list: [] });
  }
  const curve = el('path', { class: 'curve' }), curveDots = el('g', { class: 'curve-dots' }), trail = el('path', { class: 'trail' });
  const key = el('g', {}, [el('line', { class: 'expect-key', x1: pad, x2: pad + 16, y1: 14, y2: 14 }), label({ class: 'key-words', x: pad + 22, y: 15, 'text-anchor': 'start' }, T('legend-expected'))]);
  g.append(binsG, walls, pegs, funnel, trail, curve, curveDots, labels, key);
  let nNow = st.n, now = st, latest = null;

  const place = (ball, k, i) => { const p = dotAt(i, fit); ball.setAttribute('cx', binX(k) + p.x); ball.setAttribute('cy', floor - 1 + p.y * 0.98); ball.setAttribute('r', br()); };
  function refit() {
    const most = Math.max(...stacks.map(s => s.list.length));
    if (Math.ceil(most / fit.cols) * fit.d <= floor - yb - 8) return;
    fit = fitDots(most * 1.2, sx * 0.86, floor - yb - 8, fit.d);
    stacks.forEach((s, k) => s.list.forEach((b, i) => place(b, k, i)));
  }
  function addBall(k, ball = el('circle', { class: 'ball' })) { const s = stacks[k]; s.balls.append(ball); s.list.push(ball); place(ball, k, s.list.length - 1); refit(); }
  // A bin's balls stack in the order they fell, so the last ball sits on top of its bin.
  function sync(s) {
    now = s;
    s.counts.forEach((c, k) => { const l = stacks[k].list; while (l.length > c) l.pop().remove(); while (l.length < c) addBall(k); });
    latest?.classList.remove('last');
    latest = s.last ? stacks[sum(s.last)].list.at(-1) : null;
    latest?.classList.add('last');
    // The trail touches the top of each peg the ball meets, then takes the side its path says, down to the ball.
    if (!latest) return trail.setAttribute('d', '');
    let right = 0; const pts = [[cx, 8]];
    for (let r = 0; r < R; r++) { pts.push([pegX(r, right), y0 + r * sy - pegR - br()]); right += s.last[r]; }
    pts.push([binX(right), yb], [Number(latest.getAttribute('cx')), Number(latest.getAttribute('cy'))]);
    trail.setAttribute('d', `M${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')}`);
  }
  // The curve shows each bin's expected share of the balls so far, as high as that many balls would stack.
  function drawCurve() {
    const pts = range(0, R).map(k => [binX(k), floor - nNow * choose(R, k) / all / fit.cols * fit.d * 0.98]);
    curve.setAttribute('d', nNow > 0.5 ? `M${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')}` : '');
    curveDots.replaceChildren(...(nNow > 0.5 ? pts.map(([x, y]) => el('circle', { cx: x, cy: y, r: 2.5 })) : []));
  }
  const lit = k => stacks.forEach((s, i) => s.bin.classList.toggle('on', i === k));
  sync(st); lit(st.pick); drawCurve();
  return {
    g, sync,
    tick(dt) { const was = nNow; nNow = ease(nNow, now.n, dt, 200); if (was !== nNow) drawCurve(); return nNow !== now.n; },
    pick: lit,
    hot(id, on) {
      const [what, k] = id.split('-'), n = id === 'pick' || k === 'pick' ? now.pick : Number(k);
      if (id === 'rows') return hotOn([pegs], on);
      if (id === 'bins' || id === 'paths') return hotOn(stacks.map(s => s.num), on);
      hotOn(what === 'ways' || what === 'p' ? [stacks[n]?.ways] : stacks[n] ? [stacks[n].bin] : [], on);
    },
  };
}

export default { coin, flips, die, dice, means, galton };
