// The places of a match figure: two rows of counters, or a tray of cups above a table of saucers. Each gives its
// size, the place of every object of the top and the bottom row, the height of the middle between the rows, and a
// draw for the parts that stay put.
import { svg as el } from '../../kit/dom.js';
import { R } from './counter.js';
import { txt } from './figures.js';

export const GAP = 40; // Counters of a row stand this far apart.
export const CLOSE = 33, WIDE = 40; // The gaps of the close and the wide row of a challenge.
const EDGE = 24; // The room round the rows, which holds a counter's touch target.
const DROP = 116; // The bottom row stands this far under the top row.

// rowsOf sets two rows out from the left. top and bottom are the most counters each row reaches. gap gives the gap
// of each row as it stands, and widest the greatest gap each row takes, which the figure keeps room for. tag is the
// room after the rows for the tag at a row's end, and names the room above and below them for a row's name. line
// is the width and the height of the line of two numbers under the rows, and the figure gives its place.
export function rowsOf({ top, bottom, gap = {}, widest = gap, tag = 0, names = 0, line = { w: 0, h: 0 } }) {
  const room = { top, bottom };
  const span = Math.max(...Object.keys(room).map(row => (Math.max(1, room[row]) - 1) * (widest[row] ?? GAP)));
  const place = (row, y) => i => ({ x: EDGE + i * (gap[row] ?? GAP), y: y + names });
  const h = DROP + 2 * EDGE + 2 * names;
  return { w: Math.max(span + 2 * EDGE + tag, line.w + EDGE), h: h + line.h, mid: names + EDGE + DROP / 2, line: { x: EDGE - 16, y: h + line.h / 2 - 4 },
    top: place('top', EDGE), bottom: place('bottom', EDGE + DROP), draw: () => ({ nodes: [] }) };
}

const CUP = 42, SAUCER = 58; // The cups of the tray and the saucers of the table stand this far apart.
const TRAY = 56, TABLE = 62; // The heights of the tray and the table.
const BETWEEN = 64; // The room between the tray and the table.

// cupsOf sets a tray of cups above a table of saucers. seat is the place of a cup that sits on a saucer.
export function cupsOf(top, bottom) {
  const tw = Math.max(1, top) * CUP + 16, bw = Math.max(1, bottom) * SAUCER + 16, w = Math.max(tw, bw), ty = TRAY + BETWEEN;
  const saucer = j => ({ x: (w - bw) / 2 + 8 + (j + 0.5) * SAUCER, y: ty + TABLE / 2 + 2 });
  return {
    w, h: ty + TABLE, mid: TRAY + BETWEEN / 2,
    top: i => ({ x: (w - tw) / 2 + 8 + (i + 0.5) * CUP, y: TRAY / 2 }),
    bottom: saucer,
    seat: j => { const p = saucer(j); return { x: p.x, y: p.y - R * 0.85 }; },
    draw: () => ({ nodes: [el('rect', { class: 'counters-tray', x: (w - tw) / 2, y: 0, width: tw, height: TRAY, rx: 12 }),
      el('rect', { class: 'counters-table', x: (w - bw) / 2, y: ty, width: bw, height: TABLE, rx: 8 })] }),
  };
}

export const BALL = 11; // The radius of a ball of the scoreboard.
// scoreOf sets a scoreboard out: the name and the score of two teams with a sign between the scores, and under
// each score room for max balls in rows of five. draw gives the board and the texts the scene writes: the two
// scores and the sign.
export function scoreOf(max, names) {
  const w = 320, board = 132, half = w / 2, gap = 2 * BALL + 5, per = 5, rows = Math.ceil(max / per);
  const ball = k => i => ({ x: (k + 0.5) * half + (i % per - (per - 1) / 2) * gap, y: board + 22 + Math.floor(i / per) * gap });
  return {
    w, h: board + 22 + (rows - 1) * gap + BALL + 6, mid: board / 2, top: ball(0), bottom: ball(1),
    draw() {
      const side = ['top', 'bottom'].map((r, k) => ({ name: txt(`counters-team counters-${k ? 'b' : 'a'}`, (k + 0.5) * half + (k ? 14 : -14), 28, names[k]), score: txt('counters-score', (k + 0.5) * half + (k ? 14 : -14), 84) }));
      for (const [k, r] of ['top', 'bottom'].entries()) side[k].score.setAttribute('data-ref', r);
      const sign = txt('counters-score-sign', half, 84);
      return { nodes: [el('rect', { class: 'counters-board', x: 0, y: 0, width: w, height: board, rx: 14 }), ...side.flatMap(t => [t.name, t.score]), sign], refs: { top: side[0].score, bottom: side[1].score, sign } };
    },
  };
}
