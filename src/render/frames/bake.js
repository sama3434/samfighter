import { hexToRgb } from '../../pixel/draw.js';
import { applyOutline } from '../../pixel/outline.js';
import { OUTLINE } from '../palettes.js';
import { GLYPHS, isGlyph } from './glyphs.js';

/* Turns frame data (rows of glyphs) into a ready-to-blit canvas.

   Stamping a frame pixel by pixel every tick would be tens of thousands of
   fillRects a second, so each (frame, palette) pair is baked once into its own
   canvas and blitted thereafter. The keyline is baked in too -- the canvas is
   padded by one pixel all round so the outline has somewhere to land -- which
   saves the per-fighter getImageData pass the procedural path still needs. */

const cache = new Map();

/** Frame data is inert until something asks for its size. */
export function frameSize(f) {
  return { w: f.rows[0].length, h: f.rows.length };
}

function bake(f, palette) {
  const w = f.rows[0].length, h = f.rows.length;
  const cv = document.createElement('canvas');
  cv.width = w + 2;
  cv.height = h + 2;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;

  const img = c.createImageData(cv.width, cv.height);
  const d = img.data;
  const rgb = new Map();
  const colourOf = (ch) => {
    if (rgb.has(ch)) return rgb.get(ch);
    const g = GLYPHS[ch];
    const hex = g.col || palette[g.key];
    const v = hexToRgb(hex);
    rgb.set(ch, v);
    return v;
  };

  for (let y = 0; y < h; y++) {
    const row = f.rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || !isGlyph(ch)) continue;
      const [r, g, b] = colourOf(ch);
      const o = ((y + 1) * cv.width + (x + 1)) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  applyOutline(c, cv.width, cv.height, OUTLINE);

  // the pad shifts the anchor by one in each direction
  return { canvas: cv, ax: f.ax + 1, ay: f.ay + 1 };
}

/** The baked canvas for one frame in one palette, cached across calls. */
export function baked(id, f, palette) {
  let hit = cache.get(id);
  if (!hit) {
    hit = bake(f, palette);
    cache.set(id, hit);
  }
  return hit;
}

/** Drop every baked canvas. Only tests need this. */
export function clearBakeCache() {
  cache.clear();
}
