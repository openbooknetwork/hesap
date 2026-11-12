// How a measure and a worked formula are written in a language. The browser writes the live values with it, and the
// build writes the starting values to check what a page's text types.
import { measure, FORMULAS } from './measures.js';
import { numbers } from '../../kit/format.js';

const WORDS = { en: { yes: 'yes', no: 'no', none: 'none' }, tr: { yes: 'evet', no: 'hayır', none: 'yok' } };

export function formatter(lang) {
  const N = numbers(lang), fmt = n => N.fmt(n), w = WORDS[lang] ?? WORDS.en;
  // A link shows a measure's value, or ? while the measure has none. A vertex gives null, so its words stay as written.
  const value = (s, id) => {
    const m = measure(id, s.order);
    if (!m) return null;
    const v = m.value(s);
    if (v === null) return '?';
    if (m.kind === 'truth') return v ? w.yes : w.no;
    if (m.kind === 'path') return v.length ? v.join(' → ') : w.none;
    if (m.kind === 'name') return v;
    return v === Infinity ? '∞' : fmt(v);
  };
  // Each step stands on a line of its own at the left, so a long first line pushes nothing out of sight.
  const worked = (s, id) => `\\begin{aligned} &${FORMULAS[id](s, N).map(([tex]) => tex).join(' \\\\[0.4em] &')} \\end{aligned}`;
  // written gives the formula on one line of plain text, as a page's text writes it, and null while it has a gap.
  const written = (s, id) => { const steps = FORMULAS[id](s, N).map(([, words]) => words); return steps.some(t => t.includes('?')) ? null : steps.join(' '); };
  return { value, worked, written, fmt };
}
