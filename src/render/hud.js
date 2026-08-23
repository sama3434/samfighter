import { MAX_HP, WINS_NEEDED } from '../config.js';
import { PW, pctx } from '../pixel/buffer.js';
import { pxRect } from '../pixel/draw.js';
import { drawText, textWidth, GLYPH_H } from '../pixel/font.js';

const BAR_W = 180, BAR_H = 13, BAR_Y = 16, MARGIN = 14;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* Health bar in the arcade idiom: a yellow bar that empties toward the middle
   of the screen, with a red layer trailing behind it so you can see how much
   damage a combo just did. */
function healthBar(f, side) {
  const x = side === 'left' ? MARGIN : PW - MARGIN - BAR_W;

  pxRect(pctx, x - 3, BAR_Y - 3, BAR_W + 6, BAR_H + 6, '#0d0812');
  pxRect(pctx, x - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4, '#4a4460');
  pxRect(pctx, x, BAR_Y, BAR_W, BAR_H, '#38121a');

  const drainW = Math.round(BAR_W * clamp01(f.shownHp / MAX_HP));
  const hpW = Math.round(BAR_W * clamp01(f.hp / MAX_HP));
  const dx = side === 'left' ? x + BAR_W - drainW : x;
  const hx = side === 'left' ? x + BAR_W - hpW : x;

  pxRect(pctx, dx, BAR_Y, drainW, BAR_H, '#e8563c');
  pxRect(pctx, hx, BAR_Y, hpW, BAR_H, '#f0c020');
  pxRect(pctx, hx, BAR_Y, hpW, 3, '#ffe98a');
  pxRect(pctx, hx, BAR_Y + BAR_H - 3, hpW, 3, '#c08a10');

  drawText(pctx, f.name, side === 'left' ? x : x + BAR_W, BAR_Y + BAR_H + 6,
           f.hudColour, 1, side === 'left' ? 'left' : 'right', '#0d0812');

  // round wins, counted from the inside edge
  for (let i = 0; i < WINS_NEEDED; i++) {
    const px = side === 'left' ? x + BAR_W - 8 - i * 12 : x + 2 + i * 12;
    pxRect(pctx, px, BAR_Y + BAR_H + 5, 8, 8, '#0d0812');
    pxRect(pctx, px + 1, BAR_Y + BAR_H + 6, 6, 6, i < f.wins ? '#ffd23f' : '#3c3652');
    if (i < f.wins) pxRect(pctx, px + 2, BAR_Y + BAR_H + 7, 2, 2, '#fff6c0');
  }
}

export function drawHud(match) {
  healthBar(match.p1, 'left');
  healthBar(match.p2, 'right');

  const secs = Math.ceil(match.clock / 60);
  pxRect(pctx, PW / 2 - 24, 10, 48, 30, '#0d0812');
  pxRect(pctx, PW / 2 - 22, 12, 44, 26, '#241c38');
  drawText(pctx, String(secs).padStart(2, '0'), PW / 2, 16,
           secs <= 10 ? '#ff5a4d' : '#f4f0ff', 3, 'center', '#0d0812');
  drawText(pctx, match.stage.name, PW / 2, 45, '#8f87b0', 1, 'center', '#0d0812');
}

export function drawBanner(match) {
  if (!match.banner) return;

  const len = match.banner.length;
  const scale = len <= 8 ? 4 : len <= 14 ? 3 : 2;
  const y = 96;
  const w = textWidth(match.banner, scale);
  const h = GLYPH_H * scale;

  // a plate keeps the text readable over a busy stage
  pxRect(pctx, PW / 2 - w / 2 - 9, y - 7, w + 18, h + 14, '#160b1c');
  pxRect(pctx, PW / 2 - w / 2 - 7, y - 5, w + 14, h + 10, '#2c1630');
  pxRect(pctx, PW / 2 - w / 2 - 7, y - 5, w + 14, 2, '#5c3358');
  pxRect(pctx, PW / 2 - w / 2 - 7, y + h + 3, w + 14, 2, '#5c3358');

  drawText(pctx, match.banner, PW / 2, y, '#ffd23f', scale, 'center', '#7a2a1c');

  if (match.sub) {
    const sw = textWidth(match.sub, 1);
    pxRect(pctx, PW / 2 - sw / 2 - 4, y + h + 10, sw + 8, 11, '#160b1c');
    drawText(pctx, match.sub, PW / 2, y + h + 12, '#f4f0ff', 1, 'center', '#3a1020');
  }
}
