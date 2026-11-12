// A point on the plane, with a dashed line to each axis where its coordinates are read.
import { axes, dashed, follower } from './plane.js';

const measures = { x: v => v.P[0], y: v => v.P[1] };

export function feet({ board, values, colors }) {
  const P = () => values().P, here = follower(board, P);
  for (const foot of [() => [P()[0], 0], () => [0, P()[1]]]) {
    dashed(board, here, follower(board, foot), colors);
    follower(board, foot, { visible: true, size: 3, fillColor: colors.accent, strokeColor: colors.accent });
  }
}

function draw(ctx) {
  const { board, values, colors, unit, coords, note } = ctx, P = () => values().P;
  axes(ctx);
  feet(ctx);
  note({ id: 'point', at: P, near: () => [P()[0] + unit * 2.4, P()[1] + unit * 1.8], say: () => coords(P()) });
}

export default { controls: { P: 'point' }, annotations: [], measures, formulas: {}, draw };
