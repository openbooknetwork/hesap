// Hesap's Node half, the engine module kitap loads. A page names a scene under the hesap key, and the family that
// owns the scene reads the rest of the page's fields, checks them and says what each link in the text shows when
// the page opens.
import path from 'path';
import { fileURLToPath } from 'url';
import { schema } from '@openbooknetwork/kitap';
import FAMILIES from './families.mjs';
import { LINK, list, links } from './node.mjs';

const { z, check } = schema;
const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const family = id => FAMILIES.find(f => f.id === id);
// A page names a scene as <family>/<scene>, such as counters/bonds. A family whose one scene has the family's name is
// named alone.
const nameOf = (fam, scene) => scene === fam.id ? scene : `${fam.id}/${scene}`;
const SCENES = FAMILIES.flatMap(f => f.scenes.map(s => nameOf(f, s)));
function owner(name) {
  const [id, scene, more] = name.split('/'), fam = family(id), own = scene ?? id;
  return fam && more === undefined && fam.scenes.includes(own) ? { fam, scene: own } : null;
}

export const PageHesap = z.object({ scene: z.string() }).passthrough();

// has remembers which links each page holds, so finish checks only those.
const HAS = new Map(), keyOf = (ctx, pid) => `${ctx.where}/${pid}`;

function readPage(fields, info, ctx) {
  const { scene: name, ...rest } = check(PageHesap, fields, info.at), own = owner(name);
  if (!own) { ctx.fail(info.at, `scene is "${name}", the scenes are ${list(SCENES)}`); return { data: {} }; }
  const { fam, scene } = own, r = fam.read({ scene, ...check(fam.schema, rest, info.at) }, info, ctx);
  HAS.set(keyOf(ctx, info.pid), r.has);
  return { data: { ...r.data, scene, family: fam.id }, links: links(r.has, r.offers) };
}

// A text types into each link what the page shows when it opens, and a text that differs is told what to write.
function finish({ pages, texts }, ctx) {
  // A page whose page.yaml failed has no family, and its problem is printed already.
  for (const pg of pages.filter(p => p.hesap?.family)) {
    const fam = family(pg.hesap.family), has = HAS.get(keyOf(ctx, pg.id));
    for (const [lang, text] of Object.entries(texts[pg.id] ?? {})) for (const [, name, id] of text.matchAll(LINK)) {
      // Kitap reports a link the page does not hold, so the family is asked only about its own.
      if (has && !has(id)) continue;
      ctx.attempt(path.join(ctx.root, pg.dir), () => {
        const want = fam.start(pg.hesap, lang, id);
        if (want !== null && want !== undefined && name !== want) ctx.fail(`${pg.dir}/text/${lang}.md`, `[${name}](@${id}) differs from what the page shows at the start, write [${want}](@${id})`);
      });
    }
  }
  return {};
}

// A story's bundle holds the data and the colour families of the families its pages use. A story with no cover
// opens on the overview scene of its first page's family, or on its first page's figure.
function bundle(content) {
  const data = {}, families = {}, from = {}, pages = (content.pages ?? []).filter(p => p.hesap?.family);
  for (const id of new Set(pages.map(p => p.hesap.family))) {
    const b = family(id).bundle?.(content) ?? {};
    if (b.data) data[id] = b.data;
    for (const [name, colour] of Object.entries(b.families ?? {})) {
      if (from[name]) throw new Error(`hesap: the families ${from[name]} and ${id} both define the colour "${name}", rename one`);
      from[name] = id; families[name] = colour;
    }
  }
  const first = pages[0]?.hesap;
  if (first) data.overview = data[first.family]?.overview ? { ...data[first.family].overview, family: first.family } : first;
  return { data, families, credits: [] };
}

export default {
  id: 'hesap',
  dir: PKG,
  schemas: { page: PageHesap },
  ui: new URL('./i18n/', import.meta.url),
  // The browser imports hesap's own modules and KaTeX's stylesheet through kitap's import map, from folders named
  // after each package's version. A family that draws with a library of its own adds it here, so the library
  // loads with that family alone.
  client: { script: new URL('./client.js', import.meta.url), styles: new URL('./client.css', import.meta.url), module: true,
    libraries: [['animejs', 'dist/bundles/anime.umd.min.js'], ['katex', 'dist/katex.min.js']],
    imports: { 'hesap/': ['@openbooknetwork/hesap', 'src'], 'katex-dist/': ['katex', 'dist'] } },
  read: { page: readPage, finish },
  bundle,
};
