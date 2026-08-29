import { KAI } from './kai.js';
import { MIRA } from './mira.js';
import { ASH } from './ash.js';

/* The registry: which hand-drawn frame, if any, answers a pose.

   A sheet only has to cover the poses somebody has actually drawn. Anything
   missing returns null and sprite.js falls back to the procedural renderer,
   so the game stays playable while the set is incomplete and new frames can
   land one at a time. */

export const SHEETS = { kai: KAI, mira: MIRA, ash: ASH };

const TAU = Math.PI * 2;

/** Pick out of a cycle: `hold` ticks per frame, looping. */
function cycle(seq, tick, hold) {
  const i = Math.floor(tick / hold) % seq.length;
  return { frame: seq[i], tag: `c${i}` };
}

/** Which phase of an attack are we in? */
function phaseOf(attack) {
  const { move: m, t } = attack;
  if (t < m.startup) return 'startup';
  if (t < m.startup + m.active) return 'active';
  return 'recovery';
}

/* An attack entry is { startup, active, recovery }; recovery falls back to
   startup, because retracting passes back through the same shape. If the
   phase the move is in has no frame at all, the whole move stays procedural
   rather than cutting between two drawing styles mid-swing. */
function attackFrame(entry, attack) {
  if (!entry || !attack) return null;
  const phase = phaseOf(attack);
  const frame = entry[phase] || (phase === 'recovery' ? entry.startup : null);
  return frame ? { frame, tag: phase } : null;
}

/**
 * The hand-drawn frame for a fighter's current pose, or null to fall back.
 * Returns { frame, id } -- `id` keys the bake cache, so it must be unique per
 * (character, slot, frame).
 */
export function frameFor(f, pose, tick) {
  const sheet = SHEETS[f.character && f.character.id];
  if (!sheet) return null;

  let hit = null;
  switch (pose.kind) {
    case 'idle':
      if (sheet.idle) hit = cycle(sheet.idle, tick, 11);
      break;
    case 'walk':
      if (sheet.walk) {
        const n = sheet.walk.length;
        const i = Math.floor((((f.walkPhase || 0) / TAU) % 1 + 1) % 1 * n) % n;
        hit = { frame: sheet.walk[i], tag: `w${i}` };
      }
      break;
    case 'block':
      if (sheet.block) hit = { frame: sheet.block, tag: 'b' };
      break;
    case 'crouch':
      if (sheet.crouch) hit = { frame: sheet.crouch, tag: 'cr' };
      break;
    case 'jump':
      if (sheet.jump) {
        // rising and falling read differently: knees tuck, then reach
        const rising = (f.vy || 0) < 0;
        const seq = sheet.jump;
        hit = { frame: rising ? seq[0] : seq[seq.length - 1], tag: rising ? 'j0' : 'j1' };
      }
      break;
    case 'punch': {
      const key = pose.airborne ? 'airPunch' : 'punch';
      const got = attackFrame(sheet[key], f.attack);
      if (got) hit = { frame: got.frame, tag: `${key}-${got.tag}` };
      break;
    }
    case 'kick': {
      const key = pose.airborne ? 'airKick' : 'kick';
      const got = attackFrame(sheet[key], f.attack);
      if (got) hit = { frame: got.frame, tag: `${key}-${got.tag}` };
      break;
    }
    case 'sweep': {
      const got = attackFrame(sheet.sweep, f.attack);
      if (got) hit = { frame: got.frame, tag: `sweep-${got.tag}` };
      break;
    }
    case 'beam': {
      const got = attackFrame(sheet.beam, f.attack);
      if (got) hit = { frame: got.frame, tag: `beam-${got.tag}` };
      break;
    }
    case 'hurt':
      if (sheet.hurt) hit = { frame: sheet.hurt, tag: 'hurt' };
      break;
    default:
      break;
  }

  if (!hit) return null;
  return { frame: hit.frame, id: `${f.character.id}/${f.slot}/${hit.tag}` };
}
