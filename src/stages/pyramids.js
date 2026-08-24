import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse } from '../pixel/draw.js';
import { ditherGradient, ditherDisc, ditherBand } from '../pixel/dither.js';
import { layer, glow, crate, basket, sack,
         crowd, paving, glyphMark, makeDepth, person, METRE, mixCol } from './props.js';
import { rng } from './scenery.js';

/* An open excavation site under the pyramids.

   Deliberately the opposite shape to the market street: no buildings framing
   the sides, a low horizon, and enormous silhouettes doing the work instead.
   Scale is the whole point here. The pyramids sit on the horizon and still
   run off the top of the frame; the colossus stands in the middle distance
   and the frame cuts it off at the waist -- what shows is its plinth, its
   legs and its fists, and the crowd of diggers working under it is sized by
   where each one's feet meet the plain. */

export const DEPTH = makeDepth(132);
const D = DEPTH;
const HORIZON = D.horizonY;

/* Bleached linen, dyed wool and a lot of sun. Almost everyone here has their
   head covered, which is what makes the crowd read as a desert crowd from
   thirty pixels away. */
const CROWD = {
  cloth: ['#e0d3b4', '#cfbf9c', '#c85a3c', '#3f6f8c', '#4a3f7a', '#b8944f',
          '#8c6a3a', '#a85a4a', '#5f7a5c', '#d8c188'],
  alt:   ['#b8a77f', '#8f7c56', '#6f6a52', '#a08a62'],
  trim:  ['#e8c060', '#f2ead4', '#2f5f7a', '#8c3226'],
  hats:  ['#f2ead4', '#e0d3b4', '#c85a3c', '#3f6f8c', '#e8c060', '#b8944f'],
  light: '#fff0c4',
  shoe:  '#4a3826',
  heads: ['wrap', 'wrap', 'wrap', 'hood', 'cone', 'brim', 'bare', 'short',
          'long', 'bald', 'tail'],
  garbs: ['robe', 'robe', 'tunic', 'tunic', 'apron', 'vest'],
  loads: [null, null, null, null, 'jug', 'basket', 'sack', 'staff'],
};

/** A pyramid sitting on the horizon. `haze` fades it into the sky. */
function pyramid(c, px, baseY, halfW, haze) {
  const h = Math.round(halfW * 1.27);                 // the true 52-degree slope
  const lit = mixCol('#c9a05e', '#cfe0ec', haze);
  const dark = mixCol('#9d7440', '#a8c2d4', haze);
  const edge = mixCol('#876636', '#93aec0', haze);
  pxTri(c, px - halfW, baseY, px + halfW, baseY, px, baseY - h, lit);
  pxTri(c, px, baseY, px + halfW, baseY, px, baseY - h, dark);
  for (let i = 8; i < Math.min(h, baseY + 40); i += 9) {   // core courses
    const w = Math.round(halfW * (1 - i / h));
    pxRect(c, px - w, baseY - i, w * 2, 1, `rgba(92, 62, 30, ${0.22 - haze * 0.18})`);
  }
  pxLine(c, px, baseY - h, px, baseY, 1, edge);
}

/* Weathered limestone, six tones. Sculpture reads as sculpture because of the
   planes, so every one of these is a *facing*, not a shade of the same thing:
   lit is anything turned up-left toward the sun, deep is a recess. */
const STONE = {
  lit: '#e6d0a0', base: '#cdb47e', mid: '#b09763',
  dark: '#8d7448', deep: '#66542f', crack: '#4f4026',
};

/* A seated colossus.

   Laid out in fractions of its own height so the proportions hold at any
   size: plinth to knee is the bottom two fifths, the torso the next third,
   and the head and nemes the top fifth -- the squat, wide, front-facing
   proportions of an enthroned Egyptian figure rather than a person sitting
   down. The head carries a heavy brow whose underside shades the eye
   sockets, a straight nose with one lit face and one shadowed, and a mouth
   cut as a flat groove; a curved mouth or a lit eye instantly turns a statue
   into a face. It is then broken -- the silhouette is notched out with
   destination-out in a dozen places, so the layer's keyline traces real
   chipped stone instead of a clean rectangle. */
