import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri } from '../pixel/draw.js';
import { ditherGradient, ditherDisc } from '../pixel/dither.js';
import { layer, glow, block, facade, awning, lantern, signBoard, banner,
         crate, barrel, basket, sack, hangingRow, crowd, paving, alleyDepth } from './props.js';
import { pagodaRoof, rng } from './scenery.js';

/* A market street at dusk, the shrine at the end of it.

   Built the way the arcade stages were: a heavy block of shopfront on each
   side, a gap down the middle that recedes toward a landmark, clutter stacked
   at ground level, and signage filling everything above head height. The band
   the fighters actually occupy is kept darker and calmer than the rest so the
   action still reads. */

const PAL = {
  wall: '#6b4a3c', wallHi: '#8a6450', wallLo: '#412a22',
  trim: '#a83a34', trimHi: '#c85a4e',
  far: '#5a4268', farLo: '#3d2c4f',
};

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

const LEFT_W = 152;
const RIGHT_X = 330;
const GAP_X = LEFT_W, GAP_W = RIGHT_X - LEFT_W;

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#1b1038', '#3a1b4e', '#782f55', '#c05a46', '#e8956a']);

  ditherDisc(c, 240, 74, 30, '#ffd9b0', 0.55);
  pxCircle(c, 240, 74, 15, '#ffeccc');
  pxCircle(c, 236, 70, 4, '#f0d8b4');

  /* ---- far: the street receding to the shrine ---- */
  c.drawImage(layer((f) => {
    alleyDepth(f, GAP_X, GAP_W, 96, PAL);

    // shrine at the end of the street
    const cx = 240, base = PGROUND - 6;
    pxRect(f, cx - 30, base - 40, 60, 40, '#6b3040');
    pxRect(f, cx - 30, base - 40, 4, 40, '#8a4055');
    for (const wx of [-22, 8]) {
      pxRect(f, cx + wx, base - 34, 14, 16, '#2b1220');
      pxRect(f, cx + wx + 1, base - 33, 12, 14, '#f0b45c');
    }
    pxRect(f, cx - 7, base - 24, 14, 24, '#2b1220');
    pxRect(f, cx - 5, base - 22, 10, 22, '#f2c070');
    pagodaRoof(f, cx, base - 40, 40, 10, '#b34450', '#7d2b38', '#8f333f');
    pxRect(f, cx - 20, base - 66, 40, 18, '#5e2739');
    pxRect(f, cx - 5, base - 62, 10, 10, '#f0b45c');
    pagodaRoof(f, cx, base - 66, 30, 9, '#b34450', '#7d2b38', '#8f333f');
    pxRect(f, cx - 1, base - 82, 3, 10, '#e0a850');

    // torii straddling the street, small with distance
    pxRect(f, 186, PGROUND - 46, 4, 46, '#8e2c28');
    pxRect(f, 292, PGROUND - 46, 4, 46, '#8e2c28');
    pxRect(f, 180, PGROUND - 52, 118, 4, '#a83a34');
    pxRect(f, 178, PGROUND - 57, 122, 3, '#6f211f');
  }), 0, 0);

  paving(c, ['#8a7f6c', '#6e6455', '#b0a48c'], '#453e33', 26);

  /* ---- vendors, drawn before the counters so the counters hide their legs ---- */
  c.drawImage(crowd([
    { x: 60, y: PGROUND - 2, h: 50, pose: 'talk', face: 1, garb: 'apron', head: 'wrap', load: null },
    { x: 396, y: PGROUND - 2, h: 50, pose: 'lean', face: -1, garb: 'vest', head: 'cap', load: null },
  ], CROWD, { seed: 12, haze: 'rgba(46,24,52,0.16)' }), 0, 0);

  /* ---- mid: the two shopfronts framing the street ---- */
  c.drawImage(layer((m) => {
    // LEFT — a food stall, open to the street
    facade(m, -4, -10, LEFT_W + 4, PGROUND - 74, PAL, { storey: 36, glow: '#f2c070' });
    block(m, -4, PGROUND - 76, LEFT_W + 4, 20, '#3b2a26', '#543b33', '#241813');
    pxRect(m, 0, PGROUND - 58, LEFT_W - 4, 58, '#241a20');          // shop interior
    pxRect(m, 0, PGROUND - 58, LEFT_W - 4, 3, '#120c14');
    glow(m, 74, PGROUND - 34, 62, '224, 150, 70');            // warm interior light
    block(m, 8, PGROUND - 26, 124, 26, '#7a5230', '#9c6c42', '#4e3220');  // counter
    pxRect(m, 8, PGROUND - 26, 124, 3, '#b98a52');
    // stove and steam pans
    block(m, 96, PGROUND - 44, 34, 18, '#4b4b57', '#6b6b7a', '#2e2e38');
    for (const sx of [102, 116]) {
      pxCircle(m, sx, PGROUND - 45, 5, '#2a2a33');
      pxCircle(m, sx, PGROUND - 46, 4, '#8e8ea0');
    }

    // RIGHT — a produce shop under a deep awning
    facade(m, RIGHT_X, -14, PW - RIGHT_X + 4, PGROUND - 70, PAL, { storey: 34, shutters: true });
    block(m, RIGHT_X - 4, PGROUND - 72, PW - RIGHT_X + 8, 18, '#3b2a26', '#543b33', '#241813');
    pxRect(m, RIGHT_X + 2, PGROUND - 54, PW - RIGHT_X, 54, '#241a20');
    glow(m, 410, PGROUND - 32, 58, '224, 150, 70');
    block(m, RIGHT_X + 6, PGROUND - 22, 130, 22, '#7a5230', '#9c6c42', '#4e3220');
    pxRect(m, RIGHT_X + 6, PGROUND - 22, 130, 3, '#b98a52');
  }), 0, 0);

  /* ---- crowd: the street has people in it ---- */
  c.drawImage(crowd([
    // far, small, in the depth of the street
    { x: 206, y: PGROUND - 12, h: 30, face: 1, pose: 'talk' },
    { x: 224, y: PGROUND - 10, h: 32, face: -1, pose: 'stand' },
    { x: 268, y: PGROUND - 11, h: 31, face: -1, pose: 'carry', load: 'sack' },
    { x: 246, y: PGROUND - 13, h: 28, face: 1, pose: 'stand', load: 'basket' },
    // mid depth, flanking the fight
    { x: 166, y: PGROUND - 2, h: 44, face: 1, pose: 'crossed' },
    { x: 314, y: PGROUND - 2, h: 45, face: -1, pose: 'point' },
    { x: 440, y: PGROUND - 2, h: 48, face: -1, pose: 'cheer' },
    { x: 464, y: PGROUND - 4, h: 42, face: -1, pose: 'wave' },
  ], CROWD, { seed: 771, haze: 'rgba(46,24,52,0.22)' }), 0, 0);

  /* ---- near: everything hanging, stacked and leaning ---- */
  c.drawImage(layer((n) => {
    // cured meat over the left counter
    hangingRow(n, 18, PGROUND - 58, 6, 15, 20, '#8c3226', '#c4503a', '#3b2a26');

    // awnings
    awning(n, -4, PGROUND - 78, LEFT_W + 8, 16, '#c8443a', '#f0e0c8', '#8e2c28');
    awning(n, RIGHT_X - 6, PGROUND - 74, PW - RIGHT_X + 12, 16, '#2f7a5e', '#f0e0c8', '#1d4f3c');

    // string of lanterns across the whole street
    pxLine(n, 0, 30, PW, 44, 1, '#2b2118');
    for (let i = 0; i < 8; i++) {
      const lx = 22 + i * 62;
      lantern(n, lx, 44 + Math.round(i * 1.6), 9, '#d8382c', '#8e1f18', '#e8c060');
    }

    // signage above the shopfronts
    banner(n, 22, 66, 20, 74, '#c8443a', '#e8c060', '#f6efdc');
    banner(n, 118, 74, 18, 62, '#2f5f9c', '#e8c060', '#f6efdc');
    signBoard(n, 158, 92, 46, 20, '#e8c060', '#8e2c28', '#3b1f18', 3);
    signBoard(n, 276, 84, 52, 22, '#2f7a5e', '#e8c060', '#f6efdc', 3);
    banner(n, 356, 60, 20, 80, '#c8443a', '#e8c060', '#f6efdc');
    banner(n, 446, 70, 18, 66, '#5c3f8c', '#e8c060', '#f6efdc');
    signBoard(n, 384, 100, 50, 20, '#e8c060', '#8e2c28', '#3b1f18', 3);

    // ground clutter, left
    crate(n, 6, PGROUND - 16, 22, 16, '#8a6032', '#ab7c45', '#573a1e');
    crate(n, 6, PGROUND - 30, 18, 14, '#8a6032', '#ab7c45', '#573a1e');
    basket(n, 32, PGROUND - 14, 22, 14, '#c8a05c', '#8a6a34', '#d84a3a', '#ff8a6a');
    barrel(n, 122, PGROUND - 22, 16, 22, '#7a5230', '#9c6c42', '#4e3220', '#5b5b66');

    // ground clutter, right
    basket(n, RIGHT_X + 12, PGROUND - 15, 26, 15, '#c8a05c', '#8a6a34', '#4f8a3c', '#7fc45c');
    basket(n, RIGHT_X + 44, PGROUND - 13, 24, 13, '#c8a05c', '#8a6a34', '#e8a83c', '#ffd06a');
    sack(n, 456, PGROUND - 20, 20, 20, '#b89a6a', '#d6b98a', '#7d6444', '#8c3226');
    crate(n, 412, PGROUND - 15, 20, 15, '#8a6032', '#ab7c45', '#573a1e');

    // a bicycle leaning in the gap, because arcade streets always had one
    pxCircle(n, 152, PGROUND - 9, 8, '#2a2028');
    pxCircle(n, 152, PGROUND - 9, 5, '#544a52');
    pxCircle(n, 176, PGROUND - 9, 8, '#2a2028');
    pxCircle(n, 176, PGROUND - 9, 5, '#544a52');
    pxLine(n, 152, PGROUND - 9, 166, PGROUND - 24, 2, '#3f6f8c');
    pxLine(n, 166, PGROUND - 24, 176, PGROUND - 9, 2, '#3f6f8c');
    pxLine(n, 166, PGROUND - 24, 172, PGROUND - 26, 2, '#2a2028');
  }), 0, 0);

  // scattered litter so the paving is not a blank slab
  const rand = rng(4242);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * PW);
    const y = PGROUND + 3 + Math.floor(rand() * (PH - PGROUND - 4));
    pxDot(c, x, y, rand() > 0.5 ? '#9c9078' : '#57503f');
  }
  void pxTri;
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
