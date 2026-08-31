import { PW, PH, pctx, present } from '../pixel/buffer.js';
import { W, H } from '../config.js';
import { pxRect, pxDot } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { drawText, GLYPHS, GLYPH_W, GLYPH_H } from '../pixel/font.js';

/* The attract screen. Same backdrop, palette and font as the mode and select
   screens, so walking in from the title feels like moving through one menu
   rather than arriving at a different program.

   The backdrop is spelled out again here rather than shared: render/mode.js
   keeps its helpers private and belongs to the mode screen. Two short paint
   functions that happen to agree is a cheaper coupling than a third module
   owning both screens' background. The one thing left out is mode.js's ground
   band -- PGROUND + 20 is PH exactly, so it paints nothing. */

const GOLD = '#ffd23f', PLATE = '#0f0b1e', HINT = '#a89fc4', MUTED = '#8f87b0';

/* The logo is built from the 5x7 glyph bitmaps at a much larger cell size,
   then given the depth the small font has no room for: each letter is a slab
   standing off the screen, lit from the top left, with its extruded side
   falling away down-right.

   Three ramps, and they must not overlap. The face catches the key light. The
   side never does, so even its brightest step sits below the face's darkest,
   which is what stops the extrusion from reading as more letter. */
const FACE = ['#fff6d5', '#ffe27a', '#ffd23f', '#ffb52a', '#f2871f', '#d8601c', '#b13f1a'];
const SIDE = ['#8f3418', '#742a16', '#5c2113', '#471910', '#33120c'];
/* The face while the shimmer crosses it: the same ramp pushed up toward white
   so the band reads as light on the slab, not a different colour of slab. The
   glint is two bands, a bright core inside a wider shoulder -- one hard-edged
   band on its own reads as a rectangle sliding past rather than as light. */
const LIT = ['#ffffff', '#fffdf2', '#fff6d5', '#ffe9a8', '#ffd98a', '#ffc25e', '#ff9d3a'];
const GLOW = FACE.map((_, r) => FACE[Math.max(0, r - 2)]);
const BEVEL_HI = '#fffbe8';
const BEVEL_LO = '#a8391a';
const KEYLINE = '#160b1c';

/* Two words at two sizes: the short one reads as a byline over the long one,
   which is what stops SAM from being three lonely letters at FIGHTER's size. */
const WORDS = [
  { text: 'SAM', y: 28, scale: 6 },
  { text: 'FIGHTER', y: 88, scale: 8 },
];

/* Letters are tracked two cells apart rather than the font's one, and the
   keyline is measured in buffer pixels rather than cells. Both are the same
   fix: at this size a cell-thick keyline is eight pixels, so across a one-cell
   gap each letter's outline met its neighbour's and the word set solid into a
   single black slab. Three pixels of keyline inside a sixteen-pixel gap leaves
   sky between the letters, which is what makes them read as separate objects
   standing up off the screen. */
const TRACK = 2;
const KEY = 3;
const BEV = 2;                 // bevel thickness on the face, buffer pixels
const depthOf = (scale) => Math.max(3, Math.round(scale * 0.75));

const SWEEP_PERIOD = 220;      // frames between shimmers -- roughly 3.7 seconds
const SWEEP_FRAMES = 60;       // how long the band takes to cross

function glyphMask(text) {
  const cw = text.length * (GLYPH_W + TRACK) - TRACK;
  const grid = [];
  for (let r = 0; r < GLYPH_H; r++) grid.push(new Array(cw).fill(false));
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch] || GLYPHS[' '];
    const base = i * (GLYPH_W + TRACK);
    for (let r = 0; r < GLYPH_H; r++) {
      for (let q = 0; q < GLYPH_W; q++) if (g[r][q] === '#') grid[r][base + q] = true;
    }
  });
  return { grid, cw };
}

/** A word's cell grid and where its baked canvas lands in the buffer. The
    canvas carries the keyline on every side and the extrusion down-right, so
    cell (0,0) sits KEY pixels in from its top-left corner. */
function wordMetrics({ text, y, scale }) {
  const { grid, cw } = glyphMask(text);
  const d = depthOf(scale);
  const w = cw * scale + d + KEY * 2;
  const h = GLYPH_H * scale + d + KEY * 2;
  return { grid, cw, d, w, h, x: Math.round(PW / 2 - w / 2), y: y - KEY };
}

/** The whole logo's bounding box, keyline and extrusion included. Exported so
    a test can assert it stays inside the buffer without reading pixels back. */
