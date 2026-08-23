import { PW, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { pagodaRoof, ridge, tiledFloor, rng } from './scenery.js';

/* Dusk over a mountain shrine. */
export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#1b1038', '#3a1b4e', '#782f55', '#c05a46', '#e8956a']);

  ditherDisc(c, 372, 84, 34, '#ffd9b0', 0.6);
  pxCircle(c, 372, 84, 20, '#ffeccc');
  pxCircle(c, 366, 78, 5, '#f0d8b4');
  pxCircle(c, 378, 91, 3, '#f0d8b4');
  pxCircle(c, 377, 74, 2, '#f0d8b4');

  ridge(c, PGROUND - 66, 39, 0.021, 2, 66, '#3a2050');
  ridge(c, PGROUND - 39, 21, 0.03, 1.5, 39, '#2a1740');

  // pagoda
  const cx = 240, base = PGROUND - 9;
  pxRect(c, cx - 45, base - 51, 90, 51, '#5c2233');
  pxRect(c, cx - 45, base - 51, 5, 51, '#7a3245');
  pxRect(c, cx + 40, base - 51, 5, 51, '#411824');
  for (const wx of [-33, 21]) {
    pxRect(c, cx + wx, base - 45, 12, 18, '#2b1220');
    pxRect(c, cx + wx + 1, base - 44, 10, 16, '#f0b45c');
    pxLine(c, cx + wx + 6, base - 44, cx + wx + 6, base - 28, 1, '#8a5a26');
  }
  pxRect(c, cx - 9, base - 33, 18, 33, '#2b1220');
  pxRect(c, cx - 7, base - 30, 14, 30, '#f2c070');
  pxRect(c, cx - 2, base - 30, 3, 30, '#8a5a26');
  pagodaRoof(c, cx, base - 51, 60, 13, '#8c2f38', '#5e1d28', '#6b2029');

  pxRect(c, cx - 36, base - 90, 72, 26, '#4d1d2c');
  for (const wx of [-21, 9]) {
    pxRect(c, cx + wx, base - 84, 11, 14, '#2b1220');
    pxRect(c, cx + wx + 1, base - 83, 9, 12, '#f0b45c');
  }
  pagodaRoof(c, cx, base - 90, 48, 12, '#8c2f38', '#5e1d28', '#6b2029');

  pxRect(c, cx - 24, base - 120, 48, 20, '#4d1d2c');
  pxRect(c, cx - 6, base - 116, 12, 12, '#f0b45c');
  pagodaRoof(c, cx, base - 120, 36, 10, '#8c2f38', '#5e1d28', '#6b2029');
  pxRect(c, cx - 2, base - 141, 4, 13, '#e0a850');
  pxCircle(c, cx, base - 144, 3, '#ffd98a');

  // steps up to the doorway
  for (let i = 0; i < 3; i++) {
    pxRect(c, cx - 24 - i * 5, base + i * 3, 48 + i * 10, 3, i % 2 ? '#4a3228' : '#5d4238');
  }

  // torii gate
  pxRect(c, 66, PGROUND - 60, 7, 60, '#a83a34');
  pxRect(c, 111, PGROUND - 60, 7, 60, '#a83a34');
  pxRect(c, 66, PGROUND - 60, 2, 60, '#c85a4e');
  pxRect(c, 54, PGROUND - 66, 76, 6, '#c04a3e');
  pxRect(c, 51, PGROUND - 73, 82, 5, '#8e2c28');
  pxRect(c, 60, PGROUND - 51, 64, 4, '#c04a3e');

  // cherry tree
  pxLine(c, 432, PGROUND, 426, PGROUND - 39, 6, '#3d2436');
  pxLine(c, 426, PGROUND - 30, 411, PGROUND - 45, 4, '#3d2436');
  pxLine(c, 426, PGROUND - 33, 444, PGROUND - 48, 4, '#3d2436');
  for (const [bx, by, r] of [[411, -51, 14], [432, -60, 17], [450, -48, 12], [423, -42, 11], [444, -33, 9]]) {
    pxCircle(c, bx, PGROUND + by, r, '#d9628c');
    pxCircle(c, bx - 3, PGROUND + by - 3, Math.max(3, r - 6), '#f090b0');
  }

  // hanging lanterns
  for (const lx of [165, 198, 282, 315]) {
    pxLine(c, lx, PGROUND - 78, lx, PGROUND - 69, 1, '#2b1220');
    ditherDisc(c, lx, PGROUND - 62, 14, '#ff9a5c', 0.35);
    pxRect(c, lx - 5, PGROUND - 69, 11, 14, '#e8623c');
    pxRect(c, lx - 3, PGROUND - 66, 7, 8, '#ffd06a');
    pxRect(c, lx - 5, PGROUND - 69, 11, 2, '#7a2418');
  }

  tiledFloor(c, ['#5d4238', '#3a2622', '#8a6450'], '#2a1a18', 20);
  pxRect(c, 0, PGROUND - 9, PW, 9, '#463028');
  pxRect(c, 0, PGROUND - 9, PW, 2, '#6b4c3c');
  const rand = rng(88);
  for (let i = 0; i < 40; i++) {
    pxRect(c, Math.floor(rand() * PW), PGROUND - 8 + Math.floor(rand() * 6), 2, 1, '#3a2820');
  }
}

/* Petals drifting across on the evening breeze. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.y += d.s * 0.5;
    d.x -= 0.35 + Math.sin(frame * 0.03 + d.w) * 0.5;
    if (d.y > PGROUND) { d.y = -2; d.x = Math.random() * PW; }
    if (d.x < -2) d.x = PW + 2;
    pxDot(c, d.x, d.y, d.s > 0.7 ? '#f7a8c4' : '#d9628c');
  }
}

export const stage = { key: 'temple', name: 'TEMPLE', drift: 'petals', paint, overlay };
