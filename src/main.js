import * as C from './config.js';
import { Fighter } from './fighter.js';
import { Match } from './match.js';
import { SelectScreen } from './select.js';
import { ModeScreen } from './mode.js';
import { AIController } from './ai.js';
import { CHARACTERS } from './characters.js';
import { SCHEMES, input, attachInput } from './input.js';
import { Sound } from './audio.js';
import { Music } from './music.js';
import { installMusicUI } from './music/ui.js';
import { STAGES, warmStages, seedDrifters } from './stages/index.js';
import { renderFrame } from './render/scene.js';
import { renderSelect } from './render/select.js';
import { renderMode } from './render/mode.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* Three screens: pick a mode, pick your fighter, then fight. The select
   screen owns the picks; the match is rebuilt from them each time so a
   rematch can change characters. In a computer match, player two is driven
   by an AIController writing into its own { held, pressed } pair -- the
   fighter cannot tell the difference. */
const mode = new ModeScreen({ schemes: SCHEMES, sound: Sound });
const select = new SelectScreen({ schemes: SCHEMES, roster: CHARACTERS, sound: Sound });
let screen = 'mode';
let match = null;
let cpu = null;

function startMatch([first, second], { cpuLevel = null, seed } = {}) {
  cpu = cpuLevel
    ? new AIController({
        level: cpuLevel, scheme: SCHEMES[1],
        seed: seed !== undefined ? seed : (Math.random() * 2 ** 31) | 0,
      })
    : null;

  const p1 = new Fighter({
    startX: 300, facing: 1, scheme: SCHEMES[0], input,
    character: first, slot: 'p1', hudColour: '#8fc0f8',
  });
  const p2 = new Fighter({
    startX: 660, facing: -1, scheme: SCHEMES[1], input: cpu ? cpu.input : input,
    character: second, slot: 'p2', hudColour: '#ff9b8c',
  });

  // a mirror match needs the names distinguished, or the HUD lies
  if (cpu) {
    p2.name = `${second.name} CPU L${cpuLevel}`;
  } else if (first === second) {
    p1.name = `${first.name} 1P`;
    p2.name = `${second.name} 2P`;
  }

  match = new Match({ p1, p2, stages: STAGES, sound: Sound });
  match.onStageChange = (stage) => seedDrifters(stage.drift);
  seedDrifters(match.stage.drift);
  screen = 'match';
}

function tick() {
  /* The music watches the match rather than the match driving the music: a
     handful of comparisons per tick, nothing allocated, and match.js stays
     unaware that any of this exists. */
  Music.sync(screen, match);

  if (screen === 'mode') {
    const choice = mode.update(input);
    if (choice) {
      select.setCpu(choice.mode === 'cpu' ? choice.level : null);
      select.reset();
      screen = 'select';
    }
    return;
  }

  if (screen === 'select') {
    // Escape backs out to the mode screen
    if (input.pressed.has('escape')) {
      input.pressed.clear();
      mode.reset();
      screen = 'mode';
      return;
    }
    const picks = select.update(input);
    if (picks) startMatch(picks, { cpuLevel: select.cpu });
    return;
  }

  // once the match is over, Enter goes back to the roster
  if (match.phase === 'matchEnd' && input.pressed.has('enter')) {
    input.pressed.clear();
    select.reset();
    screen = 'select';
    return;
  }
  if (cpu) cpu.update(match);
  match.update(input);
}

function draw() {
  if (screen === 'mode') renderMode(ctx, mode);
  else if (screen === 'select') renderSelect(ctx, select, CHARACTERS);
  else renderFrame(ctx, match);
}

/* Browsers hold audio until a gesture. The effects already unlock on the
   first keypress, so the music joins them there rather than inventing a
   second gate. */
attachInput(window, () => {
  Sound.unlock();
  Music.attach(Sound.ctx);
});
Sound.onCue = (name) => Music.cue(name);
installMusicUI(Music);
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
    tick();
    accumulator -= C.STEP;
  }
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// exposed for the browser test page and for poking at a live game in devtools
window.SAMFIGHTER = {
  get match() { return match; },
  get screen() { return screen; },
  get cpu() { return cpu; },
  mode, select, input, C, CHARACTERS, startMatch, Music, Sound,
};
