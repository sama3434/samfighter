import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse, pxTaper } from '../pixel/draw.js';
import { ditherGradient } from '../pixel/dither.js';
import { layer, glow, block, crate, barrel, crowd } from './props.js';
import { rng } from './scenery.js';

/* The weather deck of a ship at sea, under a squall.

   None of the other four are framed the way a deck is. The street closes in
   from both sides, the dig site is wide open, the rooftop drops away and the
   bridge hangs between two unequal ends -- this one is framed by its own
   rigging: a mast standing straight through the left of the frame, a lattice
   of shrouds climbing off it, a yard and a headsail closing the top, and a
   solid rail across the whole width with nothing but water past it. The eye
   is boxed in overhead and by the rail, and completely open in the middle
   distance, which is the opposite arrangement to a market street.

   Everything the fighters stand in front of is either dark planking or dark
   water. The one warm thing on the stage is the stern lantern, and it is up
   in the corner where it pulls the eye off the fight rather than into it. */

const HORIZON = 130;      // eye level: the sea meets the sky just under the HUD
const RAIL = 178;         // top of the bulwark running the width of the ship
const QDECK = 203;        // the raised quarterdeck aft, on the right
const MAST_X = 132;

const SKY = ['#232a33', '#333e47', '#4a5a5c', '#71827c', '#a5b09b', '#d2cfb2'];
const W = {                                        // weathered oak
  base: '#5a4130', hi: '#7d5c42', lo: '#3a2819', deep: '#251a11', wet: '#4a3526',
};
const SAIL = { lit: '#b6b09a', base: '#948e7c', lo: '#6f6a5b', deep: '#4e4a3f' };
const SEA = { far: '#5f7a78', mid: '#33555c', near: '#1e3a42', deep: '#152a32', foam: '#a9c6c0' };
const ROPE = '#8a7450';
const IRON = '#454b52';

/* Pirates: sun-bleached linen, dyed wool gone dull, and nearly every head
   covered against the weather. */
const CROWD = {
  cloth: ['#8a4438', '#3f5a6b', '#6b5a3a', '#4a4458', '#5f6b4a', '#8c6a3a',
          '#7a3a4a', '#455a52', '#a8763a', '#5c4a3a'],
  alt:   ['#4a4034', '#3a4450', '#54483a', '#3e4a44'],
  trim:  ['#e8d8b0', '#c8443a', '#e8c060', '#8fb0ae'],
  hats:  ['#2b2620', '#8a4438', '#e8d8b0', '#3f5a6b', '#6b5a3a'],
  light: '#e6e2c6',
  shoe:  '#2b2118',
  heads: ['wrap', 'wrap', 'cap', 'brim', 'brim', 'bare', 'short', 'long',
          'tail', 'bald', 'hood'],
  garbs: ['tunic', 'tunic', 'vest', 'coat', 'apron'],
  loads: [null, null, null, null, null, 'sack', 'jug', 'staff'],
};

/* ---------------- pieces of a ship ---------------- */

/** A spar: round in section, so it is lit down one side and dark down the other. */
function spar(c, x0, y0, x1, y1, w0, w1) {
  pxTaper(c, x0, y0, x1, y1, w0, w1, W.base);
  pxTaper(c, x0 - w0 * 0.28, y0, x1 - w1 * 0.28, y1, w0 * 0.3, w1 * 0.3, W.hi);
  pxTaper(c, x0 + w0 * 0.34, y0, x1 + w1 * 0.34, y1, w0 * 0.26, w1 * 0.26, W.lo);
}

/** Shrouds climbing off the rail, with ratlines rungs across them. */
function shrouds(c, xLo, xHi, yLo, xTopLo, xTopHi, yTop, n) {
  const lo = [], hi = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    lo.push(xLo + (xHi - xLo) * t);
    hi.push(xTopLo + (xTopHi - xTopLo) * t);
  }
  for (let i = 0; i < n; i++) pxLine(c, lo[i], yLo, hi[i], yTop, 1, ROPE);
  for (let y = yTop + 6; y < yLo; y += 9) {
    const t = (y - yTop) / (yLo - yTop);
    const a = hi[0] + (lo[0] - hi[0]) * t;
    const b = hi[n - 1] + (lo[n - 1] - hi[n - 1]) * t;
    pxLine(c, a, y, b, y + 1, 1, ROPE);
  }
  // deadeyes where the shrouds are set up to the rail
  for (let i = 0; i < n; i++) {
    pxCircle(c, lo[i], yLo - 3, 2, W.lo);
    pxDot(c, lo[i], yLo - 3, W.deep);
  }
}

