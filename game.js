'use strict';

/* ============================================================
   SAM FIGHTER — local 1v1, two players on one keyboard.
   Fixed 60Hz simulation, frame-based move data, no assets.
   ============================================================ */

const W = 960, H = 540;
const GROUND = 471;          // floor line; divides evenly by PSCALE
const WALL = 40;             // playfield inset
const STEP = 1000 / 60;

const GRAVITY = 1.35;
const JUMP_V = -23.25;
const MOVE_SPEED = 6.3;
const AIR_DRIFT = 0.675;
const FRICTION = 0.72;

const MAX_HP = 100;
const ROUND_TIME = 60;       // seconds
const WINS_NEEDED = 2;

const BODY_W = 84;
const STAND_H = 168;
const CROUCH_H = 114;

/* ---------- move data (all durations in frames) ---------- */
const MOVES = {
  punch:    { startup: 4, active: 4, recovery: 9,  dmg: 7,  reach: 99,  top: -144, h: 39, kb: 5.25, kbY: 0,     hitstun: 13, blockstun: 7,  chip: 1, tone: 'punch' },
  kick:     { startup: 8, active: 6, recovery: 17, dmg: 13, reach: 129, top: -108, h: 45, kb: 9.0,  kbY: -5.25, hitstun: 20, blockstun: 12, chip: 2, tone: 'kick'  },
  sweep:    { startup: 7, active: 5, recovery: 21, dmg: 10, reach: 123, top: -45,  h: 42, kb: 6.0,  kbY: 0,     hitstun: 24, blockstun: 12, chip: 2, tone: 'kick',  knockdown: true, low: true },
  airPunch: { startup: 3, active: 8, recovery: 6,  dmg: 8,  reach: 93,  top: -126, h: 51, kb: 4.5,  kbY: 0,     hitstun: 14, blockstun: 8,  chip: 1, tone: 'punch', air: true },
  airKick:  { startup: 5, active: 10, recovery: 8, dmg: 14, reach: 120, top: -84,  h: 60, kb: 7.5,  kbY: 0,     hitstun: 18, blockstun: 10, chip: 2, tone: 'kick',  air: true },
};

/* ---------- input ---------- */
const held = new Set();
const pressed = new Set();   // edge-triggered, consumed each tick

const SCHEMES = [
  { left: 'a', right: 'd', up: 'w', down: 's', punch: 'f', kick: 'g', block: 'h' },
  { left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown', punch: ',', kick: '.', block: '/' },
];

const BLOCKED_DEFAULTS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', '/', "'"]);

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (BLOCKED_DEFAULTS.has(k)) e.preventDefault();
  if (!e.repeat) pressed.add(k);
  held.add(k);
  Sound.unlock();
});

addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => { held.clear(); pressed.clear(); });

/* ---------- sound: tiny WebAudio synth, no files ---------- */
const Sound = {
  ctx: null,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  blip(freq, dur, type = 'square', gain = 0.06) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },
  punch() { this.blip(320, 0.09, 'square', 0.05); },
  kick()  { this.blip(180, 0.16, 'sawtooth', 0.06); },
  block() { this.blip(700, 0.06, 'triangle', 0.04); },
  whiff() { this.blip(120, 0.05, 'sine', 0.02); },
  ko()    { this.blip(90, 0.55, 'sawtooth', 0.08); },
  bell()  { this.blip(880, 0.25, 'triangle', 0.05); },
};

/* ---------- fighter ---------- */
class Fighter {
  constructor(name, x, facing, scheme, palKey, hudCol) {
    this.name = name;
    this.startX = x;
    this.facing = facing;
    this.scheme = scheme;
    this.palKey = palKey;   // key into PALETTES in the render layer
    this.hudCol = hudCol;   // name colour on the health bar
    this.wins = 0;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.hp = MAX_HP;
    this.shownHp = MAX_HP;
    this.onGround = true;
    this.crouching = false;
    this.blocking = false;
    this.attack = null;        // { key, move, t, hasHit }
    this.hitstun = 0;
    this.blockFlash = 0;
    this.downTimer = 0;        // knocked down / KO'd
    this.ko = false;
    this.walkPhase = 0;
    this.airAttackUsed = false;
  }

