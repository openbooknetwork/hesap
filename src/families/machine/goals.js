// The goals a challenge page can name in challenge.goal. A goal names the scenes it works with, the kind of target
// it takes, what the reader has made so far (got), and whether a change is judged at once or when its run ends.
import { starts } from './format.js';

export const GOALS = {
  // The reader picks the rule hidden in the machine. A pick changes no run, so it is judged at once.
  rule: { scenes: ['mystery'], target: 'rule', judge: 'now', miss: true, set: v => { v.rule = v.target; }, got: v => v.guess },
  // The value that comes out at the end of the run is the target. It counts once the output has landed.
  output: { scenes: ['single', 'chain', 'maker'], target: 'number', judge: 'run', got: (v, scene, spec) => scene.measures.out(v, spec) },
};

// The goal holds when what the reader made equals the target, or a number lies within the page's tolerance of it.
export function met(goal, v, scene, spec) {
  const got = goal.got(v, scene, spec);
  return typeof v.target === 'number' ? Math.abs(got - v.target) <= (spec.challenge.tolerance ?? 0) + 1e-9 : got === v.target;
}

// opening gives the values a page opens with for one target of its challenge, the first unless another is named.
export function opening(spec, scene, target = spec.challenge?.targets[0]) {
  const v = starts(spec.controls, scene);
  if (spec.challenge) { v.target = target; GOALS[spec.challenge.goal]?.set?.(v); }
  return v;
}
