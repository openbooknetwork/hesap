// The Node half of the match scene: two rows of objects paired one to one. It checks a page's fields and says what
// each link shows when the page opens.
import { schema } from '@openbooknetwork/kitap';
import { MATCH_LOOKS, ROWS, ROW_MAX, SPREAD_MAX, PLAYERS, GOALS_MAX, roomOf, opening, counts, wordsOf, tagKey, measuresOf, wordsLinked, readingOf, verdictOf } from './match-model.js';
import { SIGN_FIELD } from './reading.js';
import { MATCH_GOALS, matchStart } from './match-goals.js';
import { numbers } from '../../kit/format.js';
import { list, value, string, challenge, drawn } from '../../node.mjs';

const { z, check } = schema;
const Int = z.number().int();
const Range = z.tuple([Int, Int]);
const Stepper = z.object({ stepper: Range, start: Int.optional() }).strict();
const Row = z.union([Int, Stepper]);
const Fields = z.object({
  look: z.enum(MATCH_LOOKS).default('rows'), // Two rows of counters, cups above saucers, players above chairs, or two scores.
  top: Row.optional(), // The objects of the top row as the page opens, as a number or on a stepper.
  bottom: Row.optional(), // The objects of the bottom row.
  pair: z.enum(['drag', 'auto']).optional(), // The reader draws each pair, or the scene pairs the rows in order.
  spread: z.enum(ROWS).optional(), // A Spacing slider sets the gap between the counters of this row.
  // same shows the words "The same" between rows whose every counter has a partner. true gives each row a tag at
  // its end that reads more, fewer or the same.
  word: z.union([z.literal('same'), z.literal(true)]).optional(),
  tap: z.literal('tag').optional(), // A tap on a counter left over gives it the next number.
  trace: z.boolean().default(false), // A counter added since the page opened carries a plus, and one taken leaves a place.
  trail: z.boolean().default(false), // The bottom row holds the top row as it was one step ago.
  // A line of the two numbers with a sign between them: a tile that opens on this sign, or a sign that follows.
  sign: z.enum(SIGN_FIELD).optional(),
  // A challenge names a goal of match-goals.js and the ranges it draws its rows from.
  challenge: z.object({ goal: z.string(), top: Range.optional(), bottom: Range.optional(), rows: Range.optional(), apart: Range.optional() }).strict().optional(),
  readout: z.array(z.string()).default([]),
}).strict();

