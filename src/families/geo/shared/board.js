// Shared by the geo and axes families: a JSXGraph board over a figure, its points and handles, the labels a figure
// hands over with note, and the Reset button. A wide screen writes each label beside its place, and a phone sets it
// on an edge with a line to that place (callouts.js). Its styles are the board rules in geo/client.css.
import JXG from 'jsxgraph';
import { svg, h } from '../../../kit/dom.js';
import { button, row } from '../../../kit/panel.js';
import { callouts, sides } from './callouts.js';

// wide gives a readout a character more room than its starting value, so the readouts mostly keep their rows as the
// values change.
export const wide = (k, words) => { k.width(String(words).length + 1); return k; };

// resetButton shows once the reader has moved something. It keeps its room while idle, so its showing up in the
// middle of a drag leaves the panel's height and the figure where they are.
export function resetButton(T, press) {
  const el = button({ label: T('reset'), act: 'reset', glyph: 'reset', compact: true, cls: 'geo-reset', press });
  return { el, idle: on => el.classList.toggle('geo-idle', on) };
}

// rest places Reset at the end of the readouts, so it takes no row of its own. On a challenge page without readouts
// it stands among the goal's buttons, where goalRow's actions put it. It gives the readouts' row, or null.
export function rest({ goal, chips, reset }) {
  if (chips.length || !goal) return row('out', [...chips, reset]);
  goal.hintText.before(reset);
  return null;
}

