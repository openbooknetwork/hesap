// The browser half of the geo family: a JSXGraph board over a plane figure, sliders and readouts docked under it,
// and the numbers in the text that follow the figure. The reader's changes last until the next page.
import FIGURES from './figures/index.js';
import { GOALS } from './goals.js';
import { flash } from './driver.js';
import { formatter, starts as startsOf } from './shared/format.js';
import { plot, rest, resetButton, wide } from './shared/board.js';
import { h } from '../../kit/dom.js';
import { slider, chip, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';

export default function geo(api) {
  const { host, panel, T, lang, moving, motion: fx } = api, plt = plot(api, 'geo'), flashes = fx.group();
  let spec = null, fig = null, values = {}, shape = null, stroke = null, sliders = [], chips = [], reset = null, goal = null;
  // A challenge page keeps the target it shows (aim), the hint and the goal reached until the page changes.
  let aim = 0, hinted = false, solved = false, timer = 0;
  const challenge = () => spec?.challenge, target = () => challenge()?.targets[aim];
  const F = () => formatter(lang()), label = id => T(id) ?? id;
  const starts = () => startsOf(spec.controls);
  const moved = () => JSON.stringify(values) !== JSON.stringify(starts());
  // shown lists what the page shows of the figure, with the hint's part once the reader asks for it.
  const shown = key => [...spec[key], ...(hinted ? challenge().hint?.[key] ?? [] : [])];

  // refresh writes every number that follows the controls: the readouts, the slider values and the text's links.
  function refresh() {
    const f = F(), now = id => f.value(fig, spec.controls, values, id, target());
    for (const k of chips) k.set(now(k.id));
    for (const s of sliders) s.show(values[s.id]);
    live(host, { value: now, formula: id => f.worked(fig, values, id) });
    reset.idle(!moved());
    judge();
  }

  // The goal is checked after every change. Reaching it shows once the figure rests a moment, so a drag that only
  // passes through it stays quiet. Leaving it clears the success at once.
  function judge() {
    if (!challenge()) return;
    clearTimeout(timer);
    const met = GOALS[challenge().goal].met(fig, values, target(), challenge().tolerance);
    if (!met) { if (solved) mark(false); return; }
    if (!solved) timer = setTimeout(() => mark(true, moving()), 250);
  }
  function mark(on, play = false) {
    solved = on;
    goal.show(on);
    shape?.setAttribute(on ? { strokeColor: plt.colours().accent, strokeWidth: stroke.strokeWidth + 1 } : stroke);
    if (!on) flashes.stop();
    if (play) { flash(flashes, shape?.rendNode); fx.pop(goal.el.querySelector('.hesap-goal-state')); }
  }

  // The goal's parts show as chips: the goal's own parts first, then each value of the target. Reset stands among
  // the goal's buttons while the page shows no readouts.
  function drawGoal() {
    const c = challenge();
    // The hint shows more of the figure. Another one sets the next target and puts the figure back as the page
    // starts it.
    goal = goalRow({ T, actions: [reset.el], hint: c.hint ? on => { hinted = on; drawOut(); drawBoard(); if (solved) mark(true); refresh(); return null; } : null,
      another: c.targets.length > 1 ? () => {
        aim = (aim + 1) % c.targets.length; hinted = false; values = starts(); mark(false); draw();
        panel.querySelector('[data-act="another"]').focus();
      } : null });
    const f = F(), parts = [...GOALS[c.goal].also.map(id => [id, label(id)]), ...Object.entries(target()).map(([id, v]) => [`goal-${id}`, `${label(id)} ${f.say(id, v)}`])];
    const line = document.createDocumentFragment();
    line.append(h('small', {}, T('goal')), ...parts.map(([id, words]) => { const k = chip({ id, label: null, cls: 'geo-want' }); k.set(words); return k.el; }));
    goal.say(line);
    return goal.el;
  }
  // The readouts sit on one row with Reset.
  function drawOut() {
    const f = F(), first = starts(), old = panel.querySelector('.hesap-out');
    chips = shown('readout').map(id => wide(chip({ id, label: label(id) }), f.value(fig, spec.controls, first, id, target())));
    const out = rest({ goal, chips, reset: reset.el });
    if (!out) old?.remove();
    else if (old) old.replaceWith(out);
    else panel.appendChild(out);
  }
  function drawPanel() {
    const f = F();
    goal = null;
    // Reset puts the figure back as the page starts it, and keeps the hint as it is.
    reset = resetButton(T, () => { values = starts(); for (const s of sliders) s.set(values[s.id]); drawBoard(); refresh(); });
    sliders = Object.entries(spec.controls).filter(([, c]) => c.slider).map(([id, c]) => {
      const s = slider({ id, label: label(id), min: c.slider[0], max: c.slider[1], step: c.step, value: values[id], write: v => f.say(id, v),
        input: v => { values[id] = v; plt.moved(); refresh(); } });
      s.id = id; s.width(f.say(id, c.slider[1]).length + 1);
      return s;
    });
    panel.replaceChildren(...[challenge() ? drawGoal() : null, sliders.length ? row('ctls', sliders) : null].filter(Boolean));
    drawOut();
  }
  function drawBoard() {
    const { x, y } = spec.view;
    ({ shape } = plt.build({ spec, fig, bounds: [x, y], values: () => values, put: (id, v) => { values[id] = v; }, has: a => shown('annotate').includes(a),
      f: F(), change: refresh }));
    stroke = shape && { strokeColor: shape.visProp.strokecolor, strokeWidth: shape.visProp.strokewidth };
  }
  function draw() {
    drawPanel(); drawBoard();
    if (solved) mark(true); // The new panel and board show a goal that still holds.
    else goal?.show(false);
    refresh();
  }

  return {
    show(page) {
      spec = page; fig = FIGURES[spec.scene]; values = starts();
      clearTimeout(timer); aim = 0; hinted = false; solved = false;
      draw();
    },
    hide() { clearTimeout(timer); plt.free(); spec = null; },
    point(id, on) {
      if (!spec) return;
      plt.point(spec, id, on);
      for (const node of panel.querySelectorAll('[data-ref]')) node.classList.toggle('hot', on && node.dataset.ref === id);
    },
    // A theme switch draws the board in the new colours and keeps the panel, the hint among it.
    theme() { if (!spec) return; drawBoard(); if (solved) mark(true); },
    // A new language writes the panel again, which closes the hint.
    lang() { if (!spec) return; hinted = false; draw(); },
  };
}
