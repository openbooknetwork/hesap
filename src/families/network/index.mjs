// The Node half of the network family: a graph of vertices and edges the reader changes with tools. It reads the
// fields of a page and checks them against the vertices, the tools and the measures a page can name.
import { schema } from '@openbooknetwork/kitap';
import { measure, starts, FORMULAS, NAMES } from './measures.js';
import { formatter } from './format.js';
import { GOALS, holds } from './goals.js';
import { SIZE, MOST } from './layout.js';
import { dijkstra } from './graph.js';
import { list, challenge, hidden } from '../../node.mjs';

const { z } = schema;
export const TOOLS = ['move', 'add', 'join', 'remove', 'walk', 'route', 'weight', 'paint'];
export const MARKS = ['degree', 'odd', 'distance', 'cycles', 'conflicts', 'crossings', 'faces'];
// An edge is A-B, or A-B: 4 for an edge with a length.
const Edge = z.union([z.string(), z.record(z.string(), z.number().int().positive())]);
const Fields = z.object({
  nodes: z.record(z.string(), z.tuple([z.number(), z.number()])), // Each vertex stands at x and y from 0 to 400, with y down.
  edges: z.array(Edge).default([]),
  tools: z.array(z.enum(TOOLS)).min(1), // The tools under the figure. The first one starts chosen.
  readout: z.array(z.string()).default([]),
  marks: z.array(z.enum(MARKS)).default([]), // What the figure marks on the graph.
  route: z.object({ from: z.string(), to: z.string() }).strict().optional(), // The ends of the route the page opens with.
  // A slider runs Dijkstra's search from the route's start one step at a time, and the page opens at this step.
  search: z.number().int().min(0).optional(),
  palette: z.number().int().min(2).max(6).default(4), // Paint offers this many colours.
  range: z.tuple([z.number().int().positive(), z.number().int().positive()]).default([1, 20]), // The lengths an edge can take.
  parallel: z.boolean().default(false), // Two vertices may be joined by more than one edge.
  backdrop: z.enum(['river']).optional(), // A picture drawn behind the graph.
  goal: z.string().optional(), // The goal the page's text sets, which the page says is reached.
  // A challenge page's goal, and further sets of lengths for its edges that Another one deals in turn.
  challenge: z.object({ goal: z.string(), others: z.array(z.record(z.string(), z.number().int().positive())).default([]) }).strict().optional(),
}).strict();

