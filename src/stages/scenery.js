import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxDot, pxLine, pxTri, pxCircle } from '../pixel/draw.js';
import { ditherGradient } from '../pixel/dither.js';

/* Scenery shared between stages. Anything a second stage would want lives
   here rather than being copied. */

/** Deterministic generator, so a stage paints identically every time. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Pagoda-style roof: rows narrowing upward with the corners flicked up. */
export function pagodaRoof(c, cx, baseY, halfW, h, top, edge, tile) {
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const w = Math.round(halfW * (1 - t * 0.72));
    pxRect(c, cx - w, baseY - i, w * 2, 1, i > h - 4 ? edge : top);
  }
  if (tile) {
    for (let x = -halfW + 4; x < halfW - 2; x += 7) {
      const t = 1 - Math.abs(x) / halfW;
      pxLine(c, cx + x, baseY, cx + x * 0.5, baseY - h * 0.8 * t, 1, tile);
    }
  }
  pxRect(c, cx - halfW - 5, baseY - 3, 6, 2, edge);
  pxRect(c, cx - halfW - 7, baseY - 6, 5, 3, edge);
  pxRect(c, cx + halfW - 1, baseY - 3, 6, 2, edge);
  pxRect(c, cx + halfW + 2, baseY - 6, 5, 3, edge);
  pxRect(c, cx - halfW - 2, baseY, halfW * 2 + 4, 2, edge);
}

export function windowLights(c, x, y, w, h, cols, density, rand) {
  for (let wy = y + 5; wy < y + h - 5; wy += 8) {
    for (let wx = x + 3; wx < x + w - 4; wx += 6) {
      if (rand() < density) {
        pxRect(c, wx, wy, 3, 4, cols[Math.floor(rand() * cols.length)]);
      }
    }
  }
}

export function pineTree(c, x, baseY, h, dark, light) {
  const w = Math.round(h * 0.42);
  pxRect(c, x - 2, baseY - 5, 4, 5, '#2a1b16');
  for (let i = 0; i < 3; i++) {
    const ty = baseY - 5 - i * (h / 3.6);
    const tw = w * (1 - i * 0.26);
    pxTri(c, x - tw, ty, x + tw, ty, x, ty - h / 2.6, dark);
    pxTri(c, x - tw * 0.55, ty - 2, x + tw * 0.2, ty - 2, x - tw * 0.1, ty - h / 3.2, light);
  }
}

export function palmTree(c, x, baseY, h, trunk, frond, frondDark) {
  for (let i = 0; i < h; i++) {
    pxRect(c, x + Math.round(Math.sin((i / h) * 1.1) * 5), baseY - i, 4, 1, trunk);
  }
  const tx = x + Math.round(Math.sin(1.1) * 5) + 2;
  const ty = baseY - h;
  const dirs = [[-1, -0.5], [1, -0.5], [-1, 0.25], [1, 0.25], [-0.4, -1], [0.4, -1]];
  for (const [dx, dy] of dirs) {
    for (let i = 0; i < 16; i++) {
      const px = tx + dx * i * 1.4;
      const py = ty + dy * i * 1.4 + i * i * 0.05;
      pxRect(c, px, py, 3, 3, i > 9 ? frondDark : frond);
    }
  }
  pxCircle(c, tx, ty, 4, frondDark);
  pxRect(c, tx - 2, ty + 2, 5, 4, '#6b4a26');
}

export function starField(c, count, maxY, seed) {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * PW);
    const y = Math.floor(rand() * maxY);
    const b = rand();
    pxDot(c, x, y, b > 0.85 ? '#ffffff' : b > 0.5 ? '#c8d4ff' : '#8a93c9');
  }
}

/** Ridged silhouette across the full width, used for distant hills. */
export function ridge(c, baseY, amp, freq, phase, depth, col) {
  for (let x = 0; x < PW; x++) {
    const h = amp + Math.sin(x * freq) * amp * 0.5 + Math.sin(x * freq * 2.4 + phase) * amp * 0.25;
    pxRect(c, x, baseY - h, 1, h + depth, col);
  }
}

/** Floor slab with perspective seams fanning toward the viewer. */
export function tiledFloor(c, [near, far, lip], seam, tileW) {
  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, [near, far]);
  pxRect(c, 0, PGROUND, PW, 2, lip);
  pxRect(c, 0, PGROUND + 2, PW, 1, seam);
  for (let i = -8; i <= 8; i++) {
    pxLine(c, PW / 2 + i * tileW, PGROUND + 3, PW / 2 + i * tileW * 3.1, PH, 1, seam);
  }
  for (let j = 1; j < 5; j++) {
    pxRect(c, 0, PGROUND + 3 + j * j * 2.6, PW, 1, seam);
  }
}
