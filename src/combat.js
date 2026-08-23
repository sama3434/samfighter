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
  const dir = attacker.facing;

  // You block by holding guard while turned toward the attacker. A sweep
  // travels under a standing guard, so only a crouching block stops it.
  const facingAttacker = (defender.x - attacker.x) * defender.facing < 0;
  const guardCovers = !(m.low && !defender.crouching);
  const blocked = defender.blocking && facingAttacker && guardCovers && defender.downTimer === 0;

  defender.takeHit(m, dir, blocked);

  const hit = {
    move: m,
    blocked,
    x: dir > 0 ? box.x + box.w : box.x,
    y: box.y + box.h / 2,
    heavy: m.dmg >= 12,
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
