/* Fight music.

   Everything here is synthesized at runtime, same as src/audio.js — there are
   no asset files in this repo and this does not add any. The engine lives in
   src/music/engine.js; this module is the part the game talks to: it owns the
   single AudioContext-bound engine, decides which track plays and which
   section it is in from the state of the match, and holds the player's
   mute/volume choice.

   Writing a fourth track means adding a data file under src/music/tracks/ and
   registering it — no code here changes. */

import { MusicEngine } from './music/engine.js';
import { TRACKS, FIGHT_TRACKS, MENU_TRACK } from './music/tracks/index.js';
import { MAX_HP } from './config.js';

const STORE_KEY = 'samfighter.music';

/* How hard each sound effect shoves the music aside. The music is already
   mixed under the effects; this is what stops a busy bar from burying a hit. */
const SFX_DUCK = {
  punch: 0.35, kick: 0.4, block: 0.3, ko: 0.6, bell: 0.35, whiff: 0,
};

const DANGER_HP = 0.28;         // fraction of max HP that counts as in trouble
const FINAL_SECONDS = 10;       // clock left when the track lifts for the finish

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      muted: !!p.muted,
      volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.75,
    };
  } catch (err) {
    return null;
  }
}

function savePrefs(prefs) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch (err) { /* private mode */ }
}

export const Music = {
  engine: null,
  volume: 0.75,
  muted: false,
  onChange: null,       // the on-screen indicator subscribes to this

  mode: null,           // 'menu' | 'match'
  lastMatch: null,
  lastRound: -1,
  lastPhase: null,
  dangerFired: false,
  finalFired: false,
  matchEndAt: 0,
  pendingScreen: null,     // last state seen before the engine existed
  pendingMatch: null,

  /* ------------------------------------------------------------- lifecycle */

  /** Called from the same first-keypress gesture that unlocks the effects. */
  attach(ctx) {
    if (this.engine || !ctx) return;
    const prefs = loadPrefs();
    if (prefs) { this.volume = prefs.volume; this.muted = prefs.muted; }
    try {
      this.engine = new MusicEngine(ctx);
    } catch (err) {
      console.warn('music engine unavailable', err);
      return;
    }
    this.engine.setVolume(this.volume);
    this.engine.setMuted(this.muted);
    this.emitChange();
    if (this.pendingScreen) this.sync(this.pendingScreen, this.pendingMatch);
  },

  get available() { return !!this.engine; },
  get trackName() {
    const key = this.engine && this.engine.trackKey;
    return key && TRACKS[key] ? TRACKS[key].name : '—';
  },

  /* ---------------------------------------------------------------- mixing */

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Math.round(v * 20) / 20));
    if (this.engine) this.engine.setVolume(this.volume);
    if (this.volume > 0 && this.muted) this.setMuted(false);
    else { savePrefs({ muted: this.muted, volume: this.volume }); this.emitChange(); }
  },

  nudgeVolume(delta) { this.setVolume(this.volume + delta); },

  setMuted(m) {
    this.muted = !!m;
    if (this.engine) this.engine.setMuted(this.muted);
    savePrefs({ muted: this.muted, volume: this.volume });
    this.emitChange();
  },

  toggleMute() { this.setMuted(!this.muted); },

  emitChange() { if (this.onChange) this.onChange(this); },

  /** Wired to Sound.onCue so effects punch a hole in the music. */
  cue(name) {
    if (!this.engine) return;
    const amount = SFX_DUCK[name];
    if (amount) this.engine.duckForSfx(amount);
  },

  /* ----------------------------------------------------------- match sync

     Called once per simulation tick. Everything below is comparisons against
     the state it saw last tick, so the cost per frame is a handful of numbers;
     nothing here allocates or touches the audio graph unless something
     actually changed. */

  sync(screen, match) {
    // no engine yet: remember the state, do not allocate once a frame
    if (!this.engine) { this.pendingScreen = screen; this.pendingMatch = match; return; }

    if (screen !== 'match' || !match) {
      this.enterMenu();
      return;
    }

    const e = this.engine;
    const fresh = match !== this.lastMatch;
    if (fresh) {
      this.lastMatch = match;
      this.lastRound = -1;
      this.lastPhase = null;
      this.mode = 'match';
    }

    // one track per round, rotated, so a three-round match is three tracks
    const key = FIGHT_TRACKS[
      Math.abs(match.stageStart + match.round) % FIGHT_TRACKS.length
    ];

    if (match.round !== this.lastRound || (match.phase === 'intro' && this.lastPhase === null)) {
      this.lastRound = match.round;
      this.dangerFired = false;
      this.finalFired = false;
      e.start(TRACKS[key], { section: 'intro', fadeIn: 0.25 });
      e.sting('roundStart');
      this.emitChange();
    }

    if (match.phase !== this.lastPhase) {
      this.onPhase(match, e);
      this.lastPhase = match.phase;
    }

    if (match.phase === 'fight') this.duringFight(match, e);

    // after the victory sting has rung out, drift back to the menu loop
    if (match.phase === 'matchEnd' && !e.playing
        && this.matchEndAt && performance.now() - this.matchEndAt > 2800) {
      this.matchEndAt = 0;
      e.start(TRACKS[MENU_TRACK], { section: 'intro', fadeIn: 1.5 });
      this.emitChange();
    }
  },

  onPhase(match, e) {
    switch (match.phase) {
      case 'intro':
        // the round-intro bars stay filtered; the drop lands on "FIGHT!"
        e.queueSection('intro');
        e.setTempoScale(1);
        break;
      case 'fight':
        e.queueSection('drop');
        break;
      case 'roundEnd':
        e.collapse(0.9);
        e.sting('ko');
        break;
      case 'matchEnd':
        e.stop(0.3);
        e.sting('victory');
        this.matchEndAt = performance.now();
        break;
      default:
        break;
    }
  },

  duringFight(match, e) {
    if (!this.finalFired && match.clock <= FINAL_SECONDS * 60) {
      this.finalFired = true;
      e.setTempoScale(1.05);
      e.queueSection('final');
    }
    if (!this.dangerFired) {
      const low = Math.min(match.p1.hp, match.p2.hp) / MAX_HP;
      if (low <= DANGER_HP) {
        this.dangerFired = true;
        e.sting('danger');
        e.setTempoScale(Math.max(e.seq ? e.seq.tempoScale : 1, 1.03));
      }
    }
  },

  enterMenu() {
    if (this.mode === 'menu') return;
    this.mode = 'menu';
    this.lastMatch = null;
    this.lastRound = -1;
    this.lastPhase = null;
    this.matchEndAt = 0;
    this.engine.start(TRACKS[MENU_TRACK], { section: 'intro', fadeIn: 0.8 });
    this.emitChange();
  },
};

export { TRACKS, FIGHT_TRACKS, MENU_TRACK };
