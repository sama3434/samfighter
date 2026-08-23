/* World tuning. Lengths, velocities and accelerations are all in the same
   scale, so multiplying every value here by k rescales the fighters without
   changing how the game plays. */

export const W = 960, H = 540;      // display canvas
export const GROUND = 470;          // floor line (divides evenly by PSCALE)
export const WALL = 40;             // playfield inset
export const STEP = 1000 / 60;      // fixed simulation timestep, ms

export const GRAVITY = 1.8;
export const JUMP_V = -26;         // apex ~188, so the head clears the HUD
export const MOVE_SPEED = 8.4;
export const AIR_DRIFT = 0.9;
export const FRICTION = 0.72;
export const BACKWALK = 0.72;       // walking away is slower than advancing

export const MAX_HP = 100;
export const METER_MAX = 100;       // filled by 4 kicks or 8 punches
export const STUN_FRAMES = 42;      // 0.7s at 60Hz
export const ROUND_TIME = 60;       // seconds
export const WINS_NEEDED = 2;

export const BODY_W = 112;          // hurtbox width
export const STAND_H = 224;         // hurtbox height, standing
export const CROUCH_H = 152;        // hurtbox height, crouching
export const DOWN_H = 88;           // hurtbox height, knocked down
export const PUSH_GAP = BODY_W - 16;   // closest two fighters may stand
