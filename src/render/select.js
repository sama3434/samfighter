import { PW, PH, PGROUND, pctx, present } from '../pixel/buffer.js';
import { W, H } from '../config.js';
import { pxRect, pxDot } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { drawText, textWidth } from '../pixel/font.js';
import { paintBody, SPR_AX, SPR_AY, scratch } from './sprite.js';

/* The character select screen. Portraits are the real fighters, drawn with
   the same sprite code the match uses -- so whatever you pick is exactly what
   you get, and the roster can never drift out of sync with the art. */

const CARD_W = 104, CARD_H = 140, CARD_TOP = 60;
const FEET_Y = CARD_TOP + CARD_H - 6;      // portraits stand on the card floor
const NAME_Y = CARD_TOP + CARD_H + 6;      // name and blurb sit below the card
const BLURB_Y = NAME_Y + 17;

/* A fighter-shaped object just complete enough for poseOf() and paintBody(). */
function portraitOf(character, slot) {
  return {
    character, slot,
    attack: null, ko: false, downTimer: 0, hitstun: 0,
    onGround: true, blocking: false, crouching: false,
    vx: 0, walkPhase: 0, facing: 1,
  };
}

function backdrop(frame) {
  ditherGradient(pctx, 0, 0, PW, PH, ['#12102a', '#241a45', '#3f2154', '#5c2a4c']);

  // slow drifting motes, so the screen is not dead still
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 + frame * 0.3) % PW;
    const y = (i * 53 + Math.sin(frame * 0.02 + i) * 6) % PH;
    pxDot(pctx, x, y, i % 3 === 0 ? '#6b5a95' : '#4a3b6b');
  }

  pxRect(pctx, 0, PGROUND + 20, PW, PH - PGROUND - 20, '#1a1430');
  pxRect(pctx, 0, PGROUND + 20, PW, 2, '#3d3160');
}

function cardX(index, count) {
  const span = count * CARD_W + (count - 1) * 24;
  return Math.round((PW - span) / 2 + index * (CARD_W + 24));
}

function drawCard(character, index, count, frame, state) {
  const x = cardX(index, count);
  const chosenBy = [];
  if (state.cursor[0] === index) chosenBy.push(0);
  if (state.cursor[1] === index) chosenBy.push(1);

  // card plate
  pxRect(pctx, x, CARD_TOP, CARD_W, CARD_H, '#0f0b1e');
  pxRect(pctx, x + 2, CARD_TOP + 2, CARD_W - 4, CARD_H - 4, '#241c40');
  ditherDisc(pctx, x + CARD_W / 2, CARD_TOP + CARD_H - 30, 54, '#4a3a7a', 0.5);

  // the portrait: p1 palette unless only player two is hovering this card
  const slot = chosenBy.length === 1 && chosenBy[0] === 1 ? 'p2' : 'p1';
  paintBody(portraitOf(character, slot), frame);
  pctx.drawImage(scratch, x + CARD_W / 2 - SPR_AX, FEET_Y - SPR_AY);

  const nameW = textWidth(character.name, 2);
  pxRect(pctx, x + CARD_W / 2 - nameW / 2 - 5, NAME_Y - 2, nameW + 10, 18, '#0f0b1e');
  drawText(pctx, character.name, x + CARD_W / 2, NAME_Y + 1, '#ffd23f', 2, 'center', '#3a1020');
  drawText(pctx, character.blurb, x + CARD_W / 2, BLURB_Y, '#8f87b0', 1, 'center', '#0f0b1e');

  // selection frames, one per hovering player, insetting so both stay visible
  for (const player of chosenBy) {
    const col = player === 0 ? '#8fc0f8' : '#ff9b8c';
    const inset = player === 0 ? 0 : 3;
    const locked = state.locked[player];
    // The frame is always drawn -- if it blinked off entirely, both cursors
    // would vanish on the same frames and the screen would look unselected.
    // Only the corner ticks pulse, and a locked-in pick stops pulsing.
    const bright = locked || ((frame + player * 8) >> 3) % 2 === 0;

    const bx = x - 4 + inset * 3, by = CARD_TOP - 4 + inset * 3;
    const bw = CARD_W + 8 - inset * 6, bh = CARD_H + 8 - inset * 6;
    for (const [rx, ry, rw, rh] of [
      [bx, by, bw, 2], [bx, by + bh - 2, bw, 2],
      [bx, by, 2, bh], [bx + bw - 2, by, 2, bh],
    ]) pxRect(pctx, rx, ry, rw, rh, bright ? col : '#4a4460');

    if (bright) {
      for (const [cx, cy] of [[bx, by], [bx + bw - 7, by],
                              [bx, by + bh - 7], [bx + bw - 7, by + bh - 7]]) {
        pxRect(pctx, cx, cy, 7, 7, col);
      }
    }
    if (locked) {
      const tick = 'LOCKED';
      const tw = textWidth(tick, 1);
      pxRect(pctx, x + CARD_W / 2 - tw / 2 - 3, by + 6, tw + 6, 11, '#0f0b1e');
      drawText(pctx, tick, x + CARD_W / 2, by + 8, col, 1, 'center');
    }

    const tag = player === 0 ? '1P' : '2P';
    const tx = player === 0 ? bx : bx + bw - 17;
    pxRect(pctx, tx, by - 13, 17, 12, '#0f0b1e');
    pxRect(pctx, tx + 1, by - 12, 15, 10, col);
    drawText(pctx, tag, tx + 3, by - 10, '#0f0b1e', 1, 'left');
  }
}

