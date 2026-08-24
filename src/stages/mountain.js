import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse, pxTaper } from '../pixel/draw.js';
import { ditherGradient, ditherBand } from '../pixel/dither.js';
import { layer, glow, block, makeDepth, METRE, shade, mixCol } from './props.js';
import { starField, rng } from './scenery.js';

/* A rope bridge over a gorge at sunrise.

   Asymmetric on purpose: a sheer cliff fills the left and runs off the top
   of the frame, the right opens onto empty air and the far ranges, and the
   fight happens on the span between them. Nobody watches -- it is a remote
   crossing, and the life in it is a pair of ravens, a wayside shrine, and a
   stone lantern still burning from the night.

   The mountains are drawn as mountains: ridgelines walked column by column,
   faces lit on the sunrise side and shadowed on the other, snow pooling in
   the gullies, spurs running off the summits, and each range paler and
   bluer than the one in front of it. */

export const DEPTH = makeDepth(134);
export const PEOPLE = [];             // a remote crossing: nobody stands here

const PAL = {
  wood: '#6b4f3a', woodHi: '#8c6a4e', woodLo: '#3f2c1f',
  rope: '#8a6a44', ropeHi: '#a3805f',
};
const ROCK = ['#6b6a86', '#757390', '#605e7c', '#6f6d8a'];
const ROCK_LO = '#454358', ROCK_HI = '#8e8dab';
const SNOW = '#e8ecff', SNOW_LO = '#c3cbe4';

const CLIFF_W = 128;                  // nominal face of the cliff, left
const R_LEDGE = 436;                  // rock pillar under the far anchor, right

/* ---------------- the ranges ---------------- */

/* Heightfield for one range. Control points pin the summits and saddles;
   midpoint displacement roughens every span between them, which is what
   makes a ridge read as rock rather than as a wave -- straight tilted
   faces meeting at kinks, not one smooth swell. */
function ridgeHeights(seed, pts, rough) {
  const rand = rng(seed);
  let seg = pts;
  for (let it = 0; it < 6; it++) {
    const next = [seg[0]];
    for (let i = 1; i < seg.length; i++) {
      const [x0, h0] = seg[i - 1], [x1, h1] = seg[i];
      next.push([(x0 + x1) / 2, (h0 + h1) / 2 + (rand() - 0.5) * (x1 - x0) * rough], seg[i]);
    }
    seg = next;
  }
  const H = new Array(PW + 1).fill(0);
  for (let i = 1; i < seg.length; i++) {
    const [x0, h0] = seg[i - 1], [x1, h1] = seg[i];
    for (let x = Math.max(0, Math.ceil(x0)); x <= Math.min(PW, x1); x++) {
      H[x] = Math.max(0, h0 + (h1 - h0) * ((x - x0) / Math.max(1e-6, x1 - x0)));
    }
  }
  return H;
}

