import { describe, it, expect } from './harness.js';
import { makeInput } from './factories.js';
import { SelectScreen, LAUNCH_DELAY } from '../src/select.js';
import { CHARACTERS } from '../src/characters.js';
import { SCHEMES } from '../src/input.js';

const makeSelect = () => {
  const input = makeInput();
  const select = new SelectScreen({ schemes: SCHEMES, roster: CHARACTERS });
  const step = (n = 1) => {
    let out = null;
    for (let i = 0; i < n; i++) out = select.update(input) || out;
    return out;
  };
  return { select, input, step };
};

describe('character select', () => {
  it('starts with the two players on different characters', () => {
    const { select } = makeSelect();
    expect(select.cursor[0]).toBe(0);
    expect(select.cursor[1]).toBe(1);
  });

  it('moves a cursor and wraps around the roster', () => {
    const { select, input, step } = makeSelect();
    // walk right across the whole roster: every entry, then wrap to zero
    for (let i = 1; i < CHARACTERS.length; i++) {
      input.pressed.add('d');
      step();
      expect(select.cursor[0]).toBe(i);
    }
    input.pressed.add('d');
    step();
    expect(select.cursor[0]).toBe(0);
  });

  it('each player drives only their own cursor', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('d');           // player one's key
    step();
    expect(select.cursor[1]).toBe(1); // player two has not moved
    input.pressed.add('arrowleft');
    step();
    expect(select.cursor[1]).toBe(0);
  });

  it('up locks in and down cancels', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('w');
    step();
    expect(select.locked[0]).toBeTruthy();
    input.pressed.add('s');
    step();
    expect(select.locked[0]).toBeFalsy();
  });

  it('the attack keys still confirm, for the arcade habit', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('f');
    step();
    expect(select.locked[0]).toBeTruthy();
    input.pressed.add('h');
    step();
    expect(select.locked[0]).toBeFalsy();
  });

  it('player two locks in with their own up key', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('arrowup');
    step();
    expect(select.locked[1]).toBeTruthy();
    expect(select.locked[0]).toBeFalsy();
  });

  it('a locked cursor cannot be moved', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('w');
    step();
    input.pressed.add('d');
    step();
    expect(select.cursor[0]).toBe(0);
  });

  it('does not finish until both players lock in', () => {
    const { input, step } = makeSelect();
    input.pressed.add('w');
    expect(step(LAUNCH_DELAY + 10)).toBe(null);
  });

  it('hands back both picks once the countdown runs out', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('w');
    input.pressed.add('arrowup');
    step();
    expect(select.bothLocked).toBeTruthy();
    const picks = step(LAUNCH_DELAY);
    expect(picks[0]).toBe(CHARACTERS[0]);
    expect(picks[1]).toBe(CHARACTERS[1]);
  });

  it('cancelling mid-countdown stops the launch', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('w');
    input.pressed.add('arrowup');
    step(10);
    input.pressed.add('s');
    step();
    expect(select.countdown).toBe(0);
    expect(step(LAUNCH_DELAY + 5)).toBe(null);
  });

  it('allows a mirror match', () => {
    const { input, step } = makeSelect();
    input.pressed.add('arrowleft');    // player two moves onto character one
    step();
    input.pressed.add('w');
    input.pressed.add('arrowup');
    step();
    const picks = step(LAUNCH_DELAY);
    expect(picks[0]).toBe(picks[1]);
  });

  it('reset returns it to a fresh state', () => {
    const { select, input, step } = makeSelect();
    input.pressed.add('w');
    step(5);
    select.reset();
    expect(select.locked[0]).toBeFalsy();
    expect(select.done).toBeFalsy();
    expect(select.countdown).toBe(0);
  });
});

describe('roster', () => {
  it('every character declares what the sprite and HUD need', () => {
    for (const c of CHARACTERS) {
      for (const key of ['id', 'name', 'blurb', 'build', 'palettes']) {
        if (c[key] === undefined) throw new Error(`${c.id || '?'} has no ${key}`);
      }
      for (const slot of ['p1', 'p2']) {
        if (!c.palettes[slot]) throw new Error(`${c.id} has no ${slot} palette`);
        for (const tone of ['gi', 'giHi', 'giLo', 'skin', 'skinHi', 'skinLo',
                            'hair', 'hairHi', 'band', 'bandLo',
                            'glove', 'gloveHi', 'gloveLo']) {
          const v = c.palettes[slot][tone];
          if (!/^#[0-9a-f]{6}$/i.test(v || '')) {
            throw new Error(`${c.id}.${slot}.${tone} is not a hex colour: ${v}`);
          }
        }
      }
      for (const key of ['shoulder', 'chest', 'waist', 'arm', 'leg', 'hair']) {
        if (c.build[key] === undefined) throw new Error(`${c.id} build has no ${key}`);
      }
    }
  });

  it('keeps the builds close enough that neither reads as smaller', () => {
    const widths = CHARACTERS.map((c) => c.build.shoulder);
    const spread = Math.max(...widths) - Math.min(...widths);
    expect(spread).toBeLessThan(5);
  });

  it('has a unique id per character', () => {
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
  });
});
