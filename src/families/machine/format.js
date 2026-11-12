// How a value and a worked formula are written in a language. The browser writes the live values with it, and the
// build writes the starting values to check the numbers typed in a page's text.
import RULES from './rules.js';
import { numbers, aligned } from '../../kit/format.js';

// The values a page opens with are each control's start and the scene's own state. A guess starts with no pick.
export const starts = (controls, scene) => ({ ...scene.state, ...Object.fromEntries(Object.entries(controls).map(([id, c]) => [id, c.slider ? c.start ?? c.slider[0]
  : c.start ?? (scene.controls[id] === 'guess' ? null : c.choice[0])])) });

export function formatter(lang) {
  const N = numbers(lang), fmt = n => N.fmt(n);
  // A formula is written once with a writer, which gives its numbers and rules as TeX or as plain text.
  const tex = { n: x => N.tex(x), rule: (r, a) => RULES[r].tex(a) }, text = { n: fmt, rule: (r, a) => RULES[r].text(a) };
  // A measure may be a list of numbers.
  const write = v => Array.isArray(v) ? v.map(fmt).join(', ') : fmt(v);
  // A link shows a measure, a slider's value, the label of a chosen rule, or a challenge's number to reach. It shows
  // null for anything else.
  const value = (scene, spec, values, id) => scene.measures[id] ? write(scene.measures[id](values, spec))
    : spec.controls[id]?.slider ? fmt(values[id]) : spec.controls[id]?.choice ? RULES[values[id]]?.label ?? '?'
    : id === 'target' && typeof values.target === 'number' ? fmt(values.target) : null;
  const worked = (scene, values, id) => aligned(scene.formulas[id](values, tex));
  // written gives the formula on one line of plain text, as a page's text writes it.
  const written = (scene, values, id) => scene.formulas[id](values, text).join(' ');
  return { fmt, value, worked, written };
}
