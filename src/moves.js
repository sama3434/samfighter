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
   stun     - frames the victim is stunned for, instead of normal hitstun
   pose     - which animation family the renderer poses this move with
   burn     - landing clean sets the victim alight (see BURN_* in config.js)
   projectile - the move launches a travelling attack instead of a melee
              hitbox: { speed, w, h, spawnX, spawnY } in world units */

export const MOVES = {
  punch: {
    key: 'punch', pose: 'punch', startup: 4, active: 4, recovery: 9,
    dmg: DAMAGE.punch, reach: 165, top: -240, h: 65,
    kb: 8.75, kbY: 0, hitstun: 13, blockstun: 7, chip: CHIP_DAMAGE.punch, tone: 'punch',
    meterGain: 12.5,
  },
  kick: {
    key: 'kick', pose: 'kick', startup: 8, active: 6, recovery: 17,
    dmg: DAMAGE.kick, reach: 215, top: -180, h: 75,
    kb: 15, kbY: -8.75, hitstun: 20, blockstun: 12, chip: CHIP_DAMAGE.kick, tone: 'kick',
    meterGain: 25,
  },
  sweep: {
    key: 'sweep', pose: 'sweep', startup: 7, active: 5, recovery: 21,
    dmg: DAMAGE.sweep, reach: 205, top: -75, h: 70,
    kb: 10, kbY: 0, hitstun: 24, blockstun: 12, chip: CHIP_DAMAGE.sweep, tone: 'kick',
    knockdown: true, low: true, meterGain: 25,
  },
  airPunch: {
    key: 'airPunch', pose: 'airPunch', startup: 3, active: 8, recovery: 6,
    dmg: DAMAGE.airPunch, reach: 155, top: -210, h: 85,
    kb: 7.5, kbY: 0, hitstun: 14, blockstun: 8, chip: CHIP_DAMAGE.airPunch, tone: 'punch', air: true,
    meterGain: 12.5,
  },
  airKick: {
    key: 'airKick', pose: 'airKick', startup: 5, active: 10, recovery: 8,
    dmg: DAMAGE.airKick, reach: 200, top: -140, h: 100,
    kb: 12.5, kbY: 0, hitstun: 18, blockstun: 10, chip: CHIP_DAMAGE.airKick, tone: 'kick', air: true,
    meterGain: 25,
  },

  /* The special: a spinning sweep that reaches both ways at once. Its reach
     matches the regular kick rather than beating it -- what you are paying
     the meter for is the coverage and the stun, not the range. */
  spin: {
    key: 'spin', pose: 'spin', startup: 6, active: 9, recovery: 20,
    dmg: DAMAGE.spin, reach: 215, top: -165, h: 82,
    kb: 11.25, kbY: 0, hitstun: 20, blockstun: 14, chip: CHIP_DAMAGE.spin, tone: 'kick',
    both: true, stun: 42, cost: 100, meterGain: 0,
  },

  /* ---- ASH's move set. His numbers, not KAI's: a lighter punch that sets
     the opponent alight, a mid-weight kick, and a projectile super. Meter
     maths: every landed hit pays 20, so five clean hits fill the bar.
     He hits softer everywhere (the user's spec), so what he buys instead is
     speed: the fastest jab in the game, a quicker kick recovery, and reach
     parity -- his fights are won by attrition and the burn. ---- */

  firePunch: {
    key: 'firePunch', pose: 'punch', startup: 3, active: 4, recovery: 8,
    dmg: DAMAGE.firePunch, reach: 165, top: -240, h: 65,
    kb: 8.75, kbY: 0, hitstun: 13, blockstun: 7, chip: CHIP_DAMAGE.firePunch, tone: 'punch',
    meterGain: 20, burn: true,
  },
  fireKick: {
    key: 'fireKick', pose: 'kick', startup: 6, active: 6, recovery: 14,
    dmg: DAMAGE.fireKick, reach: 215, top: -180, h: 75,
    kb: 12.5, kbY: -7, hitstun: 18, blockstun: 10, chip: CHIP_DAMAGE.fireKick, tone: 'kick',
    meterGain: 20,
  },
  fireSweep: {
    key: 'fireSweep', pose: 'sweep', startup: 6, active: 5, recovery: 18,
    dmg: DAMAGE.fireSweep, reach: 205, top: -75, h: 70,
    kb: 10, kbY: 0, hitstun: 24, blockstun: 12, chip: CHIP_DAMAGE.fireSweep, tone: 'kick',
    knockdown: true, low: true, meterGain: 20,
  },
  fireAirPunch: {
    key: 'fireAirPunch', pose: 'airPunch', startup: 3, active: 8, recovery: 6,
    dmg: DAMAGE.fireAirPunch, reach: 155, top: -210, h: 85,
    kb: 7.5, kbY: 0, hitstun: 14, blockstun: 8, chip: CHIP_DAMAGE.fireAirPunch, tone: 'punch', air: true,
    meterGain: 20, burn: true,
  },
  fireAirKick: {
    key: 'fireAirKick', pose: 'airKick', startup: 5, active: 10, recovery: 8,
    dmg: DAMAGE.fireAirKick, reach: 200, top: -140, h: 100,
    kb: 11, kbY: 0, hitstun: 16, blockstun: 9, chip: CHIP_DAMAGE.fireAirKick, tone: 'kick', air: true,
    meterGain: 20,
  },

  /* The super: a two-handed charged beam. He draws both hands back
     together and charges through the long startup, then thrusts both palms
     forward -- the release launches a travelling bolt from between them.
     The move itself has no melee hitbox (match.js owns the flight;
     combat.js resolves the hit). Big damage, deliberately small knockback;
     the visible charge is the counterplay window. */
  fireBeam: {
    key: 'fireBeam', pose: 'beam', startup: 22, active: 8, recovery: 20,
    dmg: DAMAGE.fireBeam, reach: 0, top: -240, h: 90,
    kb: 6, kbY: 0, hitstun: 20, blockstun: 12, chip: CHIP_DAMAGE.fireBeam, tone: 'punch',
    cost: 100, meterGain: 0,
    projectile: { speed: 16, w: 120, h: 66, spawnX: 100, spawnY: -180 },
  },
};

/* Which move fills each input slot when a roster entry names nothing. A
   character overrides per slot via its `moves` map; a slot set to null means
   the character simply does not have that move. */
export const DEFAULT_MOVESET = {
  punch: 'punch',
  kick: 'kick',
  sweep: 'sweep',
  airPunch: 'airPunch',
  airKick: 'airKick',
  special: 'spin',
};