/** Canvas rolled up along its yard and tied off in bunts. */
function furledSail(c, x0, x1, y, depth) {
  for (let x = x0; x < x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const d = Math.round(depth * (0.55 + 0.45 * Math.sin(t * Math.PI)));
    pxRect(c, x, y, 1, d, SAIL.base);
    pxRect(c, x, y, 1, Math.max(1, Math.round(d * 0.35)), SAIL.lit);
    pxRect(c, x, y + d - Math.max(1, Math.round(d * 0.3)), 1, Math.max(1, Math.round(d * 0.3)), SAIL.lo);
  }
  for (let x = x0 + 8; x < x1; x += 17) {          // gaskets
    pxRect(c, x, y - 1, 2, depth + 2, SAIL.deep);
  }
}

/** The ship's wheel, seen square on. */
function wheel(c, cx, cy, r) {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sx = Math.cos(a), sy = Math.sin(a);
    pxLine(c, cx + sx * 3, cy + sy * 3, cx + sx * (r + 4), cy + sy * (r + 4), 2, W.base);
    pxDot(c, cx + sx * (r + 5), cy + sy * (r + 5), W.hi);
  }
  for (let a = 0; a < 360; a += 3) {                // rim
    const rad = (a * Math.PI) / 180;
    pxDot(c, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, W.hi);
    pxDot(c, cx + Math.cos(rad) * (r - 1), cy + Math.sin(rad) * (r - 1), W.base);
    pxDot(c, cx + Math.cos(rad) * (r - 2), cy + Math.sin(rad) * (r - 2), W.lo);
  }
  pxCircle(c, cx, cy, 4, IRON);
  pxCircle(c, cx - 1, cy - 1, 2, '#6d757d');
}

/** Deck gun on its truck carriage, lashed down. */
function cannon(c, x, baseY) {
  pxRect(c, x + 6, baseY - 24, 44, 9, IRON);        // barrel
  pxRect(c, x + 6, baseY - 24, 44, 3, '#5f676f');
  pxRect(c, x + 4, baseY - 25, 5, 11, '#5f676f');   // muzzle swell
  pxRect(c, x + 48, baseY - 26, 8, 13, IRON);       // breech
  pxCircle(c, x + 57, baseY - 20, 3, IRON);         // cascabel
  pxTri(c, x + 10, baseY - 15, x + 56, baseY - 15, x + 52, baseY - 4, W.base);
  pxRect(c, x + 10, baseY - 15, 46, 3, W.hi);
  pxCircle(c, x + 17, baseY - 4, 4, W.lo);          // trucks
  pxCircle(c, x + 17, baseY - 4, 2, W.deep);
  pxCircle(c, x + 45, baseY - 4, 4, W.lo);
  pxCircle(c, x + 45, baseY - 4, 2, W.deep);
  pxLine(c, x + 2, baseY - 20, x + 56, baseY - 12, 1, ROPE);   // breeching rope
}

/** A coil of rope flaked down on the deck. */
function ropeCoil(c, cx, cy, r) {
  for (let i = 0; i < 3; i++) {
    pxEllipse(c, cx, cy - i, r - i * 2, Math.max(1, Math.round((r - i * 2) * 0.42)), i % 2 ? '#6f5c3e' : ROPE);
  }
  pxEllipse(c, cx, cy - 2, Math.max(1, r - 6), Math.max(1, Math.round((r - 6) * 0.4)), W.lo);
}

/** Hatch grating, let into the deck. */
function grating(c, x, y, w, h) {
  pxRect(c, x - 2, y - 2, w + 4, h + 4, W.base);
  pxRect(c, x - 2, y - 2, w + 4, 2, W.hi);
  pxRect(c, x, y, w, h, W.deep);
  for (let i = 2; i < w; i += 5) pxRect(c, x + i, y, 2, h, W.lo);
  for (let j = 2; j < h; j += 4) pxRect(c, x, y + j, w, 1, W.lo);
}

