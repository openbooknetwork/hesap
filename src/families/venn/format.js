// How a set, a count, a statement and a worked formula are written in a language. The browser writes the live values
// with it, and the build writes the starting values to check what a page's text types.
import { measure, evaluate, formulas } from './measures.js';
import { show } from './elements.js';
import { numbers, aligned } from '../../kit/format.js';

const WORDS = { en: ['true', 'false'], tr: ['doğru', 'yanlış'] };

// the sets each element is in when the page opens
export const starts = spec => Object.fromEntries(spec.elements.map(e => [e, Object.keys(spec.sets).filter(n => spec.sets[n].has.includes(e))]));

export function formatter(lang) {
  const fmt = numbers(lang).int, [yes, no] = WORDS[lang] ?? WORDS.en;
  const names = spec => Object.keys(spec.sets), set = v => v.length ? `{${v.map(show).join(', ')}}` : '∅';
  // what a link shows: an element as it is drawn, a measure's value, null for a link to anything else
  const value = (spec, member, id) => {
    if (spec.elements.includes(id)) return show(id);
    const m = measure(id, names(spec), spec.elements);
    if (!m) return null;
    const v = evaluate(m, member, spec.elements);
    return m.kind === 'set' ? set(v) : m.kind === 'count' ? fmt(v) : v ? yes : no;
  };
  // a condition of a challenge as the panel writes it: A ∩ B = {2, 4}, |A| = 3, A ⊈ B or 🍋 ∈ A
  const goal = (spec, id, want) => {
    const m = measure(id, names(spec), spec.elements);
    if (m.kind === 'set') return `${m.label} = ${set(spec.elements.filter(e => want.includes(e)))}`;
    if (m.kind === 'count') return `${m.label} = ${fmt(want)}`;
    return m.kind === 'subset' ? `${m.sub} ${want ? '⊆' : '⊈'} ${m.of}` : `${show(m.element)} ${want ? '∈' : '∉'} ${m.of}`;
  };
  const steps = (spec, member, id) => formulas(names(spec))[id]?.(set => fmt(evaluate(measure(`count-${set}`, names(spec), spec.elements), member, spec.elements)));
  const worked = (spec, member, id) => { const s = steps(spec, member, id); return s ? aligned(s.map(p => p[0])) : null; };
  // the formula on one line of plain text, as a page's text writes it
  const written = (spec, member, id) => steps(spec, member, id)?.map(p => p[1]).join(' ') ?? null;
  return { value, goal, worked, written };
}
