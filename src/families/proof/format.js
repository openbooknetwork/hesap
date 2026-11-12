// How a value and a worked formula are written in a language. The browser writes the live values with it, and the
// build writes the starting values to check what a page's text types.
import { aligned, numbers } from '../../kit/format.js';

// A page opens with each slider at its start, and a control written as a value keeps it.
export const starts = controls => Object.fromEntries(Object.entries(controls).map(([id, c]) => [id, c.value ?? c.start ?? c.slider[0]]));

export function formatter(lang) {
  const n = numbers(lang);
  const f = {
    // A number gets two decimals at most, and a word or a fraction stays as it is.
    fmt: (v, digits = 2) => typeof v === 'string' ? v : n.fmt(v, digits),
    tex: v => n.tex(v),
    // rel gives = for a value that two decimals write exactly, and ≈ for one they round, in TeX and in plain text.
    rel: v => Math.abs(v - Number(v.toFixed(2))) < 1e-9 ? ['=', '='] : ['\\approx', '≈'],
  };
  // A link shows a measure's or a slider's value, and a link to anything else gets null.
  f.value = (proof, values, id) => {
    const v = proof.measures[id] ? proof.measures[id](values) : id in values ? values[id] : null;
    return v === null ? null : typeof v === 'string' ? v : f.fmt(v) + (proof.units?.[id] ?? '');
  };
  // A proof writes each step of a formula as a pair of TeX and plain text.
  const steps = (proof, values, id) => proof.formulas[id](values, f);
  f.worked = (proof, values, id) => aligned(steps(proof, values, id).map(s => s[0]));
  // written gives the formula on one line of plain text, as a page's text writes it.
  f.written = (proof, values, id) => steps(proof, values, id).map(s => s[1]).join(' ');
  return f;
}