  get height() { return this.crouching ? CROUCH_H : STAND_H; }

  hurtbox() {
    const h = this.downTimer > 0 ? 44 : this.height;
    return { x: this.x - BODY_W / 2, y: this.y - h, w: BODY_W, h };
  }

  hitbox() {
    if (!this.attack) return null;
    const m = this.attack.move;
    if (this.attack.t < m.startup || this.attack.t >= m.startup + m.active) return null;
    const front = this.facing > 0 ? this.x + 21 : this.x - 21 - m.reach;
    return { x: front, y: this.y + m.top, w: m.reach, h: m.h };
  }

  down(action) { return held.has(this.scheme[action]); }
  tapped(action) { return pressed.has(this.scheme[action]); }

  canAct() {
    return !this.ko && this.downTimer === 0 && this.hitstun === 0 && !this.attack;
  }

  startAttack(key) {
    this.attack = { key, move: MOVES[key], t: 0, hasHit: false };
  }

  update(opp, live) {
    // --- knocked down / KO'd ---
    if (this.ko || this.downTimer > 0) {
      this.physics();
      if (this.downTimer > 0 && this.onGround) this.downTimer--;
      return;
    }

    // face the opponent whenever we're free to move
    if (this.canAct() && this.onGround) {
      const dx = opp.x - this.x;
      if (Math.abs(dx) > 6) this.facing = dx > 0 ? 1 : -1;
    }

    if (this.hitstun > 0) {
      this.hitstun--;
      this.physics();
      return;
    }

    // --- attack progression ---
    if (this.attack) {
      const m = this.attack.move;
      this.attack.t++;
      if (this.attack.t >= m.startup + m.active + m.recovery) this.attack = null;
      // grounded attacks lock movement; air attacks keep momentum
      if (this.onGround) this.vx *= FRICTION;
      this.physics();
      return;
    }

    if (!live) { this.vx *= FRICTION; this.physics(); return; }

    // --- stance ---
    this.crouching = this.onGround && this.down('down');
    this.blocking = this.onGround && this.down('block');
    if (this.blockFlash > 0) this.blockFlash--;

    // --- attacks ---
    const wantPunch = this.tapped('punch');
    const wantKick = this.tapped('kick');
    if (wantPunch || wantKick) {
      if (!this.onGround) {
        if (this.airAttackUsed) { this.physics(); return; }
        this.airAttackUsed = true;
        this.startAttack(wantPunch ? 'airPunch' : 'airKick');
      }
      else if (this.crouching && wantKick) this.startAttack('sweep');
      else this.startAttack(wantPunch ? 'punch' : 'kick');
      Sound.whiff();
      this.physics();
      return;
    }

    // --- movement ---
    const dir = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    if (this.onGround) {
      if (this.blocking || this.crouching) {
        this.vx *= FRICTION;
      } else {
        this.vx = dir * MOVE_SPEED * (dir === this.facing ? 1 : 0.72); // walking back is slower
        if (dir !== 0) this.walkPhase += 0.22; else this.walkPhase = 0;
      }
      if (this.tapped('up') && !this.crouching) {
        this.vy = JUMP_V;
        this.vx = dir * MOVE_SPEED * 1.05;
        this.onGround = false;
      }
    } else {
      this.vx += dir * AIR_DRIFT;
      this.vx = clamp(this.vx, -MOVE_SPEED * 1.3, MOVE_SPEED * 1.3);
    }

    this.physics();
  }

  physics() {
    this.x += this.vx;
    this.y += this.vy;
    if (!this.onGround) this.vy += GRAVITY;

    if (this.y >= GROUND) {
      this.y = GROUND;
      this.vy = 0;
      if (!this.onGround) {
        this.onGround = true;
        this.airAttackUsed = false;
        if (this.attack && this.attack.move.air) this.attack = null;
      }
    } else {
      this.onGround = false;
    }

    this.x = clamp(this.x, WALL + BODY_W / 2, W - WALL - BODY_W / 2);
    if (this.onGround) this.vx *= FRICTION;
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
  }

