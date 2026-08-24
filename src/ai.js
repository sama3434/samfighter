import * as C from './config.js';
import { MOVES } from './moves.js';

/* The computer opponent.

   It drives a fighter the same way a person does: by writing that fighter's
   own key names into a { held, pressed } pair the fighter was constructed
   with. Nothing in fighter.js, combat.js or match.js knows it exists.

   Difficulty is behaviour, never cheating. Every level plays the same
   fighter with the same damage, health and meter -- what changes is how
   fast it notices things, how reliably it blocks, whether it punishes a
   whiffed move, and how disciplined its spacing is. The knobs live in
   PROFILES below.

   All randomness comes from a seeded generator, so a match against the
   computer can be replayed tick for tick in a test. */

/* Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Centre-to-centre distance at which a move can touch a standing opponent:
   the hitbox starts 28 in front of the attacker and must cross the
   defender's half-width. Derived from the live move table so a frame-data
   change cannot silently strand the computer out of range. */
const reachOf = (m) => 28 + m.reach + C.BODY_W / 2;
/* Spacing is written in body widths rather than pixels. The world has been
   rescaled twice on this project; anything expressed as a raw pixel distance
   silently stops meaning what it meant. BW is one fighter wide. */
const BW = C.BODY_W;

export const RANGE = {
  punch: reachOf(MOVES.punch),
  kick: reachOf(MOVES.kick),
  sweep: reachOf(MOVES.sweep),
  spin: reachOf(MOVES.spin),
};

/* One profile per level. Frames are simulation frames at 60Hz.

   react/reactJit  how long after a threat appears before it responds
   think/thinkJit  how often the movement plan is reconsidered
   block           chance it chooses to guard a seen attack
   lowBlock        chance the guard is crouching when the attack is a sweep
   antiAir         chance it swats a jump-in rather than standing in it
   punish          chance it hits a whiffed/blocked move during recovery
   attack          per-tick chance to open with an attack while in range
   airAttack       per-tick chance to swing during its own jump
   special         per-tick chance to spend a full meter when close
   guardRead       chance it answers a standing guard with a sweep
   flail           per-tick chance to mash an attack out of range (novice)
   sweepW          weight of sweep in the normal attack mix
   approach        weight of walking in when out of range
   retreatW        weight of giving ground when already in range
   jump            weight of a jump-in from mid range
   guardStance     weight of standing in guard while inside the foe's range
                   -- the moves here are too fast to react-block point blank,
                   so blocking skill is mostly anticipation, like a person's
   stopAt          how close it walks before it stops advancing
   cool/coolJit    frames between swings -- the poke rhythm; punishes and
                   free hits on a stunned opponent ignore it */
export const PROFILES = {
  1: { react: 26, reactJit: 22, think: 34, thinkJit: 22,
       block: 0.10, lowBlock: 0.10, antiAir: 0.00, punish: 0.06,
       attack: 0.015, airAttack: 0.06, special: 0.000, guardRead: 0.00,
       flail: 0.012, sweepW: 0.12, approach: 0.42, retreatW: 0.30,
       jump: 0.05, guardStance: 0.00, stopAt: 1.79 * BW, cool: 55, coolJit: 40 },
  2: { react: 18, reactJit: 14, think: 24, thinkJit: 14,
       block: 0.35, lowBlock: 0.25, antiAir: 0.25, punish: 0.30,
       attack: 0.050, airAttack: 0.25, special: 0.005, guardRead: 0.15,
       flail: 0.005, sweepW: 0.18, approach: 0.68, retreatW: 0.22,
       jump: 0.08, guardStance: 0.12, stopAt: 1.92 * BW, cool: 26, coolJit: 16 },
  3: { react: 12, reactJit: 10, think: 16, thinkJit: 9,
       block: 0.60, lowBlock: 0.50, antiAir: 0.50, punish: 0.55,
       attack: 0.070, airAttack: 0.40, special: 0.020, guardRead: 0.35,
       flail: 0.000, sweepW: 0.24, approach: 0.85, retreatW: 0.14,
       jump: 0.10, guardStance: 0.24, stopAt: 2.01 * BW, cool: 18, coolJit: 10 },
  4: { react: 8, reactJit: 7, think: 11, thinkJit: 6,
       block: 0.80, lowBlock: 0.72, antiAir: 0.72, punish: 0.80,
       attack: 0.100, airAttack: 0.50, special: 0.055, guardRead: 0.60,
       flail: 0.000, sweepW: 0.28, approach: 0.94, retreatW: 0.09,
       jump: 0.10, guardStance: 0.34, stopAt: 2.05 * BW, cool: 12, coolJit: 8 },
  5: { react: 5, reactJit: 5, think: 7, thinkJit: 5,
       block: 0.93, lowBlock: 0.90, antiAir: 0.90, punish: 0.95,
       attack: 0.130, airAttack: 0.60, special: 0.120, guardRead: 0.80,
       flail: 0.000, sweepW: 0.30, approach: 1.00, retreatW: 0.05,
       jump: 0.12, guardStance: 0.42, stopAt: 2.07 * BW, cool: 7, coolJit: 6 },
};

