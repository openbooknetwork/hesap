// The controls and readouts docked under a figure. Every family builds its panel from these parts, so a slider, a
// chip and a button look and behave the same on every page.
import { h, icon } from './dom.js';
import { math } from './text.js';

// slider is a labelled range input with its value written beside it. write turns the number into words, input runs
// while the reader drags, and change runs when the reader lets go. A slider with no value to read, such as time,
// passes output: false, and its value is still spoken.
export function slider({ id, label, min, max, step = 1, value, write = String, input, change, output = true, cls = '' }) {
  const range = h('input', { type: 'range', min, max, step }), out = h('output', { hidden: !output });
  const row = h('label', { class: `hesap-ctl ${cls}`.trim(), 'data-ref': id }, [h('span', {}, label), range, out]);
  const show = v => { const words = write(v); out.textContent = words; range.setAttribute('aria-valuetext', words); };
  const set = v => { range.value = v; show(Number(range.value)); };
  range.addEventListener('input', () => { show(Number(range.value)); input?.(Number(range.value)); });
  range.addEventListener('change', () => change?.(Number(range.value)));
  set(value);
  // width keeps the value's room steady while it changes, counted in characters.
  return { el: row, range, set, show, get: () => Number(range.value), width: ch => { out.style.minWidth = `${ch}ch`; } };
}
// chip is a readout: a name and a value that follows the figure. A chip the reader can press is a button. swatch
// is a class for a dot of the colour the figure draws the measure in, and short is a name for a phone.
export function chip({ id, label, short, swatch, press, cls = '' }) {
  const small = h('small', {}, short ? [h('span', { class: 'hesap-long' }, label), h('span', { class: 'hesap-short' }, short)] : label ?? ''), b = h('b');
  const dot = swatch ? [h('i', { class: `hesap-swatch ${swatch}`, 'aria-hidden': 'true' })] : [];
  const el = h(press ? 'button' : 'span', { class: `hesap-chip ${cls}`.trim(), 'data-ref': id, type: press ? 'button' : null }, label === null ? [...dot, b] : [...dot, small, b]);
  if (press) el.addEventListener('click', () => press(id));
  return {
    el, id, value: b,
    // set writes a new value and says whether it changed, so the family can mark the change.
    set(text) { if (b.textContent === text) return false; const first = !b.textContent; b.textContent = text; return !first; },
    // name writes the readout's name. A chip with a short name keeps it, and takes a new one as the second word.
    name(text, brief) {
      const long = small.querySelector('.hesap-long');
      if (!long) { if (small.textContent !== text) small.textContent = text; return; }
      long.textContent = text;
      if (brief !== undefined) small.querySelector('.hesap-short').textContent = brief;
    },
    // tex sets the value as a formula.
    tex(source, options) { math(b, source, false, options); },
    width: ch => { b.style.minWidth = `${ch}ch`; },
  };
}
// button is an action. A primary button starts something, and at most one stands on a page. A compact button with
// a glyph shows the glyph alone on a phone and keeps its label as its name.
export function button({ label, act, press, primary = false, glyph = null, compact = false, cls = '' }) {
  const el = h('button', { type: 'button', class: `hesap-btn${primary ? ' hesap-primary' : ''}${compact && glyph ? ' hesap-compact' : ''} ${cls}`.trim(), 'data-act': act, 'aria-label': compact ? label : null, title: compact ? label : null }, [...(glyph ? [icon(glyph)] : []), h('span', {}, label)]);
  if (press) el.addEventListener('click', press);
  return el;
}
// check is the button that commits a challenge's answer. T gives the shared strings, and press runs once per press.
export const check = ({ T, press }) => button({ label: T('check'), act: 'check', primary: true, press });
// segment is one choice out of a few, each a button. items are [value, words] pairs.
export function segment({ id, label, items, value, pick }) {
  const buttons = items.map(([v, words]) => h('button', { type: 'button', 'data-v': v }, words));
  const el = h('div', { class: 'hesap-seg', role: 'group', 'aria-label': label, 'data-ref': id }, [...(label ? [h('span', { class: 'hesap-seg-name' }, label)] : []), ...buttons]);
  const set = v => { value = v; buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(items[i][0]) === String(v))); };
  buttons.forEach((b, i) => b.addEventListener('click', () => { if (String(items[i][0]) === String(value)) return; set(items[i][0]); pick(items[i][0]); }));
  set(value);
  return { el, set, get: () => value };
}
// stepper is a whole number with a button on each side to take one away or add one. A stepper made with shown: false
// keeps its number out of sight and out of speech and holds its room, for a page whose reader must not read the
// count, and show puts the number on or off.
export function stepper({ id, label, min, max, step = 1, value, write = String, change, shown = true }) {
  const out = h('output'), less = h('button', { type: 'button', 'aria-label': `${label} −` }, '−'), more = h('button', { type: 'button', 'aria-label': `${label} +` }, '+');
  const el = h('div', { class: 'hesap-step', role: 'group', 'aria-label': label, 'data-ref': id }, [h('span', {}, label), less, out, more]);
  const set = v => { value = Math.max(min, Math.min(max, v)); out.textContent = write(value); less.disabled = value <= min; more.disabled = value >= max; };
  less.addEventListener('click', () => { set(value - step); change(value); });
  more.addEventListener('click', () => { set(value + step); change(value); });
  const show = on => { out.style.visibility = on ? '' : 'hidden'; out.setAttribute('aria-hidden', on ? 'false' : 'true'); };
  set(value); show(shown);
  return { el, set, show, get: () => value };
}
// row groups parts of the panel: ctl for controls, out for readouts, acts for buttons.
export const row = (kind, parts) => h('div', { class: `hesap-${kind}` }, parts.filter(Boolean).map(p => p.el ?? p));
