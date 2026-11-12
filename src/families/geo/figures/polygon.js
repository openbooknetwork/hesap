// What every straight sided figure shares: its measures and its drawing. A figure hands in how its vertices follow
// from the values of its controls.
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

export const distance = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
// positive when the vertices run counterclockwise
export const signedArea = P => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const wrap = (P, i) => P[((i % P.length) + P.length) % P.length];
const heading = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);

// the two neighbours of vertex i, ordered so the interior angle runs counterclockwise from the first to the second
function arms(P, i) {
  const prev = wrap(P, i - 1), next = wrap(P, i + 1);
  return signedArea(P) >= 0 ? [next, prev] : [prev, next];
}
export function interiorAngle(P, i) {
  const [from, to] = arms(P, i), b = wrap(P, i);
  const t = heading(b, to) - heading(b, from);
  return (t < 0 ? t + TAU : t) * DEG;
}
// true when no two sides cross, which is what gives a figure an inside
const turn = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const cross = (a, b, c, d) => turn(a, b, c) !== turn(a, b, d) && turn(c, d, a) !== turn(c, d, b);
export function simple(P) {
  const n = P.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue; // neighbours across the closing side
    if (cross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false;
  }
  return true;
}
const perimeter = P => P.reduce((s, p, i) => s + distance(p, wrap(P, i + 1)), 0);
const angleSum = P => P.reduce((s, _, i) => s + interiorAngle(P, i), 0);

// vertices(values) returns the corners in order. names letters the corners of a figure with a fixed count, and adds
// a measure per corner and per side. alike marks a figure whose corners are all equal: one of them carries the value.
// count(controls) is the most corners the page's controls allow.
// formulas adds the figure's own to the ones every polygon has. A formula returns its steps in TeX: the quantity,
// then each step with its relation. m.n writes a number and m.rel picks = or ≈ for it.
export function polygon({ controls, vertices, names = null, alike = false, count = () => names.length, formulas = {} }) {
  const measures = {
    area: v => Math.abs(signedArea(vertices(v))),
    perimeter: v => perimeter(vertices(v)),
    'angle-sum': v => angleSum(vertices(v)),
  };
  if (alike) measures.angle = v => interiorAngle(vertices(v), 0);
  (names ?? []).forEach((name, i) => {
    const a = name.toLowerCase(), b = names[(i + 1) % names.length].toLowerCase();
    measures[`angle-${a}`] = v => interiorAngle(vertices(v), i);
    measures[`side-${a}${b}`] = v => { const P = vertices(v); return distance(P[i], wrap(P, i + 1)); };
  });

  const sides = P => P.map((p, i) => distance(p, wrap(P, i + 1)));
  const shared = {
    'angle-sum': (v, m) => { const P = vertices(v); return ['S', '= (n - 2) \\times 180^\\circ', `= (${P.length} - 2) \\times 180^\\circ`, `= ${m.n(angleSum(P), 1)}^\\circ`]; },
    perimeter: (v, m) => {
      const P = vertices(v), all = sides(P), total = perimeter(P);
      if (alike) return ['P', '= n \\times s', `= ${P.length} \\times ${m.n(all[0])}`, `${m.rel(total)} ${m.n(total)}`];
      return ['P', `${all.every(d => m.rel(d) === '=') ? '=' : '\\approx'} ${all.map(d => m.n(d)).join(' + ')}`, `${m.rel(total)} ${m.n(total)}`];
    },
  };

  // note({ id, at, near, say, visible }) hands a label to the page: a wide screen writes it at near(), a narrow
  // one sets it on the edge with a line to at(). The shape it returns is what a solved challenge lights up.
  function draw({ board, values, has, colors, unit, fmt, spec, note }) {
    const P = () => vertices(values()), most = count(spec.controls);
    const follower = at => board.create('point', [() => at()[0], () => at()[1]], { visible: false, withLabel: false, fixed: true });
    const letter = i => names?.[i].toLowerCase();

    const outline = board.create('curve', [[0], [0]], { strokeColor: colors.ink, strokeWidth: 2, fillColor: colors.accent, fillOpacity: 0.12, highlight: false, fixed: true });
    outline.updateDataArray = function update() { const p = P(); this.dataX = [...p, p[0]].map(q => q[0]); this.dataY = [...p, p[0]].map(q => q[1]); };

    for (let i = 0; i < most; i++) {
      const here = () => i < P().length, labelled = () => here() && (!alike || i === 0);
      if (has('angles')) {
        // the arc stays inside short sides
        const radius = () => { const p = P(), b = wrap(p, i); return Math.min(unit * 1.6, distance(b, wrap(p, i - 1)) * 0.3, distance(b, wrap(p, i + 1)) * 0.3); };
        board.create('angle', [follower(() => arms(P(), i)[0]), follower(() => wrap(P(), i)), follower(() => arms(P(), i)[1])],
          { radius, withLabel: false, fixed: true, highlight: false, visible: here, strokeColor: colors.accent, fillColor: colors.accent, fillOpacity: 0.25, orthoType: 'square' });
        // the line ends inside the arc, on the line that halves the angle
        const mid = () => { const p = P(), b = wrap(p, i), t = heading(b, arms(p, i)[0]) + interiorAngle(p, i) / DEG / 2; return [b[0] + Math.cos(t) * radius() * 0.6, b[1] + Math.sin(t) * radius() * 0.6]; };
        const beyond = () => { const p = P(), b = wrap(p, i), t = heading(b, arms(p, i)[0]) + interiorAngle(p, i) / DEG / 2, d = radius() + unit * 1.1; return [b[0] + Math.cos(t) * d, b[1] + Math.sin(t) * d]; };
        note({ id: alike ? 'angle' : `angle-${letter(i)}`, at: mid, near: beyond, say: () => `${fmt(interiorAngle(P(), i), 1)}°`, visible: labelled });
      }
      if (has('sides')) {
        const middle = () => { const p = P(), a = wrap(p, i), b = wrap(p, i + 1); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
        // outside the figure, off the middle of the side
        const off = () => { const p = P(), a = wrap(p, i), b = wrap(p, i + 1), d = distance(a, b) || 1, out = signedArea(p) >= 0 ? 1 : -1;
          return [(a[0] + b[0]) / 2 + out * (b[1] - a[1]) / d * unit, (a[1] + b[1]) / 2 - out * (b[0] - a[0]) / d * unit]; };
        note({ id: names ? `side-${letter(i)}${letter((i + 1) % names.length)}` : 'side', at: middle, near: off, say: () => fmt(distance(wrap(P(), i), wrap(P(), i + 1))), visible: labelled });
      }
    }
    if (has('area')) {
      const centre = () => { const p = P(); return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; };
      note({ id: 'area', at: centre, near: centre, say: () => `A = ${fmt(Math.abs(signedArea(P())))}` });
    }
    return { shape: outline };
  }

  return { controls, annotations: ['area', 'angles', 'sides'], measures, formulas: { ...shared, ...formulas }, draw, allows: v => simple(vertices(v)) };
}
