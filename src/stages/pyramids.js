import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse } from '../pixel/draw.js';
import { ditherGradient, ditherDisc, ditherBand } from '../pixel/dither.js';
import { layer, glow, block, signBoard, banner, crate, barrel, basket, sack,
         bystander, paving } from './props.js';
import { palmTree, rng } from './scenery.js';

/* An open excavation site under the pyramids.

   Deliberately the opposite shape to the market street: no buildings framing
   the sides, a low horizon, and enormous silhouettes doing the work instead.
   Scale is the whole point here -- the pyramids run off the top of the frame
   and the colossus is taller than the fighters by half again. */

const PAL = {
  stone: '#cbb27a', stoneHi: '#eddaa8', stoneLo: '#9c8353',
  crowd: [
    { base: '#c85a3c', hi: '#e88a64', lo: '#8a3623', belt: '#5c2119', shoe: '#3a2416', skin: '#c98d5c', skinHi: '#e8b487', hair: '#2b1d16' },
    { base: '#3f6f8c', hi: '#5f97b8', lo: '#274a5f', belt: '#1e3547', shoe: '#3a2c1e', skin: '#e8b487', skinHi: '#ffd6ab', hair: '#241d1a' },
    { base: '#4a3f7a', hi: '#6f62a8', lo: '#2c244f', belt: '#1d1838', shoe: '#3a2c1e', skin: '#d9a878', skinHi: '#f6cb9c', hair: '#1f1a14' },
  ],
};

/** A pyramid big enough to leave the frame. */
function pyramid(c, px, baseY, halfW, h) {
  pxTri(c, px - halfW, baseY, px + halfW, baseY, px, baseY - h, '#c9a05e');
  pxTri(c, px, baseY, px + halfW, baseY, px, baseY - h, '#9d7440');
  for (let i = 6; i < h; i += 7) {
    const w = Math.round(halfW * (1 - i / h));
    pxRect(c, px - w, baseY - i, w * 2, 1, 'rgba(92,62,30,0.26)');
  }
  pxLine(c, px, baseY - h, px, baseY, 1, '#876636');
  pxTri(c, px - halfW - 20, baseY, px - halfW + 14, baseY, px - halfW, baseY - 10, '#dfbe80');
}

