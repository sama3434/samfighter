import { W, H } from '../config.js';
import { pctx, wp, present } from '../pixel/buffer.js';
import { pxDot, pxRect, pxEllipse } from '../pixel/draw.js';
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

/* A travelling beam bolt: a horizontal streak of layered flame, deep red at
   the rim, near-white down the core, with crackle above and below and a
   tail streaming off the back. The layers take the owner's skin ramp --
   which for a fire character is a flame ramp -- so player one's bolt is
   orange and player two's is blue with no extra data. */
function drawProjectiles(match) {
  for (const pr of match.projectiles) {
    const owner = pr.ownerSlot === 'p1' ? match.p1 : match.p2;
    const p = owner.character.palettes[owner.slot];
    const x = wp(pr.x), y = wp(pr.y);
    const dir = pr.vx >= 0 ? 1 : -1;
    const flick = (match.frame >> 1) % 2;          // fast shimmer down the core
    const rx = wp(pr.w) / 2, ry = wp(pr.h) / 2;

    // tail: streamers peeling off the back edge
    for (let i = 0; i < 5; i++) {
      const ly = y - ry + 2 + i * Math.max(2, ((ry * 2 - 4) / 4 | 0));
      const lw = 6 + (((i * 5 + (match.frame >> 2)) % 3) * 5);
      const lx = dir > 0 ? x - rx - lw + 3 : x + rx - 3;
      pxRect(pctx, lx, ly, lw, 2, i % 2 ? p.skinLo : p.skin);
    }

    pxEllipse(pctx, x, y, rx, ry + flick, p.skinLo2);
    pxEllipse(pctx, x, y, rx - 2, ry - 2 + flick, p.skinLo);
    pxEllipse(pctx, x + dir, y, rx - 4, ry - 5, p.skin);
    pxEllipse(pctx, x + dir * 3, y, rx - 8, ry - 8, p.skinHi);
    // the core: a hard bright lance with a white leading tip
    pxRect(pctx, x - (rx - 8) + (flick ? 1 : 0), y - 2, (rx - 8) * 2, 4, p.skinHi2);
    pxRect(pctx, dir > 0 ? x + rx - 9 : x - rx + 3, y - 1, 6, 2, '#ffffff');

    // crackle riding the bolt
    for (let i = 0; i < 4; i++) {
      const cx = x - rx + 6 + ((i * 13 + (match.frame >> 1) * 5) % (rx * 2 - 10));
      const above = (i + (match.frame >> 2)) % 2 === 0;
      pxRect(pctx, cx, above ? y - ry - 2 : y + ry + 1, 2, 2, i % 2 ? p.skinHi : p.skin);
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