  takeHit(move, fromDir, blocked) {
    if (blocked) {
      this.hp -= move.chip;
      this.hitstun = move.blockstun;
      this.vx = fromDir * move.kb * 0.45;
      this.blockFlash = 8;
    } else {
      this.hp -= move.dmg;
      this.hitstun = move.hitstun;
      this.vx = fromDir * move.kb;
      if (move.kbY && this.onGround) { this.vy = move.kbY; this.onGround = false; }
      this.attack = null;
      this.crouching = false;
      if (move.knockdown) { this.downTimer = 48; this.hitstun = 0; }
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.ko = true;
      this.downTimer = 999;
      this.attack = null;
      this.vx = fromDir * 5;
      this.vy = -7;
      this.onGround = false;
    }
  }
}

/* ---------- helpers ---------- */
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function lerp(a, b, t) { return a + (b - a) * t; }

/* ---------- game state ---------- */
const P1 = new Fighter('PLAYER 1', 300, 1, SCHEMES[0], 'p1', '#7fb2f0');
const P2 = new Fighter('PLAYER 2', 660, -1, SCHEMES[1], 'p2', '#f79b8c');

const game = {
  phase: 'intro',      // intro | fight | roundEnd | matchEnd
  timer: 0,            // frames in current phase
  frame: 0,            // free-running frame counter, drives stage overlays
  stage: STAGES[0],    // rotates every round
  stageStart: 0,       // which stage this match opened on
  clock: ROUND_TIME * 60,
  round: 1,
  banner: '',
  sub: '',
  hitstop: 0,
  shake: 0,
  particles: [],
};

const DRIFT_BY_STAGE = { temple: 'petals', pyramids: 'birds', city: 'none', mountain: 'snow' };

function startRound() {
  game.stage = STAGES[(game.stageStart + game.round - 1) % STAGES.length];
  seedDrifters(DRIFT_BY_STAGE[game.stage.key]);
  P1.reset(); P2.reset();
  P1.facing = 1; P2.facing = -1;
  game.clock = ROUND_TIME * 60;
  game.phase = 'intro';
  game.timer = 0;
  game.banner = 'ROUND ' + game.round;
  game.sub = game.stage.name;
  game.particles.length = 0;
  Sound.bell();
}

function startMatch() {
  P1.wins = 0; P2.wins = 0;
  game.round = 1;
  // open on a different stage each match so a session doesn't repeat itself
  game.stageStart = (game.stageStart + 1) % STAGES.length;
  startRound();
}

function endRound(winner, sub) {
  game.phase = 'roundEnd';
  game.timer = 0;
  if (winner) {
    winner.wins++;
    game.banner = winner.name + ' WINS';
  } else {
    game.banner = 'DRAW';
  }
  game.sub = sub || '';
  Sound.ko();
}

function spark(x, y, n, color, power) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.5 + Math.random()) * power;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1,
      life: 16 + Math.random() * 14,
      max: 30,
      color,
    });
  }
}

/* ---------- combat resolution ---------- */
function resolveHits(a, b) {
  if (!a.attack || a.attack.hasHit) return;
  const box = a.hitbox();
  if (!box) return;
  if (b.ko) return;
  const hurt = b.hurtbox();
  if (!overlaps(box, hurt)) return;

  a.attack.hasHit = true;
  const m = a.attack.move;
  const dir = a.facing;

  // blocking works when you're holding block and facing the attacker,
  // but a sweep goes under a standing guard.
  const facingAttacker = (b.x - a.x) * b.facing < 0;
  const guardBeatsIt = !(m.low && !b.crouching);
  const blocked = b.blocking && facingAttacker && guardBeatsIt && b.downTimer === 0;

  b.takeHit(m, dir, blocked);

  const hx = dir > 0 ? box.x + box.w : box.x;
  const hy = box.y + box.h / 2;

  if (blocked) {
    spark(hx, hy, 7, '#bfe4ff', 3.3);
    game.hitstop = 3;
    game.shake = 2;
    Sound.block();
  } else {
    spark(hx, hy, 16, m.dmg >= 12 ? '#ffd166' : '#fff3c4', 5.1);
    game.hitstop = m.dmg >= 12 ? 8 : 5;
    game.shake = m.dmg >= 12 ? 9 : 5;
    Sound[m.tone]();
  }
}

