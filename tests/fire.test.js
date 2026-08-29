import { describe, it, expect } from './harness.js';
import { makeInput, makeFighter, FAKE_STAGES } from './factories.js';
import { Fighter } from '../src/fighter.js';
import { Match } from '../src/match.js';
import { MOVES } from '../src/moves.js';
import { SCHEMES } from '../src/input.js';
import { CHARACTERS, byId } from '../src/characters.js';
import { AIController } from '../src/ai.js';
import * as C from '../src/config.js';

/* ASH: the fire fighter. His punch burns, his meter fills in five hits, and
   his super is the game's first projectile. Everything here runs headless
   against the real modules. */

const ASH = byId('ash');
const KAI = byId('kai');

/** A fight-phase match with ASH on p1 against KAI on p2. */
function makeFireMatch() {
  const input = makeInput();
  const p1 = new Fighter({
    name: 'ASH', startX: 300, facing: 1, scheme: SCHEMES[0], input,
    character: ASH, slot: 'p1', hudColour: '#fff',
  });
  const p2 = new Fighter({
    name: 'KAI', startX: 660, facing: -1, scheme: SCHEMES[1], input,
    character: KAI, slot: 'p2', hudColour: '#fff',
  });
  const match = new Match({ p1, p2, stages: FAKE_STAGES });
  const step = (n = 1) => { for (let i = 0; i < n; i++) match.update(input); };
  match.phase = 'fight'; match.timer = 0; match.banner = ''; match.sub = '';
  return { match, p1, p2, input, step };
}

/* Land `times` clean punches, waiting out recovery and hitstop each time. */
function landPunches(ctx, times) {
  const { p1, p2, input, step } = ctx;
  for (let i = 0; i < times; i++) {
    p1.x = 400; p2.x = 490; p2.vx = 0;
    input.pressed.add('f');
    step(1);
    let guard = 0;
    while (p1.attack && guard++ < 120) step(1);
  }
}

describe('ASH: the fire punch and the burn', () => {
  it('the punch deals 5 and comes from config', () => {
    expect(C.DAMAGE.firePunch).toBe(5);
    expect(MOVES.firePunch.dmg).toBe(5);
    const ctx = makeFireMatch();
    landPunches(ctx, 1);
    // 5 on impact; the burn has begun but barely ticked
    expect(ctx.p2.hp).toBeGreaterThan(C.MAX_HP - 5 - C.BURN_TOTAL - 0.01);
    expect(ctx.p2.hp).toBeLessThan(C.MAX_HP - 5 + 0.01);
  });

  it('a landed punch sets the opponent alight', () => {
    const ctx = makeFireMatch();
    landPunches(ctx, 1);
    expect(ctx.p2.burnTimer).toBeGreaterThan(0);
  });

  it('a blocked punch does not burn', () => {
    const { p1, p2, input, step } = makeFireMatch();
    p1.x = 400; p2.x = 490;
    input.held.add('/');
    step(2);
    input.pressed.add('f');
    step(1); step(20);
    expect(C.MAX_HP - p2.hp).toBe(MOVES.firePunch.chip);
    expect(p2.burnTimer).toBe(0);
  });

  it('the burn deals exactly BURN_TOTAL over BURN_FRAMES, then stops', () => {
    const { p2, step } = makeFireMatch();
    p2.applyBurn();
    step(C.BURN_FRAMES + 10);
    expect(p2.hp).toBe(C.MAX_HP - C.BURN_TOTAL);   // exact: no float drift
    expect(p2.burnTimer).toBe(0);
    expect(p2.burnLeft).toBe(0);
    step(C.BURN_FRAMES);                            // and it does not restart
    expect(p2.hp).toBe(C.MAX_HP - C.BURN_TOTAL);
  });

  it('a second application refreshes the burn rather than stacking it', () => {
    const { p2, step } = makeFireMatch();
    p2.applyBurn();
    step(C.BURN_FRAMES / 2);                        // half the burn pays out
    const half = C.MAX_HP - C.BURN_TOTAL / 2;
    expect(p2.hp).toBe(half);
    p2.applyBurn();                                 // re-lit mid-burn
    expect(p2.burnTimer).toBe(C.BURN_FRAMES);       // timer back to full
    expect(p2.burnLeft).toBe(C.BURN_TOTAL);         // damage back to full, not doubled
    step(C.BURN_FRAMES + 10);
    // total: half a burn plus one full burn -- never two full burns
    expect(p2.hp).toBe(half - C.BURN_TOTAL);
  });

  it('burning to death ends the round properly', () => {
    const { match, p1, p2, step } = makeFireMatch();
    p2.hp = 6;                                      // the punch leaves 1hp; the burn finishes it
    landPunches({ match, p1, p2, input: match.p1.input, step }, 1);
    expect(p2.ko).toBeFalsy();
    // step to the burn death, but not past the round-end ceremony
    let guard = 0;
    while (match.phase === 'fight' && guard++ < 300) step(1);
    expect(p2.ko).toBeTruthy();
    expect(match.phase).toBe('roundEnd');
    expect(match.sub).toBe('K.O.');
    expect(match.banner).toBe('ASH WINS');
    expect(p1.wins).toBe(1);
  });
});

