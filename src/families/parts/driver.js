// The driver moves the picture on the page's motion tracker, timed in milliseconds. Geometry moves as plain numbers
// that draw() writes into the SVG on every frame, so a cut, a shaded share or a piece can be caught mid-move and sent
// on. An animation that removes something afterwards takes a done callback, which runs from onComplete.
const SLIDE = 520;

export default function driver(fx) {
  const { run, centre, stagger } = fx;
  return {
    // Cuts that move and a shaded share that grows or shrinks take the same time, so a share's edge stays on its cut.
    move: (obj, to, draw, delay = 0, done) => run(obj, { ...to, duration: SLIDE, delay, ease: 'inOutCubic', onUpdate: draw }, done),
    // A new cut sweeps across its whole, the ones further along a little later.
    sweep: (cut, draw, delay = 0) => run(cut, { len: [0, 1], opacity: [0, 1], duration: 420, delay, ease: 'outCubic', onUpdate: draw }),
    // A cut that is gone pulls back and fades, and the parts on either side become one.
    retract: (cut, draw, done) => run(cut, { len: 0, opacity: 0, duration: 380, ease: 'inQuad', onUpdate: draw }, done),
    // A piece flies from one bar to its place in another.
    fly: (box, to, draw, delay, done) => run(box, { ...to, duration: 700, delay, ease: 'inOutCubic', onUpdate: draw }, done),
    // A part jumps when it is shaded, and a label when its value changes.
    pop: el => run(centre(el), { scale: [1, 1.14, 1], duration: 340, ease: 'outQuad' }),
    fade: el => run(el, { opacity: 0, duration: 260, ease: 'outQuad' }, () => el.remove()),
    // The shapes that reach a goal swell once, one after the other.
    cheer: els => els.length && run(centre(els), { scale: [1, 1.06, 1], duration: 560, delay: stagger(90), ease: 'outQuad' }),
    flash: el => fx.flash(el),
  };
}
