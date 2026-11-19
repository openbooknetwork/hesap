// What a counters/bar page holds: a bar model whose whole is split into two parts, with the written line or the facts
// of its family under it. The build and the browser both use this file, so a page's text and its live values agree.
import { PLUS, FACTS, FACT_IDS, factLine, finding } from '../../kit/written.js';

// bar is the plain bar model, and chocolate a bar of chocolate with a square for each 1.
export const BAR_LOOKS = ['bar', 'chocolate'];
// The whole of a bar runs from 2 to 20, and a dragged end reaches this far.
export const WHOLE = [2, 20];
// The handles a page lets the reader drag, and the numbers a card can cover.
export const HANDLES = ['split', 'end'];
export const NUMBERS = ['whole', 'first', 'second'];

export const family = spec => spec.written === 'family';
// opening gives the bar as the page opens. cover is the number under the card, and found the number the written line
// finds, which it keeps once the card is lifted. A page with ask opens with that number covered.
export const opening = spec => ({ whole: spec.whole, first: spec.first, cover: spec.ask ?? null, found: spec.ask ?? null });

// counts gives every number of the bar: the whole, the first part and the second part, the whole minus the first.
export const counts = (spec, s) => ({ whole: s.whole, first: s.first, second: s.whole - s.first });

// lineOf gives the written line: first + second = whole until a number is covered, then the calculation that finds
// the covered number, open while the card is on.
export const lineOf = (spec, s) => s.found ? finding(s.first, s.whole - s.first, s.found, s.cover != null) : { a: s.first, sign: PLUS, b: s.whole - s.first };
// The lines a link reads, by its id: the written line and its words, and the facts of a family page.
const fact = id => (spec, s) => factLine(id, s.first, s.whole - s.first);
export const LINES = { written: (spec, s) => family(spec) ? fact('written')(spec, s) : lineOf(spec, s), reading: (spec, s) => family(spec) ? fact('reading')(spec, s) : lineOf(spec, s),
  ...Object.fromEntries(FACT_IDS.filter(id => !['written', 'reading'].includes(id)).map(id => [id, fact(id)])) };

// The measures a page can link in its text. The facts take no readout, since the figure writes them.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  return [...NUMBERS, ...(family(spec) ? FACT_IDS : spec.written ? ['written', 'reading'] : [])];
}
export const readable = spec => measuresOf(spec).filter(id => !family(spec) || !FACT_IDS.includes(id));
// labelKeys gives the strings that may name a readout or a handle: the chocolate's own first, then the bar's.
export const labelKeys = (spec, id) => [...(spec.look === 'chocolate' ? [`bar-chocolate-${id}`] : []), `bar-${id}`];
// The facts a family page writes, all four when it lists none.
export const factsListed = spec => spec.facts ?? FACTS;
