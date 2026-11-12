// The formatter writes an angle, a number and a worked formula in a language. The browser writes the live values with
// it, and the build writes the starting values to check what a page's text types.
import { measureOf } from './scenes.js';
import { numbers, aligned } from '../../kit/format.js';

// NONE is what a readout shows where a measure has no value, as tan θ has at 90°.
const NONE = { en: 'none', tr: 'yok' };

// starts gives the angle and the sliders where the page opens.
export const starts = spec => ({ angle: spec.angle, ...Object.fromEntries(Object.entries(spec.controls).map(([id, c]) => [id, c.start ?? c.slider[0]])) });

export function formatter(lang) {
  const N = numbers(lang), fmt = (n, digits = 2) => N.fmt(n, digits), deg = n => `${fmt(n, 1)}°`;
  // A formula writes numbers with t. n writes TeX, rel picks = or ≈, and p puts brackets round a factor below 0.
  const t = {
    n: (x, digits = 2) => N.tex(x, digits),
    d: x => `${t.n(x, 1)}^\\circ`,
    rel: (...xs) => xs.every(x => Math.abs(x - Number(x.toFixed(2))) < 1e-9) ? '=' : '\\approx',
    p: x => fmt(x) === fmt(Math.abs(x)) ? t.n(x) : `(${t.n(x)})`,
  };
  // value is what a link or a readout shows, an angle in degrees or a number, and null for a link to anything else.
  const value = (scene, v, id) => {
    const m = measureOf(scene, id);
    if (!m) return null;
    const x = m.of(v);
    return x === null ? NONE[lang] ?? NONE.en : m.kind === 'deg' ? deg(x) : fmt(x);
  };
  const steps = (scene, v, id) => scene.formulas[id](v, t);
  const worked = (scene, v, id) => aligned(steps(scene, v, id));
  // written puts the formula on one line of plain text, as a page's text writes it.
  const written = (scene, v, id) => steps(scene, v, id).map(plain).join(' ');
  return { fmt, deg, value, worked, written };
}

// plain turns the TeX of the scenes into plain text. Their fractions, powers and Greek letters would make every step
// long to write twice, so the family reads its own TeX back.
const FRAC = /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g;
const plain = tex => tex
  .replace(FRAC, (_, a, b) => { [a, b] = [plain(a), plain(b)]; return / /.test(a + b) ? `${a} / ${b}` : `${a}/${b}`; })
  .replace(/\^\\circ/g, '°').replace(/\^2/g, '²')
  .replace(/\\(sin|cos|tan)(?=\\)/g, '$1 ').replace(/\\(sin|cos|tan)/g, '$1')
  .replace(/\\theta/g, 'θ').replace(/\\varphi/g, 'φ').replace(/\\pi/g, 'π').replace(/\\times/g, '×').replace(/\\approx/g, '≈')
  .replace(/\{,\}/g, ',').replace(/-/g, '−').replace(/\s+/g, ' ').trim();
