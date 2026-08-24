import { describe, it, expect } from './harness.js';
import { PW, PH, PGROUND } from '../src/pixel/buffer.js';
import { STAGES, DRIFT_COUNTS, seedDrifters, drawOverlay, stageCanvas } from '../src/stages/index.js';
import { crowd, bystander, CROWD_POSES, CROWD_HEADS, CROWD_GARBS,
         shade, mixCol, makeDepth, person, FIGHTER_H, METRE } from '../src/stages/props.js';
import { DEPTH as templeDepth, PEOPLE as templePeople } from '../src/stages/temple.js';
import { DEPTH as pyramidsDepth, PEOPLE as pyramidsPeople } from '../src/stages/pyramids.js';
import { DEPTH as cityDepth, PEOPLE as cityPeople } from '../src/stages/city.js';
import { DEPTH as mountainDepth, PEOPLE as mountainPeople } from '../src/stages/mountain.js';

const scratch = () => {
  const cv = document.createElement('canvas');
  cv.width = PW; cv.height = PH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  return { cv, c };
};

const painted = (cv, x, y, w, h) => {
  const d = cv.getContext('2d').getImageData(x, y, w, h).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  return n;
};

describe('drift particles', () => {
  it('every stage asks for a particle kind the registry can seed', () => {
    for (const s of STAGES) {
      if (DRIFT_COUNTS[s.drift] === undefined) {
        throw new Error(`stage ${s.key} drifts "${s.drift}", which nothing seeds`);
      }
    }
  });

  it('every stage overlay runs against its own drifters', () => {
    const { cv, c } = scratch();
    for (const s of STAGES) {
      seedDrifters(s.drift);
      for (let f = 0; f < 4; f++) drawOverlay(c, s, f * 7);
    }
    expect(cv.width).toBe(PW);
  });
});

describe('crowd', () => {
  it('paints a full-size layer and puts people in it', () => {
    const cv = crowd([{ x: 240, y: PGROUND, h: 46, pose: 'stand', face: 1 }],
                     { cloth: ['#7a5a3a'] }, { seed: 1 });
    expect(cv.width).toBe(PW);
    expect(cv.height).toBe(PH);
    expect(painted(cv, 220, PGROUND - 50, 40, 52)).toBeGreaterThan(120);
  });

  it('rolls a different figure for each member of the same crowd', () => {
    const people = [];
    for (let i = 0; i < 8; i++) people.push({ x: 30 + i * 52, y: PGROUND, h: 44 });
    const cv = crowd(people, { cloth: ['#7a5a3a', '#3f5a8c', '#8a4438'] }, { seed: 9 });
    const shapes = new Set();
    for (let i = 0; i < 8; i++) shapes.add(painted(cv, 30 + i * 52 - 24, PGROUND - 50, 48, 52));
    // identical figures would give identical pixel counts
    expect(shapes.size).toBeGreaterThan(5);
  });

  it('keeps a figure inside the box its height implies', () => {
    const { cv, c } = scratch();
    bystander(c, 240, PGROUND, 46, {
      base: '#7a5a3a', hi: '#a88a5c', lo: '#4a3320', belt: '#2b2118',
      shoe: '#2b2118', skin: '#e8b487', skinHi: '#ffd6ab', hair: '#241d1a',
    }, { pose: 'cheer', head: 'brim', garb: 'coat', load: 'staff' }, 1);
    expect(painted(cv, 0, 0, PW, PGROUND - 80)).toBe(0);
    expect(painted(cv, 0, PGROUND + 3, PW, PH - PGROUND - 3)).toBe(0);
    expect(painted(cv, 0, 0, 190, PH)).toBe(0);
    expect(painted(cv, 300, 0, PW - 300, PH)).toBe(0);
  });

  it('draws every declared pose, headgear and garment without throwing', () => {
    const { cv, c } = scratch();
    const pal = {
      base: '#7a5a3a', hi: '#a88a5c', lo: '#4a3320', belt: '#2b2118',
      shoe: '#2b2118', skin: '#e8b487', skinHi: '#ffd6ab', hair: '#241d1a',
    };
    for (const pose of CROWD_POSES) {
      for (const head of CROWD_HEADS) {
        for (const garb of CROWD_GARBS) {
          for (const h of [28, 40, 50]) {
            bystander(c, 240, PGROUND, h, pal, { pose, head, garb }, -1);
          }
        }
      }
    }
    expect(painted(cv, 200, PGROUND - 56, 80, 58)).toBeGreaterThan(100);
  });

  it('accepts the bare pose-name form as well as an options object', () => {
    const a = scratch(), b = scratch();
    const pal = {
      base: '#7a5a3a', hi: '#a88a5c', lo: '#4a3320', belt: '#2b2118',
      shoe: '#2b2118', skin: '#e8b487', skinHi: '#ffd6ab', hair: '#241d1a',
    };
    bystander(a.c, 240, PGROUND, 44, pal, 'point', 1);
    bystander(b.c, 240, PGROUND, 44, pal, { pose: 'point' }, 1);
    expect(painted(a.cv, 200, PGROUND - 50, 80, 52))
      .toBe(painted(b.cv, 200, PGROUND - 50, 80, 52));
  });
});