/** Deck planking: courses running fore and aft, tightening toward the rail. */
function planking(c) {
  pxRect(c, 0, PGROUND, PW, PH - PGROUND, W.base);
  const rand = rng(6161);
  let y = PGROUND, step = 3;
  const rows = [];
  while (y < PH) { rows.push(y); y += step; step += 1.6; }
  for (let r = 0; r < rows.length; r++) {
    const top = Math.round(rows[r]);
    const bot = r + 1 < rows.length ? Math.round(rows[r + 1]) : PH;
    // every plank is a slightly different weathered tone
    for (let bx = -20; bx < PW + 20; bx += 46 + r * 12) {
      const ox = ((r % 2) * 23) + bx;
      const tone = rand() > 0.62 ? W.wet : rand() > 0.4 ? W.base : W.hi;
      pxRect(c, ox, top, 44 + r * 12, bot - top - 1, tone);
      pxRect(c, ox, top, 2, bot - top - 1, W.lo);      // butt joint
    }
    pxRect(c, 0, bot - 1, PW, 1, W.deep);              // caulked seam
  }
  pxRect(c, 0, PGROUND, PW, 2, W.lo);
  pxRect(c, 0, PGROUND + 2, PW, 1, W.deep);
  for (let i = 0; i < 120; i++) {                      // nail heads and grit
    const x = Math.floor(rand() * PW);
    const yy = PGROUND + 3 + Math.floor(rand() * (PH - PGROUND - 4));
    pxDot(c, x, yy, rand() > 0.5 ? '#6d5540' : '#2c1f15');
  }
}

/** A brig hull down on the horizon, sails up. */
function distantShip(c, x, y, s, col) {
  pxRect(c, x - 13 * s, y - 2 * s, 26 * s, 3 * s, col);
  pxTri(c, x - 13 * s, y - 2 * s, x + 13 * s, y - 2 * s, x + 15 * s, y + s, col);
  for (const [mx, mh] of [[-6, 20], [4, 24]]) {
    pxRect(c, x + mx * s, y - mh * s, s, mh * s, col);
    pxTri(c, x + mx * s - 6 * s, y - 3 * s, x + mx * s + 6 * s, y - 3 * s, x + mx * s, y - mh * s, col);
  }
}

/* ---------------- the stage ---------------- */

