import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxDot, pxLine, pxTri, pxCircle, pxEllipse, pxTaper } from '../pixel/draw.js';
import { ditherDisc } from '../pixel/dither.js';
import { applyOutline } from '../pixel/outline.js';
import { OUTLINE } from '../render/palettes.js';

/* Stage props, built to sit next to the fighters without looking like a
   different game.

   The fighters get their read from three tones plus a hard silhouette
   keyline, so scenery is drawn the same way: every object is blocked in with
   a base, a lit face and a shadow face, and each depth layer is outlined as a
   whole before it is composited. Outlining per layer rather than per object
   is deliberate -- a row of shutters should merge into one building mass,
   while a lantern hanging in front of that building should not. */

/* Lamp and interior light. A jittered dither reads as scattered glitter over
   a dark interior, so light is built as nested translucent ellipses instead:
   the alpha accumulates toward the middle and the hard ellipse edges band the
   falloff, which is how pixel art has always drawn a glow. */
export function glow(c, cx, cy, r, rgb, steps = 5, perStep = 0.09) {
  for (let i = steps; i >= 1; i--) {
    const rr = (r * i) / steps;
    pxEllipse(c, cx, cy, Math.round(rr), Math.round(rr * 0.78), `rgba(${rgb}, ${perStep})`);
  }
}

/** Draw into a full-size layer, outline its silhouette, hand back the canvas. */
export function layer(draw, outline = OUTLINE) {
  const cv = document.createElement('canvas');
  cv.width = PW;
  cv.height = PH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  draw(c);
  applyOutline(c, PW, PH, outline);
  return cv;
}

/** A shaded block: lit along the top and left, shadowed right and bottom. */
export function block(c, x, y, w, h, base, hi, lo) {
  pxRect(c, x, y, w, h, base);
  pxRect(c, x, y, w, 2, hi);
  pxRect(c, x, y, 2, h, hi);
  pxRect(c, x + w - 2, y, 2, h, lo);
  pxRect(c, x, y + h - 2, w, 2, lo);
}

/* ---------------- architecture ---------------- */

/** Building front: storey bands, window openings, a ledge over each floor. */
export function facade(c, x, y, w, h, pal, opts = {}) {
  const { storey = 34, glow = '#f2c070', shutters = false } = opts;
  block(c, x, y, w, h, pal.wall, pal.wallHi, pal.wallLo);

  for (let fy = y + 6; fy < y + h - 14; fy += storey) {
    // ledge
    pxRect(c, x - 2, fy + storey - 12, w + 4, 4, pal.trim);
    pxRect(c, x - 2, fy + storey - 12, w + 4, 1, pal.trimHi);

    for (let wx = x + 6; wx < x + w - 12; wx += 20) {
      const ww = 12, wh = 15;
      pxRect(c, wx - 1, fy - 1, ww + 2, wh + 2, pal.wallLo);
      pxRect(c, wx, fy, ww, wh, shutters ? pal.trim : '#20182e');
      if (!shutters) {
        pxRect(c, wx + 1, fy + 1, ww - 2, wh - 2, glow);
        pxRect(c, wx + 1, fy + 1, ww - 2, 3, '#ffffff22');
        pxLine(c, wx + ww / 2, fy, wx + ww / 2, fy + wh, 1, pal.wallLo);
      } else {
        for (let s = 0; s < wh; s += 3) pxRect(c, wx, fy + s, ww, 2, pal.trimHi);
      }
      pxRect(c, wx - 2, fy + wh, ww + 4, 2, pal.trim);   // sill
    }
  }
}

/** Striped awning with a scalloped hem — reads instantly as a shopfront. */
export function awning(c, x, y, w, depth, a, b, hem) {
  for (let i = 0; i < depth; i++) {
    const inset = Math.round(i * 0.35);
    for (let sx = 0; sx < w - inset * 2; sx++) {
      const stripe = Math.floor((sx + inset) / 7) % 2 === 0 ? a : b;
      pxRect(c, x + inset + sx, y + i, 1, 1, stripe);
    }
  }
  // hem scallops
  const hy = y + depth;
  for (let sx = 0; sx < w - depth * 0.7; sx += 6) {
    const px = x + Math.round(depth * 0.35) + sx;
    pxRect(c, px, hy, 6, 2, hem);
    pxRect(c, px + 1, hy + 2, 4, 2, hem);
    pxRect(c, px + 2, hy + 4, 2, 1, hem);
  }
  pxRect(c, x, y, w, 2, '#ffffff33');
}

