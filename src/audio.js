/* Synthesized sound. No asset files: every effect is a short oscillator
   sweep, which suits the arcade register and keeps the repo text-only. */

export const Sound = {
  ctx: null,
  muted: false,

  /* Set by the music module. Every effect announces itself so the music can
     duck out of its way for a moment; without it a busy bar swallows a hit. */
  onCue: null,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  blip(freq, dur, type = 'square', gain = 0.06) {
    if (!this.ctx || this.muted) return;
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

  cue(name) { if (this.onCue) this.onCue(name); },

  punch() { this.cue('punch'); this.blip(320, 0.09, 'square', 0.05); },
  kick()  { this.cue('kick');  this.blip(180, 0.16, 'sawtooth', 0.06); },
  block() { this.cue('block'); this.blip(700, 0.06, 'triangle', 0.04); },
  whiff() { this.cue('whiff'); this.blip(120, 0.05, 'sine', 0.02); },
  ko()    { this.cue('ko');    this.blip(90, 0.55, 'sawtooth', 0.08); },
  bell()  { this.cue('bell');  this.blip(880, 0.25, 'triangle', 0.05); },
};