/** Draw one range: faces faceted by slope, snow by altitude, crags, spurs. */
function range(f, seed, base, pts, summits, pal, snowFrac, rough) {
  const H = ridgeHeights(seed, pts, rough);
  const rand = rng(seed * 7 + 1);
  for (let x = 0; x < PW; x++) {
    const h = H[x];
    if (h < 2) continue;
    const ridgeY = Math.round(base - h);
    const slope = H[Math.min(PW, x + 2)] - H[Math.max(0, x - 2)];
    const lit = slope < -0.5;                     // dawn light from the right
    const shadowed = slope > 0.5;
    const snowEnd = Math.min(base, ridgeY + Math.round(h * snowFrac + rand() * 4));
    // each column is two runs -- snow above, rock below -- not h separate dots
    const snowCol = lit ? pal.snowLit : shadowed ? pal.snowLo : pal.snow;
    const rockCol = lit ? pal.rockLit : shadowed ? pal.rockLo : pal.rock;
    if (snowEnd > ridgeY) pxRect(f, x, ridgeY, 1, snowEnd - ridgeY, snowCol);
    if (base > snowEnd) pxRect(f, x, snowEnd, 1, base - snowEnd, rockCol);
    // crags: bare rock breaking through the snow on the steep bits
    if (Math.abs(slope) > 1.4 && rand() < 0.5 && snowEnd - ridgeY > 3) {
      pxRect(f, x, ridgeY + 1 + Math.floor(rand() * 3), 1, 2, pal.rockLo);
    }
  }
  // spurs running down off each summit, and snow-filled couloirs beside them
  for (const [cx, h] of summits) {
    const top = Math.round(base - H[Math.max(0, Math.min(PW, cx))]);
    for (const dir of [-1, 1]) {
      let x = cx, y = top + 2;
      const randS = rng(seed + cx * dir + 9);
      while (y < base - 2 && x > 2 && x < PW - 2) {
        pxDot(f, x, y, y < top + h * 0.4 ? pal.snowLo : pal.rockLo);
        x += dir * (randS() > 0.35 ? 1 : 0);
        y += 1 + (randS() > 0.7 ? 1 : 0);
      }
    }
    // a couloir: a ribbon of snow falling from the notch beside the summit
    const gx = cx + Math.round(h * 0.35);
    if (gx > 2 && gx < PW - 3) {
      const gy = Math.round(base - H[Math.min(PW, gx)]);
      for (let y = gy; y < gy + h * 0.45; y++) {
        pxRect(f, gx + Math.round(Math.sin(y * 0.2) * 1.2), y, 2, 1, pal.snow);
      }
    }
  }
}

/* ---------------- the cliff, left ---------------- */

/** The cliff's face width at a scanline: bulges, and one overhang. */
function cliffW(y) {
  let w = CLIFF_W + Math.sin(y * 0.021) * 7 + Math.sin(y * 0.008) * 12;
  if (y > 92 && y < 132) w += (1 - Math.abs(y - 112) / 20) * 15;   // overhang
  if (y > PGROUND - 26) w += (y - (PGROUND - 26)) * 0.5;           // footing
  return Math.round(w);
}

