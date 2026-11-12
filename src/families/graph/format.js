// This file writes a number, a measure and a worked formula in a language. The browser writes the live values with
// it, and the build writes the starting values to check the numbers typed in a page's text.
import { bind } from './rules.js';
import GOALS from './goals.js';
import { aligned, numbers } from '../../kit/format.js';

const rules = spec => [spec.rule].flat();
// The values a page opens with are the first of its rules, its first target and each slider's start.
export const starts = (spec, target = 0) => ({ rule: rules(spec)[0], target, ...Object.fromEntries(Object.entries(spec.controls).map(([id, c]) => [id, c.start ?? c.slider[0]])) });
// A challenge's target is the one the values point at. A page without targets has one empty target.
export const target = (spec, values) => spec.challenge?.targets?.[values.target] ?? {};
// The rule the values pick takes the page's coefficients, then the target's, then the sliders'.
export const ruled = (spec, values) => bind(values.rule, spec.coefficients, target(spec, values).coefficients ?? {}, values);
// A measure is the scene's own, or one the challenge's goal adds.
export function measured(scene, spec, id) {
  const goal = GOALS[spec.challenge?.goal], m = goal?.measures?.[id];
  return scene.measures[id] ?? (m && ((v, R, s) => m(v, R, s, target(s, v))));
}
// reached says whether the values reach the challenge's goal
export const reached = (spec, values) => { const c = spec.challenge, goal = GOALS[c.goal];
  return goal.holds(values, ruled(spec, values), spec, target(spec, values), c.tolerance ?? goal.tolerance); };

// A worked formula is written twice from the same steps: in TeX for the page, and in plain text, which is what the
// check asks a text to type. A writer holds the parts that differ between the two.
const SUPER = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const wrap = s => / /.test(s) ? `(${s})` : s;
function writers(N) {
  const tex = { n: x => N.tex(x), minus: '-', times: '\\times', sin: '\\sin', approx: '\\approx', pow: (X, p) => `${X}^${p}`,
    word: s => `\\text{${s}}`, frac: (a, b) => `\\frac{${a}}{${b}}` };
  const text = { n: x => N.fmt(x), minus: '−', times: '×', sin: 'sin', approx: '≈', pow: (X, p) => `${X}${String(p).replace(/\d/g, d => SUPER[d])}`,
    word: s => s, frac: (a, b) => `${wrap(a)} / ${wrap(b)}` };
  // x writes a number in x's place, in brackets when it is negative, and rel writes = or ≈ before a result.
  for (const w of [tex, text]) Object.assign(w, {
    x: x => N.fmt(x).startsWith('−') ? `(${w.n(x)})` : w.n(x),
    rel: x => Math.abs(x - Number(x.toFixed(2))) < 1e-9 ? '=' : w.approx,
  });
  return { tex, text };
}

export function formatter(lang) {
  const N = numbers(lang), fmt = x => N.fmt(x);
  const say = v => v == null ? null : Array.isArray(v) ? N.pair(v[0], v[1]) : typeof v === 'number' ? fmt(v) : v;
  const { tex, text } = writers(N);
  // value gives what a link to a measure or a slider shows, or null for a link to anything else or a value with none
  const value = (scene, spec, values, id) => { const m = measured(scene, spec, id); return m ? say(m(values, ruled(spec, values), spec)) : spec.controls[id] ? fmt(values[id]) : null; };
  const steps = (scene, spec, values, id, w) => scene.formulas[id](values, ruled(spec, values), w, spec);
  const worked = (scene, spec, values, id) => aligned(steps(scene, spec, values, id, tex));
  // written gives the formula on one line of plain text, as a page's text writes it
  const written = (scene, spec, values, id) => steps(scene, spec, values, id, text).join(' ');
  return { fmt, pair: N.pair, say, value, worked, written, tex };
}