function separate(a, b) {
  if (a.ko || b.ko) return;
  const min = BODY_W - 12;
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  if (dist >= min) return;
  const push = (min - dist) / 2;
  const s = dx >= 0 ? 1 : -1;
  a.x -= push * s;
  b.x += push * s;
  a.x = clamp(a.x, WALL + BODY_W / 2, W - WALL - BODY_W / 2);
  b.x = clamp(b.x, WALL + BODY_W / 2, W - WALL - BODY_W / 2);
}

/* ---------- update ---------- */
function update() {
  game.timer++;
  game.frame++;
  if (game.shake > 0) game.shake *= 0.86;

  for (const p of game.particles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.33; p.vx *= 0.96; p.life--;
  }
  game.particles = game.particles.filter((p) => p.life > 0);

  P1.shownHp = lerp(P1.shownHp, P1.hp, 0.12);
  P2.shownHp = lerp(P2.shownHp, P2.hp, 0.12);

  if (game.hitstop > 0) { game.hitstop--; pressed.clear(); return; }

  switch (game.phase) {
    case 'intro':
      P1.update(P2, false);
      P2.update(P1, false);
      if (game.timer === 60) { game.banner = 'FIGHT!'; game.sub = ''; Sound.bell(); }
      if (game.timer > 90) { game.phase = 'fight'; game.timer = 0; game.banner = ''; }
      break;

    case 'fight': {
      P1.update(P2, true);
      P2.update(P1, true);
      separate(P1, P2);
      resolveHits(P1, P2);
      resolveHits(P2, P1);

      game.clock--;
      if (P1.ko || P2.ko) {
        const winner = P1.ko && P2.ko ? null : (P1.ko ? P2 : P1);
        endRound(winner, 'K.O.');
      } else if (game.clock <= 0) {
        game.clock = 0;
        const winner = P1.hp === P2.hp ? null : (P1.hp > P2.hp ? P1 : P2);
        endRound(winner, 'TIME OVER');
      }
      break;
    }

    case 'roundEnd':
      P1.update(P2, false);
      P2.update(P1, false);
      separate(P1, P2);
      if (game.timer > 150) {
        if (P1.wins >= WINS_NEEDED || P2.wins >= WINS_NEEDED) {
          game.phase = 'matchEnd';
          game.timer = 0;
          const champ = P1.wins > P2.wins ? P1 : P2;
          game.banner = champ.name + ' WINS THE MATCH';
          game.sub = 'PRESS ENTER FOR A REMATCH';
        } else {
          game.round++;
          startRound();
        }
      }
      break;

    case 'matchEnd':
      P1.update(P2, false);
      P2.update(P1, false);
      if (pressed.has('enter')) startMatch();
      break;
  }

  if (pressed.has('enter') && game.phase !== 'matchEnd') {
    // hard reset from anywhere
    startMatch();
  }

  pressed.clear();
}

/* ============================================================
   RENDERING — everything lands in the 320x180 pixel buffer
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// world units -> pixel-buffer units
const wp = (v) => Math.round(v / PSCALE);

/* ---------- sprite scratch buffer ---------- */
const SPR_W = 104, SPR_H = 92;
const SPR_AX = 52, SPR_AY = 80;      // anchor sits at the fighter's feet
const scv = document.createElement('canvas');
scv.width = SPR_W; scv.height = SPR_H;
const sctx = scv.getContext('2d');
sctx.imageSmoothingEnabled = false;

const OUTLINE = '#140b16';

const PALETTES = {
  p1: { gi: '#3d7fd6', giLo: '#22508f', giHi: '#84b8f4', skin: '#f0c090', skinLo: '#bf8a5e',
        hair: '#241d33', band: '#e8e4f0', bandLo: '#a9a4bd', glove: '#d9403c', gloveLo: '#8f2320' },
  p2: { gi: '#e2504a', giLo: '#93262a', giHi: '#f79b8c', skin: '#f5cf9e', skinLo: '#c4926a',
        hair: '#f0c95e', band: '#2c2436', bandLo: '#171223', glove: '#2f2a44', gloveLo: '#191426' },
};

/* local sprite space: x runs forward (fighter always drawn facing right),
   y runs up from the feet. */
