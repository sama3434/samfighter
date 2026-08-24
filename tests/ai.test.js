import { describe, it, expect } from './harness.js';
import { AIController, PROFILES, mulberry32 } from '../src/ai.js';
import { Fighter } from '../src/fighter.js';
import { Match } from '../src/match.js';
import { SCHEMES } from '../src/input.js';
import { CHARACTERS } from '../src/characters.js';
import { FAKE_STAGES } from './factories.js';

/* The computer opponent, proven by playing.

   The simulation is canvas-free, so these tests run entire matches: the
   real Match, real Fighters, and the real AI on both sides. The difficulty
   ladder is asserted from measured win rates, not from reading the knobs. */

const idleInput = () => ({ held: new Set(), pressed: new Set() });

/* A stand-in for someone who has never played: wanders at the opponent,
   mashes attack buttons, never blocks. Level 1 must be beatable by this;
   the upper levels must crush it. */
function makeMasher(scheme, seed) {
  const rng = mulberry32(seed);
  const input = idleInput();
  let plan = 'in', thinkAt = 0, t = 0;
  return {
    input,
    update(m) {
      if (m.hitstop > 0) return;
      input.held.clear();
      input.pressed.clear();
      if (m.phase !== 'fight') return;
      t++;
      const me = m.p1, foe = m.p2;
      if (me.ko || me.downTimer > 0 || me.hitstun > 0 || me.attack) return;
      const dx = foe.x - me.x;
      if (t >= thinkAt) {
        thinkAt = t + 24 + rng() * 20;
        plan = rng() < 0.65 ? 'in' : (rng() < 0.5 ? 'out' : 'idle');
      }
      if (plan === 'in') input.held.add(dx > 0 ? scheme.right : scheme.left);
      if (plan === 'out') input.held.add(dx > 0 ? scheme.left : scheme.right);
      if (rng() < 0.01) input.pressed.add(scheme.up);
      if (rng() < 0.035) input.pressed.add(rng() < 0.5 ? scheme.punch : scheme.kick);
    },
  };
}

const cpuP1 = (level, seed) => new AIController({ level, scheme: SCHEMES[0], seed, slot: 'p1' });
const cpuP2 = (level, seed) => new AIController({ level, scheme: SCHEMES[1], seed, slot: 'p2' });

/* Run one full match, driver1 on p1, driver2 (the AI under test) on p2.
   Returns who won plus how each round ended. */
function playMatch(driver1, driver2, { onTick, cap = 40000 } = {}) {
  const p1 = new Fighter({
    name: 'B', startX: 300, facing: 1, scheme: SCHEMES[0],
    input: driver1 ? driver1.input : idleInput(),
    character: CHARACTERS[0], slot: 'p1', hudColour: '#fff',
  });
  const p2 = new Fighter({
    name: 'C', startX: 660, facing: -1, scheme: SCHEMES[1],
    input: driver2.input, character: CHARACTERS[1], slot: 'p2', hudColour: '#fff',
  });
  const match = new Match({ p1, p2, stages: FAKE_STAGES });
  const io = idleInput();
  let kos = 0, timeouts = 0, prevPhase = match.phase, ticks = 0;
  while (match.phase !== 'matchEnd' && ticks < cap) {
    if (driver1) driver1.update(match);
    driver2.update(match);
    match.update(io);
    ticks++;
    if (match.phase === 'roundEnd' && prevPhase === 'fight') {
      if (match.sub === 'K.O.') kos++; else timeouts++;
    }
    prevPhase = match.phase;
    if (onTick) onTick(match, p1, p2);
  }
  return { p2won: p2.wins > p1.wins, kos, timeouts, ticks, p1, p2 };
}

