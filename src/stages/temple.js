import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse } from '../pixel/draw.js';
import { ditherGradient } from '../pixel/dither.js';
import { layer, glow, block, awning, lantern, signBoard, banner, glyphMark,
         crate, barrel, basket, sack, hangingRow, crowd, paving,
         makeDepth, person, METRE, mixCol, shade } from './props.js';
import { pagodaRoof, rng } from './scenery.js';

/* A market street at dusk, the shrine at the end of it.

   Still the arcade shape -- shopfronts pressing in from both sides, a gap
   down the middle that recedes to a landmark -- but drawn at the fighters'
   scale. A storey is nearly two hundred pixels here, so the buildings do not
   fit the frame: what shows of each is its open ground floor, the awning over
   it, and a strip of wall and signage before the frame cuts it off. The
   street itself recedes properly: the floor climbs to the horizon line, the
   torii and the row houses shrink with it, and everyone in the crowd stands
   on the depth plane their size implies. */

const PAL = {
  wall: '#6b4a3c', wallHi: '#8a6450', wallLo: '#412a22',
  trim: '#a83a34', trimHi: '#c85a4e',
  far: '#5a4268', farLo: '#3d2c4f',
};

export const DEPTH = makeDepth(130);
const D = DEPTH;

const VPX = 240;                 // vanishing point of the street
const HALF_STREET = 90;          // half the street width at the fighters' plane
const xL = (y) => Math.round(VPX - HALF_STREET * D.scale(y));
const xR = (y) => Math.round(VPX + HALF_STREET * D.scale(y));

/* The wardrobe the street's crowd is drawn from: dusk-muted cloth, a warm
   key light off the stalls, and the headgear a market at closing time would
   actually have in it. */
const CROWD = {
  cloth: ['#4a5a8c', '#7a4a6b', '#3f7a5e', '#8c6a3a', '#5c4a7a', '#8a4438',
          '#3f6f8c', '#6b6154', '#a8763a', '#42546b'],
  alt:   ['#4a4458', '#5c4d3a', '#3e4762', '#6a5442', '#414f5c'],
  trim:  ['#e8c060', '#f0e0c8', '#c8443a', '#2f7a5e', '#d8cbb0'],
  hats:  ['#c8443a', '#e8c060', '#3b2f28', '#d8cbb0', '#2f5f9c', '#8a6a3a'],
  light: '#ffbf7a',
  shoe:  '#231d33',
  heads: ['bare', 'short', 'short', 'long', 'tail', 'bun', 'cone', 'wrap',
          'brim', 'cap', 'hood', 'bald'],
};

/* Everyone in the stage, placed by where their feet meet the ground and sized
   by the depth system. The two vendors stand on the fighters' own plane, so
   they are fighter-sized -- and behind their counters, so only their upper
   bodies show. Everyone else is out in the middle distance of the street. */
export const VENDORS = [
  person(D, 62, 227, { pose: 'talk', face: 1, garb: 'apron', head: 'wrap', load: null,
                       cloth: '#8a4438' }),
  person(D, 352, 228, { pose: 'lean', face: 1, garb: 'apron', head: 'cap', load: null,
                        cloth: '#3f6f8c' }),
];
export const STREET_CROWD = [
  // far, near the shrine steps
  person(D, 220, 172, { pose: 'talk', face: 1 }),
  person(D, 255, 170, { pose: 'talk', face: -1 }),
  person(D, 266, 174, { pose: 'stand', load: 'basket' }),
  // middle distance, keeping to the sides of the street
  person(D, 207, 186, { pose: 'carry', face: -1, load: 'sack' }),
  person(D, 275, 184, { pose: 'wave', face: 1 }),
  // just past the torii, against the row houses
  person(D, 199, 197, { pose: 'crossed', face: 1 }),
  person(D, 284, 195, { pose: 'point', face: -1 }),
];
export const PEOPLE = [...VENDORS, ...STREET_CROWD];

