// Carrying a counter from one place to another. A press that hardly moves is a tap, and Enter or Space on a focused
// counter is a tap too, so every move works by touch, by mouse and by keys.
import { drag } from '../../kit/drag.js';

// A pointer that travels less than this many pixels makes a tap.
const STILL = 6;
// A touch sends its click after the counter it carried has moved, so the click lands on whatever lies under the
// finger then. A click this soon after a carry belongs to the carry and is dropped. A new press starts a new
// gesture, so its click counts however soon it follows.
const AFTER = 500;
let carried = 0;
addEventListener('pointerdown', () => { carried = 0; }, true);

// carry lets the reader drag node. start may refuse with false. drop gets the point where the counter was let go,
// or null when the drag was cancelled, and tap runs for a press that did not move.
export function carry(node, { point, start, move, drop, tap, raise }) {
  let from = null, far = false;
  drag(node, {
    point, raise,
    start(p, e) { from = { x: e.clientX, y: e.clientY }; far = false; return start?.(p, e); },
    move(p, e) {
      if (!far && Math.hypot(e.clientX - from.x, e.clientY - from.y) < STILL) return;
      far = true; move?.(p, e);
    },
    drop(e) {
      carried = performance.now();
      if (!far) return e?.type === 'pointercancel' ? drop?.(null) : tap ? tap() : drop?.(null);
      drop?.(e?.type === 'pointercancel' ? null : point(e));
    },
  });
  node.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); e.stopPropagation(); tap?.();
  });
}

// press makes node a button in the figure: a click, a tap, Enter or Space runs act.
export function press(node, act) {
  node.addEventListener('click', () => { if (performance.now() - carried > AFTER) act(); });
  node.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); e.stopPropagation(); act();
  });
}
