// How a count, a share, a chance and a worked formula are written in a language. The browser writes the live values
// with it, and the build writes the starting values to check what a page's text types.
import { MODELS } from './models.js';
import { numbers } from '../../kit/format.js';

const WORDS = { en: { expected: 'expected', spread: 'spread' }, tr: { expected: 'beklenen', spread: 'yayılım' } };

export function formatter(lang) {
  // int writes a count, fix a number with exactly d decimals and fmt one with up to d decimals.
  const { int, fix, fmt } = numbers(lang);
  const f = {
    int, fix, fmt,
    word: w => (WORDS[lang] ?? WORDS.en)[w],
    // tex takes a number as int, fix or fmt wrote it. TeX reads a bare comma as punctuation and spaces it, and reads a
    // comma in braces as part of the number.
    tex: s => s.replace(/,/g, '{,}'),
  };
  // write gives a measure's value as the readouts and the text show it, and a dash until there is something to measure.
  f.write = (m, st) => {
    const v = m.of(st);
    if (v === null) return '–';
    if (m.kind === 'share') return f.fix(v, 3);
    if (m.kind === 'chance') return `${f.int(v[0])}/${f.int(v[1])}`;
    if (m.kind === 'number') return m.trim ? f.fmt(v, m.digits) : f.fix(v, m.digits);
    return f.int(v);
  };
  // value gives what a link shows, which is a measure's value, or null for a link to anything else.
  f.value = (spec, st, id) => { const m = MODELS[spec.scene].measures(spec)[id]; return m ? f.write(m, st) : null; };
  const steps = (spec, st, id) => MODELS[spec.scene].formulas[id](st, f, spec);
  f.worked = (spec, st, id) => steps(spec, st, id).map(s => s[0]).join(' ');
  // written gives the formula on one line of plain text, as a page's text writes it.
  f.written = (spec, st, id) => steps(spec, st, id).map(s => s[1]).join(' ');
  return f;
}
