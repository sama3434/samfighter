import { Fighter } from '../src/fighter.js';
import { Match } from '../src/match.js';
import { SCHEMES } from '../src/input.js';

/* Test doubles: fighters driven by a bare input pair, and a match on fake
   stages so nothing here touches a canvas. */

export function makeInput() {
  return { held: new Set(), pressed: new Set() };
}

export function makeFighter(overrides = {}) {
  return new Fighter({
    name: 'P', startX: 300, facing: 1, scheme: SCHEMES[0],
    input: overrides.input || makeInput(),
    palette: 'p1', hudColour: '#fff',
    ...overrides,
  });
}

export const FAKE_STAGES = [
  { key: 'a', name: 'A', drift: 'none', paint() {}, overlay() {} },
  { key: 'b', name: 'B', drift: 'none', paint() {}, overlay() {} },
  { key: 'c', name: 'C', drift: 'none', paint() {}, overlay() {} },
  { key: 'd', name: 'D', drift: 'none', paint() {}, overlay() {} },
];

/** A match already in the fight phase, with both fighters under test control. */
export function makeMatch() {
  const input = makeInput();
  const p1 = makeFighter({ name: 'PLAYER 1', startX: 300, facing: 1, input, scheme: SCHEMES[0] });
  const p2 = makeFighter({ name: 'PLAYER 2', startX: 660, facing: -1, input, scheme: SCHEMES[1] });
  const match = new Match({ p1, p2, stages: FAKE_STAGES });

  const step = (n = 1) => { for (let i = 0; i < n; i++) match.update(input); };
  const fight = () => {
    match.phase = 'fight';
    match.timer = 0;
    match.banner = '';
    match.sub = '';
    input.held.clear();
    input.pressed.clear();
  };

  fight();
  return { match, p1, p2, input, step, fight };
}
