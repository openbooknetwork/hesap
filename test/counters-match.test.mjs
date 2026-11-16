// Checks the match scene of the counters family: what its Node half accepts, what each link shows as a page opens,
// and how the rows pair, ring and count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, linesOf, resize, step, roomOf, lone, counts, same, wordsOf, tagKey, readingOf, verdictOf } from '../src/families/counters/match-model.js';

// read runs the family's read on a page's fields and gives the page's data with the problems it reported.
function read(fields) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  let data = null;
  try { data = counters.read({ scene: 'match', ...fields }, { at: 'page.yaml' }, ctx).data; } catch (err) { problems.push(err.message); }
  return { data, problems };
}
const spec = fields => { const r = read(fields); assert.deepEqual(r.problems, []); return r.data; };
const stepper = (lo, hi, start) => ({ stepper: [lo, hi], start });

test('match: the family lists the scene', () => assert.ok(counters.scenes.includes('match')));

test('match: the pages of the section read without a problem', () => {
  for (const fields of [
    { look: 'cups', top: 5, bottom: 6 },
    { top: 7, bottom: 5 },
    { top: stepper(1, 10, 4), bottom: stepper(1, 10, 7), pair: 'auto', word: 'same', readout: ['unpaired'] },
    { top: 6, bottom: 6, pair: 'auto', spread: 'top', word: 'same', readout: ['unpaired'] },
  ]) spec(fields);
});

test('match: the links show the counts as the page opens', () => {
  const start = (fields, id) => counters.start(spec(fields), 'en', id);
  const steps = { top: stepper(1, 10, 4), bottom: stepper(1, 10, 7), pair: 'auto' };
  assert.equal(start(steps, 'unpaired'), '3');
  assert.equal(start(steps, 'pairs'), '4');
  assert.equal(start({ top: 6, bottom: 6, pair: 'auto', spread: 'top' }, 'unpaired'), '0');
  assert.equal(start({ top: 6, bottom: 6, pair: 'auto', spread: 'top' }, 'pairs'), '6');
  assert.equal(start({ top: 7, bottom: 5 }, 'unpaired'), '12');
  assert.equal(start({ top: 7, bottom: 5 }, 'other'), null);
});

test('match: a page with a field out of place is told what to write', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ bottom: 5 }, /top is missing/);
  fails({ top: 13, bottom: 5 }, /a row holds from 0 to 12/);
  fails({ top: stepper(1, 10, 11), bottom: 5 }, /starts at 11/);
  fails({ look: 'cups', top: 5, bottom: 6, pair: 'auto' }, /pair belongs to look: rows/);
  fails({ top: 6, bottom: 6, spread: 'top' }, /pair: auto/);
  fails({ top: 7, bottom: 6, pair: 'auto', spread: 'top' }, /6 at most/);
  fails({ top: 6, bottom: 6, readout: ['added'] }, /reads out unpaired, pairs, top, bottom/);
  assert.ok(read({ top: 6, bottom: 6, word: 'other' }).problems.length);
});

