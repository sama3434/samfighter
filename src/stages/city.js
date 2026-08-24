import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxLine, pxCircle, pxDot, pxTri, pxEllipse } from '../pixel/draw.js';
import { ditherGradient } from '../pixel/dither.js';
import { layer, glow, block, signBoard, glyphMark, crowd,
         makeDepth, person, METRE } from './props.js';
import { windowLights, starField, rng } from './scenery.js';

/* A rooftop at night, high above the city.

   Where the market street closes you in, this one opens out: the skyline sits
   *below* the fighters, behind a parapet, and the only tall things in frame
   are a water tower and a billboard -- both of them at the fighters' scale,
   which means neither of them fits the frame. The tower is legs and the
   underside of a tank; the billboard is two trusses and the bottom edge of a
   sign the frame cuts off. The read is height, not enclosure. */

export const DEPTH = makeDepth(130);
const D = DEPTH;

const ROOF_EDGE = 205;                                  // where roof meets parapet
const PARAPET_T = ROOF_EDGE - Math.round(1.1 * METRE * D.scale(ROOF_EDGE));  // coping

/* City clothes at night: coats, caps and hoods in colours the neon can pick
   out, washed cold so the watchers stay behind the fight. */
const CROWD = {
  cloth: ['#2f3f6b', '#8c3a5c', '#3f7a6b', '#4a4460', '#7a5a3a', '#2f5f7a'],
  alt:   ['#2b2d42', '#3a3348', '#26303f', '#43384a'],
  trim:  ['#ffd166', '#e8563c', '#9fd4ff', '#f0e0c8'],
  hats:  ['#1f1b30', '#8c3a5c', '#2f3f6b', '#ffd166'],
  light: '#ffd9a0',
  shoe:  '#12101f',
  heads: ['cap', 'cap', 'hood', 'bare', 'short', 'tail'],
  garbs: ['coat', 'coat', 'tunic', 'vest'],
  loads: [null],
};

/* The only people are up the fire escape, off the roof's edge: they stand on
   a platform below roof level, so the parapet hides them from the chest down
   -- fighter-scaled heads and shoulders, not full dwarfs on the fight line. */
export const PEOPLE = [
  person(D, 233, ROOF_EDGE, { pose: 'crossed', face: -1, head: 'cap', garb: 'coat' }),
  person(D, 272, ROOF_EDGE, { pose: 'talk', face: -1, head: 'short', garb: 'coat' }),
];

/** A tiny pigeon, hunched on whatever it landed on. `y` is its feet. */
function pigeon(c, x, y, face = 1) {
  pxRect(c, x, y - 4, 5, 3, '#565a74');
  pxRect(c, x + (face > 0 ? 3 : 0), y - 6, 3, 3, '#454a63');
  pxDot(c, x + (face > 0 ? 5 : -1), y - 5, '#8c8ca4');       // beak
  pxRect(c, x + (face > 0 ? -1 : 4), y - 4, 2, 2, '#3a3e54');  // tail
  pxRect(c, x + 1, y - 1, 1, 1, '#c46a4a');                  // legs
  pxRect(c, x + 3, y - 1, 1, 1, '#c46a4a');
}

