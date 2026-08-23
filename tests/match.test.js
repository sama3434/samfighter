import { describe, it, expect } from './harness.js';
import { makeMatch, FAKE_STAGES } from './factories.js';
import * as C from '../src/config.js';

describe('round flow', () => {
  it('a KO ends the round and awards it', () => {
    const { match, p1, p2, input, step } = makeMatch();
    p2.hp = 5; p1.x = 400; p2.x = 490;
    input.pressed.add('g');
    step(1); step(25);
    expect(match.phase).toBe('roundEnd');
    expect(p1.wins).toBe(1);
    expect(match.sub).toBe('K.O.');
  });

  it('time over awards the healthier fighter', () => {
    const { match, p1, p2, step } = makeMatch();
    p1.hp = 80; p2.hp = 40;
    match.clock = 1;
    step(3);
    expect(match.phase).toBe('roundEnd');
    expect(p1.wins).toBe(1);
    expect(match.sub).toBe('TIME OVER');
  });

  it('equal health at time over is a draw', () => {
    const { match, p1, p2, step } = makeMatch();
    p1.hp = 50; p2.hp = 50;
    match.clock = 1;
    step(3);
    expect(match.banner).toBe('DRAW');
    expect(p1.wins).toBe(0);
    expect(p2.wins).toBe(0);
  });

  it('the match ends after two round wins', () => {
    const { match, p1, p2, input, step } = makeMatch();
    p1.wins = 1;
    p2.hp = 5; p1.x = 400; p2.x = 490;
    input.pressed.add('g');
    step(1); step(200);
    expect(match.phase).toBe('matchEnd');
    expect(p1.wins).toBe(C.WINS_NEEDED);
  });

  it('enter restarts a match in progress', () => {
    const { match, p1, input, step } = makeMatch();
    p1.wins = 1;
    input.pressed.add('enter');
    step(1);
    expect(p1.wins).toBe(0);
    expect(match.round).toBe(1);
  });

  it('leaves matchEnd alone so the app can return to the roster', () => {
    const { match, p1, input, step } = makeMatch();
    match.phase = 'matchEnd';
    p1.wins = 2;
    input.pressed.add('enter');
    step(1);
    expect(match.phase).toBe('matchEnd');
    expect(p1.wins).toBe(2);
  });

  it('hitstop freezes the fighters but not the frame counter', () => {
    const { match, p1, step } = makeMatch();
    match.hitstop = 5;
    const x = p1.x;
    const frame = match.frame;
    step(3);
    expect(p1.x).toBe(x);
    expect(match.frame).toBe(frame + 3);
  });
});

describe('stages', () => {
  it('rotates one stage per round and wraps around', () => {
    const { match } = makeMatch();
    const seen = [];
    for (let r = 1; r <= 5; r++) {
      match.round = r;
      match.startRound();
      seen.push(match.stage.key);
    }
    expect(new Set(seen.slice(0, 4)).size).toBe(FAKE_STAGES.length);
    expect(seen[4]).toBe(seen[0]);
  });

  it('opens each match on a different stage', () => {
    const { match } = makeMatch();
    const first = match.stage.key;
    match.startMatch();
    expect(match.stage.key === first).toBeFalsy();
  });
});
