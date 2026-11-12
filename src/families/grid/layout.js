// This file places the cells. It lays out the rows of a grid or a scene's own layout, sizes a cell to fit the stage,
// and gives a scene's side drawing its room.

// A plan gives the columns and rows of a grid and the column and row of each number, or null for a number off it.
export function plan(scene, spec, v) {
  if (scene.layout) return scene.layout(v, spec);
  const from = spec.numbers[0], cols = v.columns;
  return { cols, rows: Math.ceil((spec.numbers[1] - from + 1) / cols), at: m => [(m - from) % cols, Math.floor((m - from) / cols)] };
}

// The pitch of a cell that fits cols × rows in w × h, up to MAX. A grid too tall for h keeps cells a finger can tap
// and scrolls, unless its width makes them smaller still.
const MAX = 64, MIN = 28;
export function pitch(cols, rows, w, h) {
  let p = Math.min(w / cols, MAX);
  if (h / rows < p) p = Math.max(h / rows, Math.min(MIN, p));
  return Math.floor(p);
}

// A side drawing goes beside the grid or under it, wherever the cells come out larger.
export function split(cols, rows, w, h) {
  const beside = pitch(cols, rows, w * 0.58, h), under = pitch(cols, rows, w, h * 0.6);
  return beside >= under ? { dir: 'row', pitch: beside } : { dir: 'column', pitch: under };
}

// The rectangles of dots a number makes lie long side across, in centred lines like words. shelf finds the largest
// dot pitch that fits them all in w × h, the box of each and their height. label is the room a caption takes above.
export function shelf(pairs, w, h, label, most = 26) {
  const set = s => {
    const lines = [[]], gap = Math.max(14, s);
    let x = 0;
    for (const [a, b] of pairs) {
      const box = { w: Math.max(b * s, label.w), h: a * s + label.h };
      if (x && x + box.w > w) { lines.push([]); x = 0; }
      lines.at(-1).push(box); x += box.w + gap;
    }
    let y = 0;
    for (const line of lines) {
      const width = line.reduce((t, b) => t + b.w, 0) + gap * (line.length - 1), tall = Math.max(...line.map(b => b.h));
      let left = (w - width) / 2;
      for (const b of line) { b.x = left; b.y = y + tall - b.h; left += b.w + gap; }
      y += tall + gap;
    }
    const boxes = lines.flat();
    return { s, boxes, height: y - gap, fits: y - gap <= h && boxes.every(b => b.w <= w) };
  };
  let best = set(2);
  for (let s = 3; s <= most; s++) { const t = set(s); if (!t.fits) break; best = t; }
  return best;
}