function cliff(m) {
  const rand = rng(808);
  // strata: bands of slightly different rock, dipping gently to the right
  const bands = [];
  for (let y = -10; y < PGROUND + 20; y += 9 + Math.floor(rand() * 8)) bands.push(y);
  for (let y = 0; y < PGROUND + 10; y++) {
    const w = cliffW(y);
    let b = 0;
    while (b < bands.length - 1 && bands[b + 1] < y) b++;
    pxRect(m, 0, y, w, 1, ROCK[b % ROCK.length]);
    pxRect(m, Math.max(0, w - 13), y, 13, 1, ROCK_LO);              // turned edge
    pxRect(m, Math.max(0, w - 3), y, 3, 1, shade(ROCK_LO, 0.72));
  }
  // strata seams, each dipping across the face; snow sits only on the wider
  // sills, so the face does not read as pinstripes
  for (let bi = 0; bi < bands.length; bi++) {
    const by = bands[bi];
    if (by < 4) continue;
    const wSeam = cliffW(by);
    const snowy = bi % 3 === 0 && by < 160;
    for (let x = 0; x < wSeam; x++) {
      const y = Math.round(by + Math.sin(x * 0.05) * 1.5 + x * 0.045);
      pxDot(m, x, y, ROCK_LO);
      if (snowy && rand() < 0.7) pxDot(m, x, y - 1, x % 3 ? SNOW : SNOW_LO);
    }
  }
  // the overhang's underside, in hard shadow, icicles off its lip
  for (let y = 128; y < 142; y++) {
    pxRect(m, cliffW(y) - 18, y, 18, 1, shade(ROCK_LO, 0.6));
  }
  for (const [ix, il] of [[cliffW(130) - 4, 9], [cliffW(130) - 10, 6], [cliffW(131) - 15, 4]]) {
    pxTaper(m, ix, 132, ix, 132 + il, 3, 1, '#dfe8ff');
  }
  // cracks wandering down the face
  for (const [cx0, cy0, len] of [[38, 10, 90], [86, 60, 110], [58, 150, 70]]) {
    let x = cx0, y = cy0;
    const randC = rng(cx0 * 3);
    for (let i = 0; i < len && y < PGROUND - 4; i++) {
      pxDot(m, x, y, ROCK_LO);
      if (randC() > 0.82) pxDot(m, x + 1, y, shade(ROCK_LO, 0.75));
      y += 1;
      x += randC() > 0.7 ? (randC() > 0.4 ? 1 : -1) : 0;
    }
  }
  // pale scars where slabs have sheared away
  for (const [sx, sy, sw, sh] of [[12, 74, 16, 26], [70, 116, 14, 20], [30, 186, 18, 16]]) {
    pxRect(m, sx, sy, sw, sh, ROCK_HI);
    pxRect(m, sx, sy + sh - 2, sw, 2, ROCK_LO);
    pxRect(m, sx + sw - 2, sy, 2, sh, ROCK_LO);
  }

  // the ledge path the near anchor stands on, and talus spilling off it
  for (let y = PGROUND; y < PH; y++) {
    pxRect(m, 0, y, 150 - (y - PGROUND), 1, y === PGROUND ? ROCK_HI : ROCK[(y >> 3) % ROCK.length]);
  }
  pxRect(m, 0, PGROUND, 150, 2, SNOW);                              // snow on the lip
  pxRect(m, 0, PGROUND + 2, 148, 1, SNOW_LO);
  for (let i = 0; i < 26; i++) {                                    // scree
    const sx = Math.floor(rand() * 130);
    const sy = PGROUND + 4 + Math.floor(rand() * 28);
    if (150 - (sy - PGROUND) < sx) continue;
    const sw = 2 + Math.floor(rand() * 5);
    pxRect(m, sx, sy, sw, Math.max(2, sw - 1), rand() > 0.5 ? ROCK_LO : ROCK_HI);
    pxRect(m, sx, sy, sw, 1, rand() > 0.6 ? SNOW : ROCK_HI);
  }
}

/* ---------------- built things ---------------- */

/** A stone toro lantern, man-high, its firebox still lit. */
function toro(m, x, baseY) {
  const H = (v) => Math.round(v * METRE);
  block(m, x - 14, baseY - H(0.22), 28, H(0.22), '#767490', ROCK_HI, ROCK_LO);
  block(m, x - 5, baseY - H(0.85), 10, H(0.65), '#6b6a86', ROCK_HI, ROCK_LO);
  block(m, x - 11, baseY - H(1.0), 22, H(0.16), '#767490', ROCK_HI, ROCK_LO);
  // firebox with its warm opening
  block(m, x - 8, baseY - H(1.34), 16, H(0.34), '#6b6a86', ROCK_HI, ROCK_LO);
  glow(m, x, baseY - H(1.18), 22, '255, 190, 110', 4, 0.09);
  pxRect(m, x - 4, baseY - H(1.3), 8, H(0.25), '#2b2118');
  pxRect(m, x - 3, baseY - H(1.28), 6, H(0.21), '#ffce7a');
  pxRect(m, x - 2, baseY - H(1.26), 3, H(0.12), '#fff2c8');
  // roof with kicked eaves, snow on top
  pxTri(m, x - 15, baseY - H(1.36), x + 15, baseY - H(1.36), x, baseY - H(1.62), '#575572');
  pxRect(m, x - 16, baseY - H(1.38), 32, 3, '#454358');
  pxRect(m, x - 15, baseY - H(1.44), 30, 2, SNOW);
  pxRect(m, x - 8, baseY - H(1.52), 16, 2, SNOW);
  pxCircle(m, x, baseY - H(1.66), 3, '#767490');
  pxDot(m, x - 1, baseY - H(1.67), ROCK_HI);
}