const L = (x0, y0, x1, y1, t, col) => pxLine(sctx, SPR_AX + x0, SPR_AY - y0, SPR_AX + x1, SPR_AY - y1, t, col);
const R = (x, y, w, h, col) => pxRect(sctx, SPR_AX + x, SPR_AY - y - h, w, h, col);
const C = (x, y, r, col) => pxCircle(sctx, SPR_AX + x, SPR_AY - y, r, col);

/* ---------- pose solver ----------
   Returns joint positions for the fighter's current state. Every pose is
   the same skeleton, so limbs stay consistent between animations. */
function poseOf(f) {
  const m = f.attack ? f.attack.move : null;
  const t = f.attack ? f.attack.t : 0;
  const ext = m
    ? (t < m.startup ? 0.35 * (t / Math.max(1, m.startup))
      : t < m.startup + m.active ? 1
      : 0.55 * (1 - (t - m.startup - m.active) / Math.max(1, m.recovery)))
    : 0;

  const breathe = Math.sin(game.timer * 0.07) * 0.6;

  if (f.ko || f.downTimer > 0) return { kind: 'down' };

  if (f.hitstun > 0) {
    return {
      kind: 'hurt',
      hip: [-3, 23], sh: [-8, 41], head: [-11, 50],
      bl: [[-7, 12], [-11, 0]], fl: [[3, 12], [5, 0]],
      ba: [[-6, 35], [-4, 42]], fa: [[0, 35], [4, 43]],
    };
  }

  if (m === MOVES.punch || m === MOVES.airPunch) {
    const air = m === MOVES.airPunch;
    const armY = air ? 36 : 41;
    return {
      kind: 'punch', fist: true,
      hip: [0, air ? 26 : 23], sh: [-1, air ? 44 : 42], head: [1, air ? 53 : 51],
      bl: air ? [[-6, 18], [-10, 20]] : [[-6, 12], [-9, 0]],
      fl: air ? [[7, 17], [3, 10]] : [[6, 12], [10, 0]],
      ba: [[-6, 36], [-9, 33]],
      fa: [[4 + 11 * ext, armY], [9 + 22 * ext, armY - (air ? 5 * ext : 0)]],
    };
  }

  if (m === MOVES.kick) {
    return {
      kind: 'kick', bareFoot: true,
      hip: [-2, 23], sh: [-6, 41], head: [-5, 50],
      bl: [[-6, 12], [-9, 0]],
      fl: [[9 + 9 * ext, 22], [13 + 27 * ext, 23 + 3 * ext]],
      ba: [[-9, 34], [-13, 30]], fa: [[2, 36], [5, 39]],
    };
  }

  if (m === MOVES.airKick) {
    return {
      kind: 'kick', bareFoot: true,
      hip: [0, 26], sh: [-3, 43], head: [-2, 52],
      bl: [[-5, 18], [-9, 21]],
      fl: [[11, 21], [24 + 9 * ext, 17]],
      ba: [[-7, 36], [-10, 41]], fa: [[3, 37], [7, 41]],
    };
  }

  if (m === MOVES.sweep) {
    return {
      kind: 'sweep', bareFoot: true,
      hip: [0, 11], sh: [-3, 26], head: [-2, 35],
      bl: [[-6, 6], [-9, 0]],
      fl: [[9 + 8 * ext, 7], [13 + 27 * ext, 2]],
      ba: [[-8, 14], [-12, 1]], fa: [[3, 19], [6, 15]],
    };
  }

  if (!f.onGround) {
    return {
      kind: 'jump',
      hip: [0, 26], sh: [1, 44], head: [2, 53],
      bl: [[-6, 18], [-10, 20]], fl: [[7, 17], [3, 10]],
      ba: [[-3, 37], [-7, 41]], fa: [[8, 38], [12, 42]],
    };
  }

  if (f.blocking) {
    return {
      kind: 'block', guard: true,
      hip: [-2, 23], sh: [-2, 42], head: [-2, 51],
      bl: [[-7, 12], [-10, 0]], fl: [[4, 12], [6, 0]],
      ba: [[5, 34], [7, 43]], fa: [[8, 33], [10, 42]],
    };
  }

  if (f.crouching) {
    return {
      kind: 'crouch',
      hip: [0, 13], sh: [0, 28], head: [1, 37],
      bl: [[-8, 8], [-10, 0]], fl: [[8, 8], [10, 0]],
      ba: [[4, 22], [8, 19]], fa: [[7, 21], [11, 18]],
    };
  }

  // idle / walk share the skeleton; the stride drives the legs
  const moving = Math.abs(f.vx) > 0.4;
  const sw = moving ? Math.sin(f.walkPhase) : 0;
  const lift = moving ? Math.abs(sw) * 1.5 : breathe;
  return {
    kind: 'idle',
    hip: [0, 24 + lift * 0.5], sh: [1, 42 + lift * 0.5], head: [2, 51 + lift * 0.5],
    bl: [[-4 + sw * 4, 13], [-7 + sw * 9, Math.max(0, sw * 3)]],
    fl: [[5 + sw * 3, 13], [8 - sw * 9, Math.max(0, -sw * 3)]],
    ba: [[3 - sw * 2, 34], [7 - sw * 3, 30]],
    fa: [[7 + sw * 2, 36], [11 + sw * 2, 33]],
  };
}

