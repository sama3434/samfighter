/* Synth voices.

   Every instrument is built from oscillators, noise, filters and gain
   envelopes at play time — same rule as src/audio.js, no asset files. Each
   voice is a function (dest, time, note) that builds a short-lived node graph
   starting at an absolute AudioContext time and stops it when it is done.

   The envelopes matter more than the waveforms. A raw oscillator gated on and
   off is a test tone; what makes something read as a kick or a pluck is the
   shape of its amplitude and its filter over the first eighty milliseconds. */

import { midiToFreq } from './pattern.js';

const MIN = 0.0001;   // exponential ramps cannot reach zero

function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // deterministic LCG, so an offline render measures the same thing twice
  let s = 22222;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    data[i] = (s / 2147483648) - 1;
  }
  return buf;
}

function makeDriveCurve(amount = 2.2, n = 2048) {
  const curve = new Float32Array(n);
  const k = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(x * amount) / k;
  }
  return curve;
}

/** Percussive envelope: fast attack, exponential fall to silence. */
function hit(param, t, peak, attack, decay) {
  param.setValueAtTime(MIN, t);
  param.linearRampToValueAtTime(Math.max(MIN, peak), t + attack);
  param.exponentialRampToValueAtTime(MIN, t + attack + decay);
  return t + attack + decay;
}

/** Sustaining ADSR that holds for `dur` then releases. */
function adsr(param, t, dur, { a = 0.005, d = 0.08, s = 0.6, r = 0.08, peak = 1 }) {
  const sustain = Math.max(MIN, peak * s);
  param.setValueAtTime(MIN, t);
  param.linearRampToValueAtTime(Math.max(MIN, peak), t + a);
  param.exponentialRampToValueAtTime(sustain, t + a + d);
  const off = Math.max(t + a + d, t + Math.max(dur, 0.02));
  param.setValueAtTime(sustain, off);
  param.exponentialRampToValueAtTime(MIN, off + r);
  return off + r;
}

/* Per-voice output trim, measured rather than guessed: each voice was
   rendered alone through an OfflineAudioContext at velocity 1 and these
   numbers bring every one of them to roughly the same 0.9 peak. Without this
   the clap came out 18dB under the kick and the pad was inaudible, and the
   lane gains in a track were compensating for the synths instead of mixing
   them. Re-measure and update if you change a voice's envelope. */
export const VOICE_TRIM = {
  kick: 0.94, snare: 2.2, clap: 8.0, hat: 1.8, shaker: 4.6, tom: 1.5, crash: 2.5,
  bass: 1.0, lead: 2.3, pluck: 3.3, stab: 3.6, pad: 5.0, riser: 7.5, fall: 3.9,
};

