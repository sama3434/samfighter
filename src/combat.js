import * as C from './config.js';

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Resolve attacker -> defender for this frame. `fx` receives the presentation
   side of a hit (sparks, hitstop, shake, sound) so combat stays testable
   without a canvas. Returns the hit description, or null. */
export function resolveHits(attacker, defender, fx) {
  if (!attacker.attack || attacker.attack.hasHit) return null;
  const box = attacker.hitbox();
  if (!box || defender.ko) return null;
  if (!overlaps(box, defender.hurtbox())) return null;

  attacker.attack.hasHit = true;
  const m = attacker.attack.move;
  // a two-sided move pushes the defender away from the attacker rather than
  // in whatever direction the attacker happens to be facing
  const dir = m.both ? (defender.x >= attacker.x ? 1 : -1) : attacker.facing;

  // You block by holding guard while turned toward the attacker. A sweep
  // travels under a standing guard, so only a crouching block stops it.
  const facingAttacker = (defender.x - attacker.x) * defender.facing < 0;
  const guardCovers = !(m.low && !defender.crouching);
  const blocked = defender.blocking && facingAttacker && guardCovers && defender.downTimer === 0;

  defender.takeHit(m, dir, blocked);
  // meter is awarded for landing a hit clean; chip on a guard does not pay
  if (!blocked) attacker.gainMeter(m.meterGain);

  const hit = {
    move: m,
    blocked,
    x: dir > 0 ? box.x + box.w : box.x,
    y: box.y + box.h / 2,
    heavy: m.dmg >= C.HEAVY_HIT_DAMAGE,
  };
  if (fx) fx(hit);
  return hit;
}

/* ---------------- projectiles ----------------

   A travelling attack: spawned by a move with a `projectile` block, it moves
   in a straight line, hits at most once, and expires off the edge of the
   playfield. Plain data, stepped by the match -- nothing here touches a
   canvas, so a projectile match replays headlessly like everything else. */

/** Build the projectile a fighter's current attack launches. */
export function spawnProjectile(owner) {
  const m = owner.attack.move;
  const pr = m.projectile;
  return {
    move: m,
    ownerSlot: owner.slot,
    x: owner.x + owner.facing * pr.spawnX,
    y: owner.y + pr.spawnY,
    vx: owner.facing * pr.speed,
    w: pr.w,
    h: pr.h,
    age: 0,
    dead: false,
  };
}

/** One flight tick. Expires once fully outside the playfield. */
export function stepProjectile(p) {
  p.x += p.vx;
  p.age++;
  if (p.x < -p.w || p.x > C.W + p.w) p.dead = true;
}

export function projectileBox(p) {
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}

/* Resolve one projectile against the defender. Same contract as
   resolveHits: `fx` gets the presentation side, the hit description (or
   null) comes back. The projectile dies on contact, blocked or not. */
export function resolveProjectileHit(p, defender, fx) {
  if (p.dead || defender.ko) return null;
  const box = projectileBox(p);
  if (!overlaps(box, defender.hurtbox())) return null;

  p.dead = true;
  const m = p.move;
  const dir = p.vx >= 0 ? 1 : -1;

  // guard rules match a melee hit: turned toward the incoming attack, and a
  // projectile is never a low, so a standing guard covers it
  const facingIt = (defender.x - p.x) * defender.facing < 0;
  const blocked = defender.blocking && facingIt && defender.downTimer === 0;

  defender.takeHit(m, dir, blocked);

  const hit = {
    move: m,
    blocked,
    x: dir > 0 ? box.x + box.w : box.x,
    y: box.y + box.h / 2,
    heavy: m.dmg >= C.HEAVY_HIT_DAMAGE,
  };
  if (fx) fx(hit);
  return hit;
}

/* Fighters are solid: push them apart if they end a frame overlapping. */
export function separate(a, b) {
  if (a.ko || b.ko) return;
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  if (dist >= C.PUSH_GAP) return;

  const push = (C.PUSH_GAP - dist) / 2;
  const s = dx >= 0 ? 1 : -1;
  const lo = C.WALL + C.BODY_W / 2, hi = C.W - C.WALL - C.BODY_W / 2;
  a.x = Math.max(lo, Math.min(hi, a.x - push * s));
  b.x = Math.max(lo, Math.min(hi, b.x + push * s));
}