/** The street floor climbing from the fighters' plane to the horizon. */
function streetFloor(f) {
  const seam = '#453e33';
  for (let y = 156; y < PGROUND; y++) {
    const t = D.scale(y);
    const base = mixCol('#5c5364', '#8a7f6c', t);
    pxRect(f, xL(y) - 6, y, xR(y) - xL(y) + 12, 1, base);
  }
  // courses: horizontal joints packed toward the horizon
  for (const s of [0.26, 0.33, 0.42, 0.53, 0.66, 0.82]) {
    const y = Math.round(130 + s * 105);
    pxRect(f, xL(y) - 6, y, xR(y) - xL(y) + 12, 1, seam);
  }
  // seams converging on the vanishing point
  for (let i = -3; i <= 3; i++) {
    const x0 = VPX + i * 26;                       // position at the near plane
    for (let y = 166; y < PGROUND; y++) {
      const x = Math.round(VPX + (x0 - VPX) * D.scale(y));
      if (x > xL(y) - 6 && x < xR(y) + 6 && (y + i) % 2) pxDot(f, x, y, seam);
    }
  }
}

/** One receding row-house face, its base on the street floor at `feetY`. */
function rowHouse(f, side, x0, x1, feetY) {
  const s = D.scale(feetY);
  const w = x1 - x0;
  pxRect(f, x0, 0, w, feetY, side < 0 ? '#5d4136' : '#523a34');
  pxRect(f, side < 0 ? x1 - 2 : x0, 0, 2, feetY, '#38251f');
  // open ground floor with a warm interior
  const doorH = Math.round(2.4 * METRE * s);
  const dx = x0 + Math.round(w * 0.22), dw = Math.max(6, Math.round(w * 0.5));
  pxRect(f, dx, feetY - doorH, dw, doorH, '#241a20');
  glow(f, dx + dw / 2, feetY - doorH * 0.4, doorH * 0.9, '224, 150, 70', 3, 0.09);
  pxRect(f, dx + 1, feetY - doorH + 1, dw - 2, doorH - 1, 'rgba(240, 180, 92, 0.25)');
  // awning strip over the front
  const ay = feetY - Math.round(2.7 * METRE * s);
  awning(f, x0 - 2, ay, w + 4, Math.max(4, Math.round(9 * s)),
         side < 0 ? '#a83a34' : '#2f6a52', '#d8cbb0', side < 0 ? '#6f211f' : '#1d4f3c');
  // the storey above: a shuttered window and a small sign
  const ledge = feetY - Math.round(3 * METRE * s);
  pxRect(f, x0, ledge - 2, w, 3, PAL.trim);
  const wh = Math.round(1.1 * METRE * s), ww = Math.max(5, Math.round(w * 0.34));
  const wx = x0 + Math.round(w * 0.3);
  const wy = ledge - Math.round(1.0 * METRE * s) - wh;
  pxRect(f, wx - 1, wy - 1, ww + 2, wh + 2, PAL.wallLo);
  pxRect(f, wx, wy, ww, wh, '#f2c070');
  pxRect(f, wx + ww / 2, wy, 1, wh, PAL.wallLo);
  if (wy > 8) {
    signBoard(f, x0 + Math.round(w * 0.1), wy - 14, Math.max(10, Math.round(w * 0.55)),
              Math.max(6, Math.round(10 * s)), '#e8c060', '#8e2c28', '#3b1f18', 2);
  }
}

