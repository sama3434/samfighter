/* Title / attract screen: the first thing a fresh page load shows.

   Pure state, same as mode.js and select.js -- the drawing lives in
   render/title.js, so this can be stepped in a test.

   It also happens to be the audio gate. Browsers hold the audio context until
   a user gesture, and the keypress that dismisses this screen is that
   gesture, so nothing has to be invented to unlock the sound: by the time the
   mode screen appears the music is already allowed to play. */

export class TitleScreen {
  constructor({ schemes, sound = null }) {
    this.schemes = schemes;
    this.sound = sound;
    this.reset();
  }

  reset() {
    this.frame = 0;
  }

  /** One tick. Returns { start: true } on the frame the player presses on,
      else null.

      Enter is what the screen advertises, but both players' confirm keys work
      as well -- the same set mode.js accepts -- because whoever wakes the
      machine up may have either hand on the keyboard. */
  update(input) {
    this.frame++;

    const has = (k) => input.pressed.has(k);
    const any = (action) => this.schemes.some((s) => has(s[action]));
    const confirm = has('enter') || any('up') || any('punch') || any('kick');

    input.pressed.clear();
    if (!confirm) return null;
    if (this.sound) this.sound.block();
    return { start: true };
  }
}
