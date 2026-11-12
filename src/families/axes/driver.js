// The axes family's animations, in milliseconds. They play once when the reader reaches a challenge's goal.
// ripple spreads a ring from a place that reaches the goal, fades it and takes it away, also when a page change
// cuts it short.
export const ripple = (motion, ring) => motion.run(ring, { r: [8, 60], opacity: [1, 0], strokeWidth: [5, 1.5], duration: 800, ease: 'outQuad' }, () => ring.remove(), () => ring.remove());
// pop swells a point the reader moved, or a whole solid, and lets it settle. Cut short, it goes back to its size.
export function pop(motion, el, size = 1.7) {
  const a = motion.run(motion.centre(el), { scale: [1, size, 1], duration: 480, ease: 'outBack' }, null, () => a.revert());
}
