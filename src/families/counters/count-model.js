// What a count page holds and what it counts. The build and the browser both use this file, so a page's text and
// its live values agree.

// A page sets its objects out in one of these looks. bus and stairs are the world pages.
export const COUNT_LOOKS = ['tray', 'stall', 'wire', 'sand', 'bus', 'stairs'];
// What a tap on an object does: give it the next number, give it one more number even when it has one, show its own
// number in the rows, or take it out of the tray.
export const TAPS = ['tag', 'again', 'place', 'take'];
// The objects each look holds when they lie loose or stand in a row. Rows of ten hold up to 100.
export const ROOM = { tray: 20, stall: 20, sand: 20, wire: 12 };
export const SEATS = 12; // The seats of the bus, on two decks.
export const STOP = 10; // The people a bus stop holds.
export const STEPS = 20; // The steps of the staircase.

// modeOf names what a page does: a world page, a marker in the rows, a pile beside a box, or the page's tap.
export function modeOf(spec) {
  if (spec.look === 'bus' || spec.look === 'stairs') return spec.look;
  if (spec.marker != null) return 'marker';
  if (spec.pile != null) return 'pile';
  return spec.tap;
}

// The objects a page sets out as it opens: the page's number, or a hundred in rows of ten.
export const sizeOf = spec => spec.n ?? (spec.rows ? 100 : 0);

// opening gives the counts as the page opens. tags holds the numbers on each object, here says which objects are
// in the tray, and beside counts the counters next to the box. A counted page opens with every object numbered.
export function opening(spec) {
  const n = sizeOf(spec), tags = Array.from({ length: n }, (_, i) => spec.counted ? [i + 1] : []);
  return { tags, here: Array(n).fill(true), said: spec.counted ? n : 0, last: 0, beside: 0,
    box: spec.box ?? 0, marker: spec.marker ?? 0, step: spec.step ?? 0, riders: spec.look === 'bus' ? n : 0 };
}

// counts gives every number a page can show. count is the page's one running number, and total shows how many once
// every object has exactly one number.
export function counts(spec, s) {
  const mode = modeOf(spec);
  if (mode === 'tag' || mode === 'again') {
    const count = s.box + s.said;
    return { count, total: s.tags.length && s.tags.every(t => t.length === 1) ? count : null };
  }
  const count = { place: s.last, take: s.here.filter(Boolean).length, marker: s.marker, pile: s.box + s.beside, bus: s.riders, stairs: s.step }[mode];
  return { count };
}

// The context of a page picks the words of its readouts, such as "Passengers" on the bus.
export function contextOf(spec) {
  const mode = modeOf(spec);
  return mode === 'again' || mode === 'pile' ? 'tag' : mode;
}

// The measures a page can read out and link in its text.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  const mode = modeOf(spec);
  return mode === 'tag' || mode === 'again' ? ['count', 'total'] : ['count'];
}
