// What every family's Node half shares: escaping, the link pattern of a text, the links object kitap asks for and
// the checks every challenge gets.
import { fileURLToPath } from 'url';
import { loadCatalogues } from '@openbooknetwork/kitap';
import { dice } from './kit/random.js';
import { fill } from './kit/format.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const list = ids => [...ids].join(', ');
// A text links a measure, a control or a worked formula as [words](@id).
export const LINK = /\[([^\]]+)\]\(@([^)\s]+)\)/g;

// links tells kitap which ids a page's text may link. has says whether an id exists, and offers names what to link.
export const links = (has, offers) => ({
  has, attr: id => ` data-ref="${esc(id)}"`, names: () => [],
  missing: (name, id) => `[${name}](@${id}) links to "${id}", link ${offers}`,
});

// challenge finds the goal a page names and fails a page whose goal is unknown or belongs to another scene. A goal
// lists the scenes it works on as scenes, and a goal without the list works on every scene of its family.
export function challenge(c, goals, { scene, at, ctx }) {
  const goal = goals[c.goal];
  if (!goal) { ctx.fail(at, `challenge.goal is "${c.goal}", the goals are ${list(Object.keys(goals))}`); return null; }
  if (goal.scenes && !goal.scenes.includes(scene)) { ctx.fail(at, `challenge.goal ${c.goal} works on ${list(goal.scenes)}, this page shows ${scene}`); return null; }
  return goal;
}
// drawn checks a goal whose target the page draws as it opens. It draws SAMPLES targets from seeds 1 to SAMPLES and
// fails the page when the goal has nothing to draw, when a draw is solved as the page opens, or when the page's
// controls cannot reach it. starts gives the page's state for a target, and the goal's reach names what stops a
// target from being reached.
const SAMPLES = 300;
export function drawn(goal, c, spec, { at, ctx, starts }) {
  for (let seed = 1; seed <= SAMPLES; seed++) {
    let target;
    try { target = goal.draw(c, spec, dice(seed)); } catch (err) { return ctx.fail(at, `challenge.goal ${c.goal} cannot draw a target: ${err.message}`); }
    if (target === null || target === undefined) return ctx.fail(at, `challenge.goal ${c.goal} draws nothing from what the page declares, widen its ranges`);
    const state = starts(spec, target), words = JSON.stringify(target);
    if (goal.holds(state, spec, c, target).done) return ctx.fail(at, `challenge.goal ${c.goal} can draw ${words}, which is reached as the page opens`);
    const stop = goal.reach?.(spec, c, target);
    if (stop) return ctx.fail(at, `challenge.goal ${c.goal} can draw ${words}, and ${stop}`);
  }
}
// hidden fails a page whose readout shows a measure that gives the challenge's answer away.
export function hidden(readout, hides, at, ctx) {
  for (const id of readout) if (hides.includes(id)) ctx.fail(at, `readout names "${id}", which gives the challenge's answer away, leave it out`);
}
// value reads a field that is a number, a slider or a stepper as its starting value and its control's range.
export function value(v) {
  if (v == null) return { n: null, ctl: null };
  if (typeof v === 'number') return { n: v, ctl: null };
  const kind = v.slider ? 'slider' : 'stepper', [lo, hi] = v[kind];
  return { n: v.start ?? lo, ctl: { kind, lo, hi } };
}
// string reads one of hesap's strings in a language, for a link that shows a word. A language hesap has no strings
// for reads the English ones. vars fill the string's {name} places.
const I18N = fileURLToPath(new URL('./i18n/', import.meta.url)), STRINGS = new Map();
export function string(lang, key, vars) {
  if (!STRINGS.has(lang)) { const cats = loadCatalogues(I18N, [lang, 'en']); STRINGS.set(lang, cats[lang] ?? cats.en); }
  return fill(STRINGS.get(lang)[key], vars);
}
