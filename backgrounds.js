'use strict';

/* ============================================================
   STAGES
   Each stage is painted once into its own 320x180 canvas and
   blitted per frame; only the small animated overlay is redrawn.
   ============================================================ */

const PGROUND = 157;   // horizon / floor line in pixel-buffer space

/* ---------- shared scenery helpers ---------- */

// Pagoda-style roof: rows narrowing upward, with the corners flicked up.
function pagodaRoof(c, cx, baseY, halfW, h, top, edge) {
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const w = Math.round(halfW * (1 - t * 0.72));
    pxRect(c, cx - w, baseY - i, w * 2, 1, i > h - 3 ? edge : top);
  }
  // upturned tips
  pxRect(c, cx - halfW - 3, baseY - 2, 4, 1, edge);
  pxRect(c, cx - halfW - 4, baseY - 4, 3, 2, edge);
  pxRect(c, cx + halfW - 1, baseY - 2, 4, 1, edge);
  pxRect(c, cx + halfW + 1, baseY - 4, 3, 2, edge);
  pxRect(c, cx - halfW - 1, baseY, halfW * 2 + 2, 1, edge);
}

function windowLights(c, x, y, w, h, cols, density, seedRef) {
  for (let wy = y + 3; wy < y + h - 3; wy += 5) {
    for (let wx = x + 2; wx < x + w - 3; wx += 4) {
      seedRef.s = (seedRef.s * 1103515245 + 12345) & 0x7fffffff;
      if ((seedRef.s / 0x7fffffff) < density) {
        pxRect(c, wx, wy, 2, 3, cols[seedRef.s % cols.length]);
      }
    }
  }
}

function pineTree(c, x, baseY, h, dark, light) {
  const w = Math.round(h * 0.42);
  pxRect(c, x - 1, baseY - 3, 3, 3, '#2a1b16');
  for (let i = 0; i < 3; i++) {
    const ty = baseY - 3 - i * (h / 3.6);
    const tw = w * (1 - i * 0.26);
    pxTri(c, x - tw, ty, x + tw, ty, x, ty - h / 2.6, dark);
    pxTri(c, x - tw * 0.55, ty - 1, x + tw * 0.2, ty - 1, x - tw * 0.1, ty - h / 3.2, light);
  }
}

function palmTree(c, x, baseY, h, trunk, frond, frondDark) {
  for (let i = 0; i < h; i++) {
    pxRect(c, x + Math.round(Math.sin(i / h * 1.1) * 3), baseY - i, 3, 1, trunk);
  }
  const tx = x + Math.round(Math.sin(1.1) * 3) + 1;
  const ty = baseY - h;
  const dirs = [[-1, -0.5], [1, -0.5], [-1, 0.25], [1, 0.25], [-0.4, -1], [0.4, -1]];
  for (const [dx, dy] of dirs) {
    for (let i = 0; i < 11; i++) {
      const px2 = tx + dx * i;
      const py2 = ty + dy * i + i * i * 0.055;
      pxRect(c, px2, py2, 2, 2, i > 6 ? frondDark : frond);
    }
  }
  pxRect(c, tx - 2, ty - 1, 4, 3, frondDark);
}

function starField(c, count, maxY, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * PW);
    const y = Math.floor(rnd() * maxY);
    const b = rnd();
    pxDot(c, x, y, b > 0.85 ? '#ffffff' : b > 0.5 ? '#c8d4ff' : '#8a93c9');
  }
}

/* stone / tile floor shared by the built stages */
function tiledFloor(c, cols, seamCol, tileW) {
  const [a, b, edge] = cols;
  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, [a, b]);
  pxRect(c, 0, PGROUND, PW, 1, edge);
  pxRect(c, 0, PGROUND + 1, PW, 1, seamCol);
  // perspective seams fanning toward the viewer
  for (let i = -6; i <= 6; i++) {
    const topX = PW / 2 + i * tileW;
    const botX = PW / 2 + i * tileW * 3.1;
    pxLine(c, topX, PGROUND + 2, botX, PH, 1, seamCol);
  }
  for (let j = 1; j < 4; j++) {
    const y = PGROUND + 2 + j * j * 1.9;
    pxRect(c, 0, y, PW, 1, seamCol);
  }
}

/* ============================================================
   TEMPLE — dusk over a mountain shrine
   ============================================================ */
