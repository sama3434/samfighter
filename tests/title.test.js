import { describe, it, expect } from './harness.js';
import { makeInput } from './factories.js';
import { TitleScreen } from '../src/title.js';
import { logoBox, renderTitle } from '../src/render/title.js';
import { PW, PH } from '../src/pixel/buffer.js';
import { W, H } from '../src/config.js';
import { SCHEMES } from '../src/input.js';

const makeTitle = () => {
  const input = makeInput();
  const title = new TitleScreen({ schemes: SCHEMES });
  const step = (n = 1) => {
    let out = null;
    for (let i = 0; i < n; i++) out = title.update(input) || out;
    return out;
  };
  return { title, input, step };
};

/* The boot screen is a line of wiring in main.js, and main.js cannot be
   imported here: it grabs the game canvas and starts a render loop. Reading
   the source is the only way to assert where the game starts without
   standing the whole game up inside the test page. */
function source(path) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', path, false);      // the harness runs tests synchronously
  xhr.send(null);
  return xhr.responseText;
}

describe('title screen', () => {
  it('the game boots on the title, so a reload always returns to it', () => {
    expect(/let screen = 'title';/.test(source('../src/main.js'))).toBeTruthy();
  });

  it('main dispatches the title in both the tick and the draw', () => {
    const src = source('../src/main.js');
    expect(/if \(screen === 'title'\) \{\s*\n\s*if \(title\.update/.test(src)).toBeTruthy();
    expect(/if \(screen === 'title'\) renderTitle/.test(src)).toBeTruthy();
  });

  it('waits, returning nothing, until a key arrives', () => {
    const { step } = makeTitle();
    expect(step(120)).toBe(null);
  });

  it('enter advances', () => {
    const { input, step } = makeTitle();
    input.pressed.add('enter');
    expect(step()).toEqual({ start: true });
  });

  it("player one's confirm keys advance it too", () => {
    for (const key of ['w', 'f', 'g']) {
      const { input, step } = makeTitle();
      input.pressed.add(key);
      expect(step()).toEqual({ start: true });
    }
  });

  it("player two's confirm keys advance it too", () => {
    for (const key of ['arrowup', ',', '.']) {
      const { input, step } = makeTitle();
      input.pressed.add(key);
      expect(step()).toEqual({ start: true });
    }
  });

  it('unrelated keys do not advance it', () => {
    for (const key of ['a', 'd', 's', 'escape', 'shift', 'h', '/']) {
      const { input, step } = makeTitle();
      input.pressed.add(key);
      expect(step()).toBe(null);
    }
  });

  it("consumes the tick's presses, so one keypress starts one thing", () => {
    const { input, step } = makeTitle();
    input.pressed.add('enter');
    step();
    expect(input.pressed.size).toBe(0);
  });

  it('counts frames, which is what drives the blink and the shimmer', () => {
    const { title, step } = makeTitle();
    expect(title.frame).toBe(0);
    step(30);
    expect(title.frame).toBe(30);
    title.reset();
    expect(title.frame).toBe(0);
  });
});

describe('title screen art', () => {
  it('the logo is far bigger than a line of body text', () => {
    const box = logoBox();
    expect(box.w).toBeGreaterThan(PW * 0.7);
    expect(box.h).toBeGreaterThan(PH * 0.4);
  });

  it('the logo stays inside the buffer with a margin on every side', () => {
    const box = logoBox();
    expect(box.x).toBeGreaterThan(8);
    expect(box.y).toBeGreaterThan(8);
    expect(box.x + box.w).toBeLessThan(PW - 8);
    expect(box.y + box.h).toBeLessThan(PH - 8);
  });

  it('every logo edge lands on a whole pixel', () => {
    const box = logoBox();
    for (const v of [box.x, box.y, box.w, box.h]) expect(v).toBe(Math.round(v));
  });

  it('reaches the display canvas through the 2x blit', () => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    renderTitle(ctx, { frame: 0 });

    const box = logoBox();
    const d = ctx.getImageData(box.x * 2, box.y * 2, box.w * 2, box.h * 2).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) opaque++;
    expect(opaque).toBeGreaterThan(0);
  });
});
