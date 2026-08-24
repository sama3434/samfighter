import { CHARACTERS } from './characters.js';

/* Character select.

   Pure state: each player moves a cursor and locks in, and once both have
   locked the screen counts down and hands back the picks. Holds no canvas
   work, so it can be stepped in a test the same way the match can. */

const LAUNCH_DELAY = 45;   // frames held on "ready" before the match starts

export class SelectScreen {
  constructor({ schemes, roster = CHARACTERS, sound = null }) {
    this.schemes = schemes;
    this.roster = roster;
    this.sound = sound;
    this.cpu = null;           // difficulty level 1..5 when player two is the computer
    this.reset();
  }

  reset() {
    this.cursor = [0, Math.min(1, this.roster.length - 1)];
    this.locked = [false, false];
    this.countdown = 0;
    this.frame = 0;
    this.done = false;
    this.nudge = [0, 0];       // frames of cursor-move animation left
    this.cpuTimer = 0;         // frames since the human locked, drives the CPU pick
    this.cpuPick = 0;
  }

  /** Level 1..5 puts the computer in the second slot; null returns it to a person. */
  setCpu(level) { this.cpu = level || null; }

  get bothLocked() { return this.locked[0] && this.locked[1]; }

  characterFor(player) { return this.roster[this.cursor[player]]; }

  /** Result once done: the two chosen roster entries. */
  get picks() {
    return [this.characterFor(0), this.characterFor(1)];
  }

  move(player, dir) {
    if (this.locked[player]) return;
    const n = this.roster.length;
    this.cursor[player] = (this.cursor[player] + dir + n) % n;
    this.nudge[player] = 6;
    if (this.sound) this.sound.whiff();
  }

  lock(player) {
    if (this.locked[player]) return;
    this.locked[player] = true;
    if (this.sound) this.sound.block();
  }

  unlock(player) {
    if (!this.locked[player]) return;
    this.locked[player] = false;
    this.countdown = 0;
    if (this.sound) this.sound.whiff();
  }

  /** One tick. Returns the picks on the frame the screen finishes, else null. */
  update(input) {
    this.frame++;
    for (let i = 0; i < 2; i++) if (this.nudge[i] > 0) this.nudge[i]--;

    /* Each player drives the screen entirely from their own movement cluster:
       left/right to browse, up to lock in, down to back out. The attack keys
       are accepted as well, since that is the arcade habit, but nobody has to
       leave the keys they already have their hands on. */
    if (this.cpu) {
      this.updateCpu(input);
    } else {
      for (let player = 0; player < 2; player++) {
        const k = this.schemes[player];
        if (input.pressed.has(k.left)) this.move(player, -1);
        if (input.pressed.has(k.right)) this.move(player, 1);
        if (input.pressed.has(k.up) || input.pressed.has(k.punch) || input.pressed.has(k.kick)) {
          this.lock(player);
        }
        if (input.pressed.has(k.down) || input.pressed.has(k.block)) this.unlock(player);
      }
    }

    if (this.bothLocked) {
      this.countdown++;
      if (this.countdown === 1 && this.sound) this.sound.bell();
      if (this.countdown >= LAUNCH_DELAY) {
        this.done = true;
        input.pressed.clear();
        return this.picks;
      }
    } else {
      this.countdown = 0;
    }

    input.pressed.clear();
    return null;
  }

  /* Against the computer there is one human, who might have either hand on
     the keyboard -- so both movement clusters drive the first cursor. Once
     the human locks in, the computer runs a short visible roulette over the
     roster and locks its own pick; backing out backs the computer out too. */
  updateCpu(input) {
    const anyOf = (action) => this.schemes.some((k) => input.pressed.has(k[action]));
    if (anyOf('left')) this.move(0, -1);
    if (anyOf('right')) this.move(0, 1);
    if (anyOf('up') || anyOf('punch') || anyOf('kick')) {
      if (!this.locked[0]) this.cpuPick = this.frame % this.roster.length;
      this.lock(0);
    }
    if (anyOf('down') || anyOf('block')) this.unlock(0);

    if (this.locked[0]) {
      this.cpuTimer++;
      if (!this.locked[1]) {
        if (this.cpuTimer % 6 === 0 &&
            (this.cpuTimer < 24 || this.cursor[1] !== this.cpuPick)) this.move(1, 1);
        if (this.cpuTimer >= 30 && this.cursor[1] === this.cpuPick) this.lock(1);
      }
    } else {
      this.cpuTimer = 0;
      this.unlock(1);
    }
  }
}

export { LAUNCH_DELAY };
