// The graph family's animations, timed in milliseconds. Each eases plain numbers and redraws on every frame, because
// JSXGraph draws from numbers. fx is the family's motion tracker, and the client skips these when motion is reduced.
export function driver(fx) {
  // A new split or a new swell takes over from the one before, which stops where it stands.
  const settles = fx.group(), swells = fx.group();
  return {
    // One rule's curve bends into the next.
    morph: (blend, draw, done) => fx.run(blend, { t: [0, 1], duration: 650, ease: 'inOutCubic', onUpdate: draw }, done),
    // The values glide back to where the page started.
    glide: (values, to, draw, done) => fx.run(values, { ...to, duration: 600, ease: 'inOutQuad', onUpdate: draw }, done),
    // After a split, each rectangle settles on its new height.
    settle(rects, draw) {
      settles.stop();
      settles.run(rects, { s: [0, 1], duration: 260, ease: 'outQuad', onUpdate: draw });
    },
    // A point swells as the reader takes it and shrinks back on release.
    swell(point, size) {
      swells.stop();
      const s = { size: point.visProp.size };
      swells.run(s, { size, duration: 180, ease: 'outBack', onUpdate: () => point.setAttribute({ size: s.size }) });
    },
    // The parts of the figure that reach a goal swell past their marked state and settle back on it.
    glow(marks, draw) {
      const k = { t: 0 }, at = (m, key) => m.off[key] + (m.on[key] - m.off[key]) * k.t;
      fx.run(k, { t: [0, 1.8, 1], duration: 700, ease: 'outQuad', onUpdate: () => {
        for (const m of marks) m.el.setAttribute(Object.fromEntries(Object.keys(m.on).map(key => [key, at(m, key)])));
        draw();
      } });
    },
  };
}
