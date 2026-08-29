import * as C from './config.js';
import { resolveHits, separate, spawnProjectile, stepProjectile, resolveProjectileHit } from './combat.js';

const SILENT = { punch() {}, kick() {}, block() {}, whiff() {}, ko() {}, bell() {} };

/* Round and match flow, plus the presentation state a hit produces
   (sparks, hitstop, screen shake). Constructed with its fighters and stage
   list, so a test can spin up a match with fakes and step it by hand. */
export class Match {
  constructor({ p1, p2, stages, sound = SILENT }) {
    this.p1 = p1;
    this.p2 = p2;
    this.stages = stages;
    this.sound = sound;

    this.phase = 'intro';     // intro | fight | roundEnd | matchEnd
    this.timer = 0;           // frames spent in the current phase
    this.frame = 0;           // free-running, drives stage overlays
    this.clock = C.ROUND_TIME * 60;
    this.round = 1;
    this.banner = '';
    this.sub = '';
    this.hitstop = 0;
    this.shake = 0;
    this.particles = [];
    this.projectiles = [];
    this.stageStart = 0;
    this.stage = stages[0];
    this.onStageChange = null;

    this.startMatch();
  }

  startMatch() {
    this.p1.wins = 0;
    this.p2.wins = 0;
    this.round = 1;
    // open each match somewhere new so a session doesn't repeat itself
    this.stageStart = (this.stageStart + 1) % this.stages.length;
    this.startRound();
  }

  startRound() {
    this.stage = this.stages[(this.stageStart + this.round - 1) % this.stages.length];
    if (this.onStageChange) this.onStageChange(this.stage);
    this.p1.reset();
    this.p2.reset();
    this.clock = C.ROUND_TIME * 60;
    this.phase = 'intro';
    this.timer = 0;
    this.banner = 'ROUND ' + this.round;
    this.sub = this.stage.name;
    this.particles.length = 0;
    this.projectiles.length = 0;
    this.sound.bell();
  }

  endRound(winner, sub) {
    this.phase = 'roundEnd';
    this.timer = 0;
    if (winner) {
      winner.wins++;
      this.banner = winner.name + ' WINS';
    } else {
      this.banner = 'DRAW';
    }
    this.sub = sub || '';
    this.sound.ko();
  }

  spark(x, y, n, colour, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.5 + Math.random()) * power;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: 16 + Math.random() * 14,
        max: 30,
        colour,
      });
    }
  }

  onHit(hit) {
    if (hit.blocked) {
      this.spark(hit.x, hit.y, 7, '#bfe4ff', 4.4);
      this.hitstop = 3;
      this.shake = 2;
      this.sound.block();
    } else {
      this.spark(hit.x, hit.y, 16, hit.heavy ? '#ffd166' : '#fff3c4', 6.8);
      this.hitstop = hit.heavy ? 8 : 5;
      this.shake = hit.heavy ? 9 : 5;
      this.sound[hit.move.tone]();
    }
  }

  /* Launch, fly and land any travelling attacks. A projectile move spawns
     its projectile once, on the first frame past its startup; from there the
     projectile is on its own -- it outlives even the attack animation. */
  updateProjectiles() {
    for (const f of [this.p1, this.p2]) {
      const a = f.attack;
      if (a && a.move.projectile && !a.launched && a.t >= a.move.startup) {
        a.launched = true;
        this.projectiles.push(spawnProjectile(f));
        this.sound.whiff();
      }
    }
    if (!this.projectiles.length) return;
    for (const pr of this.projectiles) {
      stepProjectile(pr);
      const target = pr.ownerSlot === 'p1' ? this.p2 : this.p1;
      resolveProjectileHit(pr, target, (h) => this.onHit(h));
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  /* A burning fighter sheds embers -- presentation only, but it lives here
     with the other particles so the renderer stays dumb. */
  burnEmbers() {
    for (const f of [this.p1, this.p2]) {
      if (f.burnTimer > 0 && this.frame % 4 === 0) {
        this.particles.push({
          x: f.x + (Math.random() - 0.5) * 70,
          y: f.y - 40 - Math.random() * 200,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -1.5 - Math.random() * 1.5,
          life: 12 + Math.random() * 10,
          max: 30,
          colour: Math.random() < 0.5 ? '#ff8c1e' : '#ffd45c',
        });
      }
    }
  }

  /* One simulation tick. */
  update(input) {
    const { p1, p2 } = this;
    this.timer++;
    this.frame++;
    if (this.shake > 0) this.shake *= 0.86;

    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.44; p.vx *= 0.96; p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    p1.shownHp += (p1.hp - p1.shownHp) * 0.12;
    p2.shownHp += (p2.hp - p2.shownHp) * 0.12;

    // hitstop: everything freezes for a few frames so a clean hit lands hard
    if (this.hitstop > 0) { this.hitstop--; input.pressed.clear(); return; }

    switch (this.phase) {
      case 'intro':
        p1.update(p2, false);
        p2.update(p1, false);
        if (this.timer === 60) { this.banner = 'FIGHT!'; this.sub = ''; this.sound.bell(); }
        if (this.timer > 90) { this.phase = 'fight'; this.timer = 0; this.banner = ''; }
        break;

      case 'fight': {
        const a1 = p1.update(p2, true);
        const a2 = p2.update(p1, true);
        if (a1) this.sound[a1 === 'special' ? 'bell' : 'whiff']();
        if (a2) this.sound[a2 === 'special' ? 'bell' : 'whiff']();
        separate(p1, p2);
        resolveHits(p1, p2, (h) => this.onHit(h));
        resolveHits(p2, p1, (h) => this.onHit(h));
        this.updateProjectiles();
        this.burnEmbers();

        this.clock--;
        if (p1.ko || p2.ko) {
          const winner = p1.ko && p2.ko ? null : (p1.ko ? p2 : p1);
          this.endRound(winner, 'K.O.');
        } else if (this.clock <= 0) {
          this.clock = 0;
          const winner = p1.hp === p2.hp ? null : (p1.hp > p2.hp ? p1 : p2);
          this.endRound(winner, 'TIME OVER');
        }
        break;
      }

      case 'roundEnd':
        p1.update(p2, false);
        p2.update(p1, false);
        separate(p1, p2);
        if (this.timer > 150) {
          if (p1.wins >= C.WINS_NEEDED || p2.wins >= C.WINS_NEEDED) {
            this.phase = 'matchEnd';
            this.timer = 0;
            const champ = p1.wins > p2.wins ? p1 : p2;
            this.banner = champ.name + ' WINS THE MATCH';
            this.sub = 'PRESS ENTER TO PICK AGAIN';
          } else {
            this.round++;
            this.startRound();
          }
        }
        break;

      case 'matchEnd':
        p1.update(p2, false);
        p2.update(p1, false);
        break;
    }

    // Enter restarts mid-match; at matchEnd the app sends you back to the
    // roster instead, so it is handled a level up.
    if (input.pressed.has('enter') && this.phase !== 'matchEnd') this.startMatch();
    input.pressed.clear();
  }
}
