import { describe, it, expect } from './harness.js';
import { makeMatch } from './factories.js';
import { MOVES } from '../src/moves.js';
import { resolveHits } from '../src/combat.js';
import * as C from '../src/config.js';

describe('hit resolution', () => {
  it('a punch in range takes its damage', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    input.pressed.add('f');
    step(1); step(12);
    expect(p2.hp).toBe(C.MAX_HP - MOVES.punch.dmg);
  });

  it('a punch out of range does nothing', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 300; p2.x = 760;
    input.pressed.add('f');
    step(1); step(20);
    expect(p2.hp).toBe(C.MAX_HP);
  });

  it('each attack can only connect once', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 470;
    input.pressed.add('g');
    step(1); step(MOVES.kick.startup + MOVES.kick.active);
    expect(p2.hp).toBe(C.MAX_HP - MOVES.kick.dmg);
  });

  it('blocking reduces a hit to chip damage', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    input.held.add('/');
    step(2);
    input.pressed.add('g');
    step(1); step(20);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.kick.chip);
  });

  it('a sweep goes under a standing guard and knocks down', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    input.held.add('/');
    input.held.add('s');
    step(2);
    input.pressed.add('g');
    step(1); step(20);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.sweep.dmg);
    expect(p2.downTimer).toBeGreaterThan(0);
  });

  it('a crouching guard does stop a sweep', () => {
    const { p1, p2, input, step } = makeMatch();
    p1.x = 400; p2.x = 490;
    input.held.add('/');            // p2 guards
    input.held.add('arrowdown');    // ...and crouches, on its own scheme
    input.held.add('s');            // p1 crouches to sweep
    step(2);
    expect(p2.crouching).toBeTruthy();
    input.pressed.add('g');
    step(1); step(20);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.sweep.chip);
  });

  it('a guard facing away from the attacker does not hold', () => {
    // Fighters re-face each other whenever they can act, so this only happens
    // on a cross-up -- someone jumping over you while you hold guard.
    const { p1, p2 } = makeMatch();
    p1.x = 400; p2.x = 490;
    p1.facing = 1;
    p2.blocking = true;
    p2.facing = 1;                    // still turned the way the jumper came from
    p1.startAttack('punch');
    p1.attack.t = MOVES.punch.startup;
    resolveHits(p1, p2, null);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.punch.dmg);
  });

  it('the same guard held the right way does hold', () => {
    const { p1, p2 } = makeMatch();
    p1.x = 400; p2.x = 490;
    p1.facing = 1;
    p2.blocking = true;
    p2.facing = -1;                   // turned toward the attacker
    p1.startAttack('punch');
    p1.attack.t = MOVES.punch.startup;
    resolveHits(p1, p2, null);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.punch.chip);
  });
});

describe('bodies', () => {
  it('fighters cannot overlap', () => {
    const { p1, p2, step } = makeMatch();
    p1.x = 470; p2.x = 500;
    step(3);
    expect(Math.abs(p2.x - p1.x)).toBeGreaterThan(C.PUSH_GAP - 1);
  });
});
