// The machine's motion on the family's tracker. Each move is one timeline in milliseconds. It resolves true when the
// move ends, and false when a new run or a page change stops it.
export function driver(motion) {
  // A run's timelines are a group of their own, so a new run stops them and lets a cheer finish.
  const { utils } = window.anime, runs = motion.group();
  // pace above 1 plays faster.
  const move = (phases, defaults, pace = 1) => new Promise(done => {
    const fast = phases.map(({ at, duration, ...p }) => ({ ...p, duration: duration && duration / pace, at: at === undefined ? undefined : at / pace }));
    runs.timeline(fast, () => done(true), defaults, () => done(false));
  });
  return {
    place(el, props) { utils.set(el, props); },
    stop: () => runs.stop(),

    // A token moves over the funnel and falls in.
    feed: (token, { mouth, inside }, pace) => move([
      { targets: token, x: mouth.x, y: mouth.y - 30, duration: 550 },
      { targets: token, y: inside.y, scale: 0.35, opacity: 0, duration: 400, ease: 'inQuad' }], { ease: 'inOutQuad' }, pace),

    // The result appears at the chute and moves down to its place.
    emit(token, { exit, to }, pace) {
      utils.set(token, { x: exit.x, y: exit.y, scale: 0.35, opacity: 0 });
      return move([{ targets: token, scale: 1, opacity: 1, duration: 250, at: 150 }, { targets: token, x: to.x, y: to.y, duration: 550 }], { ease: 'outQuad' }, pace);
    },

    // Two machines trade places, one swinging out to each side.
    swap(a, b, top, low) {
      const swing = (targets, side) => ({ targets, x: [top.x, top.x + side * 110, top.x], duration: 900, ease: 'inOutSine', at: 0 });
      return move([{ targets: a, y: low.y, at: 0, duration: 900 }, swing(a, -1), { targets: b, y: top.y, at: 0, duration: 900 }, swing(b, 1)], { ease: 'inOutQuad' });
    },

    // A new machine grows out of the chute and moves down to its place.
    assemble(machine, { from, to }) {
      utils.set(machine, { x: from.x, y: from.y, scale: 0.15, opacity: 1 });
      return move([{ targets: machine, x: to.x, y: to.y, scale: 1, duration: 900 }], { ease: 'inOutQuad' });
    },

    // What reached a goal pops, and its halo settles round it.
    cheer(el) {
      motion.run(el, { scale: [1.4, 1], duration: 900, ease: 'outElastic(1, .45)' });
      const halo = el.querySelector('.halo');
      if (halo) motion.run(halo, { r: [22, 32], strokeWidth: [12, 3], duration: 650, ease: 'outQuad' });
    },

    // A wrong pick shakes once.
    shake(el) { motion.run(el, { x: [0, -6, 6, -4, 4, 0], duration: 360, ease: 'inOutSine' }); },
  };
}
