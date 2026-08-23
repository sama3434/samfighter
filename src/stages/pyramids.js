import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { palmTree, rng } from './scenery.js';

/* Noon over the desert. */
export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#3a86b8', '#6fb4d4', '#a9d6e0', '#e6d5a4', '#eec98a']);

  ditherDisc(c, 81, 75, 45, '#fff0b8', 0.85);
  pxCircle(c, 81, 75, 18, '#fff6d0');
  pxCircle(c, 81, 75, 13, '#ffffff');

  function pyramid(px, baseY, halfW, h) {
    pxTri(c, px - halfW, baseY, px + halfW, baseY, px, baseY - h, '#c9a05e');
    pxTri(c, px, baseY, px + halfW, baseY, px, baseY - h, '#a37b45');
    // casing-stone courses
    for (let i = 5; i < h; i += 6) {
      const w = Math.round(halfW * (1 - i / h));
      pxRect(c, px - w, baseY - i, w * 2, 1, 'rgba(90,60,30,0.30)');
    }
    pxLine(c, px, baseY - h, px, baseY, 1, '#8a6636');
    pxRect(c, px - halfW, baseY, halfW * 2, 2, '#8a6636');
    // sand drift banking against the base
    pxTri(c, px - halfW - 14, baseY + 2, px - halfW + 10, baseY + 2, px - halfW, baseY - 6, '#dfbe80');
  }
  pyramid(111, PGROUND - 9, 69, 78);
  pyramid(294, PGROUND - 6, 51, 60);
  pyramid(387, PGROUND - 3, 36, 40);

  // obelisk
  pxRect(c, 222, PGROUND - 60, 11, 60, '#cbb27a');
  pxRect(c, 222, PGROUND - 60, 3, 60, '#e2cd9c');
  pxRect(c, 230, PGROUND - 60, 3, 60, '#a8905c');
  pxTri(c, 220, PGROUND - 60, 235, PGROUND - 60, 227, PGROUND - 71, '#e2cd9c');
  for (let i = 0; i < 5; i++) pxRect(c, 224, PGROUND - 52 + i * 9, 5, 2, '#a8905c');

  // broken columns
  for (const [ox, oh] of [[30, 27], [45, 18], [450, 23]]) {
    pxRect(c, ox, PGROUND - oh, 12, oh, '#d3ba84');
    pxRect(c, ox, PGROUND - oh, 4, oh, '#eddaa8');
    pxRect(c, ox - 2, PGROUND - oh - 4, 16, 4, '#c0a670');
    for (let i = 1; i < 4; i++) pxRect(c, ox, PGROUND - oh + i * 7, 12, 1, '#b99f6a');
  }

  // dunes
  for (let x = 0; x < PW; x++) {
    const h = 15 + Math.sin(x * 0.019) * 9 + Math.sin(x * 0.06 + 1) * 4;
    pxRect(c, x, PGROUND - h, 1, h, '#e0c184');
    pxRect(c, x, PGROUND - h, 1, 2, '#f0d5a2');
  }

  palmTree(c, 432, PGROUND - 1, 45, '#7a5a34', '#4f8a3c', '#356028');
  palmTree(c, 459, PGROUND - 1, 33, '#7a5a34', '#4f8a3c', '#356028');
  palmTree(c, 18, PGROUND - 1, 39, '#7a5a34', '#4f8a3c', '#356028');

  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, ['#e6c489', '#c9a266', '#a8834f']);
  pxRect(c, 0, PGROUND, PW, 2, '#f0d5a2');
  const rand = rng(991);
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rand() * PW);
    const y = PGROUND + 3 + Math.floor(rand() * (PH - PGROUND - 4));
    pxDot(c, x, y, rand() > 0.5 ? '#f2dcac' : '#96774a');
  }
  for (let j = 1; j < 6; j++) {
    const y = PGROUND + 2 + j * j * 1.9;
    for (let x = (j * 11) % 18; x < PW; x += 18) pxRect(c, x, y, 9, 1, '#bb9459');
  }
}

/* Birds working the thermals. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.x += 0.16 * d.k;
    if (d.x > PW + 8) d.x = -8;
    const y = d.y * 0.36 + 22 + Math.sin(frame * 0.03 + d.w) * 3;
    const flap = Math.sin(frame * 0.13 + d.w) > 0 ? 1 : -1;
    pxDot(c, d.x, y, '#2c3a4a');
    pxDot(c, d.x - 3, y - flap, '#2c3a4a');
    pxDot(c, d.x + 3, y - flap, '#2c3a4a');
    pxDot(c, d.x - 2, y - flap, '#2c3a4a');
    pxDot(c, d.x + 2, y - flap, '#2c3a4a');
  }
}

export const stage = { key: 'pyramids', name: 'PYRAMIDS', drift: 'birds', paint, overlay };
