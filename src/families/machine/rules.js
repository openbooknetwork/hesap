// The rules a machine can hold. A page names them, and this file is the only place that knows what they do. tex and
// text write the rule applied to a, as TeX and as plain text.
export default {
  double: { label: '× 2', apply: x => 2 * x, tex: a => `2 \\times ${a}`, text: a => `2 × ${a}` },
  'add-2': { label: '+ 2', apply: x => x + 2, tex: a => `${a} + 2`, text: a => `${a} + 2` },
  'add-3': { label: '+ 3', apply: x => x + 3, tex: a => `${a} + 3`, text: a => `${a} + 3` },
  square: { label: 'x²', apply: x => x * x, tex: a => `${a}^2`, text: a => `${a}²` },
  'minus-1': { label: '− 1', apply: x => x - 1, tex: a => `${a} - 1`, text: a => `${a} − 1` },
};
