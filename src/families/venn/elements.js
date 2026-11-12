// How an element is drawn. A fruit has a picture, and a number or a letter is drawn as itself.
const FRUIT = { apple: '🍎', pear: '🍐', cherry: '🍒', lemon: '🍋', grapes: '🍇', banana: '🍌', orange: '🍊', strawberry: '🍓', melon: '🍉', peach: '🍑', kiwi: '🥝', pineapple: '🍍' };
export const show = id => FRUIT[id] ?? id;
export const pictured = id => id in FRUIT;
