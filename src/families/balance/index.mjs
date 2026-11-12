// The Node half of the balance family: a scale whose pans hold boxes of unknown weight x, weights and balloons. It
// reads the fields of a page and checks them against the equation the page opens with.
import { schema } from '@openbooknetwork/kitap';
import { OPS, equation, solve, value } from './algebra.js';
import { GOALS, fewest } from './goals.js';
import { MOST } from './layout.js';
import { formatter, starts, MEASURES } from './format.js';
import { list, challenge } from '../../node.mjs';

const { z } = schema;
const int = z.number().int();

// A side of the equation holds a number of boxes x and a number of weights, a balloon for each weight below zero.
// A pan draws up to 12 weights one by one and a larger number as one block.
const Side = z.object({ x: int.min(-6).max(6).default(0), number: int.min(-40).max(40).default(0) }).strict();
const Equation = z.object({ left: Side, right: Side }).strict();
// A challenge names its goal, the most steps it allows, and more equations for the Another one button.
const Challenge = z.object({ goal: z.string(), most: int.min(1).max(4).optional(), more: z.array(Equation).default([]) }).strict();
const Fields = z.object({
  left: Side,
  right: Side,
  ops: z.array(z.enum(Object.keys(OPS))).default([]), // The buttons offer these steps, each done to both sides.
  amount: z.object({ range: z.tuple([int.min(1), int.max(12)]), start: int.optional() }).strict().default({ range: [1, 10] }), // A step uses a number from this range.
  drag: z.boolean().default(false), // The reader moves weights on and off one pan at a time.
  challenge: Challenge.optional(),
}).strict();
// said writes an equation of page.yaml the way the page shows it, to name it in a message.
const said = e => { const f = formatter('en'), q = equation(e); return `${f.side(q.l)} = ${f.side(q.r)}`; };

function read(pg, { at }, ctx) {
  const [lo, hi] = pg.amount.range, ch = pg.challenge;
  for (const e of [pg, ...(ch?.more ?? [])]) if (!solve(equation(e))) ctx.fail(at, `${said(e)} has the same number of x on both sides, so no single x keeps the scale level. Give the sides different numbers of x`);
  if (!pg.ops.length && !pg.drag) ctx.fail(at, 'the page offers no steps. List ops, such as [subtract, divide], or set drag: true');
  const goal = ch ? challenge(ch, GOALS, { scene: pg.scene, at, ctx }) : null;
  if (goal) for (const e of [pg, ...ch.more]) {
    const eq = equation(e), st = { eq, steps: 0, x: value(solve(eq)) };
    if (goal(ch, st).met) ctx.fail(at, `${said(e)} already meets the goal ${ch.goal} before the reader does anything. Start from an equation where x is not alone`);
    // A page that allows most steps needs an equation its buttons can solve in that many.
    if (ch.most !== undefined && fewest(eq, pg.ops, pg.amount.range, ch.most) === null) ctx.fail(at, `${said(e)} takes more than ${ch.most} steps with the ops ${list(pg.ops)}. Raise challenge.most, offer other ops, or change the equation`);
  }
  if (pg.drag && [pg.left.number, pg.right.number].some(n => n < 0 || n > MOST)) ctx.fail(at, `a drag page moves single weights, so left.number and right.number are from 0 to ${MOST}`);
  if (lo > hi) ctx.fail(at, `amount.range is [${lo}, ${hi}], write the smaller number first`);
  if (pg.amount.start !== undefined && (pg.amount.start < lo || pg.amount.start > hi)) ctx.fail(at, `amount.start is ${pg.amount.start}, pick a number from ${lo} to ${hi}`);
  return { data: pg, has: id => MEASURES.includes(id), offers: list(MEASURES) };
}

// A link shows what the scale shows before the reader touches it.
const start = (spec, lang, id) => formatter(lang).value(starts(spec), id);

export default { id: 'balance', scenes: ['balance'], schema: Fields, read, start };