function paintTemple(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#1b1038', '#3a1b4e', '#782f55', '#c05a46', '#e8956a']);

  // moon
  pxCircle(c, 248, 56, 13, '#ffeccc');
  pxCircle(c, 244, 52, 3, '#f0d8b4');
  pxCircle(c, 252, 61, 2, '#f0d8b4');
  pxCircle(c, 251, 50, 1, '#f0d8b4');

  // distant ridges
  for (let x = 0; x < PW; x++) {
    const h = 26 + Math.sin(x * 0.031) * 12 + Math.sin(x * 0.077 + 2) * 6;
    pxRect(c, x, PGROUND - 44 - h, 1, h + 44, '#3a2050');
  }
  for (let x = 0; x < PW; x++) {
    const h = 14 + Math.sin(x * 0.045 + 1.5) * 9 + Math.sin(x * 0.11) * 4;
    pxRect(c, x, PGROUND - 26 - h, 1, h + 26, '#2a1740');
  }

  // pagoda
  const cx = 160, base = PGROUND - 6;
  pxRect(c, cx - 30, base - 34, 60, 34, '#5c2233');       // body
  pxRect(c, cx - 30, base - 34, 3, 34, '#7a3245');
  pxRect(c, cx - 22, base - 30, 8, 12, '#f0b45c');        // lit windows
  pxRect(c, cx + 14, base - 30, 8, 12, '#f0b45c');
  pxRect(c, cx - 6, base - 22, 12, 22, '#2b1220');        // doorway
  pxRect(c, cx - 5, base - 20, 10, 20, '#f2c070');
  pagodaRoof(c, cx, base - 34, 40, 9, '#8c2f38', '#5e1d28');
  pxRect(c, cx - 24, base - 60, 48, 17, '#4d1d2c');
  pxRect(c, cx - 14, base - 56, 7, 9, '#f0b45c');
  pxRect(c, cx + 7, base - 56, 7, 9, '#f0b45c');
  pagodaRoof(c, cx, base - 60, 32, 8, '#8c2f38', '#5e1d28');
  pxRect(c, cx - 16, base - 80, 32, 13, '#4d1d2c');
  pxRect(c, cx - 4, base - 77, 8, 8, '#f0b45c');
  pagodaRoof(c, cx, base - 80, 24, 7, '#8c2f38', '#5e1d28');
  pxRect(c, cx - 1, base - 94, 3, 8, '#e0a850');          // finial
  pxCircle(c, cx, base - 96, 2, '#ffd98a');

  // torii gate, left
  pxRect(c, 44, PGROUND - 40, 5, 40, '#a83a34');
  pxRect(c, 74, PGROUND - 40, 5, 40, '#a83a34');
  pxRect(c, 36, PGROUND - 44, 51, 4, '#c04a3e');
  pxRect(c, 34, PGROUND - 48, 55, 3, '#8e2c28');
  pxRect(c, 40, PGROUND - 34, 43, 3, '#c04a3e');

  // cherry tree, right
  pxLine(c, 288, PGROUND, 284, PGROUND - 26, 4, '#3d2436');
  pxLine(c, 284, PGROUND - 20, 274, PGROUND - 30, 3, '#3d2436');
  pxLine(c, 284, PGROUND - 22, 296, PGROUND - 32, 3, '#3d2436');
  for (const [bx, by, r] of [[274, -34, 9], [288, -40, 11], [300, -32, 8], [282, -28, 7], [296, -22, 6]]) {
    pxCircle(c, bx, PGROUND + by, r, '#d9628c');
    pxCircle(c, bx - 2, PGROUND + by - 2, Math.max(2, r - 4), '#f090b0');
  }

  // hanging lanterns
  for (const lx of [110, 132, 188, 210]) {
    pxLine(c, lx, PGROUND - 52, lx, PGROUND - 46, 1, '#2b1220');
    pxRect(c, lx - 3, PGROUND - 46, 7, 9, '#e8623c');
    pxRect(c, lx - 2, PGROUND - 44, 5, 5, '#ffd06a');
  }

  tiledFloor(c, ['#5d4238', '#3a2622', '#8a6450'], '#2a1a18', 13);
  pxRect(c, 0, PGROUND - 6, PW, 6, '#463028');   // stone lip of the platform
  pxRect(c, 0, PGROUND - 6, PW, 1, '#6b4c3c');
}

/* ============================================================
   PYRAMIDS — noon over the desert
   ============================================================ */
