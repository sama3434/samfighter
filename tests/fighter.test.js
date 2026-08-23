import { describe, it, expect } from './harness.js';
import { makeMatch } from './factories.js';
import * as C from '../src/config.js';
import { MOVES } from '../src/moves.js';

describe('fighter movement', () => {
  it('walks forward when the direction key is held', () => {
    const { p1, input, step } = makeMatch();
    const x0 = p1.x;
    input.held.add('d');
    step(30);
    expect(p1.x).toBeGreaterThan(x0 + 90);
  });

  it('walks backward more slowly than forward', () => {
    const a = makeMatch();
    a.input.held.add('d');
    a.step(20);
    const forward = a.p1.x - 300;

    const b = makeMatch();
    b.input.held.add('a');
    b.step(20);
    const backward = 300 - b.p1.x;

    expect(backward).toBeLessThan(forward);
  });

  it('jumps and lands back on the floor', () => {
    const { p1, input, step } = makeMatch();
    input.pressed.add('w');
    step(1);
    step(17);
    const apex = p1.y;
    step(60);
    expect(apex).toBeLessThan(C.GROUND - 150);
    expect(p1.y).toBe(C.GROUND);
    expect(p1.onGround).toBeTruthy();
  });

  it('cannot leave the playfield', () => {
    const { p1, input, step } = makeMatch();
    input.held.add('a');
    step(200);
    expect(p1.x).toBe(C.WALL + C.BODY_W / 2);
  });

  it('turns to face the opponent', () => {
    const { p1, p2, step } = makeMatch();
    p2.x = 100;
    step(2);
    expect(p1.facing).toBe(-1);
  });

  it('crouching shortens the hurtbox', () => {
    const { p1, input, step } = makeMatch();
    input.held.add('s');
    step(2);
    expect(p1.hurtbox().h).toBe(C.CROUCH_H);
  });
});

describe('attacks', () => {
  it('crouch plus kick becomes a sweep', () => {
    const { p1, input, step } = makeMatch();
    input.held.add('s');
    step(2);
    input.pressed.add('g');
    step(1);
    expect(p1.attack.move).toBe(MOVES.sweep);
  });

  it('allows only one air attack per jump', () => {
    const { p1, input, step } = makeMatch();
    input.pressed.add('w');
    step(1);
    step(3);
    input.pressed.add('f');
    step(1);
    expect(p1.attack.move).toBe(MOVES.airPunch);

    step(18);
    expect(p1.onGround).toBeFalsy();
    input.pressed.add('f');
    step(1);
    expect(p1.attack).toBe(null);
  });

  it('re-arms the air attack after landing', () => {
    const { p1, input, step } = makeMatch();
    input.pressed.add('w'); step(1); step(3);
    input.pressed.add('f'); step(1);
    step(60);
    expect(p1.onGround).toBeTruthy();
    input.pressed.add('w'); step(1); step(3);
    input.pressed.add('f'); step(1);
    expect(p1.attack.move).toBe(MOVES.airPunch);
  });

  it('has no hitbox during startup or recovery', () => {
    const { p1, input, step } = makeMatch();
    input.pressed.add('f');
    step(1);
    expect(p1.hitbox()).toBe(null);            // startup frame 1
    step(MOVES.punch.startup);
    expect(p1.hitbox()).toBeTruthy();          // active
    step(MOVES.punch.active);
    expect(p1.hitbox()).toBe(null);            // recovery
  });
});
