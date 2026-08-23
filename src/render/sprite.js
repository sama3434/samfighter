import { GROUND } from '../config.js';
import { pctx, wp, PGROUND } from '../pixel/buffer.js';
import { pxRect, pxTaper, pxCircle, pxEllipse, pxLine } from '../pixel/draw.js';
import { applyOutline } from '../pixel/outline.js';
import { PALETTES, OUTLINE } from './palettes.js';
import { poseOf } from './poses.js';

/* A fighter is composed in this scratch buffer, given a silhouette keyline,
   and then blitted (mirrored if needed) into the scene. Sized to hold the
   longest reach -- a fully extended kick -- plus the knockdown sprawl. */
const SPR_W = 168, SPR_H = 144;
const SPR_AX = 60, SPR_AY = 128;    // anchor: the fighter's feet

const scratch = document.createElement('canvas');
scratch.width = SPR_W;
scratch.height = SPR_H;
const sctx = scratch.getContext('2d');
sctx.imageSmoothingEnabled = false;

/* local (x forward, y up from feet) -> scratch canvas coords */
const SX = (x) => SPR_AX + x;
const SY = (y) => SPR_AY - y;

const rect = (x, y, w, h, col) => pxRect(sctx, SX(x), SY(y) - h, w, h, col);
const circle = (x, y, r, col) => pxCircle(sctx, SX(x), SY(y), r, col);
const line = (x0, y0, x1, y1, t, col) => pxLine(sctx, SX(x0), SY(y0), SX(x1), SY(y1), t, col);
const taper = (x0, y0, x1, y1, w0, w1, col) =>
  pxTaper(sctx, SX(x0), SY(y0), SX(x1), SY(y1), w0, w1, col);

/* A limb in three tones: the shadow tone is laid down at full width and the
   base and highlight are inset toward the light, which gives the roundness a
   single flat stroke never has. */
function limb(x0, y0, x1, y1, w0, w1, base, hi, lo) {
  taper(x0, y0, x1, y1, w0, w1, lo);
  taper(x0 + 1, y0 + 1, x1 + 1, y1 + 1, w0 - 3, w1 - 3, base);
  if (w0 > 9) taper(x0 + 2, y0 + 2, x1 + 2, y1 + 2, w0 - 8, w1 - 8, hi);
}

function foot(x, y, p, striking) {
  const w = striking ? 17 : 15;
  rect(x - 5, y, w, 7, p.skinLo);          // sole resting on the floor
  rect(x - 4, y + 1, w - 2, 5, p.skin);
  rect(x + w - 9, y + 2, 4, 3, p.skinHi);  // instep catching the light
}

function fist(x, y, p, big) {
  const s = big ? 13 : 11;
  pxCircle(sctx, SX(x), SY(y), Math.floor(s / 2), p.gloveLo);
  pxCircle(sctx, SX(x) + 1, SY(y) - 1, Math.floor(s / 2) - 1, p.glove);
  pxRect(sctx, SX(x) - 1, SY(y) - Math.floor(s / 2), 3, 2, p.gloveHi);
  // wrap tape at the wrist
  pxRect(sctx, SX(x) - Math.floor(s / 2) - 1, SY(y) - 1, 3, 5, p.band);
}

function head(x, y, p, pose) {
  // neck first, so the jaw overlaps it
  rect(x - 4, y - 16, 10, 8, p.skinLo);
  rect(x - 3, y - 16, 7, 8, p.skin);

  // hair mass sits behind and above the face
  circle(x - 2, y + 2, 14, p.hair);
  rect(x - 15, y - 5, 10, 13, p.hair);

  circle(x + 2, y, 13, p.skinLo);
  circle(x + 3, y + 1, 12, p.skin);
  circle(x + 6, y + 4, 6, p.skinHi);

  // ear
  rect(x - 6, y + 1, 4, 6, p.skinLo);
  rect(x - 5, y + 2, 2, 3, p.skin);

  // brow, eye, nose, mouth -- a face reads only if the features are separated
  rect(x + 5, y + 5, 7, 2, p.hairHi);
  rect(x + 6, y + 1, 3, 3, '#ffffff');
  rect(x + 7, y + 1, 2, 2, '#241d33');
  rect(x + 11, y - 1, 2, 3, p.skinLo);
  rect(x + 5, y - 5, 5, 1, pose.kind === 'hurt' ? '#8a3a3a' : p.skinLo);

  // headband across the brow, ties trailing behind
  rect(x - 9, y + 7, 22, 4, p.band);
  rect(x - 9, y + 7, 22, 1, p.bandLo);
  line(x - 9, y + 9, x - 22, y + 13, 3, p.band);
  line(x - 14, y + 10, x - 26, y + 6, 3, p.bandLo);

  // hair spikes over the band
  rect(x - 6, y + 11, 6, 4, p.hair);
  rect(x + 1, y + 11, 5, 3, p.hairHi);
}

function torso(hx, hy, sx, sy, p) {
  limb(hx, hy, sx, sy, 24, 30, p.gi, p.giHi, p.giLo);
  // shoulder yoke
  rect(sx - 15, sy - 3, 30, 10, p.gi);
  rect(sx - 15, sy + 7, 30, 2, p.giHi);
  // lapels crossing to the belt
  line(sx - 3, sy + 2, hx + 2, hy + 12, 5, p.giHi);
  line(sx + 6, sy + 1, hx + 6, hy + 10, 4, p.giLo);
  // belt with a knot and two tails
  rect(hx - 13, hy - 5, 26, 8, p.band);
  rect(hx - 13, hy - 5, 26, 2, p.bandLo);
  rect(hx - 4, hy - 6, 9, 9, p.band);
  rect(hx - 4, hy - 6, 9, 2, p.bandLo);
  line(hx - 9, hy - 5, hx - 16, hy - 20, 4, p.band);
  line(hx - 5, hy - 5, hx - 10, hy - 22, 3, p.bandLo);
}

