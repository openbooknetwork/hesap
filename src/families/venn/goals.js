// The goals a challenge page can name. A goal turns one target of page.yaml into conditions, each a measure and the
// value it must have, and the reader reaches the target when every condition holds.
import { evaluate } from './measures.js';

// the regions inside the circles, each as the sets it lies in, one set's regions first, and the id of the measure
// that counts one
const inside = names => Array.from({ length: 2 ** names.length - 1 }, (_, i) => names.filter((_, k) => (i + 1) >> k & 1)).sort((a, b) => a.length - b.length);
const counting = (zone, names) => `count-${names.map(n => zone.includes(n) ? n : `not-${n}`).join('-and-')}`;

export const GOALS = {
  // every measure the target names has the value it gives, as { intersection: [2, 4], count-A: 3, A-in-B: true }
  match: { scenes: ['venn'], conditions: target => Object.entries(target).map(([id, want]) => ({ id, want })) },
  // every region inside the circles holds the same number of elements, as { each: 1 }
  regions: { scenes: ['venn'], conditions: ({ each }, names) => inside(names).map(zone => ({ id: counting(zone, names), want: each, zone })) },
};

// whether a measure has the value a condition wants: the same elements in any order, the same count or truth
export function holds(m, want, member, elements) {
  const v = evaluate(m, member, elements);
  return Array.isArray(v) ? v.length === want.length && want.every(e => v.includes(e)) : v === want;
}

// the elements a condition is about, which move when the reader reaches the goal
export function about(m, member, elements) {
  if (m.kind === 'member') return [m.element];
  return elements.filter(e => m.kind === 'subset' ? member[e].includes(m.sub) : m.test(member[e]));
}