/* ---------- draw one fighter into the scratch buffer ---------- */
function paintBody(f) {
  const p = PALETTES[f.palKey];
  const pose = poseOf(f);

  sctx.clearRect(0, 0, SPR_W, SPR_H);

  if (pose.kind === 'down') {
    // on their back, head trailing behind, knees still half-bent
    L(4, 5, 15, 4, 8, p.giLo);          // near leg
    L(15, 4, 22, 8, 7, p.giLo);
    R(21, 7, 4, 6, p.skinLo);
    L(4, 8, 16, 9, 8, p.gi);            // far leg
    L(16, 9, 24, 6, 7, p.gi);
    R(23, 4, 6, 4, p.skin);
    R(-6, 4, 12, 10, p.gi);             // torso flat on the floor
    R(-6, 11, 12, 3, p.giHi);
    R(2, 4, 4, 10, p.band);             // belt
    L(-4, 12, 2, 17, 5, p.giLo);        // arm flung back
    R(-8, 14, 5, 5, p.gloveLo);
    L(-6, 7, -11, 7, 6, p.skin);        // neck
    C(-14, 8, 6, p.skin);               // head
    C(-16, 9, 5, p.hair);
    R(-13, 11, 8, 2, p.band);
    L(-17, 12, -23, 13, 2, p.band);
    pxRect(sctx, SPR_AX - 12, SPR_AY - 8, 3, 1, '#241d33');   // shut eye
    applyOutline(sctx, SPR_W, SPR_H, OUTLINE);
    return;
  }

  const [hx, hy] = pose.hip;
  const [sx, sy] = pose.sh;
  const [hdx, hdy] = pose.head;
  const [[bkx, bky], [bfx, bfy]] = pose.bl;
  const [[fkx, fky], [ffx, ffy]] = pose.fl;
  const [[bex, bey], [bhx, bhy]] = pose.ba;
  const [[fex, fey], [fhx, fhy]] = pose.fa;

  // --- back leg: gi trousers to the ankle, bare foot below ---
  L(hx - 1, hy, bkx, bky, 8, p.giLo);
  L(bkx, bky, bfx, bfy + 3, 7, p.giLo);
  R(bfx - 4, bfy, 8, 3, p.skinLo);

  // --- back arm: sleeve, forearm, fist ---
  L(sx - 1, sy - 1, bex, bey, 7, p.giLo);
  L(bex, bey, bhx, bhy, 5, p.skinLo);
  R(bhx - 3, bhy - 3, 6, 6, p.gloveLo);

  // --- torso ---
  L(hx, hy, sx, sy, 14, p.gi);
  R(sx - 8, sy - 3, 16, 6, p.gi);                 // shoulder yoke
  L(sx - 2, sy + 1, hx + 1, hy + 6, 4, p.giHi);   // lapel catching the light
  L(sx + 4, sy, hx + 4, hy + 5, 3, p.giLo);
  R(hx - 8, hy - 3, 16, 4, p.band);               // belt
  R(hx - 8, hy - 3, 16, 1, p.bandLo);
  L(hx - 7, hy - 3, hx - 11, hy - 11, 3, p.band); // belt tails
  L(hx - 4, hy - 3, hx - 7, hy - 12, 2, p.bandLo);

  // --- front leg ---
  L(hx + 1, hy, fkx, fky, 8, p.gi);
  L(fkx, fky, ffx, ffy + 3, 7, p.gi);
  R(ffx - 4, ffy, 9, 3, p.skin);
  if (pose.kind === 'kick' || pose.kind === 'sweep') {
    R(ffx - 2, ffy, 8, 4, p.skin);                // striking foot reads heavier
    R(ffx + 3, ffy, 3, 4, p.skinLo);
  }

  // --- front arm ---
  L(sx + 1, sy, fex, fey, 7, p.gi);
  L(fex, fey, fhx, fhy, 5, p.skin);
  R(fhx - 3, fhy - 3, 7, 7, p.glove);
  R(fhx - 3, fhy - 3, 7, 2, p.gloveLo);
  if (pose.guard) {
    R(fex - 2, fey - 3, 5, 12, p.gi);             // forearms stacked in guard
    R(bex - 2, bey - 4, 5, 12, p.giLo);
  }

  // --- head ---
  C(hdx - 1, hdy + 1, 7, p.hair);                 // hair mass
  R(hdx - 9, hdy - 1, 7, 7, p.hair);              // hair down the back
  C(hdx + 1, hdy - 1, 7, p.skin);                 // face, offset forward
  R(hdx - 7, hdy - 3, 6, 6, p.skinLo);            // jaw in shadow
  R(hdx - 6, hdy + 3, 13, 3, p.band);             // headband across the brow
  R(hdx - 6, hdy + 3, 13, 1, p.bandLo);
  L(hdx - 6, hdy + 4, hdx - 15, hdy + 7, 2, p.band);    // trailing ties
  L(hdx - 8, hdy + 4, hdx - 14, hdy + 1, 2, p.bandLo);
  pxRect(sctx, SPR_AX + hdx + 3, SPR_AY - hdy - 1, 2, 2, '#241d33');   // eye
  R(hdx + 6, hdy - 4, 2, 3, p.skinLo);            // chin edge

  applyOutline(sctx, SPR_W, SPR_H, OUTLINE);
}