/** Paper lantern on a cord, with a warm bloom behind it. */
export function lantern(c, x, y, r, body, rib, cap, bloom = true) {
  pxLine(c, x, y - 12, x, y - r, 1, '#2b2118');
  if (bloom) glow(c, x, y, r * 3, '255, 154, 92', 4, 0.07);
  pxEllipse(c, x, y, r, Math.round(r * 1.15), body);
  pxEllipse(c, x - 1, y - 1, Math.round(r * 0.55), Math.round(r * 0.8), '#ffd06a');
  for (let i = -r; i <= r; i += 3) pxLine(c, x + i, y - r, x + i, y + r, 1, rib);
  pxRect(c, x - Math.round(r * 0.6), y - Math.round(r * 1.15) - 2, r + 2, 3, cap);
  pxRect(c, x - Math.round(r * 0.6), y + Math.round(r * 1.15) - 1, r + 2, 3, cap);
  pxRect(c, x - 1, y + Math.round(r * 1.15) + 2, 3, 5, '#c8392b');   // tassel
}

/** Hanging shop sign. Marks on it are abstract blocks, not real script. */
export function signBoard(c, x, y, w, h, face, frame, ink, glyphs = 3) {
  pxRect(c, x - 2, y - 2, w + 4, h + 4, frame);
  pxRect(c, x, y, w, h, face);
  pxRect(c, x, y, w, 1, '#ffffff33');
  const cell = Math.floor(w / glyphs);
  for (let g = 0; g < glyphs; g++) {
    glyphMark(c, x + 3 + g * cell, y + 3, cell - 6, h - 6, ink, g + w);
  }
}

/* Abstract signage marks. These are deliberately not real writing in any
   script -- they carry the density and rhythm of a painted sign without
   pretending to spell something. Six patterns, picked by seed, so a row of
   signs does not read as the same character repeated. */
export function glyphMark(c, x, y, w, h, ink, seed = 0) {
  if (w < 3 || h < 3) return;
  const t = Math.abs(Math.round(seed)) % 6;
  const mid = Math.floor(h / 2), cx = x + Math.floor(w / 2) - 1;

  if (t === 0) {
    pxRect(c, x, y, w, 2, ink); pxRect(c, x, y + mid, w, 2, ink);
    pxRect(c, x, y + h - 2, w, 2, ink); pxRect(c, cx, y, 2, h, ink);
  } else if (t === 1) {
    pxRect(c, x, y, w, 2, ink); pxRect(c, cx, y, 2, h, ink);
    pxRect(c, x, y + h - 2, w, 2, ink); pxRect(c, x, y + mid, Math.ceil(w / 2), 2, ink);
  } else if (t === 2) {
    pxRect(c, x, y, 2, h, ink); pxRect(c, x + w - 2, y, 2, h, ink);
    pxRect(c, x, y + mid - 1, w, 2, ink); pxRect(c, x, y, w, 2, ink);
  } else if (t === 3) {
    pxRect(c, x, y, w, 2, ink); pxRect(c, x, y, 2, mid); pxRect(c, x, y, 2, mid, ink);
    pxRect(c, x + w - 2, y, 2, mid, ink); pxRect(c, x, y + mid, w, 2, ink);
    pxRect(c, cx, y + mid, 2, h - mid, ink);
  } else if (t === 4) {
    pxRect(c, cx, y, 2, h, ink); pxRect(c, x, y + 2, w, 2, ink);
    pxRect(c, x, y + h - 4, w, 2, ink); pxRect(c, x, y + 2, 2, h - 6, ink);
    pxRect(c, x + w - 2, y + 2, 2, h - 6, ink);
  } else {
    pxRect(c, x, y, w, 2, ink); pxRect(c, x, y + h - 2, w, 2, ink);
    pxRect(c, cx, y, 2, h, ink); pxRect(c, x, y + mid, w, 2, ink);
    pxRect(c, x + w - 2, y + mid, 2, h - mid, ink);
  }
}

