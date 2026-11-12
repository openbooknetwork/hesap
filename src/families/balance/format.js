// This file writes a side, an equation and a link's value in a language. The browser writes the live values with it,
// and the build writes the starting values to check what a page's text types.
import { equation, solve, alone, weight, level, value } from './algebra.js';
import { numbers } from '../../kit/format.js';

const WORDS = { en: { level: 'level', l: 'down on the left', r: 'down on the right' }, tr: { level: 'dengede', l: 'solda aşağıda', r: 'sağda aşağıda' } };
export const MEASURES = ['left', 'right', 'equation', 'steps', 'solution', 'scale'];

// A page opens with its equation, no steps yet, and what the box weighs, which is the one x that keeps the scale
// level.
export const starts = spec => { const eq = equation(spec); return { eq, steps: 0, x: value(solve(eq)) }; };

export function formatter(lang) {
  const W = WORDS[lang] ?? WORDS.en, N = numbers(lang), fmt = n => N.fmt(n);
  // size and xs write a number's size and a count of x as text
  const size = a => (a.d === 1 ? fmt(Math.abs(a.n)) : `${fmt(Math.abs(a.n))}/${fmt(a.d)}`);
  const xs = a => (Math.abs(a.n) === a.d ? 'x' : a.d === 1 ? `${fmt(Math.abs(a.n))}x` : `${Math.abs(a.n) === 1 ? '' : fmt(Math.abs(a.n))}x/${fmt(a.d)}`);
  const say = a => `${a.n < 0 ? '−' : ''}${size(a)}`;
  const side = s => {
    const parts = [[s.x, xs], [s.c, size]].filter(([v]) => v.n);
    return parts.length ? parts.map(([v, f], i) => (i ? ` ${v.n < 0 ? '−' : '+'} ` : v.n < 0 ? '−' : '') + f(v)).join('') : fmt(0);
  };
  // value_ says what a link shows for the state { eq, steps, x }, and it gives null for a link to anything else
  function value_(st, id) {
    const { eq, x } = st, d = weight(eq.l, x) - weight(eq.r, x), found = alone(eq);
    switch (id) {
      case 'left': return side(eq.l);
      case 'right': return side(eq.r);
      case 'equation': return `${side(eq.l)} ${level(eq, x) ? '=' : '≠'} ${side(eq.r)}`;
      case 'steps': return fmt(st.steps);
      case 'solution': return found && level(eq, x) ? say(found) : '?';
      case 'scale': return Math.abs(d) < 1e-9 ? W.level : d > 0 ? W.l : W.r;
      default: return null;
    }
  }
  return { value: value_, side, say, size, xs };
}
