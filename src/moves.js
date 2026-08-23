/* Frame data. Durations are in simulation frames at 60Hz.

   startup  - windup before the hitbox exists
   active   - frames the hitbox is live
   recovery - frames locked out afterwards
   reach/top/h - hitbox geometry relative to the fighter's feet
   kb/kbY   - knockback applied to whoever is hit
   low      - passes under a standing guard
   air      - only usable while airborne */

export const MOVES = {
  punch: {
    key: 'punch', startup: 4, active: 4, recovery: 9,
    dmg: 7, reach: 132, top: -192, h: 52,
    kb: 7, kbY: 0, hitstun: 13, blockstun: 7, chip: 1, tone: 'punch',
  },
  kick: {
    key: 'kick', startup: 8, active: 6, recovery: 17,
    dmg: 13, reach: 172, top: -144, h: 60,
    kb: 12, kbY: -7, hitstun: 20, blockstun: 12, chip: 2, tone: 'kick',
  },
  sweep: {
    key: 'sweep', startup: 7, active: 5, recovery: 21,
    dmg: 10, reach: 164, top: -60, h: 56,
    kb: 8, kbY: 0, hitstun: 24, blockstun: 12, chip: 2, tone: 'kick',
    knockdown: true, low: true,
  },
  airPunch: {
    key: 'airPunch', startup: 3, active: 8, recovery: 6,
    dmg: 8, reach: 124, top: -168, h: 68,
    kb: 6, kbY: 0, hitstun: 14, blockstun: 8, chip: 1, tone: 'punch', air: true,
  },
  airKick: {
    key: 'airKick', startup: 5, active: 10, recovery: 8,
    dmg: 14, reach: 160, top: -112, h: 80,
    kb: 10, kbY: 0, hitstun: 18, blockstun: 10, chip: 2, tone: 'kick', air: true,
  },
};