function read(fields, { at }, ctx) {
  const pg = check(Fields, fields, at), fail = words => ctx.fail(at, words);
  const top = value(pg.top), bottom = value(pg.bottom);
  const spec = { ...pg, scene: 'match', pair: pg.pair ?? 'drag', top: top.n, topCtl: top.ctl, bottom: bottom.n, bottomCtl: bottom.ctl };
  if (pg.challenge) { readChallenge(pg, spec, at, ctx); return { data: spec, has: () => false, offers: 'nothing, a challenge page draws its numbers as it opens' }; }
  for (const [v, name] of [[top, 'top'], [bottom, 'bottom']]) {
    if (v.n == null) { fail(`${name} is missing, write the objects of the ${name} row, such as 5, or { stepper: [1, 10], start: 5 }`); continue; }
    const lo = v.ctl?.lo ?? v.n, hi = v.ctl?.hi ?? v.n;
    if (lo > hi || v.n < lo || v.n > hi) fail(`${name} has the range [${lo}, ${hi}] and starts at ${v.n}, write [low, high] and a start between them`);
    else if (lo < 0 || hi > ROW_MAX) fail(`${name} reaches ${v.ctl ? `[${lo}, ${hi}]` : v.n}, a row holds from 0 to ${ROW_MAX} objects`);
  }
  if (pg.sign && !['rows', 'scoreboard'].includes(pg.look)) fail('sign stands between the numbers of two rows or two scores, write look: rows or look: scoreboard');
  if (pg.look === 'scoreboard') {
    for (const f of ['pair', 'word', 'tap', 'trace', 'trail', 'spread']) if (pg[f]) fail(`${f} belongs to look: rows, the buttons add the goals of the scoreboard`);
    if (top.ctl || bottom.ctl || [top.n, bottom.n].some(n => n > GOALS_MAX)) fail(`top and bottom are the scores of the home team and the away team, write each as a number from 0 to ${GOALS_MAX}`);
    if (pg.sign !== 'follow') fail('the scoreboard keeps the sign between its scores, write sign: follow');
  }
  if (pg.look === 'cups' && pg.pair) fail('pair belongs to look: rows, a drag seats a cup on a saucer in the cups look');
  if (pg.look === 'chairs') {
    for (const f of ['pair', 'word', 'tap', 'trace', 'trail', 'spread']) if (pg[f]) fail(`${f} belongs to look: rows, the buttons run the rounds of the chairs`);
    if (top.ctl || bottom.ctl || top.n < PLAYERS[0] || top.n > PLAYERS[1] || bottom.n !== top.n - 1) fail(`top and bottom are the players and the chairs, write top as a number from ${PLAYERS[0]} to ${PLAYERS[1]} and bottom as one less`);
  }
  if (pg.spread) {
    if (pg.look !== 'rows' || spec.pair !== 'auto') fail('spread moves the counters of a row under lines the scene draws, write look: rows and pair: auto');
    if (roomOf(spec, pg.spread) > SPREAD_MAX) fail(`spread doubles the length of the ${pg.spread} row, which reaches ${roomOf(spec, pg.spread)} counters, give it ${SPREAD_MAX} at most`);
  }
  if (!['chairs', 'scoreboard'].includes(pg.look)) {
    if (pg.word === true && (pg.look !== 'rows' || spec.pair !== 'auto')) fail('word: true names the row with counters left over by lines the scene draws, write look: rows and pair: auto');
    if (pg.trail) {
      if (pg.look !== 'rows' || spec.pair !== 'auto' || !top.ctl || bottom.ctl || Math.abs(top.n - bottom.n) !== 1) fail('trail keeps the top row of one step ago in the bottom row, write look: rows, pair: auto, top on a stepper and bottom as a number one less or one more than its start');
      for (const f of ['trace', 'spread']) if (pg[f]) fail(`${f} and trail both follow the steps of a row, keep one`);
    }
    for (const f of ['tap', 'trace']) if (pg[f] && (pg.look !== 'rows' || spec.pair !== 'auto')) fail(`${f} works on counters left over by lines the scene draws, write look: rows and pair: auto`);
  }
  const ids = measuresOf(spec), linked = [...ids, ...wordsLinked(spec)];
  for (const id of pg.readout) if (!ids.includes(id)) fail(`readout names "${id}", this page reads out ${list(ids)}`);
  return { data: spec, has: id => linked.includes(id), offers: `one of ${list(linked)}` };
}

// A challenge page names its goal and the ranges the goal draws from, and leaves every other field out. The goal
// draws the rows, and gives the page its stepper or its sign tile.
function readChallenge(pg, spec, at, ctx) {
  const c = pg.challenge, goal = challenge(c, MATCH_GOALS, { scene: 'match', at, ctx });
  if (!goal) return;
  for (const [f, v] of Object.entries(pg)) if (!['challenge', 'look'].includes(f) && v !== undefined && v !== false && !(f === 'readout' && !v.length)) ctx.fail(at, `${f} is set by challenge.goal ${c.goal}, leave it out`);
  if (pg.look !== 'rows') ctx.fail(at, `look is set by challenge.goal ${c.goal}, which draws two rows of counters, leave it out`);
  const problem = goal.problem(c);
  if (problem) return ctx.fail(at, `challenge.${problem}`);
  drawn(goal, c, spec, { at, ctx, starts: matchStart });
}

// A link shows a count or the word of a row's tag as the page opens.
function start(spec, lang, id) {
  const s = opening(spec);
  if (wordsLinked(spec).includes(id)) { const w = wordsOf(spec, s)[id.split('-')[0]]; return string(lang, `counters_${tagKey(w)}`, { n: numbers(lang).int(w.n) }); }
  if (!measuresOf(spec).includes(id)) return null;
  const int = numbers(lang).int;
  if (id === 'reading') return string(lang, `counters_${readingOf(spec, s)}`, { a: int(s.top), b: int(s.bottom) });
  if (id === 'verdict') return string(lang, `counters_${verdictOf(spec, s)}`);
  return int(counts(spec, s)[id]);
}

export default { read, start };
