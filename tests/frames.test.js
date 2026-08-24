import { describe, it, expect } from './harness.js';
import { CHARACTERS } from '../src/characters.js';
import { SHEETS, frameFor } from '../src/render/frames/index.js';
import { GLYPHS, PALETTE_KEYS, isGlyph } from '../src/render/frames/glyphs.js';
import { baked } from '../src/render/frames/bake.js';
import { paintBody, scratch, SPR_AX, SPR_AY } from '../src/render/sprite.js';
import { MOVES } from '../src/moves.js';

/* Frame data is a picture written as text, which means the failure modes are
   all textual: a row a character short, a glyph nobody defined, a palette key
   one character has and the other does not. None of those show up as an
   exception -- they show up as a hole in a fighter -- so they get asserted
   here instead. */

/** Every frame in a sheet, flattened, with a name for the failure message. */
function allFrames() {
  const out = [];
  const walk = (id, label, entry) => {
    if (!entry) return;
    if (Array.isArray(entry)) entry.forEach((f, i) => walk(id, `${label}[${i}]`, f));
    else if (entry.rows) out.push([`${id}.${label}`, entry]);
    else for (const [k, v] of Object.entries(entry)) walk(id, `${label}.${k}`, v);
  };
  for (const [id, sheet] of Object.entries(SHEETS)) {
    for (const [pose, entry] of Object.entries(sheet)) walk(id, pose, entry);
  }
  return out;
}

/** Bounding box of whatever is opaque in a canvas. */
function bbox(cv) {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const fighterLike = (character, over = {}) => ({
  character, slot: 'p1', attack: null, ko: false, downTimer: 0, hitstun: 0,
  onGround: true, blocking: false, crouching: false, stunTimer: 0,
  vx: 0, vy: 0, walkPhase: 0, facing: 1, blockFlash: 0, ...over,
});

describe('frame data', () => {
  it('draws at least one frame per character on the roster', () => {
    for (const c of CHARACTERS) {
      const sheet = SHEETS[c.id];
      if (!sheet) throw new Error(`${c.id} has no sheet at all`);
    }
    expect(allFrames().length).toBeGreaterThan(0);
  });

  it('gives every frame square rows', () => {
    for (const [name, f] of allFrames()) {
      if (!f.rows.length) throw new Error(`${name} has no rows`);
      const w = f.rows[0].length;
      if (w === 0) throw new Error(`${name} has zero-width rows`);
      for (const [i, r] of f.rows.entries()) {
        if (r.length !== w) {
          throw new Error(`${name} row ${i} is ${r.length} wide, not ${w}`);
        }
      }
    }
  });

  it('uses only glyphs the alphabet defines', () => {
    for (const [name, f] of allFrames()) {
      for (const [i, r] of f.rows.entries()) {
        for (const ch of r) {
          if (!isGlyph(ch)) throw new Error(`${name} row ${i} uses "${ch}"`);
        }
      }
    }
  });

  it('names palette keys every character actually has', () => {
    for (const c of CHARACTERS) {
      for (const slot of ['p1', 'p2']) {
        const p = c.palettes[slot];
        for (const key of PALETTE_KEYS) {
          if (!p[key]) throw new Error(`${c.id}/${slot} has no "${key}"`);
        }
      }
    }
  });

  it('keeps fixed-colour glyphs out of the palette contract', () => {
    for (const [ch, g] of Object.entries(GLYPHS)) {
      if (!g) continue;
      if (g.key && g.col) throw new Error(`glyph "${ch}" is both keyed and fixed`);
      if (!g.key && !g.col) throw new Error(`glyph "${ch}" resolves to nothing`);
    }
  });

  it('anchors every frame inside its own picture', () => {
    for (const [name, f] of allFrames()) {
      const w = f.rows[0].length, h = f.rows.length;
      if (!(f.ax >= 0 && f.ax <= w)) throw new Error(`${name} ax ${f.ax} outside 0..${w}`);
      if (!(f.ay >= 0 && f.ay <= h)) throw new Error(`${name} ay ${f.ay} outside 0..${h}`);
    }
  });

  it('fits every frame inside the scratch buffer once anchored', () => {
    for (const [name, f] of allFrames()) {
      const w = f.rows[0].length, h = f.rows.length;
      const left = SPR_AX - f.ax - 1;
      const top = SPR_AY - f.ay - 1;
      if (left < 0 || top < 0 || left + w + 2 > scratch.width || top + h + 2 > scratch.height) {
        throw new Error(`${name} (${w}x${h} at ${f.ax},${f.ay}) spills out of the scratch buffer`);
      }
    }
  });
});

describe('frame rendering', () => {
  it('bakes every frame in every palette without a hole in it', () => {
    for (const c of CHARACTERS) {
      for (const slot of ['p1', 'p2']) {
        for (const [name, f] of allFrames()) {
          if (!name.startsWith(c.id + '.')) continue;
          const { canvas } = baked(`test/${slot}/${name}`, f, c.palettes[slot]);
          const box = bbox(canvas);
          if (box.x1 < 0) throw new Error(`${name} baked to nothing in ${slot}`);
        }
      }
    }
  });

  it('leaves no pinholes for the keyline to fall into', () => {
    /* A transparent pixel with solid neighbours on all four sides is a hole
       inside the figure. The keyline pass fills every such pixel, so what
       started as a one-pixel gap in a diagonal limb comes out as a speck of
       black scattered across a thigh. */
    for (const [name, f] of allFrames()) {
      const w = f.rows[0].length, h = f.rows.length;
      const solid = (x, y) =>
        x < 0 || y < 0 || x >= w || y >= h ? false : f.rows[y][x] !== '.';
      const holes = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (f.rows[y][x] !== '.') continue;
          if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) {
            holes.push(`${x},${y}`);
          }
        }
      }
      if (holes.length) {
        throw new Error(`${name} has ${holes.length} pinhole(s): ${holes.slice(0, 5).join(' ')}`);
      }
    }
  });

  it('bakes the same frame once and hands the same canvas back', () => {
    const [, f] = allFrames()[0];
    const p = CHARACTERS[0].palettes.p1;
    expect(baked('test/cache', f, p)).toBe(baked('test/cache', f, p));
  });
});