function colossus(c, x, baseY, h) {
  const S = STONE;
  const Y = (v) => Math.round(baseY - v * h);        // height above the ground
  const L = (v) => Math.round(x + v * h);            // offset from the centre
  const D = (v) => Math.max(1, Math.round(v * h));
  const box = (x0, y0, x1, y1, col) =>
    pxRect(c, Math.min(x0, x1), Math.min(y0, y1),
           Math.abs(x1 - x0), Math.abs(y1 - y0), col);
  // everything below the lap sits in its own shadow, which is both true of a
  // seated figure and what keeps the fighters' band quiet
  const B = { lit: S.base, base: S.mid, mid: S.dark, dark: S.deep, deep: S.crack, crack: '#3d3220' };
  /* a vertical run whose half-width follows a curve: every rounded mass on
     the figure is built this way so nothing is a literal rectangle */
  const column = (tTop, tBot, wAt, tone) => {
    for (let yy = Y(tTop); yy <= Y(tBot); yy++) {
      const t = (baseY - yy) / h;
      const hw = wAt(t);
      if (hw <= 0) continue;
      const x0 = L(-hw), x1 = L(hw);
      pxRect(c, x0, yy, x1 - x0 + 1, 1, tone(t, x0, x1, yy));
    }
  };

  // ---- throne: only the deep recess between the legs is ever visible
  box(L(-0.17), Y(0.52), L(0.17), Y(0.02), B.deep);
  box(L(-0.17), Y(0.52), L(-0.13), Y(0.02), B.dark);
  for (const gx of [-0.09, 0.00, 0.09]) box(L(gx), Y(0.50), L(gx + 0.008), Y(0.04), B.crack);

  // ---- plinth
  box(L(-0.36), Y(0.115), L(0.36), Y(-0.02), B.base);
  box(L(-0.36), Y(0.115), L(0.36), Y(0.100), B.lit);
  box(L(-0.36), Y(0.100), L(-0.325), Y(-0.02), B.lit);
  box(L(0.325), Y(0.100), L(0.36), Y(-0.02), B.dark);
  box(L(-0.36), Y(0.085), L(0.36), Y(0.075), B.dark);
  for (let i = 0; i < 7; i++) {                       // carved inscription band
    glyphMark(c, L(-0.30) + i * D(0.088), Y(0.070), D(0.055), D(0.042), B.crack, i * 5 + 1);
  }

  // ---- feet, toes forward on the plinth
  for (const sgn of [-1, 1]) {
    const o = sgn < 0 ? B.base : B.mid;
    box(L(sgn * 0.115), Y(0.205), L(sgn * 0.305), Y(0.115), o);
    box(L(sgn * 0.115), Y(0.205), L(sgn * 0.305), Y(0.190), sgn < 0 ? B.lit : B.base);
    box(L(sgn * 0.115), Y(0.128), L(sgn * 0.305), Y(0.115), B.dark);
    for (let i = 0; i < 4; i++) {
      const tx = L(sgn * (0.135 + i * 0.042));
      box(tx, Y(0.175), tx + 1, Y(0.128), B.dark);
    }
  }

  // ---- shins and knees
  for (const sgn of [-1, 1]) {
    const body = sgn < 0 ? B.base : B.mid;
    box(L(sgn * 0.125), Y(0.455), L(sgn * 0.295), Y(0.195), body);
    box(L(sgn * 0.125), Y(0.455), L(sgn * 0.155), Y(0.195), sgn < 0 ? B.mid : B.dark);
    box(L(sgn * 0.265), Y(0.455), L(sgn * 0.295), Y(0.195), sgn < 0 ? B.lit : B.dark);
    // the knee rolls over into the top of the shin
    const kx = L(sgn * 0.21), kw = D(0.087);
    pxEllipse(c, kx, Y(0.452), kw, D(0.030), sgn < 0 ? S.mid : S.dark);
    pxEllipse(c, kx - D(0.012), Y(0.457), Math.round(kw * 0.7), D(0.020), sgn < 0 ? S.base : S.mid);
    box(L(sgn * 0.125), Y(0.430), L(sgn * 0.295), Y(0.420), B.crack);  // shadow of the lap
    box(L(sgn * 0.125), Y(0.400), L(sgn * 0.295), Y(0.392), B.dark);   // shin groove
  }

  // ---- lap: the thighs running back from the knees
  box(L(-0.24), Y(0.470), L(0.24), Y(0.405), S.base);
  box(L(-0.24), Y(0.470), L(0.24), Y(0.455), S.lit);
  box(L(-0.24), Y(0.418), L(0.24), Y(0.405), S.dark);
  box(L(-0.24), Y(0.470), L(-0.205), Y(0.405), S.lit);
  box(L(0.205), Y(0.462), L(0.24), Y(0.405), S.mid);
  for (let i = -6; i <= 6; i++) {                    // pleats of the kilt
    box(L(i * 0.036), Y(0.455), L(i * 0.036 + 0.006), Y(0.412), i < 0 ? S.mid : S.dark);
    box(L(i * 0.036 - 0.006), Y(0.455), L(i * 0.036), Y(0.412), i < 0 ? S.lit : S.base);
  }
  box(L(-0.155), Y(0.500), L(0.155), Y(0.470), S.base);       // apron of the kilt
  box(L(-0.155), Y(0.500), L(-0.130), Y(0.470), S.lit);
  box(L(0.130), Y(0.500), L(0.155), Y(0.470), S.mid);
  box(L(-0.155), Y(0.478), L(0.155), Y(0.470), S.dark);

  // ---- fists laid on the knees
  for (const sgn of [-1, 1]) {
    const body = sgn < 0 ? S.base : S.mid;
    box(L(sgn * 0.155), Y(0.560), L(sgn * 0.275), Y(0.455), body);
    box(L(sgn * 0.155), Y(0.560), L(sgn * 0.275), Y(0.545), sgn < 0 ? S.lit : S.base);
    box(L(sgn * 0.265), Y(0.560), L(sgn * 0.275), Y(0.455), sgn < 0 ? S.lit : S.dark);
    box(L(sgn * 0.155), Y(0.470), L(sgn * 0.275), Y(0.455), S.dark);
    for (let i = 0; i < 3; i++) {                     // knuckles
      const ky = Y(0.545 - i * 0.028);
      box(L(sgn * 0.165), ky, L(sgn * 0.265), ky + 1, S.dark);
    }
  }

  // ---- torso, widening from the waist to a heavy pair of shoulders
  column(0.735, 0.44,
    (t) => (t > 0.70 ? 0.255
          : t > 0.58 ? 0.190 + (t - 0.58) * 0.54
          : 0.152 + (t - 0.44) * 0.27),
    () => S.base);
  // the same silhouette, re-walked to lay the light and shadow faces on it
  for (let yy = Y(0.735); yy <= Y(0.44); yy++) {
    const t = (baseY - yy) / h;
    const hw = t > 0.70 ? 0.255 : t > 0.58 ? 0.190 + (t - 0.58) * 0.54 : 0.152 + (t - 0.44) * 0.27;
    pxRect(c, L(-hw), yy, D(0.035), 1, S.lit);
    pxRect(c, L(hw) - D(0.045), yy, D(0.045), 1, S.mid);
    pxRect(c, L(hw) - D(0.016), yy, D(0.016), 1, S.dark);
  }
  box(L(-0.16), Y(0.610), L(0.16), Y(0.598), S.dark);      // under the pectorals
  box(L(-0.16), Y(0.598), L(0.16), Y(0.588), S.mid);
  box(L(-0.006), Y(0.700), L(0.006), Y(0.612), S.mid);     // sternum
  box(L(-0.11), Y(0.500), L(0.11), Y(0.490), S.dark);      // belt of the kilt
  box(L(-0.11), Y(0.490), L(0.11), Y(0.478), S.mid);

  // ---- arms hanging outside the torso, forearms down onto the fists
  for (const sgn of [-1, 1]) {
    const body = sgn < 0 ? S.base : S.mid;
    box(L(sgn * 0.185), Y(0.715), L(sgn * 0.268), Y(0.545), body);
    box(L(sgn * 0.185), Y(0.715), L(sgn * 0.199), Y(0.545), S.dark);      // shoulder groove
    box(L(sgn * 0.255), Y(0.700), L(sgn * 0.268), Y(0.545), sgn < 0 ? S.lit : S.dark);
    box(L(sgn * 0.185), Y(0.640), L(sgn * 0.268), Y(0.630), S.dark);      // elbow
    box(L(sgn * 0.164), Y(0.700), L(sgn * 0.185), Y(0.500), S.mid);       // cast shadow
  }

  // ---- neck
  box(L(-0.058), Y(0.780), L(0.058), Y(0.700), S.mid);
  box(L(-0.058), Y(0.780), L(-0.030), Y(0.700), S.base);
  box(L(-0.075), Y(0.735), L(0.075), Y(0.722), S.dark);

  // ---- nemes lappets falling either side of the face onto the chest.
  // Given their own tone and a hard inner edge, or the whole headdress and
  // the face fuse into one striped mass.
  for (const sgn of [-1, 1]) {
    for (let yy = Y(0.884); yy <= Y(0.585); yy++) {
      const t = (baseY - yy) / h;
      const k = (0.884 - t) / 0.299;
      const inner = 0.066 + k * 0.026, outer = 0.116 + k * 0.048;
      const x0 = L(sgn * inner), x1 = L(sgn * outer);
      const lo = Math.min(x0, x1), w = Math.abs(x1 - x0);
      pxRect(c, lo, yy, w, 1, sgn < 0 ? S.mid : S.dark);
      pxRect(c, sgn < 0 ? lo : lo + w - D(0.012), yy, D(0.012), 1, sgn < 0 ? S.base : S.deep);
      if ((baseY - yy) % 7 === 0) pxRect(c, lo, yy, w, 1, sgn < 0 ? S.dark : S.deep);
    }
    box(L(sgn * 0.062), Y(0.884), L(sgn * 0.068), Y(0.600), S.crack);       // face edge
    box(L(sgn * 0.090), Y(0.600), L(sgn * 0.168), Y(0.585), S.deep);        // tie
    box(L(sgn * 0.090), Y(0.616), L(sgn * 0.168), Y(0.600), S.dark);
  }

  // ---- broad collar between the lappets
  for (let i = 0; i < 3; i++) {
    const w = 0.086 - i * 0.008;
    box(L(-w), Y(0.664 - i * 0.020), L(w), Y(0.656 - i * 0.020), i % 2 ? S.dark : S.lit);
    box(L(-w), Y(0.656 - i * 0.020), L(w), Y(0.646 - i * 0.020), i % 2 ? S.mid : S.base);
  }

  // ---- head
  const faceW = (t) => (t > 0.880 ? 0.054 + (0.900 - t) * 0.60
                      : t > 0.790 ? 0.066
                      : 0.066 - (0.790 - t) * 0.34);
  column(0.900, 0.758, faceW, () => S.base);
  for (let yy = Y(0.900); yy <= Y(0.758); yy++) {
    const hw = faceW((baseY - yy) / h);
    pxRect(c, L(-hw), yy, D(0.017), 1, S.lit);
    pxRect(c, L(hw) - D(0.020), yy, D(0.020), 1, S.mid);
  }

  // ---- nemes crown over the skull: one mass with a lit face and a shadow
  // face, and only hairline stripes. Broad alternating bands read as a
  // ziggurat rather than as cloth.
  for (let yy = Y(1.000); yy <= Y(0.884); yy++) {
    const t = (baseY - yy) / h;
    const hw = 0.070 + (0.982 - t) * 0.31;
    pxRect(c, L(-hw), yy, D(hw * 2), 1, S.base);
    pxRect(c, L(-hw), yy, D(0.028), 1, S.lit);
    pxRect(c, L(hw) - D(0.034), yy, D(0.034), 1, S.mid);
    pxRect(c, L(hw) - D(0.013), yy, D(0.013), 1, S.dark);
    if ((baseY - yy) % 6 === 0) {
      pxRect(c, L(-hw) + D(0.028), yy, D(hw * 2) - D(0.062), 1, S.mid);
    }
  }
  box(L(-0.112), Y(0.898), L(0.112), Y(0.884), S.mid);         // brow band
  box(L(-0.112), Y(0.898), L(0.112), Y(0.893), S.lit);
  box(L(-0.112), Y(0.888), L(0.112), Y(0.884), S.dark);

  // ---- uraeus reared at the brow
  box(L(-0.024), Y(0.918), L(0.024), Y(0.899), S.dark);
  box(L(-0.024), Y(0.918), L(0.024), Y(0.913), S.lit);
  box(L(-0.010), Y(0.913), L(0.010), Y(0.899), S.deep);
  box(L(-0.010), Y(0.936), L(0.010), Y(0.916), S.mid);
  box(L(-0.010), Y(0.936), L(-0.004), Y(0.916), S.lit);

  // ---- the face: brow, eyes, nose, mouth. Nothing here curves.
  for (let yy = Y(0.882); yy <= Y(0.758); yy++) {              // cheeks and jaw
    const t = (baseY - yy) / h;
    const hw = faceW(t);
    pxRect(c, L(hw) - D(0.030), yy, D(0.030), 1, S.mid);
    if (t < 0.800) pxRect(c, L(-hw), yy, D(0.026), 1, S.mid);  // jaw turning away
  }
  box(L(-0.066), Y(0.882), L(0.066), Y(0.866), S.mid);         // forehead in the band's shade
  box(L(-0.062), Y(0.862), L(0.062), Y(0.850), S.lit);         // brow ridge, lit on top
  box(L(-0.062), Y(0.850), L(0.062), Y(0.844), S.dark);        // its hard underside
  for (const sgn of [-1, 1]) {
    box(L(sgn * 0.019), Y(0.842), L(sgn * 0.052), Y(0.828), S.dark);     // socket
    box(L(sgn * 0.023), Y(0.838), L(sgn * 0.048), Y(0.832), S.crack);    // the eye itself
    box(L(sgn * 0.048), Y(0.838), L(sgn * 0.060), Y(0.834), S.dark);     // cosmetic line
    box(L(sgn * 0.023), Y(0.832), L(sgn * 0.048), Y(0.828), S.mid);      // lit lower lid
    box(L(sgn * 0.052), Y(0.826), L(sgn * 0.060), Y(0.800), S.mid);      // cheekbone
  }
  for (let yy = Y(0.848); yy <= Y(0.798); yy++) {              // nose
    const t = (baseY - yy) / h;
    const w = 0.011 + (0.848 - t) * 0.26;
    pxRect(c, L(-w), yy, D(w * 2), 1, S.base);
    pxRect(c, L(-w), yy, D(0.008), 1, S.lit);
    pxRect(c, L(w) - D(0.008), yy, D(0.008), 1, S.dark);
  }
  box(L(-0.026), Y(0.802), L(-0.016), Y(0.796), S.deep);       // nostrils
  box(L(0.016), Y(0.802), L(0.026), Y(0.796), S.deep);
  box(L(-0.030), Y(0.796), L(0.030), Y(0.790), S.mid);         // philtrum
  box(L(-0.042), Y(0.790), L(0.042), Y(0.786), S.lit);         // lit edge of the upper lip
  box(L(-0.042), Y(0.786), L(0.042), Y(0.780), S.crack);       // the mouth, dead straight
  box(L(-0.040), Y(0.780), L(0.040), Y(0.775), S.base);
  box(L(-0.034), Y(0.775), L(0.034), Y(0.770), S.dark);        // shadow under the lower lip

  // ---- false beard, squared off, its tip broken away
  for (let yy = Y(0.760); yy <= Y(0.672); yy++) {
    const t = (baseY - yy) / h;
    const w = 0.024 + (0.760 - t) * 0.16;
    pxRect(c, L(-w), yy, D(w * 2), 1, S.dark);
    pxRect(c, L(-w), yy, D(0.009), 1, S.mid);
    pxRect(c, L(w) - D(0.008), yy, D(0.008), 1, S.deep);
    if ((baseY - yy) % 5 === 0) pxRect(c, L(-w), yy, D(w * 2), 1, S.deep);
  }
  box(L(-0.032), Y(0.678), L(0.014), Y(0.672), S.deep);     // broken off square
  box(L(-0.032), Y(0.672), L(-0.004), Y(0.666), S.crack);

  // ---- weathering: streaks, cracks, pitting
  const rand = rng(20250823);
  for (const [sx, sy, sh2, sw] of [[-0.20, 0.400, 0.19, 0.010], [0.12, 0.400, 0.16, 0.008],
                                   [-0.06, 0.585, 0.08, 0.008], [0.07, 0.585, 0.06, 0.006],
                                   [0.23, 0.455, 0.24, 0.010], [-0.30, 0.455, 0.22, 0.008]]) {
    box(L(sx), Y(sy), L(sx + sw), Y(sy - sh2), S.dark);
  }
  let cx2 = L(-0.24), cy2 = Y(0.560);
  for (let i = 0; i < 14; i++) {                     // a crack across the chest
    pxDot(c, cx2, cy2, S.dark);
    cx2 += 1 + (rand() > 0.7 ? 1 : 0);
    cy2 += rand() > 0.55 ? 1 : (rand() > 0.6 ? -1 : 0);
  }
  cx2 = L(0.20); cy2 = Y(0.430);
  for (let i = 0; i < 30; i++) {
    pxDot(c, cx2, cy2, S.crack);
    cy2 += 1;
    cx2 += rand() > 0.72 ? (rand() > 0.5 ? 1 : -1) : 0;
  }
  for (let i = 0; i < 150; i++) {                    // pitting
    const px = L(-0.34) + Math.floor(rand() * (0.68 * h));
    const py = Y(0.98) + Math.floor(rand() * (0.96 * h));
    pxDot(c, px, py, rand() > 0.55 ? S.mid : S.dark);
  }

  // ---- and then break it: notched out of the silhouette, so the layer's
  // keyline follows chipped stone instead of a clean edge
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const bite = (x0, y0, x1, y1) => box(x0, y0, x1, y1, '#000');
  const wedge = (ax, ay, bx, by, cx3, cy3) => pxTri(c, ax, ay, bx, by, cx3, cy3, '#000');
  wedge(L(-0.104), Y(1.006), L(-0.104), Y(0.952), L(-0.048), Y(1.006));   // crown corner
  bite(L(0.070), Y(1.006), L(0.100), Y(0.986));
  bite(L(0.086), Y(0.986), L(0.100), Y(0.972));
  bite(L(-0.150), Y(0.836), L(-0.132), Y(0.806));                         // lappet edge
  wedge(L(0.160), Y(0.800), L(0.160), Y(0.756), L(0.128), Y(0.756));
  bite(L(0.240), Y(0.734), L(0.258), Y(0.706));                           // shoulder chipped
  bite(L(-0.272), Y(0.660), L(-0.256), Y(0.628));                         // arm edge
  bite(L(0.262), Y(0.556), L(0.278), Y(0.522));                           // fist corner
  wedge(L(-0.300), Y(0.462), L(-0.300), Y(0.408), L(-0.252), Y(0.462));   // knee corner
  bite(L(0.284), Y(0.300), L(0.300), Y(0.252));                           // shin edge
  bite(L(-0.300), Y(0.250), L(-0.286), Y(0.206));
  wedge(L(0.366), Y(0.118), L(0.366), Y(0.052), L(0.296), Y(0.118));      // plinth corner
  bite(L(-0.366), Y(0.072), L(-0.342), Y(0.030));
  c.restore();
}

