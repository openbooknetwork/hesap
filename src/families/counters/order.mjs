// The Node half of the order scene: two numbers compared on one count or as two blocks, and three cards put in
// order. It checks a page's fields and says what each link shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { SHOWS, TOP, CARDS, opening, counts, measuresOf, readingOf, verdictOf } from './order-model.js';
import { SIGNS } from './reading.js';
import { numbers } from '../../kit/format.js';
import { list, value, string } from '../../node.mjs';

const { z, check } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Num = z.union([Int, z.object({ slider: Range, start: Int.optional() }).strict(), z.object({ stepper: Range, start: Int.optional() }).strict()]);
const Fields = z.object({
  show: z.enum(SHOWS).optional(), // Two markers on one count of 100, or two blocks of rows of ten.
  top: Num.optional(), // The red number, as a number or on a slider or a stepper.
  bottom: Num.optional(), // The blue number.
  reading: z.boolean().default(false), // A line of words states the comparison.
  decide: z.boolean().default(false), // A frame surrounds the rows of the blocks that decide.
  cover: z.boolean().default(false), // Covers hide the blocks until the reader asks for the rows.
  sign: z.enum(SIGNS).optional(), // A sign tile between the two numbers of the blocks, opening on this sign.
  cards: z.array(Int).optional(), // Three numbers on cards for the reader to put in order.
  // A New numbers button draws three other cards. A page with draw and no cards opens on a draw too.
  draw: z.boolean().default(false),
  readout: z.array(z.string()).default([]),
}).strict();

function read(fields, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words);
  const top = value(pg.top), bottom = value(pg.bottom);
  const spec = { ...pg, scene: 'order', top: top.n, topCtl: top.ctl, bottom: bottom.n, bottomCtl: bottom.ctl };
  if (pg.cards || pg.draw) {
    if (pg.cards && (pg.cards.length !== CARDS || new Set(pg.cards).size !== CARDS || pg.cards.some(n => n < 0 || n > TOP))) fail(`cards is ${JSON.stringify(pg.cards)}, write ${CARDS} different numbers from 0 to ${TOP}, such as [63, 36, 39]`);
    for (const f of ['top', 'bottom', 'show']) if (pg[f] !== undefined) fail(`${f} belongs to pages with two numbers, leave it out of a page with cards`);
    for (const f of ['reading', 'decide', 'cover', 'sign']) if (pg[f]) fail(`${f} belongs to pages with two numbers, leave it out of a page with cards`);
  } else {
    if (!pg.show) fail(`show is missing, write how the two numbers are drawn: ${list(SHOWS)}, or give the page cards or draw: true`);
    const low = pg.show === 'count' ? 1 : 0;
    for (const [v, name] of [[top, 'top'], [bottom, 'bottom']]) {
      if (v.n == null) { fail(`${name} is missing, write the ${name} number, such as 18, or { slider: [${low}, ${TOP}], start: 18 }`); continue; }
      const lo = v.ctl?.lo ?? v.n, hi = v.ctl?.hi ?? v.n;
      if (lo > hi || v.n < lo || v.n > hi) fail(`${name} has the range [${lo}, ${hi}] and starts at ${v.n}, write [low, high] and a start between them`);
      else if (lo < low || hi > TOP) fail(`${name} reaches ${v.ctl ? `[${lo}, ${hi}]` : v.n}, ${pg.show === 'count' ? 'a marker stands on a counter' : 'a block holds a number'} from ${low} to ${TOP}`);
    }
    for (const f of ['decide', 'cover']) if (pg[f] && pg.show !== 'blocks') fail(`${f} belongs to the rows of two blocks, write show: blocks`);
    if (pg.sign && pg.show !== 'blocks') fail('sign stands between the numbers of two blocks, write show: blocks');
    if (pg.sign && pg.cover) fail('sign says whether the line is true, which gives away what cover hides, keep one');
  }
  const ids = measuresOf(spec);
  for (const id of pg.readout) if (!ids.includes(id)) fail(`readout names "${id}", this page reads out ${list(ids) || 'nothing'}`);
  return { data: spec, has: id => ids.includes(id), offers: ids.length ? `one of ${list(ids)}` : 'nothing, the cards carry their numbers' };
}

// A link shows a number or the line of words as the page opens.
function start(spec, lang, id) {
  if (!measuresOf(spec).includes(id)) return null;
  const s = opening(spec), int = numbers(lang).int;
  if (id === 'reading') return string(lang, `counters_${readingOf(spec, s)}`, { a: int(s.top), b: int(s.bottom) });
  if (id === 'verdict') return string(lang, `counters_${verdictOf(spec, s)}`);
  return int(counts(spec, s)[id]);
}

export default { read, start };
