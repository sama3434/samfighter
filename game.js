'use strict';

/* ============================================================
   SAM FIGHTER — local 1v1, two players on one keyboard.
   Fixed 60Hz simulation, frame-based move data, no assets.
   ============================================================ */

const W = 960, H = 540;
const GROUND = 470;          // y of the floor (feet rest here)
const WALL = 40;             // playfield inset
const STEP = 1000 / 60;

const GRAVITY = 0.9;
const JUMP_V = -15.5;
const MOVE_SPEED = 4.2;
const AIR_DRIFT = 0.45;
const FRICTION = 0.72;

const MAX_HP = 100;
const ROUND_TIME = 60;       // seconds
const WINS_NEEDED = 2;

const BODY_W = 56;
const STAND_H = 112;
const CROUCH_H = 76;

/* ---------- move data (all durations in frames) ---------- */
const MOVES = {
  punch:    { startup: 4, active: 4, recovery: 9,  dmg: 7,  reach: 66, top: -96, h: 26, kb: 3.5, kbY: 0,    hitstun: 13, blockstun: 7,  chip: 1, tone: 'punch' },
  kick:     { startup: 8, active: 6, recovery: 17, dmg: 13, reach: 86, top: -72, h: 30, kb: 6.0, kbY: -3.5, hitstun: 20, blockstun: 12, chip: 2, tone: 'kick'  },
  sweep:    { startup: 7, active: 5, recovery: 21, dmg: 10, reach: 82, top: -30, h: 28, kb: 4.0, kbY: 0,    hitstun: 24, blockstun: 12, chip: 2, tone: 'kick',  knockdown: true, low: true },
  airPunch: { startup: 3, active: 8, recovery: 6,  dmg: 8,  reach: 62, top: -84, h: 34, kb: 3.0, kbY: 0,    hitstun: 14, blockstun: 8,  chip: 1, tone: 'punch', air: true },
  airKick:  { startup: 5, active: 10, recovery: 8, dmg: 14, reach: 80, top: -56, h: 40, kb: 5.0, kbY: 0,    hitstun: 18, blockstun: 10, chip: 2, tone: 'kick',  air: true },
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
  constructor(name, x, facing, scheme, palette) {
    this.name = name;
    this.startX = x;
    this.facing = facing;
    this.scheme = scheme;
    this.pal = palette;
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
    const front = this.facing > 0 ? this.x + 14 : this.x - 14 - m.reach;
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
const P1 = new Fighter('PLAYER 1', 300, 1, SCHEMES[0], { main: '#3fa9ff', dark: '#1d5c96', trim: '#bfe4ff' });
const P2 = new Fighter('PLAYER 2', 660, -1, SCHEMES[1], { main: '#ff5a4d', dark: '#8f2b23', trim: '#ffd3ce' });

const game = {
  phase: 'intro',      // intro | fight | roundEnd | matchEnd
  timer: 0,            // frames in current phase
  clock: ROUND_TIME * 60,
  round: 1,
  banner: '',
  sub: '',
  hitstop: 0,
  shake: 0,
  particles: [],
};

function startRound() {
  P1.reset(); P2.reset();
  P1.facing = 1; P2.facing = -1;
  game.clock = ROUND_TIME * 60;
  game.phase = 'intro';
  game.timer = 0;
  game.banner = 'ROUND ' + game.round;
  game.sub = '';
  game.particles.length = 0;
  Sound.bell();
}

function startMatch() {
  P1.wins = 0; P2.wins = 0;
  game.round = 1;
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
    spark(hx, hy, 6, '#9fd2ff', 2.2);
    game.hitstop = 3;
    game.shake = 2;
    Sound.block();
  } else {
    spark(hx, hy, 14, m.dmg >= 12 ? '#ffd166' : '#fff3c4', 3.4);
    game.hitstop = m.dmg >= 12 ? 8 : 5;
    game.shake = m.dmg >= 12 ? 9 : 5;
    Sound[m.tone]();
  }
}

function separate(a, b) {
  if (a.ko || b.ko) return;
  const min = BODY_W - 8;
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
  if (game.shake > 0) game.shake *= 0.86;

  for (const p of game.particles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.96; p.life--;
  }
  game.particles = game.particles.filter((p) => p.life > 0);

  P1.shownHp = lerp(P1.shownHp, P1.hp, 0.12);
  P2.shownHp = lerp(P2.shownHp, P2.hp, 0.12);

  if (game.hitstop > 0) { game.hitstop--; pressed.clear(); return; }

  switch (game.phase) {
    case 'intro':
      P1.update(P2, false);
      P2.update(P1, false);
      if (game.timer === 60) { game.banner = 'FIGHT!'; Sound.bell(); }
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
   RENDERING
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#241b3a');
  sky.addColorStop(0.55, '#48284a');
  sky.addColorStop(1, '#a24a42');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  // retro sun, banded with scanline gaps
  const sunY = GROUND - 205;
  const sunR = 92;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunGrad.addColorStop(0, '#ffd98a');
  sunGrad.addColorStop(1, '#ff7a52');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(W / 2 - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = 'rgba(40,22,50,0.55)';
  for (let i = 0; i < 9; i++) {
    const gy = sunY + 10 + i * 11;
    ctx.fillRect(W / 2 - sunR, gy, sunR * 2, 2 + i * 0.9);
  }
  ctx.restore();

  // skyline: opaque so it reads as buildings in front of the sun
  let x = -20;
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  while (x < W + 20) {
    const bw = 40 + rnd() * 62;
    const bh = 70 + rnd() * 150;
    const top = GROUND - bh;
    ctx.fillStyle = '#241a30';
    ctx.fillRect(x, top, bw, bh);
    ctx.fillStyle = 'rgba(255,190,140,0.16)';
    for (let wy = top + 12; wy < GROUND - 14; wy += 20) {
      for (let wx = x + 8; wx < x + bw - 10; wx += 16) {
        if (rnd() > 0.55) ctx.fillRect(wx, wy, 6, 9);
      }
    }
    x += bw + 10 + rnd() * 14;
  }

  // floor
  ctx.fillStyle = '#1b1524';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    ctx.beginPath();
    ctx.moveTo(W / 2 + (t - 0.5) * W * 0.6, GROUND);
    ctx.lineTo(W / 2 + (t - 0.5) * W * 3, H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
}

function limb(x1, y1, x2, y2, wdt, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = wdt;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawFighter(f) {
  const p = f.pal;
  const fx = f.facing;                 // +1 faces right
  const t = f.attack ? f.attack.t : 0;
  const m = f.attack ? f.attack.move : null;
  const phase = m ? (t < m.startup ? 'startup' : t < m.startup + m.active ? 'active' : 'recovery') : null;

  // shadow
  const air = clamp((GROUND - f.y) / 160, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.38 - air * 0.22) + ')';
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND + 6, 30 - air * 10, 8 - air * 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(f.x, f.y);

  // KO / knockdown: lie on the floor
  if (f.ko || f.downTimer > 0) {
    ctx.rotate(fx * -1.45);
    ctx.translate(0, -18);
  } else if (f.hitstun > 0) {
    ctx.rotate(fx * 0.14);
  }

  const lowStance = (f.crouching || (m && MOVES.sweep === m)) ? 1 : 0;
  const hipY = -62 + lowStance * 26;
  const shoulderY = -104 + lowStance * 30;
  const headY = shoulderY - 18;

  // legs
  const bob = Math.sin(f.walkPhase) * 10;
  if (!f.onGround) {
    limb(0, hipY, -12 * fx, hipY + 34, 11, p.dark);
    limb(0, hipY, 16 * fx, hipY + 26, 11, p.dark);
  } else if (m && (m === MOVES.kick)) {
    const ext = phase === 'startup' ? 0.45 : phase === 'active' ? 1 : 0.55;
    limb(0, hipY, -14 * fx, 0, 11, p.dark);
    limb(0, hipY, (30 + m.reach * 0.55 * ext) * fx, hipY - 12 * ext, 12, p.main);
  } else if (m && m === MOVES.sweep) {
    const ext = phase === 'active' ? 1 : 0.5;
    limb(0, hipY, -12 * fx, 0, 11, p.dark);
    limb(0, hipY, (28 + m.reach * 0.6 * ext) * fx, 2, 12, p.main);
  } else if (m && m === MOVES.airKick) {
    limb(0, hipY, -16 * fx, hipY + 30, 11, p.dark);
    limb(0, hipY, 52 * fx, hipY + 16, 12, p.main);
  } else {
    limb(0, hipY, (-10 + bob * 0.4) * fx, 0, 11, p.dark);
    limb(0, hipY, (12 - bob * 0.4) * fx, 0, 11, p.dark);
  }

  // torso
  limb(0, hipY, 0, shoulderY, 16, p.main);

  // arms
  if (f.blocking && !m) {
    limb(0, shoulderY + 6, 20 * fx, shoulderY + 4, 10, p.trim);
    limb(0, shoulderY + 16, 20 * fx, shoulderY + 14, 10, p.trim);
  } else if (m && (m === MOVES.punch || m === MOVES.airPunch)) {
    const ext = phase === 'startup' ? 0.35 : phase === 'active' ? 1 : 0.5;
    limb(0, shoulderY + 4, -14 * fx, shoulderY + 22, 10, p.dark);
    limb(0, shoulderY + 6, (18 + m.reach * 0.72 * ext) * fx, shoulderY + 6, 11, p.main);
    if (phase === 'active') {
      ctx.fillStyle = p.trim;
      ctx.beginPath();
      ctx.arc((18 + m.reach * 0.72) * fx, shoulderY + 6, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (m) {
    limb(0, shoulderY + 4, -22 * fx, shoulderY + 26, 10, p.dark);
    limb(0, shoulderY + 6, 16 * fx, shoulderY + 30, 10, p.dark);
  } else {
    const g = Math.sin(f.walkPhase * 0.9) * 3;
    limb(0, shoulderY + 4, 16 * fx, shoulderY + 20 + g, 10, p.dark);
    limb(0, shoulderY + 8, 20 * fx, shoulderY + 10 - g, 10, p.dark);
  }

  // head
  ctx.fillStyle = p.trim;
  ctx.beginPath();
  ctx.arc(2 * fx, headY, 15, 0, Math.PI * 2);
  ctx.fill();
  // headband tail
  limb(-12 * fx, headY - 4, -30 * fx, headY - 10 + Math.sin(game.timer * 0.2) * 4, 4, p.main);
  // eye
  ctx.fillStyle = '#1a1420';
  ctx.beginPath();
  ctx.arc(8 * fx, headY - 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // block flash
  if (f.blockFlash > 0) {
    ctx.strokeStyle = 'rgba(160,215,255,' + (f.blockFlash / 10) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(18 * fx, shoulderY + 12, 26, -1.1, 1.1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of game.particles) {
    const a = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillRect(p.x - 2, p.y - 2, 5, 5);
  }
  ctx.globalAlpha = 1;
}

function drawHealthBar(f, side) {
  const barW = 360, barH = 22;
  const x = side === 'left' ? 30 : W - 30 - barW;
  const y = 28;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 3, y - 3, barW + 6, barH + 6);

  // drain (delayed) layer
  const dw = barW * clamp(f.shownHp / MAX_HP, 0, 1);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(side === 'left' ? x + barW - dw : x, y, dw, barH);

  // current hp
  const hw = barW * clamp(f.hp / MAX_HP, 0, 1);
  ctx.fillStyle = f.pal.main;
  ctx.fillRect(side === 'left' ? x + barW - hw : x, y, hw, barH);

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 3, y - 3, barW + 6, barH + 6);

  // name
  ctx.fillStyle = '#e9edf8';
  ctx.font = '600 15px ui-monospace, Menlo, monospace';
  ctx.textAlign = side === 'left' ? 'left' : 'right';
  ctx.fillText(f.name, side === 'left' ? x : x + barW, y + barH + 22);

  // round pips
  for (let i = 0; i < WINS_NEEDED; i++) {
    const px = side === 'left' ? x + barW - 12 - i * 22 : x + 12 + i * 22;
    ctx.beginPath();
    ctx.arc(px, y + barH + 30, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < f.wins ? f.pal.main : 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawHud() {
  drawHealthBar(P1, 'left');
  drawHealthBar(P2, 'right');

  // clock
  const secs = Math.ceil(game.clock / 60);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W / 2 - 42, 22, 84, 52);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 42, 22, 84, 52);
  ctx.fillStyle = secs <= 10 ? '#ff6b5e' : '#f4f7ff';
  ctx.font = '700 34px ui-monospace, Menlo, monospace';
  ctx.fillText(String(secs).padStart(2, '0'), W / 2, 60);

  ctx.font = '600 13px ui-monospace, Menlo, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('ROUND ' + game.round, W / 2, 92);
}

function drawBanner() {
  if (!game.banner) return;
  ctx.textAlign = 'center';
  const pop = clamp(game.timer / 10, 0, 1);
  ctx.save();
  ctx.translate(W / 2, 250);
  ctx.scale(0.85 + pop * 0.15, 0.85 + pop * 0.15);
  ctx.font = '800 54px ui-monospace, Menlo, monospace';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(game.banner, 0, 0);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(game.banner, 0, 0);
  if (game.sub) {
    ctx.font = '600 20px ui-monospace, Menlo, monospace';
    ctx.strokeText(game.sub, 0, 42);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.sub, 0, 42);
  }
  ctx.restore();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const sh = game.shake;
  if (sh > 0.4) ctx.translate((Math.random() - 0.5) * sh * 2, (Math.random() - 0.5) * sh * 2);

  drawBackground();

  // back-to-front by depth so the closer fighter overlaps
  const order = P1.y >= P2.y ? [P2, P1] : [P1, P2];
  for (const f of order) drawFighter(f);

  drawParticles();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud();
  drawBanner();
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
