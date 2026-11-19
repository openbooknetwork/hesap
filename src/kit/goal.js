// The line a challenge page shows above its controls: the goal in words, whether it is reached, a hint and another
// target. Every family judges with its own goal and shows the result here.
import { h, icon } from './dom.js';
import { button } from './panel.js';

// T gives the shared strings. hint is a function that shows or hides the family's hint and is left out on a page
// without one, and another moves to the next target. actions are more buttons for the line. A quiet line is for a
// page whose title states the goal: it has no goal text and says nothing until the goal is reached.
export function goalRow({ T, hint, another, motion, actions = [], quiet = false }) {
  const text = h('p', { class: 'hesap-goal-text' }), state = h('span', { class: 'hesap-goal-state', role: 'status' });
  const hintText = h('p', { class: 'hesap-hint', hidden: true });
  let done = false, hinted = false;
  // hold keeps the goal line and the status at the tallest they have been on this page, so the panel keeps its
  // height as the goal line, a note and the done line take turns, and the figure above does not rebuild.
  const tallest = new Map();
  const hold = node => { node.style.minHeight = ''; const h = Math.max(node.offsetHeight, tallest.get(node) ?? 0); tallest.set(node, h); if (h) node.style.minHeight = `${h}px`; };
  // A hint is words, or an element the family built, such as a formula. kept says the hint opens again after a
  // change of language, so the family shows it without marking it as new.
  const toggle = kept => {
    hinted = !hinted; hintBtn.setAttribute('aria-expanded', hinted);
    const words = hint(hinted, kept); hintText.replaceChildren(...(words ? [words] : [])); hintText.hidden = !hinted || !words;
  };
  const hintBtn = hint ? button({ label: T('hint'), act: 'hint', press: () => toggle(false) }) : null;
  hintBtn?.setAttribute('aria-expanded', 'false');
  text.hidden = quiet;
  const el = h('div', { class: `hesap-goal${quiet ? ' hesap-quiet' : ''}` }, [text, state, another ? button({ label: T('another'), act: 'another', press: another }) : null, hintBtn, ...actions, hintText].filter(Boolean));
  return {
    el, text, hintText,
    // say writes the goal. A family that sets formulas in the goal writes into text itself.
    say(words) { if (words instanceof Node) text.replaceChildren(words); else if (text.textContent !== (words ?? '')) text.textContent = words ?? ''; hold(text); },
    // show says whether the goal is reached. note is a line of progress for a goal not reached yet. It returns true
    // the first time the goal is reached, when the family cheers.
    show(reached, note) {
      const words = reached ? T('solved') : note ?? (quiet ? '' : T('not-yet'));
      if (state.dataset.words !== words) { state.dataset.words = words; state.replaceChildren(...(reached ? [icon('tick'), h('b', {}, words)] : [words])); }
      el.classList.toggle('solved', reached);
      hold(state);
      const first = reached && !done; done = reached;
      if (first) motion?.pop(state);
      return first;
    },
    reached: () => done,
    hinted: () => hinted,
    // keep carries over the state of the line this one replaces, when a change of language builds the panel again.
    // A goal reached already stays reached without its pop, and an open hint opens again.
    keep(old) {
      if (!old) return;
      done = old.reached();
      if (old.hinted() && hintBtn && !hinted) toggle(true);
    },
    // closeHint closes an open hint, for a family whose figure needs the room once the goal is reached.
    closeHint() { if (hinted) toggle(false); },
    // reset closes the hint and forgets the last result, for another target.
    reset() { done = false; hinted = false; hintBtn?.setAttribute('aria-expanded', 'false'); hintText.hidden = true; },
  };
}
