/* GHOSTWIRE — 158 BPM, C minor, breakbeat.

   The nervous one. The kick moves off the beat, the snare carries ghost notes,
   and the bass is a resonant sixteenth line whose filter opens on every note.
   The chords walk i–III–VI–V, so it keeps leaning on a major dominant that
   never quite resolves — which is the point during a round. */

export const track = {
  key: 'ghostwire',
  name: 'GHOSTWIRE',
  bpm: 158,
  stepsPerBar: 16,
  swing: 0.06,

  lanes: {
    kick:  { voice: 'kick',   gain: 0.88, pump: 0.3, params: { tune: 1.05 } },
    snr:   { voice: 'snare',  gain: 0.62, send: 0.18 },
    hat:   { voice: 'hat',    gain: 0.32 },
    ohat:  { voice: 'hat',    gain: 0.24, params: { open: true } },
    tom:   { voice: 'tom',    gain: 0.46, params: { freq: 128 } },
    cym:   { voice: 'crash',  gain: 0.40, send: 0.24 },
    bass:  { voice: 'bass',   gain: 0.78,
             params: { cutoff: 140, envAmt: 2600, q: 11, decay: 0.09,
                       sustain: 0.35, sub: 0.45, detune: 6 } },
    lead:  { voice: 'lead',   gain: 0.46, send: 0.42,
             params: { cutoff: 700, envAmt: 2400, q: 5, decay: 0.2, sustain: 0.55,
                       detune: 16, square: 0.18, glide: 0.04 } },
    stab:  { voice: 'stab',   gain: 0.36, send: 0.3,
             params: { cutoff: 600, envAmt: 3000, decay: 0.09, sustain: 0.06 } },
    pad:   { voice: 'pad',    gain: 0.28, send: 0.36, params: { cutoff: 780, attack: 0.6 } },
    fx:    { voice: 'riser',  gain: 0.5 },
  },

  patterns: {
    kickBreak: `
      X . . . | . . x . | . . X . | . . . .
      X . . . | . . x . | . . X . | . x . .
    `,
    kickHeavy: `
      X . . . | . . x . | . . X . | . . x .
      X . . X | . . x . | . . X . | . x . x
    `,
    snrBreak: `
      . . . . | X . . o | . . . . | X . . .
      . . . . | X . . o | . . i . | X . o .
    `,
    snrSparse: `
      . . . . | X . . . | . . . . | X . . .
    `,
    hatRoll:  ` x . i i | o . i i | x . i i | o i i i `,
    hatSimple: ` x . o . | x . o . | x . o . | x . o . `,
    ohatOff:  ` . . . . | . . o . | . . . . | . . o . `,
    fill:     ` .*60 | o o x X `,
    crashTop: ` X .*255 `,

    bassAcid: `
      C2 - . C2 | . Eb2 . C2  | . . G1 -  | C2  . Bb1 .
      C2 - . C2 | . G2  . Eb2 | . . C2 -  | Ab1 . Bb1 .
    `,
    bassRoots: `
      C2  - - - | . . . . | C2  - . . | . . . .
      Eb2 - - - | . . . . | Eb2 - . . | . . . .
      Ab1 - - - | . . . . | Ab1 - . . | . . . .
      G1  - - - | . . . . | G1  - . . | . . . .
    `,

    leadWire: `
      G4  - - - | . . Eb4 -  | .  .  .  . | . . . .
      F4  - - . | . Eb4 . D4 | -  -  .  . | . . . .
      Ab4 - - - | . . G4  -  | .  .  F4 - | . . . .
      G4  - - . | . .   .  . | D4 -  -  - | . . . .
    `,
    leadWireHi: `
      G5  - - - | . . Eb5 -  | .  .  .  . | . . . .
      F5  - - . | . Eb5 . D5 | -  -  .  . | . . . .
      Ab5 - - - | . . G5  -  | .  .  F5 - | . . . .
      G5  - - . | . .   .  . | D5 -  -  - | . . . .
    `,

    stabWalk: `
      . . . . | . . . . | . . C3+Eb3+G3  . | . . . C3+Eb3+G3
      . . . . | . . . . | . . Eb3+G3+Bb3 . | . . . Eb3+G3+Bb3
      . . . . | . . . . | . . Ab2+C3+Eb3 . | . . . Ab2+C3+Eb3
      . . . . | . . . . | . . G2+B2+D3   . | . . . G2+B2+D3
    `,
    padBed: `
      C3+Eb3+G3  -*15
      Eb3+G3+Bb3 -*15
      Ab2+C3+Eb3 -*15
      G2+B2+D3   -*15
    `,
    riseLong: ` X -*63 `,
  },

  sections: [
    { name: 'intro', bars: 4,  cutoff: 900,
      play: { hat: 'hatSimple', bass: 'bassRoots', pad: 'padBed' } },

    { name: 'rise',  bars: 4,  cutoff: 2600,
      play: { hat: 'hatRoll', snr: 'snrSparse', bass: 'bassAcid',
              pad: 'padBed', fx: 'riseLong' } },

    { name: 'drop',  bars: 16, cutoff: 18000,
      play: { kick: 'kickBreak', snr: 'snrBreak', hat: 'hatRoll', ohat: 'ohatOff',
              bass: 'bassAcid', lead: 'leadWire', stab: 'stabWalk',
              cym: 'crashTop', tom: 'fill' } },

    { name: 'break', bars: 8,  cutoff: 3000, gain: 0.88,
      play: { hat: 'hatRoll', snr: 'snrSparse', bass: 'bassRoots',
              pad: 'padBed', lead: 'leadWire' } },

    { name: 'drop2', bars: 16, cutoff: 18000,
      play: { kick: 'kickHeavy', snr: 'snrBreak', hat: 'hatRoll', ohat: 'ohatOff',
              bass: 'bassAcid', lead: 'leadWireHi', stab: 'stabWalk',
              cym: 'crashTop', tom: 'fill' } },

    { name: 'final', bars: 8,  cutoff: 18000, gain: 1.05,
      play: { kick: 'kickHeavy', snr: 'snrBreak', hat: 'hatRoll', ohat: 'ohatOff',
              bass: 'bassAcid', lead: 'leadWireHi', stab: 'stabWalk', tom: 'fill' } },
  ],
};
