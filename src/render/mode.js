import { PW, PH, PGROUND, pctx, present } from '../pixel/buffer.js';
import { W, H } from '../config.js';
import { pxRect, pxDot } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { drawText, textWidth } from '../pixel/font.js';
import { LEVEL_NAMES, LEVELS } from '../mode.js';

/* The mode screen: VS PLAYER or VS COMPUTER, then a difficulty.
   Same backdrop, plates and font as the character select, so the two
   screens read as one menu rather than two apps. */

const P1 = '#8fc0f8', GOLD = '#ffd23f', DIM = '#4a4460';
const PLATE = '#0f0b1e', PLATE_IN = '#241c40', MUTED = '#8f87b0', HINT = '#a89fc4';

function backdrop(frame) {
  ditherGradient(pctx, 0, 0, PW, PH, ['#12102a', '#241a45', '#3f2154', '#5c2a4c']);
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 + frame * 0.3) % PW;
    const y = (i * 53 + Math.sin(frame * 0.02 + i) * 6) % PH;
    pxDot(pctx, x, y, i % 3 === 0 ? '#6b5a95' : '#4a3b6b');
  }
  pxRect(pctx, 0, PGROUND + 20, PW, PH - PGROUND - 20, '#1a1430');
  pxRect(pctx, 0, PGROUND + 20, PW, 2, '#3d3160');
}

function title(text, y) {
  const tw = textWidth(text, 3);
  pxRect(pctx, PW / 2 - tw / 2 - 8, y - 6, tw + 16, 30, '#160b1c');
  pxRect(pctx, PW / 2 - tw / 2 - 6, y - 4, tw + 12, 26, '#2c1630');
  drawText(pctx, text, PW / 2, y, GOLD, 3, 'center', '#7a2a1c');
}

/* The pulsing selection frame the select screen puts around a card. */
function selectionFrame(x, y, w, h, frame, active) {
  if (!active) return;
  const bright = (frame >> 3) % 2 === 0;
  const bx = x - 4, by = y - 4, bw = w + 8, bh = h + 8;
  for (const [rx, ry, rw, rh] of [
    [bx, by, bw, 2], [bx, by + bh - 2, bw, 2],
    [bx, by, 2, bh], [bx + bw - 2, by, 2, bh],
  ]) pxRect(pctx, rx, ry, rw, rh, bright ? P1 : DIM);
  if (bright) {
    for (const [cx, cy] of [[bx, by], [bx + bw - 7, by],
                            [bx, by + bh - 7], [bx + bw - 7, by + bh - 7]]) {
      pxRect(pctx, cx, cy, 7, 7, P1);
    }
  }
}

function plate(x, y, w, h) {
  pxRect(pctx, x, y, w, h, PLATE);
  pxRect(pctx, x + 2, y + 2, w - 4, h - 4, PLATE_IN);
}

function footer(hint) {
  pxRect(pctx, 0, PH - 24, PW, 24, PLATE);
  pxRect(pctx, 0, PH - 24, PW, 1, '#3d3160');
  drawText(pctx, hint, PW / 2, PH - 16, HINT, 1, 'center');
}

/* Two tiny figures for VS PLAYER, one figure and a monitor for VS COMPUTER:
   just enough picture that the plates are not two slabs of text. */
function figure(x, y, col) {
  pxRect(pctx, x + 2, y, 6, 6, col);         // head
  pxRect(pctx, x, y + 7, 10, 10, col);       // torso
  pxRect(pctx, x + 1, y + 18, 3, 8, col);    // legs
  pxRect(pctx, x + 6, y + 18, 3, 8, col);
}

function monitor(x, y, col, frame) {
  pxRect(pctx, x, y + 2, 16, 12, col);
  pxRect(pctx, x + 2, y + 4, 12, 8, '#0f0b1e');
  // a scanline blinking so the machine reads as switched on
  pxRect(pctx, x + 3, y + 5 + ((frame >> 4) % 3) * 2, 10, 1, col);
  pxRect(pctx, x + 6, y + 14, 4, 3, col);
  pxRect(pctx, x + 3, y + 17, 10, 2, col);
}

function drawModeStage(state) {
  const frame = state.frame;
  const pw = 168, ph = 84, gap = 32;
  const y = 96;
  const x0 = PW / 2 - pw - gap / 2;
  const x1 = PW / 2 + gap / 2;

  for (const [i, x, label, caption] of [
    [0, x0, 'VS PLAYER', 'TWO ON ONE KEYBOARD'],
    [1, x1, 'VS COMPUTER', 'FIGHT THE MACHINE'],
  ]) {
    plate(x, y, pw, ph);
    ditherDisc(pctx, x + pw / 2, y + ph - 16, 40, '#4a3a7a', 0.5);
    if (i === 0) {
      figure(x + pw / 2 - 16, y + 12, P1);
      figure(x + pw / 2 + 6, y + 12, '#ff9b8c');
    } else {
      figure(x + pw / 2 - 18, y + 12, P1);
      monitor(x + pw / 2 + 4, y + 16, '#ff9b8c', frame);
    }
    drawText(pctx, label, x + pw / 2, y + ph - 32, GOLD, 2, 'center', '#3a1020');
    drawText(pctx, caption, x + pw / 2, y + ph - 13, MUTED, 1, 'center', PLATE);
    selectionFrame(x, y, pw, ph, frame, state.cursor === i);
  }

  footer('LEFT / RIGHT TO CHOOSE      UP TO LOCK IN');
}

function drawLevelStage(state) {
  const frame = state.frame;
  const box = 44, gap = 14;
  const span = LEVELS * box + (LEVELS - 1) * gap;
  const x0 = Math.round((PW - span) / 2);
  const y = 112;

  drawText(pctx, 'CHOOSE THE DIFFICULTY', PW / 2, 84, HINT, 1, 'center', PLATE);

  for (let i = 0; i < LEVELS; i++) {
    const x = x0 + i * (box + gap);
    const chosen = state.levelCursor === i;
    plate(x, y, box, box);
    // level 5 wears the champion's colour even before it is chosen
    const col = chosen ? GOLD : (i === LEVELS - 1 ? '#c8552f' : MUTED);
    drawText(pctx, String(i + 1), x + box / 2, y + 12, col, 3, 'center', '#0a0714');
    selectionFrame(x, y, box, box, frame, chosen);
  }

  const name = LEVEL_NAMES[state.levelCursor];
  const nw = textWidth(name, 2);
  pxRect(pctx, PW / 2 - nw / 2 - 6, y + box + 14, nw + 12, 20, PLATE);
  drawText(pctx, name, PW / 2, y + box + 17, GOLD, 2, 'center', '#3a1020');

  footer('LEFT / RIGHT TO CHOOSE      UP TO LOCK IN      DOWN TO GO BACK');
}

export function renderMode(ctx, state) {
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(state.frame);
  title(state.stage === 'mode' ? 'SAM FIGHTER' : 'VS COMPUTER', 26);
  if (state.stage === 'mode') drawModeStage(state);
  else drawLevelStage(state);
  present(ctx, W, H);
}