/** Tall banner hanging from a pole. */
export function banner(c, x, y, w, h, face, frame, ink) {
  pxRect(c, x - 3, y - 4, w + 6, 4, frame);
  pxRect(c, x, y, w, h, face);
  pxRect(c, x, y, 1, h, '#ffffff33');
  for (let g = 0; g < Math.floor(h / 14); g++) {
    glyphMark(c, x + 3, y + 4 + g * 14, w - 6, 11, ink, g * 3 + x);
  }
  for (let i = 0; i < w; i += 4) pxRect(c, x + i, y + h, 2, 3, frame);  // fringe
}

/* ---------------- clutter ---------------- */

export function crate(c, x, y, w, h, base, hi, lo) {
  block(c, x, y, w, h, base, hi, lo);
  pxRect(c, x + 2, y + Math.floor(h / 2) - 1, w - 4, 2, lo);
  pxLine(c, x + 2, y + 2, x + w - 3, y + h - 3, 1, lo);
  pxLine(c, x + w - 3, y + 2, x + 2, y + h - 3, 1, lo);
}

export function barrel(c, x, y, w, h, base, hi, lo, band) {
  pxRect(c, x, y, w, h, base);
  pxRect(c, x + 1, y, 3, h, hi);
  pxRect(c, x + w - 3, y, 3, h, lo);
  pxRect(c, x, y + 3, w, 2, band);
  pxRect(c, x, y + h - 6, w, 2, band);
  pxEllipse(c, x + w / 2, y + 1, Math.floor(w / 2), 2, hi);
}

export function basket(c, x, y, w, h, weave, weaveLo, goods, goodsHi) {
  pxRect(c, x, y + 3, w, h - 3, weave);
  for (let i = 0; i < h - 3; i += 3) pxRect(c, x, y + 3 + i, w, 1, weaveLo);
  pxEllipse(c, x + w / 2, y + 3, Math.floor(w / 2), 3, weaveLo);
  // heaped produce
  for (let i = 0; i < w; i += 4) {
    const bump = (i % 8 === 0) ? 3 : 2;
    pxCircle(c, x + 2 + i, y + 1, bump, goods);
    pxDot(c, x + 1 + i, y, goodsHi);
  }
}

export function sack(c, x, y, w, h, base, hi, lo, tie) {
  pxEllipse(c, x + w / 2, y + h - Math.floor(h / 3), Math.floor(w / 2), Math.floor(h / 2), base);
  pxEllipse(c, x + w / 2 - 1, y + h - Math.floor(h / 3) - 1, Math.floor(w / 3), Math.floor(h / 3), hi);
  pxRect(c, x + Math.floor(w / 2) - 2, y, 5, 6, lo);
  pxRect(c, x + Math.floor(w / 2) - 3, y + 4, 7, 2, tie);
}

/** A row of hanging goods — cured meat, cloth bolts, dried fish. */
export function hangingRow(c, x, y, count, gap, len, base, hi, hook) {
  for (let i = 0; i < count; i++) {
    const hx = x + i * gap;
    const l = len - (i % 3) * 3;
    pxRect(c, hx, y, 1, 4, hook);
    pxTaper(c, hx, y + 4, hx, y + 4 + l, 7, 5, base);
    pxTaper(c, hx - 1, y + 5, hx - 1, y + 3 + l, 3, 2, hi);
  }
}

/* ---------------- people ---------------- */

/* Bystanders use the same construction as the fighters -- three tones, hard
   keyline from the layer pass -- at about a third the height, so the crowd
   belongs to the same world without competing with the action. */
const POSES = {
  stand:  { arms: [[4, -8], [-4, -8]], lean: 0 },
  crossed:{ arms: [[3, -12], [-3, -12]], lean: 0 },
  lean:   { arms: [[5, -6], [-2, -10]], lean: 2 },
  point:  { arms: [[9, -14], [-3, -8]], lean: 1 },
  cheer:  { arms: [[6, -20], [-6, -20]], lean: 0 },
};

