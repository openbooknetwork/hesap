// A tracker runs anime.js animations and remembers the ones still running, so a page change can stop them all.
// Times are in milliseconds.
export function tracker() {
  // live maps each running animation to what runs when a page change cuts it short.
  const { animate, createTimeline, stagger } = window.anime, live = new Map(), groups = new Set();
  // CSS transforms on SVG scale and turn an element about its own middle.
  const centre = els => { for (const e of [els].flat()) if (e?.style) { e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center'; } return els; };
  // anime.js keeps one then for each animation, so an animation ends through onComplete and done runs there. A
  // run that stop cuts short never reaches done, and cut runs in its place, to take away what the run added.
  function run(targets, params, done, cut) {
    const a = animate(targets, { ...params, onComplete: () => { live.delete(a); params.onComplete?.(); done?.(); } });
    live.set(a, cut);
    return a;
  }
  // An effect on an element that stays on the page goes back to where it began when it is cut short.
  const effect = (targets, params) => { const a = run(targets, params, null, () => a.revert()); return a; };
  // timeline runs phases one after another. Each phase is the params of one animation with its targets.
  function timeline(phases, done, defaults = {}, cut) {
    const tl = createTimeline({ defaults, onComplete: () => { live.delete(tl); done?.(); } });
    for (const { targets, at, ...params } of phases) tl.add(targets, params, at);
    live.set(tl, cut);
    return tl;
  }
  return {
    run, timeline, stagger, centre,
    // group gives a tracker of its own, so a family can stop one kind of animation and let the others run. The
    // page's stop ends every group too.
    group() { const g = tracker(); groups.add(g); return g; },
    stop() {
      const cuts = [...live];
      live.clear();
      for (const [a, cut] of cuts) { a.pause(); cut?.(); }
      for (const g of groups) g.stop();
    },
    // adopt prepares every element of class a under root for scaling about its middle.
    adopt(root) { centre([...root.querySelectorAll('.a')]); },
    // A value that changed jumps once.
    flash: el => effect(centre(el), { scale: [1, 1.08, 1], duration: 320, ease: 'outQuad' }),
    pop: el => effect(centre(el), { scale: [1, 1.25, 1], duration: 320, ease: 'outQuad' }),
    pulse: el => effect(centre(el), { scale: [1, 1.08, 1], duration: 420, ease: 'outQuad' }),
    // The parts that reach a goal swell once, one after another.
    cheer: els => els.length ? effect(centre(els), { scale: [1, 1.2, 1], duration: 520, delay: stagger(Math.min(60, 400 / els.length)), ease: 'outBack' }) : null,
  };
}