/* Everyone on the site, placed by where their feet meet the plain. Nobody
   stands on the fighters' own plane -- the dig crew works the middle
   distance, between the colossus and the tents. */
export const PEOPLE = [
  // under the colossus, dwarfed by its plinth
  person(D, 148, 176, { pose: 'point', face: -1, load: null }),
  person(D, 172, 179, { pose: 'shoulder', face: -1, load: 'sack' }),
  // hauling across the open middle of the site
  person(D, 232, 178, { pose: 'carry', face: 1, load: 'jug' }),
  person(D, 209, 181, { pose: 'carry', face: 1, load: 'sack' }),
  // by the colonnade
  person(D, 302, 167, { pose: 'talk', face: 1 }),
  person(D, 322, 165, { pose: 'talk', face: -1 }),
  // the camp, off to the right
  person(D, 398, 194, { pose: 'crossed', face: -1, load: null }),
  person(D, 452, 187, { pose: 'sit', garb: 'robe', load: null }),
];

/** One ruined column, broken off at `frac` of its height. */
function column(m, x, feetY, frac) {
  const s = D.scale(feetY);
  const h = Math.round(8 * METRE * s * frac);
  const w = Math.round(1.0 * METRE * s);
  pxRect(m, x, feetY - h, w, h, '#c6ac74');
  pxRect(m, x, feetY - h, Math.max(2, Math.round(w * 0.26)), h, '#dcc48a');
  pxRect(m, x + w - Math.max(2, Math.round(w * 0.26)), feetY - h, Math.max(2, Math.round(w * 0.26)), h, '#a68b56');
  for (let sy = feetY - h + 8; sy < feetY; sy += 12) pxRect(m, x, sy, w, 1, '#b39a63');
  if (frac >= 1) {
    pxRect(m, x - 2, feetY - h - 4, w + 4, 5, '#d3ba84');       // capital
    pxRect(m, x - 2, feetY - h - 4, w + 4, 1, '#e8d49c');
  } else {
    for (let bx = 0; bx < w; bx += 3) {                          // broken crown
      pxRect(m, x + bx, feetY - h - 1 - (bx * 7) % 4, 3, 3, '#b39a63');
    }
  }
}