function drawFighter(f) {
  const fx = wp(f.x);
  const fy = wp(f.y);

  // contact shadow
  const airT = clamp((GROUND - f.y) / 240, 0, 1);
  const shW = Math.round(11 - airT * 4);
  ditherBand(pctx, fx - shW, PGROUND - 1, shW * 2, 3, 'rgba(0,0,0,0)', '#0d0812', 0.55 - airT * 0.3);

  paintBody(f);

  pctx.save();
  if (f.facing < 0) {
    pctx.translate(fx, fy);
    pctx.scale(-1, 1);
    pctx.drawImage(scv, -SPR_AX, -SPR_AY);
  } else {
    pctx.drawImage(scv, fx - SPR_AX, fy - SPR_AY);
  }
  pctx.restore();

  // guard flash
  if (f.blockFlash > 0 && f.blockFlash % 2 === 0) {
    const gx = fx + f.facing * 8;
    pxRect(pctx, gx, wp(f.y) - 34, 2, 12, '#dff0ff');
    pxRect(pctx, gx + f.facing * 2, wp(f.y) - 31, 2, 6, '#8fc8ff');
  }
}

/* ---------- impact sparks: little pixel bursts, not soft dots ---------- */
function drawParticles() {
  for (const p of game.particles) {
    const x = wp(p.x), y = wp(p.y);
    const a = p.life / p.max;
    const col = a > 0.6 ? '#ffffff' : p.color;
    pxDot(pctx, x, y, col);
    if (a > 0.45) {
      pxDot(pctx, x + 1, y, col);
      pxDot(pctx, x, y + 1, col);
    }
  }
}