/** The shrine closing the end of the street. */
function shrine(f) {
  const s = D.scale(158);                          // its plaza is 158
  const cx = VPX, base = 158;
  const M = (m) => Math.round(m * METRE * s);
  // stone platform and steps
  pxRect(f, cx - 62, base, 124, 4, '#6e6455');
  pxRect(f, cx - 62, base, 124, 1, '#8a7f6c');
  pxRect(f, cx - 56, base + 4, 112, 3, '#5c5348');
  pxRect(f, cx - 50, base + 7, 100, 3, '#4d453c');
  // ground storey
  const gh = M(3.4), gw = M(7.6);
  pxRect(f, cx - gw / 2, base - gh, gw, gh, '#6b3040');
  pxRect(f, cx - gw / 2, base - gh, 4, gh, '#8a4055');
  pxRect(f, cx + gw / 2 - 4, base - gh, 4, gh, '#4d2030');
  // door and flanking lattice windows, sized like doors and windows
  const dh = M(2.2), dw = M(1.4);
  pxRect(f, cx - dw / 2 - 1, base - dh - 1, dw + 2, dh + 1, '#2b1220');
  pxRect(f, cx - dw / 2, base - dh, dw, dh, '#f2c070');
  pxRect(f, cx - 1, base - dh, 2, dh, '#2b1220');
  for (const wx of [-M(2.6), M(2.6)]) {
    pxRect(f, cx + wx - M(0.7), base - M(2.4), M(1.4), M(1.2), '#2b1220');
    pxRect(f, cx + wx - M(0.6), base - M(2.3), M(1.2), M(1.0), '#c88b4a');
    for (let i = 1; i < 4; i++) pxRect(f, cx + wx - M(0.6) + i * M(0.3), base - M(2.3), 1, M(1.0), '#2b1220');
  }
  pagodaRoof(f, cx, base - gh, Math.round(gw * 0.62), M(1.1), '#b34450', '#7d2b38', '#8f333f');
  // upper storey and its roof
  const uh = M(2.0), uw = M(4.6);
  pxRect(f, cx - uw / 2, base - gh - M(1.1) - uh, uw, uh + 2, '#5e2739');
  pxRect(f, cx - M(0.6), base - gh - M(1.1) - uh + M(0.5), M(1.2), M(1.1), '#f0b45c');
  pagodaRoof(f, cx, base - gh - M(1.1) - uh, Math.round(uw * 0.68), M(1.0),
             '#b34450', '#7d2b38', '#8f333f');
  pxRect(f, cx - 1, base - gh - M(2.1) - uh - M(1.0), 3, M(0.9), '#e0a850');
  // stone lanterns flanking the steps, warm at dusk
  for (const lx of [cx - 46, cx + 46]) {
    pxRect(f, lx - 2, base - M(1.0), 4, M(1.0), '#6e6455');
    pxRect(f, lx - 4, base - M(1.5), 8, M(0.5), '#8a7f6c');
    pxRect(f, lx - 3, base - M(1.4), 6, M(0.35), '#ffce7a');
    glow(f, lx, base - M(1.25), M(1.1), '255, 190, 110', 3, 0.09);
    pxRect(f, lx - 5, base - M(1.65), 10, 2, '#5c5348');
  }
}

/** The torii straddling the street in the middle distance. */
function torii(f) {
  const feet = 200, s = D.scale(feet);
  const M = (m) => Math.round(m * METRE * s);
  const h = M(4.2), postW = M(0.4);
  const span = HALF_STREET * s * 0.9;
  for (const sx of [-1, 1]) {
    const px = Math.round(VPX + sx * span) - postW / 2;
    pxRect(f, px, feet - h, postW, h, '#8e2c28');
    pxRect(f, px, feet - h, 2, h, '#b84a40');
    pxRect(f, px - 2, feet - 3, postW + 4, 3, '#5c5348');   // stone footing
  }
  const beamY = feet - h;
  pxRect(f, Math.round(VPX - span - M(0.9)), beamY - M(0.35), Math.round(span * 2 + M(1.8)), M(0.35), '#a83a34');
  pxRect(f, Math.round(VPX - span - M(1.2)), beamY - M(0.8), Math.round(span * 2 + M(2.4)), M(0.45), '#6f211f');
  pxRect(f, Math.round(VPX - span - M(1.2)), beamY - M(0.8), Math.round(span * 2 + M(2.4)), 2, '#2b1220');
  pxRect(f, VPX - M(0.5), beamY - M(0.42), M(1.0), M(0.42), '#e8c060');  // tablet
}