/** A wayside hokora shrine, hip-high on its stone base. */
function hokora(m, x, baseY) {
  const H = (v) => Math.round(v * METRE);
  block(m, x - 15, baseY - H(0.3), 30, H(0.3), '#767490', ROCK_HI, ROCK_LO);
  block(m, x - 11, baseY - H(0.95), 22, H(0.65), '#8c3226', '#b5503c', '#5c2119');
  pxRect(m, x - 4, baseY - H(0.85), 8, H(0.5), '#2b1220');
  pxRect(m, x - 3, baseY - H(0.82), 6, H(0.45), '#f2c070');
  glow(m, x, baseY - H(0.6), 16, '255, 190, 110', 3, 0.08);
  pxTri(m, x - 16, baseY - H(0.95), x + 16, baseY - H(0.95), x, baseY - H(1.22), '#6b2029');
  pxRect(m, x - 17, baseY - H(0.97), 34, 3, '#511a22');
  pxRect(m, x - 16, baseY - H(1.03), 32, 2, SNOW);
  pxRect(m, x - 7, baseY - H(1.12), 14, 2, SNOW);
  // offerings at its feet
  pxEllipse(m, x - 10, baseY - 2, 3, 2, '#c8a05c');
  pxEllipse(m, x + 9, baseY - 2, 3, 2, '#d84a3a');
}

