import * as C from './config.js';
import { MOVES, DEFAULT_MOVESET } from './moves.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* One fighter: physics, stance, and the attack state machine.
   Knows nothing about drawing or about the match around it. */
export class Fighter {
  constructor({ startX, facing, scheme, input, character, slot, hudColour, name }) {
    this.character = character;      // roster entry: build + palettes
    /* Which move answers each input slot, for THIS character. A roster entry
       may override any slot by name, or null it out entirely; everyone else
       gets the shared table. */
    this.moves = { ...DEFAULT_MOVESET, ...(character.moves || {}) };
    this.slot = slot;                // 'p1' | 'p2', picks the palette and HUD colour
    this.name = name || character.name;
    this.startX = startX;
    this.startFacing = facing;
    this.scheme = scheme;
    this.input = input;              // { held: Set, pressed: Set }
    this.hudColour = hudColour;
    this.wins = 0;
    this.meter = 0;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = C.GROUND;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.startFacing;
    this.hp = C.MAX_HP;
    this.shownHp = C.MAX_HP;         // trails hp, drives the drain bar
    this.onGround = true;
    this.crouching = false;
    this.blocking = false;
    this.attack = null;              // { move, t, hasHit }
    this.hitstun = 0;
    this.blockFlash = 0;
    this.downTimer = 0;
    this.ko = false;
    this.walkPhase = 0;
    this.airAttackUsed = false;
    this.stunTimer = 0;      // drives the stunned look; the lockout is hitstun
    this.burnTimer = 0;      // frames of burn left; 0 means not alight
    this.burnLeft = 0;       // burn damage still to be dealt
  }

  /* Meter carries across rounds within a match -- it is reset only by
     spending it, which is why it is not cleared in reset(). */
  gainMeter(amount) {
    if (!amount) return;
    this.meter = Math.min(C.METER_MAX, this.meter + amount);
  }

  get meterFull() { return this.meter >= C.METER_MAX; }

  /* ---- geometry ---- */
  get height() {
    if (this.downTimer > 0 || this.ko) return C.DOWN_H;
    return this.crouching ? C.CROUCH_H : C.STAND_H;
  }

  hurtbox() {
    const h = this.height;
    return { x: this.x - C.BODY_W / 2, y: this.y - h, w: C.BODY_W, h };
  }

  hitbox() {
    if (!this.attack) return null;
    const m = this.attack.move;
    // a projectile move has no melee hitbox: the projectile itself hits
    if (m.projectile) return null;
    if (this.attack.t < m.startup || this.attack.t >= m.startup + m.active) return null;
    if (m.both) {
      // reaches the same distance either way, so the box straddles the fighter
      return {
        x: this.x - 35 - m.reach,
        y: this.y + m.top,
        w: (35 + m.reach) * 2,
        h: m.h,
      };
    }
    const front = this.facing > 0 ? this.x + 35 : this.x - 35 - m.reach;
    return { x: front, y: this.y + m.top, w: m.reach, h: m.h };
  }

  /* ---- input ---- */
  down(action) { return this.input.held.has(this.scheme[action]); }
  tapped(action) { return this.input.pressed.has(this.scheme[action]); }

  canAct() {
    return !this.ko && this.downTimer === 0 && this.hitstun === 0 && !this.attack;
  }

  startAttack(key) {
    this.attack = { move: MOVES[key], t: 0, hasHit: false };
  }

  /* ---- burn: a status effect, not a hit ----
     Set alight by a burning move; BURN_TOTAL damage dealt evenly across
     BURN_FRAMES. Non-stacking: a fresh application refreshes both the timer
     and the remaining damage rather than adding a second burn. */
  applyBurn() {
    this.burnTimer = C.BURN_FRAMES;
    this.burnLeft = C.BURN_TOTAL;
  }

  tickBurn() {
    if (this.burnTimer <= 0 || this.ko) return;
    this.burnTimer--;
    // the damage lands in BURN_TICKS evenly spaced increments, each an exact
    // binary fraction, so a burned fighter's hp never drifts off the grid
    if (this.burnTimer % (C.BURN_FRAMES / C.BURN_TICKS) !== 0) return;
    const step = Math.min(this.burnLeft, C.BURN_TOTAL / C.BURN_TICKS);
    this.burnLeft -= step;
    this.hp -= step;
    if (this.hp <= 0) this.die(-this.facing);
  }

