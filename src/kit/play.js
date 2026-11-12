// A run that plays by itself. Start plays it once to its end, and a slider beside it goes back and forth through
// the same run. There is no Pause: a reader who drags the slider takes over.
// player drives time t from 0 to 1 over duration milliseconds. at draws the run at t, and now reads where the run
// stands. ease maps the share of time that has passed to t.
export function player({ duration, at, now, moving, ease = x => x, onState }) {
  let raf = 0;
  const state = on => onState?.(on);
  function halt() { if (!raf) return; cancelAnimationFrame(raf); raf = 0; state(false); }
  // A run that has ended plays again from the beginning, and again runs first to let the family draw a new one.
  function start(again) {
    halt();
    let from = now();
    if (from >= 1) { again?.(); from = 0; }
    if (!moving()) return at(1);
    const span = duration * (1 - from); let t0 = 0;
    state(true);
    const step = t => {
      t0 ||= t;
      const x = Math.min(1, (t - t0) / span);
      at(from + (1 - from) * ease(x));
      if (x < 1) raf = requestAnimationFrame(step); else { raf = 0; state(false); }
    };
    raf = requestAnimationFrame(step);
  }
  return { start, halt, playing: () => !!raf };
}