export function paint(c) {
  ditherGradient(c, 0, 0, PW, HORIZON + 2, SKY);

  /* ---- far: weather. Cloud banks, a break of light on the horizon, and a
     squall standing over the sea away to port ---- */
  {
    const f = c;
    const rand = rng(1720);
    for (let band = 0; band < 4; band++) {
      const y = 8 + band * 22;
      const tone = ['#1d242c', '#2b343c', '#3b464c', '#55605e'][band];
      const litTone = ['#39434c', '#4a555a', '#5f6a68', '#7d8880'][band];
      let x = -30;
      while (x < PW + 30) {
        const w = 40 + rand() * 80, hh = 10 + rand() * 16;
        pxEllipse(f, x, y + rand() * 8, w / 2, hh / 2, tone);
        pxEllipse(f, x - w * 0.12, y + rand() * 6 - 3, w * 0.32, hh * 0.34, litTone);
        x += w * 0.62;
      }
    }
    // the break of light under the cloud, sitting on the water. Composed as
    // a gradient rather than a dithered wash: ditherBand is per-pixel
    // fillRect, which over a 480-wide strip costs more than the rest of the
    // sky put together.
    ditherGradient(f, 0, HORIZON - 20, PW, 20, ['#6e7a74', '#9aa494', '#c9c9ab', '#e6e0bd'], 0.55);
  }

  // squall to port: a veil of rain hanging off the cloud into the sea, built
  // as banded translucent washes that thicken toward the water
  for (let i = 0; i < 11; i++) {
    const y0 = 34 + i * 9;
    pxRect(c, 4 + i * 2, y0, 122 - i * 3, 10, `rgba(44, 55, 62, ${0.09 + i * 0.028})`);
  }
  for (let i = 0; i < 80; i++) {
    const rx = 6 + ((i * 37) % 116), ry = 40 + ((i * 23) % (HORIZON - 44));
    pxLine(c, rx, ry, rx - 3, ry + 7, 1, ry > 90 ? '#7e8b8c' : '#5f6c70');
  }

  /* ---- the sea, from the horizon down to the rail ---- */
  ditherGradient(c, 0, HORIZON, PW, RAIL + 10 - HORIZON,
                 [SEA.far, SEA.mid, SEA.near, SEA.deep], 0.5);
  {
    const rand = rng(909);
    // swell: dashes that grow and spread as the water comes toward the ship
    for (let y = HORIZON + 1; y < RAIL + 8; y++) {
      const t = (y - HORIZON) / (RAIL + 8 - HORIZON);
      const len = 2 + Math.round(t * 13);
      const gap = 7 + Math.round(t * 26);
      for (let x = Math.floor(rand() * gap) - gap; x < PW; x += gap) {
        if (rand() > 0.24 + (1 - t) * 0.22) continue;
        const bright = rand();
        pxRect(c, x, y, len, 1, bright > 0.82 ? SEA.foam : bright > 0.45 ? '#4a6d70' : SEA.deep);
      }
    }
    for (let i = 0; i < 15; i++) {                   // whitecaps breaking
      const x = Math.floor(rand() * PW);
      const y = HORIZON + 4 + Math.floor(rand() * (RAIL - HORIZON - 22));
      const w = 3 + Math.floor(rand() * 7);
      pxRect(c, x, y, w, 1, SEA.foam);
      pxRect(c, x + 1, y - 1, Math.max(1, w - 3), 1, '#d6e6e0');
    }
  }

  /* ---- far ships and an island standing off the starboard bow ---- */
  c.drawImage(layer((f) => {
    distantShip(f, 232, HORIZON + 1, 1, '#2b3d42');
    distantShip(f, 292, HORIZON + 2, 0.6, '#395054');
    // island: a wedge of dark rock with a little green on the top
    pxTri(f, 372, HORIZON + 2, 470, HORIZON + 2, 414, 104, '#2f3f42');
    pxTri(f, 414, HORIZON + 2, 470, HORIZON + 2, 414, 104, '#223033');
    pxTri(f, 440, HORIZON + 2, 480, HORIZON + 2, 462, 116, '#26363a');
    pxRect(f, 396, 110, 22, 3, '#3d5544');
    pxRect(f, 404, 106, 10, 4, '#3d5544');
  }, '#1b262b'), 0, 0);

  /* ---- mid: the ship itself. Bulwark across the width, quarterdeck aft ---- */
  c.drawImage(layer((m) => {
    // bulwark: the ship's side, standing between the deck and the water
    block(m, -4, RAIL + 4, PW + 8, PGROUND - RAIL - 4, W.base, W.hi, W.lo);
    for (let y = RAIL + 8; y < PGROUND; y += 9) pxRect(m, 0, y, PW, 1, W.lo);
    for (let x = -6; x < PW; x += 38) pxRect(m, x, RAIL + 4, 3, PGROUND - RAIL - 4, W.wet);
    pxRect(m, -4, RAIL - 2, PW + 8, 7, W.hi);            // capping rail
    pxRect(m, -4, RAIL - 2, PW + 8, 2, '#8f6b4d');
    pxRect(m, -4, RAIL + 4, PW + 8, 2, W.deep);
    for (let x = 6; x < PW; x += 13) {                   // belaying pins
      pxRect(m, x, RAIL + 5, 2, 6, W.lo);
      pxRect(m, x - 1, RAIL + 4, 4, 2, W.hi);
    }
    // gun ports, lids triced up
    for (const gx of [22, 196, 300]) {
      pxRect(m, gx, RAIL + 12, 30, 24, W.deep);
      pxRect(m, gx + 2, RAIL + 14, 26, 20, '#12202a');
      pxRect(m, gx - 2, RAIL + 4, 34, 3, W.lo);
    }

    // quarterdeck aft: a raised deck with its own rail and a bulkhead below
    block(m, 366, QDECK, PW - 366 + 4, PGROUND - QDECK, W.wet, W.base, W.deep);
    pxRect(m, 366, QDECK, PW - 366, 3, '#8f6b4d');
    pxRect(m, 366, QDECK + 3, PW - 366, 2, W.deep);
    for (let y = QDECK + 6; y < PGROUND; y += 8) pxRect(m, 368, y, PW - 368, 1, W.deep);
    pxRect(m, 366, QDECK, 3, PGROUND - QDECK, W.deep);
    pxRect(m, 380, QDECK + 8, 18, 24, W.deep);           // companionway door
    pxRect(m, 382, QDECK + 10, 14, 20, '#1c130c');
    for (const wx of [412, 438]) {                       // stern windows
      pxRect(m, wx, QDECK + 10, 16, 12, W.deep);
      pxRect(m, wx + 1, QDECK + 11, 14, 10, '#2a3c42');
      pxRect(m, wx + 7, QDECK + 10, 2, 12, W.lo);
    }
    // steps up from the waist
    for (let i = 0; i < 4; i++) {
      pxRect(m, 350 + i * 5, QDECK + i * 8, 20 - i * 2, 8, W.base);
      pxRect(m, 350 + i * 5, QDECK + i * 8, 20 - i * 2, 2, W.hi);
    }
  }), 0, 0);

  planking(c);

  /* ---- crowd: the watch, up on the quarterdeck and along the rail ---- */
  c.drawImage(crowd([
    { x: 430, y: QDECK, h: 44, face: -1, pose: 'hips' },       // at the wheel
    { x: 392, y: QDECK, h: 42, face: -1, pose: 'point' },
    { x: 466, y: QDECK, h: 43, face: -1, pose: 'crossed' },
    { x: 98, y: 116, h: 28, face: 1, pose: 'behind', head: 'wrap', cloth: '#c8443a' },  // lookout aloft
    { x: 96, y: PGROUND, h: 47, face: 1, pose: 'crossed' },
    { x: 300, y: PGROUND, h: 45, face: -1, pose: 'cheer' },
    { x: 336, y: PGROUND - 1, h: 44, face: -1, pose: 'sit', garb: 'vest' },
  ], CROWD, { seed: 1799, haze: 'rgba(52, 70, 76, 0.18)' }), 0, 0);

  /* ---- near: mast, rigging and everything lashed to the deck ---- */
  c.drawImage(layer((n) => {
    // headsail closing off the top right corner, drawing full. Cloth is cut
    // from bolts, so the seams run with the belly and the leech is roped.
    const belly = (t) => 18 * Math.sin(t * Math.PI * 0.9);
    const luff = (t) => MAST_X + 13 + t * 96 - belly(t);
    const leech = (t) => PW + 10 - t * 26;
    const foot = 88;
    for (let y = 0; y < foot + 20; y++) {
      const t = y / foot;
      const x0 = luff(t) + 1;
      // the foot cuts up toward the luff instead of straight across
      const x1 = y <= foot ? leech(t) : leech(t) - (y - foot) * 9;
      if (x1 <= x0) continue;
      pxRect(n, x0, y, x1 - x0, 1, SAIL.base);
      pxRect(n, x0, y, Math.max(3, (x1 - x0) * 0.16), 1, SAIL.lit);
      pxRect(n, x1 - 18, y, 18, 1, SAIL.lo);
      pxRect(n, x1 - 5, y, 5, 1, SAIL.deep);
    }
    for (let k = 1; k < 6; k++) {                     // cloth seams
      for (let y = 0; y < foot + 20; y++) {
        const t = y / foot;
        const x0 = luff(t) + 1;
        const x1 = y <= foot ? leech(t) : leech(t) - (y - foot) * 9;
        if (x1 <= x0) continue;
        pxDot(n, x0 + (x1 - x0) * (k / 6), y, SAIL.lo);
      }
    }
    for (let y = 8; y < foot; y += 22) {              // reef points
      const t = y / foot, x0 = luff(t);
      for (let i = 1; i < 6; i++) pxRect(n, x0 + i * 26, y, 1, 3, SAIL.deep);
    }
    for (let y = 0; y < foot + 20; y++) {             // roped luff
      const t = y / foot;
      pxDot(n, luff(t), y, SAIL.deep);
    }

    // the mainmast, standing through the whole frame
    spar(n, MAST_X, 0, MAST_X, PGROUND + 4, 11, 15);
    for (let y = 18; y < PGROUND; y += 34) {          // iron hoops
      pxRect(n, MAST_X - 8, y, 16, 3, IRON);
      pxRect(n, MAST_X - 8, y, 16, 1, '#6d757d');
    }
    // yard across the mast with its sail furled along it
    spar(n, 14, 52, 268, 44, 7, 7);
    furledSail(n, 20, 262, 46, 11);
    pxLine(n, 14, 52, MAST_X, 22, 1, ROPE);           // lifts
    pxLine(n, 268, 44, MAST_X, 22, 1, ROPE);
    pxRect(n, MAST_X - 22, 20, 44, 5, W.lo);          // the top
    pxRect(n, MAST_X - 22, 20, 44, 2, W.hi);

    // shrouds either side of the mast: the lattice that frames the left
    shrouds(n, 44, 108, RAIL - 1, MAST_X - 13, MAST_X - 3, 22, 6);
    shrouds(n, 158, 214, RAIL - 1, MAST_X + 4, MAST_X + 14, 22, 5);
    // stays running out of frame fore and aft
    pxLine(n, MAST_X + 6, 24, PW, 118, 1, ROPE);
    pxLine(n, MAST_X - 6, 24, 0, 92, 1, ROPE);
    pxLine(n, MAST_X + 8, 60, 366, QDECK - 24, 1, ROPE);

    // fife rail and coiled falls round the mast heel
    block(n, MAST_X - 26, PGROUND - 22, 52, 6, W.base, W.hi, W.lo);
    for (let i = 0; i < 7; i++) {
      pxRect(n, MAST_X - 22 + i * 7, PGROUND - 26, 2, 10, W.lo);
      pxRect(n, MAST_X - 23 + i * 7, PGROUND - 27, 4, 2, W.hi);
    }
    pxRect(n, MAST_X - 24, PGROUND - 16, 5, 16, W.lo);
    pxRect(n, MAST_X + 19, PGROUND - 16, 5, 16, W.lo);
    ropeCoil(n, MAST_X - 34, PGROUND + 8, 11);

    // mizzen, stepped on the quarterdeck, with the black flag at its head.
    // The one hard silhouette in an overcast sky, and it sits in the only
    // strip of frame the HUD leaves free.
    spar(n, 374, 48, 374, QDECK - 20, 6, 8);
    pxRect(n, 368, 48, 13, 4, W.lo);
    pxRect(n, 368, 48, 13, 1, W.hi);
    for (let i = 0; i < 66; i++) {
      const t = i / 65;
      const fx = 372 - i;
      const wave = Math.round(Math.sin(t * 5.4) * 2.6 + t * 4);
      const hh = 24 - Math.round(t * 7);
      pxRect(n, fx, 52 + wave, 1, hh, t > 0.88 ? '#241f24' : '#17141a');
      pxRect(n, fx, 52 + wave, 1, 2, '#3b343d');
      pxRect(n, fx, 52 + wave + hh - 1, 1, 1, '#0d0b10');
    }
    pxRect(n, 336, 61, 7, 6, '#d8d2c0');              // skull
    pxRect(n, 337, 67, 5, 2, '#d8d2c0');
    pxRect(n, 337, 63, 2, 2, '#17141a');
    pxRect(n, 341, 63, 2, 2, '#17141a');
    pxRect(n, 338, 66, 3, 1, '#17141a');
    pxLine(n, 328, 72, 350, 60, 1, '#d8d2c0');        // crossed bones
    pxLine(n, 328, 60, 350, 72, 1, '#d8d2c0');

    // quarterdeck rail on turned stanchions, in front of the watch
    for (let x = 372; x < PW; x += 16) {
      pxRect(n, x, QDECK - 22, 3, 22, W.base);
      pxRect(n, x, QDECK - 22, 1, 22, W.hi);
    }
    pxRect(n, 366, QDECK - 24, PW - 366, 4, W.base);
    pxRect(n, 366, QDECK - 24, PW - 366, 1, '#8f6b4d');
    pxRect(n, 366, QDECK - 13, PW - 366, 2, W.lo);

    // the wheel, aft, with the helmsman behind it
    wheel(n, 430, QDECK - 21, 18);
    block(n, 424, QDECK - 4, 13, 6, W.base, W.hi, W.lo);
    pxRect(n, 402, QDECK - 16, 9, 16, W.base);        // binnacle
    pxRect(n, 401, QDECK - 20, 11, 5, W.lo);
    glow(n, 406, QDECK - 18, 12, '255, 206, 130', 3, 0.08);

    // stern lantern: the only warm thing on the stage, and it is in a corner
    pxRect(n, 464, QDECK - 58, 3, 30, W.lo);
    glow(n, 466, QDECK - 62, 26, '255, 190, 110', 5, 0.07);
    pxRect(n, 459, QDECK - 72, 15, 15, IRON);
    pxRect(n, 461, QDECK - 70, 11, 11, '#ffce7a');
    pxRect(n, 462, QDECK - 69, 5, 5, '#fff2c8');
    pxTri(n, 457, QDECK - 72, 476, QDECK - 72, 466, QDECK - 80, IRON);
    pxRect(n, 459, QDECK - 58, 15, 3, IRON);

    // gun on the port side of the waist
    cannon(n, 20, PGROUND + 2);
    // stores, lashed down against the roll
    barrel(n, 224, PGROUND - 24, 18, 26, '#6b4a2c', '#8f6640', '#3f2b19', IRON);
    barrel(n, 246, PGROUND - 20, 16, 22, '#6b4a2c', '#8f6640', '#3f2b19', IRON);
    barrel(n, 236, PGROUND - 44, 17, 22, '#6b4a2c', '#8f6640', '#3f2b19', IRON);
    pxLine(n, 220, PGROUND - 34, 266, PGROUND - 30, 1, ROPE);
    pxLine(n, 222, PGROUND - 16, 264, PGROUND - 12, 1, ROPE);
    crate(n, 380, PGROUND - 2, 26, 20, '#6b4f34', '#8f6b48', '#3d2a1a');
    crate(n, 408, PGROUND + 4, 22, 16, '#6b4f34', '#8f6b48', '#3d2a1a');
    pxLine(n, 376, PGROUND - 12, 434, PGROUND - 6, 1, ROPE);

    barrel(n, 328, PGROUND - 14, 20, 16, '#6b4a2c', '#8f6640', '#3f2b19', IRON);
    grating(n, 176, PGROUND + 10, 62, 22);
    ropeCoil(n, 300, PGROUND + 16, 13);
    ropeCoil(n, 462, PGROUND + 14, 10);

    // block and tackle swinging off the yard
    pxLine(n, 300, 46, 300, 96, 1, ROPE);
    pxRect(n, 296, 96, 9, 13, W.base);
    pxRect(n, 296, 96, 9, 2, W.hi);
    pxCircle(n, 300, 103, 2, IRON);
    pxLine(n, 300, 109, 306, 128, 1, ROPE);

    // a rope swagging across the very front of the deck
    for (let x = 0; x < PW; x++) {
      const y = PH - 12 + Math.round(Math.sin((x / PW) * Math.PI) * -7);
      pxRect(n, x, y, 1, 3, ROPE);
      pxRect(n, x, y, 1, 1, '#a68d63');
    }
  }), 0, 0);

  // spindrift blown up over the rail
  const rand = rng(4477);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rand() * PW);
    const y = RAIL - 8 + Math.floor(rand() * 10);
    pxDot(c, x, y, rand() > 0.5 ? '#c2d8d2' : '#8fb0ae');
  }
}

