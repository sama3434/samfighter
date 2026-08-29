/* Every tuning knob in the game.

   The split against moves.js is by intent: this file is what you edit when
   the game *feels* wrong -- too fast, too floaty, rounds over too quickly.
   moves.js is what you edit to change what an individual move *does*.

   Lengths, velocities and accelerations here are all in the same scale, so
   multiplying every spatial value by k rescales the fighters without changing
   how the game plays. */

/* ---------------- stage geometry ---------------- */

export const W = 960, H = 540;      // display canvas
export const GROUND = 500;          // floor line (divides evenly by PSCALE)
export const WALL = 50;             // playfield inset
export const STEP = 1000 / 60;      // fixed simulation timestep, ms

/* ---------------- movement ----------------

   Everything spatial below was scaled x1.25 in the SVC-resolution pass
   (fighters 112 -> 140 buffer px, the late-Neo-Geo proportion). Velocities
   and accelerations scaled with the lengths, so timing and feel are
   untouched -- see the note at the top of this file. */

export const GRAVITY = 2.25;
/* A pure x1.25 scale would be -32.5, but the discrete integrator overshoots
   and the head would leave the frame at the apex (the buffer has no vertical
   scroll). -31 keeps all but a few hair pixels on screen and shortens the
   rise by roughly half a simulation frame -- the one deliberate deviation
   from the uniform scale, chosen over clipping the fighter's head. */
export const JUMP_V = -31;
export const MOVE_SPEED = 10.5;
export const AIR_DRIFT = 1.125;
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
  punch: 6,
  kick: 12,
  sweep: 10,
  airPunch: 5,
  airKick: 12,
  spin: 10,
  firePunch: 5,
  fireKick: 8,
  fireSweep: 8,
  fireAirPunch: 5,
  fireAirKick: 8,
  fireball: 15,
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
  firePunch: 1,
  fireKick: 2,
  fireSweep: 2,
  fireAirPunch: 1,
  fireAirKick: 2,
  fireball: 3,
};

/* ---------------- burn ----------------

   ASH's punches set the opponent alight: BURN_TOTAL damage spread evenly
   over BURN_FRAMES, ticked in the simulation. A second punch refreshes the
   burn (timer and remaining damage back to full) rather than stacking a
   second one.

   Deliberate reading of the spec: "2 damage over 2 seconds" is implemented
   as 2 damage TOTAL across the 2 seconds. If it should be 2 damage per
   second, set BURN_TOTAL to 4 and nothing else changes. */

export const BURN_TOTAL = 2;
export const BURN_FRAMES = 120;     // 2 seconds at 60Hz
/* The damage lands in this many evenly spaced ticks across BURN_FRAMES.
   Eight keeps every increment an exact binary fraction (0.25), so hp never
   accumulates floating-point drift. */
export const BURN_TICKS = 8;

/* At or above this, a hit counts as heavy and gets longer hitstop, a bigger
   shake and hotter sparks. It is compared against DAMAGE, so if you scale
   those numbers this has to move with them. */
export const HEAVY_HIT_DAMAGE = 9;

/* ---------------- rounds and meter ---------------- */

export const ROUND_TIME = 60;       // seconds
export const WINS_NEEDED = 2;
export const METER_MAX = 100;       // filled by 4 kicks or 8 punches
export const STUN_FRAMES = 42;      // 0.7s at 60Hz

/* ---------------- fighter volumes ---------------- */

export const BODY_W = 140;          // hurtbox width
export const STAND_H = 280;         // hurtbox height, standing
export const CROUCH_H = 190;        // hurtbox height, crouching
export const DOWN_H = 110;          // hurtbox height, knocked down
export const PUSH_GAP = BODY_W - 20;   // closest two fighters may stand