/** Seated colossus: a landmark, not a character. */
function colossus(c, x, baseY, h) {
  const w = Math.round(h * 0.52);
  block(c, x - w, baseY - 14, w * 2, 14, '#b89b63', '#d8bd85', '#8a7043');   // plinth
  block(c, x - w + 5, baseY - h * 0.52, w * 2 - 10, h * 0.52 - 14, PAL.stone, PAL.stoneHi, PAL.stoneLo);
  // knees and shins
  pxRect(c, x - w + 2, baseY - h * 0.30, 16, h * 0.30 - 14, '#c3a970');
  pxRect(c, x + w - 18, baseY - h * 0.30, 16, h * 0.30 - 14, '#a68b56');
  // torso and arms laid on the knees
  block(c, x - w * 0.62, baseY - h * 0.84, w * 1.24, h * 0.34, PAL.stone, PAL.stoneHi, PAL.stoneLo);
  pxRect(c, x - w * 0.62, baseY - h * 0.56, w * 1.24, 5, PAL.stoneLo);
  // head and headdress
  pxRect(c, x - 13, baseY - h * 0.99, 26, h * 0.16, '#dcc48a');
  pxRect(c, x - 19, baseY - h * 0.99, 8, h * 0.20, '#c3a970');
  pxRect(c, x + 11, baseY - h * 0.99, 8, h * 0.20, '#a68b56');
  pxRect(c, x - 20, baseY - h * 1.02, 40, 6, '#e8d09a');
  pxRect(c, x - 8, baseY - h * 0.93, 5, 3, '#6b552e');
  pxRect(c, x + 3, baseY - h * 0.93, 5, 3, '#6b552e');
  pxRect(c, x - 6, baseY - h * 0.86, 12, 2, '#6b552e');
  // weathering
  for (let i = 0; i < 5; i++) pxRect(c, x - w + 8 + i * 9, baseY - h * 0.42, 3, 12, '#a68b56');
}

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#2f7fb8', '#5fa8ce', '#9ccadc', '#d8cfa4', '#ecc98a']);
  glow(c, 372, 44, 60, '255, 240, 184', 5, 0.07);
  pxCircle(c, 372, 44, 16, '#fff6d0');
  pxCircle(c, 372, 44, 11, '#ffffff');

  /* ---- far: the pyramids, running off the top of the frame ---- */
  c.drawImage(layer((f) => {
    pyramid(f, 118, PGROUND - 24, 132, 172);
    pyramid(f, 322, PGROUND - 18, 96, 116);
    pyramid(f, 438, PGROUND - 14, 62, 70);
    ditherBand(f, 0, PGROUND - 34, PW, 12, 'rgba(0,0,0,0)', '#e8d9a8', 0.4);   // heat haze
  }), 0, 0);

  /* ---- mid: the colossus, the colonnade, the tents ---- */
  c.drawImage(layer((m) => {
    colossus(m, 62, PGROUND - 2, 152);

    // a run of columns crossing behind the fight, deliberately low contrast
    for (let i = 0; i < 7; i++) {
      const cx = 168 + i * 27;
      const hh = 52 - (i % 3) * 6;
      pxRect(m, cx, PGROUND - hh, 15, hh, '#c6ac74');
      pxRect(m, cx, PGROUND - hh, 4, hh, '#dcc48a');
      pxRect(m, cx + 11, PGROUND - hh, 4, hh, '#a68b56');
      for (let s = 1; s < 5; s++) pxRect(m, cx, PGROUND - hh + s * 11, 15, 1, '#b39a63');
      pxRect(m, cx - 2, PGROUND - hh - 5, 19, 5, '#d3ba84');
      if (i < 5) pxRect(m, cx - 2, PGROUND - hh - 10, 46, 5, '#c0a670');    // lintel
    }

    // caravan tents on the right
    for (const [tx, tw, th] of [[392, 46, 52], [444, 38, 42]]) {
      pxTri(m, tx - tw / 2, PGROUND, tx + tw / 2, PGROUND, tx, PGROUND - th, '#c85a3c');
      pxTri(m, tx, PGROUND, tx + tw / 2, PGROUND, tx, PGROUND - th, '#96402a');
      for (let s = 0; s < th; s += 8) {
        pxRect(m, tx - (tw / 2) * (1 - s / th), PGROUND - s, tw * (1 - s / th), 2, '#e8c060');
      }
      pxRect(m, tx - 6, PGROUND - 20, 12, 20, '#3a2a1c');
      pxLine(m, tx, PGROUND - th, tx, PGROUND - th - 8, 1, '#6d4a2c');
      pxTri(m, tx, PGROUND - th - 8, tx + 10, PGROUND - th - 5, tx, PGROUND - th - 2, '#e8c060');
    }
  }), 0, 0);

  paving(c, ['#e0c184', '#cba669', '#f0d5a2'], '#a8834f', 34);

  /* ---- crowd: watching from the plinth and the tents ---- */
  c.drawImage(layer((p) => {
    bystander(p, 132, PGROUND - 16, 38, PAL.crowd[1], 'stand', 1);
    bystander(p, 152, PGROUND - 14, 36, PAL.crowd[0], 'point', 1);
    bystander(p, 366, PGROUND - 2, 46, PAL.crowd[2], 'crossed', -1);
    bystander(p, 414, PGROUND - 2, 44, PAL.crowd[1], 'cheer', -1);
    bystander(p, 266, PGROUND - 8, 32, PAL.crowd[0], 'lean', -1);
    bystander(p, 218, PGROUND - 8, 31, PAL.crowd[2], 'stand', 1);
  }), 0, 0);

  /* ---- near: fallen stone in the foreground corners ---- */
  c.drawImage(layer((n) => {
    // toppled column, lying across the bottom left
    for (let i = 0; i < 4; i++) {
      pxEllipse(n, 16 + i * 19, PGROUND + 16, 10, 7, '#c6ac74');
      pxEllipse(n, 13 + i * 19, PGROUND + 15, 6, 5, '#dcc48a');
      pxRect(n, 8 + i * 19, PGROUND + 9, 17, 14, '#bda36b');
      pxRect(n, 8 + i * 19, PGROUND + 9, 17, 2, '#dcc48a');
    }
    // broken blocks bottom right
    crate(n, 424, PGROUND + 8, 26, 18, '#c6ac74', '#dcc48a', '#a68b56');
    crate(n, 452, PGROUND + 14, 22, 14, '#bda36b', '#d3ba84', '#8f7549');
    sack(n, 356, PGROUND - 18, 20, 18, '#c8a878', '#e2c79c', '#8f7549', '#8c3226');
    basket(n, 380, PGROUND - 13, 22, 13, '#c8a05c', '#8a6a34', '#d84a3a', '#ff8a6a');
    barrel(n, 468, PGROUND - 22, 16, 22, '#7a5230', '#9c6c42', '#4e3220', '#5b5b66');

    // dig-site markers and a standard planted in the sand
    pxRect(n, 300, PGROUND - 58, 3, 58, '#6d4a2c');
    banner(n, 288, PGROUND - 58, 16, 34, '#3f6f8c', '#e8c060', '#f6efdc');
    signBoard(n, 148, PGROUND - 40, 34, 16, '#e8c060', '#8a4a1f', '#3b1f18', 2);
    pxRect(n, 163, PGROUND - 24, 3, 24, '#6d4a2c');

    palmTree(n, 348, PGROUND - 2, 54, '#7a5a34', '#4f8a3c', '#356028');
    palmTree(n, 466, PGROUND - 2, 40, '#7a5a34', '#4f8a3c', '#356028');
  }), 0, 0);

  const rand = rng(991);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * PW);
    const y = PGROUND + 3 + Math.floor(rand() * (PH - PGROUND - 4));
    pxDot(c, x, y, rand() > 0.5 ? '#f2dcac' : '#a8834f');
  }
}

/* Birds riding the thermals over the site. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.x += 0.16 * d.k;
    if (d.x > PW + 8) d.x = -8;
    const y = d.y * 0.22 + 18 + Math.sin(frame * 0.03 + d.w) * 3;
    const flap = Math.sin(frame * 0.13 + d.w) > 0 ? 1 : -1;
    pxDot(c, d.x, y, '#2c3a4a');
    pxDot(c, d.x - 3, y - flap, '#2c3a4a');
    pxDot(c, d.x + 3, y - flap, '#2c3a4a');
    pxDot(c, d.x - 2, y - flap, '#2c3a4a');
    pxDot(c, d.x + 2, y - flap, '#2c3a4a');
  }
}

export const stage = { key: 'pyramids', name: 'PYRAMIDS', drift: 'birds', paint, overlay };