/* Spray driving across the deck, gulls working the ship's wake, and the
   stern lantern guttering in the wind. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.x -= 1.1 + d.s * 1.6;
    if (d.x < -6) { d.x = PW + 6; d.y = Math.random() * PGROUND; }
    const y = HORIZON + 14 + (d.y % (PGROUND - HORIZON - 20))
            + Math.sin(frame * 0.06 + d.w) * 2;
    const len = d.s > 0.7 ? 3 : 2;
    pxRect(c, d.x, y, len, 1, d.s > 0.75 ? '#cfe2dc' : '#8fb0ae');
  }

  for (let i = 0; i < 3; i++) {
    const gx = (frame * (0.4 + i * 0.15) + i * 190) % (PW + 40) - 20;
    const gy = 30 + i * 17 + Math.sin(frame * 0.028 + i * 2) * 5;
    const flap = Math.sin(frame * 0.16 + i * 1.7) > 0 ? 1 : -1;
    for (const [dx, dy] of [[-3, -flap], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, -flap]]) {
      pxDot(c, gx + dx, gy + dy, '#e8eee6');
    }
    pxDot(c, gx, gy + 1, '#c2ccc4');
  }

  if ((frame >> 3) % 11 !== 0) {
    pxRect(c, 461, QDECK - 70, 11, 11, '#ffce7a');
    pxRect(c, 462, QDECK - 69, 5, 5, '#fff2c8');
  }
}

export const stage = { key: 'pirate', name: 'CORSAIR', drift: 'spray', paint, overlay };
