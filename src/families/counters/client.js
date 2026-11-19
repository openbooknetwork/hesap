// The browser half of the counters family. It hands each page to the scene the page names. The scenes share the
// family's counters, ten frames, places and motion.
import bonds from './bonds.js';
import count from './count.js';
import match from './match.js';
import order from './order.js';
import add from './add.js';
import bar from './bar.js';
import { scenes } from './scenes.js';

const SCENES = { bonds, count, match, order, add, bar };

export default function counters(api) {
  const all = scenes(Object.fromEntries(Object.entries(SCENES).map(([name, make]) => [name, () => make(api)])), api.stage);
  return {
    show(spec, page) { all.show(spec.scene, spec, page); },
    hide() { all.hide(); },
    point(id, on) { all.now()?.point(id, on); },
    lang() { all.now()?.lang(); },
  };
}
