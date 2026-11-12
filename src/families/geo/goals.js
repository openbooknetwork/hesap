// A challenge page sets one of these goals. A goal checks the figure's values against one target of the page. A target
// maps measures to the values they should reach, each within the page's tolerance in the measure's own unit.
const near = (value, want, tolerance) => Math.abs(value - want) <= tolerance;
// corners(fig) lists the measures of a figure's lettered corners, such as angle-a.
const corners = fig => Object.keys(fig.measures).filter(id => /^angle-[a-z]$/.test(id));

// fits(fig) gives null for a figure the goal can judge and otherwise says what the goal needs. checks lists the measures
// a goal reads, which a page leaves out of its readouts. also names the parts of the goal beside the target's values.
const measures = {
  fits: () => null,
  checks: (fig, target) => Object.keys(target),
  met: (fig, values, target, tolerance) => Object.entries(target).every(([id, want]) => near(fig.measures[id](values), want, tolerance)),
  also: [],
};

const rightAngle = {
  fits: fig => corners(fig).length ? null : 'needs a figure with lettered corners, such as triangle or quadrilateral',
  checks: (fig, target) => [...corners(fig), ...Object.keys(target)],
  met: (fig, values, target, tolerance) => corners(fig).some(id => near(fig.measures[id](values), 90, tolerance)) && measures.met(fig, values, target, tolerance),
  also: ['right-angle'],
};

export const GOALS = { measures, 'right-angle': rightAngle };

// annotation(id) names the annotation that writes a measure on the figure. A challenge page leaves it out when its goal
// reads that measure.
export const annotation = id => id === 'area' ? 'area' : id.startsWith('angle') ? 'angles' : id === 'sector-area' ? 'sector' : null;