export function logoBox() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const word of WORDS) {
    const m = wordMetrics(word);
    x0 = Math.min(x0, m.x);
    x1 = Math.max(x1, m.x + m.w);
    y0 = Math.min(y0, m.y);
    y1 = Math.max(y1, m.y + m.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function scratch(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  return { cv, c };
}

/* One word, drawn once into its own canvas. Every frame after that is a blit,
   which is what lets the keyline and bevel be measured in pixels instead of
   whole cells: at sixty frames a second none of this could run per pixel. */
function bakeWord(word, faceRamp) {
  const { grid, cw, d, w, h } = wordMetrics(word);
  const { scale } = word;
  const { cv, c } = scratch(w, h);

  const at = (r, i) => r >= 0 && r < GLYPH_H && i >= 0 && i < cw && grid[r][i];
  const cx = (i) => KEY + i * scale;
  const cy = (r) => KEY + r * scale;
  const eachCell = (fn) => {
    for (let r = 0; r < GLYPH_H; r++) {
      for (let i = 0; i < cw; i++) if (grid[r][i]) fn(cx(i), cy(r), r, i);
    }
  };

  /* The keyline is grown from the silhouette -- face plus every extrusion
     step -- by stamping it around in a ring. Dilating a shape with a few
     dozen blits costs nothing next to walking its pixels. */
  const sil = scratch(w, h);
  sil.c.fillStyle = '#fff';
  for (let k = d; k >= 0; k--) eachCell((X, Y) => sil.c.fillRect(X + k, Y + k, scale, scale));
  sil.c.globalCompositeOperation = 'source-in';
  sil.c.fillStyle = KEYLINE;
  sil.c.fillRect(0, 0, w, h);
  for (let dy = -KEY; dy <= KEY; dy++) {
    for (let dx = -KEY; dx <= KEY; dx++) c.drawImage(sil.cv, dx, dy);
  }

  /* The side, deepest step first. Each step covers all the ones behind it bar
     a one-pixel band, so what survives is a graded wall running from the face
     down into the dark. */
  for (let k = d; k >= 1; k--) {
    const t = d === 1 ? 0 : (k - 1) / (d - 1);
    c.fillStyle = SIDE[Math.round(t * (SIDE.length - 1))];
    eachCell((X, Y) => c.fillRect(X + k, Y + k, scale, scale));
  }

  /* The face, ramped down the rows, then bevelled: the two edges facing the
     light are picked out bright, the two facing the extrusion fall away. Only
     edges on the glyph's outside get one, so a letter reads as a single slab
     rather than a wall of tiles. */
  eachCell((X, Y, r, i) => {
    c.fillStyle = faceRamp[r];
    c.fillRect(X, Y, scale, scale);
    c.fillStyle = BEVEL_LO;
    if (!at(r + 1, i)) c.fillRect(X, Y + scale - BEV, scale, BEV);
    if (!at(r, i + 1)) c.fillRect(X + scale - BEV, Y, BEV, scale);
    c.fillStyle = BEVEL_HI;
    if (!at(r - 1, i)) c.fillRect(X, Y, scale, BEV);
    if (!at(r, i - 1)) c.fillRect(X, Y, BEV, scale);
  });

  return cv;
}

let baked = null;
function logo() {
  if (!baked) {
    baked = WORDS.map((word) => ({
      word,
      m: wordMetrics(word),
      base: bakeWord(word, FACE),
      glow: bakeWord(word, GLOW),
      lit: bakeWord(word, LIT),
    }));
  }
  return baked;
}

function backdrop(frame) {
  ditherGradient(pctx, 0, 0, PW, PH, ['#12102a', '#241a45', '#3f2154', '#5c2a4c']);
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 + frame * 0.3) % PW;
    const y = (i * 53 + Math.sin(frame * 0.02 + i) * 6) % PH;
    pxDot(pctx, x, y, i % 3 === 0 ? '#6b5a95' : '#4a3b6b');
  }
}

function footer(hint) {
  pxRect(pctx, 0, PH - 24, PW, 24, PLATE);
  pxRect(pctx, 0, PH - 24, PW, 1, '#3d3160');
  drawText(pctx, hint, PW / 2, PH - 16, HINT, 1, 'center');
}

/* One cell-row of a brighter bake, blitted over the same row of the base. The
   band is clipped to the word's canvas rather than wrapped, so it can run on
   and off the ends without the arithmetic having to care. */
function strip(src, m, r, scale, x0, x1) {
  const from = Math.max(0, Math.round(x0));
  const to = Math.min(m.w, Math.round(x1));
  if (to <= from) return;
  const sy = KEY + r * scale;
  pctx.drawImage(src, from, sy, to - from, scale, m.x + from, m.y + sy, to - from, scale);
}

/* A cabinet's PRESS START is off for a good part of its cycle -- a prompt that
   only changes colour reads as decoration, one that vanishes reads as an
   instruction the machine is waiting on. */
function prompt(frame) {
  const phase = frame % 64;
  drawText(pctx, 'TO PICK HOW YOU WILL FIGHT', PW / 2, 224, MUTED, 1, 'center', PLATE);
  if (phase < 44) {
    drawText(pctx, 'PRESS ENTER', PW / 2, 196,
             phase < 22 ? GOLD : '#fff0b0', 3, 'center', '#7a2a1c');
  }
}

export function renderTitle(ctx, state) {
  const frame = state.frame;
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(frame);

  // the logo sits on its own pool of light, or it floats on the gradient
  ditherDisc(pctx, PW / 2, 96, 168, '#5b3a8c', 0.55);

  const t = frame % SWEEP_PERIOD;
  const sweep = t < SWEEP_FRAMES ? Math.round(-140 + (t / SWEEP_FRAMES) * (PW + 300)) : -1;

  for (const { word, m, base, glow, lit } of logo()) {
    pctx.drawImage(base, m.x, m.y);
    if (sweep < 0) continue;
    /* The band leans, so the light reads as travelling across the faces rather
       than a shutter dropping past them. One strip per cell row keeps the lean
       identical at both word sizes, because the offset is counted in buffer
       pixels and not in cells. */
    const s = word.scale;
    for (let r = 0; r < GLYPH_H; r++) {
      const p = sweep - (GLYPH_H - r) * s - m.x;
      strip(glow, m, r, s, p - 2 * s, p + 4 * s);
      strip(lit, m, r, s, p, p + 2 * s);
    }
  }

  prompt(frame);
  footer('PLAYER 1  W A S D  F G H      PLAYER 2  ARROWS  , . /');
  present(ctx, W, H);
}
