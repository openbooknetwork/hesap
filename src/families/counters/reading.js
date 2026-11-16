// How two numbers compare, in a sign and in words: the three signs, the line of words such as "18 is less than 25",
// and whether a line with a sign is true. match-model.js and order-model.js take the rules from here, so the build
// and the browser agree, and match.js and order.js draw the line, the sign tile and the mark with the parts below.
import { svg as el } from '../../kit/dom.js';

// relation says how a stands to b: less, same or greater.
export const relation = (a, b) => a < b ? 'less' : a > b ? 'greater' : 'same';
// The signs in the order a tap on the tile goes through them, and the sign that makes a true line of a and b.
export const SIGNS = ['<', '=', '>'];
export const signOf = (a, b) => a < b ? '<' : a > b ? '>' : '=';
export const nextSign = sign => SIGNS[(SIGNS.indexOf(sign) + 1) % SIGNS.length];
// A page's sign field is one of the signs for a tile the reader taps, or follow for a sign the scene keeps true.
export const SIGN_FIELD = [...SIGNS, 'follow'];
export const isTile = spec => SIGNS.includes(spec.sign);
// signShown gives the sign a line shows: the tile's, or the true one on a follow page. A page without a sign has none.
export const signShown = (spec, s) => isTile(spec) ? s.sign : spec.sign === 'follow' ? signOf(s.top, s.bottom) : null;

const WORDS = { '<': 'less', '=': 'equal', '>': 'greater' };
// The string of the line of words, which takes the two numbers as {a} and {b}. A line with a sign reads the sign,
// so equal numbers read "is equal to" and a false line reads as it is written. Without a sign the line states how
// the numbers stand, and equal numbers read "is the same as".
export const readingKey = (a, b, sign) => `reading-${sign ? WORDS[sign] : relation(a, b)}`;
// The string of the mark beside a line with a sign tile: true or false.
export const verdictKey = (a, b, sign) => `verdict-${signOf(a, b) === sign}`;

// readingLine makes the line of words as a part of a figure, with its middle at x, y. say writes its words, and
// show puts it on or off the figure.
export function readingLine(x, y) {
  const text = el('text', { class: 'counters-reading', 'data-ref': 'reading', x, y });
  return { el: text, say(words) { if (text.textContent !== words) text.textContent = words; }, show(on) { text.setAttribute('display', on ? 'inline' : 'none'); } };
}

// signTile makes the sign between two numbers, with its middle at 0, 0 of its own group. set writes the sign and
// says whether it changed. open makes it a tile the reader taps, named by label. reach is the width of the square
// that takes a touch, which a figure drawn small makes wider.
export function signTile(reach = 64) {
  const text = el('text', { class: 'counters-sign-tile-text' }), pop = el('g', { class: 'a' }, [el('rect', { class: 'counters-sign-tile-box', x: -26, y: -26, width: 52, height: 52, rx: 9 }), text]);
  // The tile takes a touch a little past its box, so it is about 44px across on a phone.
  const hit = el('rect', { class: 'counters-hit', x: -reach / 2, y: -reach / 2, width: reach, height: reach });
  const g = el('g', { class: 'counters-sign-tile' }, [hit, pop]);
  return {
    el: g, pop,
    set(sign) { if (text.textContent === sign) return false; text.textContent = sign; return true; },
    open(on, label) {
      g.classList.toggle('counters-sign-tile-open', on);
      for (const [name, v] of [['tabindex', 0], ['role', 'button'], ['aria-label', label]]) if (on) g.setAttribute(name, v); else g.removeAttribute(name);
    },
  };
}

// verdictMark makes the mark beside a line: a tick or a cross with the word true or false. It starts at 0, 0 of
// its own group and runs to the right.
export function verdictMark() {
  const sign = el('path', { class: 'counters-mark-sign' }), text = el('text', { class: 'counters-mark-word', x: 26 });
  const g = el('g', { class: 'counters-mark', 'data-ref': 'verdict' }, [sign, text]);
  return {
    el: g,
    set(ok, words) {
      g.classList.toggle('counters-mark-true', ok); g.classList.toggle('counters-mark-false', !ok);
      sign.setAttribute('d', ok ? 'M 1 0 l 6 7 l 12 -14' : 'M 2 -8 l 16 16 M 18 -8 l -16 16');
      if (text.textContent === words) return false;
      text.textContent = words; return true;
    },
    show(on) { g.setAttribute('display', on ? 'inline' : 'none'); },
  };
}
