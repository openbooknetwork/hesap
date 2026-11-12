// Small helpers for building the page: SVG and HTML elements, escaping and the icons the panel uses.
const NS = 'http://www.w3.org/2000/svg';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// svg makes an SVG element with its attributes and children.
export function svg(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}
// h makes an HTML element. A text child is written as text, so it needs no escaping.
export function h(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  n.append(...[kids].flat());
  return n;
}
const ICONS = {
  reset: '<path d="M5.6 9.5A7 7 0 1 1 5 13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3.5 4.5v6.5h6.5z"/>',
  tick: '<path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  undo: '<path d="M9 7H15a5 5 0 0 1 0 10H8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 2.5v9L4 7z"/>',
};
export function icon(id) {
  const s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'currentColor', class: 'hesap-icon' });
  s.innerHTML = ICONS[id];
  return s;
}
// svgPoint gives a pointer event's place in the coordinates of an SVG element.
export function svgPoint(node, e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(node.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
