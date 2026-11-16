// Checks the kit's stepper: its number, its two buttons, and the number kept out of sight on request.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A stand-in for the few parts of the page the stepper touches.
function node(tag) {
  const n = { tag, attrs: {}, kids: [], style: {}, listeners: {}, textContent: '', disabled: false,
    setAttribute(k, v) { n.attrs[k] = String(v); }, append(...kids) { for (const k of kids) { if (typeof k === 'string') n.textContent += k; else n.kids.push(k); } },
    addEventListener(ev, fn) { n.listeners[ev] = fn; }, click() { n.listeners.click?.(); } };
  return n;
}
globalThis.document = { createElement: node };
const { stepper } = await import('../src/kit/panel.js');
const parts = s => ({ out: s.el.kids.find(k => k.tag === 'output'), less: s.el.kids.filter(k => k.tag === 'button')[0], more: s.el.kids.filter(k => k.tag === 'button')[1] });

test('stepper: the buttons step the number between its ends and say their side', () => {
  const seen = [], s = stepper({ id: 'top', label: 'Top row', min: 0, max: 2, value: 1, change: v => seen.push(v) }), { out, less, more } = parts(s);
  assert.deepEqual([out.textContent, out.style.visibility, out.attrs['aria-hidden']], ['1', '', 'false']);
  assert.deepEqual([less.attrs['aria-label'], more.attrs['aria-label']], ['Top row −', 'Top row +']);
  more.click(); more.click();
  assert.deepEqual([seen, s.get(), more.disabled, less.disabled], [[2, 2], 2, true, false]);
});

test('stepper: a stepper that is not shown keeps its number out of sight and out of speech, and still steps', () => {
  const seen = [], s = stepper({ id: 'top', label: 'Top row', min: 0, max: 12, value: 7, change: v => seen.push(v), shown: false }), { out, less, more } = parts(s);
  assert.deepEqual([out.style.visibility, out.attrs['aria-hidden']], ['hidden', 'true']);
  assert.ok(![less, more].some(b => /\d/.test(b.attrs['aria-label'])), 'no button names the count');
  less.click();
  assert.deepEqual([seen, s.get(), out.style.visibility], [[6], 6, 'hidden']);
  s.show(true);
  assert.deepEqual([out.style.visibility, out.attrs['aria-hidden'], out.textContent], ['', 'false', '6']);
  s.show(false);
  assert.equal(out.style.visibility, 'hidden');
});
