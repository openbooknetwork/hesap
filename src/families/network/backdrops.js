// Pictures drawn behind a graph, named by a page's backdrop. Each is a list of SVG shapes as [tag, attributes].
export const BACKDROPS = {
  // Königsberg has a river with an island on the left, and on the right a stretch of land between its two arms
  river: [
    ['path', { class: 'water', d: 'M0 118C80 106 160 130 240 114S360 104 400 116L400 284C320 296 240 272 160 290S40 294 0 282Z' }],
    ['ellipse', { class: 'land', cx: 120, cy: 200, rx: 74, ry: 42 }],
    ['path', { class: 'land', d: 'M400 160L304 160C272 160 252 180 252 200C252 220 272 240 304 240L400 240Z' }],
  ],
};
