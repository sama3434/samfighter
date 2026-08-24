/* Every tuning knob in the game.

   The split against moves.js is by intent: this file is what you edit when
   the game *feels* wrong -- too fast, too floaty, rounds over too quickly.
   moves.js is what you edit to change what an individual move *does*.

   Lengths, velocities and accelerations here are all in the same scale, so
   multiplying every spatial value by k rescales the fighters without changing
   how the game plays. */

/* ---------------- stage geometry ---------------- */

export const W = 960, H = 540;      // display canvas
export const GROUND = 470;          // floor line (divides evenly by PSCALE)
export const WALL = 40;             // playfield inset
export const STEP = 1000 / 60;      // fixed simulation timestep, ms

/* ---------------- movement ---------------- */

export const GRAVITY = 1.8;
export const JUMP_V = -26;          // apex ~188, so the head clears the HUD
export const MOVE_SPEED = 8.4;
export const AIR_DRIFT = 0.9;
export const FRICTION = 0.72;
export const BACKWALK = 0.72;       // walking away is slower than advancing

/* ---------------- damage ----------------

   Damage per attack, in HP out of MAX_HP, keyed by move name. It lives here
   rather than in moves.js because this is the knob you actually reach for
   when fights run too long or end too fast. At these numbers a round is
   roughly eight clean kicks, or fourteen punches.

   Adding a move means adding it to both maps below; tests/tuning.test.js
   fails if a move has no damage entry, or an entry has no move. */

export const MAX_HP = 100;

export const DAMAGE = {
  punch: 7,
  kick: 13,
  sweep: 10,
  airPunch: 8,
  airKick: 14,
  spin: 12,
};

/* What gets through a block. Chip is the thing stopping a turtling opponent
   from being invulnerable, so it wants to stay small but non-zero. */
export const CHIP_DAMAGE = {
  punch: 1,
  kick: 2,
  sweep: 2,
  airPunch: 1,
  airKick: 2,
  spin: 2,
};

/* At or above this, a hit counts as heavy and gets longer hitstop, a bigger
   shake and hotter sparks. It is compared against DAMAGE, so if you scale
   those numbers this has to move with them. */
export const HEAVY_HIT_DAMAGE = 12;

/* ---------------- rounds and meter ---------------- */

export const ROUND_TIME = 60;       // seconds
export const WINS_NEEDED = 2;
export const METER_MAX = 100;       // filled by 4 kicks or 8 punches
export const STUN_FRAMES = 42;      // 0.7s at 60Hz

/* ---------------- fighter volumes ---------------- */

export const BODY_W = 112;          // hurtbox width
export const STAND_H = 224;         // hurtbox height, standing
export const CROUCH_H = 152;        // hurtbox height, crouching
export const DOWN_H = 88;           // hurtbox height, knocked down
export const PUSH_GAP = BODY_W - 16;   // closest two fighters may stand
