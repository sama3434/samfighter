import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxDot, pxLine, pxTri, pxCircle, pxEllipse, pxTaper, hexToRgb } from '../pixel/draw.js';
import { ditherDisc } from '../pixel/dither.js';
import { applyOutline } from '../pixel/outline.js';
import { OUTLINE } from '../render/palettes.js';
import { rng } from './scenery.js';

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

/** Multiply a hex colour toward black. */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const k = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((1 << 24) | (k(r) << 16) | (k(g) << 8) | k(b)).toString(16).slice(1)}`;
}

/** Blend two hex colours. t = 0 is all of a, t = 1 is all of b. */
export function mixCol(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const k = (i) => Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
  return `#${((1 << 24) | (k(0) << 16) | (k(1) << 8) | k(2)).toString(16).slice(1)}`;
}

/* Bystanders are built the way the fighters are -- three tones plus the hard
   keyline the layer pass adds -- at 28 to 50 pixels tall.

   At that size anatomy is not what carries the read: the eye picks up the
   silhouette and the two or three largest colour areas, and nothing else. So
   the variety lives in headgear, hemlines, posture and what someone is
   carrying rather than in face detail, and a stage supplies a *wardrobe*
   -- the cloth, skin and hair the crowd is drawn from -- instead of three
   near-identical palettes. Every figure is deliberately flatter and lower in
   contrast than a fighter, and `crowd()` washes the whole layer with the
   stage's air colour so the crowd sits behind the action rather than beside
   it. */

const SKINS = [
  ['#e8b487', '#ffd6ab'], ['#d69c6c', '#f2bf90'], ['#b57c4e', '#d6a074'],
  ['#8c5a36', '#ad7952'], ['#5e3c26', '#7d5338'],
];
const HAIRS = ['#241d1a', '#3b2a1e', '#1f1a2b', '#5a4028', '#8a8279', '#2b1d16'];
const HEADS = ['bare', 'bare', 'short', 'short', 'long', 'tail', 'bun',
               'cap', 'brim', 'cone', 'wrap', 'hood', 'bald'];
const GARBS = ['tunic', 'tunic', 'tunic', 'robe', 'coat', 'vest', 'apron'];
const LOADS = [null, null, null, null, null, null, 'sack', 'basket', 'jug', 'staff'];
const POSE_NAMES = ['stand', 'crossed', 'hips', 'lean', 'point', 'cheer', 'wave',
                    'clap', 'talk', 'carry', 'shoulder', 'sit', 'kneel', 'behind'];

/* Arm and leg entries are [elbowDX, elbowDY, handDX, handDY] as fractions of
   the figure's height, measured from the shoulder (arms) or the hip (legs).
   DX runs in the direction the figure faces, DY runs down the screen, so a
   raised hand is simply a negative offset. `hip` moves the whole pelvis down
   for the seated and kneeling poses; everything above it follows. */
const POSES = {
  stand:    { lean: 0,  legs: 'even',   arms: [[0.09, 0.14, 0.11, 0.30], [-0.09, 0.14, -0.12, 0.30]] },
  crossed:  { lean: 0,  legs: 'apart',  arms: [[0.14, 0.11, -0.01, 0.18], [-0.13, 0.11, 0.03, 0.21]] },
  hips:     { lean: 0,  legs: 'apart',  arms: [[0.17, 0.13, 0.08, 0.27], [-0.17, 0.13, -0.08, 0.27]] },
  lean:     { lean: 3,  legs: 'cross',  arms: [[0.13, 0.16, 0.22, 0.28], [-0.10, 0.15, -0.12, 0.30]] },
  point:    { lean: 1,  legs: 'stride', arms: [[0.17, 0.03, 0.35, -0.05], [-0.10, 0.15, -0.12, 0.30]] },
  cheer:    { lean: 0,  legs: 'apart',  arms: [[0.11, -0.01, 0.15, -0.22], [-0.11, -0.01, -0.15, -0.22]] },
  wave:     { lean: 0,  legs: 'even',   arms: [[0.13, 0.02, 0.17, -0.19], [-0.10, 0.15, -0.12, 0.30]] },
  clap:     { lean: 1,  legs: 'even',   arms: [[0.16, 0.09, 0.05, 0.12], [-0.14, 0.09, 0.03, 0.14]] },
  talk:     { lean: 1,  legs: 'stride', arms: [[0.15, 0.12, 0.21, 0.03], [-0.11, 0.16, -0.10, 0.27]] },
  carry:    { lean: -1, legs: 'stride', arms: [[0.14, 0.12, 0.16, 0.23], [-0.11, 0.13, 0.10, 0.24]] },
  shoulder: { lean: -2, legs: 'stride', arms: [[0.11, 0.01, 0.05, -0.11], [-0.11, 0.15, -0.13, 0.28]] },
  sit:      { lean: 2,  legs: 'sit',   hip: 0.30, arms: [[0.12, 0.12, 0.18, 0.22], [-0.11, 0.13, -0.13, 0.24]] },
  kneel:    { lean: 3,  legs: 'kneel', hip: 0.27, arms: [[0.11, 0.13, 0.18, 0.23], [-0.08, 0.14, -0.07, 0.25]] },
  behind:   { lean: -1, legs: 'even',   arms: [[-0.06, 0.16, -0.10, 0.26], [-0.08, 0.16, -0.12, 0.27]] },
};