/** One big shopfront: the visible slice of a building taller than the frame. */
function shopfront(m, side) {
  // side < 0 is the left building (open food stall), side > 0 the right
  const x0 = side < 0 ? -4 : 330;
  const x1 = side < 0 ? 150 : PW + 4;
  const w = x1 - x0;
  const FLOOR2 = PGROUND - Math.round(3 * METRE);       // 192px per storey: y 43
  const OPEN_TOP = PGROUND - Math.round(2.5 * METRE);   // shopfront opening: y 75

  // the wall itself, plus a strip of second storey running off the top
  pxRect(m, x0, 0, w, PGROUND, PAL.wall);
  pxRect(m, x0, 0, w, PGROUND, 'rgba(30, 16, 34, 0.18)');
  // timber frame: posts and the heavy beam over the opening
  pxRect(m, x0, FLOOR2 - 6, w, 8, '#3b2a26');
  pxRect(m, x0, FLOOR2 - 6, w, 2, '#543b33');
  for (const px of side < 0 ? [x0 + 8, x1 - 14] : [x0 + 6, x1 - 12]) {
    pxRect(m, px, 0, 8, PGROUND, '#4d332b');
    pxRect(m, px, 0, 2, PGROUND, '#6b463a');
  }
  pxRect(m, x0, OPEN_TOP - 10, w, 12, '#3b2a26');
  pxRect(m, x0, OPEN_TOP - 10, w, 3, '#543b33');
  pxRect(m, x0, OPEN_TOP + 2, w, 2, '#241813');

  // the open ground floor: a dark interior with warm light and a counter
  const ix0 = x0 + (side < 0 ? 8 : 10), ix1 = x1 - (side < 0 ? 10 : 8);
  pxRect(m, ix0, OPEN_TOP, ix1 - ix0, PGROUND - OPEN_TOP, '#241a20');
  pxRect(m, ix0, OPEN_TOP, ix1 - ix0, 4, '#120c14');
  glow(m, (ix0 + ix1) / 2, PGROUND - 52, 74, '224, 150, 70', 5, 0.08);
  // back shelves in the gloom
  for (let sy = OPEN_TOP + 22; sy < PGROUND - 66; sy += 24) {
    pxRect(m, ix0 + 6, sy, ix1 - ix0 - 12, 3, '#3b2a26');
    for (let jx = ix0 + 10; jx < ix1 - 14; jx += 13) {
      pxRect(m, jx, sy - 8, 8, 8, jx % 3 ? '#6e4a2e' : '#8a5a34');
    }
  }
  // counter: 0.9m of it, so a vendor behind it shows from the waist up
  const cTop = PGROUND - Math.round(0.9 * METRE);
  block(m, ix0, cTop, ix1 - ix0, PGROUND - cTop, '#7a5230', '#9c6c42', '#4e3220');
  pxRect(m, ix0, cTop, ix1 - ix0, 3, '#b98a52');
  if (side < 0) {
    // food stall: stove and steam pans on the counter
    block(m, ix0 + 84, cTop - 24, 46, 24, '#4b4b57', '#6b6b7a', '#2e2e38');
    for (const sx of [ix0 + 94, ix0 + 114]) {
      pxCircle(m, sx, cTop - 25, 7, '#2a2a33');
      pxCircle(m, sx, cTop - 26, 6, '#8e8ea0');
      pxCircle(m, sx, cTop - 26, 4, '#5a5a68');
    }
    for (const bx of [ix0 + 14, ix0 + 34, ix0 + 54]) {     // bowls stacked
      pxEllipse(m, bx, cTop - 3, 8, 3, '#c8a05c');
      pxEllipse(m, bx, cTop - 6, 7, 3, '#e0bc74');
    }
  } else {
    // produce shop: tiered display spilling toward the street
    for (let t = 0; t < 2; t++) {
      const sy = cTop - 2 - t * 16;
      for (let bx = ix0 + 44 + t * 8; bx < ix1 - 24; bx += 30) {
        basket(m, bx, sy - 12, 26, 12, '#c8a05c', '#8a6a34',
               t ? '#4f8a3c' : '#d84a3a', t ? '#7fc45c' : '#ff8a6a');
      }
    }
  }
}

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#1b1038', '#3a1b4e', '#782f55', '#c05a46', '#e8956a']);

  /* ---- far: the street receding to the shrine ---- */
  c.drawImage(layer((f) => {
    streetFloor(f);
    shrine(f);
    rowHouse(f, -1, 150, 188, 189);
    rowHouse(f, -1, 188, 209, 171);
    rowHouse(f, 1, 292, 330, 189);
    rowHouse(f, 1, 271, 292, 171);
    torii(f);
  }), 0, 0);

  paving(c, ['#8a7f6c', '#6e6455', '#b0a48c'], '#453e33', 26);

  /* ---- vendors, drawn before the counters so the counters hide their legs ---- */
  c.drawImage(crowd(VENDORS, CROWD, { seed: 12, haze: 'rgba(46,24,52,0.16)' }), 0, 0);

  /* ---- mid: the two shopfronts framing the street ---- */
  c.drawImage(layer((m) => {
    shopfront(m, -1);
    shopfront(m, 1);
  }), 0, 0);

  /* ---- crowd: the street has people in it, all in the middle distance ---- */
  c.drawImage(crowd(STREET_CROWD, CROWD, { seed: 771, haze: 'rgba(46,24,52,0.24)' }), 0, 0);

  /* ---- near: everything hanging, stacked and leaning ---- */
  c.drawImage(layer((n) => {
    // cured meat hanging under the left stall's beam
    hangingRow(n, 16, PGROUND - 152, 6, 17, 30, '#8c3226', '#c4503a', '#3b2a26');

    // awnings over both fronts, at door-lintel height
    awning(n, -4, PGROUND - 172, 158, 22, '#c8443a', '#f0e0c8', '#8e2c28');
    awning(n, 326, PGROUND - 168, PW - 322, 22, '#2f7a5e', '#f0e0c8', '#1d4f3c');

    // string of lanterns across the whole street
    pxLine(n, 0, 24, PW, 40, 1, '#2b2118');
    for (let i = 0; i < 7; i++) {
      const lx = 30 + i * 70;
      lantern(n, lx, 42 + Math.round(i * 1.7), 12, '#d8382c', '#8e1f18', '#e8c060');
    }

    // signage: cloth banners dropping in from above the frame, board signs
    // hanging off the awnings. All of it stays above the fighters' band.
    banner(n, 10, -8, 34, 116, '#c8443a', '#e8c060', '#f6efdc');
    banner(n, 100, -8, 30, 100, '#2f5f9c', '#e8c060', '#f6efdc');
    banner(n, 348, -8, 34, 108, '#5c3f8c', '#e8c060', '#f6efdc');
    banner(n, 440, -8, 30, 118, '#c8443a', '#e8c060', '#f6efdc');
    for (const [sx, sy, sw] of [[52, 74, 74], [354, 78, 78]]) {
      pxLine(n, sx + 6, sy - 12, sx + 6, sy, 1, '#2b2118');
      pxLine(n, sx + sw - 6, sy - 12, sx + sw - 6, sy, 1, '#2b2118');
      signBoard(n, sx, sy, sw, 30, '#e8c060', '#8e2c28', '#3b1f18', 3);
    }

    // ground clutter at the frame edges, crate-and-barrel sized
    crate(n, 2, PGROUND - 44, 46, 44, '#8a6032', '#ab7c45', '#573a1e');
    crate(n, 8, PGROUND - 76, 36, 32, '#8a6032', '#ab7c45', '#573a1e');
    basket(n, 52, PGROUND - 30, 36, 30, '#c8a05c', '#8a6a34', '#d84a3a', '#ff8a6a');
    barrel(n, 104, PGROUND - 58, 38, 58, '#7a5230', '#9c6c42', '#4e3220', '#5b5b66');

    basket(n, 336, PGROUND - 30, 42, 30, '#c8a05c', '#8a6a34', '#4f8a3c', '#7fc45c');
    basket(n, 382, PGROUND - 26, 38, 26, '#c8a05c', '#8a6a34', '#e8a83c', '#ffd06a');
    sack(n, 424, PGROUND - 42, 36, 42, '#b89a6a', '#d6b98a', '#7d6444', '#8c3226');
    crate(n, 452, PGROUND - 34, 40, 34, '#8a6032', '#ab7c45', '#573a1e');
  }), 0, 0);

  // scattered litter so the paving is not a blank slab
  const rand = rng(4242);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * PW);
    const y = PGROUND + 3 + Math.floor(rand() * (PH - PGROUND - 4));
    pxDot(c, x, y, rand() > 0.5 ? '#9c9078' : '#57503f');
  }
  void pxTri; void shade;
}

/* Petals drifting through on the evening air. */
export function overlay(c, frame, drifters) {
  for (const d of drifters) {
    d.y += d.s * 0.5;
    d.x -= 0.35 + Math.sin(frame * 0.03 + d.w) * 0.5;
    if (d.y > PGROUND) { d.y = -2; d.x = Math.random() * PW; }
    if (d.x < -2) d.x = PW + 2;
    pxDot(c, d.x, d.y, d.s > 0.7 ? '#f7a8c4' : '#d9628c');
  }
}

export const stage = { key: 'temple', name: 'TEMPLE', drift: 'petals', paint, overlay };
