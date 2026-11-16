// What an order page holds and what it reads out: two numbers on one count or as two blocks of rows of ten, or three
// number cards. The build and the browser both use this file, so a page's text and its live values agree.
import { relation, isTile, signShown, readingKey, verdictKey } from './reading.js';

// A page draws its two numbers as markers on one count of 100, or as two blocks of rows of ten.
export const SHOWS = ['count', 'blocks'];
export const ROWS = ['top', 'bottom'];
export const TOP = 100; // The greatest number a page shows.
export const CARDS = 3; // The cards a page puts in order.

// A page puts cards in order when it names their numbers or asks for a draw.
export const isCards = spec => !!(spec.cards || spec.draw);

// opening gives the numbers as the page opens. cards holds the numbers of the cards on show, which New numbers
// draws again. A page that asks for a draw and names no cards opens without them, and the browser draws them. sign is the sign on the tile of a page that has one. open says whether the rows of the blocks are in sight, and place
// holds the place of each card, counted from 0, or null for a card in the tray.
export const opening = spec => ({ top: spec.top, bottom: spec.bottom, open: !spec.cover, sign: isTile(spec) ? spec.sign : null,
  cards: spec.cards ?? [], place: isCards(spec) ? Array(CARDS).fill(null) : [] });

// A number in rows of ten has full rows and a last row: 3 and 4 for 34, 4 and 0 for 40.
export const tens = n => ({ rows: Math.floor(n / 10), last: n % 10 });

// counts gives every number a page can show.
export function counts(spec, s) {
  const t = tens(s.top), b = tens(s.bottom);
  return { top: s.top, bottom: s.bottom, 'top-rows': t.rows, 'top-last': t.last, 'bottom-rows': b.rows, 'bottom-last': b.last };
}

// decides names the rows that decide which number is greater: the full rows when their numbers differ, the last
// rows when the full rows are the same, and all of both blocks when the numbers are the same.
export const decides = s => s.top === s.bottom ? 'all' : tens(s.top).rows !== tens(s.bottom).rows ? 'rows' : 'last';

// between says how the cards of two neighbouring places stand, or null while one of the places is empty.
export function between(spec, s, k) {
  const [a, b] = [k, k + 1].map(p => s.cards[s.place.indexOf(p)]);
  return a === undefined || b === undefined ? null : relation(a, b);
}
// The cards stand in order when each is less than the one after it.
export const ordered = (spec, s) => Array.from({ length: CARDS - 1 }, (_, k) => between(spec, s, k)).every(r => r === 'less');

// The measures a page can read out and link in its text. A covered page keeps what gives the answer away to itself.
export function measuresOf(spec) {
  if (isCards(spec)) return [];
  if (spec.cover) return ['top', 'bottom'];
  return ['top', 'bottom', ...(spec.reading || spec.sign ? ['reading'] : []), ...(isTile(spec) ? ['verdict'] : []), ...(spec.show === 'blocks' ? ['top-rows', 'top-last', 'bottom-rows', 'bottom-last'] : [])];
}
// The strings of the line of words and of the mark, as the page stands.
export const readingOf = (spec, s) => readingKey(s.top, s.bottom, signShown(spec, s));
export const verdictOf = (spec, s) => verdictKey(s.top, s.bottom, signShown(spec, s));

// On one count the first number's pin stands above its counter and the second's below. With the first number one
// row under the second, both pins meet between the two counters, so pinShift moves the first left and the second
// right there. It gives each pin's shift as -1, 0 or 1.
export const pinShift = s => s.top - s.bottom === 10 ? { top: -1, bottom: 1 } : { top: 0, bottom: 0 };

// drawCards draws three numbers from 10 to 99 for the cards. Two have the same full rows and different last rows,
// so the last row decides between them, and the third has other full rows. In one draw of three the third is one
// of the two with its digits swapped, as 63 beside 36, where that gives such a number. The cards come in an order
// that is not yet the right one, and differ from the cards in last.
export function drawCards(dice, last = []) {
  const digits = Array.from({ length: 10 }, (_, i) => i), swap = n => (n % 10) * 10 + Math.floor(n / 10);
  for (;;) {
    const rows = dice.int(1, 9), pair = dice.some(digits, 2).map(d => rows * 10 + d);
    const turned = dice.shuffle(pair).map(swap).filter(n => n >= 10 && tens(n).rows !== rows);
    const third = dice.int(1, 3) === 1 && turned.length ? turned[0] : dice.pick(digits.slice(1).filter(r => r !== rows)) * 10 + dice.pick(digits);
    const cards = dice.shuffle([...pair, third]), sorted = a => [...a].sort((x, y) => x - y).join();
    if (cards.join() !== sorted(cards) && sorted(cards) !== sorted(last)) return cards;
  }
}
