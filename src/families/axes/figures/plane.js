// What the flat figures share: the axes with a tick at every whole number, and a point that follows a function.
// The ticks write their numbers with the page's fmt.
export function axes({ board, colors, fmt }, { x = true, y = true } = {}) {
  const ticks = { insertTicks: false, ticksDistance: 1, minorTicks: 0, strokeColor: colors.rule, majorHeight: 8, label: { strokeColor: colors.ink2, highlightStrokeColor: colors.ink2, fontSize: 12 },
    generateLabelText(tick, zero, value) { return fmt(value ?? this.getDistanceFromZero(zero, tick)); } };
  const axis = (name, to, offset) => board.create('axis', [[0, 0], to], { strokeColor: colors.ink2, highlightStrokeColor: colors.ink2, strokeWidth: 1.5, fixed: true, highlight: false, ticks,
    name, withLabel: true, label: { position: 'rt', offset, strokeColor: colors.ink2, highlightStrokeColor: colors.ink2, fontSize: 14 } });
  if (x) axis('x', [1, 0], [-14, 14]);
  if (y) axis('y', [0, 1], [10, -8]);
}
export const follower = (board, at, attrs = {}) => board.create('point', [() => at()[0], () => at()[1]], { visible: false, withLabel: false, fixed: true, highlight: false, name: '', ...attrs });
export const dashed = (board, a, b, colors) => board.create('segment', [a, b], { strokeColor: colors.ink2, strokeWidth: 1.5, dash: 2, fixed: true, highlight: false });
