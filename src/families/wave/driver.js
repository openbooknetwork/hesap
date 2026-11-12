// The wave family's own animations, run on the page's motion tracker. Times are in milliseconds.
export function driver(motion) {
  return {
    // After a slider moves, the figure eases to the new value and draw redraws it at each step.
    ease: (shown, to, draw) => motion.run(shown, { ...to, duration: 380, ease: 'outQuad', onUpdate: draw }),
    // A ring spreads from a point, fades and is removed, also when a page change cuts it short.
    ripple(ring) {
      const gone = () => ring.remove();
      return motion.run(motion.centre(ring), { scale: [1, 3.2], opacity: [0.9, 0], duration: 650, ease: 'outQuad' }, gone, gone);
    },
    // A matched wave thickens once and settles back.
    glow(path) {
      const at = { w: 3.5 }, settle = () => { path.style.strokeWidth = ''; };
      return motion.run(at, { w: [3.5, 9, 3.5], duration: 650, ease: 'outQuad', onUpdate: () => { path.style.strokeWidth = at.w; } }, settle, settle);
    },
  };
}
