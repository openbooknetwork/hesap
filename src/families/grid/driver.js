// The driver moves the grid on the page's motion tracker, in milliseconds. A wave colours its cells batch by batch.
// The client says what each batch looks like, and the driver times the batches and makes the cells jump as the colour
// reaches them.
export default function driver(fx) {
  const { utils } = window.anime;
  // A wave and a glide each stop without the other, so each runs on a group of the page's tracker.
  const waves = fx.group(), moves = fx.group();
  // A jump that is cut short goes back to where it began.
  const jump = (targets, params) => { const a = waves.run(targets, params, null, () => a.revert()); return a; };

  return {
    adopt: root => fx.adopt(root),
    // The waves stop where they are, and a wave someone waits for reports that it did not finish.
    halt: () => waves.stop(),
    still: () => moves.stop(),
    stop() { waves.stop(); moves.stop(); },

    // The cells take their places at once, or glide there in reading order.
    place: (cells, xy) => utils.set(cells, { translateX: el => xy(el)[0], translateY: el => xy(el)[1] }),
    glide: (cells, xy) => moves.run(cells, { translateX: el => xy(el)[0], translateY: el => xy(el)[1], duration: 520, ease: 'outQuart', delay: fx.stagger(Math.min(4, 240 / cells.length)) }),

    // Batch i lands at i × step. apply(i) colours it and returns the faces to jump and the faces to grow from nothing.
    // The promise says whether the wave ran to its end.
    wave(count, step, apply) {
      return new Promise(done => {
        const clock = { i: 0 };
        let next = 0;
        const reach = upto => {
          for (; next < Math.min(count, upto); next++) {
            const { pop, grow } = apply(next);
            if (pop.length) jump(pop, { scale: [1, 1.32, 1], duration: 380, ease: 'outQuad' });
            if (grow.length) jump(grow, { scale: [0, 1], opacity: [0, 1], duration: 420, ease: 'outBack' });
          }
        };
        reach(1);
        if (count < 2) { done(true); return; }
        // The clock counts batches, so batch i lands when it reaches i.
        waves.run(clock, { i: [0, count - 1], duration: (count - 1) * step, ease: 'linear', onUpdate: () => reach(Math.floor(clock.i) + 1) },
          () => { reach(count); done(true); }, () => done(false));
      });
    },
    // The cells that reach a challenge's goal swell once in turn.
    pulse: els => els.length && jump(els, { scale: [1, 1.4, 1], duration: 560, ease: 'inOutQuad', delay: fx.stagger(Math.min(24, 600 / els.length)) }),
    // The clock's hand goes round once for each whole n in x, then on to the remainder. Cut short, it stands there.
    spin: (hand, turns, then) => waves.run(hand, { rotate: [0, turns * 360], duration: Math.min(2400, 600 + 260 * turns), ease: 'outCubic' }, then,
      () => utils.set(hand, { rotate: turns * 360 })),
    // A mark jumps when the clock's hand lands on it.
    pop: el => jump(el, { scale: [1, 1.35, 1], duration: 420, ease: 'outQuad' }),
  };
}
