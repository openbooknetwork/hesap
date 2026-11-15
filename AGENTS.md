# Agents

Working notes for coding agents in this repository. `README.md` covers the project for people.

Hesap is the maths engine of the Open Maths Book, whose content is in `../maths`. The book installs hesap from npm.
To try a change before a release, link the source there with `npm install ../hesap` and put the released version back
before a commit. The book's `agents/story.md` says how a story is checked.

## How hesap is built

- The core (`src/index.mjs`, `src/client.js`) finds the family of a page's scene, gives it a stage and a panel,
  shows the story's cover or the family's overview scene, and checks every link in the text.
- The kit (`src/kit/`) holds what every family shares: `panel.js` (slider, chip, button, segment, stepper),
  `goal.js` (the challenge line), `text.js` (live values and formulas in the text), `drag.js`, `motion.js`
  (anime.js with a tracker), `play.js` (Start and a time slider), `format.js` (numbers per language) and `dom.js`.
  A need that two families share goes into the kit.
- A family's Node half exports `id`, `scenes`, `schema`, `read`, `start` and an optional `bundle`. Its browser half
  exports a function that takes the core's `api` and returns `show`, `hide`, `point`, `lang` and `theme`.
- A family's `client.css` holds its figure's rules under `.hesap-<id>`, and its strings sit in `i18n/en.yaml` and
  `i18n/tr.yaml` with the prefix `<id>_`. `node scripts/assemble.mjs` in hesap writes `src/client.css` and
  `src/i18n/` from every family, and runs after a change to either. `npm test` in hesap checks every family's
  contract, strings and styles.
- YAML declares and JS computes. A page's YAML names a scene, its controls with their ranges, its starting values
  and the measures to read out. Every rule, formula and check is a named function in the family.
- Phones are first class. Every page works by touch at 390px wide with the same interaction as a wide screen.
  Dragging uses pointer events, and a touch target is about 44px.
- The book's Prev and Next are the only way through the steps of the content. A sequence of steps is a sequence of
  pages. A page has no Play or Pause button. A step animates when its motion is the idea, such as pieces that
  slide into a new arrangement, and that page gets a time slider, as in `proof`. A step that only shows a
  result appears without motion.
- A simulation or a move that runs by itself begins when the reader presses Start, as in `chance` and `linear`.
  Start runs it once to the end, and a slider beside it goes back and forth through the same run.
- Controls and readouts are HTML, docked under the figure, so a phone shows the figure and its controls on one
  screen.
- JSXGraph plots and draws geometry. anime.js animates, and was chosen over GSAP and Motion for its
  MIT licence and readable code. KaTeX sets formulas. Hand-written SVG suits scenes that are not plots.
- Motion marks a change the reader made (a pop, a pulse, a glide into place) and is skipped when `api.moving()` is
  false. A page shows its figure at once when it opens.
- The text follows the figure. A text links a measure or a control as `[12.57](@area)` and a worked formula as
  `[A = ...](@formula-area)`. The page replaces the link's words with the live value. The family's `start` gives
  each one for the page's starting state, and `kitap check` prints the words to write when a text differs.
- In `geo` and `axes` a figure hands each label to the page with `note`. A wide screen writes it beside
  its place, and a phone sets it on an edge with a line to that place (`geo/shared/callouts.js`).
- A challenge page declares `challenge: { goal: <name>, ... }`. The goal is a named function in the family's
  `goals.js`, which the build and the browser both load. It is checked after every change the reader makes, and a
  drag or a run counts when it ends. `kitap check` fails a page that names an unknown goal, starts solved, shows a
  readout that gives the answer away, or has a target its controls cannot reach.
- A reader cannot predict a challenge. The release spec asks for targets that the engine draws when the page opens
  and again on "Another one", from what the page declares. The prototypes still list fixed `targets`, and a new
  challenge is written to be drawn.
- Colours are the theme's CSS tokens (`--paper`, `--panel`, `--ink`, `--ink-2`, `--rule`, `--accent`), so a theme
  switch needs no redraw.

## Kitap facts a family author needs

- Browser modules end in `.js`. The dev server serves `.mjs` with a type that browsers refuse to run.
- `show` receives the overview scene with `page.id == null`. The core shows the story's cover in its place when the
  story has one.
- `host.phone` is the media query for 900px and below, `host.reduced` is the reduced motion preference, and
  `api.T(key)` reads a family's string, then a shared `hesap_` string.
- On a phone the text card `#peek` covers the foot of the stage until the reader closes it. A figure leaves
  `var(--hesap-peek)` free at its foot.

## Traps

- Take the pointer with `setPointerCapture` after any DOM move of the dragged element. Moving an element releases
  its capture, and the drag then freezes when the pointer leaves the element. End a drag on `pointerup`,
  `pointercancel` and `lostpointercapture`.
- Scripted `PointerEvent`s have no pointer to capture, so they pass where a real drag fails. Test dragging with real
  input through the DevTools protocol (`Input.dispatchMouseEvent`).
- Set `touch-action:none` on the `<svg>` or the stage box. Chrome ignores it on elements inside an SVG and cancels
  a touch drag after two or three moves. A mouse drag passes either way, so test with real touch input
  (`Input.dispatchTouchEvent`).
- A focused handle that moves on arrow keys calls `stopPropagation` as well as `preventDefault`. The kitap shell
  turns the page on Left and Right for any key event that reaches it.
- When several agents work at once, each tests against its own `kitap build --out <dir>` served as static files.
- anime.js keeps only the last `then` callback on an animation, so a second `then` replaces the first. A driver
  ends an animation through `onComplete` and takes a done callback.
- Kitap hides every `[hidden]` element outright. A control that must keep its room while hidden uses `visibility`.
- Headless Chrome throttles animations in a test script that leaves out `Page.bringToFront` and
  `Emulation.setFocusEmulationEnabled`.
- Kitap's own CSS classes, such as `.legend`, reach into a family's markup. Prefix every class with the family id.
- Kill only the headless Chrome a test started, by its process id. A `pkill` by name ends other sessions' captures.
- A panel that changes height during a drag resizes the stage and shifts the figure under the pointer. Keep its
  height stable while the reader drags.
- Two dev servers that share an `--out` directory overwrite each other. Give each its own `--out` and `--port`.
- In zsh, quote a glob passed to a tool (`--include='*.js'`).
