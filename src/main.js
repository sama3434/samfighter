import * as C from './config.js';
import { Fighter } from './fighter.js';
import { Match } from './match.js';
import { SCHEMES, input, attachInput } from './input.js';
import { Sound } from './audio.js';
import { STAGES, warmStages, seedDrifters } from './stages/index.js';
import { renderFrame } from './render/scene.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const p1 = new Fighter({
  name: 'PLAYER 1', startX: 300, facing: 1, scheme: SCHEMES[0], input,
  palette: 'p1', hudColour: '#8fc0f8',
});
const p2 = new Fighter({
  name: 'PLAYER 2', startX: 660, facing: -1, scheme: SCHEMES[1], input,
  palette: 'p2', hudColour: '#ff9b8c',
});

const match = new Match({ p1, p2, stages: STAGES, sound: Sound });
match.onStageChange = (stage) => seedDrifters(stage.drift);
seedDrifters(match.stage.drift);

attachInput(window, () => Sound.unlock());
warmStages();

/* Fixed-timestep loop: the simulation always advances in 1/60s steps no
   matter what the display does, so the game plays identically on a 60Hz and
   a 144Hz screen. Rendering happens once per animation frame. */
let last = performance.now();
let accumulator = 0;

function frame(now) {
  accumulator += Math.min(now - last, 250);   // cap catch-up after a tab stall
  last = now;
  while (accumulator >= C.STEP) {
    match.update(input);
    accumulator -= C.STEP;
  }
  renderFrame(ctx, match);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// exposed for the browser test page and for poking at a live match in devtools
window.SAMFIGHTER = { match, p1, p2, input, C };