function paintPyramids(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#3a86b8', '#6fb4d4', '#a9d6e0', '#e6d5a4', '#eec98a']);

  // sun with a soft dithered halo
  ditherDisc(c, 54, 50, 30, '#fff0b8', 0.85);
  pxCircle(c, 54, 50, 12, '#fff6d0');
  pxCircle(c, 54, 50, 9, '#ffffff');

  // pyramids: lit face, shadow face, block courses
  function pyramid(px0, baseY, halfW, h) {
    pxTri(c, px0 - halfW, baseY, px0 + halfW, baseY, px0, baseY - h, '#c9a05e');
    pxTri(c, px0, baseY, px0 + halfW, baseY, px0, baseY - h, '#a37b45');
    for (let i = 4; i < h; i += 4) {
      const t = i / h;
      const w = Math.round(halfW * (1 - t));
      pxRect(c, px0 - w, baseY - i, w * 2, 1, 'rgba(90,60,30,0.35)');
    }
    pxLine(c, px0, baseY - h, px0, baseY, 1, '#8a6636');
    pxRect(c, px0 - halfW, baseY, halfW * 2, 1, '#8a6636');
  }
  pyramid(74, PGROUND - 6, 46, 52);
  pyramid(196, PGROUND - 4, 34, 40);
  pyramid(258, PGROUND - 2, 24, 27);

  // obelisk + ruined columns
  pxRect(c, 148, PGROUND - 40, 7, 40, '#cbb27a');
  pxRect(c, 148, PGROUND - 40, 2, 40, '#e2cd9c');
  pxTri(c, 147, PGROUND - 40, 156, PGROUND - 40, 151, PGROUND - 47, '#e2cd9c');
  for (const [ox, oh] of [[20, 18], [30, 12], [300, 15]]) {
    pxRect(c, ox, PGROUND - oh, 8, oh, '#d3ba84');
    pxRect(c, ox, PGROUND - oh, 3, oh, '#eddaa8');
    pxRect(c, ox - 1, PGROUND - oh - 3, 10, 3, '#c0a670');
  }

  // dunes
  for (let x = 0; x < PW; x++) {
    const h = 10 + Math.sin(x * 0.028) * 6 + Math.sin(x * 0.09 + 1) * 2.5;
    ditherBand(c, x, PGROUND - h, 1, h, '#e0c184', '#d0ad6e', 0.4);
  }

  palmTree(c, 288, PGROUND - 1, 30, '#7a5a34', '#4f8a3c', '#356028');
  palmTree(c, 306, PGROUND - 1, 22, '#7a5a34', '#4f8a3c', '#356028');
  palmTree(c, 12, PGROUND - 1, 26, '#7a5a34', '#4f8a3c', '#356028');

  // sand floor
  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, ['#e6c489', '#c9a266', '#a8834f']);
  pxRect(c, 0, PGROUND, PW, 1, '#f0d5a2');
  let s = 991;
  for (let i = 0; i < 90; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = s % PW;
    const y = PGROUND + 2 + (s >> 8) % (PH - PGROUND - 3);
    pxDot(c, x, y, (s >> 3) % 2 ? '#f2dcac' : '#96774a');
  }
  for (let j = 1; j < 5; j++) {
    const y = PGROUND + 1 + j * j * 1.4;
    for (let x = (j * 7) % 12; x < PW; x += 12) pxRect(c, x, y, 6, 1, '#bb9459');
  }
}

/* ============================================================
   CITY — neon rooftops at night
   ============================================================ */