const LEGS = {
  even:   [[0.03, 0.26, 0.05, 0.47], [-0.03, 0.26, -0.07, 0.47]],
  apart:  [[0.05, 0.26, 0.10, 0.47], [-0.05, 0.26, -0.10, 0.47]],
  stride: [[0.07, 0.24, 0.13, 0.47], [-0.05, 0.26, -0.12, 0.47]],
  cross:  [[0.03, 0.26, 0.10, 0.47], [-0.01, 0.27, 0.04, 0.47]],
  sit:    [[0.17, 0.02, 0.18, 0.30], [0.12, 0.03, 0.11, 0.30]],
  kneel:  [[0.15, 0.04, 0.16, 0.27], [-0.03, 0.26, -0.16, 0.24]],
};

export const CROWD_POSES = POSE_NAMES;
export const CROWD_HEADS = HEADS;
export const CROWD_GARBS = GARBS;

/* One figure. `opts` is either a pose name or
   { pose, head, garb, load, loadCol } -- anything left out falls back to a
   plain standing figure in a tunic, which is what the old three-argument
   call sites used to get. */
export function bystander(c, x, baseY, h, pal, opts = 'stand', facing = 1) {
  const o = typeof opts === 'string' ? { pose: opts } : (opts || {});
  const p = POSES[o.pose] || POSES.stand;
  const legs = LEGS[p.legs] || LEGS.even;
  const f = facing < 0 ? -1 : 1;
  const P = (v) => Math.round(v * h);
  const R = Math.round;

  const alt = pal.alt || shade(pal.base, 0.58);
  const altLo = pal.altLo || shade(alt, 0.72);
  const trim = pal.trim || mixCol(pal.base, '#ffffff', 0.38);
  const hatCol = pal.hat || trim;
  const hatLo = pal.hatLo || shade(hatCol, 0.66);

  const hipY = baseY - P(p.hip ?? 0.47);
  const shY = hipY - P(0.28);
  const r = Math.max(2, Math.round(h * 0.10));
  const chinY = shY - Math.max(1, P(0.025));
  const headY = chinY - r;
  const lean = (p.lean || 0) * f;
  const shX = R(x + lean);

  const shW = Math.max(6, P(0.27));
  const hipW = Math.max(4, P(0.175));
  const legW = Math.max(2, P(0.105));
  const armW = Math.max(2, P(0.08));
  const garb = o.garb || 'tunic';

  /* two-segment limbs: a single straight taper from shoulder to hand is
     exactly what makes a small figure read as a stick assembly */
  const arm = (a, col, side, key) => {
    const ox = R(shX + side * f * shW * 0.32);
    const ex = R(shX + a[0] * h * f), ey = R(shY + a[1] * h);
    const hx = R(shX + a[2] * h * f), hy = R(shY + a[3] * h);
    if (key) {   // the near arm hangs against the torso, so it needs an edge
      pxTaper(c, ox, shY + 1, ex, ey, armW + 2, armW + 1, key);
      pxTaper(c, ex, ey, hx, hy, armW + 1, armW, key);
      pxCircle(c, hx, hy, Math.max(2, R(armW * 0.5) + 1), key);
    }
    pxTaper(c, ox, shY + 1, ex, ey, armW, Math.max(2, armW - 1), col);
    pxTaper(c, ex, ey, hx, hy, Math.max(2, armW - 1), Math.max(1, armW - 1), col);
    pxCircle(c, hx, hy, Math.max(1, R(armW * 0.5)), pal.skin);
    return [hx, hy];
  };
  const leg = (l, col) => {
    const kx = R(x + l[0] * h * f), ky = R(hipY + l[1] * h);
    const fx = R(x + l[2] * h * f), fy = R(hipY + l[3] * h);
    pxTaper(c, R(x), hipY, kx, ky, legW + 1, legW, col);
    pxTaper(c, kx, ky, fx, fy, legW, Math.max(2, legW - 1), col);
    pxRect(c, fx - (f > 0 ? Math.ceil(legW / 2) : legW), fy - 2, legW + 2, 3, pal.shoe);
  };

  arm(p.arms[1], pal.lo, -1);              // far arm, behind the body
  leg(legs[1], altLo);
  leg(legs[0], alt);

  // torso, lit from the left so a row of figures shares one light
  pxTaper(c, shX, shY, R(x), hipY, shW, hipW, garb === 'vest' ? pal.hi : pal.base);
  pxTaper(c, shX - R(shW * 0.30), shY + 1, R(x) - R(hipW * 0.30), hipY,
          Math.max(2, R(shW * 0.24)), Math.max(2, R(hipW * 0.24)),
          garb === 'vest' ? mixCol(pal.hi, '#ffffff', 0.2) : pal.hi);
  pxTaper(c, shX + R(shW * 0.36), shY + 2, R(x) + R(hipW * 0.36), hipY,
          Math.max(1, R(shW * 0.16)), Math.max(1, R(hipW * 0.16)), pal.lo);

  if (garb === 'robe' || garb === 'coat') {
    const hemY = garb === 'robe' ? baseY - 2 : hipY + P(0.14);
    const hemW = garb === 'robe' ? R(hipW * 1.8) : R(hipW * 1.55);
    for (let yy = hipY; yy <= hemY; yy++) {
      const t = (yy - hipY) / Math.max(1, hemY - hipY);
      const w = R(hipW + (hemW - hipW) * t);
      pxRect(c, R(x) - (w >> 1), yy, w, 1, pal.base);
      pxRect(c, R(x) - (w >> 1), yy, Math.max(1, R(w * 0.3)), 1, pal.hi);
      pxRect(c, R(x) + (w >> 1) - Math.max(1, R(w * 0.24)), yy, Math.max(1, R(w * 0.24)), 1, pal.lo);
    }
    pxRect(c, R(x) - (hemW >> 1), hemY, hemW, 1, pal.lo);
    if (garb === 'coat') {                                   // front opening
      pxRect(c, R(x) - 1, shY + 2, 2, hemY - shY - 2, pal.lo);
      pxRect(c, shX - R(shW * 0.36), shY, R(shW * 0.34), 3, trim);
      pxRect(c, shX + R(shW * 0.06), shY, R(shW * 0.34), 3, trim);
    }
  } else if (garb === 'vest') {
    pxTaper(c, shX, shY + 1, R(x), hipY, R(shW * 0.64), R(hipW * 0.7), pal.base);
    pxRect(c, R(x) - 1, shY + 2, 2, hipY - shY - 2, pal.lo);
  } else if (garb === 'apron') {
    const ay = shY + R((hipY - shY) * 0.42);
    pxRect(c, R(x) - R(hipW * 0.46), ay, Math.max(3, R(hipW * 0.92)), hipY - ay + 3, trim);
    pxRect(c, R(x) - R(hipW * 0.46), ay, Math.max(1, R(hipW * 0.28)), hipY - ay + 3, mixCol(trim, '#ffffff', 0.3));
  }

  if (garb !== 'robe' && garb !== 'coat') {
    pxRect(c, R(x) - R(hipW * 0.62), hipY - 1, Math.max(3, R(hipW * 1.24)), 2, pal.belt);
  } else {
    pxRect(c, R(x) - R(hipW * 0.7), hipY - 1, Math.max(3, R(hipW * 1.4)), 2, trim);
  }
  pxRect(c, shX - R(shW * 0.28), shY, Math.max(2, R(shW * 0.56)), 1, trim);   // collar

  arm(p.arms[0], mixCol(pal.base, pal.hi, 0.45), 1, pal.lo);                 // near arm

  // neck and head
  pxRect(c, shX + f - 1, chinY - 1, Math.max(2, R(r * 0.9)), shY - chinY + 2, shade(pal.skin, 0.74));
  const hx = shX;
  pxCircle(c, hx, headY, r, pal.skin);
  pxCircle(c, hx - 1, headY - 1, Math.max(1, r - 1), pal.skinHi);

  // ---- headgear: this is what actually separates one figure from the next
  const head = o.head || 'bare';
  const capRows = r <= 3 ? 2 : r - 1;
  let crownY = headY - r;                      // top of whatever is on their head
  const cap = (col, rows, grow = 0) => {
    const rr = r + grow;
    for (let dy = -rr; dy < -r + rows; dy++) {
      const span = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)) + 0.5);
      if (span > 0) pxRect(c, hx - span, headY + dy, span * 2 + 1, 1, col);
    }
  };

  if (head === 'bald') {
    pxRect(c, hx - r + 1, headY - r, Math.max(2, r), 1, shade(pal.skin, 0.86));
  } else if (head === 'cap' || head === 'brim' || head === 'cone' ||
             head === 'wrap' || head === 'hood' || head === 'helm') {
    cap(pal.hair, Math.max(1, capRows - 1));
  } else {
    cap(pal.hair, capRows);
    for (let dy = -r + capRows; dy <= 0; dy++) {         // temples
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) + 0.5);
      pxDot(c, hx - span, headY + dy, pal.hair);
      pxDot(c, hx + span, headY + dy, pal.hair);
    }
  }

  if (head === 'long') {
    pxRect(c, hx - r - 1, headY - 1, 2, r + 3, pal.hair);
    pxRect(c, hx + r, headY - 1, 2, r + 3, pal.hair);
  } else if (head === 'tail') {
    pxTaper(c, hx - f * (r - 1), headY - 1, hx - f * (r + 2), headY + r + 2,
            Math.max(2, r - 1), 2, pal.hair);
  } else if (head === 'bun') {
    crownY = headY - r - 2;
    pxCircle(c, hx - f, headY - r - 1, Math.max(1, r - 2), pal.hair);
  } else if (head === 'short') {
    pxRect(c, hx - f * (r - 1) - (f > 0 ? 0 : 1), headY - r + capRows, 2, 2, pal.hair);
  } else if (head === 'cap') {
    cap(hatCol, capRows, 1);
    crownY = headY - r - 1;
    pxRect(c, f > 0 ? hx + r - 1 : hx - r - r, headY - r + capRows - 1, r + 1, 1, hatLo);
  } else if (head === 'brim') {
    const ch = Math.max(2, r - 1);
    crownY = headY - r - ch;
    pxRect(c, hx - r + 1, headY - r - ch, 2 * r - 1, ch + 1, hatCol);
    pxRect(c, hx - r + 1, headY - r - 1, 2 * r - 1, 1, hatLo);
    pxEllipse(c, hx, headY - r + 1, r + 3, 1, hatCol);
    pxRect(c, hx - r - 3, headY - r + 2, 2 * r + 7, 1, hatLo);
  } else if (head === 'cone') {
    crownY = headY - r * 2 - 1;
    pxTri(c, hx - r - 3, headY - r + 2, hx + r + 3, headY - r + 2, hx, headY - r * 2 - 1, hatCol);
    pxTri(c, hx, headY - r + 2, hx + r + 3, headY - r + 2, hx, headY - r * 2 - 1, hatLo);
    pxRect(c, hx - r - 3, headY - r + 2, 2 * r + 7, 1, hatLo);
  } else if (head === 'wrap') {
    crownY = headY - r - 1;
    cap(hatCol, capRows + 1, 1);
    pxRect(c, hx - r, headY - r + capRows, 2 * r + 1, 1, hatLo);
    pxRect(c, hx - f * (r + 1), headY - r + capRows, 2, Math.max(2, r), hatCol);
  } else if (head === 'helm') {
    crownY = headY - r - 1;
    cap(hatCol, capRows + 1, 1);
    pxRect(c, hx - r - 1, headY - r + capRows, 2 * r + 3, 1, hatLo);
    pxRect(c, hx + f - 1, headY - r + capRows, 1, Math.max(2, r), hatLo);   // nasal bar
  } else if (head === 'hood') {
    crownY = headY - r - 2;
    pxEllipse(c, hx, headY, r + 2, r + 2, hatCol);
    pxRect(c, hx - r - 2, headY + 1, 2 * r + 5, Math.max(2, r), hatCol);
    pxRect(c, hx - r - 2, headY + r + 1, 2 * r + 5, 2, hatLo);
    pxEllipse(c, hx + f, headY + 1, Math.max(2, r - 1), Math.max(2, r - 1), pal.skin);
  }

  // features, last, so a hood or a hat brim never buries them
  const soft = shade(pal.skin, 0.74), ink = shade(pal.skin, 0.5);
  if (r >= 3) {
    if (r >= 4) pxRect(c, hx - r + 2, headY - 1, 2 * r - 3, 1, soft);   // brow ridge
    pxDot(c, hx + f * 2, headY, ink);
    pxDot(c, hx - f, headY, ink);
    pxDot(c, hx + f * (r - 1), headY + 1, soft);                   // nose
    pxRect(c, hx + (f > 0 ? 0 : -1), headY + 2, 2, 1, soft);       // mouth
  } else {
    pxDot(c, hx + f, headY, ink);
  }

  // ---- what they are carrying
  const loadCol = o.loadCol || '#a8916a';
  if (o.load === 'sack') {
    const bx = R(shX - f * P(0.16)), by = shY + P(0.02);
    const rx = Math.max(3, P(0.11)), ry = Math.max(3, P(0.10));
    pxEllipse(c, bx, by, rx, ry, loadCol);
    pxEllipse(c, bx - 1, by - 1, Math.max(2, P(0.06)), Math.max(2, P(0.05)), mixCol(loadCol, '#ffffff', 0.22));
    pxRect(c, bx - 1, by - ry - 1, 3, 3, shade(loadCol, 0.6));
  } else if (o.load === 'basket') {
    const bw = Math.max(5, P(0.24)), bh = Math.max(3, P(0.10));
    pxRect(c, hx - (bw >> 1), crownY - bh, bw, bh, loadCol);
    pxRect(c, hx - (bw >> 1) - 1, crownY - bh, bw + 2, 2, shade(loadCol, 0.72));
    pxRect(c, hx - (bw >> 1) + 1, crownY - bh - 2, bw - 2, 2, mixCol(loadCol, '#c8462e', 0.55));
  } else if (o.load === 'jug') {
    const jx = R(shX + f * P(0.17)), jy = shY + P(0.24);
    pxEllipse(c, jx, jy, Math.max(2, P(0.07)), Math.max(3, P(0.09)), loadCol);
    pxRect(c, jx - 1, jy - Math.max(3, P(0.09)) - 2, 3, 3, shade(loadCol, 0.7));
  } else if (o.load === 'staff') {
    pxRect(c, R(shX + f * P(0.16)), R(shY - h * 0.20), 2, R(h * 0.64), '#6b4f34');
    pxRect(c, R(shX + f * P(0.16)) - 1, R(shY - h * 0.20), 4, 2, '#8c6a48');
  }
}

