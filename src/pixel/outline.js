import { hexToRgb } from './draw.js';

/* Paints a keyline into every transparent pixel touching an opaque one.
   Arcade sprites all have this hard silhouette edge; without it a figure
   dissolves into a busy stage. */
export function applyOutline(c, w, h, col) {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 128 ? 1 : 0;

  const [r, g, b] = hexToRgb(col);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const touches =
        (x > 0 && solid[i - 1]) ||
        (x < w - 1 && solid[i + 1]) ||
        (y > 0 && solid[i - w]) ||
        (y < h - 1 && solid[i + w]);
      if (touches) {
        const o = i * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
  }
  c.putImageData(img, 0, 0);
}
