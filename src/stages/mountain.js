import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse, pxTaper } from '../pixel/draw.js';
import { ditherGradient, ditherBand } from '../pixel/dither.js';
import { layer, glow, block, lantern, banner, crate, barrel, bystander } from './props.js';
import { pineTree, starField, rng } from './scenery.js';

/* A rope bridge over a gorge at sunrise.

   Asymmetric on purpose: a sheer cliff and waterfall fill the left, the right
   opens onto empty air and the far range, and the fight happens on the span
   between them. Nothing frames both sides, which is what keeps it from
   reading like the market street in a different palette. */

const PAL = {
  rock: '#6b6a86', rockHi: '#8e8dab', rockLo: '#454358',
  wood: '#6b4f3a', woodHi: '#8c6a4e', woodLo: '#3f2c1f',
  crowd: [
    { base: '#8c5a3c', hi: '#b57c58', lo: '#5c3826', belt: '#3d2418', shoe: '#2b1f16', skin: '#e8b487', skinHi: '#ffd6ab', hair: '#241d1a' },
    { base: '#c8623c', hi: '#e88a64', lo: '#8a3a23', belt: '#5c2119', shoe: '#2b1f16', skin: '#f0c090', skinHi: '#ffdcb4', hair: '#2b1d16' },
    { base: '#3f5a8c', hi: '#5f7fb8', lo: '#26375c', belt: '#1a2440', shoe: '#2b1f16', skin: '#d9a878', skinHi: '#f6cb9c', hair: '#1f1a14' },
  ],
};

