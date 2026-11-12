// What a counters page holds and what it counts. The build and the browser both use this file, so a page's text
// and its live values agree.

// A page shows its counters in one of these looks. hands, pins and cars are skins for the world pages.
export const LOOKS = ['diagram', 'frames', 'hands', 'pins', 'cars'];
// The pins of a lane and the spaces of the car park.
const CAP = { pins: 10, cars: 20 };
// The cars fill the car park in this order as a page opens, so the parked cars look spread out.
const CAR_ORDER = [2, 13, 7, 16, 0, 10, 5, 18, 11, 3, 8, 15, 19, 1, 12, 6, 17, 4, 9, 14];

// A page in the parts mode moves counters between two parts, in hands or in the diagram's circles. A page in the
// cells mode fills the cells of ten frames, the pins of a lane or the spaces of a car park.
export const modeOf = spec => spec.look === 'hands' || (spec.look === 'diagram' && !spec.frames) ? 'parts' : 'cells';
export const capOf = spec => CAP[spec.look] ?? spec.frames * 10;

// blueOf gives the blue counters that go with red ones: the rest of a declared whole, or the page's own number.
export function blueOf(spec, red, whole) {
  if (spec.cup) return 0;
  if (whole != null) return Math.max(0, whole - red);
  return spec.second ?? 0;
}

// lay puts red counters in the first cells and blue ones after them. keep gives the counter that already sits in a
// cell, so a counter that stays where it was keeps its id.
export function lay(spec, red, blue, keep = () => null, fresh = () => null) {
  const cap = capOf(spec), order = spec.look === 'cars' ? CAR_ORDER : [...Array(cap).keys()], cells = Array(cap).fill(null);
  order.forEach((cell, i) => {
    const colour = i < red ? 'a' : i < red + blue ? 'b' : null;
    if (!colour) return;
    const was = keep(cell);
    cells[cell] = was?.colour === colour ? was : { id: fresh() ?? `${colour}${cell}`, colour };
  });
  return cells;
}

// opening gives the counters as the page opens. A parts page holds the ids of each part, and a cells page holds
// each cell's counter or null. found lists the first parts of the splits the list has logged.
export function opening(spec) {
  const whole = spec.whole;
  if (modeOf(spec) === 'parts') {
    const ids = [...Array(whole ?? 0).keys()].map(i => `p${i}`), first = Math.min(spec.first, whole ?? 0);
    const colour = Object.fromEntries(ids.map((id, i) => [id, spec.look === 'hands' || i < first ? 'a' : 'b']));
    const s = { left: ids.slice(0, first), right: ids.slice(first), colour, found: [], lifted: false, extra: false };
    if (spec.list) s.found = [first];
    return s;
  }
  const s = { cells: lay(spec, spec.first, blueOf(spec, spec.first, whole)), found: [], lifted: false, extra: false };
  if (spec.list) s.found = [spec.first];
  return s;
}

// counts gives every number a page can show for its counters.
export function counts(spec, s) {
  if (modeOf(spec) === 'parts') {
    const first = s.left.length, second = s.right.length;
    return { first, second, whole: first + second, found: s.found.length, ways: first + second + 1 };
  }
  const cap = capOf(spec), red = s.cells.filter(c => c?.colour === 'a').length, blue = s.cells.filter(c => c?.colour === 'b').length;
  const whole = spec.cup ? spec.whole : red + blue;
  return { first: red, second: spec.cup ? whole - red : blue, whole, empty: cap - red - blue, added: blue, found: s.found.length, ways: cap + 1 };
}

// The list logs a split as its first part. Its partner is the second part, or the empty cells of a frame.
export const partnerOf = (spec, st) => modeOf(spec) === 'parts' ? st.second : st.empty;

// The context of a page picks the words of its readouts, such as "Left hand" for the first part of the hands.
export function contextOf(spec) {
  if (['hands', 'pins', 'cars'].includes(spec.look)) return spec.look;
  if (modeOf(spec) === 'parts') return 'parts';
  if (spec.cup) return 'cup';
  return spec.two ? 'two' : 'one';
}

// The measures a page can read out and link in its text.
export function measuresOf(spec) {
  if (spec.challenge) return [];
  const ids = ['first'];
  if (modeOf(spec) === 'parts') ids.push('second', 'whole');
  else {
    ids.push('empty');
    if (spec.two || spec.cup) ids.push('second', 'whole');
    if (spec.cup) ids.push('added');
  }
  if (spec.list) ids.push('found', 'ways');
  return ids;
}