describe('computer opponent: the difficulty ladder', () => {
  /* Two fixed benchmarks: the masher separates the bottom of the ladder,
     a level-3 opponent separates the top. Everything is seeded, so these
     are exact counts, not flaky statistics. */
  const N = 10;
  const wins = [];
  const timeoutsAtL5 = { count: 0, rounds: 0 };

  for (let L = 1; L <= 5; L++) {
    let w = 0;
    for (let i = 0; i < N; i++) {
      const s = i + L * 500;
      const r = playMatch(makeMasher(SCHEMES[0], s * 7 + 1), cpuP2(L, s * 2 + 2));
      w += r.p2won ? 1 : 0;
      if (L === 5) { timeoutsAtL5.count += r.timeouts; timeoutsAtL5.rounds += r.kos + r.timeouts; }
    }
    for (let i = 0; i < N; i++) {
      const s = i * 13 + L * 1000;
      const r = playMatch(cpuP1(3, s * 2 + 1), cpuP2(L, s * 2 + 2));
      w += r.p2won ? 1 : 0;
      if (L === 5) { timeoutsAtL5.count += r.timeouts; timeoutsAtL5.rounds += r.kos + r.timeouts; }
    }
    wins.push(w);
  }

  it('win rate rises strictly with level', () => {
    for (let i = 1; i < wins.length; i++) {
      if (!(wins[i] > wins[i - 1])) {
        throw new Error(`level ${i + 1} won ${wins[i]}/${2 * N}, ` +
                        `level ${i} won ${wins[i - 1]}/${2 * N}`);
      }
    }
  });

  it('level 1 loses to a button-masher', () => {
    expect(wins[0]).toBeLessThan(0.25 * 2 * N);
  });

  it('level 5 wins nearly everything', () => {
    expect(wins[4]).toBeGreaterThan(0.85 * 2 * N);
  });

  it('level 5 finishes by knockout, not by running the clock', () => {
    // a rare timeout against a fleeing opponent is fine; a pattern is not
    expect(timeoutsAtL5.rounds).toBeGreaterThan(30);
    expect(timeoutsAtL5.count).toBeLessThan(3);
  });
});

describe('computer opponent: conduct', () => {
  it('only ever presses player two keys', () => {
    const cpu = cpuP2(4, 9);
    const bench = cpuP1(3, 10);
    const own = new Set(Object.values(SCHEMES[1]));
    const other = new Set(Object.values(SCHEMES[0]));
    const seen = new Set();
    playMatch(bench, cpu, {
      cap: 6000,
      onTick() { for (const k of cpu.input.held) seen.add(k); for (const k of cpu.input.pressed) seen.add(k); },
    });
    expect(seen.size).toBeGreaterThan(0);
    for (const k of seen) {
      if (!own.has(k)) throw new Error(`pressed foreign key "${k}"`);
      if (other.has(k)) throw new Error(`pressed player one key "${k}"`);
    }
  });

  it('is deterministic given a seed', () => {
    const trace = () => {
      const out = [];
      let t = 0;
      playMatch(cpuP1(3, 51), cpuP2(5, 52), {
        cap: 4000,
        onTick(m, p1, p2) { if (++t % 50 === 0) out.push(p1.x | 0, p1.hp, p2.x | 0, p2.hp); },
      });
      return out.join(',');
    };
    expect(trace()).toBe(trace());
  });

  it('level 1 still walks in and finishes a statue', () => {
    // the bottom of the ladder must be gentle, not passive
    const r = playMatch(null, cpuP2(1, 42));
    expect(r.p2won).toBeTruthy();
    expect(r.timeouts).toBe(0);
  });

  it('no profile reacts frame-perfectly or swings every frame', () => {
    /* Blocks can *begin* on any frame, because high levels stand in guard
       by anticipation -- that is human. What would not be human is a zero
       reaction delay, an unjittered one, or no gap between swings. */
    for (const P of Object.values(PROFILES)) {
      expect(P.react).toBeGreaterThan(3);
      expect(P.reactJit).toBeGreaterThan(2);
      expect(P.cool).toBeGreaterThan(4);
    }
  });
});
