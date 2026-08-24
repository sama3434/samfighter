/* Mode select: two humans, or one human against the computer.

   Sits in front of the character select. Pure state, same as select.js --
   the drawing lives in render/mode.js, so this can be stepped in a test.

   A single player might have either hand on the keyboard, so both players'
   movement clusters (and Enter) drive the one cursor here. */

export const MODES = ['vs', 'cpu'];
export const LEVELS = 5;
export const LEVEL_NAMES = ['NOVICE', 'BRAWLER', 'WARRIOR', 'MASTER', 'CHAMPION'];

export class ModeScreen {
  constructor({ schemes, sound = null }) {
    this.schemes = schemes;
    this.sound = sound;
    this.reset();
  }

  reset() {
    this.stage = 'mode';     // 'mode' | 'level'
    this.cursor = 0;         // 0 = vs player, 1 = vs computer
    this.levelCursor = 2;    // default to the middle difficulty
    this.frame = 0;
    this.nudge = 0;          // frames of cursor-move animation left
  }

  blip() { if (this.sound) this.sound.whiff(); }
  thunk() { if (this.sound) this.sound.block(); }

  /** One tick. Returns { mode: 'vs' } or { mode: 'cpu', level: 1..5 } on the
      frame a choice is confirmed, else null. */
  update(input) {
    this.frame++;
    if (this.nudge > 0) this.nudge--;

    const has = (k) => input.pressed.has(k);
    const any = (action) => this.schemes.some((s) => has(s[action]));
    const left = any('left');
    const right = any('right');
    const confirm = any('up') || any('punch') || any('kick') || has('enter');
    const back = any('down') || any('block') || has('escape');

    let out = null;
    if (this.stage === 'mode') {
      if (left || right) { this.cursor = 1 - this.cursor; this.nudge = 6; this.blip(); }
      if (confirm) {
        if (this.cursor === 0) { out = { mode: 'vs' }; this.thunk(); }
        else { this.stage = 'level'; this.thunk(); }
      }
    } else {
      if (left) { this.levelCursor = (this.levelCursor + LEVELS - 1) % LEVELS; this.nudge = 6; this.blip(); }
      else if (right) { this.levelCursor = (this.levelCursor + 1) % LEVELS; this.nudge = 6; this.blip(); }
      if (confirm) { out = { mode: 'cpu', level: this.levelCursor + 1 }; this.thunk(); }
      else if (back) { this.stage = 'mode'; this.blip(); }
    }

    input.pressed.clear();
    return out;
  }
}
