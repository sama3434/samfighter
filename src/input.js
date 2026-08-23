/* Keyboard state. `held` is the live key set; `pressed` holds this tick's
   fresh presses and is consumed by the simulation each frame.

   Nothing here reaches for the document directly except attachInput(), so a
   test can build a bare {held, pressed} pair and drive a fighter with it. */

export const SCHEMES = [
  { left: 'a', right: 'd', up: 'w', down: 's', punch: 'f', kick: 'g', block: 'h' },
  { left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
    punch: ',', kick: '.', block: '/' },
];

export function createInput() {
  return { held: new Set(), pressed: new Set() };
}

export const input = createInput();

// keys the browser would otherwise scroll or quick-find with
const SWALLOW = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', '/', "'"]);

export function attachInput(target, onFirstKey) {
  target.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (SWALLOW.has(k)) e.preventDefault();
    if (!e.repeat) input.pressed.add(k);
    input.held.add(k);
    if (onFirstKey) onFirstKey();
  });
  target.addEventListener('keyup', (e) => input.held.delete(e.key.toLowerCase()));
  target.addEventListener('blur', () => { input.held.clear(); input.pressed.clear(); });
}
