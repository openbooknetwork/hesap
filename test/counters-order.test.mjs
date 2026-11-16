// Checks the order scene of the counters family: what its Node half accepts, what each link shows as a page opens,
// which rows decide a comparison and when three cards stand in order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, counts, decides, between, ordered, tens, readingOf, verdictOf, pinShift, drawCards } from '../src/families/counters/order-model.js';
import { relation, signOf, nextSign, readingKey } from '../src/families/counters/reading.js';
import { dice } from '../src/kit/random.js';

function read(fields) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  let data = null;
  try { data = counters.read({ scene: 'order', ...fields }, { at: 'page.yaml' }, ctx).data; } catch (err) { problems.push(err.message); }
  return { data, problems };
}
const spec = fields => { const r = read(fields); assert.deepEqual(r.problems, []); return r.data; };
const slider = (lo, hi, start) => ({ slider: [lo, hi], start });
const start = (fields, ids) => ids.map(id => counters.start(spec(fields), 'en', id));

test('order: the family lists the scene', () => assert.ok(counters.scenes.includes('order')));

test('order: the pages of the section link their numbers and the line of words', () => {
  const count = { show: 'count', top: slider(1, 100, 18), bottom: slider(1, 100, 25), reading: true };
  assert.deepEqual(start(count, ['top', 'bottom', 'reading', 'top-rows']), ['18', '25', '18 is less than 25', null]);
  const blocks = { show: 'blocks', top: slider(0, 100, 34), bottom: slider(0, 100, 52), reading: true, decide: true, readout: ['top-rows', 'top-last', 'bottom-rows', 'bottom-last'] };
  assert.deepEqual(start(blocks, ['top', 'bottom', 'reading', 'top-rows', 'top-last', 'bottom-rows', 'bottom-last']), ['34', '52', '34 is less than 52', '3', '4', '5', '2']);
  const covered = { show: 'blocks', top: slider(10, 99, 48), bottom: slider(10, 99, 51), reading: true, decide: true, cover: true };
  assert.deepEqual(start(covered, ['top', 'bottom', 'reading', 'top-rows']), ['48', '51', null, null]);
  assert.deepEqual(start({ cards: [63, 36, 39] }, ['top', 'reading']), [null, null]);
  assert.deepEqual(start({ show: 'count', top: 30, bottom: 30, reading: true }, ['reading']), ['30 is the same as 30']);
  assert.deepEqual(start({ show: 'blocks', top: { stepper: [0, 100], start: 9 }, bottom: 4, reading: true }, ['reading']), ['9 is greater than 4']);
});

test('order: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ top: 3, bottom: 4 }, /show is missing/);
  fails({ show: 'count', top: 0, bottom: 4 }, /a marker stands on a counter from 1 to 100/);
  fails({ show: 'blocks', top: slider(0, 101, 5), bottom: 4 }, /a block holds a number from 0 to 100/);
  fails({ show: 'blocks', bottom: 4 }, /top is missing/);
  fails({ show: 'count', top: 3, bottom: 4, decide: true }, /decide belongs to the rows of two blocks/);
  fails({ show: 'count', top: 3, bottom: 4, cover: true }, /cover belongs to the rows of two blocks/);
  fails({ show: 'blocks', top: 3, bottom: 4, cover: true, readout: ['top-rows'] }, /reads out top, bottom/);
  fails({ cards: [63, 36] }, /3 different numbers/);
  fails({ cards: [63, 36, 36] }, /3 different numbers/);
  fails({ cards: [63, 36, 39], show: 'count' }, /show belongs to pages with two numbers/);
  fails({ cards: [63, 36, 39], reading: true }, /reading belongs to pages with two numbers/);
  fails({ cards: [63, 36, 39], readout: ['top'] }, /reads out nothing/);
});

test('order: the full rows decide first, then the last rows', () => {
  assert.deepEqual([tens(34), tens(40), tens(100), tens(0)], [{ rows: 3, last: 4 }, { rows: 4, last: 0 }, { rows: 10, last: 0 }, { rows: 0, last: 0 }]);
  assert.deepEqual([[34, 52], [47, 43], [48, 51], [40, 47], [70, 69], [50, 50], [100, 95]].map(([top, bottom]) => decides({ top, bottom })), ['rows', 'last', 'rows', 'last', 'rows', 'all', 'rows']);
  assert.deepEqual([relation(18, 25), relation(25, 25), relation(26, 25)], ['less', 'same', 'greater']);
  const page = spec({ show: 'blocks', top: 47, bottom: 43 });
  assert.deepEqual(counts(page, opening(page)), { top: 47, bottom: 43, 'top-rows': 4, 'top-last': 7, 'bottom-rows': 4, 'bottom-last': 3 });
  assert.equal(opening(spec({ show: 'blocks', top: 47, bottom: 43, cover: true })).open, false);
});

test('order: three cards stand in order when each is less than the one after it', () => {
  const page = spec({ cards: [63, 36, 39] }), s = opening(page);
  assert.deepEqual([s.place, between(page, s, 0), ordered(page, s)], [[null, null, null], null, false]);
  assert.equal(ordered(page, { ...s, cards: [12, 15, 40], place: [0, 1, 2] }), true);
  const some = { ...s, place: [0, 1, null] };
  assert.deepEqual([between(page, some, 0), between(page, some, 1), ordered(page, some)], ['greater', null, false]);
  assert.equal(ordered(page, { ...s, place: [2, 1, 0] }), false);
  assert.deepEqual([between(page, { ...s, place: [2, 0, 1] }, 0), ordered(page, { ...s, place: [2, 0, 1] })], ['less', true]);
});

