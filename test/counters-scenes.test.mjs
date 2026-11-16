// Checks that one scene of the counters family shows at a time: the svg of every scene off show is off the stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenes } from '../src/families/counters/scenes.js';

// A stage that keeps the svgs its scenes add, and a scene that adds one and logs what it is told.
function setup() {
  const stage = { kids: [], get lastElementChild() { return this.kids.at(-1); } }, log = [];
  const svg = name => { const attrs = {}; return { name, attrs, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; } }; };
  const maker = name => () => { stage.kids.push(svg(name)); return { show: page => log.push(`${name} show ${page}`), hide: () => log.push(`${name} hide`) }; };
  const all = scenes({ count: maker('count'), match: maker('match') }, stage);
  return { all, log, onShow: () => stage.kids.filter(k => k.attrs.display !== 'none').map(k => k.name) };
}

test('scenes: a change of scene takes the last scene off the stage', () => {
  const { all, log, onShow } = setup();
  all.show('count', 1); all.show('match', 2);
  assert.deepEqual(onShow(), ['match']);
  all.show('match', 3);
  assert.deepEqual(log, ['count show 1', 'count hide', 'match show 2', 'match show 3']);
});

test('scenes: a hidden family leaves no svg on show, and the next scene shows alone', () => {
  const { all, onShow } = setup();
  all.show('count', 1); all.show('match', 2); all.hide();
  assert.deepEqual(onShow(), []);
  assert.equal(all.now(), null);
  all.show('count', 3);
  assert.deepEqual(onShow(), ['count']);
  all.hide(); all.show('count', 4);
  assert.deepEqual(onShow(), ['count']);
});