/* Frames of quiet (nobody taking damage) before the computer stops being
   polite and forces the issue. This is the stalemate guard: even a cautious
   profile walks in and swings once a fight goes stale. */
const BOREDOM = 240;

export class AIController {
  constructor({ level = 3, scheme, seed = 1, slot = 'p2' }) {
    this.level = level;
    this.p = PROFILES[level];
    if (!this.p) throw new Error(`no AI profile for level ${level}`);
    this.scheme = scheme;
    this.slot = slot;
    this.rng = mulberry32(seed);
    this.input = { held: new Set(), pressed: new Set() };

    this.t = 0;
    this.plan = 'approach';
    this.thinkAt = 0;
    this.guardFrames = 0;
    this.guardLow = false;

    /* threat bookkeeping: one decision per opponent attack, made when the
       attack is first seen, acted on only after the reaction delay */
    this.seenAttack = null;
    this.reactAt = Infinity;
    this.willGuard = false;
    this.willPunish = false;
    this.punished = false;

    this.airSeen = false;
    this.airReactAt = Infinity;
    this.willAntiAir = false;

    this.calm = 0;
    this.lastHpSum = null;
    this.stanceLow = false;
    this.cooldown = 0;      // frames until it is willing to swing again
  }

  roll(p) { return this.rng() < p; }
  hold(action) { this.input.held.add(this.scheme[action]); }
  press(action) { this.input.pressed.add(this.scheme[action]); }

  /* One decision tick. Call before match.update() each frame. */
  update(match) {
    /* Hitstop freezes the fighters, so freeze with them -- otherwise a press
       queued during the freeze would be overwritten before anyone read it. */
    if (match.hitstop > 0) return;

    this.input.held.clear();
    this.input.pressed.clear();

    if (match.phase !== 'fight') {
      this.guardFrames = 0;
      this.seenAttack = null;
      this.airSeen = false;
      this.calm = 0;
      return;
    }

    const me = match[this.slot];
    const foe = match[this.slot === 'p1' ? 'p2' : 'p1'];
    this.t++;

    // the stalemate clock: reset whenever anybody's health moves
    const hpSum = me.hp + foe.hp;
    if (hpSum !== this.lastHpSum) { this.lastHpSum = hpSum; this.calm = 0; }
    else this.calm++;
    /* Bored means: force the issue. Either the fight has gone quiet, or the
       clock is running down while we are not ahead -- turtling out a timed
       loss is the worst kind of computer opponent. */
    const bored = this.calm > BOREDOM || (match.clock < 20 * 60 && me.hp <= foe.hp);

    const P = this.p;
    if (this.cooldown > 0) this.cooldown--;
    if (bored && this.cooldown > 0) this.cooldown--;   // impatience swings sooner

    /* ---- notice a fresh attack; decide the whole response up front ----
       This runs even while stuck in an attack or in hitstun: a player sees
       the incoming kick while their own punch recovers, and blocks the
       moment they are free. The decision is made once per attack and
       executed only after the reaction delay, so a fast level still does
       not respond on the exact frame every time, and a slow level reacts to
       a punch that is already over -- exactly what a novice does. */
    const atk = foe.attack;
    if (atk && atk !== this.seenAttack) {
      this.seenAttack = atk;
      this.reactAt = this.t + P.react + this.rng() * P.reactJit;
      this.willGuard = this.roll(P.block);
      // a sweep goes under a standing guard; whether it crouches is a skill
      this.guardLow = atk.move.low ? this.roll(P.lowBlock) : this.roll(0.3);
      this.willPunish = this.roll(P.punish);
      this.punished = false;
    }
    if (!atk) this.seenAttack = null;

    if (me.ko || me.downTimer > 0 || me.hitstun > 0 || me.attack) return;

    const dx = foe.x - me.x;
    const dist = Math.abs(dx);
    const toward = dx > 0 ? 'right' : 'left';
    const away = dx > 0 ? 'left' : 'right';

    /* ---- airborne: drift in, swing once on the way down ---- */
    if (!me.onGround) {
      if (dist > 0.80 * BW) this.hold(toward);
      if (!me.airAttackUsed && dist < RANGE.kick && me.vy > -8 && this.roll(P.airAttack)) {
        this.press(this.roll(0.6) ? 'kick' : 'punch');
        this.cooldown = Math.round(P.cool + this.rng() * P.coolJit);
      }
      return;
    }

    if (atk && this.t >= this.reactAt) {
      const m = atk.move;
      const incoming = atk.t < m.startup + m.active;
      if (incoming && dist < reachOf(m) + 44) {
        if (this.willGuard && this.guardFrames === 0) {
          this.guardFrames = (m.startup + m.active - atk.t) + 8;
        }
      } else if (!incoming && !this.punished && this.willPunish && dist <= RANGE.kick) {
        this.punished = true;         // hit the recovery of a whiffed move
        this.swing(dist, foe);
        return;
      }
    }

    if (this.guardFrames > 0) {
      this.guardFrames--;
      this.hold('block');
      if (this.guardLow) this.hold('down');
      return;
    }

    /* ---- anti-air: swat a jump-in with the high-reaching punch ---- */
    if (!foe.onGround) {
      if (!this.airSeen) {
        this.airSeen = true;
        this.airReactAt = this.t + P.react + this.rng() * P.reactJit;
        this.willAntiAir = this.roll(P.antiAir);
      }
      if (this.willAntiAir && this.t >= this.airReactAt && dist < RANGE.punch + 30) {
        this.willAntiAir = false;
        this.press('punch');
        return;
      }
    } else {
      this.airSeen = false;
    }

    /* ---- a stunned opponent is free damage; every level takes it ---- */
    if (foe.stunTimer > 8 && dist <= RANGE.kick) { this.swing(dist, foe); return; }

    /* ---- do not hammer a knocked-down body; take position instead ---- */
    if (foe.downTimer > 6) {
      if (dist > RANGE.kick - 40) this.hold(toward);
      else if (dist < 1.52 * BW) this.hold(away);
      return;
    }

    /* ---- spend a full meter up close ---- */
    if (me.meterFull && dist <= RANGE.spin - 12 && this.roll(P.special)) {
      this.press('special');
      return;
    }

    /* ---- open with an attack while in range ---- */
    const pAtk = P.attack * (bored ? 2.2 : 1);
    if (this.cooldown <= 0 && dist <= RANGE.kick + 6 && this.roll(pAtk)) {
      this.swing(dist, foe);
      return;
    }

    // the novice mashes even when nothing can connect
    if (this.cooldown <= 0 && P.flail > 0 && dist > RANGE.kick && this.roll(P.flail)) {
      this.press(this.roll(0.5) ? 'punch' : 'kick');
      return;
    }

    /* ---- movement, reconsidered every think interval ---- */
    if (this.t >= this.thinkAt) {
      this.thinkAt = this.t + P.think + this.rng() * P.thinkJit;
      this.plan = this.choosePlan(dist, bored, P);
    }
    this.movePlan(me, dist, toward, away, P);
  }