export function bystander(c, x, baseY, h, pal, pose = 'stand', facing = 1) {
  const p = POSES[pose] || POSES.stand;
  const headR = Math.max(3, Math.round(h * 0.13));
  const hip = baseY - Math.round(h * 0.45);
  const shoulder = baseY - Math.round(h * 0.74);
  const headY = baseY - Math.round(h * 0.86);
  const lean = p.lean * facing;

  // legs
  pxTaper(c, x - 2, hip, x - 3, baseY, 5, 4, pal.lo);
  pxTaper(c, x + 2, hip, x + 3, baseY, 5, 4, pal.base);
  pxRect(c, x - 5, baseY - 2, 5, 3, pal.shoe);
  pxRect(c, x + 1, baseY - 2, 5, 3, pal.shoe);

  // torso
  pxTaper(c, x, hip, x + lean, shoulder, 10, 12, pal.base);
  pxTaper(c, x - 2, hip, x - 2 + lean, shoulder, 4, 5, pal.hi);
  pxRect(c, x - 5, hip - 1, 10, 2, pal.belt);

  // arms: dy is negative for a raised hand, so it is simply an offset
  for (const [dx, dy] of p.arms) {
    const hx = x + lean + dx * facing;
    const hy = shoulder + 3 + dy;
    pxTaper(c, x + lean, shoulder + 2, hx, hy, 5, 3, pal.lo);
    pxCircle(c, hx, hy, 2, pal.skin);
  }

  // head
  pxCircle(c, x + lean, headY, headR, pal.skin);
  pxCircle(c, x + lean - facing, headY - 1, headR - 1, pal.skinHi);
  pxRect(c, x + lean - headR, headY - headR, headR * 2, Math.max(2, headR - 1), pal.hair);
  pxDot(c, x + lean + facing * 2, headY, '#241d33');
}

/* ---------------- ground ---------------- */

/** Paving that fans toward the viewer, with a worn edge along the back. */
export function paving(c, tones, seam, tileW = 26) {
  const [near, far, lip] = tones;
  const depth = PH - PGROUND;
  pxRect(c, 0, PGROUND, PW, depth, near);

  // rows get taller toward the viewer, which is what sells the perspective
  const rows = [];
  let y = PGROUND + 2;
  for (let j = 0; rows.length < 8 && y < PH; j++) {
    rows.push(y);
    y += 3 + j * 2;
  }

  /* Alternate tone per tile with the courses offset row to row. The vertical
     seams have to carry the read -- full-width horizontal lines on their own
     make the floor look like decking rather than laid stone, so the
     horizontals are drawn only as short segments between the verticals. */
  for (let r = 0; r < rows.length; r++) {
    const top = rows[r];
    const bot = r + 1 < rows.length ? rows[r + 1] : PH;
    const spread = 1 + r * 0.34;
    const step = tileW * spread;
    const offset = (r % 2) * step * 0.5;

    for (let i = -14; i <= 14; i++) {
      const x0 = PW / 2 + i * step + offset;
      if ((i + r) % 2 === 0) pxRect(c, x0, top, step, bot - top, far);
      pxLine(c, x0, top, x0, bot, 1, seam);
      // horizontal joint, inset from the vertical seams
      pxRect(c, x0 + 2, top, Math.max(1, step - 4), 1, seam);
    }
  }

  pxRect(c, 0, PGROUND, PW, 2, lip);
  pxRect(c, 0, PGROUND + 2, PW, 1, seam);
}

/** Sky visible through the gap between the two side buildings. */
export function alleyDepth(c, x, w, top, pal) {
  // receding walls converging toward the middle of the gap
  const cx = x + w / 2;
  for (let i = 0; i < 4; i++) {
    const inset = i * (w * 0.11);
    const y = top + i * 9;
    const hh = PGROUND - y;
    pxRect(c, x + inset, y, Math.max(2, w * 0.11), hh, i % 2 ? pal.far : pal.farLo);
    pxRect(c, cx + (w / 2 - inset - w * 0.11), y, Math.max(2, w * 0.11), hh, i % 2 ? pal.farLo : pal.far);
  }
  pxTri(c, x, top, x + w * 0.44, top, x + w * 0.44, top + 26, pal.farLo);
  pxTri(c, x + w, top, x + w * 0.56, top, x + w * 0.56, top + 26, pal.farLo);
}
