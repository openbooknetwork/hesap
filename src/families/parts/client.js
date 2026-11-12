// The browser half of the parts family: a scene's picture in SVG, the fraction editors, buttons and readouts docked
// under it, and the values in the text that follow the picture. The figure keeps the shapes and the driver animates
// them.
import GOALS from './goals.js';
import { formatter, starts, staged, literal } from './format.js';
import { frac } from './fraction.js';
import figure from './figure.js';
import driver from './driver.js';
import { slider, chip, button, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { h, svg as el, svgPoint } from '../../kit/dom.js';
import { math } from '../../kit/text.js';

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export default function parts({ host, stage, panel, T, lang, moving, motion }) {
  const fx = driver(motion);
  // v holds the values, the scene's own state among them. paint follows a finger that shades parts as it moves. rule
  // is the page's goal, goal its line in the panel, and solved says whether the target holds now.
  let spec = null, scene = null, rule = null, goal = null, solved = false, v = {}, fig = null, svg = null, paint = null, keyed = null;
  // opening, held and typing are the timers of a page's first move, a step button held down and a number being typed.
  let acts = '', opening = 0, held = 0, typing = 0, chips = [], actBox = null;
  const quiet = () => { clearTimeout(opening); clearTimeout(held); clearTimeout(typing); opening = held = typing = 0; };

  const F = () => formatter(lang());
  // tex sets a piece of TeX and says whether it changed.
  const tex = (node, src, display = false) => { if (node.dataset.tex === src) return false; math(node, src, display); return true; };

  // range() gives the numbers a fraction's top and bottom may take. The page sets the bottom's, the wholes the top's.
  const range = (name, part) => part === 'd' ? spec.fractions[name].bottom : [0, spec.fractions[name].wholes * v[name].d];
  // A stepper, a typed number or a tap changes a fraction. A smaller bottom pulls the top down with it.
  function change(name, part, x) {
    const was = v[name], [lo, hi] = range(name, part);
    let n = was.n, d = was.d;
    if (part === 'd') { d = clamp(x, lo, hi); n = Math.min(n, spec.fractions[name].wholes * d); } else n = clamp(x, lo, hi);
    if (n === was.n && d === was.d) return false;
    v[name] = frac(n, d); scene.changed?.(v, name); update();
    return true;
  }
  const update = () => { fig.update(scene.figure(v, spec)); refresh(); judge(); };

  // ---------- a challenge ----------
  // words writes a UI string with {a}-style places for values. A fraction is set as a formula, a number as itself.
  function words(template, values) {
    const f = F();
    return h('span', {}, template.split(/\{(\w)\}/).map((part, i) => {
      if (i % 2 === 0) return part;
      const x = values[part];
      return x.kind === 'number' ? f.plain.v(x) : math(h('span'), `\\displaystyle ${f.tex.v(x)}`);
    }));
  }
  const sayGoal = () => goal.say(words(T(`goal_${spec.challenge.goal}`), rule.say(v.target, spec)));
  // After every change the goal is checked. Reaching it says Solved and marks the shapes until a change undoes it.
  function judge() {
    if (!rule) return;
    const now = rule.holds(v, v.target);
    goal.show(now);
    if (now === solved) return;
    solved = now;
    fig.cheer(rule.shapes(v.target), now);
  }

  // ---------- the text and the readouts ----------
  function refresh() {
    const f = F();
    for (const ed of panel.querySelectorAll('.parts-ed')) for (const r of ed.querySelectorAll('.parts-row')) {
      const name = ed.dataset.ref, part = r.dataset.part, x = v[name][part], [lo, hi] = range(name, part), field = r.querySelector('input,output');
      // A field the reader is typing in keeps what they typed until they leave it.
      if (document.activeElement !== field) { field.value = String(x); field.removeAttribute('aria-invalid'); }
      for (const b of r.querySelectorAll('.parts-step')) b.disabled = +b.dataset.by < 0 ? x <= lo : x >= hi;
    }
    for (const op of panel.querySelectorAll('.parts-op[data-ref]')) tex(op, f.tex.v(scene.measures[op.dataset.ref].value(v)));
    drawActions();
    for (const k of chips) {
      const m = scene.measures[k.id], x = m.value(v);
      // A count keeps the panel's own type, and everything else is set as a formula.
      const changed = !m.eq && x.kind === 'number' ? k.set(f.plain.v(x)) : tex(k.value, `\\displaystyle ${m.eq ? m.eq(v, f.tex) : f.tex.v(x)}`);
      if (changed && k.el.dataset.shown && moving()) fx.flash(k.el);
      k.el.dataset.shown = '';
    }
    // The kit's live writes a value as text, and this page sets fractions in its text as formulas.
    for (const span of host.el.story.querySelectorAll('.place[data-ref]')) {
      const id = span.dataset.ref, formula = id.startsWith('formula-') && id.slice(8);
      if (formula) { if (!scene.formulas[formula]) continue; span.dataset.formula = ''; span.removeAttribute('tabindex'); tex(span, f.worked(scene, v, formula), true); continue; }
      const words = f.value(scene, v, id);
      if (words === null) continue;
      if (literal(id)) { span.dataset.fixed = ''; span.removeAttribute('tabindex'); }
      // Fractions, repeating decimals and the signs between fractions are set as formulas. Numbers keep the text's type.
      if (/[/̅]|^[<=>]$/.test(words)) tex(span, `\\displaystyle ${f.math(scene, v, id)}`);
      else if (span.textContent !== words || span.dataset.tex) { delete span.dataset.tex; span.textContent = words; }
      span.dataset.live = '';
    }
  }

  // drawActions shows the buttons the scene offers now. A scene that divides offers one per factor the two share.
  function drawActions() {
    const list = scene.actions?.(v) ?? [], sig = list.map(a => a.id).join();
    if (!actBox) return;
    if (sig !== acts) {
      acts = sig;
      actBox.replaceChildren(...list.map(a => {
        const [id, n] = a.id.split('-'), press = () => { scene.act[id](v, +n); update(); };
        // A factor's button is the sign it writes, and start again is the arrow of a turn back.
        if (id === 'again') return button({ label: T('reset'), act: a.id, press, glyph: 'reset', compact: true });
        if (!n) return button({ label: T(id), act: a.id, press });
        const b = button({ label: `÷ ${n}`, act: a.id, press, cls: 'parts-sign' }), name = T('divide', { n });
        b.setAttribute('aria-label', name); b.title = name;
        return b;
      }));
    }
    list.forEach((a, i) => { actBox.children[i].disabled = !!a.off; });
  }

  // ---------- the panel ----------
  // A fraction is set the way it is written: its top over its bottom, each a number with a step down and a step up.
  function editor(name) {
    // A challenge may hold one of the numbers to its target, which the reader then reads but cannot step.
    const open = part => (part === 'd' || scene.top !== false) && !rule?.lock?.includes(part);
    const line = part => {
      const said = T(part === 'n' ? 'top' : 'bottom');
      if (!open(part)) return h('div', { class: 'parts-row', 'data-part': part }, [h('span', { class: 'parts-gap' }), h('output', { class: 'parts-num', 'aria-label': said }), h('span', { class: 'parts-gap' })]);
      const step = by => hold(h('button', { type: 'button', class: 'parts-step', 'data-by': by, 'aria-label': T(`${by < 0 ? 'less' : 'more'}_${part}`) }, by < 0 ? '−' : '+'), name, part);
      const input = h('input', { class: 'parts-num', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', enterkeyhint: 'done', autocomplete: 'off', spellcheck: 'false', 'aria-label': said });
      typed(input, name, part);
      return h('div', { class: 'parts-row', 'data-part': part }, [step(-1), input, step(1)]);
    };
    return h('div', { class: `parts-ed ${name}`, 'data-ref': name }, [line('n'), h('span', { class: 'parts-line' }), line('d')]);
  }

  // A step button steps once when pressed and again and again while it is held. A new page lets go of it.
  function hold(b, name, part) {
    const by = +b.dataset.by, stop = () => { clearTimeout(held); held = 0; };
    const once = () => change(name, part, v[name][part] + by) || stop();
    b.addEventListener('pointerdown', e => {
      if (e.button) return;
      e.preventDefault(); stop(); once();
      held = setTimeout(function again() { if (!held) return; once(); if (held) held = setTimeout(again, 110); }, 450);
    });
    for (const end of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(end, stop);
    b.addEventListener('click', e => { if (!e.detail) once(); }); // A key press clicks with no pointer behind it.
    return b;
  }

  // A typed number takes effect once the fingers pause, or at once on Enter. Outside its range it waits, marked.
  function typed(input, name, part) {
    // A field that left the page with its panel takes nothing.
    const take = () => { clearTimeout(typing); typing = 0; const x = parseInt(input.value, 10), [lo, hi] = range(name, part); if (input.isConnected && x >= lo && x <= hi) change(name, part, x); };
    input.addEventListener('focus', () => setTimeout(() => input.select())); // A phone selects only once the focus has settled.
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 2), x = parseInt(digits, 10), [lo, hi] = range(name, part);
      if (digits !== input.value) input.value = digits;
      clearTimeout(typing);
      const ok = x >= lo && x <= hi;
      input.setAttribute('aria-invalid', String(!ok));
      if (ok) typing = setTimeout(take, 450);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { take(); input.blur(); }
      const by = { ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (by) { e.preventDefault(); change(name, part, v[name][part] + by); input.value = v[name][part]; input.select(); }
    });
    input.addEventListener('blur', () => { take(); if (input.isConnected) refresh(); });
  }

  function drawPanel() {
    const op = () => scene.measures.sign ? h('span', { class: 'parts-op', 'data-ref': 'sign' }) : h('span', { class: 'parts-op' }, '+');
    const eds = h('div', { class: 'parts-eds' }, scene.fractions.flatMap((n, i) => i ? [op(), editor(n)] : [editor(n)]));
    const sliders = Object.keys(scene.controls).map(id => { const c = spec.controls[id];
      return slider({ id, label: T(id), min: c.slider[0], max: c.slider[1], value: v[id], input: x => { v[id] = x; update(); } }); });
    chips = spec.readout.map(id => { const m = scene.measures[id]; return chip({ id, label: m.eq ? null : T(m.label ?? id) ?? '' }); });
    actBox = scene.actions ? h('div', { class: 'parts-acts' }) : null; acts = '';
    // A challenge's line comes first, with its Hint and Another one.
    goal = rule ? goalRow({ T, motion: moving() ? motion : null,
      hint: on => on ? words(T(`hint_${spec.challenge.goal}`), rule.hint(v.target, spec)) : null,
      another: spec.challenge.targets.length > 1 ? () => { v = starts(spec, v.round + 1); goal.reset(); sayGoal(); update(); } : null }) : null;
    // The fractions stand on the left, and the slider, the buttons and the readouts share the room beside them.
    const side = h('div', { class: 'parts-side' }, [...sliders.map(s => s.el), actBox, chips.length ? row('out', chips) : null].filter(Boolean));
    const deck = h('div', { class: 'parts-deck' }, side.children.length ? [eds, side] : [eds]);
    panel.replaceChildren(...[goal?.el, deck].filter(Boolean));
    if (goal) sayGoal();
  }

  // ---------- tapping the picture ----------
  const at = e => svgPoint(svg, e);
  // A tap shades a part. In a scene that toggles, it shades or clears that one part. Elsewhere the top becomes the
  // number of parts up to it, and a tap on the last shaded part takes that part away.
  function tap({ s, i }, mode) {
    if (s.tap === 'toggle') { if (mode !== null && v.on[i] === mode) return mode; const to = scene.tap(v, i, mode); update(); return to; }
    const n = (s.base ?? 0) + i + 1;
    change(s.of, 'n', mode === null && v[s.of].n === n ? n - 1 : n);
    return 'set';
  }
  // A finger that moves on after a tap paints the parts it passes the same way.
  function listen() {
    svg.addEventListener('pointerdown', e => {
      if (e.button) return;
      const hit = fig.hit(at(e));
      if (!hit) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch {} // A pointer that a script made has nothing to capture.
      paint = { id: hit.s.id, mode: tap(hit, null) };
    });
    svg.addEventListener('pointermove', e => { if (paint) { const hit = fig.hit(at(e), paint.id); if (hit) tap(hit, paint.mode); } });
    for (const end of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(end, () => { paint = null; });
    // The keyboard walks the parts of a shape with the arrow keys and shades the one it is on with Enter or Space.
    svg.addEventListener('keydown', e => {
      const s = fig.shapes().find(t => t.kind === 'bar');
      if (!s) return;
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      // The page turns on the arrow keys too, so a key the picture uses goes no further.
      if (step) { e.preventDefault(); e.stopPropagation(); keyed = clamp((keyed ?? -1) + step, 0, s.d - 1); fig.cursor(s.id, keyed); }
      if ((e.key === 'Enter' || e.key === ' ') && keyed != null) { e.preventDefault(); e.stopPropagation(); tap({ s, i: keyed }, null); fig.cursor(s.id, keyed); }
    });
    svg.addEventListener('blur', () => { keyed = null; fig.cursor(null); });
  }

  function draw(open = false) {
    quiet(); paint = keyed = null;
    svg = el('svg', { viewBox: `0 0 ${scene.view.width} ${scene.view.height}`, class: `parts-svg ${spec.scene}`, role: 'img', 'aria-label': T('picture') });
    stage.replaceChildren(svg);
    fig = figure(svg, fx, { moving, say: x => F().plain.v(x) });
    solved = false;
    listen(); drawPanel();
    // A page with a stage opens on the stage before it and moves on once, since the move is what the page shows. A
    // challenge opens ready to work.
    const before = open && !rule && moving() && scene.opening?.(v);
    fig.update(scene.figure(before || v, spec), true); refresh(); judge();
    if (before) opening = setTimeout(() => fig.update(scene.figure(v, spec)), 600);
    // The keyboard reaches a picture whose parts only a tap can shade.
    if (fig.shapes().some(s => s.tap === 'toggle')) svg.setAttribute('tabindex', '0');
  }

  return {
    show(page) {
      spec = page; scene = staged(spec); rule = spec.challenge ? GOALS[spec.challenge.goal] : null; v = starts(spec);
      draw(true);
    },
    hide() { quiet(); spec = null; paint = null; stage.replaceChildren(); },
    // The picture's shapes for a fraction stand out while the reader points at a value about it.
    point(id, on) {
      if (!spec) return;
      const m = on ? scene.measures[id] : null;
      fig.hot(m?.of ?? null);
      for (const k of chips) k.el.classList.toggle('hot', on && k.id === id);
      for (const ed of panel.querySelectorAll('.parts-ed')) ed.classList.toggle('hot', !!m && ed.dataset.ref === m.of);
    },
    // A new language writes the panel and the picture's numbers again, from the values the reader has set.
    lang() { if (spec) draw(); },
  };
}
