// Seeded random numbers. One seed always gives the same numbers, so a test replays a run and a build checks the
// challenges a page can draw. A reader's page takes a fresh seed each time.

// mulberry32 is small, fast and even enough for coins, dice and drawn challenges.
export function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// hash runs FNV-1a over a text, to make a page's own seed when its page.yaml names none.
export function hash(text) {
  let h = 0x811c9dc5;
  for (const c of String(text)) h = Math.imul(h ^ c.codePointAt(0), 0x01000193);
  return h >>> 0;
}

// seedOf uses the page's seed for the first run and makes a new one for each run after it.
export const seedOf = (base, run) => run ? hash(`${base}:${run}`) : base >>> 0;

// fresh gives a seed no reader can predict, for a challenge drawn as its page opens.
export const fresh = () => (globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296)) >>> 0;

// dice wraps a seed in the draws a goal needs: a whole number in a range, one of a list, a list in a new order and
// a few of a list.
export function dice(seed) {
  const next = generator(seed);
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const shuffle = items => { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { next, int, pick: items => items[int(0, items.length - 1)], shuffle, some: (items, n) => shuffle(items).slice(0, n) };
}

// another draws a goal's target that differs from the last one, so Another one always changes the figure.
export function another(goal, c, spec, dice, last) {
  for (let i = 0; i < 40; i++) {
    const t = goal.draw(c, spec, dice);
    if (!last || JSON.stringify(t) !== JSON.stringify(last)) return t;
  }
  return goal.draw(c, spec, dice);
}