test('match: an auto page pairs the rows in order and rings the counters left over', () => {
  const page = spec({ top: 4, bottom: 7, pair: 'auto' }), s = opening(page);
  assert.deepEqual(linesOf(page, s), [[0, 0], [1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(lone(page, s), { top: [], bottom: [4, 5, 6], ringed: true });
  assert.equal(same(page, s), false);
  const even = resize(s, 'top', 7);
  assert.deepEqual(counts(page, even), { unpaired: 0, pairs: 7, top: 7, bottom: 7, counted: 0, added: 3, taken: 0 });
  assert.equal(same(page, even), true);
  assert.equal(same(page, resize(resize(s, 'top', 0), 'bottom', 0)), false);
});

test('match: the rings wait until one row has no counter left to pair', () => {
  const page = spec({ top: 7, bottom: 5 }), s = opening(page);
  assert.equal(lone(page, s).ringed, false);
  const some = { ...s, lines: [[0, 0], [2, 1], [6, 2], [3, 3]] };
  assert.equal(lone(page, some).ringed, false);
  const all = { ...some, lines: [...some.lines, [1, 4]] };
  assert.deepEqual(lone(page, all), { top: [4, 5], bottom: [], ringed: true });
  assert.equal(counts(page, all).unpaired, 2);
  assert.equal(counts(page, all).pairs, 5);
});

test('match: a counter that leaves its row takes its line with it', () => {
  const s = { ...opening(spec({ top: 5, bottom: 5 })), lines: [[4, 0], [0, 4], [1, 1]] };
  assert.deepEqual(resize(s, 'top', 4).lines, [[0, 4], [1, 1]]);
  assert.deepEqual(resize(s, 'bottom', 4).lines, [[4, 0], [1, 1]]);
  assert.deepEqual(resize(s, 'top', 6).lines, s.lines);
});

test('match: the pages of section 020 read without a problem and link their words and counts', () => {
  const start = (fields, id) => counters.start(spec(fields), 'en', id);
  const more = { top: stepper(0, 10, 6), bottom: stepper(0, 10, 4), pair: 'auto', word: true, readout: ['unpaired'] };
  assert.deepEqual(['top-word', 'bottom-word', 'unpaired'].map(id => start(more, id)), ['more', 'fewer', '2']);
  assert.equal(counters.start(spec(more), 'tr', 'top-word'), 'daha çok');
  assert.equal(start({ top: stepper(0, 10, 4), bottom: stepper(0, 10, 9), pair: 'auto', word: true, tap: 'tag', readout: ['counted'] }, 'counted'), '0');
  const trace = { top: stepper(5, 9, 9), bottom: stepper(5, 9, 5), pair: 'auto', word: true, trace: true, readout: ['added', 'taken'] };
  assert.deepEqual(['added', 'taken', 'top-word', 'bottom-word'].map(id => start(trace, id)), ['0', '0', 'more', 'fewer']);
  const chairs = { look: 'chairs', top: 6, bottom: 5, readout: ['top', 'bottom'] };
  assert.deepEqual(['top', 'bottom', 'unpaired'].map(id => start(chairs, id)), ['6', '5', null]);
  assert.equal(start({ top: 3, bottom: 3, pair: 'auto', word: 'same' }, 'top-word'), null);
});

test('match: the fields of section 020 are told where they belong', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ top: 4, bottom: 9, tap: 'tag' }, /tap works on counters left over/);
  fails({ top: 4, bottom: 9, trace: true }, /trace works on counters left over/);
  fails({ look: 'cups', top: 4, bottom: 9, word: true }, /word: true names the row with counters left over/);
  fails({ look: 'chairs', top: 6, bottom: 6 }, /bottom as one less/);
  fails({ look: 'chairs', top: 11, bottom: 10 }, /from 2 to 10/);
  fails({ look: 'chairs', top: 6, bottom: 5, word: true }, /word belongs to look: rows/);
  fails({ look: 'chairs', top: 6, bottom: 5, readout: ['unpaired'] }, /reads out top, bottom/);
  fails({ top: 4, bottom: 9, pair: 'auto', readout: ['counted'] }, /readout names "counted"/);
});

test('match: the tags name the row with more, and take the number once every counter left over is numbered', () => {
  const page = spec({ top: 4, bottom: 9, pair: 'auto', word: true, tap: 'tag' }), s = opening(page);
  assert.deepEqual(wordsOf(page, s), { top: { word: 'fewer', n: null }, bottom: { word: 'more', n: null } });
  const some = { ...s, said: ['b6', 'b4', 'b8', 'b5'] }, all = { ...some, said: [...some.said, 'b7'] };
  assert.equal(wordsOf(page, some).bottom.n, null);
  assert.deepEqual(wordsOf(page, all), { top: { word: 'fewer', n: 5 }, bottom: { word: 'more', n: 5 } });
  assert.deepEqual([counts(page, all).counted, tagKey(wordsOf(page, all).top), tagKey(wordsOf(page, s).top)], [5, 'tag-fewer-n', 'tag-fewer']);
  assert.deepEqual(resize(all, 'top', 5).said, []);
  assert.equal(wordsOf(page, resize(s, 'top', 9)).top.word, 'same');
  assert.equal(wordsOf(page, resize(s, 'top', 10)).top.word, 'more');
  assert.equal(wordsOf(page, resize(resize(s, 'top', 0), 'bottom', 0)).bottom.word, 'same');
});

test('match: a trace page counts the counters added and taken since it opened', () => {
  const page = spec({ top: stepper(5, 9, 9), bottom: stepper(5, 9, 5), pair: 'auto', trace: true }), s = opening(page);
  const mixed = resize(resize(s, 'bottom', 7), 'top', 8);
  assert.deepEqual([counts(page, mixed).added, counts(page, mixed).taken, counts(page, mixed).unpaired], [2, 1, 1]);
  const back = resize(mixed, 'bottom', 5);
  assert.deepEqual([counts(page, back).added, counts(page, back).taken], [0, 1]);
});

test('match: the chairs pair when the music stops and leave one player without a chair in every round', () => {
  const page = spec({ look: 'chairs', top: 3, bottom: 2 });
  let s = opening(page);
  assert.deepEqual([linesOf(page, s).length, lone(page, s).ringed], [0, false]);
  s = { ...s, music: false };
  assert.deepEqual(lone(page, s), { top: [2], bottom: [], ringed: true });
  s = { ...resize(resize(s, 'top', 2), 'bottom', 1), music: false };
  assert.deepEqual(lone(page, s).top, [1]);
  s = { ...resize(resize(s, 'top', 1), 'bottom', 0), music: true };
  assert.deepEqual([counts(page, s).top, counts(page, s).bottom, lone(page, s).ringed], [1, 0, false]);
});

