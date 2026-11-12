// Hesap's browser half. It is the shell every family draws in: it loads the family that owns a page's scene, gives
// it a stage and a panel, shows the story's cover on the overview and keeps the peek card clear of the panel.
import { fill } from 'hesap/kit/format.js';
import { tracker } from 'hesap/kit/motion.js';

window.KITAP_ENGINE = function hesap(host) {
  const ENGINE = host.engine;
  const root = document.createElement('div'); root.className = 'hesap'; host.el.map.appendChild(root);
  const cover = document.createElement('img'); cover.className = 'hesap-cover'; cover.alt = ''; cover.hidden = true; root.appendChild(cover);
  host.el.legendButton.hidden = true; host.el.legend.hidden = true; host.el.view.hidden = true;
  const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = import.meta.resolve('katex-dist/katex.min.css'); document.head.appendChild(sheet);
  const style = document.documentElement.style, peek = document.getElementById('peek');
  // loaded holds each family once its module has arrived. now is the family on show, and turn counts the pages
  // shown, so a family that arrives late does not draw a page the reader has left.
  const loaded = new Map(), loading = new Map();
  let now = null, turn = 0, page = null;

  // The peek card stands clear of the panel, and a figure stays clear of the peek card.
  const sizes = new ResizeObserver(() => { if (now) style.setProperty('--hesap-panel', `${now.panel.hidden ? 0 : now.panel.offsetHeight}px`); room(); });
  function room() { const p = host.padding(); style.setProperty('--hesap-peek', `${typeof p === 'number' ? 0 : p.bottom}px`); }
  if (peek) { sizes.observe(peek); new MutationObserver(room).observe(peek, { attributes: true, attributeFilter: ['hidden'] }); }
  host.phone.addEventListener('change', room);

  // The cover follows the screen: a story may hold a second cover for a dark screen.
  const dark = matchMedia('(prefers-color-scheme: dark)');
  function paint() { const src = dark.matches && host.B.coverDark ? host.B.coverDark : host.B.cover; if (src && !cover.hidden) cover.src = src; }

  // A family gets a box of its own with a stage and a panel, and the strings under its own prefix. The box joins
  // the page once the family is made, so a family that fails leaves nothing behind.
  function make(id, module) {
    const box = document.createElement('div'); box.className = `hesap-family hesap-${id}`; box.hidden = true;
    const head = document.createElement('div'); head.className = 'hesap-head'; head.hidden = true;
    const stage = document.createElement('div'); stage.className = 'hesap-stage';
    const panel = document.createElement('div'); panel.className = 'hesap-panel';
    box.append(head, stage, panel);
    // T gives a string of the family, or a shared one of hesap, with its {places} filled. It gives undefined for a
    // key with no string, so a family can ask for an optional one and fall back.
    const T = (key, vars) => fill(host.T()[`${id}_${key}`] ?? host.T()[`hesap_${key}`], vars);
    const api = { host, box, stage, panel, T, lang: () => host.lang(), moving: () => !host.reduced, motion: tracker(), data: host.B[ENGINE]?.[id] ?? {}, peek: () => { const p = host.padding(); return typeof p === 'number' ? 0 : p.bottom; } };
    const fam = { id, box, head, stage, panel, api, ...module.default(api) };
    root.appendChild(box); sizes.observe(panel);
    // A family builds its panel again as it likes, and the readouts are lifted each time.
    new MutationObserver(() => { if (now === fam) settle(fam); }).observe(panel, { childList: true });
    new ResizeObserver(() => { if (now === fam) settle(fam); }).observe(box);
    return fam;
  }
  // On a screen with room the readouts stand above the figure in large type, where the reader's eye is. On a
  // phone they stay in the panel under it.
  const ROOMY = { width: 700, height: 600 };
  function lift(fam) {
    const roomy = page?.id != null && fam.box.clientWidth >= ROOMY.width && fam.box.clientHeight >= ROOMY.height;
    const fresh = fam.panel.querySelector(':scope > .hesap-out'), held = fam.head.firstElementChild;
    if (roomy && fresh) fam.head.replaceChildren(fresh);
    else if (!roomy && held) { fam.panel.appendChild(held); }
    fam.head.hidden = !fam.head.childElementCount;
  }
  // settle puts the readouts in their place, then hides the panel of the overview and a panel with nothing in it.
  function settle(fam) {
    lift(fam);
    fam.panel.hidden = page.id == null || !fam.panel.childElementCount;
    style.setProperty('--hesap-panel', `${fam.panel.hidden ? 0 : fam.panel.offsetHeight}px`);
  }
  // A family that fails to load is tried again the next time one of its pages opens.
  function load(id) {
    if (!loading.has(id)) loading.set(id, import(`hesap/families/${id}/client.js`).then(m => { const f = make(id, m); loaded.set(id, f); return f; })
      .catch(err => { loading.delete(id); console.error(`hesap: the family ${id} did not load`, err); return null; }));
    return loading.get(id);
  }
  // guard runs a family's own code. A family that throws is taken off the stage, so the book keeps turning pages.
  function guard(what, fn) {
    try { return fn(); } catch (err) { console.error(`hesap: the family ${now?.id} failed in ${what} on page ${page?.id ?? 'overview'}`, err); leave(); }
  }
  // The line under the story's title says how this family's figures are moved.
  function lead() { host.lead(now?.api.T('lead')); }
  function leave() {
    if (!now) return;
    const fam = now; now = null;
    fam.api.motion.stop(); fam.box.hidden = true;
    try { fam.hide?.(); } catch (err) { console.error(`hesap: the family ${fam.id} failed in hide`, err); }
    style.setProperty('--hesap-panel', '0px'); lead();
  }
  function enter(fam, spec) {
    if (now !== fam) { leave(); now = fam; fam.box.hidden = false; }
    fam.api.motion.stop();
    guard('show', () => fam.show(spec, page));
    if (now !== fam) return;
    // A page that shows no readouts has nothing above its figure.
    if (!fam.panel.querySelector(':scope > .hesap-out')) fam.head.replaceChildren();
    settle(fam); room(); lead();
  }

  return {
    show(p) {
      page = p; turn++;
      // The overview shows the story's cover, or the overview scene of a story that has none.
      const spec = p[ENGINE]?.scene && !(p.id == null && host.B.cover) ? p[ENGINE] : null, mine = turn;
      cover.hidden = !!spec || !host.B.cover;
      if (!spec) { leave(); paint(); return; }
      const fam = loaded.get(spec.family);
      if (fam) return enter(fam, spec);
      // The stage stays empty while a family loads, so the last page's figure does not stand beside this page's text.
      leave();
      load(spec.family).then(f => { if (f && mine === turn) enter(f, spec); });
    },
    point(id, on) { if (now?.point) guard('point', () => now.point(id, on)); },
    lang() { if (now?.lang) guard('lang', () => now.lang()); lead(); },
    theme() { paint(); if (now?.theme) guard('theme', () => now.theme()); },
    escape() { if (now?.escape) guard('escape', () => now.escape()); },
  };
};
dispatchEvent(new Event('kitap-engine'));