/** The desert floor, from the horizon down to the fighters' paving. */
function plain(f) {
  for (let y = HORIZON; y < PGROUND; y++) {
    const t = D.scale(y);
    pxRect(f, 0, y, PW, 1, mixCol('#ddd2ae', '#dfc086', Math.min(1, t * 1.3)));
  }
  // dune crests, packed toward the horizon
  const rand = rng(515);
  for (const s of [0.10, 0.17, 0.27, 0.40, 0.57, 0.78]) {
    const y = Math.round(HORIZON + s * (PGROUND - HORIZON));
    let x = -20 + rand() * 30;
    while (x < PW) {
      const len = (26 + rand() * 60) * (0.4 + s);
      pxRect(f, x, y + Math.round(rand() * 3) - 1, len, 1, 'rgba(120, 90, 44, 0.30)');
      pxRect(f, x + 3, y + Math.round(rand() * 3) - 2, len * 0.5, 1, 'rgba(255, 240, 200, 0.32)');
      x += len + 14 + rand() * 40;
    }
  }
  // the dig: a shallow trench cut into the plain, spoil heaped beside it
  pxRect(f, 196, 196, 110, 8, '#a8834f');
  pxRect(f, 196, 196, 110, 3, '#7d5f36');
  pxEllipse(f, 316, 198, 16, 5, '#cba669');
  pxEllipse(f, 313, 196, 10, 3, '#e8d0a0');
  for (const kx of [200, 234, 268, 300]) {                       // survey stakes
    pxRect(f, kx, 188, 2, 9, '#6d4a2c');
    pxDot(f, kx + 1, 197, '#7d5f36');
    if (kx < 300) {                                              // sagging line
      pxLine(f, kx + 1, 189, kx + 18, 192, 1, '#b89a6a');
      pxLine(f, kx + 18, 192, kx + 35, 189, 1, '#b89a6a');
    }
  }
}

