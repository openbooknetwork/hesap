// A step names only the pieces it changes. Every piece's full state at every step is what the steps so far made it,
// so any step shows at once. A piece starts where its `at` puts it, hidden unless a piece holds it.
const BASE = { x: 0, y: 0, turn: 0, scale: 1 };

export const before = scene => Object.fromEntries(scene.pieces.map(p => [p.id, { ...BASE, show: p.in ? 1 : 0, tone: p.tone ?? '', ...p.at }]));

export function states(scene) {
  let now = before(scene);
  return scene.steps.map(step => (now = { ...now, ...Object.fromEntries(Object.entries(step.set ?? {}).map(([id, s]) => [id, { ...now[id], ...s }])) }));
}
