import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { windowLights, starField, rng } from './scenery.js';

/* Neon rooftops at night. */
export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#080a1e', '#12163a', '#241a4e', '#3d2352', '#5c2f4e']);
  starField(c, 200, 135, 4242);

  pxCircle(c, 87, 78, 15, '#e8eaff');
  pxCircle(c, 81, 72, 4, '#c9cdf0');
  pxCircle(c, 93, 84, 3, '#c9cdf0');
  ditherDisc(c, 87, 78, 34, '#8f9adf', 0.3);

  const rand = rng(20240823);

  // far skyline
  let x = -9;
  while (x < PW + 9) {
    const w = 21 + rand() * 30;
    const h = 45 + rand() * 69;
    pxRect(c, x, PGROUND - 39 - h, w, h + 39, '#171436');
    windowLights(c, x, PGROUND - 39 - h, w, h, ['#4a5aa8', '#5f6fc0'], 0.22, rand);
    x += w + 5;
  }

  // near skyline
  x = -15;
  while (x < PW + 15) {
    const w = 33 + rand() * 39;
    const h = 51 + rand() * 81;
    const top = PGROUND - 21 - h;
    pxRect(c, x, top, w, h + 21, '#241c44');
    pxRect(c, x, top, 3, h + 21, '#332a58');
    pxRect(c, x, top, w, 2, '#3e3468');
    windowLights(c, x, top, w, h, ['#ffd980', '#ffb45e', '#9fd4ff'], 0.4, rand);
    if (rand() > 0.5) {
      pxRect(c, x + 6, top - 9, 11, 9, '#1b1536');       // water tank
      pxRect(c, x + 4, top - 11, 15, 2, '#2c2350');
      pxLine(c, x + 8, top, x + 8, top - 9, 1, '#0f0c22');
    } else {
      pxLine(c, x + w / 2, top, x + w / 2, top - 14, 1, '#1b1536');   // aerial
      pxRect(c, x + w / 2 - 2, top - 17, 4, 3, '#ff5a5a');
    }
    x += w + 6;
  }

  // neon signage
  pxRect(c, 39, PGROUND - 87, 33, 23, '#0e0b22');
  pxRect(c, 42, PGROUND - 84, 27, 17, '#ff3f8e');
  pxRect(c, 45, PGROUND - 81, 21, 11, '#ffa8d0');
  ditherDisc(c, 55, PGROUND - 75, 26, '#ff3f8e', 0.28);

  pxRect(c, 321, PGROUND - 99, 21, 39, '#0e0b22');
  for (let i = 0; i < 4; i++) pxRect(c, 324, PGROUND - 96 + i * 9, 15, 6, '#38f0d0');

  pxRect(c, 402, PGROUND - 75, 45, 15, '#0e0b22');
  pxRect(c, 405, PGROUND - 72, 39, 9, '#ffd166');
  ditherDisc(c, 424, PGROUND - 67, 28, '#ffd166', 0.22);

  // street
  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, ['#2a2540', '#1a1730', '#12101f']);
  pxRect(c, 0, PGROUND, PW, 2, '#4a4270');
  pxRect(c, 0, PGROUND + 2, PW, 1, '#2f2a4c');
  for (let i = 0; i < 7; i++) pxRect(c, 18 + i * 72, PGROUND + 18, 33, 3, '#544b7a');

  for (const lx of [84, 240, 396]) {
    ditherDisc(c, lx, PGROUND + 14, 26, '#3d3a52', 0.5);
    ditherDisc(c, lx, PGROUND + 8, 14, '#574e5e', 0.5);
    pxRect(c, lx - 2, PGROUND - 51, 3, 51, '#141126');
    pxRect(c, lx - 6, PGROUND - 56, 12, 5, '#141126');
    pxRect(c, lx - 5, PGROUND - 55, 10, 3, '#ffe9a8');
  }
}

/* The pink sign stutters and the teal bars chase. */
export function overlay(c, frame) {
  if ((frame >> 4) % 5 !== 0) {
    pxRect(c, 42, PGROUND - 84, 27, 17, '#ff3f8e');
    pxRect(c, 45, PGROUND - 81, 21, 11, '#ffa8d0');
  }
  for (let i = 0; i < 4; i++) {
    const on = ((frame >> 3) + i) % 4 !== 0;
    pxRect(c, 324, PGROUND - 96 + i * 9, 15, 6, on ? '#38f0d0' : '#14544c');
  }
  pxRect(c, 405, PGROUND - 72, 39, 9, Math.sin(frame * 0.06) > 0 ? '#ffd166' : '#c99a3a');
}

export const stage = { key: 'city', name: 'CITY', drift: 'none', paint, overlay };