const CLIFF_W = 132;

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PGROUND, ['#141c4e', '#2c3f7e', '#6d5f9c', '#d0806a', '#f5b97e']);
  starField(c, 60, 52, 777);
  glow(c, 348, 96, 54, '255, 185, 138', 5, 0.07);
  pxCircle(c, 348, 96, 18, '#ffd9a0');
  pxCircle(c, 348, 96, 12, '#fff3d0');

  /* ---- far: the range across the gorge ---- */
  c.drawImage(layer((f) => {
    for (const [bx, halfW, h] of [[236, 108, 110], [372, 92, 86], [456, 70, 66]]) {
      const topY = PGROUND - 40 - h;
      pxTri(f, bx - halfW, PGROUND - 40, bx + halfW, PGROUND - 40, bx, topY, '#5b5f96');
      pxTri(f, bx, PGROUND - 40, bx + halfW, PGROUND - 40, bx, topY, '#3f4270');
      const capH = h * 0.4;
      for (let i = 0; i < capH; i++) {
        const w = Math.round(halfW * (i / h)) + 2;
        const jag = Math.round(Math.sin(i * 1.7 + bx) * 2.4);
        pxRect(f, bx - w, topY + i, w + jag, 1, '#f2f4ff');
        pxRect(f, bx, topY + i, w + jag, 1, '#cdd3ee');
      }
    }
    // cloud filling the gorge below the bridge
    for (let i = 0; i < 26; i++) {
      const cx = (i * 53) % PW;
      const cy = PGROUND - 34 + ((i * 11) % 16);
      ditherBand(f, cx, cy, 26 + (i * 7) % 30, 5, 'rgba(0,0,0,0)', '#e8ddf2', 0.7);
    }
    ditherGradient(f, 0, PGROUND - 22, PW, 22, ['#bdb2d6', '#dcd2ea', '#f2ecf8'], 0.85);
  }), 0, 0);

  /* ---- the gorge itself: everything below the bridge line ---- */
  ditherGradient(c, 0, PGROUND - 6, PW, PH - PGROUND + 6,
                 ['#6f6a92', '#3f3a5e', '#241f38', '#15111f']);
  for (let i = 0; i < 26; i++) {
    const cx = (i * 71) % PW;
    const cy = PGROUND + 4 + ((i * 13) % 22);
    ditherBand(c, cx, cy, 20 + (i * 5) % 26, 4, 'rgba(0,0,0,0)', '#b9aed2', 0.5);
  }

  /* ---- mid: the cliff on the left, waterfall pouring off it ---- */
  c.drawImage(layer((m) => {
    // cliff mass, undercut so it reads as a drop rather than a wall
    for (let y = 0; y < PGROUND + 30; y++) {
      const bulge = Math.sin(y * 0.035) * 9 + Math.sin(y * 0.011) * 14;
      const w = CLIFF_W + bulge - (y > PGROUND - 40 ? (y - (PGROUND - 40)) * 0.9 : 0);
      pxRect(m, 0, y, Math.max(20, w), 1, PAL.rock);
      pxRect(m, Math.max(14, w - 14), y, 14, 1, PAL.rockLo);
      if (y % 17 === 0) pxRect(m, 0, y, Math.max(20, w) - 6, 2, PAL.rockHi);
    }
    // snow ledges
    for (const [sy, sw] of [[52, 118], [104, 128], [160, 136]]) {
      pxRect(m, 0, sy, sw, 5, '#e8ecff');
      pxRect(m, 0, sy, sw, 2, '#ffffff');
      pxRect(m, sw - 6, sy, 6, 5, '#c3cbe4');
    }
    for (const [tx, th] of [[26, 46], [62, 36], [100, 30]]) {
      pineTree(m, tx, 52, th, '#1e4436', '#2d6249');
    }

    // waterfall off the cliff lip into the cloud
    const fx = CLIFF_W - 4;
    for (let y = 168; y < PGROUND - 18; y++) {
      const w = 16 + (y - 168) * 0.12;
      pxRect(m, fx - w / 2, y, w, 1, y % 7 < 4 ? '#cfe0f8' : '#a8c2e8');
    }
    pxEllipse(m, fx, 168, 14, 5, '#e8f0ff');
    for (let i = 0; i < 20; i++) {
      pxDot(m, fx - 14 + (i * 7) % 28, PGROUND - 22 - (i * 3) % 12, '#f2f8ff');
    }
  }), 0, 0);

  /* ---- the bridge deck the fight happens on ---- */
  c.drawImage(layer((b) => {
    // anchor posts
    block(b, CLIFF_W - 16, PGROUND - 44, 16, 46, PAL.wood, PAL.woodHi, PAL.woodLo);
    block(b, PW - 42, PGROUND - 48, 18, 50, PAL.wood, PAL.woodHi, PAL.woodLo);
    pxRect(b, CLIFF_W - 20, PGROUND - 48, 24, 5, PAL.woodHi);
    pxRect(b, PW - 46, PGROUND - 52, 26, 5, PAL.woodHi);

    // deck planks, sagging slightly toward the middle
    for (let x = CLIFF_W - 18; x < PW - 24; x += 9) {
      const t = (x - CLIFF_W) / (PW - CLIFF_W);
      const sag = Math.round(Math.sin(t * Math.PI) * 3);
      pxRect(b, x, PGROUND - 2 + sag, 8, 12, x % 18 === 0 ? PAL.woodHi : PAL.wood);
      pxRect(b, x, PGROUND - 2 + sag, 8, 2, '#a3805f');
      pxRect(b, x + 7, PGROUND - 2 + sag, 1, 12, PAL.woodLo);
    }
    // ropes: two hand lines and the verticals between
    for (const off of [0, 26]) {
      for (let x = CLIFF_W - 18; x < PW - 24; x++) {
        const t = (x - CLIFF_W) / (PW - CLIFF_W);
        const sag = Math.round(Math.sin(t * Math.PI) * (off ? 3 : 6));
        pxRect(b, x, PGROUND - 40 + off + sag, 1, 2, '#8a6a44');
      }
    }
    for (let x = CLIFF_W - 12; x < PW - 26; x += 22) {
      const t = (x - CLIFF_W) / (PW - CLIFF_W);
      const sag = Math.round(Math.sin(t * Math.PI) * 4);
      pxLine(b, x, PGROUND - 38 + sag, x, PGROUND - 2 + sag, 1, '#8a6a44');
    }
  }), 0, 0);

  /* ---- ground under the near end, plus the shrine ledge on the right ---- */
  c.drawImage(layer((g) => {
    pxRect(g, 0, PGROUND + 8, CLIFF_W + 6, PH - PGROUND, '#8e8dab');
    pxRect(g, 0, PGROUND + 8, CLIFF_W + 6, 4, '#e8ecff');
    pxRect(g, PW - 60, PGROUND + 6, 60, PH - PGROUND, '#8e8dab');
    pxRect(g, PW - 60, PGROUND + 6, 60, 4, '#e8ecff');
    const rand = rng(31337);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rand() * PW);
      const y = PGROUND + 10 + Math.floor(rand() * (PH - PGROUND - 10));
      pxRect(g, x, y, 2 + Math.floor(rand() * 3), 1, '#b9c4e0');
    }
    // little shrine on the far ledge
    block(g, PW - 52, PGROUND - 34, 34, 30, '#8c3226', '#b5503c', '#5c2119');
    pxRect(g, PW - 48, PGROUND - 28, 12, 18, '#2b1220');
    pxRect(g, PW - 47, PGROUND - 27, 10, 16, '#f2c070');
    pxTri(g, PW - 58, PGROUND - 34, PW - 12, PGROUND - 34, PW - 35, PGROUND - 48, '#6b2029');
    pxRect(g, PW - 58, PGROUND - 36, 46, 4, '#e8ecff');
  }), 0, 0);

  /* ---- crowd: watching from the cliff path and the far ledge ---- */
  c.drawImage(layer((p) => {
    bystander(p, 40, PGROUND + 14, 46, PAL.crowd[1], 'cheer', 1);
    bystander(p, 88, PGROUND + 12, 44, PAL.crowd[0], 'crossed', 1);
    bystander(p, 116, 52, 30, PAL.crowd[2], 'point', 1);      // up on the ledge
    bystander(p, 452, PGROUND + 12, 45, PAL.crowd[2], 'stand', -1);
    bystander(p, 424, PGROUND + 14, 43, PAL.crowd[1], 'lean', -1);
  }), 0, 0);

  /* ---- near: flags, lanterns, firewood ---- */
  c.drawImage(layer((n) => {
    // prayer flags along the bridge ropes
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const x = CLIFF_W - 10 + t * (PW - CLIFF_W - 30);
      const sag = Math.round(Math.sin(t * Math.PI) * 6);
      const y = PGROUND - 40 + sag;
      pxRect(n, x, y, 9, 12, ['#d8503c', '#e8c060', '#3f7a8c', '#f0e0c8', '#4f8a3c'][i % 5]);
      pxRect(n, x, y, 9, 2, '#ffffff44');
    }
    lantern(n, CLIFF_W - 8, PGROUND - 62, 9, '#d8382c', '#8e1f18', '#e8c060');
    lantern(n, PW - 34, PGROUND - 66, 9, '#d8382c', '#8e1f18', '#e8c060');
    banner(n, 24, 92, 18, 58, '#3f5a8c', '#e8c060', '#f6efdc');

    for (let i = 0; i < 4; i++) {
      pxEllipse(n, 96, PGROUND + 20 - i * 5, 10, 3, '#6b4f3a');
      pxEllipse(n, 96, PGROUND + 19 - i * 5, 7, 2, '#8c6a4e');
    }
    pxRect(n, 86, PGROUND + 2, 20, 3, '#f2f4ff');
    barrel(n, 62, PGROUND + 4, 17, 24, '#7a5230', '#9c6c42', '#4e3220', '#5b5b66');
    pxEllipse(n, 70, PGROUND + 3, 9, 3, '#f2f4ff');
    crate(n, 434, PGROUND - 6, 22, 16, '#8a6032', '#ab7c45', '#573a1e');
    pxRect(n, 434, PGROUND - 8, 22, 3, '#f2f4ff');

    // boulders at the near edge
    for (const [rx, ry, rw] of [[18, PGROUND + 30, 20], [138, PGROUND + 34, 16]]) {
      pxEllipse(n, rx, ry, rw, rw * 0.6, '#7c7b98');
      pxEllipse(n, rx - 3, ry - 3, rw * 0.6, rw * 0.35, '#9d9cba');
      pxRect(n, rx - rw, ry - rw * 0.6, rw * 2, 3, '#e8ecff');
    }
  }), 0, 0);
  void pxTaper;
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
