// The diagram's motion, run on the page's motion tracker, in milliseconds with keyframes as arrays.
export function driver(fx) {
  return {
    // a dropped element slides to its spot, and draw follows the point as it moves
    glide: (point, to, draw) => fx.run(point, { x: to.x, y: to.y, duration: 420, ease: 'outBack', onUpdate: draw }),
    // an element jumps as it crosses a border
    pop: el => fx.run(el, { scale: [1, 1.35, 1], duration: 380, ease: 'outQuad' }),
    // a circle swells as it gains an element and shrinks as it loses one
    pulse: (ring, gains) => fx.run(ring, { scale: [1, gains ? 1.04 : 0.96, 1], duration: 450, ease: 'outQuad' }),
    // a ring spreads from the crossing and fades, and done runs also when a page change cuts it short
    ripple: (ring, done) => fx.run(fx.centre(ring), { scale: [1, 2.8], opacity: [0.8, 0], duration: 550, ease: 'outQuad' }, done, done),
    // the elements that meet a goal jump one after another
    cheer: els => fx.run(fx.centre(els), { scale: [1, 1.45, 1], duration: 560, delay: fx.stagger(70), ease: 'outQuad' }),
  };
}
