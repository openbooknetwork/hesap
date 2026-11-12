// The linear family's animations, run on the page's motion tracker so a page change stops them all. The values a
// figure draws are a plain object that anime.js moves in place, and paint draws the figure from them on every frame.
export function driver(motion) {
  return {
    // The drawn values ease to new ones. A knob let go settles on its step, and Start again returns to the start.
    settle: (shown, to, paint, { duration = 380, delay = 0, ease = 'outBack(1.4)' } = {}) => motion.run(shown, { ...to, duration, delay, ease, onUpdate: paint }),
    // The plane moves through phases, one after another. Each phase maps t from 0 to 1 to the values it draws. done
    // runs when the last phase ends, and cut when a stop ends the move before that.
    morph(phases, paint, done, cut) {
      return motion.timeline(phases.map(ph => {
        const k = { t: 0 };
        return { targets: k, t: 1, duration: ph.duration, onUpdate: () => paint(ph.at(k.t)) };
      }), done, { ease: 'inOutCubic' }, cut);
    },
    // What reached the goal swells once and settles, and goes back to its size when a stop cuts the swell short.
    solve(marks) {
      if (!marks.length) return;
      const a = motion.run(motion.centre(marks), { scale: [1, 1.1, 1], duration: 650, ease: 'inOutQuad' }, null, () => a.revert());
    },
  };
}