/* ---------------- the stage ---------------- */

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#141c4e', '#2c3f7e', '#6d5f9c', '#d0806a', '#f5b97e']);
  starField(c, 60, 46, 777);
  glow(c, 396, 58, 50, '255, 185, 138', 5, 0.07);
  pxCircle(c, 396, 58, 16, '#ffd9a0');
  pxCircle(c, 396, 58, 11, '#fff3d0');

  /* ---- the ranges across the gorge, palest first ---- */
  range(c, 41, 216,
    [[0, 62], [60, 112], [128, 48], [196, 84], [252, 40], [318, 98], [372, 52], [438, 82], [480, 58]],
    [[60, 112], [318, 98]], {
      rockLit: '#8b84b4', rock: '#7a73a6', rockLo: '#665f92',
      snowLit: '#ece6f6', snow: '#dcd6ec', snowLo: '#c4bede',
    }, 0.5, 0.22);
  range(c, 87, 226,
    [[0, 10], [70, 34], [118, 60], [162, 155], [212, 62], [258, 88], [300, 128], [348, 46], [396, 74], [436, 108], [480, 24]],
    [[162, 155], [300, 128], [436, 108]], {
      rockLit: '#6b6398', rock: '#554e84', rockLo: '#413a68',
      snowLit: '#f8eef2', snow: '#e0daf0', snowLo: '#c6c0e2',
    }, 0.34, 0.3);

  // a dark forested spur closing the lower right, pines on its ridge
  c.drawImage(layer((s) => {
    for (let x = 372; x < PW; x++) {
      const h = Math.round(((x - 372) / 108) * 118 + Math.sin(x * 0.11) * 3);
      const top = 228 - h;
      pxRect(s, x, top, 1, Math.min(3, 232 - top), '#3d4a66');
      if (232 > top + 3) pxRect(s, x, top + 3, 1, 232 - top - 3, '#2e3a52');
    }
    const randP = rng(51);
    for (let x = 378; x < PW - 2; x += 5 + Math.floor(randP() * 7)) {
      const h = Math.round(((x - 372) / 108) * 118 + Math.sin(x * 0.11) * 3);
      const ph = 4 + Math.floor(randP() * 5) + Math.round((x - 372) / 22);
      pxTri(s, x - ph / 2.4, 228 - h, x + ph / 2.4, 228 - h, x, 228 - h - ph, '#26314a');
    }
  }, '#1d2438'), 0, 0);

  /* ---- cloud filling the gorge below everything ---- */
  ditherGradient(c, 0, PGROUND - 14, PW, PH - PGROUND + 14,
                 ['#8b81ae', '#6f6795', '#4a4370', '#2c2748']);
  for (let i = 0; i < 30; i++) {
    const cx = (i * 67) % PW;
    const cy = PGROUND - 10 + ((i * 13) % 34);
    ditherBand(c, cx, cy, 22 + (i * 5) % 30, 4, 'rgba(0,0,0,0)', '#cfc4e4', 0.55);
  }

  /* ---- the cliff, and the ledge the near end of the bridge stands on ---- */
  c.drawImage(layer((m) => {
    cliff(m);
    toro(m, 12, PGROUND + 22);
    // meltwater falling away under the bridge's near end
    for (let y = PGROUND + 11; y < PH; y++) {
      const w = 7 + (y - PGROUND) * 0.2;
      pxRect(m, 143 - w / 2, y, w, 1, y % 6 < 3 ? '#cfe0f8' : '#a8c2e8');
    }
    pxEllipse(m, 143, PGROUND + 12, 6, 2, '#e8f0ff');
  }), 0, 0);

  /* ---- the far anchor: a rock pillar with the wayside shrine ---- */
  c.drawImage(layer((g) => {
    const rand = rng(31337);
    for (let y = PGROUND; y < PH; y++) {
      pxRect(g, R_LEDGE - Math.round((y - PGROUND) * 0.4), y,
             PW - R_LEDGE + 20, 1, ROCK[(y >> 3) % ROCK.length]);
    }
    pxRect(g, R_LEDGE - 2, PGROUND, PW - R_LEDGE + 4, 2, SNOW);
    pxRect(g, R_LEDGE - 2, PGROUND + 2, PW - R_LEDGE + 4, 1, SNOW_LO);
    for (let i = 0; i < 12; i++) {
      const sx = R_LEDGE + Math.floor(rand() * (PW - R_LEDGE));
      const sy = PGROUND + 6 + Math.floor(rand() * 24);
      pxRect(g, sx, sy, 2 + Math.floor(rand() * 4), 2, rand() > 0.5 ? ROCK_LO : ROCK_HI);
    }
    hokora(g, 462, PGROUND - 2);
  }), 0, 0);

  /* ---- the bridge the fight happens on ---- */
  c.drawImage(layer((b) => {
    const span0 = 46, span1 = 452;   // near anchor sits left of the
                                     // left wall (x 48), so the whole
                                     // walkable span is bridge
    const T = (x) => (x - span0) / (span1 - span0);
    const sag = (x, amp) => Math.round(Math.sin(T(x) * Math.PI) * amp);

    // anchor posts: paired uprights, lashed, man-high and then some
    for (const [px, baseY] of [[28, PGROUND + 8], [46, PGROUND + 6],
                               [448, PGROUND + 6], [464, PGROUND + 8]]) {
      const h = Math.round(1.7 * METRE);
      block(b, px - 6, baseY - h, 12, h, PAL.wood, PAL.woodHi, PAL.woodLo);
      pxRect(b, px - 6, baseY - h, 3, h, PAL.woodHi);
      pxRect(b, px - 7, baseY - h - 2, 14, 4, PAL.woodLo);       // capped
      pxRect(b, px - 7, baseY - h - 3, 14, 2, SNOW);
      for (const ly of [baseY - h + 8, baseY - h + 14]) {        // lashings
        pxRect(b, px - 7, ly, 14, 2, PAL.rope);
        pxRect(b, px - 7, ly, 14, 1, PAL.ropeHi);
      }
    }
    pxRect(b, 22, PGROUND - 76, 30, 4, PAL.woodLo);              // crossbars
    pxRect(b, 442, PGROUND - 78, 30, 4, PAL.woodLo);

    // hand ropes at hand height, sagging over the span
    for (let x = span0 - 14; x < span1 + 12; x++) {
      pxRect(b, x, PGROUND - 64 + sag(x, 8), 1, 2, PAL.rope);
      pxDot(b, x, PGROUND - 64 + sag(x, 8), PAL.ropeHi);
      pxRect(b, x, PGROUND - 34 + sag(x, 6), 1, 2, shade(PAL.rope, 0.85));
    }
    // suspenders binding the ropes to the deck edge
    for (let x = span0 + 4; x < span1 - 2; x += 16) {
      pxLine(b, x, PGROUND - 63 + sag(x, 8), x, PGROUND + 2 + sag(x, 3), 1, PAL.rope);
    }

    // the deck: planks over two stringers, a couple of them gone
    pxRect(b, span0 - 16, PGROUND + 8, span1 - span0 + 30, 3, PAL.woodLo);
    for (let x = span0 - 16; x < span1 + 8; x += 9) {
      const s = sag(x, 3);
      if (x === 238 || x === 337) {                              // missing plank
        pxRect(b, x + 1, PGROUND - 1 + s, 3, 8, PAL.woodLo);     // splintered stub
        pxRect(b, x + 5, PGROUND + 6 + s, 2, 4, PAL.woodLo);
        continue;
      }
      pxRect(b, x, PGROUND - 2 + s, 8, 12, x % 18 === 0 ? PAL.woodHi : PAL.wood);
      pxRect(b, x, PGROUND - 2 + s, 8, 2, PAL.ropeHi);
      pxRect(b, x + 7, PGROUND - 2 + s, 1, 12, PAL.woodLo);
    }
    // snow lying along the planks where feet have not scuffed it
    const randS = rng(2024);
    for (let x = span0 - 12; x < span1 + 6; x += 3) {
      if (randS() > 0.6) pxRect(b, x, PGROUND - 2 + sag(x, 3), 2 + Math.floor(randS() * 4), 1, SNOW);
    }

    // ravens sitting the hand rope out
    for (const [rx, face] of [[204, 1], [216, -1]]) {
      const ry = PGROUND - 64 + sag(rx, 8);
      pxRect(b, rx, ry - 5, 5, 4, '#1d1b28');
      pxRect(b, rx + (face > 0 ? 3 : -1), ry - 7, 3, 3, '#262436');
      pxDot(b, rx + (face > 0 ? 6 : -2), ry - 6, '#8a8279');
      pxRect(b, rx + (face > 0 ? -2 : 5), ry - 4, 2, 2, '#14121e');
    }
  }), 0, 0);

  /* ---- near: prayer flags strung from the rock to the far anchor ---- */
  c.drawImage(layer((n) => {
    const fx0 = 112, fy0 = 22, fx1 = 452, fy1 = PGROUND - 84;
    const cordY = (t) => fy0 + (fy1 - fy0) * t + Math.sin(t * Math.PI) * 14;
    let px = fx0, py = cordY(0);
    for (let i = 1; i <= 48; i++) {                    // the cord itself
      const t = i / 48;
      const x = fx0 + (fx1 - fx0) * t, y = cordY(t);
      pxLine(n, px, py, x, y, 1, '#4a3a34');
      px = x; py = y;
    }
    for (let i = 1; i < 15; i++) {                     // flags close along it
      const t = i / 15;
      const x = Math.round(fx0 + (fx1 - fx0) * t) - 5;
      const y = Math.round(cordY(t)) + 1;
      const colr = ['#d8503c', '#e8c060', '#3f7a8c', '#f0e0c8', '#4f8a3c'][i % 5];
      pxRect(n, x, y, 10, 12, colr);
      pxRect(n, x, y, 10, 2, shade(colr, 0.6));        // seam over the cord
      pxRect(n, x + 1, y + 2, 3, 8, mixCol(colr, '#ffffff', 0.25));
      pxRect(n, x, y + 10, 10, 2, shade(colr, 0.7));
      pxDot(n, x + 2 + (i % 3) * 3, y + 12, shade(colr, 0.7));   // frayed hem
    }
  }), 0, 0);
}

/* Snow crossing the gorge. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.y += d.s * 0.7;
    d.x += Math.sin(frame * 0.02 + d.w) * 0.4 + 0.15;
    if (d.y > PH) { d.y = -2; d.x = Math.random() * PW; }
    pxDot(c, d.x, d.y, d.s > 0.75 ? '#ffffff' : '#d6ddf2');
  }
}

export const stage = { key: 'mountain', name: 'MOUNTAIN', drift: 'snow', paint, overlay };
