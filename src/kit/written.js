// The written line of a calculation under a figure, such as 5 + 3 = 8, or 13 − 8 before the figure shows the
// answer. The model half gives a line's words and its reading aloud, and the build and the browser both use it, so a
// text and its live value agree. writtenLine draws a line in a family's figure.
import { svg as el } from './dom.js';

export const PLUS = '+', MINUS = '−';
// A line is { a, sign, b }, the number before the sign, the sign and the number after it. A line with open: true
// leaves out its answer.
export const answerOf = line => line.sign === PLUS ? line.a + line.b : line.a - line.b;

// parts gives the pieces of a line in order. A number carries its role: a and b for the numbers either side of the
// sign, and c for the answer.
export function parts(line) {
  const out = [{ role: 'a', n: line.a }, { sign: line.sign }, { role: 'b', n: line.b }];
  if (!line.open) out.push({ sign: '=' }, { role: 'c', n: answerOf(line) });
  return out;
}
// words writes a line, such as "5 + 3 = 8". int writes a number in the page's language.
export const words = (line, int) => parts(line).map(p => p.sign ?? int(p.n)).join(' ');
// The kit's string of the line in words. The four strings take the numbers as {a}, {b} and {c}.
export const readingKey = line => `written-${line.sign === PLUS ? 'plus' : 'minus'}${line.open ? '-open' : ''}`;
// reading says a line in words, such as "5 plus 3 is equal to 8". T reads the kit's strings without their prefix
// hesap_, as a family's T does in the browser.
export const reading = (line, int, T) => T(readingKey(line), { a: int(line.a), b: int(line.b), c: int(answerOf(line)) });

// The size of a written line in a figure's units, the size of the numbers of the line of two numbers in counters/match.
export const SIZE = 34;
// The size of a step line.
export const STEP_SIZE = 26;
// widthOf gives the room a line of these words takes, a little wider than its digits and signs.
export const widthOf = text => text.length * SIZE * 0.6;

// A link of a line that does not show reads this, such as a step of making ten while the figure does not show it.
export const DASH = '–';

// writtenLine makes a line with its middle at 0, 0. refs gives the link id of each role, and cls the class that
// colours a number in its group's colour, such as { a: 'counters-a', b: 'counters-b' }. A role without a class is
// written in ink, as the signs are. A line whose roles change with the figure carries its own refs and cls. A step
// line, such as a step of making ten under the line of the calculation, is written smaller.
export function writtenLine({ refs = {}, cls = {}, step = false } = {}) {
  const text = el('text', { class: `hesap-written${step ? ' hesap-written-step' : ''}`, display: 'none' });
  let said = null, drawn = null, lit = new Set();
  const paint = () => { for (const t of text.querySelectorAll('[data-ref]')) t.classList.toggle('hesap-written-hot', lit.has(t.dataset.ref)); };
  return {
    el: text,
    // set writes the line and says whether it changed words it showed already, for a flash. A line of null takes the
    // line off the figure.
    set(line, int) {
      text.setAttribute('display', line ? 'inline' : 'none');
      const r = line?.refs ?? refs, c = line?.cls ?? cls, now = line ? words(line, int) : null, key = line ? JSON.stringify([now, r, c]) : null;
      if (key === drawn) return false;
      const first = said === null, changed = now !== said;
      said = now; drawn = key;
      text.replaceChildren(...(line ? parts(line).flatMap((p, i) => {
        const gap = i ? ' ' : '';
        if (p.sign) return [`${gap}${p.sign}`];
        const span = el('tspan', { class: ['hesap-written-num', c[p.role]].filter(Boolean).join(' '), 'data-ref': r[p.role] });
        span.textContent = int(p.n);
        return [gap, span];
      }) : []));
      paint();
      return !first && !!line && changed;
    },
    words: () => said,
    at(x, y) { text.setAttribute('x', x); text.setAttribute('y', y); },
    // light marks the numbers a link points to, together with the family's part of the figure. whole names the
    // links that mark the whole line, such as written and reading.
    light(id, on, whole = []) { if (on) lit.add(id); else lit.delete(id); paint(); text.classList.toggle('hesap-written-hot', whole.some(w => lit.has(w))); },
  };
}