/* ---------- HUD ---------- */
function drawHealthBar(f, side) {
  const barW = 118, barH = 9;
  const x = side === 'left' ? 10 : PW - 10 - barW;
  const y = 14;

  pxRect(pctx, x - 2, y - 2, barW + 4, barH + 4, '#0d0812');
  pxRect(pctx, x - 1, y - 1, barW + 2, barH + 2, '#4a4460');
  pxRect(pctx, x, y, barW, barH, '#38121a');

  const drainW = Math.round(barW * clamp(f.shownHp / MAX_HP, 0, 1));
  const hpW = Math.round(barW * clamp(f.hp / MAX_HP, 0, 1));
  const dx = side === 'left' ? x + barW - drainW : x;
  const hx = side === 'left' ? x + barW - hpW : x;

  pxRect(pctx, dx, y, drainW, barH, '#e8563c');
  pxRect(pctx, hx, y, hpW, barH, '#f0c020');
  pxRect(pctx, hx, y, hpW, 2, '#ffe98a');
  pxRect(pctx, hx, y + barH - 2, hpW, 2, '#c08a10');

  drawText(pctx, f.name, side === 'left' ? x - 1 : x + barW + 1, y + barH + 4,
           f.hudCol, 1, side === 'left' ? 'left' : 'right', '#0d0812');

  // round pips
  for (let i = 0; i < WINS_NEEDED; i++) {
    const px0 = side === 'left' ? x + barW - 6 - i * 8 : x + 2 + i * 8;
    const on = i < f.wins;
    pxRect(pctx, px0, y + barH + 4, 5, 5, '#0d0812');
    pxRect(pctx, px0 + 1, y + barH + 5, 3, 3, on ? '#ffd23f' : '#3c3652');
  }
}

function drawHud() {
  drawHealthBar(P1, 'left');
  drawHealthBar(P2, 'right');

  const secs = Math.ceil(game.clock / 60);
  pxRect(pctx, PW / 2 - 15, 10, 30, 20, '#0d0812');
  pxRect(pctx, PW / 2 - 14, 11, 28, 18, '#241c38');
  drawText(pctx, String(secs).padStart(2, '0'), PW / 2, 15, secs <= 10 ? '#ff5a4d' : '#f4f0ff', 2, 'center', '#0d0812');
  drawText(pctx, game.stage.name, PW / 2, 34, '#8f87b0', 1, 'center', '#0d0812');
}

function drawBanner() {
  if (!game.banner) return;
  const y = 62;
  const scale = game.banner.length > 8 ? 2 : 3;
  const w = textWidth(game.banner, scale);
  const h = GLYPH_H * scale;

  // backing plate keeps the text readable over a busy stage
  pxRect(pctx, PW / 2 - w / 2 - 6, y - 5, w + 12, h + 10, '#160b1c');
  pxRect(pctx, PW / 2 - w / 2 - 5, y - 4, w + 10, h + 8, '#2c1630');
  pxRect(pctx, PW / 2 - w / 2 - 5, y - 4, w + 10, 1, '#5c3358');
  pxRect(pctx, PW / 2 - w / 2 - 5, y + h + 3, w + 10, 1, '#5c3358');

  drawText(pctx, game.banner, PW / 2, y, '#ffd23f', scale, 'center', '#7a2a1c');
  if (game.sub) {
    const sw = textWidth(game.sub, 1);
    pxRect(pctx, PW / 2 - sw / 2 - 3, y + h + 6, sw + 6, 9, '#160b1c');
    drawText(pctx, game.sub, PW / 2, y + h + 7, '#f4f0ff', 1, 'center', '#3a1020');
  }
}

/* ---------- frame ---------- */
function render() {
  pctx.setTransform(1, 0, 0, 1, 0, 0);

  const sh = game.shake;
  if (sh > 0.4) {
    pctx.setTransform(1, 0, 0, 1,
      Math.round((Math.random() - 0.5) * sh),
      Math.round((Math.random() - 0.5) * sh * 0.6));
  }

  pctx.drawImage(stageCanvas(game.stage), 0, 0);
  game.stage.overlay(pctx, game.frame);

  const order = P1.y >= P2.y ? [P2, P1] : [P1, P2];
  for (const f of order) drawFighter(f);

  drawParticles();

  pctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud();
  drawBanner();

  // blow the buffer up to the display canvas, nearest-neighbour
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pcv, 0, 0, PW, PH, 0, 0, W, H);
}

/* ---------- main loop ---------- */
let last = performance.now();
let acc = 0;

function frame(now) {
  acc += Math.min(now - last, 250);
  last = now;
  while (acc >= STEP) {
    update();
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

startMatch();
requestAnimationFrame(frame);
