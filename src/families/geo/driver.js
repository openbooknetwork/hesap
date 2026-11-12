// The geo family's animation, in milliseconds. A solved challenge flashes the figure's outline once, and the outline
// gets its own stroke and fill back when the flash ends or is cut short.
const clear = el => { el.style.removeProperty('stroke-width'); el.style.removeProperty('fill-opacity'); };

export function flash(motion, outline) {
  if (outline) motion.run(outline, { strokeWidth: '6px', fillOpacity: 0.4, duration: 320, loop: 1, alternate: true, ease: 'outQuad' }, () => clear(outline), () => clear(outline));
}