export function paint(c) {
  ditherGradient(c, 0, 0, PW, HORIZON + 2, ['#2f7fb8', '#5fa8ce', '#9ccadc', '#cfe0ec']);
  glow(c, 372, 44, 60, '255, 240, 184', 5, 0.07);
  pxCircle(c, 372, 44, 16, '#fff6d0');
  pxCircle(c, 372, 44, 11, '#ffffff');

  /* ---- far: the plain, and the pyramids leaving the top of the frame ---- */
  c.drawImage(layer((f) => {
    plain(f);
    pyramid(f, 452, HORIZON + 2, 46, 0.55);
    pyramid(f, 330, HORIZON + 3, 108, 0.3);
    pyramid(f, 128, HORIZON + 4, 205, 0.12);
    // heat shimmer where the sand meets the sky
    ditherBand(f, 0, HORIZON, PW, 6, 'rgba(0,0,0,0)', '#e8d9a8', 0.4);
  }), 0, 0);

  /* ---- mid: the colossus, the colonnade, the camp ---- */
  const mid = layer((m) => {
    /* the colossus: six metres of seated stone, its ground line a third of
       the way up the plain -- far enough that the whole figure, face and
       all, sits in the strip of frame the HUD leaves clear */
    colossus(m, 88, 170, 138);
    // sand drifted against the plinth, burying its own ground line
    pxEllipse(m, 52, 171, 26, 4, '#dfc086');
    pxEllipse(m, 124, 172, 30, 4, '#dfc086');
    pxEllipse(m, 88, 173, 40, 4, '#d4b273');

    // ruined colonnade crossing the middle distance
    column(m, 262, 163, 1);
    column(m, 306, 162, 0.62);
    column(m, 350, 161, 1);
    pxRect(m, 258, 163 - Math.round(8 * METRE * D.scale(163)) - 9, 110, 6, '#c0a670');
    pxRect(m, 258, 163 - Math.round(8 * METRE * D.scale(163)) - 9, 110, 1, '#d8c088');

    // the camp: tents at the scale their ground line demands
    for (const [tx, feetY] of [[412, 192], [462, 188]]) {
      const s = D.scale(feetY);
      const th = Math.round(2.6 * METRE * s), tw = Math.round(3.4 * METRE * s);
      pxTri(m, tx - tw / 2, feetY, tx + tw / 2, feetY, tx, feetY - th, '#c85a3c');
      pxTri(m, tx, feetY, tx + tw / 2, feetY, tx, feetY - th, '#96402a');
      for (let sy = 0; sy < th; sy += 8) {
        pxRect(m, tx - (tw / 2) * (1 - sy / th), feetY - sy, tw * (1 - sy / th), 2, '#e8c060');
      }
      pxRect(m, tx - Math.round(tw * 0.09), feetY - Math.round(th * 0.44),
             Math.round(tw * 0.18), Math.round(th * 0.44), '#3a2a1c');
      pxLine(m, tx, feetY - th, tx, feetY - th - 8, 1, '#6d4a2c');
      pxTri(m, tx, feetY - th - 8, tx + 9, feetY - th - 5, tx, feetY - th - 2, '#e8c060');
    }
  });
  {
    // wash the whole middle distance toward the sand haze
    const mc = mid.getContext('2d');
    mc.globalCompositeOperation = 'source-atop';
    mc.fillStyle = 'rgba(236, 214, 160, 0.14)';
    mc.fillRect(0, 0, PW, PH);
    mc.globalCompositeOperation = 'source-over';
  }
  c.drawImage(mid, 0, 0);

  paving(c, ['#e0c184', '#cba669', '#f0d5a2'], '#a8834f', 34);

  /* ---- crowd: the dig crew, out on the plain ---- */
  c.drawImage(crowd(PEOPLE, CROWD, { seed: 3121, haze: 'rgba(236, 214, 160, 0.22)' }), 0, 0);

  /* ---- near: fallen stone in the foreground corners ---- */
  c.drawImage(layer((n) => {
    // toppled column drums, lying across the bottom left
    for (const [dx, dy, r] of [[34, PGROUND + 24, 26], [92, PGROUND + 30, 24]]) {
      pxRect(n, dx, dy - r, 54, r * 2, '#bda36b');
      pxRect(n, dx, dy - r, 54, 5, '#dcc48a');
      pxRect(n, dx, dy + r - 6, 54, 6, '#8f7549');
      pxEllipse(n, dx + 54, dy, Math.round(r * 0.45), r, '#c6ac74');
      pxEllipse(n, dx + 54, dy, Math.round(r * 0.28), Math.round(r * 0.62), '#a68b56');
      pxEllipse(n, dx + 54, dy, Math.round(r * 0.1), Math.round(r * 0.24), '#8f7549');
      for (let gx = dx + 8; gx < dx + 50; gx += 11) {           // flutes
        pxRect(n, gx, dy - r + 5, 2, r * 2 - 11, '#a68b56');
      }
    }
    pxEllipse(n, 60, PGROUND + 34, 70, 8, '#d4b273');           // sand piled round them

    // cut blocks and stores, bottom right
    crate(n, 408, PGROUND - 6, 52, 40, '#c6ac74', '#dcc48a', '#a68b56');
    crate(n, 444, PGROUND + 16, 44, 30, '#bda36b', '#d3ba84', '#8f7549');
    glyphMark(n, 416, PGROUND + 2, 18, 16, '#8f7549', 4);       // carved face showing
    sack(n, 372, PGROUND - 34, 34, 36, '#c8a878', '#e2c79c', '#8f7549', '#8c3226');
    basket(n, 340, PGROUND - 26, 34, 26, '#c8a05c', '#8a6a34', '#d84a3a', '#ff8a6a');

    /* a palm at the frame's right edge: at the fighters' scale a palm is
       taller than the frame, so its crown hangs in at the very top and the
       trunk runs the full height. Curved gently, ringed, thicker at the base. */
    const trunkX = (y) => 448 + Math.round(Math.sin((y + 40) * 0.006) * 6) + Math.round(y * 0.02);
    for (let y = -6; y < PGROUND + 30; y += 2) {
      const tx = trunkX(y);
      const w = 13 + Math.round((y / PH) * 5);
      pxRect(n, tx, y, w, 2, '#7a5a34');
      pxRect(n, tx, y, 4, 2, '#9c7846');
      pxRect(n, tx + w - 3, y, 3, 2, '#5c4326');
      if (y % 8 < 2) pxRect(n, tx - 1, y, w + 2, 1, '#5c4326');   // leaf-scar rings
    }
    // the crown, drooping into the frame from just above it
    const cx0 = trunkX(-6) + 7;
    for (const [dx, dy] of [[-1.9, 0.55], [-1.3, 0.3], [-0.6, 0.14], [0.7, 0.2], [1.5, 0.42], [2.1, 0.75]]) {
      for (let i = 0; i < 20; i++) {
        const px = cx0 + dx * i * 2.2;
        const py = -8 + dy * i * 2.2 + i * i * 0.09;
        pxRect(n, px, py, 5, 4, i > 11 ? '#356028' : '#4f8a3c');
        if (i > 4 && i % 2) pxRect(n, px + 1, py + 3, 3, 2, '#356028');
      }
    }
    // dates hanging under the crown
    pxEllipse(n, cx0 - 8, 12, 5, 7, '#a8632c');
    pxEllipse(n, cx0 - 10, 10, 3, 4, '#c87d3a');
  }), 0, 0);

  const rand = rng(991);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * PW);
    const y = PGROUND + 3 + Math.floor(rand() * (PH - PGROUND - 4));
    pxDot(c, x, y, rand() > 0.5 ? '#f2dcac' : '#a8834f');
  }
}

/* Birds riding the thermals over the site. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.x += 0.16 * d.k;
    if (d.x > PW + 8) d.x = -8;
    const y = d.y * 0.22 + 18 + Math.sin(frame * 0.03 + d.w) * 3;
    const flap = Math.sin(frame * 0.13 + d.w) > 0 ? 1 : -1;
    pxDot(c, d.x, y, '#2c3a4a');
    pxDot(c, d.x - 3, y - flap, '#2c3a4a');
    pxDot(c, d.x + 3, y - flap, '#2c3a4a');
    pxDot(c, d.x - 2, y - flap, '#2c3a4a');
    pxDot(c, d.x + 2, y - flap, '#2c3a4a');
  }
}

export const stage = { key: 'pyramids', name: 'PYRAMIDS', drift: 'birds', paint, overlay };
