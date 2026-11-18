// What a match page holds and what it counts: two rows of objects and the pairs between them. The build and the
// browser both use this file, so a page's text and its live values agree.
import { isTile, signShown, readingKey, verdictKey } from './reading.js';
import { MINUS } from '../../kit/written.js';

// A page draws its rows as counters, as cups on a tray above saucers on a table, as the players and the chairs of
// a game of musical chairs, or as the two scores of a scoreboard with a ball for each goal.
export const MATCH_LOOKS = ['rows', 'cups', 'chairs', 'scoreboard'];
export const GOALS_MAX = 9; // A score of the scoreboard stops here.
export const ROWS = ['top', 'bottom'];
export const ROW_MAX = 12; // The counters one row holds, which fit the width of a phone.
export const SPREAD_MAX = 6; // A row that spreads to twice its length holds this many.
export const PLAYERS = [2, 10]; // The players a game of musical chairs opens with.

// The most counters a row can reach on a page: the top of its stepper, or its number. A bottom row that trails the
// top row reaches as far as the top row.
export const roomOf = (spec, row) => spec.trail && spec.topCtl ? Math.max(spec.topCtl.hi, spec.bottom) : spec[`${row}Ctl`]?.hi ?? spec[row];

// opening gives the rows as the page opens. lines holds each pair the reader drew as [top, bottom], counted from 0.
// said holds the ids of the counters the reader numbered, in the order of their numbers. base keeps the rows as the
// page opened, and music says whether the music of the chairs plays.
export const opening = spec => ({ top: spec.top, bottom: spec.bottom, lines: [], said: [], base: { top: spec.top, bottom: spec.bottom }, music: true, sign: isTile(spec) ? spec.sign : null });
export const idOf = (row, i) => `${row[0]}${i}`;

// linesOf gives the pairs of the rows. An auto page pairs the first counter of the top row with the first of the
// bottom row and on, and so do the chairs once the music has stopped.
export function linesOf(spec, s) {
  if (spec.look === 'chairs' ? !s.music : spec.pair === 'auto') return Array.from({ length: Math.min(s.top, s.bottom) }, (_, i) => [i, i]);
  return s.lines;
}

// resize sets a row to n counters. A counter that leaves takes its line with it, and the numbers come off.
export function resize(s, row, n) {
  const next = { ...s, [row]: n, said: [] };
  return { ...next, lines: s.lines.filter(([t, b]) => t < next.top && b < next.bottom) };
}

// step sets a row to n counters after a press on its stepper. On a trail page the bottom row first takes the number
// the top row had.
export const step = (spec, s, row, n) => resize(spec.trail ? resize(s, 'bottom', s.top) : s, row, n);

// lone lists the counters of each row without a partner. They take a ring once one row has none left to pair. The
// players take theirs when the music stops, and the last player of a game takes a crown in its place. The balls of
// a scoreboard take none.
export function lone(spec, s) {
  const lines = linesOf(spec, s), free = (n, k) => Array.from({ length: n }, (_, i) => i).filter(i => !lines.some(l => l[k] === i));
  const top = free(s.top, 0), bottom = free(s.bottom, 1);
  return { top, bottom, ringed: spec.look === 'scoreboard' ? false : spec.look === 'chairs' ? !s.music && s.bottom > 0 : !top.length || !bottom.length };
}
// A game of musical chairs is won when one player is left.
export const won = (spec, s) => spec.look === 'chairs' && s.top === 1;

// counts gives every number a page can show. added and taken count the counters that came and went since the page
// opened, over both rows, and counted is the last number the reader said.
export function counts(spec, s) {
  const l = lone(spec, s), moved = sign => ROWS.reduce((sum, row) => sum + Math.max(0, sign * (s[row] - s.base[row])), 0);
  return { unpaired: l.top.length + l.bottom.length, pairs: linesOf(spec, s).length, top: s.top, bottom: s.bottom,
    counted: s.said.length, added: moved(1), taken: moved(-1) };
}

// The two groups are the same when each row has a counter and every counter has a partner.
export const same = (spec, s) => s.top > 0 && s.bottom > 0 && counts(spec, s).unpaired === 0;

// wordsOf gives the tag of each row: the row with counters left over has more, the other has fewer, and rows whose
// every counter has a partner are the same. n is how many more, once the reader has numbered every counter left over.
export function wordsOf(spec, s) {
  const l = lone(spec, s), left = l.top.length + l.bottom.length;
  if (!left) return { top: { word: 'same' }, bottom: { word: 'same' } };
  const n = spec.tap && s.said.length === left ? left : null, more = l.top.length ? 'top' : 'bottom';
  return Object.fromEntries(ROWS.map(row => [row, { word: row === more ? 'more' : 'fewer', n }]));
}
// The string of a tag, which takes n when the tag holds a number.
export const tagKey = w => w.n == null ? `tag-${w.word}` : `tag-${w.word}-n`;

// The measures a page can read out and link in its text. The words of the tags are linked and take no readout.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  const signed = [...(spec.sign ? ['reading'] : []), ...(isTile(spec) ? ['verdict'] : []), ...(spec.written ? ['written', 'reading'] : [])];
  if (spec.look === 'chairs' || spec.look === 'scoreboard') return ['top', 'bottom', ...signed];
  return ['unpaired', 'pairs', 'top', 'bottom', ...signed, ...(spec.tap ? ['counted'] : []), ...(spec.trace ? ['added', 'taken'] : [])];
}
export const wordsLinked = spec => spec.word === true ? ['top-word', 'bottom-word'] : [];
// The strings of the line of words and of the mark of a page with a sign, as the page stands.
export const readingOf = (spec, s) => readingKey(s.top, s.bottom, signShown(spec, s));
export const verdictOf = (spec, s) => verdictKey(s.top, s.bottom, signShown(spec, s));

// differenceOf gives the written line of the difference of the rows: the greater row's number minus the less row's,
// with its answer once one row has every counter paired, when the counters left over take their rings. greater
// names the row whose number comes first, the top row when the rows are equal.
export function differenceOf(spec, s) {
  const greater = s.bottom > s.top ? 'bottom' : 'top', less = greater === 'top' ? 'bottom' : 'top';
  return { line: { a: s[greater], sign: MINUS, b: s[less], open: !lone(spec, s).ringed }, greater, less };
}
