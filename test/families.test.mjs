// Checks what every family owes the core: the fields of its Node half, its strings in both languages and styles
// that stay inside its own box. A new family passes these before it draws anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FAMILIES from '../src/families.mjs';
import engine from '../src/index.mjs';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const dir = f => path.join(SRC, 'families', f.id);
// A family's strings are flat, one key to a line, so the keys are read without a YAML parser.
const strings = (f, lang) => Object.fromEntries([...fs.readFileSync(path.join(dir(f), 'i18n', `${lang}.yaml`), 'utf8').matchAll(/^([\w.-]+):\s*(.*)$/gm)].map(m => [m[1], m[2]]));

test('the engine module has what kitap calls', () => {
  assert.equal(engine.id, 'hesap');
  for (const hook of ['page', 'finish']) assert.equal(typeof engine.read[hook], 'function');
  assert.equal(typeof engine.bundle, 'function');
  for (const file of [engine.client.script, engine.client.styles]) assert.ok(fs.existsSync(fileURLToPath(file)), `${file} exists`);
});

for (const f of FAMILIES) {
  test(`${f.id}: the Node half exports its scenes, schema, read and start`, () => {
    assert.match(f.id, /^[a-z][a-z0-9]*$/);
    assert.ok(Array.isArray(f.scenes) && f.scenes.length, 'it owns one scene or more');
    for (const s of f.scenes) assert.match(s, /^[a-z0-9][a-z0-9-]*$/, `the scene ${s} is lowercase with dashes`);
    assert.equal(new Set(f.scenes).size, f.scenes.length, 'a scene is listed once');
    assert.equal(typeof f.schema?.parse, 'function', 'schema is a zod schema');
    assert.equal(typeof f.read, 'function');
    assert.equal(typeof f.start, 'function');
    assert.ok(fs.existsSync(path.join(dir(f), 'client.js')), 'the browser half is client.js');
  });

  test(`${f.id}: the strings have the family's prefix and exist in English and Turkish`, () => {
    const en = strings(f, 'en'), tr = strings(f, 'tr');
    for (const key of Object.keys(en)) assert.ok(key.startsWith(`${f.id}_`), `${key} starts with ${f.id}_`);
    assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort(), 'tr.yaml and en.yaml hold the same keys');
    assert.ok(en[`${f.id}_lead`], `${f.id}_lead says how the family's figures are moved`);
  });

  test(`${f.id}: every style rule sits under the family's own box or class prefix`, () => {
    const file = path.join(dir(f), 'client.css');
    if (!fs.existsSync(file)) return;
    const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|supports)[^{]*\{/g, '').replace(/@keyframes[^{]*\{[\s\S]*?\}\s*\}/g, '');
    const own = new RegExp(`(\\.hesap-${f.id}\\b|\\.${f.id}-|\\.hesap-(geo|axes)\\b)`);
    // A selector list splits at its commas, apart from the commas inside :is() and :not().
    const stray = [...css.matchAll(/(^|\})\s*([^{}]+)\{/g)].flatMap(m => m[2].split(/,(?![^()]*\))/)).map(s => s.trim()).filter(s => s && !own.test(s));
    assert.deepEqual(stray, [], 'selectors outside the family');
  });
}
