// How fractions, decimals, percents and worked formulas are written in a language, in TeX for the page and as plain
// text for the words a page's text types. The browser writes the live values with it, and the build the starting ones.
import SCENES from './scenes.js';
import GOALS, { target } from './goals.js';
import { read, expand, mixed } from './fraction.js';
import { numbers, aligned } from '../../kit/format.js';

// The values a page opens with: each fraction's start, each slider's, and the scene's own state. On a challenge page
// round picks the target, which its goal sets up before the scene builds its state.
export function starts(spec, round = 0) {
  const v = {}, c = spec.challenge;
  for (const [id, f] of Object.entries(spec.fractions)) v[id] = read(f.start);
  for (const [id, s] of Object.entries(spec.controls ?? {})) v[id] = s.start ?? s.slider[0];
  if (c) { v.round = round; v.target = target(c.goal, c.targets[round % c.targets.length]); GOALS[c.goal].round?.(v, v.target); }
  return Object.assign(v, SCENES[spec.scene].state?.(v, spec));
}
// staged() gives a page's scene with the values its goal lets a text link added to the scene's own.
export const staged = spec => {
  const scene = SCENES[spec.scene], goal = spec.challenge && GOALS[spec.challenge.goal];
  return goal ? { ...scene, measures: { ...scene.measures, ...goal.measures } } : scene;
};

// a link to a written fraction, such as @1/2, shows that fraction
export const literal = id => read(id);

export function writers(lang) {
  const N = numbers(lang), point = N.comma ? ',' : '.';
  // Languages put the percent sign on different sides, 50% in English and %50 in Turkish. The kit writes no percents.
  const pp = new Intl.NumberFormat(lang, { style: 'percent' }).formatToParts(0.5), first = pp.findIndex(p => p.type === 'percentSign') < pp.findIndex(p => p.type === 'integer');
  const gap = pp.find(p => p.type === 'literal')?.value ?? '';
  const both = (tex, plain) => ({ tex, plain });
  const make = mode => {
    const T = mode === 'tex', sign = T ? '\\%' : '%';
    const digits = e => `${e.whole}${e.once || e.repeat ? (T && point === ',' ? '{,}' : point) + e.once : ''}${e.repeat ? (T ? `\\overline{${e.repeat}}` : [...e.repeat].map(c => c + '\u0305').join('')) : ''}`;
    const w = {
      times: T ? '\\times' : '×', div: T ? '\\div' : '÷',
      n: x => T ? N.tex(x, 0) : N.fmt(x, 0),
      f: f => T ? `\\frac{${f.n}}{${f.d}}` : `${f.n}/${f.d}`,
      fx: (a, b) => T ? `\\frac{${a}}{${b}}` : [a, b].map(s => / /.test(s) ? `(${s})` : s).join('/'),
      mixed(f) { const m = mixed(f); return m.whole && m.n ? (T ? `${m.whole}\\frac{${m.n}}{${m.d}}` : `${m.whole} ${m.n}/${m.d}`) : m.n ? w.f(m) : String(m.whole); },
      dec: f => digits(expand(f.n, f.d)),
      per: x => first ? sign + (T ? '' : gap) + x : x + (T ? '' : gap) + sign,
      pct: f => w.per(digits(expand(100 * f.n, f.d))),
      sign: s => ['<', '=', '>'][s + 1],
      // v() writes any value a measure gives.
      v: x => ({ frac: () => w.f(x), number: () => w.n(x.x), decimal: () => w.dec(x), percent: () => w.pct(x), mixed: () => w.mixed(x), sign: () => w.sign(x.s),
        list: () => x.items.map(w.f).join(' = ') })[x.kind ?? 'frac'](),
    };
    return w;
  };
  return both(make('tex'), make('plain'));
}

export function formatter(lang) {
  const W = writers(lang);
  // value() gives what a link shows as plain text, or null for a link to anything but a written fraction or a measure.
  const value = (scene, v, id) => literal(id) ? W.plain.f(literal(id)) : scene.measures[id] ? W.plain.v(scene.measures[id].value(v)) : null;
  // math() gives the same in TeX, for the values the page sets as formulas.
  const math = (scene, v, id) => literal(id) ? W.tex.f(literal(id)) : scene.measures[id] ? W.tex.v(scene.measures[id].value(v)) : null;
  const worked = (scene, v, id) => aligned(scene.formulas[id](v, W.tex), '0.5em');
  // written() puts the formula on one line of plain text, as a page's text writes it.
  const written = (scene, v, id) => scene.formulas[id](v, W.plain).join(' ');
  return { ...W, value, math, worked, written };
}
