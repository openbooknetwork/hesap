// The goals a page can set, by name. A goal's check takes the graph now and the graph the page opened with. It gives
// true once the goal holds, false while it does not, or the key of a line that tells the reader how close they are.
// hint names a mark the Hint button shows, reach says why a page's graph cannot reach the goal, and hides lists the
// readouts that give the answer away. The build and the browser both use this file.
import * as G from './graph.js';

const kept = (s, start) => start.order.every(n => s.nodes[n]);
const walked = s => s.edges.length > 0 && s.walk.used.length === s.edges.length;

export const GOALS = {
  // Every edge is crossed once by the reader's walk.
  walked: { check: walked },
  // Every edge is crossed once by a walk that ends where it started.
  circuit: { check: s => walked(s) && (s.walk.at === s.walk.trail[0] || 'open'), hint: 'odd',
    reach: s => G.pieces(s).length > 1 ? 'the graph is in more than one piece, so no walk crosses every edge' : null },
  // Every vertex is painted, and no edge joins two vertices of one colour.
  coloured: { check: s => s.order.every(n => s.paint[n] != null) && !G.clashes(s, s.paint).length, hides: ['chromatic'],
    reach: (s, spec) => G.fewest(s) > spec.palette ? `the graph needs ${G.fewest(s)} colours and palette offers ${spec.palette}` : null },
  // The graph is a tree.
  tree: { check: s => s.order.length > 1 && G.tree(s) },
  // The tree keeps every starting vertex and has the smallest total length the starting graph allows.
  'cheapest-tree': { check: (s, start) => !kept(s, start) ? 'lost' : G.tree(s) && (G.total(s) <= G.cheapest(start) || 'dearer'), hint: 'cycles',
    reach: s => G.pieces(s).length > 1 ? 'the graph is in more than one piece, so no tree joins every vertex' : null },
  // No two edges cross.
  untangled: { check: s => !G.crossings(s).length },
};
// holds says whether a check's answer means the goal holds.
export const holds = v => v === true;
