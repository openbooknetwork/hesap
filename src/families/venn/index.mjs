// The Node half of the venn family: one diagram of up to three sets whose elements the reader drags. It reads the
// fields of a page and checks them against the measures the page can name.
import { schema } from '@openbooknetwork/kitap';
import { measure, formulas } from './measures.js';
import { formatter, starts } from './format.js';
import { GOALS, holds } from './goals.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z, check } = schema;
const twice = ids => ids.find((id, i) => ids.indexOf(id) < i);
const MEASURES = 'a set (A, not-A, A-and-B, A-or-B, A-minus-B, union, intersection, universe), count-<set>, A-in-B or <element>-in-A';

// an element is a word, a letter or a number, kept as text
const Element = z.union([z.string(), z.number()]).transform(String);
// what a condition of a challenge wants: the elements of a set, a count, or whether a statement holds
const Want = z.union([z.array(Element), z.number(), z.boolean()]);
// the fields of a target, for each goal in goals.js
const TARGET = { match: z.record(z.string(), Want), regions: z.object({ each: z.number().int().min(1) }).strict() };
const Fields = z.object({
  sets: z.record(z.string(), z.object({ has: z.array(Element).default([]) }).strict()), // each set and the elements it opens with
  elements: z.array(Element).min(1), // every element of the universe
  readout: z.array(z.string()).default([]),
  challenge: z.object({ goal: z.string(), targets: z.array(z.record(z.string(), Want)).min(1) }).strict().optional(), // a goal of goals.js and its targets, which "Another one" steps through
}).strict();

function read(pg, { at }, ctx) {
  const names = Object.keys(pg.sets);
  if (names.length < 1 || names.length > 3) ctx.fail(at, `sets names ${names.length} sets, a diagram draws one, two or three`);
  for (const n of names) if (!/^[A-Z]$/.test(n)) ctx.fail(at, `sets names "${n}", name a set with one capital letter`);
  if (twice(pg.elements)) ctx.fail(at, `elements lists "${twice(pg.elements)}" twice, list each element once`);
  for (const n of names) {
    const has = pg.sets[n].has, stray = has.find(e => !pg.elements.includes(e));
    if (stray) ctx.fail(at, `sets.${n}.has names "${stray}", the elements are ${list(pg.elements)}`);
    if (twice(has)) ctx.fail(at, `sets.${n}.has lists "${twice(has)}" twice, a set holds each element once`);
  }
  for (const id of pg.readout) if (!measure(id, names, pg.elements)) ctx.fail(at, `readout names "${id}", write ${MEASURES}`);
  if (pg.challenge) readChallenge(pg, names, at, ctx);
  // a text links an element or a measure by its id, and a worked formula as formula-<id>
  const worked = Object.keys(formulas(names)).map(f => `formula-${f}`);
  return {
    data: pg,
    has: id => pg.elements.includes(id) || worked.includes(id) || !!measure(id, names, pg.elements),
    offers: `an element, ${MEASURES}${worked.length ? `, or ${list(worked)}` : ''}`,
  };
}

// A challenge's goal is one of GOALS, and each target is a set of conditions the reader can meet and has not met
// when the page opens.
function readChallenge(pg, names, at, ctx) {
  const goal = challenge(pg.challenge, GOALS, { scene: pg.scene, at, ctx });
  if (!goal) return;
  const fail = msg => ctx.fail(at, msg), asked = new Set();
  pg.challenge.targets = pg.challenge.targets.map((t, i) => check(TARGET[pg.challenge.goal], t, `${at} challenge.targets[${i}]`));
  for (const [i, t] of pg.challenge.targets.entries()) {
    const where = `challenge.targets[${i}]`, conds = goal.conditions(t, names).map(c => ({ ...c, m: measure(c.id, names, pg.elements) }));
    for (const { id, want, m } of conds) {
      asked.add(id);
      if (!m) { fail(`${where} names "${id}", write ${MEASURES}`); continue; }
      const kind = { set: ['a list of elements, such as [2, 4]', Array.isArray(want)], count: ['a whole number', Number.isInteger(want)] }[m.kind] ?? ['true or false', typeof want === 'boolean'];
      if (!kind[1]) fail(`${where} gives ${id} the value ${JSON.stringify(want)}, ${m.label} takes ${kind[0]}`);
      const stray = m.kind === 'set' && Array.isArray(want) && want.find(e => !pg.elements.includes(e));
      if (stray) fail(`${where} gives ${id} the element "${stray}", the elements are ${list(pg.elements)}`);
    }
    if (conds.some(c => !c.m)) continue;
    if (conds.every(c => holds(c.m, c.want, starts(pg), pg.elements))) fail(`${where} holds when the page opens, start the sets so that one of its conditions fails`);
    if (reachable(conds, names, pg.elements) === false) fail(`${where} asks for ${conds.map(c => c.id).join(', ')} at once, and no way of placing the elements meets them all`);
  }
  hidden(pg.readout, [...asked], at, ctx);
}

// Whether some placing of the elements meets every condition, null when there are too many to try. Only the elements
// a condition names differ, so the others are alike and only how many stand in each region matters.
function reachable(conds, names, elements) {
  const zones = Array.from({ length: 2 ** names.length }, (_, bits) => names.filter((_, i) => bits >> i & 1)), Z = zones.length;
  const named = elements.filter(e => conds.some(c => c.m.element === e || (c.m.kind === 'set' && c.want.includes(e)))), rest = elements.filter(e => !named.includes(e));
  let ways = Z ** named.length;
  for (let k = 1; k < Z; k++) ways = ways * (rest.length + k) / k;
  if (ways > 2e6) return null;
  const member = {}, meets = () => conds.every(c => holds(c.m, c.want, member, elements));
  // the alike elements from rest[j] on go to the regions from zones[z] on, any number to each
  const share = (j, z) => {
    if (z === Z - 1) { for (const e of rest.slice(j)) member[e] = zones[z]; return meets(); }
    for (let k = j; k <= rest.length; k++) { for (const e of rest.slice(j, k)) member[e] = zones[z]; if (share(k, z + 1)) return true; }
    return false;
  };
  const place = i => i === named.length ? share(0, 0) : zones.some(z => { member[named[i]] = z; return place(i + 1); });
  return place(0);
}

// A link to an element or a measure shows its starting value, and a link to a formula the formula worked for the
// starting sets.
function start(spec, lang, id) {
  if (!spec.elements) return null;
  const f = formatter(lang), member = starts(spec);
  return id.startsWith('formula-') ? f.written(spec, member, id.slice(8)) : f.value(spec, member, id);
}

export default { id: 'venn', scenes: ['venn'], schema: Fields, read, start };
