// The motion of the counters family, run on the page's motion tracker, in milliseconds. Every motion marks a change
// the reader made, and the scene skips it when the reader asked for less motion.
export function driver(fx) {
  return {
    // tween moves the numbers of a plain object, such as a counter's place, and draw follows each step.
    tween: (obj, to, draw, duration = 380, ease = 'outCubic') => fx.run(obj, { ...to, duration, ease, onUpdate: draw }),
    // A counter that arrives grows into its place, after delay milliseconds.
    pop: (el, delay = 0) => fx.run(fx.centre(el), { scale: [0.2, 1.12, 1], opacity: [0, 1], duration: 340, delay, ease: 'outQuad' }),
    // A counter that leaves shrinks away, and done takes it off the page also when a page change cuts it short.
    vanish: (el, done) => fx.run(fx.centre(el), { scale: [1, 0.2], opacity: [1, 0], duration: 240, ease: 'inQuad' }, done, done),
    // A value or a slot that changed jumps once.
    flash: el => fx.flash(el),
    // The counters that reach a goal swell one after another.
    cheer: els => fx.cheer(els),
  };
}