export function paintBody(f, frame) {
  const p = PALETTES[f.palette];
  const pose = poseOf(f, frame);
  sctx.clearRect(0, 0, SPR_W, SPR_H);

  if (pose.kind === 'down') {
    // sprawled on their back, head trailing behind
    limb(6, 12, 26, 8, 16, 11, p.giLo, p.gi, p.giLo);
    limb(26, 8, 40, 14, 11, 8, p.giLo, p.gi, p.giLo);
    foot(40, 12, p, false);
    limb(6, 16, 30, 18, 16, 11, p.gi, p.giHi, p.giLo);
    limb(30, 18, 44, 10, 11, 8, p.gi, p.giHi, p.giLo);
    foot(44, 8, p, false);
    rect(-12, 8, 26, 20, p.gi);
    rect(-12, 26, 26, 4, p.giHi);
    rect(2, 8, 9, 20, p.band);
    limb(-8, 22, -2, 34, 11, 9, p.gi, p.giHi, p.giLo);
    fist(-2, 34, p, false);
    limb(-12, 14, -22, 14, 11, 10, p.skin, p.skinHi, p.skinLo);
    circle(-30, 16, 13, p.hair);
    circle(-28, 15, 11, p.skin);
    rect(-33, 21, 18, 4, p.band);
    line(-33, 23, -46, 20, 3, p.band);
    rect(-26, 14, 6, 2, '#241d33');      // eyes shut
    applyOutline(sctx, SPR_W, SPR_H, OUTLINE);
    return scratch;
  }

  const [hx, hy] = pose.hip;
  const [sx, sy] = pose.sh;
  const [hdx, hdy] = pose.head;
  const [[bkx, bky], [bfx, bfy]] = pose.bl;
  const [[fkx, fky], [ffx, ffy]] = pose.fl;
  const [[bex, bey], [bhx, bhy]] = pose.ba;
  const [[fex, fey], [fhx, fhy]] = pose.fa;

  // --- back limbs, shaded down so they sit behind the body ---
  limb(hx - 2, hy, bkx, bky, 16, 11, p.giLo, p.gi, p.giLo);
  limb(bkx, bky, bfx, bfy + 7, 11, 9, p.giLo, p.gi, p.giLo);
  foot(bfx, bfy, p, false);

  limb(sx - 2, sy - 2, bex, bey, 12, 10, p.giLo, p.gi, p.giLo);
  limb(bex, bey, bhx, bhy, 9, 8, p.skinLo, p.skin, p.skinLo);
  fist(bhx, bhy, p, false);

  torso(hx, hy, sx, sy, p);

  // --- front leg ---
  limb(hx + 2, hy, fkx, fky, 17, 12, p.gi, p.giHi, p.giLo);
  limb(fkx, fky, ffx, ffy + 7, 12, 9, p.gi, p.giHi, p.giLo);
  // trouser hem flaring at the ankle
  rect(ffx - 6, ffy + 12, 15, 5, p.giLo);
  foot(ffx, ffy, p, pose.strike === 'front');

  // --- front arm ---
  limb(sx + 2, sy, fex, fey, 13, 11, p.gi, p.giHi, p.giLo);
  rect(fex - 5, fey + 5, 10, 4, p.giHi);          // sleeve cuff
  limb(fex, fey, fhx, fhy, 10, 9, p.skin, p.skinHi, p.skinLo);
  fist(fhx, fhy, p, pose.fist === 'front');

  if (pose.guard) {
    // forearms stacked into a guard, front one catching the light
    limb(bex, bey, bhx, bhy, 11, 10, p.giLo, p.gi, p.giLo);
    limb(fex, fey, fhx, fhy, 12, 11, p.gi, p.giHi, p.giLo);
    fist(fhx, fhy, p, false);
    fist(bhx, bhy, p, false);
  }

  head(hdx, hdy, p, pose);

  applyOutline(sctx, SPR_W, SPR_H, OUTLINE);
  return scratch;
}

/** Composite one fighter into the scene buffer. */
export function drawFighter(f, frame) {
  const fx = wp(f.x);
  const fy = wp(f.y);

  // contact shadow tightens as the fighter rises
  const air = Math.max(0, Math.min(1, (GROUND - f.y) / 300));
  const shW = Math.round(20 - air * 8);
  pxEllipse(pctx, fx, PGROUND + 1, shW, 3, `rgba(13, 8, 18, ${0.42 - air * 0.24})`);

  paintBody(f, frame);

  pctx.save();
  if (f.facing < 0) {
    pctx.translate(fx, fy);
    pctx.scale(-1, 1);
    pctx.drawImage(scratch, -SPR_AX, -SPR_AY);
  } else {
    pctx.drawImage(scratch, fx - SPR_AX, fy - SPR_AY);
  }
  pctx.restore();

  // guard spark: a couple of bright chips off the forearms
  if (f.blockFlash > 0 && f.blockFlash % 2 === 0) {
    const gx = fx + f.facing * 14;
    pxRect(pctx, gx, fy - 62, 3, 18, '#dff0ff');
    pxRect(pctx, gx + f.facing * 4, fy - 56, 3, 10, '#8fc8ff');
  }
}
