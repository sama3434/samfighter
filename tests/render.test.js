import { describe, it, expect } from './harness.js';
import { makeMatch } from './factories.js';
import { PW, PH, PSCALE, PGROUND, wp } from '../src/pixel/buffer.js';
import { GROUND, W, H } from '../src/config.js';
import { textWidth, GLYPHS, GLYPH_H, GLYPH_W } from '../src/pixel/font.js';
import { poseOf, attackExtension } from '../src/render/poses.js';
import { STAGES, stageCanvas } from '../src/stages/index.js';
import { MOVES } from '../src/moves.js';

describe('pixel buffer', () => {
  it('upscales to the display canvas by a whole number', () => {
    expect(W / PW).toBe(PSCALE);
    expect(H / PH).toBe(PSCALE);
  });

  it('puts the floor on an exact pixel', () => {
    expect(GROUND / PSCALE).toBe(PGROUND);
    expect(wp(GROUND)).toBe(PGROUND);
  });
});

describe('bitmap font', () => {
  it('every glyph is the declared size', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      if (rows.length !== GLYPH_H) throw new Error(`${ch} has ${rows.length} rows`);
      for (const r of rows) {
        if (r.length !== GLYPH_W) throw new Error(`${ch} row "${r}" is not ${GLYPH_W} wide`);
      }
    }
  });

  it('measures text width including the gaps', () => {
    expect(textWidth('AB', 1)).toBe(11);
    expect(textWidth('AB', 2)).toBe(22);
  });

  it('covers every character the HUD can print', () => {
    const used = 'PLAYER 12 WINS THE MATCH ROUND FIGHT! K.O. TIME OVER DRAW ' +
                 'PRESS ENTER FOR A REMATCH TEMPLE PYRAMIDS CITY MOUNTAIN 0123456789';
    for (const ch of used.toUpperCase()) {
      if (!GLYPHS[ch]) throw new Error(`no glyph for "${ch}"`);
    }
  });
});

describe('poses', () => {
  it('returns a full skeleton for every state', () => {
    const { p1, p2, input, step } = makeMatch();
    const joints = ['hip', 'sh', 'head', 'bl', 'fl', 'ba', 'fa'];
    const states = [
      () => {},
      () => { input.held.add('s'); step(2); },
      () => { input.held.add('h'); step(2); },
      () => { input.pressed.add('w'); step(1); step(4); },
      () => { input.pressed.add('f'); step(1); step(5); },
      () => { input.pressed.add('g'); step(1); step(9); },
      () => { p1.hitstun = 5; },
    ];
    for (const enter of states) {
      const fresh = makeMatch();
      enter.call(null);
      const pose = poseOf(p1, 0);
      for (const j of joints) {
        if (!pose[j]) throw new Error(`pose ${pose.kind} is missing ${j}`);
      }
      input.held.clear();
      p1.hitstun = 0;
      void fresh; void p2;
    }
  });

  it('knocked down and KO both use the down pose', () => {
    const { p1 } = makeMatch();
    p1.downTimer = 10;
    expect(poseOf(p1, 0).kind).toBe('down');
    p1.downTimer = 0;
    p1.ko = true;
    expect(poseOf(p1, 0).kind).toBe('down');
  });

  it('extension peaks exactly across the active frames', () => {
    const m = MOVES.kick;
    expect(attackExtension({ move: m, t: 0 })).toBe(0);
    expect(attackExtension({ move: m, t: m.startup })).toBe(1);
    expect(attackExtension({ move: m, t: m.startup + m.active - 1 })).toBe(1);
    expect(attackExtension({ move: m, t: m.startup + m.active })).toBeLessThan(1);
  });
});

describe('stage art', () => {
  it('every stage paints without throwing and fills the buffer', () => {
    for (const s of STAGES) {
      const cv = stageCanvas(s);
      expect(cv.width).toBe(PW);
      expect(cv.height).toBe(PH);
      const px = cv.getContext('2d').getImageData(PW - 2, 2, 1, 1).data;
      if (px[3] !== 255) throw new Error(`${s.key} left its sky transparent`);
    }
  });

  it('declares the fields the game reads', () => {
    for (const s of STAGES) {
      for (const key of ['key', 'name', 'drift', 'paint', 'overlay']) {
        if (s[key] === undefined) throw new Error(`stage ${s.key} has no ${key}`);
      }
    }
  });

  it('has a unique key per stage', () => {
    expect(new Set(STAGES.map((s) => s.key)).size).toBe(STAGES.length);
  });
});
