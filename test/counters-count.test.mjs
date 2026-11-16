// Checks the sides page of the count scene: a number with the number before and the number after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import counters from '../src/families/counters/index.mjs';
import { opening, counts } from '../src/families/counters/count-model.js';

function read(fields) {
  const problems = [], ctx = { fail: (at, words) => problems.push(words) };
  let data = null;
  try { data = counters.read({ scene: 'count', ...fields }, { at: 'page.yaml' }, ctx).data; } catch (err) { problems.push(err.message); }
  return { data, problems };
}

test('count: a sides page links the number, the number before and the number after', () => {
  const r = read({ rows: true, n: 38, sides: true });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(['count', 'before', 'after', 'total'].map(id => counters.start(r.data, 'en', id)), ['38', '37', '39', null]);
  const s = opening(r.data);
  assert.deepEqual(counts(r.data, { ...s, here: [...s.here, true, true] }), { count: 40, before: 39, after: 41 });
});

test('count: a sides page is told what it needs', () => {
  const fails = (fields, words) => assert.match(read(fields).problems.join('\n'), words);
  fails({ n: 38, sides: true }, /rows: true and n from 1 to 99/);
  fails({ rows: true, n: 100, sides: true }, /n from 1 to 99/);
  fails({ rows: true, sides: true }, /n from 1 to 99/);
  fails({ rows: true, n: 38, sides: true, tap: 'tag' }, /tap belongs to other pages/);
  fails({ rows: true, n: 38, sides: true, marker: 3 }, /marker belongs to other pages/);
  fails({ rows: true, n: 38, sides: true, counted: true }, /counted belongs to other pages/);
  fails({ rows: true, n: 38, sides: true, box: 3 }, /box belongs to other pages/);
});
