// The Node half of the bar scene: a bar model whose whole is split into two parts drawn to scale, with the written
// line or the facts of its family under it. It checks a page's fields and says what each link shows when the page
// opens.
import { schema } from '@openbooknetwork/kitap';
import { BAR_LOOKS, WHOLE, HANDLES, NUMBERS, opening, LINES, counts, measuresOf, readable, family } from './bar-model.js';
import { BAR_GOALS, barStart } from './bar-goals.js';
import { words, reading, FACTS } from '../../kit/written.js';
import { numbers } from '../../kit/format.js';
import { list, string, challenge, drawn } from '../../node.mjs';

const { z, check } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Fields = z.object({
  look: z.enum(BAR_LOOKS).default('bar'), // The plain bar model, or a bar of chocolate with a square for each 1.
  whole: Int.optional(), // The whole as the page opens, the length of the bar.
  first: Int.optional(), // The first part as the page opens. The second part is the whole minus the first.
  drag: z.array(z.enum(HANDLES)).default([]), // The handles the reader drags: the split and the end of the bar.
  end: Range.optional(), // The places the end runs over, from 2 to 20 when left out.
  counters: z.boolean().default(false), // A row of counters over the bar, one over each 1 of its length.
  // The written line under the bar, or with family the four facts of the family.
  written: z.union([z.literal(true), z.literal('family')]).optional(),
  facts: z.array(z.enum(FACTS)).optional(), // The facts a family page writes, all four when left out.
  ask: z.enum(NUMBERS).optional(), // The number a card covers as the page opens.
  cover: z.boolean().default(false), // A tap on a number of the bar covers it with a card, and a tap on the card lifts it.
  readout: z.array(z.string()).default([]),
  // A challenge names a goal of bar-goals.js and the range it draws its target from.
  challenge: z.object({ goal: z.string(), whole: Range.optional(), numbers: Range.optional() }).strict().optional(),
}).strict();

function read(fields, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words);
  const spec = { ...pg, scene: 'bar' };
  if (pg.challenge) { readChallenge(pg, spec, at, ctx); return { data: spec, has: () => false, offers: 'nothing, a challenge page draws its numbers as it opens' }; }
  if (pg.whole == null || pg.whole < WHOLE[0] || pg.whole > WHOLE[1]) fail(`whole is ${pg.whole ?? 'missing'}, write the whole as a number from ${WHOLE[0]} to ${WHOLE[1]}, such as 8`);
  else if (pg.first == null || pg.first < 1 || pg.first >= pg.whole) fail(`first is ${pg.first ?? 'missing'}, write the first part as a number from 1 to ${pg.whole - 1}, below the whole`);
  if (new Set(pg.drag).size < pg.drag.length) fail(`drag lists ${list(pg.drag)}, write each handle once`);
  if (pg.end) {
    const [lo, hi] = pg.end;
    if (!pg.drag.includes('end')) fail('end sets the places a dragged end runs over, write drag: [end] as well');
    if (lo > hi || lo < WHOLE[0] || hi > WHOLE[1] || (pg.whole != null && (pg.whole < lo || pg.whole > hi))) fail(`end is [${lo}, ${hi}], write [low, high] from ${WHOLE[0]} to ${WHOLE[1]} with the whole ${pg.whole ?? ''} between them`);
  }
  if (pg.look === 'chocolate') {
    if (pg.drag.includes('end')) fail('drag lists end, a bar of chocolate keeps its squares, write drag: [split]');
    if (pg.counters) fail('counters belongs to look: bar, the chocolate shows its squares');
  }
  if ((pg.ask || pg.cover) && family(pg)) fail('ask and cover write the calculation that finds a number, write written: true or leave written out');
  if (pg.ask && !pg.cover) fail('ask opens with a card on a number, write cover: true so the reader can lift it');
  if (pg.facts && !family(pg)) fail('facts goes with written: family, write written: family or leave facts out');
  if (pg.facts && (!pg.facts.length || new Set(pg.facts).size < pg.facts.length)) fail(`facts lists ${list(pg.facts) || 'nothing'}, write each fact once, out of ${list(FACTS)}`);
  const ids = readable(spec);
  for (const id of pg.readout) if (!ids.includes(id)) fail(`readout names "${id}", this page reads out ${list(ids)}`);
  const linked = measuresOf(spec);
  return { data: spec, has: id => linked.includes(id), offers: `one of ${list(linked)}` };
}

// A challenge page names its goal and the range it draws from, and may write the facts once the goal holds. The goal
// sets the bar and both handles, so the page leaves every other field out.
function readChallenge(pg, spec, at, ctx) {
  const c = pg.challenge, goal = challenge(c, BAR_GOALS, { scene: 'bar', at, ctx });
  if (!goal) return;
  for (const [f, v] of Object.entries(pg)) if (!['challenge', 'look', 'written'].includes(f) && v !== undefined && v !== false && !(Array.isArray(v) && !v.length)) ctx.fail(at, `${f} is set by challenge.goal ${c.goal}, leave it out`);
  if (pg.look !== 'bar') ctx.fail(at, `look is set by challenge.goal ${c.goal}, leave it out`);
  if (pg.written === true) ctx.fail(at, `written: true writes one line, a challenge writes the facts, write written: family or leave it out`);
  const problem = goal.problem(c);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  // The page must not open solved, so the opening bar is checked as if the reader pressed Check at once.
  drawn(goal, c, spec, { at, ctx, starts: (sp, t) => ({ ...barStart(t), checked: true }) });
}

// A link shows a number of the bar, a written line or its words as the page opens.
function start(spec, lang, id) {
  if (!measuresOf(spec).includes(id)) return null;
  const s = opening(spec), int = numbers(lang).int;
  if (id in LINES) { const line = LINES[id](spec, s); return id.startsWith('written') ? words(line, int) : reading(line, int, (key, vars) => string(lang, `hesap_${key}`, vars)); }
  return int(counts(spec, s)[id]);
}

export default { read, start };
