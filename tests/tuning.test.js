import { describe, it, expect } from './harness.js';
import { MOVES } from '../src/moves.js';
import * as C from '../src/config.js';

/* Damage lives in config.js and is wired into moves.js by key. That wiring is
   silent when it breaks -- a missing entry gives a move `undefined` damage,
   which turns a fighter's health into NaN on the first hit rather than
   throwing anywhere useful. These checks catch that at test time. */

describe('damage configuration', () => {
  it('every move takes its damage from config', () => {
    for (const [key, move] of Object.entries(MOVES)) {
      if (C.DAMAGE[key] === undefined) throw new Error(`DAMAGE has no entry for "${key}"`);
      if (move.dmg !== C.DAMAGE[key]) {
        throw new Error(`${key} deals ${move.dmg}, config says ${C.DAMAGE[key]}`);
      }
    }
  });

  it('every move takes its chip damage from config', () => {
    for (const [key, move] of Object.entries(MOVES)) {
      if (C.CHIP_DAMAGE[key] === undefined) {
        throw new Error(`CHIP_DAMAGE has no entry for "${key}"`);
      }
      if (move.chip !== C.CHIP_DAMAGE[key]) {
        throw new Error(`${key} chips ${move.chip}, config says ${C.CHIP_DAMAGE[key]}`);
      }
    }
  });

  it('has no damage entries for moves that do not exist', () => {
    for (const key of Object.keys(C.DAMAGE)) {
      if (!MOVES[key]) throw new Error(`DAMAGE has a stale entry for "${key}"`);
    }
    for (const key of Object.keys(C.CHIP_DAMAGE)) {
      if (!MOVES[key]) throw new Error(`CHIP_DAMAGE has a stale entry for "${key}"`);
    }
  });

  it('every damage value is a positive number', () => {
    for (const [key, value] of Object.entries(C.DAMAGE)) {
      if (!Number.isFinite(value) || value <= 0) throw new Error(`DAMAGE.${key} is ${value}`);
    }
    for (const [key, value] of Object.entries(C.CHIP_DAMAGE)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`CHIP_DAMAGE.${key} is ${value}`);
    }
  });

  it('chip never exceeds the damage it is chipping from', () => {
    for (const key of Object.keys(MOVES)) {
      expect(C.CHIP_DAMAGE[key]).toBeLessThan(C.DAMAGE[key]);
    }
  });

  it('no single move can take a fighter from full health to zero', () => {
    for (const [key, value] of Object.entries(C.DAMAGE)) {
      if (value >= C.MAX_HP) throw new Error(`DAMAGE.${key} would one-shot a fighter`);
    }
  });

  it('the heavy-hit threshold sits inside the damage range', () => {
    const values = Object.values(C.DAMAGE);
    expect(C.HEAVY_HIT_DAMAGE).toBeGreaterThan(Math.min(...values) - 1);
    expect(C.HEAVY_HIT_DAMAGE).toBeLessThan(Math.max(...values) + 1);
  });
});