function paintCity(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#080a1e', '#12163a', '#241a4e', '#3d2352', '#5c2f4e']);
  starField(c, 130, 90, 4242);

  pxCircle(c, 58, 52, 10, '#e8eaff');
  pxCircle(c, 54, 49, 3, '#c9cdf0');
  pxCircle(c, 62, 56, 2, '#c9cdf0');

  const seed = { s: 20240823 };

  // far skyline
  let x = -6;
  while (x < PW + 6) {
    const w = 14 + (seed.s = (seed.s * 1103515245 + 12345) & 0x7fffffff, seed.s % 20);
    const h = 30 + (seed.s >> 7) % 46;
    pxRect(c, x, PGROUND - 26 - h, w, h + 26, '#171436');
    windowLights(c, x, PGROUND - 26 - h, w, h, ['#4a5aa8', '#5f6fc0'], 0.28, seed);
    x += w + 3;
  }

  // near skyline
  x = -10;
  while (x < PW + 10) {
    const w = 22 + (seed.s = (seed.s * 1103515245 + 12345) & 0x7fffffff, seed.s % 26);
    const h = 34 + (seed.s >> 9) % 54;
    const top = PGROUND - 14 - h;
    pxRect(c, x, top, w, h + 14, '#241c44');
    pxRect(c, x, top, 2, h + 14, '#332a58');
    pxRect(c, x, top, w, 1, '#3e3468');
    windowLights(c, x, top, w, h, ['#ffd980', '#ffb45e', '#9fd4ff'], 0.42, seed);
    // rooftop water tank or aerial
    if ((seed.s >> 4) % 3 === 0) {
      pxRect(c, x + 4, top - 6, 7, 6, '#1b1536');
      pxRect(c, x + 3, top - 7, 9, 1, '#2c2350');
    } else {
      pxLine(c, x + w / 2, top, x + w / 2, top - 9, 1, '#1b1536');
      pxRect(c, x + w / 2 - 1, top - 10, 3, 2, '#ff5a5a');
    }
    x += w + 4;
  }

  // neon signage
  pxRect(c, 26, PGROUND - 58, 22, 15, '#0e0b22');
  pxRect(c, 28, PGROUND - 56, 18, 11, '#ff3f8e');
  pxRect(c, 30, PGROUND - 54, 14, 7, '#ffa8d0');
  pxRect(c, 214, PGROUND - 66, 14, 26, '#0e0b22');
  for (let i = 0; i < 4; i++) pxRect(c, 216, PGROUND - 64 + i * 6, 10, 4, '#38f0d0');
  pxRect(c, 268, PGROUND - 50, 30, 10, '#0e0b22');
  pxRect(c, 270, PGROUND - 48, 26, 6, '#ffd166');

  // street level
  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, ['#2a2540', '#1a1730', '#12101f']);
  pxRect(c, 0, PGROUND, PW, 1, '#4a4270');
  pxRect(c, 0, PGROUND + 1, PW, 1, '#2f2a4c');
  for (let i = 0; i < 7; i++) {
    const px0 = 12 + i * 48;
    pxRect(c, px0, PGROUND + 12, 22, 2, '#544b7a');   // lane markings
  }
  // light pools
  for (const lx of [56, 160, 264]) {
    ditherDisc(c, lx, PGROUND + 10, 20, '#6b5a48', 0.4);
    ditherDisc(c, lx, PGROUND + 6, 11, '#8a7050', 0.45);
    pxRect(c, lx - 1, PGROUND - 34, 2, 34, '#141126');
    pxRect(c, lx - 4, PGROUND - 37, 8, 3, '#141126');
    pxRect(c, lx - 3, PGROUND - 36, 6, 2, '#ffe9a8');
  }
}

/* ============================================================
   MOUNTAIN — sunrise above the cloud line
   ============================================================ */
function paintMountain(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#141c4e', '#2c3f7e', '#6d5f9c', '#d0806a', '#f5b97e']);
  starField(c, 45, 40, 777);

  pxCircle(c, 92, 62, 11, '#ffd9a0');
  pxCircle(c, 92, 62, 8, '#fff3d0');

  // far range
  for (let i = 0; i < 5; i++) {
    const bx = 20 + i * 66;
    const h = 40 + ((i * 37) % 22);
    pxTri(c, bx - 44, PGROUND - 30, bx + 44, PGROUND - 30, bx, PGROUND - 30 - h, '#4a4a80');
  }
  // main peaks
  const peaks = [[70, 74, 56], [160, 96, 70], [246, 66, 50]];
  for (const [bx, halfW, h] of peaks) {
    const topY = PGROUND - 22 - h;
    pxTri(c, bx - halfW, PGROUND - 22, bx + halfW, PGROUND - 22, bx, topY, '#5b5f96');
    pxTri(c, bx, PGROUND - 22, bx + halfW, PGROUND - 22, bx, topY, '#3f4270');
    // snow cap with a ragged edge
    const capH = h * 0.42;
    for (let i = 0; i < capH; i++) {
      const t = i / h;
      const w = Math.round(halfW * t) + 1;
      const jag = Math.round(Math.sin(i * 1.7 + bx) * 1.6);
      pxRect(c, bx - w, topY + i, w + jag, 1, '#f2f4ff');
      pxRect(c, bx, topY + i, w + jag, 1, '#cdd3ee');
    }
  }

  // cloud sea
  for (let i = 0; i < 26; i++) {
    const cxp = (i * 41) % PW;
    const cyp = PGROUND - 26 + ((i * 13) % 9);
    const w = 18 + (i * 7) % 22;
    ditherBand(c, cxp, cyp, w, 4, 'rgba(0,0,0,0)', '#e8ddf2', 0.75);
    pxRect(c, cxp + 2, cyp + 1, w - 4, 2, '#f4ecfa');
  }
  ditherGradient(c, 0, PGROUND - 20, PW, 20, ['#b9aed2', '#d9cfe8', '#f2ecf8'], 0.85);

  // pines along the ledge
  for (const [tx, th] of [[16, 30], [34, 22], [286, 27], [304, 20], [58, 17]]) {
    pineTree(c, tx, PGROUND - 1, th, '#1e4436', '#2d6249');
  }

  // snow floor
  ditherGradient(c, 0, PGROUND, PW, PH - PGROUND, ['#f4f6ff', '#cdd6ee', '#a8b4d4']);
  pxRect(c, 0, PGROUND, PW, 1, '#ffffff');
  let s = 31337;
  for (let i = 0; i < 60; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = s % PW;
    const y = PGROUND + 3 + (s >> 9) % (PH - PGROUND - 4);
    pxRect(c, x, y, 2 + (s % 3), 1, '#b9c4e0');
  }
}

