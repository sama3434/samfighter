/* The music engine: audio graph, lookahead scheduler, voice dispatch.

   Timing is the whole game here. setTimeout and requestAnimationFrame both
   drift by milliseconds that the ear hears as a stumbling beat, so nothing is
   *played* by a timer — the timer only wakes every SCAN ms, asks the sequencer
   for every step starting inside the next LOOKAHEAD seconds, and hands those
   to WebAudio with absolute `AudioContext.currentTime` stamps. The audio
   thread then plays them at sample accuracy whether or not the main thread is
   busy drawing a fight.

   The same engine renders offline: `scheduleUntil()` is the only way steps get
   scheduled, so an OfflineAudioContext just calls it in a loop and renders. */

import { createVoices } from './voices.js';
import { Sequencer } from './sequencer.js';

export const SCAN_MS = 25;        // how often the scheduler wakes
export const LOOKAHEAD = 0.2;     // how far ahead of the clock it schedules

/* How each voice wants to be called. The pattern format does not care, so the
   dispatcher below adapts one note event to whichever signature applies. */
export const VOICE_KIND = {
  kick: 'perc', snare: 'perc', clap: 'perc', hat: 'perc',
  shaker: 'perc', tom: 'perc', crash: 'perc',
  bass: 'mono', lead: 'mono', pluck: 'mono',
  stab: 'poly', pad: 'poly',
  riser: 'fx', fall: 'fx',
};

/** Everything downstream is scaled by this, so music sits under the SFX.
    Calibrated by offline render against the levels in src/audio.js: the
    effects peak around 0.06, and the music has to stay under that. */
export const MIX_TRIM = 0.13;

/* How hard the summed buses hit the soft-clipper. Low enough that the drive
   only rounds the peaks — pushing it harder squashed the crest factor to 7dB
   and the whole mix turned to porridge. */
const PRE_DRIVE = 0.5;

