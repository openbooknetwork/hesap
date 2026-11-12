// Shared by the geo and axes families. How a number, a measure and a worked formula are written in a language. The
// browser writes the live values with it, and the build writes the starting values to check a page's text.
import { aligned, numbers } from '../../../kit/format.js';

// starts gives each control its starting value: a slider's start, or a point's place.
export const starts = controls => Object.fromEntries(Object.entries(controls).map(([id, c]) => [id, c.slider ? c.start ?? c.slider[0] : [...c.point]]));

export function formatter(lang) {
  const N = numbers(lang);
  // Lengths and areas take two decimals, and angles one.
  const fmt = (n, digits = 2) => N.fmt(n, digits);
  const say = (id, n) => id.startsWith('angle') ? `${fmt(n, 1)}°` : fmt(n);
  // coords writes a point. Its numbers are split by a semicolon where the language writes decimals with a comma.
  const coords = ns => `(${ns.map(n => fmt(n)).join(N.comma ? '; ' : ', ')})`;
  // A formula writes a number in TeX with n, and picks = or ≈ for it with rel.
  const tex = { n: (x, digits = 2) => N.tex(x, digits), rel: (x, digits = 2) => Math.abs(x - Number(x.toFixed(digits))) < 1e-9 ? '=' : '\\approx' };
  // A measure may be a name, such as a quadrant's.
  const text = (id, v) => typeof v === 'string' ? v : say(id, v);
  // value gives what a link to a measure, a slider or a challenge's target (goal-<measure>) shows, and null otherwise.
  const value = (fig, controls, values, id, target) => fig.measures[id] ? text(id, fig.measures[id](values)) : controls[id]?.slider ? say(id, values[id])
    : id.startsWith('goal-') && target?.[id.slice(5)] != null ? say(id.slice(5), target[id.slice(5)]) : null;
  // A formula the figure does not have gives null.
  const steps = (fig, values, id) => fig.formulas[id]?.(values, tex) ?? null;
  const worked = (fig, values, id) => { const s = steps(fig, values, id); return s && aligned(s); };
  // The formula on one line of plain text, as a page's text writes it.
  const written = (fig, values, id) => { const s = steps(fig, values, id); return s && s.map(plain).join(' '); };
  return { fmt, say, coords, value, worked, written };
}

// plain writes the TeX the figures use as plain text, with the real minus sign the readouts use.
const SUPER = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const plain = tex => tex
  .replace(/\\tfrac\{1\}\{2\}/g, '½').replace(/\\tfrac\{1\}\{3\}/g, '⅓').replace(/\\tfrac\{4\}\{3\}/g, '4/3').replace(/\\sqrt\{([^{}]*)\}/g, (_, a) => / /.test(a) ? `√(${a})` : `√${a}`).replace(/\\Delta /g, 'Δ')
  .replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, a, b) => `${/[ ]/.test(a) ? `(${a})` : a} / ${/[ ]/.test(b) ? `(${b})` : b}`)
  .replace(/\^\\circ/g, '°').replace(/\^(\d)/g, (_, d) => SUPER[d])
  .replace(/_\{([^}]*)\}/g, '($1)').replace(/_(\w)/g, '($1)')
  .replace(/\\times/g, '×').replace(/\\approx/g, '≈').replace(/\\pi/g, 'π').replace(/\\theta/g, 'θ').replace(/\\rho/g, 'ρ').replace(/\\varphi/g, 'φ').replace(/\\alpha/g, 'α').replace(/\\(tan|cos|sin)/g, '$1')
  .replace(/\{,\}/g, ',').replace(/(\d|\)) π/g, '$1π').replace(/π r/g, 'πr').replace(/ - /g, ' − ').replace(/-(?=\d)/g, '−').replace(/\s+/g, ' ').trim();
