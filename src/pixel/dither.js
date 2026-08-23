import { hexToRgb } from './draw.js';

/* Ordered 4x4 Bayer dithering. Gradients in pixel art are banded flat colours
   with a dithered seam between them -- dithering the whole span just produces
   uniform noise, which is what a naive gradient looks like. */
export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** mix: 0 = all colA, 1 = all colB */
export function ditherBand(c, x, y, w, h, colA, colB, mix) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = Math.round(x + i), py = Math.round(y + j);
      const threshold = (BAYER[py & 3][px & 3] + 0.5) / 16;
      c.fillStyle = mix > threshold ? colB : colA;
      c.fillRect(px, py, 1, 1);
    }
  }
}

/* Vertical gradient through a list of colour stops. Composed as one ImageData
   because a 480x235 sky is 113k pixels and per-pixel fillRect is far too slow
   even for a one-off paint. */
export function ditherGradient(c, x, y, w, h, stops, zone = 0.42) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const segs = stops.length - 1;
  const rgbs = stops.map(hexToRgb);
  const img = c.createImageData(w, h);
  const d = img.data;

  for (let j = 0; j < h; j++) {
    const t = segs * (j / (h - 1 || 1));
    const i = Math.min(segs - 1, Math.floor(t));
    const local = t - i;
    const mix = local < 1 - zone ? 0 : (local - (1 - zone)) / zone;
    const a = rgbs[i], b = rgbs[i + 1];
    const row = (y + j) & 3;
    for (let q = 0; q < w; q++) {
      const col = mix > (BAYER[row][(x + q) & 3] + 0.5) / 16 ? b : a;
      const o = (j * w + q) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  c.putImageData(img, x, y);
}

/* Radial glow. Two things matter here: the patch has to be masked to a circle
   (a rectangular dither reads as an obvious box), and the threshold needs a
   hash-based jitter mixed into the Bayer value -- on a smooth radial falloff
   the bare 4x4 matrix produces visible square steps where whole threshold
   bands switch on at once. */
export function ditherDisc(c, cx, cy, r, col, mix) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      const falloff = mix * (1 - d) * (1 - d);
      const px = cx + x, py = cy + y;
      const hash = ((px * 73856093) ^ (py * 19349663)) & 15;
      const threshold = (BAYER[py & 3][px & 3] * 0.45 + hash * 0.55 + 0.5) / 16;
      if (falloff > threshold) c.fillRect(px, py, 1, 1);
    }
  }
}