test('match: word: true asks for lines the scene draws, so a tag never names a row before the rows are paired', () => {
  assert.match(read({ top: 3, bottom: 5, word: true }).problems.join('\n'), /word: true names the row with counters left over.*pair: auto/);
  assert.match(read({ top: 3, bottom: 5, pair: 'drag', word: true }).problems.join('\n'), /pair: auto/);
  assert.equal(counters.start(spec({ top: 3, bottom: 5, pair: 'auto', word: true }), 'en', 'top-word'), 'fewer');
});

test('match: on a trail page the bottom row takes the number the top row had, so the rows differ by one', () => {
  const fields = { top: stepper(1, 10, 7), bottom: 6, pair: 'auto', word: true, trail: true, readout: ['bottom', 'top'] }, page = spec(fields);
  assert.deepEqual(['top', 'bottom', 'top-word', 'bottom-word'].map(id => counters.start(page, 'en', id)), ['7', '6', 'more', 'fewer']);
  assert.equal(roomOf(page, 'bottom'), 10);
  let s = step(page, opening(page), 'top', 8);
  assert.deepEqual([s.top, s.bottom, lone(page, s).top], [8, 7, [7]]);
  s = step(page, s, 'top', 7);
  assert.deepEqual([s.top, s.bottom, lone(page, s).bottom, wordsOf(page, s).top.word], [7, 8, [7], 'fewer']);
  const plain = spec({ top: stepper(1, 10, 7), bottom: 6, pair: 'auto' });
  assert.equal(step(plain, opening(plain), 'top', 8).bottom, 6);
  const fails = (more, words) => assert.match(read({ ...fields, ...more }).problems.join('\n'), words);
  fails({ bottom: 7 }, /one less or one more/);
  fails({ top: 7, bottom: 6 }, /top on a stepper/);
  fails({ pair: 'drag', word: undefined }, /trail keeps the top row/);
  fails({ trace: true }, /trace and trail/);
});

test('match: a page with a sign links the line in words, and a tile page says whether the line is true', () => {
  const start = (fields, ids) => ids.map(id => counters.start(spec(fields), 'en', id));
  const follow = { top: stepper(0, 10, 5), bottom: stepper(0, 10, 8), pair: 'auto', sign: 'follow', readout: ['reading'] };
  assert.deepEqual(start(follow, ['top', 'bottom', 'reading', 'verdict']), ['5', '8', '5 is less than 8', null]);
  assert.deepEqual(start({ ...follow, top: stepper(0, 10, 8) }, ['reading']), ['8 is equal to 8']);
  const tile = { top: 9, bottom: 6, pair: 'auto', sign: '<', readout: ['reading', 'verdict'] }, page = spec(tile), s = opening(page);
  assert.deepEqual(start(tile, ['reading', 'verdict']), ['9 is less than 6', 'false']);
  assert.deepEqual([readingOf(page, { ...s, sign: '>' }), verdictOf(page, { ...s, sign: '>' }), verdictOf(page, { ...s, sign: '=' })], ['reading-greater', 'verdict-true', 'verdict-false']);
  const page2 = spec(follow);
  assert.equal(readingOf(page2, resize(opening(page2), 'top', 9)), 'reading-greater');
  assert.equal(counters.start(spec({ top: 3, bottom: 3, pair: 'auto' }), 'en', 'reading'), null);
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ look: 'cups', top: 5, bottom: 6, sign: 'follow' }, /sign stands between the numbers of two rows or two scores/);
  fails({ top: 5, bottom: 6, sign: '<', readout: ['verdict', 'other'] }, /readout names "other"/);
  fails({ top: 5, bottom: 6, sign: 'follow', readout: ['verdict'] }, /readout names "verdict"/);
});

test('match: the scoreboard keeps the sign between two scores and rings no ball', () => {
  const fields = { look: 'scoreboard', top: 0, bottom: 0, sign: 'follow', readout: ['reading'] }, page = spec(fields);
  assert.deepEqual(['top', 'bottom', 'reading', 'unpaired'].map(id => counters.start(page, 'en', id)), ['0', '0', '0 is equal to 0', null]);
  const s = resize(opening(page), 'top', 1);
  assert.deepEqual([readingOf(page, s), lone(page, s).ringed, linesOf(page, s).length], ['reading-greater', false, 0]);
  assert.equal(readingOf(page, resize(s, 'bottom', 1)), 'reading-equal');
  const fails = (more, words) => assert.match(read({ ...fields, ...more }).problems.join('\n'), words);
  fails({ sign: '<' }, /write sign: follow/);
  fails({ sign: undefined, readout: [] }, /write sign: follow/);
  fails({ top: 10 }, /a number from 0 to 9/);
  fails({ top: stepper(0, 9, 0) }, /a number from 0 to 9/);
  fails({ pair: 'auto' }, /pair belongs to look: rows/);
  fails({ word: 'same' }, /word belongs to look: rows/);
});
