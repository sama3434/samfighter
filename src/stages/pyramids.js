import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse } from '../pixel/draw.js';
import { ditherGradient, ditherDisc, ditherBand } from '../pixel/dither.js';
import { layer, glow, signBoard, banner, crate, barrel, basket, sack,
         crowd, paving, glyphMark } from './props.js';
import { palmTree, rng } from './scenery.js';

/* An open excavation site under the pyramids.

   Deliberately the opposite shape to the market street: no buildings framing
   the sides, a low horizon, and enormous silhouettes doing the work instead.
   Scale is the whole point here -- the pyramids run off the top of the frame
   and the colossus is taller than the fighters by half again. */

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

/** A pyramid big enough to leave the frame. */
function pyramid(c, px, baseY, halfW, h) {
  pxTri(c, px - halfW, baseY, px + halfW, baseY, px, baseY - h, '#c9a05e');
  pxTri(c, px, baseY, px + halfW, baseY, px, baseY - h, '#9d7440');
  for (let i = 6; i < h; i += 7) {
    const w = Math.round(halfW * (1 - i / h));
    pxRect(c, px - w, baseY - i, w * 2, 1, 'rgba(92,62,30,0.26)');
  }
  pxLine(c, px, baseY - h, px, baseY, 1, '#876636');
  pxTri(c, px - halfW - 20, baseY, px - halfW + 14, baseY, px - halfW, baseY - 10, '#dfbe80');
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

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#2f7fb8', '#5fa8ce', '#9ccadc', '#d8cfa4', '#ecc98a']);
  glow(c, 372, 44, 60, '255, 240, 184', 5, 0.07);
  pxCircle(c, 372, 44, 16, '#fff6d0');
  pxCircle(c, 372, 44, 11, '#ffffff');

  /* ---- far: the pyramids, running off the top of the frame ---- */
  c.drawImage(layer((f) => {
    pyramid(f, 118, PGROUND - 24, 132, 172);
    pyramid(f, 322, PGROUND - 18, 96, 116);
    pyramid(f, 438, PGROUND - 14, 62, 70);
    ditherBand(f, 0, PGROUND - 34, PW, 12, 'rgba(0,0,0,0)', '#e8d9a8', 0.4);   // heat haze
  }), 0, 0);

  /* ---- mid: the colossus, the colonnade, the tents ---- */
  c.drawImage(layer((m) => {
    colossus(m, 66, PGROUND - 2, 170);

    // a run of columns crossing behind the fight, deliberately low contrast
    for (let i = 0; i < 7; i++) {
      const cx = 168 + i * 27;
      const hh = 52 - (i % 3) * 6;
      pxRect(m, cx, PGROUND - hh, 15, hh, '#c6ac74');
      pxRect(m, cx, PGROUND - hh, 4, hh, '#dcc48a');
      pxRect(m, cx + 11, PGROUND - hh, 4, hh, '#a68b56');
      for (let s = 1; s < 5; s++) pxRect(m, cx, PGROUND - hh + s * 11, 15, 1, '#b39a63');
      pxRect(m, cx - 2, PGROUND - hh - 5, 19, 5, '#d3ba84');
      if (i < 5) pxRect(m, cx - 2, PGROUND - hh - 10, 46, 5, '#c0a670');    // lintel
    }

    // caravan tents on the right
    for (const [tx, tw, th] of [[392, 46, 52], [444, 38, 42]]) {
      pxTri(m, tx - tw / 2, PGROUND, tx + tw / 2, PGROUND, tx, PGROUND - th, '#c85a3c');
      pxTri(m, tx, PGROUND, tx + tw / 2, PGROUND, tx, PGROUND - th, '#96402a');
      for (let s = 0; s < th; s += 8) {
        pxRect(m, tx - (tw / 2) * (1 - s / th), PGROUND - s, tw * (1 - s / th), 2, '#e8c060');
      }
      pxRect(m, tx - 6, PGROUND - 20, 12, 20, '#3a2a1c');
      pxLine(m, tx, PGROUND - th, tx, PGROUND - th - 8, 1, '#6d4a2c');
      pxTri(m, tx, PGROUND - th - 8, tx + 10, PGROUND - th - 5, tx, PGROUND - th - 2, '#e8c060');
    }
  }), 0, 0);

  paving(c, ['#e0c184', '#cba669', '#f0d5a2'], '#a8834f', 34);

  /* ---- crowd: watching from the plinth and the tents ---- */
  c.drawImage(crowd([
    { x: 132, y: PGROUND - 16, h: 38, face: 1, pose: 'shoulder', load: 'sack' },
    { x: 152, y: PGROUND - 14, h: 36, face: 1, pose: 'point', load: null },
    { x: 366, y: PGROUND - 2, h: 46, face: -1, pose: 'crossed', load: null },
    { x: 414, y: PGROUND - 2, h: 44, face: -1, pose: 'cheer', load: null },
    { x: 266, y: PGROUND - 8, h: 32, face: -1, pose: 'talk' },
    { x: 240, y: PGROUND - 8, h: 31, face: 1, pose: 'talk' },
    { x: 218, y: PGROUND - 8, h: 31, face: 1, pose: 'carry', load: 'jug' },
    { x: 460, y: PGROUND - 4, h: 42, face: -1, pose: 'sit', load: null, garb: 'robe' },
  ], CROWD, { seed: 3121, haze: 'rgba(236, 214, 160, 0.20)' }), 0, 0);

  /* ---- near: fallen stone in the foreground corners ---- */
  c.drawImage(layer((n) => {
    // toppled column, lying across the bottom left
    for (let i = 0; i < 4; i++) {
      pxEllipse(n, 16 + i * 19, PGROUND + 16, 10, 7, '#c6ac74');
      pxEllipse(n, 13 + i * 19, PGROUND + 15, 6, 5, '#dcc48a');
      pxRect(n, 8 + i * 19, PGROUND + 9, 17, 14, '#bda36b');
      pxRect(n, 8 + i * 19, PGROUND + 9, 17, 2, '#dcc48a');
    }
    // broken blocks bottom right
    crate(n, 424, PGROUND + 8, 26, 18, '#c6ac74', '#dcc48a', '#a68b56');
    crate(n, 452, PGROUND + 14, 22, 14, '#bda36b', '#d3ba84', '#8f7549');
    sack(n, 356, PGROUND - 18, 20, 18, '#c8a878', '#e2c79c', '#8f7549', '#8c3226');
    basket(n, 380, PGROUND - 13, 22, 13, '#c8a05c', '#8a6a34', '#d84a3a', '#ff8a6a');
    barrel(n, 468, PGROUND - 22, 16, 22, '#7a5230', '#9c6c42', '#4e3220', '#5b5b66');

    // dig-site markers and a standard planted in the sand
    pxRect(n, 300, PGROUND - 58, 3, 58, '#6d4a2c');
    banner(n, 288, PGROUND - 58, 16, 34, '#3f6f8c', '#e8c060', '#f6efdc');
    signBoard(n, 148, PGROUND - 40, 34, 16, '#e8c060', '#8a4a1f', '#3b1f18', 2);
    pxRect(n, 163, PGROUND - 24, 3, 24, '#6d4a2c');

    palmTree(n, 348, PGROUND - 2, 54, '#7a5a34', '#4f8a3c', '#356028');
    palmTree(n, 466, PGROUND - 2, 40, '#7a5a34', '#4f8a3c', '#356028');
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