test('order: a sign tile keeps its sign, and the line reads it and is true or false', () => {
  const fields = { show: 'blocks', top: slider(0, 100, 23), bottom: slider(0, 100, 31), decide: true, sign: '<', readout: ['reading', 'verdict'] }, page = spec(fields);
  assert.deepEqual(start(fields, ['top', 'bottom', 'reading', 'verdict']), ['23', '31', '23 is less than 31', 'true']);
  const s = { ...opening(page), top: 35 };
  assert.deepEqual([readingOf(page, s), verdictOf(page, s)], ['reading-less', 'verdict-false']);
  assert.deepEqual([readingOf(page, { ...s, sign: '>' }), verdictOf(page, { ...s, sign: '>' })], ['reading-greater', 'verdict-true']);
  assert.deepEqual([readingOf(page, { ...s, top: 31, sign: '=' }), verdictOf(page, { ...s, top: 31, sign: '=' })], ['reading-equal', 'verdict-true']);
  assert.deepEqual([signOf(3, 3), signOf(2, 3), signOf(4, 3), nextSign('<'), nextSign('='), nextSign('>')], ['=', '<', '>', '=', '>', '<']);
  assert.deepEqual([readingKey(3, 3), readingKey(3, 3, '='), readingKey(9, 6, '<')], ['reading-same', 'reading-equal', 'reading-less']);
  const fails = (more, words) => assert.match(read({ ...fields, ...more }).problems.join('\n'), words);
  fails({ show: 'count', decide: false, top: 5, bottom: 6 }, /sign stands between the numbers of two blocks/);
  fails({ cover: true, readout: [] }, /sign says whether the line is true/);
  fails({ sign: 'follow' }, /sign/);
  assert.match(read({ cards: [1, 2, 3], sign: '<' }).problems.join('\n'), /sign belongs to pages with two numbers/);
});

test('order: the two pins move apart sideways only where they would meet between two rows', () => {
  assert.deepEqual(pinShift({ top: 15, bottom: 5 }), { top: -1, bottom: 1 });
  for (const [top, bottom] of [[5, 15], [19, 18], [18, 19], [18, 18], [14, 5], [16, 5], [25, 5]]) assert.deepEqual(pinShift({ top, bottom }), { top: 0, bottom: 0 });
});

test('order: New numbers draws three cards where the last row decides between two and the full rows set the third apart', () => {
  const swap = n => (n % 10) * 10 + Math.floor(n / 10), sorted = a => [...a].sort((x, y) => x - y);
  let last = [63, 36, 39], swapped = 0;
  const N = 3000;
  for (let seed = 1; seed <= N; seed++) {
    const cards = drawCards(dice(seed), last), rows = cards.map(n => tens(n).rows), groups = Object.values(Object.groupBy(cards, n => tens(n).rows));
    assert.equal(cards.length, 3);
    assert.ok(cards.every(n => Number.isInteger(n) && n >= 10 && n <= 99), `${cards} lie from 10 to 99`);
    assert.equal(new Set(cards).size, 3, `${cards} are different`);
    assert.deepEqual(groups.map(g => g.length).sort(), [1, 2], `${cards} have two numbers with the same full rows and one apart (${rows})`);
    assert.notDeepEqual(cards, sorted(cards), `${cards} are not in order yet`);
    assert.notDeepEqual(sorted(cards), sorted(last), `${cards} differ from the cards on show`);
    const [pair, [third]] = groups[0].length === 2 ? groups : [groups[1], groups[0]];
    if (pair.some(n => swap(n) === third)) swapped++;
    last = cards;
  }
  assert.ok(swapped / N > 0.25 && swapped / N < 0.45, `the third card is a swap in ${swapped} of ${N} draws`);
  assert.deepEqual(drawCards(dice(7), [63, 36, 39]), drawCards(dice(7), [63, 36, 39]));
  // A page with draw and no cards is a cards page that opens on a draw, and takes no field of two numbers.
  const drawn = spec({ draw: true });
  assert.deepEqual([opening(drawn).cards, opening(drawn).place, counters.start(drawn, 'en', 'top')], [[], [null, null, null], null]);
  assert.match(read({ show: 'blocks', top: 3, bottom: 4, draw: true }).problems.join('\n'), /show belongs to pages with two numbers, leave it out of a page with cards/);
  assert.match(read({ draw: true, reading: true }).problems.join('\n'), /reading belongs to pages with two numbers/);
  assert.match(read({ draw: true, cards: [1, 1, 2] }).problems.join('\n'), /3 different numbers/);
  assert.match(read({}).problems.join('\n'), /show is missing.*or give the page cards or draw: true/);
  assert.equal(spec({ cards: [63, 36, 39], draw: true }).draw, true);
  assert.deepEqual(opening(spec({ cards: [63, 36, 39], draw: true })).cards, [63, 36, 39]);
});