// plot gives a family its board. id is the family's id, which names the board's element. The observer and the
// listener it starts are made once for the family.
export function plot({ host, stage, peek }, id) {
  // The labels are boxes over an svg of their lines, in kitap's callout styles.
  const lines = svg('svg'), layer = h('div', { class: 'callouts' }, [lines]); stage.appendChild(layer);
  let board = null, box = null, notes = [], hot = null, points = {}, handles = [], skip = () => false, frame = 0;

  // JSXGraph writes colours as attributes, so the theme's are read here and the board is drawn again on a switch.
  const colours = () => Object.fromEntries(['ink', 'ink-2', 'accent', 'rule', 'paper'].map(n => [n.replace('-', ''), host.css(`--${n}`)]));
  const screen = p => { const c = new JXG.Coords(JXG.COORDS_BY_USER, p, board).scrCoords; return [box.offsetLeft + c[1], box.offsetTop + c[2]]; };

  // note hands a figure's label to the page, with the line and dot a phone draws to it. skip leaves out a label
  // that gives a challenge's answer away.
  function note({ id: ref, at, near, say, visible = () => true }) {
    if (skip(ref)) return;
    const div = h('div', { class: 'co' }, [h('b')]); layer.appendChild(div);
    const line = lines.appendChild(svg('line')), dot = lines.appendChild(svg('circle', { r: 2.5 }));
    notes.push({ id: ref, at, near, say, visible, div, line, dot, side: null });
  }
  // place sets the labels for the figure as it is now. A phone keeps each label on the side it got when the page was
  // drawn, and the labels stay clear of the peek card.
  function place() {
    const width = stage.clientWidth, height = stage.clientHeight - peek();
    if (!width || !board || !box) return; // The stage is hidden, as on a phone's text tab.
    const edge = host.phone.matches;
    layer.classList.toggle('geo-inline', !edge);
    if (!edge) {
      for (const n of notes) {
        const on = n.visible(); n.div.hidden = !on; n.line.style.display = n.dot.style.display = 'none'; n.div.classList.toggle('open', hot === n.id);
        if (!on) continue;
        n.div.firstChild.textContent = n.say();
        const [x, y] = screen(n.near());
        n.div.style.transform = `translate(${x - n.div.offsetWidth / 2}px, ${y - n.div.offsetHeight / 2}px)`;
      }
      return;
    }
    const anchors = notes.map(n => {
      const visible = n.visible(), [x, y] = visible ? screen(n.at()) : [0, 0];
      n.div.hidden = !visible; if (visible) n.div.firstChild.textContent = n.say();
      return { x, y, visible, side: n.side };
    });
    if (notes.some(n => !n.side)) sides(anchors).forEach((side, i) => { notes[i].side = anchors[i].side = side; });
    callouts(anchors, notes.map(n => ({ w: n.div.offsetWidth, h: n.div.offsetHeight })), { width, height }).forEach((c, i) => {
      const n = notes[i], on = hot === n.id;
      n.line.style.display = n.dot.style.display = c ? '' : 'none';
      n.line.classList.toggle('on', on); n.dot.classList.toggle('on', on); n.div.classList.toggle('open', on);
      if (!c) return;
      n.div.style.transform = `translate(${c.x}px, ${c.y}px)`;
      n.line.setAttribute('x1', c.from[0]); n.line.setAttribute('y1', c.from[1]); n.line.setAttribute('x2', c.to[0]); n.line.setAttribute('y2', c.to[1]);
      n.dot.setAttribute('cx', c.to[0]); n.dot.setAttribute('cy', c.to[1]);
    });
  }
  // A drag updates the board many times a frame, and the labels, which read the layout, follow once a frame.
  const soon = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); }); };
  new ResizeObserver(soon).observe(stage);
  host.phone.addEventListener('change', () => requestAnimationFrame(() => { board?.update(); place(); }));

  // free takes away the board and everything drawn over it, so nothing shows on the next page.
  function free() {
    cancelAnimationFrame(frame); frame = 0;
    if (board) JXG.JSXGraph.freeBoard(board);
    board = null; box?.remove(); box = null;
    for (const n of notes) n.div.remove();
    lines.replaceChildren();
    notes = []; points = {}; handles = []; hot = null;
  }

  // build draws a page's figure. bounds is the board's [x, y] range, values reads the reader's values, put sets
  // one and f is the formatter of the page's language. change runs after the reader moves a point, and slid after a handle moves sliders.
  function build({ spec, fig, bounds: [x, y], values, put, has, f, hides = () => false, change, slid }) {
    free(); skip = hides;
    box = h('div', { class: 'geo-board', id: `${id}-board` }); stage.prepend(box);
    const c = colours(), unit = Math.min(x[1] - x[0], y[1] - y[0]) / 20;
    board = JXG.JSXGraph.initBoard(box, { boundingbox: [x[0], y[1], x[1], y[0]], keepaspectratio: true, axis: false, showCopyright: false, showNavigation: false,
      showInfobox: false, pan: { enabled: false }, zoom: { enabled: false }, grid: spec.view.grid ? { majorStep: 1, minorElements: 1, major: { strokeColor: c.rule }, minor: { strokeColor: c.rule } } : false });
    for (const [pid, k] of Object.entries(spec.controls)) if (k.point) {
      const tone = k.drag ? c.accent : c.ink2;
      const p = points[pid] = board.create('point', values()[pid], { name: pid, size: k.drag ? 6 : 3, fixed: !k.drag, fillColor: tone, strokeColor: tone, highlightFillColor: tone, highlightStrokeColor: tone,
        snapToGrid: !!k.snap, snapSizeX: k.snap, snapSizeY: k.snap, label: { strokeColor: c.ink, highlightStrokeColor: c.ink, fontSize: 15, offset: [10, 10] } });
      // A dragged point stays inside the view, and where the figure keeps it, such as on a line.
      p.on('drag', () => {
        const inside = [Math.min(x[1], Math.max(x[0], p.X())), Math.min(y[1], Math.max(y[0], p.Y()))], at = fig.constrain ? fig.constrain(pid, inside) : inside;
        // A move the figure does not allow, such as one that crosses two sides, leaves the point where it was.
        const ok = !fig.allows || fig.allows({ ...values(), [pid]: at }), to = ok ? at : values()[pid];
        if (to[0] !== p.X() || to[1] !== p.Y()) p.setPositionDirectly(JXG.COORDS_BY_USER, to);
        put(pid, to); change();
      });
    }
    // A handle is a point the reader drags to move sliders. The figure says where it stands for the values and which
    // values a place gives, and each value keeps to its slider's range and step.
    const handle = ({ at, drag }) => {
      const point = board.create('point', at(), { name: '', withLabel: false, size: 6, fillColor: c.accent, strokeColor: c.accent, highlightFillColor: c.accent, highlightStrokeColor: c.accent });
      point.on('drag', () => {
        for (const [sid, to] of Object.entries(drag([point.X(), point.Y()]))) {
          const { slider: [low, high], step } = spec.controls[sid];
          put(sid, Number(Math.min(high, Math.max(low, Math.round(to / step) * step)).toFixed(6)));
        }
        point.setPositionDirectly(JXG.COORDS_BY_USER, at());
        slid?.(); change();
      });
      handles.push({ point, at });
    };
    // A figure writes its numbers with fmt and a point with coords, from the formatter of the page's language.
    const drawn = fig.draw({ board, values, has, colors: c, unit, fmt: f.fmt, coords: f.coords, spec, note, handle });
    board.on('update', soon);
    board.update(); place();
    return { shape: drawn?.shape ?? null, colours: c };
  }

  return {
    build, free, screen, colours,
    svgRoot: () => board?.renderer.svgRoot,
    // moved puts the handles where the sliders now say and draws the figure again.
    moved() { for (const k of handles) k.point.setPositionDirectly(JXG.COORDS_BY_USER, k.at()); board?.update(); },
    // dragged lists the points the reader drags, the handles among them.
    dragged: spec => [...Object.keys(points).filter(p => spec.controls[p].drag).map(p => points[p]), ...handles.map(k => k.point)],
    // ring adds a circle over the figure at a place on the screen, which free takes away with the rest.
    ring: (cx, cy, cls) => lines.appendChild(svg('circle', { class: cls, cx, cy })),
    // point marks a label and grows the point it names.
    point(spec, ref, on) {
      hot = on ? ref : null; place();
      if (points[ref]) points[ref].setAttribute({ size: (spec.controls[ref].drag ? 6 : 3) + (on ? 3 : 0) });
    },
  };
}
