// The proof's motion on the kit's tracker, in milliseconds. A piece's state is a plain object (x, y, turn, scale,
// show) that the driver moves and the client draws on every frame.
const near = (p, q) => Math.abs(p - q) < 1e-6;

export default function driver(motion) {
  // group is the proof's share of the page's tracker, so a slider stops the proof's moves and nothing else. mine
  // holds the moves still running, so a grabbed piece can stop its own.
  const group = motion.group(), mine = new Set();
  // The client stops every move before it starts the next, so a move needs no composing with another.
  const run = (target, params, done, cut) => {
    const a = group.run(target, { composition: 'none', ...params }, () => { mine.delete(a); done?.(); }, cut);
    mine.add(a); return a;
  };
  return {
    // A stopped move leaves a piece's state where it stood.
    stop() { group.stop(); mine.clear(); },
    // The moves of one piece stop where they are, as when the reader grabs it.
    halt(now) { for (const a of mine) if (a.targets.includes(now)) { a.cancel(); mine.delete(a); } },

    // Every piece that changes goes to its new state, with staggered starts and a slight overshoot, and a piece that
    // appears where it stands pops up from small. done runs once every piece has arrived.
    go(changes, draw, done) {
      const moving = changes.filter(({ now, to }) => ['x', 'y', 'turn', 'scale', 'show'].some(k => !near(now[k], to[k])));
      const gap = Math.min(70, 650 / Math.max(1, moving.length));
      let left = moving.length;
      if (!left) return done?.();
      moving.forEach(({ id, now, to }, i) => {
        const moves = !near(now.x, to.x) || !near(now.y, to.y) || !near(now.turn, to.turn);
        const pops = now.show < 0.01 && to.show > 0 && !moves && near(now.scale, to.scale);
        run(now, {
          x: to.x, y: to.y, turn: to.turn, scale: pops ? [to.scale * 0.3, to.scale] : to.scale,
          show: { to: to.show, duration: to.show ? 350 : 280, ease: 'outQuad' },
          duration: moves ? 850 : 600, delay: i * gap, ease: pops ? 'outBack(2.2)' : 'outBack(1.2)', onUpdate: () => draw(id),
        }, () => { if (!--left) done?.(); });
      });
    },
    // A dropped piece slides onto its place.
    glide: (now, to, draw) => run(now, { x: to.x, y: to.y, duration: 420, ease: 'outBack(1.6)', onUpdate: draw }),
    // The result of a step swells once about its own middle, one shape after another. A swell cut short goes back,
    // so no shape stays swollen.
    pulse(shapes) {
      if (!shapes.length) return;
      const a = run(shapes, { scale: [1, 1.1, 1], duration: 650, delay: motion.stagger(Math.min(40, 600 / shapes.length)), ease: 'inOutSine' }, null, () => a.revert());
    },
  };
}