/* A crowd, laid out as one depth layer.

   `people` is a list of placements; anything a placement leaves out is rolled
   deterministically from the wardrobe, so a stage says "six people, these
   clothes, this air" and gets a crowd rather than the same figure repeated.
   Sorted back to front before drawing so overlaps stack correctly, and washed
   with the stage's air colour afterwards -- that single flat pass is what
   keeps the crowd behind the fighters instead of level with them. */
export function crowd(people, wardrobe = {}, opts = {}) {
  const rand = rng(opts.seed ?? 1234);
  const wd = wardrobe;
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];

  const built = people.map((raw) => {
    const p = Array.isArray(raw)
      ? { x: raw[0], y: raw[1], h: raw[2], pose: raw[3], face: raw[4] }
      : { ...raw };
    const cloth = p.cloth || pick(wd.cloth || ['#7a6a58']);
    const alt = pick(wd.alt || wd.cloth || ['#4c4034']);
    const [skin, skinHi] = pick(wd.skin || SKINS);
    const hatCol = pick(wd.hats || wd.trim || wd.cloth || ['#8a7a5c']);
    p.pal = p.pal || {
      base: cloth,
      hi: mixCol(cloth, wd.light || '#ffe6c0', 0.26),
      lo: shade(cloth, 0.58),
      alt, altLo: shade(alt, 0.72),
      trim: pick(wd.trim || [mixCol(cloth, '#ffffff', 0.4)]),
      belt: shade(alt, 0.5),
      shoe: wd.shoe || '#2b2118',
      skin, skinHi,
      hair: pick(wd.hair || HAIRS),
      hat: hatCol, hatLo: shade(hatCol, 0.66),
    };
    p.pose = p.pose || pick(wd.poses || POSE_NAMES);
    p.head = p.head || pick(wd.heads || HEADS);
    p.garb = p.garb || pick(wd.garbs || GARBS);
    p.load = p.load === undefined ? pick(wd.loads || LOADS) : p.load;
    p.face = p.face ?? (rand() > 0.5 ? 1 : -1);
    return p;
  });
  built.sort((a, b) => (a.y - b.y) || (a.h - b.h));

  const cv = layer((c) => {
    for (const p of built) bystander(c, p.x, p.y, p.h, p.pal, p, p.face);
  }, opts.outline);

  if (opts.haze) {
    const c = cv.getContext('2d');
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = opts.haze;
    c.fillRect(0, 0, PW, PH);
    c.globalCompositeOperation = 'source-over';
  }
  return cv;
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
