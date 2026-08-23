import { W, H } from '../config.js';
import { pctx, wp, present } from '../pixel/buffer.js';
import { pxDot } from '../pixel/draw.js';
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

  drawParticles(match);

  pctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud(match);
  drawBanner(match);

  present(ctx, W, H);
}
