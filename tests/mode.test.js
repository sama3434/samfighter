import { describe, it, expect } from './harness.js';
import { makeInput } from './factories.js';
import { ModeScreen, LEVELS } from '../src/mode.js';
import { SelectScreen } from '../src/select.js';
import { CHARACTERS } from '../src/characters.js';
import { SCHEMES } from '../src/input.js';

const makeMode = () => {
  const input = makeInput();
  const mode = new ModeScreen({ schemes: SCHEMES });
  const step = (n = 1) => {
    let out = null;
    for (let i = 0; i < n; i++) out = mode.update(input) || out;
    return out;
  };
  return { mode, input, step };
};

describe('mode screen', () => {
  it('starts on vs player', () => {
    const { mode } = makeMode();
    expect(mode.stage).toBe('mode');
    expect(mode.cursor).toBe(0);
  });

  it('left and right swap between the two modes', () => {
    const { mode, input, step } = makeMode();
    input.pressed.add('d');
    step();
    expect(mode.cursor).toBe(1);
    input.pressed.add('a');
    step();
    expect(mode.cursor).toBe(0);
  });

  it('the arrow keys drive it too, for a player on the right hand side', () => {
    const { mode, input, step } = makeMode();
    input.pressed.add('arrowright');
    step();
    expect(mode.cursor).toBe(1);
  });

  it('confirming vs player hands back the two-player mode', () => {
    const { input, step } = makeMode();
    input.pressed.add('w');
    expect(step()).toEqual({ mode: 'vs' });
  });

  it('confirming vs computer opens the difficulty row', () => {
    const { mode, input, step } = makeMode();
    input.pressed.add('d');
    step();
    input.pressed.add('w');
    expect(step()).toBe(null);
    expect(mode.stage).toBe('level');
  });

  it('offers five levels, wrapping at the ends', () => {
    const { mode, input, step } = makeMode();
    mode.stage = 'level';
    mode.levelCursor = 0;
    input.pressed.add('a');
    step();
    expect(mode.levelCursor).toBe(LEVELS - 1);
    input.pressed.add('d');
    step();
    expect(mode.levelCursor).toBe(0);
  });

  it('confirming a level hands back the cpu mode with a 1-based level', () => {
    const { mode, input, step } = makeMode();
    mode.stage = 'level';
    mode.levelCursor = 4;
    input.pressed.add('arrowup');
    expect(step()).toEqual({ mode: 'cpu', level: 5 });
  });

  it('down backs out of the difficulty row', () => {
    const { mode, input, step } = makeMode();
    mode.stage = 'level';
    input.pressed.add('s');
    step();
    expect(mode.stage).toBe('mode');
  });

  it('enter confirms as well', () => {
    const { input, step } = makeMode();
    input.pressed.add('enter');
    expect(step()).toEqual({ mode: 'vs' });
  });
});

describe('character select against the computer', () => {
  const makeCpuSelect = (level = 3) => {
    const input = makeInput();
    const select = new SelectScreen({ schemes: SCHEMES, roster: CHARACTERS });
    select.setCpu(level);
    const step = (n = 1) => {
      let out = null;
      for (let i = 0; i < n; i++) out = select.update(input) || out;
      return out;
    };
    return { select, input, step };
  };

  it('both movement clusters drive the one human cursor', () => {
    const { select, input, step } = makeCpuSelect();
    input.pressed.add('arrowright');
    step();
    expect(select.cursor[0]).toBe(1);
    input.pressed.add('a');
    step();
    expect(select.cursor[0]).toBe(0);
  });

  it('the computer waits until the human has locked in', () => {
    const { select, step } = makeCpuSelect();
    step(60);
    expect(select.locked[1]).toBeFalsy();
  });

  it('the computer picks its fighter after the human locks', () => {
    const { select, input, step } = makeCpuSelect();
    input.pressed.add('w');
    step();
    expect(select.locked[0]).toBeTruthy();
    step(120);
    expect(select.locked[1]).toBeTruthy();
    expect(select.bothLocked).toBeTruthy();
  });

  it('backing out also backs the computer out', () => {
    const { select, input, step } = makeCpuSelect();
    input.pressed.add('w');
    step(120);
    expect(select.locked[1]).toBeTruthy();
    input.pressed.add('s');
    step();
    expect(select.locked[0]).toBeFalsy();
    expect(select.locked[1]).toBeFalsy();
  });

  it('the whole screen still finishes and hands back both picks', () => {
    const { select, input, step } = makeCpuSelect();
    input.pressed.add('w');
    const picks = step(240);
    expect(select.done).toBeTruthy();
    expect(picks.length).toBe(2);
    expect(CHARACTERS.includes(picks[1])).toBeTruthy();
  });

  it('setCpu(null) restores the two-player select', () => {
    const { select, input, step } = makeCpuSelect();
    select.setCpu(null);
    input.pressed.add('arrowright');
    step();
    expect(select.cursor[0]).toBe(0);   // arrows belong to player two again
    expect(select.cursor[1]).toBe(0);
  });
});
