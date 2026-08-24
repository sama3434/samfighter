import { PW, PH, PGROUND } from '../pixel/buffer.js';
import { stage as temple } from './temple.js';
import { stage as pyramids } from './pyramids.js';
import { stage as city } from './city.js';
import { stage as mountain } from './mountain.js';
import { stage as pirate } from './pirate.js';

/* Stage registry. Adding a stage means writing one module and adding it to
   this list -- nothing else in the game needs to know about it. */
export const STAGES = [temple, pyramids, city, mountain, pirate];

/* Stages are expensive to paint (a 480x235 dithered sky and a few hundred
   details), so each one is rendered once into its own canvas and blitted
   thereafter. Only the animated overlay is redrawn per frame. */
const cache = new Map();

export function stageCanvas(stage) {
  if (!cache.has(stage.key)) {
    const cv = document.createElement('canvas');
    cv.width = PW;
    cv.height = PH;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    stage.paint(c);
    cache.set(stage.key, cv);
  }
  return cache.get(stage.key);
}

/** Paint every stage up front so the first round on each is not a hitch. */
export function warmStages() {
  for (const s of STAGES) stageCanvas(s);
}

/* Drifting overlay particles (petals, snow, birds). Owned here so stages stay
   pure paint functions. */
export const DRIFT_COUNTS = Object.freeze({ snow: 90, petals: 50, birds: 6, spray: 80, none: 0 });
const COUNTS = DRIFT_COUNTS;
let drifters = [];

export function seedDrifters(kind) {
  const n = COUNTS[kind] ?? 0;
  drifters = [];
  for (let i = 0; i < n; i++) {
    drifters.push({
      x: Math.random() * PW,
      y: Math.random() * PGROUND,
      s: 0.25 + Math.random() * 0.8,
      w: Math.random() * Math.PI * 2,
      k: 0.6 + Math.random() * 0.9,
    });
  }
}

export function drawOverlay(c, stage, frame) {
  stage.overlay(c, frame, drifters);
}
