import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse } from '../pixel/draw.js';
import { ditherGradient } from '../pixel/dither.js';
import { layer, glow, block, signBoard, banner, crate, barrel, crowd } from './props.js';
import { windowLights, starField, rng } from './scenery.js';

/* A rooftop at night, high above the city.

   Where the market street closes you in, this one opens out: the skyline sits
   *below* the fighters, behind a parapet, and the only tall things in frame
   are a water tower and a billboard. The read is height, not enclosure. */

/* City clothes at night: coats, caps and hoods in colours the neon can pick
   out, over a crowd washed cold so it stays behind the fight. */
const CROWD = {
  cloth: ['#2f3f6b', '#8c3a5c', '#3f7a6b', '#4a4460', '#7a5a3a', '#2f5f7a',
          '#6b3a6b', '#3a4450', '#a05a3c', '#4f5a68'],
  alt:   ['#2b2d42', '#3a3348', '#26303f', '#43384a'],
  trim:  ['#ffd166', '#e8563c', '#9fd4ff', '#f0e0c8'],
  hats:  ['#1f1b30', '#8c3a5c', '#2f3f6b', '#ffd166', '#3f7a6b', '#4f5a68'],
  light: '#ffd9a0',
  shoe:  '#12101f',
  heads: ['cap', 'cap', 'hood', 'hood', 'bare', 'short', 'tail', 'bun',
          'long', 'brim', 'bald'],
  garbs: ['coat', 'coat', 'tunic', 'vest', 'tunic'],
  loads: [null, null, null, null, null, 'sack', 'jug'],
};