export class MusicEngine {
  constructor(ctx, destination = null) {
    this.ctx = ctx;
    this.voices = createVoices(ctx);
    this.seq = null;
    this.track = null;
    this.lanes = null;
    this.timer = null;
    this.playing = false;
    this.volume = 0.75;
    this.muted = false;
    this.cutoffCeiling = 18000;

    const out = destination || ctx.destination;

    // master chain: colour -> section gain -> drive -> sfx duck -> volume -> limit
    this.colour = ctx.createBiquadFilter();
    this.colour.type = 'lowpass';
    this.colour.frequency.value = 18000;
    this.colour.Q.value = 0.9;

    this.preGain = ctx.createGain();
    this.preGain.gain.value = PRE_DRIVE;

    this.sectionGain = ctx.createGain();
    this.sectionGain.gain.value = 1;

    this.drive = ctx.createWaveShaper();
    this.drive.curve = softClip(1.1);

    this.sfxDuck = ctx.createGain();
    this.sfxDuck.gain.value = 1;

    this.volumeGain = ctx.createGain();
    this.volumeGain.gain.value = this.volume * MIX_TRIM;

    this.fade = ctx.createGain();
    this.fade.gain.value = 1;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -5;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.14;

    /* The limiter sits *before* the volume trim so it works on a full-scale
       signal; the trim afterwards is what puts the music under the effects.
       The waveshaper ahead of it is a hard bound in itself — a WaveShaper
       clamps its input to [-1, 1] — so the output can never leave that range
       whatever the arrangement does. */
    this.colour.connect(this.preGain).connect(this.sectionGain).connect(this.drive)
      .connect(this.limiter).connect(this.sfxDuck)
      .connect(this.volumeGain).connect(this.fade).connect(out);

    // two buses so the sidechain pump squeezes the synths, not the kick
    this.drumBus = ctx.createGain();
    this.synthBus = ctx.createGain();
    this.duck = ctx.createGain();
    this.duck.gain.value = 1;
    this.drumBus.connect(this.colour);
    this.synthBus.connect(this.duck).connect(this.colour);

    // one shared delay send: dotted-eighth-ish, fed back through a lowpass
    this.sendBus = ctx.createGain();
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.28;
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.34;
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 2600;
    this.sendBus.connect(this.delay);
    this.delay.connect(this.delayTone).connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.duck);
  }

  /* ------------------------------------------------------------- mixing */

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  setMuted(m) {
    this.muted = !!m;
    this.applyGain();
  }

  applyGain() {
    const target = this.muted ? 0 : this.volume * MIX_TRIM;
    const t = this.ctx.currentTime;
    const g = this.volumeGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + 0.08);
  }

  /** Momentary dip so a sound effect cuts through. Cheap, called per hit. */
  duckForSfx(amount = 0.45, hold = 0.09, release = 0.22) {
    if (!this.playing || this.muted) return;
    const t = this.ctx.currentTime;
    const g = this.sfxDuck.gain;
    const down = Math.max(0.15, 1 - amount);
    if (g.value < down + 0.02) return;      // already ducked; do not stack
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(down, t + 0.012);
    g.setValueAtTime(down, t + hold);
    g.linearRampToValueAtTime(1, t + hold + release);
  }

  /* ---------------------------------------------------------- transport */

  /** Build the per-lane node chain for a track, once per start. */
  buildLanes(track) {
    const lanes = {};
    for (const [name, def] of Object.entries(track.lanes)) {
      const kind = VOICE_KIND[def.voice];
      if (!kind) throw new Error(`lane "${name}" uses unknown voice "${def.voice}"`);
      const gain = this.ctx.createGain();
      gain.gain.value = def.gain == null ? 0.8 : def.gain;
      gain.connect(kind === 'perc' || kind === 'fx' ? this.drumBus : this.synthBus);
      let send = null;
      if (def.send) {
        send = this.ctx.createGain();
        send.gain.value = def.send;
        gain.connect(send).connect(this.sendBus);
      }
      lanes[name] = { def, kind, gain, send, fn: this.voices[def.voice] };
    }
    return lanes;
  }

  start(track, { section = 0, at = null, fadeIn = 0.05 } = {}) {
    this.stopTimer();
    this.track = track;
    this.lanes = this.buildLanes(track);
    const now = at == null ? this.ctx.currentTime + 0.06 : at;
    this.seq = new Sequencer(track, { startSection: section, time: now });
    this.playing = true;
    this.appliedSection = null;
    /* Track the filter and section gain in plain numbers rather than reading
       AudioParam.value: during an offline render nothing has been evaluated
       yet, so .value would report the initial setting for every section. */
    this.lastCutoff = 18000;
    this.lastSectionGain = 1;
    this.colour.frequency.cancelScheduledValues(this.ctx.currentTime);
    this.colour.frequency.setValueAtTime(this.lastCutoff, now);
    this.sectionGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.sectionGain.gain.setValueAtTime(this.lastSectionGain, now);
    this.fade.gain.cancelScheduledValues(this.ctx.currentTime);
    this.fade.gain.setValueAtTime(fadeIn > 0.06 ? 0.0001 : 1, this.ctx.currentTime);
    if (fadeIn > 0.06) this.fade.gain.linearRampToValueAtTime(1, this.ctx.currentTime + fadeIn);
    this.startTimer();
  }

  /** Fade out and stop. Anything already scheduled rings out under the fade. */
  stop(fadeSec = 0.6) {
    if (!this.playing) return;
    const t = this.ctx.currentTime;
    const g = this.fade.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, fadeSec));
    this.playing = false;
    this.stopTimer();
    this.seq = null;
  }

  /** A KO wants the music to collapse, not politely fade. */
  collapse(dur = 0.7) {
    if (!this.playing) return;
    const t = this.ctx.currentTime;
    this.colour.frequency.cancelScheduledValues(t);
    this.colour.frequency.setValueAtTime(this.colour.frequency.value, t);
    this.colour.frequency.exponentialRampToValueAtTime(180, t + dur * 0.9);
    this.stop(dur);
  }

  queueSection(name) { if (this.seq) this.seq.queueSection(name); }
  get sectionName() { return this.seq ? this.seq.section.name : null; }
  get trackKey() { return this.track ? this.track.key : null; }

  setTempoScale(s) { if (this.seq) this.seq.tempoScale = Math.max(0.5, Math.min(1.5, s)); }

  startTimer() {
    if (this.timer != null) return;
    this.timer = setInterval(() => this.tick(), SCAN_MS);
  }

  stopTimer() {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null; }
  }

  tick() {
    if (!this.playing || !this.seq) return;
    this.scheduleUntil(this.ctx.currentTime + LOOKAHEAD);
  }

  /* --------------------------------------------------------- scheduling */

  /**
   * Schedule every step whose start time is before `absTime`. This is the only
   * path that produces sound, live or offline.
   */
  scheduleUntil(absTime) {
    if (!this.seq) return;
    this.seq.pump(absTime, (step) => this.emit(step));
  }

  emit(step) {
    const t = Math.max(step.time, this.ctx.currentTime);

    if (step.section.name !== this.appliedSection) {
      this.appliedSection = step.section.name;
      this.applySection(step.section, t);
    }

    for (const note of step.notes) {
      const lane = this.lanes[note.lane];
      if (!lane) continue;
      const params = Object.assign({}, note.def.params, { vel: note.vel });
      try {
        switch (lane.kind) {
          case 'perc':
            lane.fn(lane.gain, t, params);
            break;
          case 'mono':
            for (const midi of note.notes) lane.fn(lane.gain, t, midi, note.dur, params);
            break;
          case 'poly':
            if (note.notes.length) lane.fn(lane.gain, t, note.notes, note.dur, params);
            break;
          case 'fx':
            lane.fn(lane.gain, t, note.dur, params);
            break;
          default:
            break;
        }
      } catch (err) {
        // one bad note must not take the scheduler down mid-round
        if (!this.warned) { this.warned = true; console.warn('music voice failed', err); }
      }
      if (note.def.pump) this.pump(t, note.def.pump * note.vel);
    }
  }

  /** Section changes ramp rather than jump, so a filter move is musical. */
  applySection(section, t) {
    const barSec = (60 / (this.seq ? this.seq.bpm : 150)) * 4;
    const cut = Math.max(40, Math.min(section.cutoff, this.cutoffCeiling));
    const f = this.colour.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(40, this.lastCutoff), t);
    f.exponentialRampToValueAtTime(cut, t + barSec * 0.75);
    this.lastCutoff = cut;

    const g = this.sectionGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(this.lastSectionGain, t);
    g.linearRampToValueAtTime(section.gain, t + barSec * 0.5);
    this.lastSectionGain = section.gain;
  }

  /** Sidechain: every kick briefly shoves the synths out of the way. */
  pump(t, depth) {
    const g = this.duck.gain;
    const low = Math.max(0.2, 1 - depth);
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(low, t + 0.014);
    g.linearRampToValueAtTime(1, t + 0.17);
  }

  /* -------------------------------------------------------------- stings

     One-shots that ignore the sequencer, for moments the arrangement cannot
     anticipate. They go straight to the drum bus so the pump never eats them. */

  sting(name, when = null) {
    const t = when == null ? this.ctx.currentTime + 0.02 : when;
    const v = this.voices;
    const bus = this.drumBus;
    const beat = 0.34;
    switch (name) {
      case 'ko':
        v.crash(bus, t, { vel: 0.9 });
        v.fall(bus, t, 0.85, { vel: 0.9, from: 700, to: 45 });
        v.stab(this.synthBus, t, [41, 44, 48], 0.7,
          { vel: 0.9, cutoff: 300, envAmt: 2200, decay: 0.4, sustain: 0.4, release: 0.5 });
        break;
      case 'victory':
        // a short rising cadence: iv - VI - i, one chord per beat
        v.stab(this.synthBus, t, [53, 56, 60], beat * 1.1, { vel: 0.9, decay: 0.2, sustain: 0.4 });
        v.stab(this.synthBus, t + beat, [56, 60, 63], beat * 1.1, { vel: 0.9, decay: 0.2, sustain: 0.4 });
        v.stab(this.synthBus, t + beat * 2, [60, 65, 72], beat * 2.4,
          { vel: 1, decay: 0.3, sustain: 0.55, release: 0.8 });
        v.crash(bus, t + beat * 2, { vel: 0.7 });
        v.kick(bus, t, { vel: 0.9 });
        v.kick(bus, t + beat, { vel: 0.9 });
        v.kick(bus, t + beat * 2, { vel: 1 });
        break;
      case 'danger':
        // two dissonant pulses; a warning, not a melody
        v.lead(this.synthBus, t, 77, 0.16, { vel: 0.7, cutoff: 2200, q: 8, sustain: 0.3 });
        v.lead(this.synthBus, t + 0.2, 78, 0.3, { vel: 0.7, cutoff: 2200, q: 8, sustain: 0.3 });
        break;
      case 'roundStart':
        v.riser(bus, t, 0.5, { vel: 0.6, from: 400, to: 5200 });
        break;
      default:
        break;
    }
  }

  dispose() {
    this.stopTimer();
    this.playing = false;
    this.seq = null;
  }
}

function softClip(amount, n = 2048) {
  const curve = new Float32Array(n);
  const k = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(x * amount) / k;
  }
  return curve;
}

/**
 * Render a track to an AudioBuffer with no sound card involved. Used by the
 * measurement page, and the only honest way to check a mix without ears.
 */
export async function renderOffline(track, seconds, {
  section = 0, sampleRate = 44100, volume = 1, tempoScale = 1,
} = {}) {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OC) throw new Error('no OfflineAudioContext');
  const ctx = new OC(1, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = new MusicEngine(ctx, ctx.destination);
  engine.setVolume(volume);
  engine.start(track, { section, at: 0.02, fadeIn: 0 });
  engine.stopTimer();
  engine.setTempoScale(tempoScale);
  // schedule the whole render up front, in chunks, exactly as the live
  // scheduler would but without waiting for a clock
  for (let t = 0; t < seconds; t += 0.25) engine.scheduleUntil(Math.min(t + 0.5, seconds));
  return ctx.startRendering();
}
