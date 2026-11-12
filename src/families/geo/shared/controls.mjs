// Shared by the geo and axes families. The controls a page declares for a figure, and the check that a page gives
// its figure the controls, annotations and readouts it has.
import { schema } from '@openbooknetwork/kitap';
import { list } from '../../../node.mjs';

const { z } = schema;
export const Pair = z.tuple([z.number(), z.number()]);
const Slider = z.object({ slider: Pair, start: z.number().optional(), step: z.number().positive().default(0.1) }).strict();
const Point = z.object({ point: Pair, drag: z.boolean().default(false), snap: z.number().positive().optional() }).strict();
export const Controls = z.record(z.string(), z.union([Slider, Point])).default({});

// controlsOf checks that a page gives every control its figure needs, in the right kind, and no other.
export function controlsOf(pg, fig, at, ctx) {
  for (const [id, kind] of Object.entries(fig.controls)) {
    const c = pg.controls[id];
    if (!c) { ctx.fail(at, `figure ${pg.scene} needs the control "${id}", add controls.${id} as a ${kind}`); continue; }
    if (!(kind in c)) ctx.fail(at, `controls.${id} is a ${kind} in figure ${pg.scene}, write it as ${kind === 'slider' ? '{ slider: [from, to], start: n }' : '{ point: [x, y] }'}`);
    const start = c.start ?? c.slider?.[0];
    if (c.slider && (start < c.slider[0] || start > c.slider[1])) ctx.fail(at, `controls.${id}.start is outside its slider, pick a value from ${c.slider[0]} to ${c.slider[1]}`);
  }
  for (const id of Object.keys(pg.controls)) if (!fig.controls[id]) ctx.fail(at, `figure ${pg.scene} has no control "${id}", its controls are ${list(Object.keys(fig.controls))}`);
  for (const a of pg.annotate) if (!fig.annotations.includes(a)) ctx.fail(at, `figure ${pg.scene} cannot annotate "${a}", it annotates ${list(fig.annotations)}`);
  for (const m of pg.readout) if (!fig.measures[m]) ctx.fail(at, `figure ${pg.scene} has no measure "${m}", its measures are ${list(Object.keys(fig.measures))}`);
}