describe('ASH: kick and meter', () => {
  it('his kick deals 9, from config, with his own frame data', () => {
    expect(C.DAMAGE.fireKick).toBe(9);
    const { p1, p2, input, step } = makeFireMatch();
    p1.x = 400; p2.x = 520;
    input.pressed.add('g');
    step(1); step(MOVES.fireKick.startup + MOVES.fireKick.active + 2);
    expect(C.MAX_HP - p2.hp).toBe(9);
    expect(p2.burnTimer).toBe(0);                   // only punches burn
  });

  it('the meter fills in exactly five punches', () => {
    const ctx = makeFireMatch();
    landPunches(ctx, 4);
    expect(ctx.p1.meter).toBe(80);
    expect(ctx.p1.meterFull).toBeFalsy();
    landPunches(ctx, 1);
    expect(ctx.p1.meter).toBe(C.METER_MAX);
    expect(ctx.p1.meterFull).toBeTruthy();
  });

  it('a character with a slot nulled out ignores that button entirely', () => {
    /* The move-set mechanism, not the roster: a null slot means the
       character simply does not have the move. */
    const gimped = { ...ASH, moves: { ...ASH.moves, kick: null, sweep: null } };
    const input = makeInput();
    const f = makeFighter({ character: gimped, input });
    const foe = makeFighter({ startX: 500 });
    input.pressed.add('g');
    f.update(foe, true);
    expect(f.attack).toBe(null);
    input.pressed.clear();
    input.held.add('s');
    input.pressed.add('g');                          // crouch kick: no sweep either
    f.update(foe, true);
    expect(f.attack).toBe(null);
  });
});

describe('ASH: the beam', () => {
  it('deals 15 with small knockback, per config', () => {
    expect(C.DAMAGE.fireBeam).toBe(15);
    expect(MOVES.fireBeam.cost).toBe(C.METER_MAX);
    expect(MOVES.fireBeam.kb).toBeLessThan(MOVES.punch.kb);   // small knockback
  });

  it('charges visibly before it fires', () => {
    // the long two-handed wind-up is the counterplay window
    expect(MOVES.fireBeam.startup).toBeGreaterThan(MOVES.fireKick.startup * 2);
  });

  it('burn pays 3 damage per second for 2 seconds', () => {
    expect(C.BURN_TOTAL).toBe(6);
    expect(C.BURN_FRAMES).toBe(120);
  });

  it('spends the whole meter and launches a projectile that travels', () => {
    const { match, p1, input, step } = makeFireMatch();
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1);
    expect(p1.attack.move).toBe(MOVES.fireBeam);
    expect(p1.meter).toBe(0);
    step(MOVES.fireBeam.startup);
    expect(match.projectiles.length).toBe(1);
    const x0 = match.projectiles[0].x;
    step(3);
    expect(match.projectiles[0].x).toBeGreaterThan(x0);
  });

  it('hits once for 15, with the projectile dying on contact', () => {
    const { match, p1, p2, input, step } = makeFireMatch();
    p1.x = 300; p2.x = 700;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1); step(60);
    expect(C.MAX_HP - p2.hp).toBe(15);
    expect(p2.burnTimer).toBe(0);                   // the beam is not a punch
    expect(match.projectiles.length).toBe(0);
    expect(p2.hp).toBeGreaterThan(0);
  });

  it('pushes the victim back only gently', () => {
    const { p1, p2, input, step } = makeFireMatch();
    p1.x = 300; p2.x = 700;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1);
    let guard = 0;
    while (p2.hp === C.MAX_HP && guard++ < 90) step(1);
    expect(p2.vx).toBeGreaterThan(0);
    expect(p2.vx).toBeLessThan(MOVES.kick.kb);
  });

  it('can be blocked for chip damage', () => {
    const { p1, p2, input, step } = makeFireMatch();
    p1.x = 300; p2.x = 700;
    p1.meter = C.METER_MAX;
    input.held.add('/');
    step(2);
    input.pressed.add('q');
    step(1); step(60);
    expect(C.MAX_HP - p2.hp).toBe(C.CHIP_DAMAGE.fireBeam);
    expect(p2.burnTimer).toBe(0);
  });

  it('whiffs past an airborne opponent and expires off screen', () => {
    const { match, p1, p2, input, step } = makeFireMatch();
    p1.x = 300; p2.x = 800;
    p1.meter = C.METER_MAX;
    input.pressed.add('q');
    step(1); step(MOVES.fireBeam.startup + 1);
    expect(match.projectiles.length).toBe(1);
    p2.y = 150; p2.onGround = false; p2.vy = 0;     // held out of the flight path
    const hold = () => { p2.y = 150; p2.vy = 0; };
    for (let i = 0; i < 90; i++) { hold(); step(1); }
    expect(match.projectiles.length).toBe(0);       // flew off the edge and died
    expect(p2.hp).toBe(C.MAX_HP);
  });
});

describe('ASH: the computer can play him', () => {
  it('drives him through a full match using his own move set', () => {
    const cpu = new AIController({ level: 4, scheme: SCHEMES[1], seed: 77, slot: 'p2' });
    const p1 = new Fighter({
      name: 'K', startX: 300, facing: 1, scheme: SCHEMES[0], input: makeInput(),
      character: KAI, slot: 'p1', hudColour: '#fff',
    });
    const p2 = new Fighter({
      name: 'A', startX: 660, facing: -1, scheme: SCHEMES[1], input: cpu.input,
      character: ASH, slot: 'p2', hudColour: '#fff',
    });
    const match = new Match({ p1, p2, stages: FAKE_STAGES });
    const io = makeInput();
    let ticks = 0, sawFireMove = false;
    while (match.phase !== 'matchEnd' && ticks++ < 40000) {
      cpu.update(match);
      match.update(io);
      if (p2.attack && p2.attack.move.key.startsWith('fire')) sawFireMove = true;
    }
    expect(match.phase).toBe('matchEnd');
    expect(sawFireMove).toBeTruthy();               // it used ASH's own moves
    expect(p1.hp < C.MAX_HP || p1.wins < 2).toBeTruthy();
  });
});
