/* A minimal test harness. There is no Node on this machine and the game has
   no build step, so tests run in the browser against the real modules. */

const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function it(name, fn) {
  if (!current) throw new Error('it() outside describe()');
  current.tests.push({ name, fn });
}

export const expect = (actual) => ({
  toBe(want) {
    if (actual !== want) throw new Error(`expected ${fmt(want)}, got ${fmt(actual)}`);
  },
  toEqual(want) {
    const a = JSON.stringify(actual), b = JSON.stringify(want);
    if (a !== b) throw new Error(`expected ${b}, got ${a}`);
  },
  toBeCloseTo(want, tol = 0.5) {
    if (Math.abs(actual - want) > tol) throw new Error(`expected ~${want}, got ${actual}`);
  },
  toBeGreaterThan(want) {
    if (!(actual > want)) throw new Error(`expected > ${want}, got ${actual}`);
  },
  toBeLessThan(want) {
    if (!(actual < want)) throw new Error(`expected < ${want}, got ${actual}`);
  },
  toBeTruthy() {
    if (!actual) throw new Error(`expected truthy, got ${fmt(actual)}`);
  },
  toBeFalsy() {
    if (actual) throw new Error(`expected falsy, got ${fmt(actual)}`);
  },
});

const fmt = (v) => (typeof v === 'string' ? `"${v}"` : String(v));

export function run(mount) {
  let passed = 0, failed = 0;
  const out = [];

  for (const suite of suites) {
    out.push(`<h2>${suite.name}</h2>`);
    for (const t of suite.tests) {
      try {
        t.fn();
        passed++;
        out.push(`<div class="ok">PASS &nbsp;${t.name}</div>`);
      } catch (err) {
        failed++;
        out.push(`<div class="fail">FAIL &nbsp;${t.name}<br><span>${err.message}</span></div>`);
      }
    }
  }

  const summary = `<div class="summary ${failed ? 'bad' : 'good'}">` +
    `${passed} passed, ${failed} failed</div>`;
  mount.innerHTML = summary + out.join('');
  window.TEST_RESULT = { passed, failed };
  return { passed, failed };
}
