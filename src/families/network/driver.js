// The graph's motion, run on a group of the page's tracker from kit/motion.js, so a new graph stops the graph's own
// animations alone. Times are in milliseconds, and an animation ends through its done callback.
export function driver(motion) {
  const { createDrawable, stagger } = window.anime, g = motion.group();
  // A path to draw starts hidden, so nothing shows before its turn comes.
  const hidden = el => { const [d] = createDrawable(el); d.setAttribute('draw', '0 0'); return d; };
  // A drawn path sheds the drawing's length and dashes, which would shrink the dashes the page's styles give it.
  const clean = els => { for (const el of els) for (const a of ['pathLength', 'stroke-dasharray', 'stroke-dashoffset']) el.removeAttribute(a); };
  const reveal = back => back ? ['1 1', '0 1'] : ['0 0', '0 1'];
  // An effect cut short goes back to where it began, and a motion with an end runs its end when cut short.
  const effect = (targets, params) => { const a = g.run(targets, params, null, () => a.revert()); return a; };
  const run = (targets, params, done) => g.run(targets, params, done, done);

  return {
    // CSS transforms on SVG scale an element about its own middle.
    adopt: root => motion.centre([root, ...root.querySelectorAll('.a')].filter(el => el.classList.contains('a'))),
    stop: () => g.stop(),

    // A new vertex pops in, and a new edge draws itself from the vertex it starts at. A path cut short shows whole.
    pop: el => effect(el, { scale: [0, 1], duration: 450, ease: 'outBack(2)' }),
    draw: (line, back) => run(hidden(line), { draw: reveal(back), duration: 380, ease: 'outQuad' }, () => clean([line])),
    // A removed vertex or edge fades and shrinks away.
    fade: (el, done) => run(el, { opacity: 0, scale: 0.6, duration: 260, ease: 'inQuad' }, done),
    // A vertex that broke a rule shakes.
    shake: els => effect(els, { x: [0, -6, 6, -4, 4, 0], duration: 420, ease: 'inOutSine' }),
    bump: els => effect(els, { scale: [1, 1.3, 1], duration: 380, ease: 'outQuad' }),
    // Every vertex jumps in turn when the reader reaches a goal.
    cheer: els => effect(els, { scale: [1, 1.35, 1], duration: 520, delay: stagger(70), ease: 'outQuad' }),
    // The edges of a finished walk swell one after another.
    flare: els => effect(els, { strokeWidth: [7, 13, 7], duration: 600, delay: stagger(60), ease: 'outQuad' }),
    flash: chip => g.flash(chip),
    // A rubber band let go of on no vertex springs back to where it started.
    retract: (band, to, done) => run(band, { x2: to.x, y2: to.y, opacity: [1, 0], duration: 220, ease: 'inQuad' }, done),

    // A path lights up one edge after another, each drawn from the end the path comes from. Each glow is [path, back].
    light(glows) {
      if (!glows.length) return null;
      const end = () => clean(glows.map(([el]) => el));
      return g.timeline(glows.map(([el, back], i) => ({ targets: hidden(el), draw: reveal(back), duration: 260, ease: 'inOutQuad', at: i * 220 })), end, {}, end);
    },
    // A dot runs along a path from one end to the other, or back from the far end.
    travel(dot, path, back, done) {
      const len = path.getTotalLength(), t = { k: 0 };
      const at = () => { const p = path.getPointAtLength((back ? 1 - t.k : t.k) * len); dot.setAttribute('transform', `translate(${p.x} ${p.y})`); };
      at();
      return run(t, { k: 1, duration: 420, ease: 'inOutQuad', onUpdate: at }, done);
    },
  };
}