describe('hand-drawn and procedural agree on scale', () => {
  /* A hand-drawn pose and a procedural one have to stand the same height on
     the same floor, or a fighter visibly grows the moment an undrawn pose
     comes up -- and the hurtbox, which is fixed, stops matching either. */
  it('stands every set of soles on the anchor row', () => {
    for (const c of CHARACTERS) {
      const box = bbox(paintBody(fighterLike(c), 0));
      // the keyline adds a row under the soles, so the lowest lit row is AY
      expect(box.y1).toBe(SPR_AY);
    }
  });

  it('draws a hand-drawn idle and a procedural pose to the same height', () => {
    for (const c of CHARACTERS) {
      const drawn = bbox(paintBody(fighterLike(c), 0));
      // `stunned` has no hand-drawn frame, so this one comes off the skeleton
      const proc = bbox(paintBody(fighterLike(c, { stunTimer: 30 }), 0));
      expect(proc.y1).toBe(drawn.y1);
      if (Math.abs(proc.y0 - drawn.y0) > 5) {
        throw new Error(`${c.id}: drawn top ${drawn.y0} vs procedural ${proc.y0}`);
      }
    }
  });

  it('keeps a crouch shorter than a stand but off the floor', () => {
    for (const c of CHARACTERS) {
      const stand = bbox(paintBody(fighterLike(c), 0));
      const low = bbox(paintBody(fighterLike(c, { crouching: true }), 0));
      expect(low.h).toBeLessThan(stand.h);
      expect(low.h).toBeGreaterThan(stand.h * 0.6);
      expect(low.y1).toBe(SPR_AY);
    }
  });
});

describe('frame lookup', () => {
  it('falls back to the procedural renderer for an undrawn pose', () => {
    const c = CHARACTERS[0];
    // nobody has drawn a knockdown, so this must still paint something
    const box = bbox(paintBody(fighterLike(c, { downTimer: 20 }), 0));
    expect(box.x1).toBeGreaterThan(0);
  });

  it('falls back for a character with no sheet at all', () => {
    const stranger = { ...CHARACTERS[0], id: 'nobody' };
    expect(frameFor(fighterLike(stranger), { kind: 'idle' }, 0)).toBe(null);
    const box = bbox(paintBody(fighterLike(stranger), 0));
    expect(box.x1).toBeGreaterThan(0);
  });

  it('picks a different frame for each phase of an attack', () => {
    const c = CHARACTERS[0];
    const m = MOVES.punch;
    const at = (t) => frameFor(fighterLike(c, { attack: { move: m, t } }),
                              { kind: 'punch' }, 0);
    const startup = at(0);
    const active = at(m.startup);
    expect(startup.id === active.id).toBeFalsy();
    // recovery reuses the startup drawing: retracting passes back through it
    expect(at(m.startup + m.active).frame).toBe(startup.frame);
  });

  it('gives every hand-drawn pose a distinct cache id', () => {
    const c = CHARACTERS[0];
    const ids = new Set();
    const seen = [];
    const push = (f, pose) => {
      const hit = frameFor(f, pose, 0);
      if (hit) { ids.add(hit.id); seen.push(hit.id); }
    };
    push(fighterLike(c), { kind: 'idle' });
    push(fighterLike(c), { kind: 'block' });
    push(fighterLike(c), { kind: 'crouch' });
    push(fighterLike(c, { vy: -5 }), { kind: 'jump' });
    push(fighterLike(c, { attack: { move: MOVES.kick, t: MOVES.kick.startup } }),
         { kind: 'kick' });
    expect(ids.size).toBe(seen.length);
  });

  it('walks through its whole cycle as the stride advances', () => {
    const c = CHARACTERS[0];
    const ids = new Set();
    for (let i = 0; i < 40; i++) {
      const hit = frameFor(fighterLike(c, { walkPhase: i * 0.22 }), { kind: 'walk' }, 0);
      if (hit) ids.add(hit.id);
    }
    expect(ids.size).toBe(SHEETS[c.id].walk.length);
  });
});