/* ============================================================
   STAGE REGISTRY + animated overlays
   ============================================================ */
const STAGES = [
  { key: 'temple',   name: 'TEMPLE',    paint: paintTemple,   overlay: overlayPetals },
  { key: 'pyramids', name: 'PYRAMIDS',  paint: paintPyramids, overlay: overlayBirds },
  { key: 'city',     name: 'CITY',      paint: paintCity,     overlay: overlayNeon },
  { key: 'mountain', name: 'MOUNTAIN',  paint: paintMountain, overlay: overlaySnow },
];

const stageCache = new Map();

function stageCanvas(stage) {
  if (!stageCache.has(stage.key)) {
    const cv = document.createElement('canvas');
    cv.width = PW; cv.height = PH;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    stage.paint(c);
    stageCache.set(stage.key, cv);
  }
  return stageCache.get(stage.key);
}

/* --- overlays: small, cheap, redrawn every frame --- */
let drifters = [];

function seedDrifters(kind) {
  drifters = [];
  const n = kind === 'snow' ? 60 : kind === 'petals' ? 34 : kind === 'birds' ? 5 : 0;
  for (let i = 0; i < n; i++) {
    drifters.push({
      x: Math.random() * PW,
      y: Math.random() * PGROUND,
      s: 0.25 + Math.random() * 0.8,
      w: Math.random() * Math.PI * 2,
      k: 0.6 + Math.random() * 0.9,
    });
  }
}

function overlaySnow(c, frame) {
  for (const d of drifters) {
    d.y += d.s * 0.7;
    d.x += Math.sin(frame * 0.02 + d.w) * 0.35;
    if (d.y > PGROUND) { d.y = -2; d.x = Math.random() * PW; }
    pxDot(c, d.x, d.y, d.s > 0.75 ? '#ffffff' : '#d6ddf2');
  }
}

function overlayPetals(c, frame) {
  for (const d of drifters) {
    d.y += d.s * 0.5;
    d.x -= 0.35 + Math.sin(frame * 0.03 + d.w) * 0.5;
    if (d.y > PGROUND) { d.y = -2; d.x = Math.random() * PW; }
    if (d.x < -2) d.x = PW + 2;
    pxDot(c, d.x, d.y, d.s > 0.7 ? '#f7a8c4' : '#d9628c');
  }
}

function overlayBirds(c, frame) {
  for (const d of drifters) {
    d.x += 0.16 * d.k;
    if (d.x > PW + 6) d.x = -6;
    const y = d.y * 0.36 + 14 + Math.sin(frame * 0.03 + d.w) * 2;
    const flap = Math.sin(frame * 0.13 + d.w) > 0 ? 1 : -1;
    pxDot(c, d.x, y, '#2c3a4a');
    pxDot(c, d.x - 2, y - flap, '#2c3a4a');
    pxDot(c, d.x + 2, y - flap, '#2c3a4a');
  }
}

function overlayNeon(c, frame) {
  // the pink sign stutters, the teal bars chase
  if ((frame >> 4) % 5 !== 0) {
    pxRect(c, 28, PGROUND - 56, 18, 11, '#ff3f8e');
    pxRect(c, 30, PGROUND - 54, 14, 7, '#ffa8d0');
  }
  for (let i = 0; i < 4; i++) {
    const on = ((frame >> 3) + i) % 4 !== 0;
    pxRect(c, 216, PGROUND - 64 + i * 6, 10, 4, on ? '#38f0d0' : '#14544c');
  }
  const pulse = 0.5 + Math.sin(frame * 0.06) * 0.5;
  pxRect(c, 270, PGROUND - 48, 26, 6, pulse > 0.5 ? '#ffd166' : '#c99a3a');
}
