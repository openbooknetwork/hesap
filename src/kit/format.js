// How numbers and worked formulas are written in a language. The browser and the build both use it, so a page's
// text and its live values agree.
const MINUS = '−';
// fill puts values into a string's {name} places. A string with one {x} takes a plain value.
export function fill(s, vars) {
  if (vars === undefined || vars === null || s === undefined) return s;
  return typeof vars === 'object' ? s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m) : s.replace('{x}', () => vars);
}
export function numbers(lang) {
  const nf = (min, max) => new Intl.NumberFormat(lang, { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false });
  const grouped = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
  const comma = nf(1, 1).format(0.5).includes(',');
  // -0 is written as 0, and a negative number takes the real minus sign.
  const sign = s => /^-0([.,]0*)?$/.test(s) ? s.slice(1) : s.replace(/^-/, MINUS);
  return {
    comma,
    // fmt writes a number with up to max decimals, and fix with exactly n.
    fmt: (n, max = 2) => sign(nf(0, max).format(n)),
    fix: (n, digits) => sign(nf(digits, digits).format(n)),
    // int writes a count with the language's grouping of thousands. fmt and fix write a measure, which has none.
    int: n => sign(grouped.format(n)),
    // A pair of coordinates takes a semicolon where the language writes decimals with a comma.
    pair: (a, b, max = 2) => `(${sign(nf(0, max).format(a))}${comma ? '; ' : ', '}${sign(nf(0, max).format(b))})`,
    // tex writes a number for KaTeX, which needs braces round a decimal comma and a plain minus.
    tex: (n, max = 2) => nf(0, max).format(n).replace(/^-0([.,]0*)?$/, '0').replace(',', '{,}'),
    // brace makes a number that is written already safe for KaTeX, which spaces a bare comma as punctuation.
    brace: s => s.replace(/,/g, '{,}'),
    // percent writes a share such as 0.25 as 25%, with the sign on the side the language puts it.
    percent: (n, max = 0) => new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: max }).format(n),
  };
}
// aligned sets the steps of a worked formula under one another at their equals signs. The first step is the name
// and each later step starts with its relation, such as "= 12".
export const aligned = ([what, ...rest], gap = '0.4em') => `\\begin{aligned} ${what} &${rest.join(` \\\\[${gap}] &`)} \\end{aligned}`;
