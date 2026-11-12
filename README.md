# Hesap

The maths engine of the Open Book Network. A page shows a figure the reader can move, with the numbers and
formulas in the text following it. Hesap runs under [kitap](../kitap), which builds the book.

## A page

```yaml
hesap:
  scene: counters/bonds        # the figure: a family and one of its scenes, from the table below
  look: frames                 # the scene's own fields
  frames: 2
  readout: [first, empty]
```

The text links a value as `[0](@first)` and a worked formula as `[...](@formula-<id>)`. The page writes the live
value in the link's place, and `kitap check` prints the words to write when a text differs from what the page
shows as it opens.

A challenge page adds a goal and its targets:

```yaml
hesap:
  scene: counters/bonds
  look: frames
  frames: 1
  challenge: { goal: make-whole, whole: 10, part: [1, 9] }
```

The page draws the challenge from those ranges as it opens and again on "Another one", so a reader meets new
numbers each time. The panel shows the goal in words and whether it is reached. The build draws 300 targets for
each challenge and fails a page where one is solved as the page opens or lies out of the controls' reach.

## Scenes

Scenes come in families. Each family is a folder under `src/families/`. A page names a scene as
`<family>/<scene>`. A family whose one scene has the family's name is named alone.

| Family | Scenes |
|---|---|
| `counters` | `bonds` |

`counters/bonds` shows a whole and its two parts: a part-whole diagram, one or two ten frames with counters of two
colours, a cup that hides a part and a list of the splits found. Its `index.mjs` holds the schema of its fields,
with a comment on every field.

The tag `prototypes` holds 13 more families from the prototype stories: `geo`, `axes`, `graph`, `wave`, `linear`,
`chance`, `machine`, `parts`, `grid`, `venn`, `balance`, `network` and `proof`. A family comes back from there with
the first story that needs it: `git checkout prototypes -- src/families/<id>`, then its line in `src/families.mjs`.

## Layout

```
src/index.mjs        the engine module kitap loads: finds a scene's family, checks the links in the text
src/families.mjs     the list of families
src/client.js        the browser shell: loads a family, gives it a stage and a panel, shows the cover
src/node.mjs         checks every family's Node half shares
src/kit/             what every family's browser half shares
src/families/<id>/   one family: index.mjs, client.js, client.css, i18n/, and its own modules
scripts/assemble.mjs writes src/client.css and src/i18n/ from the kit and every family
test/                the contract every family keeps: npm test
```

The kit:

| File | What it gives |
|---|---|
| `panel.js` | `slider`, `chip`, `button`, `segment`, `stepper`, `row` |
| `goal.js` | `goalRow`, the line a challenge shows |
| `text.js` | `live` for the links in the text, `math` for a formula |
| `play.js` | `player`, a Start button's run with a time slider |
| `random.js` | `dice` and `fresh`, the seeded draws of a challenge |
| `drag.js` | `drag` and `nudge` for pointer and arrow key dragging |
| `motion.js` | `tracker`, anime.js animations that a page change stops |
| `format.js` | `numbers` per language, `aligned`, `fill` |
| `dom.js` | `svg`, `h`, `icon`, `svgPoint`, `esc` |

## A family

The Node half, `index.mjs`:

```js
export default {
  id: 'counters',
  scenes: ['bonds'],                   // the scenes it owns
  schema,                              // strict zod object of a page's fields, without scene
  read(pg, { at, pid }, ctx) { ... },  // checks the page, returns { data, has, offers }
  start(spec, lang, id) { ... },       // the words a link shows when the page opens
  bundle(content) { ... },             // optional: { data, families }, data.overview is the overview scene
};
```

The browser half, `client.js`:

```js
export default function counters({ host, box, stage, panel, T, lang, moving, motion, data }) {
  return { show(spec, page) { ... }, hide() { ... }, point(id, on) { ... }, lang() { ... } };
}
```

`families/counters/` is the family to read first. A new family is added to `src/families.mjs`.

Strings sit in the family's `i18n/en.yaml` and `i18n/tr.yaml` under the prefix `<id>_`, and `<id>_lead` is the
line the book shows under the story's title. Styles sit in the family's `client.css` under `.hesap-<id>`. Run
`node scripts/assemble.mjs` after a change to either.

## Libraries

anime.js animates and KaTeX sets formulas. A family that draws with a library of its own names it in the engine's
`client.imports`, so it loads with that family alone.

Kitap serves hesap's browser modules from a folder named after hesap's version. A release raises the version in
`package.json`.