  choosePlan(dist, bored, P) {
    if (bored) return 'approach';
    const r = this.rng();
    if (dist > RANGE.kick) {
      if (r < P.approach) return 'approach';
      if (r < P.approach + P.jump && dist > 2.68 * BW && dist < 5.0 * BW) return 'jumpin';
      if (r < P.approach + P.jump + 0.25) return 'idle';
      return 'retreat';
    }
    // already in range: sometimes stand in guard expecting the exchange,
    // sometimes give ground to reset the spacing, rarely leave over the
    // top; otherwise stand and look for the opening
    if (r < P.guardStance) {
      // a crouching guard also catches sweeps; standing pays for laziness
      this.stanceLow = this.rng() < 0.6;
      return 'guard';
    }
    if (r < P.guardStance + P.retreatW) return 'retreat';
    if (r < P.guardStance + P.retreatW + P.jump * 0.5) return 'jumpin';
    return 'idle';
  }

  movePlan(me, dist, toward, away, P) {
    // walking into a corner is how fights are lost; bail forwards instead
    const lo = C.WALL + C.BODY_W / 2 + 0.36 * BW;
    const hi = C.W - C.WALL - C.BODY_W / 2 - 0.36 * BW;
    const cornered = (me.x < lo && away === 'left') || (me.x > hi && away === 'right');

    switch (this.plan) {
      case 'approach':
        if (dist > P.stopAt) this.hold(toward);
        break;
      case 'retreat':
        if (cornered) { this.plan = 'jumpin'; break; }
        this.hold(away);
        break;
      case 'jumpin':
        this.hold(toward);
        this.press('up');
        this.plan = 'approach';   // land with intent, not with a re-roll
        break;
      case 'guard':
        if (dist > RANGE.kick + 30) { this.plan = 'approach'; break; }
        this.hold('block');
        if (this.stanceLow) this.hold('down');
        break;
      case 'idle':
      default:
        break;
    }
  }

  /* Pick and press an attack for the current distance. */
  swing(dist, foe) {
    const P = this.p;
    this.cooldown = Math.round(P.cool + this.rng() * P.coolJit);
    // a standing guard loses to a sweep; reading that is a skill
    if (foe.blocking && !foe.crouching && dist <= RANGE.sweep && this.roll(P.guardRead)) {
      this.hold('down');
      this.press('kick');
      return;
    }
    const r = this.rng();
    if (dist <= RANGE.punch && r < 0.42) { this.press('punch'); return; }
    if (dist <= RANGE.sweep && r < 0.42 + P.sweepW) {
      this.hold('down');
      this.press('kick');
      return;
    }
    this.press('kick');
  }
}
