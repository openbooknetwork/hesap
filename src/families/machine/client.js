// The browser half of the machine family: an SVG scene of function machines, the kit's controls docked under it,
// and the numbers in the text that follow the scene. The scene says what happens, and the driver animates it.
import SCENES, { VIEW } from './scenes.js';
import RULES from './rules.js';
import { GOALS, met, opening } from './goals.js';
import { driver } from './driver.js';
import { formatter } from './format.js';
import { svg } from '../../kit/dom.js';
import { slider, chip, button, segment, row } from '../../kit/panel.js';
import { goalRow } from '../../kit/goal.js';
import { live } from '../../kit/text.js';

export default function machine({ host, stage, panel, T, lang, moving, motion }) {
  const d = driver(motion), F = () => formatter(lang()), name = id => T(id) ?? id;
  let spec = null, scene = null, built = null, values = {}, run = 0, timer = 0;
  // goal is the page's goal and line its challenge line. aim is the index of the target that is up. After a wrong
  // guess the guesses wait for a new input, so tapping every guess in turn does not find the rule.
  let goal = null, line = null, aim = 0, solved = false, locked = false;
  let sliders = {}, segs = {}, chips = [];

  const now = id => F().value(scene, spec, values, id);
  // refresh writes every value that follows the controls: the readouts, the controls and the links in the text.
  function refresh() {
    const f = F();
    for (const k of chips) k.set(now(k.id));
    for (const [id, s] of Object.entries(sliders)) if (s.get() !== values[id]) s.set(values[id]);
    for (const [id, s] of Object.entries(segs)) {
      s.set(values[id]);
      for (const b of s.el.querySelectorAll('button')) b.disabled = locked && scene.controls[id] === 'guess';
    }
    live(host, { value: now, formula: id => scene.formulas[id] ? f.worked(scene, values, id) : null });
  }

  // The challenge line says the goal, and after a wrong guess it says to feed in another number.
  function tell() {
    if (!line) return;
    const g = spec.challenge.goal;
    line.say(T(`goal-${g}`, { target: now('target') }));
    line.show(solved, goal.miss && goal.got(values, scene, spec) != null ? T(`miss-${g}`) : undefined);
  }
  // The scene shows the goal reached or not, and the thing that reached it pops once.
  function mark(on) {
    if (on !== solved) {
      solved = on;
      const at = built.solved(values, on);
      if (on && moving()) d.cheer(at);
    }
    tell();
  }
  // A change that breaks the goal clears it at once. A goal that a run shows counts only once the run has ended.
  function judge(ran) {
    if (!goal) return;
    const holds = met(goal, values, scene, spec);
    if (!holds || goal.judge === 'now' || ran) mark(holds);
  }

  // The run plays once when the page opens and after each change. It plays at once for a reader who asked for less
  // motion, else after a short wait, so a slider that is still moving starts one run. changed names the control.
  function play(wait = 350, changed) {
    const mine = ++run; clearTimeout(timer); d.stop();
    if (!moving()) { built.end(d, values); judge(true); return; }
    built.start(d, values, changed);
    timer = setTimeout(async () => { if (await built.play(d, values, () => mine === run, changed)) judge(true); }, wait);
  }

  // Another one sets the next target and puts the figure back to its start.
  function another() {
    line.reset(); mark(false); aim = (aim + 1) % spec.challenge.targets.length; locked = false;
    values = opening(spec, scene, spec.challenge.targets[aim]); refresh(); tell(); play(200);
  }
  function moved(id, v) {
    values[id] = v;
    if (locked) { locked = false; values.guess = null; }
    refresh(); judge(false); play(350, id);
  }
  function picked(id, r) {
    values[id] = r; judge(false);
    // A guess changes no run, so the machine does not run again for it.
    if (scene.controls[id] !== 'guess') { refresh(); return play(350, id); }
    locked = !solved; refresh();
    if (!solved && moving()) d.shake(segs[id].el.querySelector(`[data-v="${CSS.escape(r)}"]`));
  }
  // An action moves the scene first, then the values it changed run through it.
  async function act(a) {
    const mine = ++run; clearTimeout(timer); d.stop(); built.start(d, values);
    await built.actions[a](d, values);
    if (mine === run) { refresh(); judge(false); play(200); }
  }

  function drawPanel() {
    const c = spec.challenge;
    line = c ? goalRow({ T, motion: moving() ? motion : null, hint: on => on ? T(`hint-${c.goal}`, { target: now('target') }) : null,
      another: c.targets.length > 1 ? another : null }) : null;
    // A rule with one choice and a slider with one stop are no choice, so they get no control.
    const own = Object.entries(spec.controls).filter(([, k]) => k.slider ? k.slider[0] !== k.slider[1] : k.choice.length > 1);
    sliders = {}; segs = {};
    const ctls = own.map(([id, k]) => k.slider
      ? sliders[id] = slider({ id, label: name(id), min: k.slider[0], max: k.slider[1], step: k.step, value: values[id], write: v => F().fmt(v), input: v => moved(id, v) })
      : segs[id] = segment({ id, label: name(id), items: k.choice.map(r => [r, RULES[r].label]), value: values[id], pick: r => picked(id, r) }));
    const acts = (spec.actions ?? Object.keys(built.actions ?? {})).map(a => button({ label: name(a), act: a, press: () => act(a) }));
    chips = spec.readout.map(id => chip({ id, label: name(id) }));
    panel.replaceChildren(...[line?.el, ctls.length || acts.length ? row('ctls', [...ctls, ...acts]) : null, chips.length ? row('out', chips) : null].filter(Boolean));
    tell();
  }

  function draw() {
    ++run; clearTimeout(timer); d.stop();
    const root = svg('svg', { class: 'machine-svg', viewBox: `0 0 ${VIEW.width} ${VIEW.height}` },
      [svg('line', { class: 'rail', x1: VIEW.width / 2, y1: 20, x2: VIEW.width / 2, y2: VIEW.height - 20 })]);
    built = scene.build(root, spec, n => F().fmt(n));
    stage.replaceChildren(root);
    motion.adopt(root);
    drawPanel(); refresh(); play(700);
  }
  function stop() { ++run; clearTimeout(timer); d.stop(); }

  return {
    show(page) {
      spec = page; scene = SCENES[spec.scene];
      goal = GOALS[spec.challenge?.goal] ?? null; aim = 0; solved = locked = false;
      values = opening(spec, scene);
      draw();
    },
    hide() { stop(); spec = null; },
    point(id, on) { if (!spec) return; for (const node of panel.querySelectorAll('[data-ref]')) node.classList.toggle('hot', on && node.dataset.ref === id); },
    lang() { if (spec) { drawPanel(); refresh(); } },
  };
}
