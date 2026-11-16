// The scenes of a family share one stage, and one of them shows at a time. A scene adds its svg to the stage as it
// is made. A scene off show takes its svg off the stage, so the scene on show gets every touch.
export function scenes(makers, stage) {
  // made holds each scene once it has been made, with its svg, and now is the scene on show.
  const made = {};
  let now = null;
  const make = name => { const scene = makers[name](); return { scene, svg: stage.lastElementChild }; };
  const off = () => { if (!now) return; now.scene.hide(); now.svg.setAttribute('display', 'none'); now = null; };
  return {
    show(name, ...page) {
      const next = made[name] ??= make(name);
      if (now !== next) off();
      now = next; now.svg.removeAttribute('display'); now.scene.show(...page);
    },
    hide: off,
    now: () => now?.scene ?? null,
  };
}
