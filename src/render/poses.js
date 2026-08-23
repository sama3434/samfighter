import { MOVES } from '../moves.js';

/* The skeleton, in local sprite units: x runs forward (a fighter is always
   posed facing right and mirrored when needed), y runs up from the feet.

   Every pose returns the same joints, so limbs keep consistent thickness and
   length between animations:
     hip / sh(oulder) / head   - torso line
     bl / fl                   - back and front leg, each [knee, foot]
     ba / fa                   - back and front arm, each [elbow, hand] */

const FEET = 0, KNEE = 30, HIP = 50, SHOULDER = 84, HEAD = 102;

/** How far through its active window an attack is, 0..1. */
export function attackExtension(attack) {
  if (!attack) return 0;
  const { move: m, t } = attack;
  if (t < m.startup) return 0.35 * (t / Math.max(1, m.startup));
  if (t < m.startup + m.active) return 1;
  return 0.55 * (1 - (t - m.startup - m.active) / Math.max(1, m.recovery));
}

export function poseOf(f, frame) {
  const m = f.attack ? f.attack.move : null;
  const e = attackExtension(f.attack);

  if (f.ko || f.downTimer > 0) return { kind: 'down' };

  if (f.hitstun > 0) {
    return {
      kind: 'hurt',
      hip: [-6, 46], sh: [-16, 82], head: [-22, HEAD - 2],
      bl: [[-14, 28], [-22, FEET]], fl: [[6, 28], [10, FEET]],
      ba: [[-12, 70], [-8, 84]], fa: [[0, 70], [8, 86]],
    };
  }

  if (m === MOVES.punch) {
    return {
      kind: 'punch', fist: 'front',
      hip: [0, 48], sh: [-2, SHOULDER], head: [2, HEAD],
      bl: [[-12, KNEE], [-18, FEET]], fl: [[12, KNEE], [20, FEET]],
      ba: [[-12, 72], [-18, 66]],
      fa: [[8 + 22 * e, 82], [18 + 44 * e, 82]],
    };
  }

  if (m === MOVES.airPunch) {
    return {
      kind: 'punch', fist: 'front', airborne: true,
      hip: [0, 52], sh: [2, 88], head: [4, 106],
      bl: [[-12, 36], [-20, 40]], fl: [[14, 34], [6, 20]],
      ba: [[-6, 74], [-14, 82]],
      fa: [[14 + 16 * e, 76], [24 + 34 * e, 70]],
    };
  }

  if (m === MOVES.kick) {
    return {
      kind: 'kick', strike: 'front',
      hip: [-4, 48], sh: [-12, 82], head: [-10, 100],
      bl: [[-12, KNEE], [-18, FEET]],
      fl: [[18 + 18 * e, 46], [26 + 58 * e, 48 + 6 * e]],
      ba: [[-18, 70], [-26, 62]], fa: [[4, 74], [10, 80]],
    };
  }

  if (m === MOVES.airKick) {
    return {
      kind: 'kick', strike: 'front', airborne: true,
      hip: [0, 52], sh: [-6, 86], head: [-4, 104],
      bl: [[-10, 36], [-18, 42]],
      fl: [[22, 42], [48 + 16 * e, 34]],
      ba: [[-14, 72], [-20, 82]], fa: [[6, 74], [14, 82]],
    };
  }

  if (m === MOVES.sweep) {
    return {
      kind: 'sweep', strike: 'front',
      hip: [0, 24], sh: [-6, 54], head: [-4, 72],
      bl: [[-12, 12], [-18, FEET]],
      fl: [[18 + 16 * e, 14], [26 + 56 * e, 4]],
      ba: [[-16, 28], [-24, 2]], fa: [[6, 40], [12, 32]],
    };
  }

  if (!f.onGround) {
    return {
      kind: 'jump', airborne: true,
      hip: [0, 52], sh: [2, 88], head: [4, 106],
      bl: [[-12, 36], [-20, 40]], fl: [[14, 34], [6, 20]],
      ba: [[-6, 74], [-14, 82]], fa: [[16, 76], [24, 84]],
    };
  }

  if (f.blocking) {
    return {
      kind: 'block', guard: true,
      hip: [-4, 48], sh: [-4, SHOULDER], head: [-4, HEAD],
      bl: [[-14, 28], [-20, FEET]], fl: [[8, 28], [12, FEET]],
      ba: [[10, 68], [14, 88]], fa: [[16, 66], [20, 86]],
    };
  }

  if (f.crouching) {
    return {
      kind: 'crouch',
      hip: [0, 26], sh: [2, 56], head: [4, 74],
      bl: [[-16, 16], [-20, FEET]], fl: [[16, 16], [20, FEET]],
      ba: [[10, 44], [18, 38]], fa: [[14, 42], [24, 36]],
    };
  }

  // idle and walk share a skeleton; the stride drives the legs
  const moving = Math.abs(f.vx) > 0.4;
  const sw = moving ? Math.sin(f.walkPhase) : 0;
  const breath = moving ? Math.abs(sw) * 2 : Math.sin(frame * 0.07) * 1.2;

  return {
    kind: moving ? 'walk' : 'idle',
    hip: [0, HIP + breath * 0.5], sh: [2, SHOULDER + breath * 0.5], head: [4, HEAD + breath * 0.5],
    bl: [[-8 + sw * 8, KNEE], [-14 + sw * 18, Math.max(0, sw * 6)]],
    fl: [[10 + sw * 6, KNEE], [16 - sw * 18, Math.max(0, -sw * 6)]],
    ba: [[8 - sw * 4, 68], [16 - sw * 6, 60]],
    fa: [[16 + sw * 4, 70], [26 + sw * 4, 64]],
  };
}
