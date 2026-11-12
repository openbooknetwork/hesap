// These are the shapes a page can move, drawn as outlines with their corner P at (0, 0). Neither has a mirror line
// of its own, so a turn or a flip shows. marks are two more corners the figure follows with rays and arrows.
export const SHAPES = {
  F: { rings: [[[0, 0], [0.3, 0], [0.3, 0.6], [0.8, 0.6], [0.8, 0.9], [0.3, 0.9], [0.3, 1.2], [1, 1.2], [1, 1.5], [0, 1.5]]], marks: [[1, 1.5], [0.8, 0.6]] },
  // The house has its door and chimney to the right and a window cut out of it.
  house: { rings: [[[0, 0], [0.8, 0], [0.8, 0.6], [1.1, 0.6], [1.1, 0], [1.4, 0], [1.4, 1], [1.2, 1.17], [1.2, 1.55], [1, 1.55], [1, 1.34], [0.7, 1.6], [0, 1]],
    [[0.25, 0.4], [0.55, 0.4], [0.55, 0.7], [0.25, 0.7]]], marks: [[0.7, 1.6], [1.4, 0]] },
};
// This finds the middle of a shape's outline, which a label of P stands away from.
export const middle = shape => { const pts = shape.rings[0]; return { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length }; };
