// The browser half of the line family. The family has one scene, the number line, so it hands every page to it.
import line from './line.js';

export default function family(api) {
  const scene = line(api);
  return {
    show(spec, page) { scene.show(spec, page); },
    hide() { scene.hide(); },
    point(id, on) { scene.point(id, on); },
    lang() { scene.lang(); },
  };
}