export function paint(c) {
  ditherGradient(c, 0, 0, PW, PARAPET_T + 8, ['#070a1e', '#101436', '#20194a', '#3a2150', '#5a2e4c']);
  starField(c, 190, 110, 4242);
  pxCircle(c, 322, 42, 14, '#e8eaff');
  pxCircle(c, 317, 37, 4, '#c9cdf0');
  pxCircle(c, 327, 48, 3, '#c9cdf0');
  glow(c, 322, 42, 40, '160, 170, 230', 4, 0.05);

  /* ---- far: the city, seen from above. Rooftops of the shorter blocks show
     over the parapet, the taller towers climb past the eye line into the
     sky, and everything fades the further down (and further away) it is ---- */
  c.drawImage(layer((f) => {
    const rand = rng(20240823);
    // the distant wall of towers, crossing the eye line
    let x = -12;
    while (x < PW + 12) {
      const w = 26 + rand() * 34;
      const h = 46 + rand() * 100;
      const top = D.horizonY + 26 - h;
      pxRect(f, x, top, w, h + 40, '#171436');
      pxRect(f, x, top, w, 2, '#26205a');
      windowLights(f, x, top, w, h, ['#4a5aa8', '#ffd980'], 0.26, rand);
      if (rand() > 0.6) {
        pxLine(f, x + w / 2, top, x + w / 2, top - 12, 1, '#141130');
        pxRect(f, x + w / 2 - 1, top - 14, 3, 3, '#ff5a5a');
      }
      x += w + 5;
    }
    // nearer, lower blocks: their roofs sit below our eye line, so what
    // shows over the parapet is rooftop clutter, not facade
    x = -20;
    while (x < PW + 20) {
      const w = 40 + rand() * 46;
      const roofY = D.horizonY + 4 + rand() * 14;
      pxRect(f, x, roofY, w, PARAPET_T - roofY + 12, '#241c44');
      pxRect(f, x, roofY, w, 2, '#3e3468');
      windowLights(f, x, roofY + 4, w, PARAPET_T - roofY + 2, ['#ffd980', '#9fd4ff'], 0.16, rand);
      // rooftop furniture on the neighbours: tanks, huts, aerials
      if (rand() > 0.35) {
        const tx = x + 4 + rand() * (w - 16);
        pxRect(f, tx, roofY - 7, 9, 7, '#1b1536');
        pxTri(f, tx - 1, roofY - 7, tx + 10, roofY - 7, tx + 4, roofY - 10, '#141130');
      }
      if (rand() > 0.5) pxLine(f, x + w * 0.7, roofY, x + w * 0.7, roofY - 8, 1, '#141130');
      x += w + 6;
    }
    // smog band where the streets are, far below
    for (let i = 0; i < 3; i++) {
      pxRect(f, 0, PARAPET_T - 6 + i * 4, PW, 3, `rgba(58, 44, 84, ${0.28 - i * 0.07})`);
    }
    // keep the stretch behind the fire-escape watchers dark, so their
    // silhouettes read instead of merging with somebody's lit windows --
    // stacked washes, so the dark patch has no hard rectangular edge
    pxRect(f, 202, 106, 112, PARAPET_T - 104, 'rgba(14, 12, 36, 0.2)');
    pxRect(f, 214, 114, 88, PARAPET_T - 112, 'rgba(14, 12, 36, 0.22)');
    pxRect(f, 224, 120, 66, PARAPET_T - 118, 'rgba(14, 12, 36, 0.24)');
    // the landing's outer guard rail, behind the people standing at it
    for (let rx = 222; rx <= 296; rx += 15) {
      pxRect(f, rx, PARAPET_T - 20, 1, 20, '#3c405c');
    }
    pxRect(f, 222, PARAPET_T - 21, 76, 2, '#4c516e');
    pxRect(f, 222, PARAPET_T - 12, 76, 1, '#3c405c');
  }), 0, 0);

  /* ---- the watchers up the fire escape, before the parapet hides them ---- */
  c.drawImage(crowd(PEOPLE, CROWD, { seed: 8080, haze: 'rgba(24, 22, 58, 0.34)' }), 0, 0);

  /* ---- mid: the parapet, and the two structures too tall for the frame ---- */
  c.drawImage(layer((m) => {
    // parapet: brick, with a stone coping and weep stains
    block(m, -4, PARAPET_T, PW + 8, ROOF_EDGE - PARAPET_T + 4, '#3a3156', '#524879', '#241d3b');
    pxRect(m, -4, PARAPET_T, PW + 8, 4, '#6b5f96');
    pxRect(m, -4, PARAPET_T + 4, PW + 8, 1, '#241d3b');
    for (let y = PARAPET_T + 7; y < ROOF_EDGE; y += 6) {          // brick courses
      pxRect(m, -4, y, PW + 8, 1, '#2b2448');
      for (let bx = ((y / 6) | 0) % 2 * 9; bx < PW; bx += 18) pxRect(m, bx, y - 6, 1, 6, '#2b2448');
    }
    const rand = rng(31);
    for (let i = 0; i < 9; i++) {                                  // weathering
      const wx = Math.floor(rand() * PW);
      pxRect(m, wx, PARAPET_T + 5, 2, 4 + Math.floor(rand() * 14), 'rgba(16, 12, 30, 0.5)');
    }
    // the fire-escape ladder hoop, poking over the parapet by the watchers
    pxRect(m, 222, PARAPET_T - 28, 2, 28, '#565a74');
    pxRect(m, 240, PARAPET_T - 28, 2, 28, '#565a74');
    pxLine(m, 222, PARAPET_T - 28, 241, PARAPET_T - 28, 1, '#565a74');

    /* water tower, left: at this scale the tank is mostly out of frame, so
       what reads is the splayed legs, the bracing, and its riveted belly */
    {
      const s = D.scale(212);
      const cx = 68;
      const tankBot = 212 - Math.round(3.1 * METRE * s);          // y ~ 57
      const tankW = Math.round(3.2 * METRE * s);                  // and off the top
      // legs, splayed wider at the roof than at the tank
      for (const [footX, headX] of [[-52, -34], [-18, -12], [14, 10], [48, 32]]) {
        pxLine(m, cx + footX, 214, cx + headX, tankBot + 4, 4, '#2f2748');
        pxLine(m, cx + footX, 214, cx + headX, tankBot + 4, 1, '#453a63');
        block(m, cx + footX - 3, 210, 8, 6, '#3a3156', '#524879', '#241d3b');
      }
      pxLine(m, cx - 44, 174, cx + 40, 160, 2, '#2f2748');        // cross braces
      pxLine(m, cx - 40, 122, cx + 34, 134, 2, '#2f2748');
      pxLine(m, cx - 46, 190, cx + 42, 178, 1, '#241d3b');
      pxRect(m, cx - 2, tankBot, 4, 214 - tankBot, '#241d3b');    // standpipe
      // belly of the tank: staves, a rim, one iron hoop
      pxEllipse(m, cx, tankBot, tankW / 2, 9, '#4a3a2e');
      pxRect(m, cx - tankW / 2, tankBot - 200, tankW, 200, '#4a3a2e');
      pxRect(m, cx - tankW / 2, tankBot - 200, 6, 206, '#6b5644');
      pxRect(m, cx + tankW / 2 - 7, tankBot - 200, 7, 203, '#2e231b');
      for (let sx = cx - tankW / 2 + 8; sx < cx + tankW / 2 - 8; sx += 9) {
        pxRect(m, sx, tankBot - 200, 1, 204, '#3a2c22');
      }
      pxEllipse(m, cx, tankBot + 1, tankW / 2 - 2, 7, '#3a2c22');
      pxRect(m, cx - tankW / 2 - 2, tankBot - 26, tankW + 4, 4, '#5b5b66');   // hoop
      pxRect(m, cx - tankW / 2 - 2, tankBot - 26, tankW + 4, 1, '#8a8a99');
    }

    /* billboard, right: trusses on the roof, a catwalk, and the bottom slice
       of a sign the frame cannot hold. Lit from below, flickering. */
    {
      const s = D.scale(218);
      const bY = 66;                                             // catwalk line
      for (const px of [366, 452]) {                             // lattice posts
        pxRect(m, px, bY, 7, 218 - bY, '#241d3b');
        pxRect(m, px, bY, 2, 218 - bY, '#3d3358');
        for (let y = bY + 8; y < 214; y += 13) {
          pxLine(m, px, y, px + 7, y + 13, 1, '#171232');
          pxLine(m, px + 7, y, px, y + 13, 1, '#171232');
        }
        block(m, px - 3, 214, 13, 7, '#3a3156', '#524879', '#241d3b');
      }
      pxLine(m, 368, 214, 455, 170, 2, '#241d3b');               // back stay
      // catwalk with rail
      pxRect(m, 344, bY, PW - 344, 5, '#141130');
      pxRect(m, 344, bY, PW - 344, 1, '#3d3358');
      for (let rx = 348; rx < PW; rx += 14) pxRect(m, rx, bY + 5, 2, 8, '#241d3b');
      pxRect(m, 344, bY + 13, PW - 344, 2, '#241d3b');
      // the sign itself, running off the top and the right of the frame
      pxRect(m, 338, -4, PW - 338 + 8, bY - 4, '#141130');
      pxRect(m, 344, -4, PW - 344 + 8, bY - 10, '#e8563c');
      pxRect(m, 344, bY - 10, PW - 344 + 8, 2, '#8a2c1f');
      // bottom halves of letters three metres tall
      for (let gx = 356; gx < PW - 10; gx += 44) {
        glyphMark(m, gx, -26, 30, 66, '#ffd166', gx / 3);
      }
      pxRect(m, 338, bY - 6, PW - 338, 2, '#ff9d8a');            // neon tube
      for (const lx of [372, 424, 466]) {                        // uplights
        pxRect(m, lx, bY - 1, 6, 4, '#3a3450');
        glow(m, lx + 3, bY - 8, 20, '255, 220, 140', 3, 0.08);
      }
    }
    void signBoard;
  }), 0, 0);

  /* ---- the roof deck itself ---- */
  c.drawImage(layer((g) => {
    pxRect(g, 0, ROOF_EDGE, PW, PH - ROOF_EDGE, '#2b2740');
    pxRect(g, 0, ROOF_EDGE, PW, 2, '#413c5e');
    // tar seams running toward the viewer
    for (let i = -8; i <= 8; i++) {
      pxLine(g, PW / 2 + i * 32, ROOF_EDGE, PW / 2 + i * 74, PH, 1, '#211d33');
    }
    for (const s of [0.35, 0.55, 0.8]) {
      const y = Math.round(ROOF_EDGE + s * (PH - ROOF_EDGE));
      pxRect(g, 0, y, PW, 1, '#211d33');
    }
    const rand = rng(77);
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(rand() * PW);
      const y = ROOF_EDGE + 2 + Math.floor(rand() * (PH - ROOF_EDGE - 2));
      pxDot(g, x, y, rand() > 0.5 ? '#3a3552' : '#1d1a2c');   // gravel
    }
  }), 0, 0);

  /* ---- near: rooftop plant, at the size such things actually are ---- */
  c.drawImage(layer((n) => {
    // air-handling unit: a metre high and twice as long
    {
      const s = D.scale(216);
      const w = Math.round(2.2 * METRE * s), h = Math.round(1.05 * METRE * s);
      const ax = 258, ay = 216 - h;
      block(n, ax, ay, w, h, '#4b4b57', '#6b6b7a', '#2e2e38');
      pxRect(n, ax + 4, ay + 4, w - 8, h - 10, '#35353f');
      for (let i = 0; i < w - 12; i += 6) pxRect(n, ax + 6 + i, ay + 5, 2, h - 12, '#5b616e');
      pxCircle(n, ax + w - 22, ay + h / 2, 11, '#2a2a33');
      pxCircle(n, ax + w - 22, ay + h / 2, 9, '#7a7a8c');
      pxCircle(n, ax + w - 22, ay + h / 2, 3, '#2a2a33');
      pxRect(n, ax + w, 214, 26, 5, '#3f4450');                // conduit off it
      pxRect(n, ax - 14, 212, 14, 4, '#3f4450');
      pigeon(n, ax + 12, ay, -1);
    }
    // vent stacks with rain hoods
    for (const [vx, vh, feet] of [[168, 1.4, 213], [196, 0.9, 217]]) {
      const s = D.scale(feet);
      const h = Math.round(vh * METRE * s), w = Math.round(0.28 * METRE * s);
      pxRect(n, vx, feet - h, w, h, '#3f4450');
      pxRect(n, vx, feet - h, 3, h, '#5b616e');
      pxEllipse(n, vx + w / 2, feet - h - 2, w / 2 + 4, 3, '#5b616e');
      pxEllipse(n, vx + w / 2, feet - h - 3, w / 2 + 2, 2, '#454a63');
    }
    // skylight, catching the moon
    block(n, 128, ROOF_EDGE + 14, 44, 18, '#2f2b46', '#413c5e', '#1d1a2c');
    for (let i = 0; i < 3; i++) pxRect(n, 132 + i * 14, ROOF_EDGE + 16, 10, 13, '#3a4a7a');
    pxRect(n, 132, ROOF_EDGE + 16, 10, 3, '#66789f');

    // satellite dish clamped to the parapet
    pxLine(n, 424, PARAPET_T + 2, 424, PARAPET_T - 16, 3, '#3f4450');
    pxEllipse(n, 430, PARAPET_T - 22, 12, 9, '#8f95a6');
    pxEllipse(n, 431, PARAPET_T - 22, 8, 6, '#5f6472');
    pxDot(n, 438, PARAPET_T - 20, '#c9cdf0');

    // pigeons along the coping
    pigeon(n, 148, PARAPET_T, 1);
    pigeon(n, 160, PARAPET_T, -1);
    pigeon(n, 316, PARAPET_T, 1);

    // cables strung from the tower past the billboard
    pxLine(n, 0, 20, PW, 36, 1, '#141126');
    pxLine(n, 0, 30, PW, 16, 1, '#141126');
    // string of work lights over the deck
    for (let x = 0; x < PW; x += 2) {
      const y = 58 + Math.round(Math.sin((x / PW) * Math.PI) * 14);
      pxRect(n, x, y, 2, 1, '#241d3b');
    }
    for (let i = 0; i < 8; i++) {
      const lx = 30 + i * 60;
      const ly = 58 + Math.round(Math.sin((lx / PW) * Math.PI) * 14);
      pxLine(n, lx, ly, lx, ly + 5, 1, '#241d3b');
      glow(n, lx, ly + 8, 14, '255, 226, 160', 3, 0.07);
      pxCircle(n, lx, ly + 8, 3, '#ffe9a8');
    }

    // a puddle catching the billboard's neon
    pxEllipse(n, 214, PGROUND + 22, 26, 5, '#3a3a6b');
    pxRect(n, 202, PGROUND + 21, 22, 1, '#8f6ab0');
    pxRect(n, 220, PGROUND + 23, 12, 1, '#c65a48');
  }), 0, 0);
}

/* The billboard drops out for a beat every so often, and the aerial beacons
   blink. The paint has the sign lit, so the overlay only draws the outage. */
export function overlay(c, frame) {
  if ((frame >> 4) % 6 === 0) {
    pxRect(c, 344, 0, PW - 344, 52, '#3a2028');
    for (let gx = 356; gx < PW - 10; gx += 44) {
      glyphMark(c, gx, -26, 30, 66, '#5c4438', gx / 3);
    }
    pxRect(c, 338, 60, PW - 338, 2, '#4a3340');
  }
  if ((frame >> 5) % 2 === 0) pxRect(c, 262, 58, 3, 3, '#ff5a5a');
}

export const stage = { key: 'city', name: 'CITY', drift: 'none', paint, overlay };
