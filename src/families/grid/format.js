// How a value and a worked formula are written in a language. The browser writes the live values with it, and the
// build writes the starting values to check the numbers typed in a page's text.
import GOALS from './goals.js';
import { numbers, aligned } from '../../kit/format.js';

// The values a page opens with are each control's start, the width of the grid and what a challenge's first target
// sets.
export function starts(spec) {
  const v = {};
  for (const [id, c] of Object.entries(spec.controls)) v[id] = c.slider ? c.start ?? c.slider[0] : c.tap === 'none' ? null : Array.isArray(c.tap) ? [...c.tap] : c.tap;
  if (spec.columns != null) v.columns = typeof spec.columns === 'number' ? spec.columns : spec.columns.start ?? spec.columns.slider[0];
  if (spec.challenge) Object.assign(v, GOALS[spec.challenge.goal].sets?.(spec.challenge.targets[0]));
  return v;
}

export function formatter(lang) {
  const N = numbers(lang), fmt = n => N.fmt(n, 0);
  // A value is a number or a list of numbers, and a dash stands for a value the reader has not chosen yet.
  const say = v => v == null ? '–' : Array.isArray(v) ? v.map(fmt).join(', ') : typeof v === 'number' ? fmt(v) : String(v);
  // A link shows the value of a measure or a control, and null stands for a link to anything else.
  const value = (scene, spec, values, id) => scene.measures[id] ? say(scene.measures[id](values, spec))
    : id in spec.controls || (id === 'columns' && spec.columns != null) ? say(values[id]) : null;
  const steps = (scene, spec, values, id) => scene.formulas[id](values, spec);
  // Each step of a formula is a pair of its TeX and its plain words, which the page's text types on one line.
  const worked = (scene, spec, values, id) => aligned(steps(scene, spec, values, id).map(s => s[0]), '0.3em');
  const written = (scene, spec, values, id) => steps(scene, spec, values, id).map(s => s[1]).join(' ');
  return { fmt, say, value, worked, written };
}
