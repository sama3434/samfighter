import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxDot, pxTri, pxCircle } from '../pixel/draw.js';
import { ditherGradient, ditherDisc, ditherBand } from '../pixel/dither.js';
import { pineTree, starField, rng } from './scenery.js';

/* Sunrise above the cloud line. */
export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#141c4e', '#2c3f7e', '#6d5f9c', '#d0806a', '#f5b97e']);
  starField(c, 70, 60, 777);

  ditherDisc(c, 138, 93, 40, '#ffb98a', 0.55);
  pxCircle(c, 138, 93, 17, '#ffd9a0');
  pxCircle(c, 138, 93, 12, '#fff3d0');

  // far range
  for (let i = 0; i < 5; i++) {
    const bx = 30 + i * 99;
    const h = 60 + ((i * 37) % 33);
    pxTri(c, bx - 66, PGROUND - 45, bx + 66, PGROUND - 45, bx, PGROUND - 45 - h, '#4a4a80');
  }

  // main peaks with snow caps
  for (const [bx, halfW, h] of [[105, 111, 84], [240, 144, 105], [369, 99, 75]]) {
    const topY = PGROUND - 33 - h;
    pxTri(c, bx - halfW, PGROUND - 33, bx + halfW, PGROUND - 33, bx, topY, '#5b5f96');
    pxTri(c, bx, PGROUND - 33, bx + halfW, PGROUND - 33, bx, topY, '#3f4270');
    const capH = h * 0.42;
    for (let i = 0; i < capH; i++) {
      const w = Math.round(halfW * (i / h)) + 2;
      const jag = Math.round(Math.sin(i * 1.7 + bx) * 2.2);
      pxRect(c, bx - w, topY + i, w + jag, 1, '#f2f4ff');
      pxRect(c, bx, topY + i, w + jag, 1, '#cdd3ee');
    }
    // rock striations down the shadowed face
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      pxTri(c, bx + halfW * t * 0.5, PGROUND - 33, bx + halfW * t * 0.62, PGROUND - 33,
            bx + halfW * t * 0.1, topY + h * 0.5, '#363963');
    }
  }

  // cloud sea
  const rand = rng(5150);
  for (let i = 0; i < 40; i++) {
    const cx = (i * 61) % PW;
    const cy = PGROUND - 39 + ((i * 13) % 14);
    const w = 27 + (i * 7) % 33;
    ditherBand(c, cx, cy, w, 6, 'rgba(0,0,0,0)', '#e8ddf2', 0.75);
    pxRect(c, cx + 3, cy + 2, w - 6, 3, '#f4ecfa');
  }
  ditherGradient(c, 0, PGROUND - 30, PW, 30, ['#b9aed2', '#d9cfe8', '#f2ecf8'], 0.85);

  for (const [tx, th] of [[24, 45], [51, 33], [429, 40], [456, 30], [87, 25]]) {
    pineTree(c, tx, PGROUND - 1, th, '#1e4436', '#2d6249');
  }

  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, ['#f4f6ff', '#cdd6ee', '#a8b4d4']);
  pxRect(c, 0, PGROUND, PW, 2, '#ffffff');
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * PW);
    const y = PGROUND + 4 + Math.floor(rand() * (PH - PGROUND - 5));
    pxRect(c, x, y, 3 + Math.floor(rand() * 4), 1, '#b9c4e0');
  }
}

/* Snow on the wind. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.y += d.s * 0.7;
    d.x += Math.sin(frame * 0.02 + d.w) * 0.35;
    if (d.y > PGROUND) { d.y = -2; d.x = Math.random() * PW; }
    pxDot(c, d.x, d.y, d.s > 0.75 ? '#ffffff' : '#d6ddf2');
  }
}

export const stage = { key: 'mountain', name: 'MOUNTAIN', drift: 'snow', paint, overlay };
