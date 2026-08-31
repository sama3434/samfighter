import { PW, PH, pctx, present } from '../pixel/buffer.js';
import { W, H } from '../config.js';
import { pxRect, pxDot } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { drawText, GLYPHS, GLYPH_W, GLYPH_H, GLYPH_GAP } from '../pixel/font.js';

/* The attract screen. Same backdrop, palette and font as the mode and select
   screens, so walking in from the title feels like moving through one menu
   rather than arriving at a different program.

   The backdrop is spelled out again here rather than shared: render/mode.js
   keeps its helpers private and belongs to the mode screen. Two short paint
   functions that happen to agree is a cheaper coupling than a third module
   owning both screens' background. The one thing left out is mode.js's ground
   band -- PGROUND + 20 is PH exactly, so it paints nothing. */

const GOLD = '#ffd23f', PLATE = '#0f0b1e', HINT = '#a89fc4', MUTED = '#8f87b0';

/* The 5x7 font tops out around scale 3 before the whole line stops fitting,
   which is body-text size for a headline. The logo is built out of the same
   glyph bitmaps at a much larger cell size, with the weight the small font
   gets for free from being small put back by hand: a keyline so the letters
   cut out of the sky, a slab shadow one whole cell down-right, and a ramp
   down the rows so a glyph is lit rather than flat. */
const RAMP = ['#fff6d5', '#ffe27a', '#ffd23f', '#ffb52a', '#f2871f', '#d8601c', '#b13f1a'];
const KEYLINE = '#160b1c';
const SLAB = '#5e1a18';
const SPARK = '#fffdf2';

/* Two words at two sizes: the short one reads as a byline over the long one,
   which is what stops SAM from being three lonely letters at FIGHTER's size.
   Every offset below is a whole cell, so nothing can land on a half pixel. */
const WORDS = [
  { text: 'SAM', y: 30, scale: 6 },
  { text: 'FIGHTER', y: 98, scale: 9 },
];

const SWEEP_PERIOD = 220;      // frames between shimmers -- roughly 3.7 seconds
const SWEEP_FRAMES = 60;       // how long the band takes to cross

function glyphMask(text) {
  const cw = text.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP;
  const grid = [];
  for (let r = 0; r < GLYPH_H; r++) grid.push(new Array(cw).fill(false));
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch] || GLYPHS[' '];
    const base = i * (GLYPH_W + GLYPH_GAP);
    for (let r = 0; r < GLYPH_H; r++) {
      for (let q = 0; q < GLYPH_W; q++) if (g[r][q] === '#') grid[r][base + q] = true;
    }
  });
  return { grid, cw };
}

/** Where a word's cells start, shifted half a cell left so the slab shadow
    counts toward the centring instead of dragging the block right. */
function wordX(cw, scale) {
  return Math.round(PW / 2 - (cw * scale) / 2 - scale / 2);
}

/** The whole logo's bounding box, keyline and shadow included. Exported so a
    test can assert it stays inside the buffer without reading pixels back. */
export function logoBox() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { text, y, scale } of WORDS) {
    const { cw } = glyphMask(text);
    const x = wordX(cw, scale);
    x0 = Math.min(x0, x - scale);                      // keyline column at -1
    x1 = Math.max(x1, x + (cw + 1) * scale + scale);   // shadow column, then keyline
    y0 = Math.min(y0, y - scale);
    y1 = Math.max(y1, y + (GLYPH_H + 1) * scale);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* `sweep` is a pixel position in buffer space rather than a cell index, which
   is what lets one band cross two words drawn at different scales without
   stepping. A negative sweep parks it off screen. */
function bigWord({ text, y, scale }, sweep) {
  const { grid, cw } = glyphMask(text);
  const x = wordX(cw, scale);
  const at = (r, c) => r >= 0 && r < GLYPH_H && c >= 0 && c < cw && grid[r][c];
  const cell = (c, r, col) => pxRect(pctx, x + c * scale, y + r * scale, scale, scale, col);

  for (let r = 0; r < GLYPH_H; r++) {
    for (let c = 0; c < cw; c++) if (grid[r][c]) cell(c + 1, r + 1, SLAB);
  }

  for (let r = -1; r <= GLYPH_H; r++) {
    for (let c = -1; c <= cw; c++) {
      if (at(r, c)) continue;
      let touching = false;
      for (let dr = -1; dr <= 1 && !touching; dr++) {
        for (let dc = -1; dc <= 1; dc++) if (at(r + dr, c + dc)) { touching = true; break; }
      }
      if (touching) cell(c, r, KEYLINE);
    }
  }

  for (let r = 0; r < GLYPH_H; r++) {
    for (let c = 0; c < cw; c++) {
      if (!grid[r][c]) continue;
      let col = RAMP[r];
      if (sweep >= 0) {
        // the band leans, so it reads as light travelling over the face
        const d = x + c * scale + (GLYPH_H - r) * scale - sweep;
        if (d >= 0 && d < scale * 2) col = SPARK;
        else if (d >= -scale * 2 && d < scale * 4) col = RAMP[Math.max(0, r - 2)];
      }
      cell(c, r, col);
    }
  }
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

/* A cabinet's PRESS START is off for a good part of its cycle -- a prompt
   that only changes colour reads as decoration, one that vanishes reads as an
   instruction the machine is waiting on. */
function prompt(frame) {
  const phase = frame % 64;
  drawText(pctx, 'TO PICK HOW YOU WILL FIGHT', PW / 2, 224, MUTED, 1, 'center', PLATE);
  // no plate behind this one: the logo is already a slab, and a second box
  // under it stacks into a column of rectangles
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
  ditherDisc(pctx, PW / 2, 110, 168, '#5b3a8c', 0.55);

  const t = frame % SWEEP_PERIOD;
  const sweep = t < SWEEP_FRAMES ? Math.round(-120 + (t / SWEEP_FRAMES) * (PW + 260)) : -1;
  for (const word of WORDS) bigWord(word, sweep);

  prompt(frame);
  footer('PLAYER 1  W A S D  F G H      PLAYER 2  ARROWS  , . /');
  present(ctx, W, H);
}
