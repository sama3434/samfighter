import { describe, it, expect } from './harness.js';
import { makeMatch } from './factories.js';
import { MOVES } from '../src/moves.js';
import * as C from '../src/config.js';

/* Landing a clean hit triggers hitstop, which freezes the simulation for a
   few frames -- so these helpers wait on state rather than counting frames,
   or the attack is still in recovery when the next input arrives. */
function landHits(ctx, key, times) {
  const { p1, p2, input, step } = ctx;
  for (let i = 0; i < times; i++) {
    p1.x = 400; p2.x = 490; p2.hp = C.MAX_HP; p2.vx = 0;
    input.pressed.add(key);
    step(1);
    let guard = 0;
    while (p1.attack && guard++ < 120) step(1);
  }
}

describe('special meter', () => {
  it('fills in exactly four kicks', () => {
    const ctx = makeMatch();
    landHits(ctx, 'g', 4);
    expect(ctx.p1.meter).toBe(C.METER_MAX);
    expect(ctx.p1.meterFull).toBeTruthy();
  });

  it('fills in exactly eight punches', () => {
    const ctx = makeMatch();
    landHits(ctx, 'f', 8);
    expect(ctx.p1.meter).toBe(C.METER_MAX);
  });

  it('is not filled by three kicks', () => {
    const ctx = makeMatch();
    landHits(ctx, 'g', 3);
    expect(ctx.p1.meter).toBe(75);
    expect(ctx.p1.meterFull).toBeFalsy();
  });

  it('is not filled by seven punches', () => {
    const ctx = makeMatch();
    landHits(ctx, 'f', 7);
    expect(ctx.p1.meterFull).toBeFalsy();
  });

  it('a blocked hit pays no meter', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    input.held.add('/');
    step(2);
    input.pressed.add('g');
    step(1); step(20);
    expect(p1.meter).toBe(0);
  });

  it('never overfills', () => {
    const { p1 } = makeMatch();
    p1.gainMeter(500);
    expect(p1.meter).toBe(C.METER_MAX);
  });
});

describe('the special move', () => {
  it('does nothing without a full meter', () => {
    const { p1, input, step } = makeMatch();
    p1.meter = C.METER_MAX - 1;
    input.pressed.add('q');
    step(1);
    expect(p1.attack).toBe(null);
    expect(p1.meter).toBe(C.METER_MAX - 1);
  });

  it('fires on Q and spends the whole meter', () => {
    const { p1, input, step } = makeMatch();
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1);
    expect(p1.attack.move).toBe(MOVES.spin);
    expect(p1.meter).toBe(0);
  });

  it('player two fires it on M', () => {
    const { p2, input, step } = makeMatch();
    p2.meter = C.METER_MAX;
    input.pressed.add('m');
    step(1);
    expect(p2.attack.move).toBe(MOVES.spin);
  });

  it('cannot be used in the air', () => {
    const { p1, input, step } = makeMatch();
    p1.meter = C.METER_MAX;
    input.pressed.add('w');
    step(1); step(4);
    expect(p1.onGround).toBeFalsy();
    input.pressed.add('q');
    step(1);
    expect(p1.meter).toBe(C.METER_MAX);
  });

  it('reaches no further than the regular kick', () => {
    expect(MOVES.spin.reach).toBeLessThan(MOVES.kick.reach + 1);
  });

  it('hits an opponent standing behind the attacker', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400;
    p2.x = 320;                     // behind, since p1 faces right at p2... force it
    p1.facing = 1;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1);
    p1.facing = 1;                  // committed to the spin, so facing is locked
    step(MOVES.spin.startup + 1);
    expect(p2.hp).toBeLessThan(C.MAX_HP);
  });

  it('hits an opponent standing in front too', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1); step(MOVES.spin.startup + 1);
    expect(p2.hp).toBe(C.MAX_HP - MOVES.spin.dmg);
  });

  it('stuns for 0.7 seconds on hit', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1); step(MOVES.spin.startup + 1);
    expect(p2.stunTimer).toBe(C.STUN_FRAMES);
    expect(C.STUN_FRAMES / 60).toBeCloseTo(0.7, 0.02);
  });

  it('the stun wears off and the fighter recovers', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1); step(MOVES.spin.startup + 1);
    expect(p2.stunTimer).toBe(C.STUN_FRAMES);
    // hitstop pauses the world on impact, so the stun outlasts its own
    // frame count in wall-clock terms; wait it out rather than counting
    let guard = 0;
    while (p2.stunTimer > 0 && guard++ < 200) step(1);
    expect(p2.stunTimer).toBe(0);
    expect(p2.hitstun).toBe(0);
  });

  it('a blocked special stuns nobody', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    p1.meter = C.METER_MAX;
    input.held.add('/');
    step(2);
    input.pressed.add('q');
    step(1); step(MOVES.spin.startup + 2);
    expect(p2.stunTimer).toBe(0);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.spin.chip);
  });

  it('knocks the defender away from the attacker, whichever side they are on', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 330; p1.facing = 1;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1);
    p1.facing = 1;
    step(MOVES.spin.startup + 1);
    expect(p2.vx).toBeLessThan(0);      // pushed further left, not into the attacker
  });
});
