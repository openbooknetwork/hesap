// The browser half of the axes family: a JSXGraph board over a figure on axes or in space, sliders and readouts
// docked under it, and the numbers in the text that follow the figure. A challenge page adds its goal above the
// controls and judges the figure after every change. The reader's changes last until the next page. The board and
// the number writing are shared with the geo family, from geo/shared/.
import FIGURES from './figures/index.js';
import { GOALS, reached } from './goals.js';
import { ripple, pop } from './driver.js';
import { formatter, starts as startsOf } from '../geo/shared/format.js';
import { plot, rest, resetButton, wide } from '../geo/shared/board.js';
import { slider, chip, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';

export default function axes(api) {
  const { host, panel, T, lang, moving, motion: fx } = api, plt = plot(api, 'axes');
  let spec = null, fig = null, values = {}, sliders = [], chips = [], reset = null, goal = null;
  // aim is the challenge's current target.
  let aim = 0;
  const F = () => formatter(lang()), label = id => T(id) ?? id;
  const starts = () => startsOf(spec.controls);
  const moved = () => JSON.stringify(values) !== JSON.stringify(starts());
  const rule = () => GOALS[spec.challenge.goal], target = () => spec.challenge.targets[aim];
  const says = () => rule().says(target(), F(), T);

  // refresh writes every number that follows the controls: the readouts, the slider values and the text's links. A
  // change the reader makes is judged against the goal, and a redraw judges quietly.
  function refresh(quiet = false) {
    const f = F(), now = id => f.value(fig, spec.controls, values, id);
    for (const k of chips) k.set(now(k.id));
    for (const s of sliders) s.show(values[s.id]);
    live(host, { value: now, formula: id => f.worked(fig, values, id) });
    reset.idle(!moved());
    if (spec.challenge) judge(quiet);
  }

  // Reaching the goal plays the effect once, and a redraw plays nothing.
  function judge(quiet) {
    const first = goal.show(reached(spec, target(), values));
    if (first && !quiet && moving()) celebrate();
  }
  function celebrate() {
    fx.pop(goal.el.querySelector('.hesap-goal-state'));
    for (const p of rule().marks(values)) ripple(fx, plt.ring(...plt.screen(p), 'axes-ripple'));
    // What the reader moved swells, either the points they drag or a solid as a whole.
    if (spec.view.z) pop(fx, plt.svgRoot(), 1.04); else for (const p of plt.dragged(spec)) pop(fx, p.rendNode);
  }

  function drawGoal() {
    const c = spec.challenge, name = c.goal;
    // A new target starts from the page's starting figure, which reaches none of the targets.
    goal = goalRow({ T, actions: [reset.el], hint: on => on ? T(`hint-${name}`, says()) : null,
      another: c.targets.length > 1 ? () => { aim = (aim + 1) % c.targets.length; values = starts(); draw(); panel.querySelector('[data-act="another"]').focus(); } : null });
    goal.say(T(`goal-${name}`, says()));
    return goal.el;
  }
  function drawPanel() {
    const f = F();
    goal = null;
    // Reset puts the figure back as the page starts it, and keeps the goal line and its hint as they are.
    reset = resetButton(T, () => { values = starts(); for (const s of sliders) s.set(values[s.id]); drawBoard(); refresh(true); });
    sliders = Object.entries(spec.controls).filter(([, c]) => c.slider).map(([id, c]) => {
      const s = slider({ id, label: label(id), min: c.slider[0], max: c.slider[1], step: c.step, value: values[id], write: v => f.say(id, v),
        input: v => { values[id] = v; plt.moved(); refresh(); } });
      s.id = id; s.width(f.say(id, c.slider[1]).length + 1);
      return s;
    });
    chips = spec.readout.map(id => wide(chip({ id, label: label(id) }), f.value(fig, spec.controls, starts(), id)));
    const g = spec.challenge ? drawGoal() : null;
    panel.replaceChildren(...[g, sliders.length ? row('ctls', sliders) : null, rest({ goal, chips, reset: reset.el })].filter(Boolean));
  }
  function drawBoard() {
    // A view of space sits on a board of its own size, which the figure fills with the three axes.
    const bounds = spec.view.z ? [[-8, 8], [-7, 7]] : [spec.view.x, spec.view.y];
    const hides = spec.challenge ? rule().hides : [];
    plt.build({ spec, fig, bounds, values: () => values, put: (id, v) => { values[id] = v; }, has: a => spec.annotate.includes(a),
      f: F(), hides: id => hides.includes(id), change: refresh,
      slid: () => { for (const s of sliders) s.set(values[s.id]); } });
  }
  function draw() { drawPanel(); drawBoard(); refresh(true); }

  return {
    show(page) { spec = page; fig = FIGURES[spec.scene]; values = starts(); aim = 0; draw(); },
    hide() { plt.free(); spec = null; },
    point(id, on) {
      if (!spec) return;
      plt.point(spec, id, on);
      for (const node of panel.querySelectorAll('[data-ref]')) node.classList.toggle('hot', on && node.dataset.ref === id);
    },
    // A theme switch draws the board in the new colours and keeps the panel.
    theme() { if (!spec) return; drawBoard(); refresh(true); },
    lang() { if (spec) draw(); },
  };
}