function read(pg, { at }, ctx) {
  const order = Object.keys(pg.nodes), bad = (ok, msg) => ok || ctx.fail(at, msg);
  for (const n of order) bad(/^[A-Z]$/.test(n), `nodes names "${n}", name a vertex with one capital letter`);
  bad(order.length <= MOST, `nodes lists ${order.length} vertices, a graph holds at most ${MOST}`);
  for (const [n, [x, y]] of Object.entries(pg.nodes)) bad(x >= 0 && x <= SIZE && y >= 0 && y <= SIZE, `nodes.${n} stands at ${x}, ${y}, keep x and y from 0 to ${SIZE}`);
  const edges = pg.edges.map((raw, i) => {
    const [name, w] = typeof raw === 'string' ? [raw, null] : Object.entries(raw)[0] ?? [];
    bad(typeof raw === 'string' || Object.keys(raw).length === 1, `edges.${i} names ${Object.keys(raw).length} edges, write one edge per line as A-B: 4`);
    const [a, b, more] = String(name).split('-');
    bad(a && b && more === undefined, `edges.${i} is "${name}", write an edge as two vertices joined by a hyphen, A-B`);
    for (const v of [a, b]) bad(order.includes(v), `edges.${i} names "${v}", the vertices are ${list(order)}`);
    bad(a !== b, `edges.${i} joins ${a} to itself, an edge joins two different vertices`);
    return { id: `e${i + 1}`, a, b, w };
  });
  const weighted = edges.filter(e => e.w != null).length;
  bad(!weighted || weighted === edges.length, 'edges give lengths to some edges only, give every edge a length or none');
  if (!pg.parallel) edges.forEach((e, i) => bad(!edges.slice(0, i).some(f => (f.a === e.a && f.b === e.b) || (f.a === e.b && f.b === e.a)), `edges lists ${e.a}-${e.b} twice, write parallel: true to join two vertices more than once`));
  if (pg.route) for (const end of ['from', 'to']) bad(order.includes(pg.route[end]), `route.${end} names "${pg.route[end]}", the vertices are ${list(order)}`);
  bad(!pg.tools.includes('route') || pg.route, 'tools offers route, write route: { from: A, to: B } for the route the page opens with');
  bad(pg.search == null || pg.route, 'search runs from the route\'s start, write route: { from: A, to: B }');
  bad(pg.search == null || pg.marks.includes('distance'), 'search shows the distances it finds, write marks: [distance]');
  bad(!pg.tools.includes('weight') || weighted, 'tools offers weight, give each edge a length, A-B: 4');
  bad(pg.range[0] <= pg.range[1], `range runs from ${pg.range[0]} down to ${pg.range[1]}, write the shorter length first`);
  bad(new Set(pg.tools).size === pg.tools.length, 'tools lists a tool twice, list each tool once');
  for (const id of pg.readout) bad(measure(id, order), `readout names "${id}", write ${list(NAMES)}`);
  for (const id of pg.readout) bad(!['from', 'to', 'distance', 'path'].includes(id) || pg.route, `readout names ${id}, write route: { from: A, to: B } for the route it measures`);
  const graph = { order, nodes: Object.fromEntries(order.map(n => [n, { x: pg.nodes[n][0], y: pg.nodes[n][1] }])), edges };
  if (pg.search != null && pg.route && order.includes(pg.route.from)) {
    const most = dijkstra(graph, pg.route.from).steps.length;
    bad(pg.search <= most, `search opens at step ${pg.search}, the search from ${pg.route.from} ends after ${most} steps`);
  }
  // A goal is one the family checks, out of reach at the start and within reach of the graph.
  bad(!(pg.goal && pg.challenge), 'the page names a goal and a challenge, a challenge page names its goal in challenge.goal only');
  let goal = null;
  if (pg.challenge) {
    goal = challenge(pg.challenge, GOALS, { scene: pg.scene, at, ctx }) && pg.challenge.goal;
    if (goal) hidden(pg.readout, GOALS[goal].hides ?? [], at, ctx);
  } else if (pg.goal) {
    if (GOALS[pg.goal]) goal = pg.goal; else ctx.fail(at, `goal names "${pg.goal}", the goals are ${list(Object.keys(GOALS))}`);
  }
  const same = (e, key) => key.split('-').sort().join('-') === [e.a, e.b].sort().join('-');
  const others = (pg.challenge?.others ?? []).map((set, k) => {
    bad(!pg.parallel, `challenge.others.${k} gives lengths by edge, which parallel edges leave unclear, drop parallel: true or others`);
    bad(weighted, `challenge.others.${k} gives new lengths, give the edges their first lengths in edges, A-B: 4`);
    for (const key of Object.keys(set)) bad(edges.some(e => same(e, key)), `challenge.others.${k} names "${key}", which is no edge, the edges are ${list(edges.map(e => `${e.a}-${e.b}`))}`);
    const miss = edges.find(e => !Object.keys(set).some(key => same(e, key)));
    bad(!miss, `challenge.others.${k} gives no length to ${miss?.a}-${miss?.b}, give every edge a length`);
    return edges.map(e => set[Object.keys(set).find(key => same(e, key))]);
  });
  if (goal) for (let k = 0; k <= others.length; k++) {
    const st = starts({ graph, route: pg.route, challenge: { others } }, k), where = k ? ` with challenge.others.${k - 1}` : '';
    const why = GOALS[goal].reach?.(st, pg);
    bad(!why, `the goal ${goal} is out of reach${where}, because ${why}`);
    bad(!holds(GOALS[goal].check(st, st)), `the page opens with the goal ${goal} reached${where}, start the graph further from it`);
  }
  // A text links a vertex or a measure by its id, and a worked formula as formula-<id>.
  const worked = Object.keys(FORMULAS).map(f => `formula-${f}`);
  return {
    data: { ...pg, nodes: undefined, edges: undefined, graph, goal, challenge: pg.challenge ? { others } : null },
    has: id => order.includes(id) || worked.includes(id) || !!measure(id, order),
    offers: `a vertex (${list(order)}), a measure (${list(NAMES)}) or a formula (${list(worked)})`,
  };
}

// A link to a measure holds its starting value, and a link to a formula the formula worked for the starting graph.
// A link to a vertex keeps its words.
function start(spec, lang, id) {
  const f = formatter(lang), s = starts(spec);
  return id.startsWith('formula-') ? f.written(s, id.slice(8)) : f.value(s, id);
}

export default { id: 'network', scenes: ['network'], schema: Fields, read, start };
