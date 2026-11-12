// A measure's id is a short sentence about the sets: A-and-B, A-or-B, A-minus-B, not-A, union, intersection, universe,
// count-<set>, A-in-B for a subset and <element>-in-A for an element. This file is the only place that reads them.
import { show } from './elements.js';

const OPS = { and: ['∩', (a, b) => a && b], or: ['∪', (a, b) => a || b], minus: ['∖', (a, b) => a && !b] };

// A set written with the words above: its label, and the test that says whether a region belongs to it, given the
// sets the region lies in.
function expression(words, names) {
  const term = () => {
    const w = words.shift(), n = w === 'not' ? words.shift() : w;
    if (!names.includes(n)) return null;
    return w === 'not' ? { label: `${n}′`, test: m => !m.includes(n) } : { label: n, test: m => m.includes(n) };
  };
  let left = term(), last = null;
  while (left && words.length) {
    const op = OPS[words.shift()], right = term(), a = left;
    if (!op || !right) return null;
    const [sign, join] = op;
    left = { label: `${last && last !== sign ? `(${a.label})` : a.label} ${sign} ${right.label}`, test: m => join(a.test(m), right.test(m)) };
    last = sign;
  }
  return left;
}

// the measure an id names, null when the id says nothing about these sets and elements
export function measure(id, names, elements) {
  const words = String(id).split('-'), set = e => e && { kind: 'set', ...e };
  if (id === 'universe') return { kind: 'set', label: 'U', test: () => true };
  if (id === 'union' || id === 'intersection') return set(expression(names.flatMap((n, i) => i ? [id === 'union' ? 'or' : 'and', n] : [n]), names));
  if (words[0] === 'count') { const of = measure(words.slice(1).join('-'), names, elements); return of?.kind === 'set' ? { kind: 'count', label: `|${of.label}|`, test: of.test } : null; }
  const at = words.indexOf('in');
  if (at > 0) {
    const left = words.slice(0, at).join('-'), right = words.slice(at + 1).join('-');
    if (!names.includes(right)) return null;
    if (names.includes(left)) return { kind: 'subset', label: `${left} ⊆ ${right}`, sub: left, of: right, test: m => m.includes(left) };
    return elements.includes(left) ? { kind: 'member', label: `${show(left)} ∈ ${right}`, element: left, of: right, test: m => m.includes(right) } : null;
  }
  return set(expression(words, names));
}

// A measure's value: the elements of a set in the page's order, how many they are, or whether a statement holds.
// member holds, for each element, the sets it is in.
export function evaluate(m, member, elements) {
  if (m.kind === 'subset') return elements.every(e => !member[e].includes(m.sub) || member[e].includes(m.of));
  if (m.kind === 'member') return member[m.element].includes(m.of);
  const inside = elements.filter(e => m.test(member[e]));
  return m.kind === 'count' ? inside.length : inside;
}

// the worked formulas a page can link, as steps that are each a pair of TeX and plain text. Two sets have one for the
// size of their union.
export function formulas(names) {
  if (names.length !== 2) return {};
  const [a, b] = names;
  return { 'count-union': count => [[`|${a} \\cup ${b}|`, `|${a} ∪ ${b}|`], [`= |${a}| + |${b}| - |${a} \\cap ${b}|`, `= |${a}| + |${b}| − |${a} ∩ ${b}|`],
    ...[`= ${count(a)} + ${count(b)} - ${count('intersection')}`, `= ${count('union')}`].map(s => [s, s.replace(' - ', ' − ')])] };
}
