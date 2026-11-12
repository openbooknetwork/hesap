// The values in a page's text follow the figure. A text links a value as [words](@id) and a worked formula as
// [words](@formula-id), and kitap leaves a span with data-ref in their place.
// live writes every link of the story. value gives the words of an id or null for a link the family does not own,
// and formula gives the TeX of a worked formula. tex gives the TeX of a value that is set as a formula in its line,
// such as a fraction, and null for a value written as words.
export function live(host, { value, formula, tex, katex = {} }) {
  for (const span of host.el.story.querySelectorAll('.place[data-ref]')) {
    const id = span.dataset.ref;
    if (id.startsWith('formula-')) {
      const tex = formula?.(id.slice(8));
      if (tex == null || span.dataset.tex === tex) continue;
      span.dataset.tex = tex; span.dataset.formula = ''; span.removeAttribute('tabindex');
      window.katex.render(tex, span, { displayMode: true, throwOnError: false, ...katex });
      continue;
    }
    const source = tex?.(id);
    if (source != null) { math(span, source, false, katex); span.dataset.live = ''; continue; }
    const text = value(id);
    if (text == null) continue;
    if (span.textContent !== text) span.textContent = text;
    span.dataset.live = '';
  }
}
// math sets a short piece of TeX inside an element. options go to KaTeX, such as trust for \\htmlClass.
export const math = (node, tex, display = false, options = {}) => { if (node.dataset.tex !== tex) { node.dataset.tex = tex; window.katex.render(tex, node, { displayMode: display, throwOnError: false, ...options }); } return node; };