export function createVoices(ctx) {
  const noiseBuffer = makeNoiseBuffer(ctx);
  const softCurve = makeDriveCurve(1.6);
  const hardCurve = makeDriveCurve(3.4);

  function noise(t, dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    // start from a rolling offset so consecutive hats are not identical
    src.playbackRate.value = 1;
    const offset = (t * 7.13) % (noiseBuffer.duration - dur - 0.05);
    src.start(t, Math.max(0, offset), dur + 0.05);
    return src;
  }

  const stop = (nodes, at) => { for (const n of nodes) n.stop(at + 0.02); };

  /* --------------------------------------------------------------- drums */

  /* Kick: a sine whose pitch collapses from 165Hz to a 44Hz body in 55ms,
     plus a filtered noise tick for the beater. The pitch drop is what the ear
     hears as weight; without it this is a bass note, not a kick. */
  function kick(dest, t, { vel = 1, tune = 1 } = {}) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = hardCurve;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    shaper.connect(out).connect(dest);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165 * tune, t);
    osc.frequency.exponentialRampToValueAtTime(52 * tune, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(41 * tune, t + 0.26);
    const g = ctx.createGain();
    const end = hit(g.gain, t, vel * 0.95, 0.004, 0.30);
    osc.connect(g).connect(shaper);

    const tick = noise(t, 0.03);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const tg = ctx.createGain();
    hit(tg.gain, t, vel * 0.22, 0.001, 0.018);
    tick.connect(hp).connect(tg).connect(out);

    osc.start(t);
    stop([osc], end);
  }

  /* Snare: bandpassed noise for the wires plus two detuned triangles for the
     drum itself, the tone decaying faster than the noise. */
  function snare(dest, t, { vel = 1 } = {}) {
    const out = ctx.createGain();
    out.gain.value = 0.85;
    out.connect(dest);

    const n = noise(t, 0.25);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1850;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    const nEnd = hit(ng.gain, t, vel * 0.5, 0.002, 0.16);
    n.connect(bp).connect(ng).connect(out);

    for (const [f, amp, dec] of [[188, 0.34, 0.09], [263, 0.2, 0.06]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.72, t + dec);
      const g = ctx.createGain();
      const e = hit(g.gain, t, vel * amp, 0.002, dec);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(e + 0.02);
    }
    void nEnd;
  }

  /* Clap: three noise bursts 11ms apart, then a longer tail. The stagger is
     the whole trick — one burst is a snare, three is a room full of hands. */
  function clap(dest, t, { vel = 1 } = {}) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1250;
    bp.Q.value = 1.1;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    bp.connect(out).connect(dest);

    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.011;
      const n = noise(at, 0.03);
      const g = ctx.createGain();
      hit(g.gain, at, vel * (0.42 - i * 0.06), 0.001, 0.022);
      n.connect(g).connect(bp);
    }
    const tail = noise(t + 0.032, 0.2);
    const tg = ctx.createGain();
    hit(tg.gain, t + 0.032, vel * 0.3, 0.003, 0.15);
    tail.connect(tg).connect(bp);
  }

  /* Hat: highpassed noise with a resonant peak for the metal. `open` stretches
     the decay; a closed hat lives for 45ms. */
  function hat(dest, t, { vel = 1, open = false, decay = null } = {}) {
    const n = noise(t, open ? 0.35 : 0.09);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7600;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 10500;
    peak.Q.value = 2;
    peak.gain.value = 6;
    const g = ctx.createGain();
    hit(g.gain, t, vel * 0.3, 0.001, decay || (open ? 0.26 : 0.042));
    n.connect(hp).connect(peak).connect(g).connect(dest);
  }

  /** Ride/shaker: softer, wider band, used to lift a section without a hat. */
  function shaker(dest, t, { vel = 1 } = {}) {
    const n = noise(t, 0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6200;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    hit(g.gain, t, vel * 0.26, 0.006, 0.075);
    n.connect(bp).connect(g).connect(dest);
  }

  /** Tom / floor hit, for fills. */
  function tom(dest, t, { vel = 1, freq = 150 } = {}) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22);
    const g = ctx.createGain();
    const end = hit(g.gain, t, vel * 0.55, 0.004, 0.24);
    const n = noise(t, 0.06);
    const ng = ctx.createGain();
    hit(ng.gain, t, vel * 0.1, 0.002, 0.05);
    o.connect(g).connect(dest);
    n.connect(ng).connect(dest);
    o.start(t);
    o.stop(end + 0.02);
  }

  /** Crash: bright noise with a long tail. One per drop, no more. */
  function crash(dest, t, { vel = 1 } = {}) {
    const n = noise(t, 1.4);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const g = ctx.createGain();
    hit(g.gain, t, vel * 0.22, 0.004, 1.2);
    n.connect(hp).connect(g).connect(dest);
  }

  /* -------------------------------------------------------------- pitched */

  /* Bass: two saws detuned against each other over a sine sub, through a
     resonant lowpass with its own envelope. `envAmt` is how far the filter
     opens on each note — that motion is the growl. */
  function bass(dest, t, midi, dur, {
    vel = 0.8, cutoff = 220, envAmt = 1500, q = 7, decay = 0.12,
    sustain = 0.55, release = 0.06, sub = 0.55, detune = 9, wave = 'sawtooth',
    drive = true,
  } = {}) {
    const f = midiToFreq(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.linearRampToValueAtTime(cutoff + envAmt * vel, t + 0.008);
    lp.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff), t + 0.008 + decay * 1.6);
    lp.Q.value = q;

    const amp = ctx.createGain();
    const end = adsr(amp.gain, t, dur, {
      a: 0.004, d: decay, s: sustain, r: release, peak: vel * 0.55,
    });

    let tail = amp;
    if (drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = softCurve;
      amp.connect(shaper);
      tail = shaper;
    }
    lp.connect(amp);
    tail.connect(dest);

    const oscs = [];
    for (const cents of [-detune, detune]) {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.value = f;
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      o.connect(g).connect(lp);
      oscs.push(o);
    }
    if (sub > 0) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f / 2;
      const g = ctx.createGain();
      g.gain.value = sub;
      o.connect(g).connect(amp);   // sub bypasses the filter so it never vanishes
      oscs.push(o);
    }
    for (const o of oscs) o.start(t);
    stop(oscs, end);
  }

  /* Lead: a detuned saw pair with an optional square underneath, through a
     resonant lowpass. Short attack, so a repeated motif stays percussive
     rather than smearing into a pad. */
  function lead(dest, t, midi, dur, {
    vel = 0.8, cutoff = 900, envAmt = 2600, q = 6, decay = 0.16,
    sustain = 0.45, release = 0.12, detune = 12, square = 0.25,
    wave = 'sawtooth', attack = 0.006, glide = 0,
  } = {}) {
    const f = midiToFreq(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.linearRampToValueAtTime(cutoff + envAmt * vel, t + 0.012);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 1.1), t + 0.012 + decay * 2);
    lp.Q.value = q;

    const amp = ctx.createGain();
    const end = adsr(amp.gain, t, dur, {
      a: attack, d: decay, s: sustain, r: release, peak: vel * 0.32,
    });
    lp.connect(amp).connect(dest);

    const oscs = [];
    for (const cents of [-detune, detune]) {
      const o = ctx.createOscillator();
      o.type = wave;
      if (glide > 0) {
        o.frequency.setValueAtTime(f * 0.94, t);
        o.frequency.exponentialRampToValueAtTime(f, t + glide);
      } else {
        o.frequency.value = f;
      }
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      o.connect(g).connect(lp);
      oscs.push(o);
    }
    if (square > 0) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f / 2;
      const g = ctx.createGain();
      g.gain.value = square;
      o.connect(g).connect(lp);
      oscs.push(o);
    }
    for (const o of oscs) o.start(t);
    stop(oscs, end);
  }

  /* Stab: a whole chord through one filter envelope, short and hard. */
  function stab(dest, t, midis, dur, {
    vel = 0.8, cutoff = 500, envAmt = 3200, q = 4, decay = 0.13,
    sustain = 0.12, release = 0.1, detune = 8,
  } = {}) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.linearRampToValueAtTime(cutoff + envAmt * vel, t + 0.01);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff), t + 0.01 + decay * 2);
    lp.Q.value = q;

    const amp = ctx.createGain();
    const end = adsr(amp.gain, t, dur, {
      a: 0.004, d: decay, s: sustain, r: release, peak: (vel * 0.26) / Math.sqrt(midis.length),
    });
    lp.connect(amp).connect(dest);

    const oscs = [];
    for (const midi of midis) {
      for (const cents of [-detune, detune]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(midi);
        o.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        o.connect(g).connect(lp);
        oscs.push(o);
      }
    }
    for (const o of oscs) o.start(t);
    stop(oscs, end);
  }

  /* Pad: slow attack, heavy filtering, long release. Fills the space between
     the bass and the lead without competing with either. */
  function pad(dest, t, midis, dur, {
    vel = 0.7, cutoff = 1100, q = 0.8, attack = 0.35, release = 0.7, detune = 11,
  } = {}) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = q;

    const amp = ctx.createGain();
    const end = adsr(amp.gain, t, dur, {
      a: attack, d: 0.3, s: 0.85, r: release, peak: (vel * 0.2) / Math.sqrt(midis.length),
    });
    lp.connect(amp).connect(dest);

    const oscs = [];
    for (const midi of midis) {
      for (const cents of [-detune, 0, detune]) {
        const o = ctx.createOscillator();
        o.type = cents === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = midiToFreq(midi);
        o.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = cents === 0 ? 0.5 : 0.32;
        o.connect(g).connect(lp);
        oscs.push(o);
      }
    }
    for (const o of oscs) o.start(t);
    stop(oscs, end);
  }

  /* Pluck: triangle plus square with a very fast decay. Arps and bell lines. */
  function pluck(dest, t, midi, dur, {
    vel = 0.8, decay = 0.18, cutoff = 2600, wave = 'triangle', square = 0.3,
  } = {}) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, cutoff * 0.25), t + decay);
    const amp = ctx.createGain();
    const end = hit(amp.gain, t, vel * 0.22, 0.003, Math.max(decay, dur * 0.9));
    lp.connect(amp).connect(dest);

    const oscs = [];
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = midiToFreq(midi);
    o.connect(lp);
    oscs.push(o);
    if (square > 0) {
      const s = ctx.createOscillator();
      s.type = 'square';
      s.frequency.value = midiToFreq(midi);
      s.detune.value = 6;
      const g = ctx.createGain();
      g.gain.value = square;
      s.connect(g).connect(lp);
      oscs.push(s);
    }
    for (const x of oscs) x.start(t);
    stop(oscs, end);
  }

  /* Riser: noise sweeping up through a bandpass under a rising saw. Used once
     per build; it is the thing that makes a drop land. */
  function riser(dest, t, dur, { vel = 0.8, from = 300, to = 6000 } = {}) {
    const n = noise(t, dur + 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(MIN, t);
    g.gain.exponentialRampToValueAtTime(Math.max(MIN, vel * 0.2), t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(MIN, t + dur + 0.06);
    n.connect(bp).connect(g).connect(dest);

    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(560, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(MIN, t);
    og.gain.exponentialRampToValueAtTime(Math.max(MIN, vel * 0.07), t + dur * 0.9);
    og.gain.exponentialRampToValueAtTime(MIN, t + dur + 0.05);
    o.connect(og).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  /* Downlifter: the mirror of the riser, for a KO or the end of a section. */
  function fall(dest, t, dur, { vel = 0.8, from = 900, to = 60 } = {}) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur);
    lp.Q.value = 3;
    const g = ctx.createGain();
    hit(g.gain, t, vel * 0.2, 0.01, dur);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /* Wrap every voice in its trim so callers work in one common scale. */
  const raw = { kick, snare, clap, hat, shaker, tom, crash,
                bass, lead, stab, pad, pluck, riser, fall };
  const kit = { noiseBuffer, raw };
  for (const [name, fn] of Object.entries(raw)) {
    const k = VOICE_TRIM[name] == null ? 1 : VOICE_TRIM[name];
    kit[name] = (dest, ...rest) => {
      const trim = ctx.createGain();
      trim.gain.value = k;
      trim.connect(dest);
      fn(trim, ...rest);
    };
  }
  return kit;
}

export const VOICE_NAMES = [
  'kick', 'snare', 'clap', 'hat', 'shaker', 'tom', 'crash',
  'bass', 'lead', 'stab', 'pad', 'pluck', 'riser', 'fall',
];
