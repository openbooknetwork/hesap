# Hesap

The maths engine of the Open Book Network. A page shows a figure the reader can move, with the numbers and
formulas in the text following it. Hesap runs under [kitap](../kitap), which builds the book.

## A page

```yaml
hesap:
  scene: chance/flips          # the figure: a family and one of its scenes, from the table below
  trials: 2000                 # the scene's own fields
  readout: [heads, share-heads, gap]
```

The text links a value as `[0](@heads)` and a worked formula as `[...](@formula-share)`. The page writes the live
value in the link's place, and `kitap check` prints the words to write when a text differs from what the page
shows as it opens.

A challenge page adds a goal and its targets:

```yaml
hesap:
  scene: chance/dice
  trials: 1000
  challenge:
    goal: sum-chance
    targets: [[1, 12], [1, 18]]
```

The panel then shows the goal in words, whether it is reached, Hint and Another one.

## Scenes

Scenes come in families. Each family is a folder under `src/families/`. A page names a scene as
`<family>/<scene>`. A family whose one scene has the family's name is named alone, such as `scene: venn`.

| Family | Scenes |
|---|---|
| `geo` | `circle`, `triangle`, `rectangle`, `quadrilateral`, `regular-polygon` |
| `axes` | `number-line`, `point`, `quadrants`, `distance`, `point-3d`, `distance-3d`, `polar-point`, `to-polar`, `radians`, `spiral`, `rose`, `cylinder`, `sphere`, `cube`, `cuboid`, `prism`, `pyramid`, `solid-cylinder`, `cone`, `ball`, `net` |
| `graph` | `plot`, `secant`, `tangent`, `slope`, `area`, `accumulate` |
| `wave` | `unit`, `sine`, `cosine`, `stretch`, `shift`, `general`, `sum`, `tangent`, `spring` |
| `linear` | `slide`, `turn`, `mirror`, `stretch`, `matrix` |
| `chance` | `coin`, `flips`, `die`, `dice`, `means`, `galton` |
| `machine` | `single`, `mystery`, `chain`, `map`, `maker` |
| `parts` | `shade`, `fraction`, `equivalent`, `simplest`, `compare`, `add`, `mixed`, `convert`, `between` |
| `grid` | `multiples`, `common`, `factors`, `sieve`, `width`, `remainders`, `spiral`, `mark`, `two` |
| `venn` | `venn` |
| `balance` | `balance` |
| `network` | `network` |
| `proof` | `proof` |

Each family's `index.mjs` holds the schema of its scenes' fields, with a comment on every field.

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
| `drag.js` | `drag` and `nudge` for pointer and arrow key dragging |
| `motion.js` | `tracker`, anime.js animations that a page change stops |
| `format.js` | `numbers` per language, `aligned`, `fill` |
| `dom.js` | `svg`, `h`, `icon`, `svgPoint`, `esc` |

## A family

The Node half, `index.mjs`:

```js
export default {
  id: 'chance',
  scenes: ['coin', 'flips'],           // the scenes it owns
  schema,                              // strict zod object of a page's fields, without scene
  read(pg, { at, pid }, ctx) { ... },  // checks the page, returns { data, has, offers }
  start(spec, lang, id) { ... },       // the words a link shows when the page opens
  bundle(content) { ... },             // optional: { data, families }, data.overview is the overview scene
};
```

The browser half, `client.js`:

```js
export default function chance({ host, box, stage, panel, T, lang, moving, motion, data }) {
  return { show(spec, page) { ... }, hide() { ... }, point(id, on) { ... }, lang() { ... } };
}
```

`families/chance/` is the family to read first. A new family is added to `src/families.mjs`.

Strings sit in the family's `i18n/en.yaml` and `i18n/tr.yaml` under the prefix `<id>_`, and `<id>_lead` is the
line the book shows under the story's title. Styles sit in the family's `client.css` under `.hesap-<id>`. Run
`node scripts/assemble.mjs` after a change to either.

## Libraries

JSXGraph plots and draws geometry, anime.js animates, and KaTeX sets formulas. A family that draws with JSXGraph
imports it (`import JXG from 'jsxgraph'`), so it loads with that family alone.

Kitap serves hesap's browser modules from a folder named after hesap's version. A release raises the version in
`package.json`.
