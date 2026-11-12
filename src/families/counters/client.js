// The browser half of the counters family. It hands each page to the scene the page names. The scenes share the
// family's counters, ten frames, places and motion.
import bonds from './bonds.js';

const SCENES = { bonds };

export default function counters(api) {
  // made holds each scene once it has been made, and now is the scene on show.
  const made = {};
  let now = null;
  return {
    show(spec, page) {
      const next = made[spec.scene] ??= SCENES[spec.scene](api);
      if (now && now !== next) now.hide();
      now = next; now.show(spec, page);
    },
    hide() { now?.hide(); now = null; },
    point(id, on) { now?.point(id, on); },
    lang() { now?.lang(); },
  };
}
