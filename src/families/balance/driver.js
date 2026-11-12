// The balance family's motion: the scale and the equation move with anime.js through the page's tracker, so a page
// change stops them all. Times are in milliseconds, keyframes are arrays, and done runs when a motion ends.
const origin = (el, o) => { el.style.transformOrigin = o; };

export function driver(fx) {
  // A motion with an end runs its end when it is cut short, and an effect goes back to where it began.
  const run = (targets, params, done) => fx.run(targets, params, done, done);
  const effect = (targets, params, done) => { const a = fx.run(targets, params, done, () => a.revert()); return a; };
  return {
    // wait resolves after ms, or when a page change or the next action cuts it short. The step that waits checks
    // that it is still the latest action before it goes on.
    wait: ms => new Promise(r => run({ t: 0 }, { t: 1, duration: ms }, r)),

    // The beam swings to its angle and goes a little past it before it settles.
    tilt: (state, t, draw) => fx.run(state, { t, duration: 900, ease: 'outBack(2.2)', onUpdate: draw }),
    // A thing slides to its new place on the pan.
    glide: (pos, to, draw, duration = 420) => fx.run(pos, { x: to.x, y: to.y, duration, ease: 'outCubic', onUpdate: draw }),
    // A weight drops onto the pan and a balloon swells out of it.
    arrive: (el, balloon) => effect(el, balloon ? { scale: [0, 1], opacity: [0, 1], duration: 480, ease: 'outBack(1.8)' } : { y: [-70, 0], opacity: [0, 1], duration: 560, ease: 'outBounce' }),
    // A weight is lifted off, and a balloon let go floats away.
    leave: (el, balloon, done, delay = 0) => run(el, balloon ? { y: -150, opacity: 0, duration: 800, delay, ease: 'inQuad' } : { y: -50, opacity: 0, duration: 380, delay, ease: 'inQuad' }, done),
    // A box turns over to show what it weighs, and swap writes the new face as it turns edge on.
    turn: (el, swap) => effect(el, { scaleX: [1, 0], duration: 160, ease: 'inQuad' }, () => { swap(); effect(el, { scaleX: [0, 1], duration: 220, ease: 'outBack' }); }),
    // A box nods once, and a button swells a little.
    nod: (el, delay = 0) => effect(el, { scale: [1, 1.22, 1], duration: 520, delay, ease: 'outQuad' }),
    pulse: (el, delay = 0) => effect(el, { scale: [1, 1.06, 1], duration: 480, delay, ease: 'outQuad' }),

    // An equation's token moves from where it stood, at the size it had. The token stands at its new place, so it
    // starts shifted back by dx, dy and scaled by s.
    move(el, dx, dy, s) { origin(el, '0 0'); return effect(el, { x: [dx, 0], y: [dy, 0], scale: [s, 1], duration: 480, ease: 'outCubic' }); },
    // A new token pops in, a step's own a little later and with more bounce.
    enter(el, delay = 0) { origin(el, '50% 60%'); return effect(el, { opacity: [0, 1], scale: [0.3, 1], duration: 460, delay, ease: 'outBack(2)' }); },
    // A removed token fades and slides away upwards.
    exit: (el, done) => run(el, { opacity: [1, 0], y: [0, -22], duration: 420, ease: 'inQuad' }, done),
    // An earlier line settles into the list.
    settle: el => effect(el, { opacity: [0, 1], y: [8, 0], duration: 360, ease: 'outQuad' }),
    // A frame draws itself round the answer.
    frame: rect => effect(rect, { strokeDashoffset: [1, 0], duration: 750, ease: 'inOutQuad' }),
    // A ring spreads out of the answer and fades.
    ripple: (el, done) => run(el, { scale: [1, 1.5], opacity: [0.7, 0], duration: 700, ease: 'outQuad' }, done),
  };
}
