import { DAMAGE, CHIP_DAMAGE } from './config.js';

/* Frame data. Durations are in simulation frames at 60Hz.

   Damage is not here -- it is in config.js, next to the other tuning knobs.
   This file describes how a move behaves; config.js says how hard it hits.

   Geometry (reach/top/h/kb/kbY) was scaled x1.25 with the rest of the world
   in the SVC-resolution pass; durations and damage were not touched.

   startup  - windup before the hitbox exists
   active   - frames the hitbox is live
   recovery - frames locked out afterwards
   reach/top/h - hitbox geometry relative to the fighter's feet
   kb/kbY   - knockback applied to whoever is hit
   low      - passes under a standing guard
   air      - only usable while airborne
   meterGain- special meter awarded for landing it, out of METER_MAX
   cost     - meter spent to use it
   both     - hitbox extends to both sides of the fighter
   stun     - frames the victim is stunned for, instead of normal hitstun */

export const MOVES = {
  punch: {
    key: 'punch', startup: 4, active: 4, recovery: 9,
    dmg: DAMAGE.punch, reach: 165, top: -240, h: 65,
    kb: 8.75, kbY: 0, hitstun: 13, blockstun: 7, chip: CHIP_DAMAGE.punch, tone: 'punch',
    meterGain: 12.5,
  },
  kick: {
    key: 'kick', startup: 8, active: 6, recovery: 17,
    dmg: DAMAGE.kick, reach: 215, top: -180, h: 75,
    kb: 15, kbY: -8.75, hitstun: 20, blockstun: 12, chip: CHIP_DAMAGE.kick, tone: 'kick',
    meterGain: 25,
  },
  sweep: {
    key: 'sweep', startup: 7, active: 5, recovery: 21,
    dmg: DAMAGE.sweep, reach: 205, top: -75, h: 70,
    kb: 10, kbY: 0, hitstun: 24, blockstun: 12, chip: CHIP_DAMAGE.sweep, tone: 'kick',
    knockdown: true, low: true, meterGain: 25,
  },
  airPunch: {
    key: 'airPunch', startup: 3, active: 8, recovery: 6,
    dmg: DAMAGE.airPunch, reach: 155, top: -210, h: 85,
    kb: 7.5, kbY: 0, hitstun: 14, blockstun: 8, chip: CHIP_DAMAGE.airPunch, tone: 'punch', air: true,
    meterGain: 12.5,
  },
  airKick: {
    key: 'airKick', startup: 5, active: 10, recovery: 8,
    dmg: DAMAGE.airKick, reach: 200, top: -140, h: 100,
    kb: 12.5, kbY: 0, hitstun: 18, blockstun: 10, chip: CHIP_DAMAGE.airKick, tone: 'kick', air: true,
    meterGain: 25,
  },

  /* The special: a spinning sweep that reaches both ways at once. Its reach
     matches the regular kick rather than beating it -- what you are paying
     the meter for is the coverage and the stun, not the range. */
  spin: {
    key: 'spin', startup: 6, active: 9, recovery: 20,
    dmg: DAMAGE.spin, reach: 215, top: -165, h: 82,
    kb: 11.25, kbY: 0, hitstun: 20, blockstun: 14, chip: CHIP_DAMAGE.spin, tone: 'kick',
    both: true, stun: 42, cost: 100, meterGain: 0,
  },
};