describe('depth system', () => {
  it('a figure standing on the fighters\' plane is fighter-sized', () => {
    const d = makeDepth(130);
    expect(d.size(PGROUND)).toBe(FIGHTER_H);
    expect(d.size(PGROUND, 1.75)).toBe(FIGHTER_H);
  });

  it('shrinks toward the horizon and grows in front of the ground line', () => {
    const d = makeDepth(130);
    let prev = 0;
    for (let y = 140; y <= PH; y += 5) {
      const h = d.size(y);
      if (h < prev) throw new Error(`size not monotonic at y=${y}`);
      prev = h;
    }
    if (d.size(180) >= FIGHTER_H) throw new Error('mid-distance figure not smaller');
    if (d.size(PH) <= FIGHTER_H) throw new Error('foreground figure not larger');
  });

  it('sizes real things off the same line: doors, storeys, counters', () => {
    const d = makeDepth(130);
    expect(d.size(PGROUND, 2.0)).toBe(128);           // a doorway
    expect(d.size(PGROUND, 3.0)).toBe(192);           // one storey
    expect(d.size(PGROUND, 0.9)).toBe(58);            // a counter, a barrel
    expect(Math.round(METRE * 1.75)).toBe(FIGHTER_H);
  });

  it('feetFor inverts size, to within the pixel grid', () => {
    const d = makeDepth(130);
    for (const h of [30, 56, 80, 112]) {
      const got = d.size(d.feetFor(h));
      if (Math.abs(got - h) > 1) {
        throw new Error(`feetFor(${h}) round-trips to ${got}`);
      }
    }
  });

  it('person() cannot disagree with its own ground line', () => {
    const d = makeDepth(130);
    for (const y of [160, 175, 200, PGROUND]) {
      expect(person(d, 100, y).h).toBe(d.size(y));
    }
  });
});

describe('stage crowds obey the depth system', () => {
  const manifests = [
    ['temple', templeDepth, templePeople],
    ['pyramids', pyramidsDepth, pyramidsPeople],
    ['city', cityDepth, cityPeople],
    ['mountain', mountainDepth, mountainPeople],
  ];

  it('every crowd figure is sized by where its feet meet the ground', () => {
    for (const [key, depth, people] of manifests) {
      for (const p of people) {
        if (p.h !== depth.size(p.y)) {
          throw new Error(`${key}: figure at (${p.x}, ${p.y}) is ${p.h}px, plane says ${depth.size(p.y)}`);
        }
      }
    }
  });

  it('nobody on the fighters\' plane is dwarf-sized', () => {
    for (const [key, , people] of manifests) {
      for (const p of people) {
        if (p.y >= PGROUND - 6 && (p.h < 100 || p.h > 118)) {
          throw new Error(`${key}: near-plane figure at (${p.x}, ${p.y}) is ${p.h}px`);
        }
      }
    }
  });

  it('every figure stands between the horizon and the frame edge', () => {
    for (const [key, depth, people] of manifests) {
      for (const p of people) {
        if (p.y <= depth.horizonY + 10 || p.y > PH) {
          throw new Error(`${key}: figure at (${p.x}, ${p.y}) has no ground to stand on`);
        }
      }
    }
  });
});

describe('colour helpers', () => {
  it('shade darkens and clamps to six hex digits', () => {
    expect(shade('#ffffff', 0.5)).toBe('#808080');
    expect(shade('#102030', 0)).toBe('#000000');
    expect(shade('#808080', 4)).toBe('#ffffff');
  });

  it('mixCol interpolates between two colours', () => {
    expect(mixCol('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixCol('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixCol('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('stage paint cost', () => {
  it('paints every stage inside a sane budget', () => {
    for (const s of STAGES) {
      const cv = document.createElement('canvas');
      cv.width = PW; cv.height = PH;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      const t0 = performance.now();
      s.paint(c);
      const ms = performance.now() - t0;
      if (ms > 90) throw new Error(`${s.key} took ${ms.toFixed(1)}ms to paint`);
      console.log(`stage ${s.key}: ${ms.toFixed(1)}ms`);
    }
    expect(stageCanvas(STAGES[0]).width).toBe(PW);
  });
});