function drawFooter(state, roster) {
  // status rail, then the hint on its own line below it
  pxRect(pctx, 0, PH - 34, PW, 34, '#0f0b1e');
  pxRect(pctx, 0, PH - 34, PW, 1, '#3d3160');

  for (let i = 0; i < 2; i++) {
    const locked = state.locked[i];
    const col = i === 0 ? '#8fc0f8' : '#ff9b8c';
    const x = i === 0 ? 10 : PW - 10;
    const align = i === 0 ? 'left' : 'right';
    drawText(pctx, `${i === 0 ? '1P' : '2P'} ${roster[state.cursor[i]].name}`,
             x, PH - 29, col, 1, align);
    drawText(pctx, locked ? 'READY' : 'CHOOSING', x, PH - 19,
             locked ? '#7fe0a8' : '#6b6489', 1, align);
  }

  const hint = state.bothLocked
    ? 'GET READY'
    : 'LEFT / RIGHT TO CHOOSE      UP TO LOCK IN      DOWN TO CANCEL';
  drawText(pctx, hint, PW / 2, PH - 9,
           state.bothLocked ? '#ffd23f' : '#a89fc4', 1, 'center');
}

export function renderSelect(ctx, state, roster) {
  const frame = state.frame;
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(frame);

  const title = 'SELECT YOUR FIGHTER';
  const tw = textWidth(title, 3);
  pxRect(pctx, PW / 2 - tw / 2 - 8, 20, tw + 16, 30, '#160b1c');
  pxRect(pctx, PW / 2 - tw / 2 - 6, 22, tw + 12, 26, '#2c1630');
  drawText(pctx, title, PW / 2, 26, '#ffd23f', 3, 'center', '#7a2a1c');

  for (const [i, character] of roster.entries()) drawCard(character, i, roster.length, frame, state);
  drawFooter(state, roster);

  // wipe to black as the match launches
  if (state.countdown > 0) {
    const t = Math.min(1, state.countdown / 45);
    const h = Math.round(PH * t * t);
    pxRect(pctx, 0, 0, PW, h / 2, '#000000');
    pxRect(pctx, 0, PH - h / 2, PW, h / 2, '#000000');
  }

  present(ctx, W, H);
}
