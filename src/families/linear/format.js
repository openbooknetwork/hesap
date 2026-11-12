// This file writes the values in a language. The readouts and the text get numbers, points and angles, and each
// worked formula comes as TeX for the page and as plain text, which is what the check asks a text to type.
import { SCENES, run, context } from './scenes.js';
import { PRESETS, times, det } from './matrices.js';
import { numbers } from '../../kit/format.js';

// A page can link its scene's formulas, one for each named matrix it moves through, and both orders of a pair.
export function formulas(spec) {
  const [p, q] = spec.named;
  return [...SCENES[spec.scene].formulas, ...spec.named, ...(q ? [`${p}-then-${q}`, `${q}-then-${p}`] : [])];
}

export function formatter(lang) {
  const N = numbers(lang), num = n => N.fmt(n), tex = n => N.tex(n), pt = p => N.pair(p.x, p.y);
  // the rows of a matrix stand apart as the two numbers of a point do
  const sep = N.comma ? '; ' : ', ';
  const par = n => n < 0 ? `(${num(n)})` : num(n), tpar = n => n < 0 ? `(${tex(n)})` : tex(n);
  const rows = m => `(${pt({ x: m[0], y: m[1] })}${sep}${pt({ x: m[2], y: m[3] })})`;
  // each column takes the colour of the arrow it says where to put
  const col = (k, n) => `\\htmlClass{linear-${k}}{${tex(n)}}`;
  const box = m => `\\begin{bmatrix} ${col('i', m[0])} & ${col('j', m[1])} \\\\ ${col('i', m[2])} & ${col('j', m[3])} \\end{bmatrix}`;
  const down = (p, k) => `${k ? `\\htmlClass{linear-${k}}` : ''}{\\begin{pmatrix} ${tex(p.x)} \\\\ ${tex(p.y)} \\end{pmatrix}}`;

  // A link or a readout shows this, or null for an id the scene does not measure. t is a challenge's target.
  function value(spec, v, id, t = 0) {
    if (id === 'target') return spec.challenge?.goal === 'det' ? num(spec.challenge.targets[t]) : null;
    const scene = SCENES[spec.scene];
    if (!scene.measures.includes(id)) return null;
    const map = scene.map(v), m = map.m, { P } = context(spec);
    switch (id) {
      case 'P': return pt(P);
      case 'image': return pt(run(map, P));
      case 'vector': return pt({ x: v.tx, y: v.ty });
      case 'centre': return pt({ x: v.cx, y: v.cy });
      case 'angle': case 'tilt': return `${num(v[id])}°`;
      case 'area-scale': return num(v.k ** 2);
      case 'i': return pt({ x: m[0], y: m[2] });
      case 'j': return pt({ x: m[1], y: m[3] });
      case 'det': return num(det(m));
      case 'area': return num(Math.abs(det(m)));
      case 'matrix': return rows(m);
      default: return num(v[id]);
    }
  }

  // This writes a formula as TeX and as text.
  function steps(spec, v, id) {
    const scene = SCENES[spec.scene], map = scene.map(v), m = map.m, { P } = context(spec), to = run(map, P);
    if (id === 'matrix') return { tex: `A = ${box(m)}`, text: `A = ${rows(m)}` };
    if (id === 'det') {
      const [a, b, c, d] = m;
      return { tex: `\\det A = ad - bc = ${tex(a)} \\times ${tpar(d)} - ${tpar(b)} \\times ${tpar(c)} = ${tex(det(m))}`,
        text: `det A = ad − bc = ${num(a)} × ${par(d)} − ${par(b)} × ${par(c)} = ${num(det(m))}` };
    }
    if (id === 'image' && spec.scene === 'slide') return { tex: `P' = P + v = (${tex(P.x)}, ${tex(P.y)}) + (${tex(v.tx)}, ${tex(v.ty)}) = (${tex(to.x)}, ${tex(to.y)})`,
      text: `P′ = P + v = ${pt(P)} + ${pt({ x: v.tx, y: v.ty })} = ${pt(to)}` };
    if (id === 'image' && spec.scene === 'stretch') {
      const C = { x: v.cx, y: v.cy }, step = { x: P.x - C.x, y: P.y - C.y };
      // The formula takes two lines to fit the width of the text.
      return { tex: `\\begin{aligned} P' &= C + k \\times (P - C) \\\\ &= (${tex(C.x)}, ${tex(C.y)}) + ${tpar(v.k)} \\times (${tex(step.x)}, ${tex(step.y)}) = (${tex(to.x)}, ${tex(to.y)}) \\end{aligned}`,
        text: `P′ = C + k × (P − C) = ${pt(C)} + ${par(v.k)} × ${pt(step)} = ${pt(to)}` };
    }
    // the corner P is P.x steps along i and P.y steps along j, wherever the arrows point
    if (id === 'image') return { tex: `A\\,P = ${tex(P.x)}\\,${down({ x: m[0], y: m[2] }, 'i')} + ${tpar(P.y)}\\,${down({ x: m[1], y: m[3] }, 'j')} = ${down(to)}`,
      text: `A P = ${num(P.x)} × ${pt({ x: m[0], y: m[2] })} + ${par(P.y)} × ${pt({ x: m[1], y: m[3] })} = ${pt(to)}` };
    if (PRESETS[id]) return { tex: `${PRESETS[id].letter} = ${box(PRESETS[id].m)}`, text: `${PRESETS[id].letter} = ${rows(PRESETS[id].m)}` };
    // When p comes first and q second, q acts on what p made, so its matrix stands on the left.
    const [p, q] = id.split('-then-'), [A, B] = [PRESETS[p], PRESETS[q]], both = times(B.m, A.m);
    return { tex: `${B.letter}\\,${A.letter} = ${box(B.m)} ${box(A.m)} = ${box(both)}`, text: `${B.letter} ${A.letter} = ${rows(B.m)} ${rows(A.m)} = ${rows(both)}` };
  }
  return { value, num, worked: (spec, v, id) => steps(spec, v, id).tex, written: (spec, v, id) => steps(spec, v, id).text };
}
