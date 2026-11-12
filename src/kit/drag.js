// Dragging with pointer events, the same by mouse and by touch.
// drag lets the reader drag node. point turns an event into the family's coordinates. start may return false to
// refuse the drag, and raise moves the node in the page before the pointer is captured, because moving an element
// releases its capture.
export function drag(node, { point, start, move, drop, raise }) {
  let held = null;
  // drop gets the event that ended the drag, so a family can tell a release from a cancel.
  const end = e => { if (held === null) return; held = null; node.classList.remove('drag'); drop?.(e); };
  node.addEventListener('pointerdown', e => {
    if (e.button) return;
    const p = point(e);
    if (start?.(p, e) === false) return;
    e.preventDefault(); e.stopPropagation();
    raise?.();
    try { node.setPointerCapture(e.pointerId); } catch {} // A pointer that a script made has nothing to capture.
    held = e.pointerId; node.classList.add('drag');
  });
  node.addEventListener('pointermove', e => {
    if (held !== e.pointerId) return;
    if (e.pointerType === 'mouse' && !e.buttons) return end(e); // The button came up where the page could not see it.
    move(point(e), e);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(ev, end);
  return { held: () => held !== null, end };
}
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
// nudge moves a focused node with the arrow keys. The keys stop at the node, because the book turns the page on
// Left and Right. rest runs once the keys go quiet.
export function nudge(node, { step, rest, idle = 800 }) {
  let timer = 0;
  node.addEventListener('keydown', e => {
    const d = ARROWS[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    step(d[0], d[1], e);
    if (rest) { clearTimeout(timer); timer = setTimeout(rest, idle); }
  });
  node.addEventListener('blur', () => { if (timer) { clearTimeout(timer); timer = 0; rest?.(); } });
  return { cancel: () => { clearTimeout(timer); timer = 0; } };
}
