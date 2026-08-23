import * as C from './config.js';
import { MOVES } from './moves.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* One fighter: physics, stance, and the attack state machine.
   Knows nothing about drawing or about the match around it. */
export class Fighter {
  constructor({ name, startX, facing, scheme, input, palette, hudColour }) {
    this.name = name;
    this.startX = startX;
    this.startFacing = facing;
    this.scheme = scheme;
    this.input = input;              // { held: Set, pressed: Set }
    this.palette = palette;          // key into the sprite palettes
    this.hudColour = hudColour;
    this.wins = 0;
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
  }

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
    if (this.attack.t < m.startup || this.attack.t >= m.startup + m.active) return null;
    const front = this.facing > 0 ? this.x + 28 : this.x - 28 - m.reach;
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

  /* ---- per-frame ----
     `live` is false during round intros and endings: the fighter still falls
     and slides to a stop, but stops taking orders. */
  update(opponent, live) {
    if (this.ko || this.downTimer > 0) {
      this.physics();
      if (this.downTimer > 0 && this.onGround) this.downTimer--;
      return;
    }

    if (this.canAct() && this.onGround) {
      const dx = opponent.x - this.x;
      if (Math.abs(dx) > 6) this.facing = dx > 0 ? 1 : -1;
    }

    if (this.hitstun > 0) {
      this.hitstun--;
      this.physics();
      return;
    }

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

    const wantPunch = this.tapped('punch');
    const wantKick = this.tapped('kick');
    if (wantPunch || wantKick) {
      if (!this.onGround) {
        if (this.airAttackUsed) { this.physics(); return; }
        this.airAttackUsed = true;
        this.startAttack(wantPunch ? 'airPunch' : 'airKick');
      } else if (this.crouching && wantKick) {
        this.startAttack('sweep');
      } else {
        this.startAttack(wantPunch ? 'punch' : 'kick');
      }
      this.physics();
      return true;   // signals "a swing started", for the whiff sound
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
      if (move.knockdown) { this.downTimer = 48; this.hitstun = 0; }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.ko = true;
      this.downTimer = 999;
      this.attack = null;
      this.vx = fromDir * 10;
      this.vy = -14;
      this.onGround = false;
    }
  }
}