const PARAPET_Y = PGROUND - 30;

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PARAPET_Y + 8, ['#070a1e', '#101436', '#20194a', '#3a2150', '#5a2e4c']);
  starField(c, 190, 120, 4242);
  pxCircle(c, 96, 44, 14, '#e8eaff');
  pxCircle(c, 91, 39, 4, '#c9cdf0');
  pxCircle(c, 101, 50, 3, '#c9cdf0');
  glow(c, 96, 44, 40, '160, 170, 230', 4, 0.05);

  /* ---- far: the city, seen from above and behind the parapet ---- */
  c.drawImage(layer((f) => {
    const rand = rng(20240823);
    // a back rank of towers, tops well above the parapet
    let x = -12;
    while (x < PW + 12) {
      const w = 26 + rand() * 34;
      const h = 60 + rand() * 96;
      const top = PARAPET_Y - h;
      pxRect(f, x, top, w, h, '#171436');
      pxRect(f, x, top, w, 2, '#26205a');
      windowLights(f, x, top, w, h, ['#4a5aa8', '#ffd980'], 0.26, rand);
      if (rand() > 0.6) {
        pxLine(f, x + w / 2, top, x + w / 2, top - 12, 1, '#141130');
        pxRect(f, x + w / 2 - 1, top - 14, 3, 3, '#ff5a5a');
      }
      x += w + 5;
    }
    // a nearer rank, only their tops showing over the parapet
    x = -20;
    while (x < PW + 20) {
      const w = 34 + rand() * 40;
      const h = 14 + rand() * 22;
      const top = PARAPET_Y - h;
      pxRect(f, x, top, w, h + 12, '#241c44');
      pxRect(f, x, top, w, 2, '#3e3468');
      windowLights(f, x, top, w, h, ['#ffd980', '#9fd4ff'], 0.4, rand);
      pxRect(f, x + 6, top - 7, 12, 7, '#1b1536');       // roof tanks below
      x += w + 6;
    }
  }), 0, 0);

  /* ---- mid: the parapet, water tower and billboard ---- */
  c.drawImage(layer((m) => {
    // parapet wall running the width of the roof
    block(m, -4, PARAPET_Y, PW + 8, 22, '#3a3156', '#524879', '#241d3b');
    pxRect(m, -4, PARAPET_Y, PW + 8, 3, '#6b5f96');
    for (let i = 0; i < PW; i += 34) pxRect(m, i, PARAPET_Y + 3, 3, 19, '#2b2448');

    // water tower, left
    const tx = 66, ty = PARAPET_Y - 78;
    for (const lx of [tx - 22, tx - 8, tx + 6, tx + 20]) {
      pxLine(m, lx, PARAPET_Y + 2, tx + (lx - tx) * 0.55, ty + 34, 3, '#2f2748');
    }
    pxLine(m, tx - 24, ty + 52, tx + 22, ty + 44, 2, '#2f2748');
    block(m, tx - 26, ty, 52, 36, '#4a3a2e', '#6b5644', '#2e231b');
    for (let i = 0; i < 36; i += 6) pxRect(m, tx - 26, ty + i, 52, 2, '#3a2c22');
    pxRect(m, tx - 28, ty + 12, 56, 3, '#5b5b66');
    pxTri(m, tx - 30, ty, tx + 30, ty, tx, ty - 16, '#5a4636');
    pxTri(m, tx, ty, tx + 30, ty, tx, ty - 16, '#3c2e23');

    // billboard, right — abstract marks, lit from below
    const bx = 356, by = PARAPET_Y - 92;
    pxRect(m, bx + 14, by + 54, 6, 40, '#241d3b');
    pxRect(m, bx + 74, by + 54, 6, 40, '#241d3b');
    pxLine(m, bx + 16, by + 60, bx + 78, by + 84, 2, '#241d3b');
    block(m, bx, by, 96, 56, '#141130', '#2a2450', '#0c0a20');
    pxRect(m, bx + 4, by + 4, 88, 48, '#e8563c');
    signBoard(m, bx + 10, by + 10, 76, 36, '#ffd166', '#8a2c1f', '#3b1f18', 3);
    for (const lx of [bx + 16, bx + 46, bx + 76]) {
      pxRect(m, lx, by + 56, 5, 4, '#3a3450');
      glow(m, lx + 2, by + 50, 22, '255, 220, 140', 3, 0.07);
    }
  }), 0, 0);

  /* ---- the roof deck itself ---- */
  c.drawImage(layer((g) => {
    pxRect(g, 0, PGROUND - 8, PW, PH - PGROUND + 8, '#2b2740');
    pxRect(g, 0, PGROUND - 8, PW, 3, '#413c5e');
    // tar seams running toward the viewer
    for (let i = -8; i <= 8; i++) {
      pxLine(g, PW / 2 + i * 32, PGROUND - 5, PW / 2 + i * 96, PH, 1, '#211d33');
    }
    for (let j = 1; j < 5; j++) pxRect(g, 0, PGROUND - 5 + j * j * 3, PW, 1, '#211d33');
    const rand = rng(77);
    for (let i = 0; i < 220; i++) {
      const x = Math.floor(rand() * PW);
      const y = PGROUND - 6 + Math.floor(rand() * (PH - PGROUND + 6));
      pxDot(g, x, y, rand() > 0.5 ? '#3a3552' : '#1d1a2c');   // gravel
    }
  }), 0, 0);

  /* ---- crowd: watching from the fire escape and the far corner ---- */
  c.drawImage(crowd([
    { x: 150, y: PARAPET_Y + 2, h: 40, face: 1, pose: 'crossed' },
    { x: 300, y: PARAPET_Y + 2, h: 41, face: -1, pose: 'point' },
    { x: 246, y: PARAPET_Y - 1, h: 34, face: -1, pose: 'talk' },
    { x: 228, y: PARAPET_Y - 1, h: 33, face: 1, pose: 'talk' },
    { x: 30, y: PGROUND + 4, h: 48, face: 1, pose: 'cheer' },
    { x: 452, y: PGROUND + 4, h: 48, face: -1, pose: 'crossed' },
    { x: 418, y: PGROUND + 2, h: 45, face: -1, pose: 'sit', garb: 'coat' },
  ], CROWD, { seed: 8080, haze: 'rgba(24, 22, 58, 0.20)' }), 0, 0);

  /* ---- near: rooftop clutter ---- */
  c.drawImage(layer((n) => {
    // air handling units
    for (const [ax, aw] of [[118, 44], [258, 38]]) {
      block(n, ax, PARAPET_Y - 22, aw, 24, '#4b4b57', '#6b6b7a', '#2e2e38');
      pxRect(n, ax + 3, PARAPET_Y - 19, aw - 6, 18, '#35353f');
      for (let i = 0; i < aw - 8; i += 5) pxRect(n, ax + 4 + i, PARAPET_Y - 18, 2, 16, '#5b5b66');
      pxCircle(n, ax + aw / 2, PARAPET_Y - 10, 6, '#2a2a33');
      pxCircle(n, ax + aw / 2, PARAPET_Y - 10, 4, '#7a7a8c');
    }
    // vent pipes and a satellite dish
    for (const [vx, vh] of [[196, 26], [214, 18], [330, 22]]) {
      pxRect(n, vx, PARAPET_Y - vh, 8, vh + 2, '#3f4450');
      pxRect(n, vx, PARAPET_Y - vh, 3, vh + 2, '#5b616e');
      pxEllipse(n, vx + 4, PARAPET_Y - vh, 6, 3, '#5b616e');
    }
    pxLine(n, 424, PARAPET_Y + 2, 424, PARAPET_Y - 20, 3, '#3f4450');
    pxEllipse(n, 430, PARAPET_Y - 26, 13, 10, '#8f95a6');
    pxEllipse(n, 431, PARAPET_Y - 26, 9, 7, '#5f6472');

    // cables strung overhead
    pxLine(n, 0, 22, PW, 40, 1, '#141126');
    pxLine(n, 0, 32, PW, 18, 1, '#141126');

    // string of work lights over the deck
    pxLine(n, 10, 66, 470, 78, 1, '#241d3b');
    for (let i = 0; i < 9; i++) {
      const lx = 26 + i * 54;
      const ly = 68 + Math.round(i * 1.2);
      pxLine(n, lx, ly, lx, ly + 5, 1, '#241d3b');
      glow(n, lx, ly + 8, 16, '255, 226, 160', 3, 0.07);
      pxCircle(n, lx, ly + 8, 3, '#ffe9a8');
    }

    banner(n, 462, PARAPET_Y - 66, 16, 54, '#5c2a5c', '#ffd166', '#fff0b0');
    barrel(n, 86, PGROUND - 4, 18, 26, '#3f5a4a', '#5c8069', '#26382e', '#2a2028');
    crate(n, 388, PGROUND - 2, 22, 18, '#4a3f6b', '#665aa0', '#2c2547');
    crate(n, 386, PGROUND - 20, 18, 16, '#4a3f6b', '#665aa0', '#2c2547');
    // a puddle catching the billboard
    pxEllipse(n, 214, PGROUND + 18, 22, 4, '#3a3a6b');
    pxRect(n, 204, PGROUND + 17, 18, 1, '#8f6ab0');
  }), 0, 0);
}

/* The billboard flickers and the aerial beacons blink. */
export function overlay(c, frame) {
  const bx = 356, by = PARAPET_Y - 92;
  if ((frame >> 4) % 6 !== 0) {
    pxRect(c, bx + 4, by + 4, 88, 48, '#e8563c');
    signBoard(c, bx + 10, by + 10, 76, 36, '#ffd166', '#8a2c1f', '#3b1f18', 3);
  }
  if ((frame >> 5) % 2 === 0) pxRect(c, 240, 14, 3, 3, '#ff5a5a');
}

export const stage = { key: 'city', name: 'CITY', drift: 'none', paint, overlay };
