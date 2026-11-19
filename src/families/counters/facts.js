// The facts of a family under a figure: the two additions above and the two subtractions under them. Each fact is a button named by its reading, and a tap picks it. A fact the page leaves out, or the second
// of two equal facts, keeps its place empty, so the block does not move when the numbers change.
import { svg as el } from '../../kit/dom.js';
import { writtenLine, widthOf, reading, FACTS, FACT_IDS, factsOf, shownFacts, sameFact } from '../../kit/written.js';
import { press } from './move.js';

// A fact's box is this much wider than its widest line, and the boxes stand GAP apart.
const FACT_W = widthOf('00 + 00 = 00') + 20, GAP = 10;

// factsBlock makes the block. tint gives a line the classes of its numbers, and pick runs on a tap on a fact.
export function factsBlock({ tint, pick }) {
  const slots = FACTS.map(id => {
    const line = writtenLine(), box = el('rect', { class: 'counters-fact-box', rx: 8 });
    const g = el('g', { class: 'counters-fact', role: 'button', 'data-fact': id }, [box, line.el]);
    press(g, () => { if (g.getAttribute('display') !== 'none' && !g.classList.contains('counters-fact-empty')) pick(id); });
    return { id, g, box, line };
  });
  const group = el('g', { class: 'counters-facts', role: 'group' }, slots.map(s => s.g));
  let parts = [0, 0], lit = new Set();
  // mine gives the links that light a slot. With two equal parts the swap lights the first addition, and the whole
  // minus the first part lights the whole minus the second. lights gives those the reader points at.
  const mine = slot => FACT_IDS.filter(id => sameFact(id, ...parts) === slot.id), lights = slot => mine(slot).filter(id => lit.has(id));
  return {
    el: group,
    // ways gives the block's size for a row of this height: two rows of two, so each fact keeps its place, such as
    // the empty place beside an addition or the first column of a family of two facts.
    ways: row => [{ cols: 2, w: 2 * FACT_W + GAP, h: 2 * row + GAP }],
    // at puts the block's top left corner at x, y in the way of cols columns.
    at(x, y, cols, row) {
      slots.forEach((s, k) => {
        const c = cols === 2 ? k % 2 : 0, r = cols === 2 ? Math.floor(k / 2) : k, bx = x + c * (FACT_W + GAP), by = y + r * (row + GAP);
        for (const [a, v] of Object.entries({ x: bx, y: by, width: FACT_W, height: row })) s.box.setAttribute(a, v);
        s.line.at(bx + FACT_W / 2, by + row / 2);
      });
    },
    // set writes the facts of the two parts that the page lists, names each by its reading and marks the picked one.
    // lines puts another line in a place, such as a challenge's drawn fact in the first place. It gives the lines
    // whose words changed, for a flash.
    set({ first, second, listed, int, T, picked, lines: over = {} }) {
      parts = [first, second];
      const shown = shownFacts(first, second, listed), lines = { ...factsOf(first, second), ...over }, changed = [];
      group.setAttribute('aria-label', T('facts'));
      // A place the page leaves out shows as an empty dashed box, so the reader sees a place there. The second of two
      // equal facts has no place.
      const own = shownFacts(first, second);
      for (const s of slots) {
        const on = shown.includes(s.id), empty = !on && own.includes(s.id);
        s.g.setAttribute('display', on || empty ? 'inline' : 'none');
        s.g.classList.toggle('counters-fact-empty', empty);
        if (!on) {
          for (const a of ['tabindex', 'role', 'aria-label', 'aria-pressed']) s.g.removeAttribute(a);
          s.g.classList.remove('counters-fact-on'); s.line.set(null, int);
          continue;
        }
        s.g.setAttribute('tabindex', 0); s.g.setAttribute('role', 'button');
        if (s.line.set(tint(lines[s.id]), int)) changed.push(s.line.el);
        s.g.setAttribute('aria-label', reading(lines[s.id], int, T));
        s.g.setAttribute('aria-pressed', String(picked === s.id));
        s.g.classList.toggle('counters-fact-on', picked === s.id || lights(s).length > 0);
        s.line.light('', false, mine(s));
      }
      return changed;
    },
    // light marks the numbers a link points to in every fact, and a whole fact for a link to a fact.
    light(id, on) {
      if (on) lit.add(id); else lit.delete(id);
      for (const s of slots) {
        s.line.light(id, on, mine(s));
        if (FACT_IDS.includes(id)) s.g.classList.toggle('counters-fact-on', s.g.getAttribute('aria-pressed') === 'true' || lights(s).length > 0);
      }
    },
  };
}