  /* ---- per-frame ----
     `live` is false during round intros and endings: the fighter still falls
     and slides to a stop, but stops taking orders. */
  update(opponent, live) {
    if (live) this.tickBurn();

    if (this.ko || this.downTimer > 0) {
      this.physics();
      if (this.downTimer > 0 && this.onGround) this.downTimer--;
      return;
    }

    if (this.canAct() && this.onGround) {
      const dx = opponent.x - this.x;
      if (Math.abs(dx) > 7.5) this.facing = dx > 0 ? 1 : -1;
    }

    if (this.hitstun > 0) {
      this.hitstun--;
      if (this.stunTimer > 0) this.stunTimer--;
      this.physics();
      return;
    }
    this.stunTimer = 0;

    if (this.attack) {
      const m = this.attack.move;
      this.attack.t++;
      if (this.attack.t >= m.startup + m.active + m.recovery) this.attack = null;
      if (this.onGround) this.vx *= C.FRICTION;   // grounded attacks root you
      this.physics();
      return;
    }

    if (!live) { this.vx *= C.FRICTION; this.physics(); return; }

    this.crouching = this.onGround && this.down('down');
    this.blocking = this.onGround && this.down('block');
    if (this.blockFlash > 0) this.blockFlash--;

    const spec = this.moves.special;
    if (spec && this.tapped('special') && this.meterFull && this.onGround) {
      this.meter -= MOVES[spec].cost;
      this.startAttack(spec);
      this.crouching = false;
      this.physics();
      return 'special';
    }

    const wantPunch = this.tapped('punch');
    const wantKick = this.tapped('kick');
    if (wantPunch || wantKick) {
      // which move (if any) this character answers the press with
      let key = null;
      if (!this.onGround) {
        key = wantPunch ? this.moves.airPunch : this.moves.airKick;
        if (key) {
          if (this.airAttackUsed) { this.physics(); return; }
          this.airAttackUsed = true;
        }
      } else if (this.crouching && wantKick) {
        key = this.moves.sweep;
      } else {
        key = wantPunch ? this.moves.punch : this.moves.kick;
      }
      if (key) {
        this.startAttack(key);
        this.physics();
        return true;   // signals "a swing started", for the whiff sound
      }
      // a slot the character does not have: the press does nothing at all
    }

    const dir = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    if (this.onGround) {
      if (this.blocking || this.crouching) {
        this.vx *= C.FRICTION;
      } else {
        this.vx = dir * C.MOVE_SPEED * (dir === this.facing ? 1 : C.BACKWALK);
        if (dir !== 0) this.walkPhase += 0.22; else this.walkPhase = 0;
      }
      if (this.tapped('up') && !this.crouching) {
        this.vy = C.JUMP_V;
        this.vx = dir * C.MOVE_SPEED * 1.05;
        this.onGround = false;
      }
    } else {
      this.vx = clamp(this.vx + dir * C.AIR_DRIFT, -C.MOVE_SPEED * 1.3, C.MOVE_SPEED * 1.3);
    }

    this.physics();
  }

  physics() {
    this.x += this.vx;
    this.y += this.vy;
    if (!this.onGround) this.vy += C.GRAVITY;

    if (this.y >= C.GROUND) {
      this.y = C.GROUND;
      this.vy = 0;
      if (!this.onGround) {
        this.onGround = true;
        this.airAttackUsed = false;
        if (this.attack && this.attack.move.air) this.attack = null;
      }
    } else {
      this.onGround = false;
    }

    this.x = clamp(this.x, C.WALL + C.BODY_W / 2, C.W - C.WALL - C.BODY_W / 2);
    if (this.onGround) this.vx *= C.FRICTION;
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
  }

  takeHit(move, fromDir, blocked) {
    if (blocked) {
      this.hp -= move.chip;
      this.hitstun = move.blockstun;
      this.vx = fromDir * move.kb * 0.45;
      this.blockFlash = 8;
    } else {
      this.hp -= move.dmg;
      this.hitstun = move.hitstun;
      this.vx = fromDir * move.kb;
      if (move.kbY && this.onGround) { this.vy = move.kbY; this.onGround = false; }
      this.attack = null;
      this.crouching = false;
      if (move.stun) { this.hitstun = move.stun; this.stunTimer = move.stun; }
      if (move.knockdown) { this.downTimer = 48; this.hitstun = 0; }
      if (move.burn) this.applyBurn();
    }

    if (this.hp <= 0) this.die(fromDir);
  }

  /* The KO, whether by a hit or by burning down. */
  die(fromDir) {
    this.hp = 0;
    this.ko = true;
    this.downTimer = 999;
    this.attack = null;
    this.vx = fromDir * 12.5;
    this.vy = -17.5;
    this.onGround = false;
  }
}
