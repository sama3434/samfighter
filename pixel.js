'use strict';

/* ============================================================
   PIXEL LAYER
   Everything is drawn into a 320x180 buffer, then blown up 3x
   with nearest-neighbour sampling. Nothing anti-aliases, so the
   pixel grid stays honest at every step.
   ============================================================ */

const PW = 320, PH = 180, PSCALE = 3;

const pcv = document.createElement('canvas');
pcv.width = PW; pcv.height = PH;
const pctx = pcv.getContext('2d');
pctx.imageSmoothingEnabled = false;

/* ---------- primitives (integer coords, no AA) ---------- */

function pxRect(c, x, y, w, h, col) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function pxDot(c, x, y, col) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), 1, 1);
}

// Bresenham with a square brush, so diagonals stay chunky instead of smooth.
function pxLine(c, x0, y0, x1, y1, thick, col) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const t = Math.max(1, Math.round(thick));
  const off = Math.floor(t / 2);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (;;) {
    c.fillRect(x0 - off, y0 - off, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function pxCircle(c, cx, cy, r, col) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
    c.fillRect(cx - span, cy + y, span * 2 + 1, 1);
  }
}

function pxTri(c, x0, y0, x1, y1, x2, y2, col) {
  const minY = Math.round(Math.min(y0, y1, y2));
  const maxY = Math.round(Math.max(y0, y1, y2));
  c.fillStyle = col;
  for (let y = minY; y <= maxY; y++) {
    let lo = Infinity, hi = -Infinity;
    const edges = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((y >= ay && y <= by) || (y >= by && y <= ay)) {
        const t = by === ay ? 0 : (y - ay) / (by - ay);
        const x = ax + (bx - ax) * t;
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    }
    if (lo <= hi) c.fillRect(Math.round(lo), y, Math.max(1, Math.round(hi - lo)), 1);
  }
}

/* ---------- dithering ----------
   A 4x4 ordered (Bayer) matrix. This is what gives a gradient that
   chunky retro banding instead of a smooth CSS-looking ramp. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// mix: 0 = all colA, 1 = all colB
function ditherBand(c, x, y, w, h, colA, colB, mix) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i, py = y + j;
      const threshold = (BAYER[py & 3][px & 3] + 0.5) / 16;
      c.fillStyle = mix > threshold ? colB : colA;
      c.fillRect(px, py, 1, 1);
    }
  }
}

/* Radial dithered glow. A rectangular dither patch reads as an obvious box,
   so anything round has to be masked to a circle. */
function ditherDisc(c, cx, cy, r, col, mix) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      const falloff = mix * (1 - d) * (1 - d);
      const px2 = cx + x, py2 = cy + y;
      if (falloff > (BAYER[py2 & 3][px2 & 3] + 0.5) / 16) {
        c.fillStyle = col;
        c.fillRect(px2, py2, 1, 1);
      }
    }
  }
}

/* Vertical gradient through a list of colour stops. Each stop holds a flat
   band and only the seam between two bands is dithered -- dithering the whole
   height just produces uniform noise, which is not what pixel art does. */
function ditherGradient(c, x, y, w, h, stops, zone = 0.42) {
  const segs = stops.length - 1;
  for (let j = 0; j < h; j++) {
    const t = segs * (j / (h - 1 || 1));
    const i = Math.min(segs - 1, Math.floor(t));
    const local = t - i;
    const mix = local < 1 - zone ? 0 : (local - (1 - zone)) / zone;
    ditherBand(c, x, y + j, w, 1, stops[i], stops[i + 1], mix);
  }
}

/* ---------- silhouette outline ----------
   Reads the scratch buffer and paints an outline into every
   transparent pixel that touches an opaque one. Cheap way to get
   the hard keyline that arcade sprites all have. */
function applyOutline(c, w, h, col) {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 128 ? 1 : 0;

  const rgb = hexToRgb(col);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const near =
        (x > 0 && solid[i - 1]) ||
        (x < w - 1 && solid[i + 1]) ||
        (y > 0 && solid[i - w]) ||
        (y < h - 1 && solid[i + w]);
      if (near) {
        const o = i * 4;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
      }
    }
  }
  c.putImageData(img, 0, 0);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ============================================================
   5x7 BITMAP FONT
   Canvas text at this resolution turns to mush, so the HUD gets
   a real bitmap font instead.
   ============================================================ */
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const GLYPH_W = 5, GLYPH_H = 7, GLYPH_GAP = 1;

function textWidth(str, scale = 1) {
  return str.length * (GLYPH_W + GLYPH_GAP) * scale - GLYPH_GAP * scale;
}

/* align: 'left' | 'center' | 'right' */
function drawText(c, str, x, y, col, scale = 1, align = 'left', shadow = null) {
  str = String(str).toUpperCase();
  let sx = x;
  if (align === 'center') sx = x - textWidth(str, scale) / 2;
  else if (align === 'right') sx = x - textWidth(str, scale);
  sx = Math.round(sx);
  y = Math.round(y);

  for (const pass of shadow ? [shadow, null] : [null]) {
    const off = pass ? 1 : 0;
    const colour = pass ? pass : col;
    let cx = sx + off;
    for (const ch of str) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let r = 0; r < GLYPH_H; r++) {
        for (let q = 0; q < GLYPH_W; q++) {
          if (g[r][q] === '#') {
            c.fillStyle = colour;
            c.fillRect(cx + q * scale, y + off + r * scale, scale, scale);
          }
        }
      }
      cx += (GLYPH_W + GLYPH_GAP) * scale;
    }
  }
}
