import { W, H } from '../config.js';
import { pctx, wp, present } from '../pixel/buffer.js';
import { pxDot, pxRect, pxCircle } from '../pixel/draw.js';
import { stageCanvas, drawOverlay } from '../stages/index.js';
import { drawFighter } from './sprite.js';
import { drawHud, drawBanner } from './hud.js';

/* Impact sparks: hard pixel chips, brightest at birth. */
function drawParticles(match) {
  for (const p of match.particles) {
    const x = wp(p.x), y = wp(p.y);
    const age = p.life / p.max;
    const col = age > 0.6 ? '#ffffff' : p.colour;
    pxDot(pctx, x, y, col);
    if (age > 0.45) {
      pxDot(pctx, x + 1, y, col);
      pxDot(pctx, x, y + 1, col);
    }
  }
}

/* A travelling fireball: concentric shells, hot core sitting forward so the
   ball reads as moving, licks trailing off the back. The shells take the
   owner's skin ramp -- which for a fire character is a flame ramp -- so
   player one's fire is orange and player two's is blue with no extra data. */
function drawProjectiles(match) {
  for (const pr of match.projectiles) {
    const owner = pr.ownerSlot === 'p1' ? match.p1 : match.p2;
    const p = owner.character.palettes[owner.slot];
    const x = wp(pr.x), y = wp(pr.y);
    const dir = pr.vx >= 0 ? 1 : -1;
    const flick = (match.frame >> 2) % 2;      // slow breathing, not strobe
    const r = wp(pr.w) / 2 - 1 + flick;

    pxCircle(pctx, x, y, r, p.skinLo2);
    pxCircle(pctx, x - dir, y, r - 2, p.skinLo);
    pxCircle(pctx, x + dir, y, r - 5, p.skin);
    pxCircle(pctx, x + dir * 3, y - 1, Math.max(2, r - 10), p.skinHi);
    pxCircle(pctx, x + dir * 5, y - 1, Math.max(1, r - 15), p.skinHi2);

    // licks trailing off the back edge
    for (let i = 0; i < 4; i++) {
      const ly = y - 6 + i * 4 + ((match.frame >> 1) + i) % 3;
      const lw = 5 + ((i + flick) % 3) * 3;
      const lx = dir > 0 ? x - r - lw + 2 : x + r - 2;
      pxRect(pctx, lx, ly, lw, 2, i % 2 ? p.skinLo : p.skin);
    }
  }
}

/** Compose one frame: stage, fighters, effects, HUD -- then present at 2x. */
export function renderFrame(ctx, match) {
  pctx.setTransform(1, 0, 0, 1, 0, 0);

  // screen shake stays on whole pixels, or the whole scene shimmers
  if (match.shake > 0.4) {
    pctx.setTransform(1, 0, 0, 1,
      Math.round((Math.random() - 0.5) * match.shake),
      Math.round((Math.random() - 0.5) * match.shake * 0.6));
  }

  pctx.drawImage(stageCanvas(match.stage), 0, 0);
  drawOverlay(pctx, match.stage, match.frame);

  // whoever is further forward draws last
  const order = match.p1.y >= match.p2.y ? [match.p2, match.p1] : [match.p1, match.p2];
  for (const f of order) drawFighter(f, match.frame);

  drawProjectiles(match);
  drawParticles(match);

  pctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud(match);
  drawBanner(match);

  present(ctx, W, H);
}
