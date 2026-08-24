/* HALF LIGHT — 142 BPM, A minor, half-time.

   The heavy one. The kick and clap sit at half the rate of the other two
   tracks while the hats keep running sixteenths, so it feels slow and fast at
   once. Sub bass carries the weight, a wide seventh-chord pad carries the
   harmony (i–VI–III–V with a major dominant), and the lead is a thin square
   whistle well above everything else so it cuts without adding bulk. */

export const track = {
  key: 'halflight',
  name: 'HALF LIGHT',
  bpm: 142,
  stepsPerBar: 16,
  swing: 0,

  lanes: {
    kick:  { voice: 'kick',   gain: 0.94, pump: 0.34, params: { tune: 0.92 } },
    clap:  { voice: 'clap',   gain: 0.64, send: 0.26 },
    snr:   { voice: 'snare',  gain: 0.40 },
    hat:   { voice: 'hat',    gain: 0.28, params: { decay: 0.032 } },
    ohat:  { voice: 'hat',    gain: 0.22, params: { open: true } },
    cym:   { voice: 'crash',  gain: 0.38, send: 0.26 },
    bass:  { voice: 'bass',   gain: 0.72,
             params: { cutoff: 110, envAmt: 700, q: 4, decay: 0.2, sustain: 0.8,
                       release: 0.12, sub: 0.85, detune: 4 } },
    lead:  { voice: 'lead',   gain: 0.44, send: 0.44,
             params: { cutoff: 1600, envAmt: 1800, q: 3, decay: 0.12, sustain: 0.6,
                       detune: 7, square: 0, wave: 'square', attack: 0.012 } },
    arp:   { voice: 'pluck',  gain: 0.36, send: 0.34, params: { decay: 0.15, cutoff: 3000 } },
    pad:   { voice: 'pad',    gain: 0.32, send: 0.4, params: { cutoff: 820, attack: 0.7 } },
    fx:    { voice: 'riser',  gain: 0.46 },
    down:  { voice: 'fall',   gain: 0.42 },
  },

  patterns: {
    kickHalf: `
      X . . . | . . . . | . . X . | . . . .
      X . . . | . . . . | . . X . | . . X .
    `,
    kickBusy: `
      X . . . | . . . . | . . X . | . . . .
      X . . X | . . . . | . . X . | . . X .
      X . . . | . . . . | . . X . | . . . .
      X . . X | . . X . | . . X . | X . X .
    `,
    clap3: `
      . . . . | . . . . | X . . . | . . . .
    `,
    ghostSnr: `
      . . . . | . . i . | . . . . | i . . i
    `,
    hat16:   ` x i i i | x i i i | x i i i | x i x i `,
    hatRush: ` x i i i | x i i i | x i i i | x x x x `,
    ohatOff: ` . . . . | . . o . | . . . . | . . o . `,
    crashTop: ` X .*255 `,

    subLine: `
      A1 - - - | - - - - | A1 - - - | - - . .
      F1 - - - | - - - - | F1 - - - | - - . .
      C2 - - - | - - - - | C2 - - - | - - . .
      E1 - - - | - - - - | E1 - - - | - - . .
    `,
    subDrive: `
      A1 - - - | - - A1 - | A1 - - - | . . A1 -
      F1 - - - | - - F1 - | F1 - - - | . . F1 -
      C2 - - - | - - C2 - | C2 - - - | . . C2 -
      E1 - - - | - - E1 - | E1 - - - | . . G1 -
    `,

    padSeven: `
      A2+C3+E3+G3   -*15
      F2+A2+C3+E3   -*15
      C3+E3+G3+B3   -*15
      E2+G#2+B2+D3  -*15
    `,
    arpRun: `
      A3 . C4 . | E4 . A4 . | E4 . C4 . | A3 . E4 .
      F3 . A3 . | C4 . F4 . | C4 . A3 . | F3 . C4 .
      C4 . E4 . | G4 . C5 . | G4 . E4 . | C4 . G4 .
      E3 . G#3 . | B3 . E4 . | B3 . G#3 . | E3 . B3 .
    `,

    leadWhistle: `
      E5 - - . | .  .  A4 -  | .  .  .  . | . C5 - .
      D5 - - . | .  .  A4 -  | .  .  .  . | . .  . .
      E5 - - . | .  .  G4 -  | .  B4 -  . | . .  . .
      .  . . . | E5 -  D5 -  | C5 -  B4 - | A4 - - -
    `,
    leadWhistleHi: `
      E6 - - . | .  .  A5 -  | .  .  .  . | . C6 - .
      D6 - - . | .  .  A5 -  | .  .  .  . | . .  . .
      E6 - - . | .  .  G5 -  | .  B5 -  . | . .  . .
      .  . . . | E6 -  D6 -  | C6 -  B5 - | A5 - - -
    `,
    riseLong: ` X -*63 `,
    fallOne:  ` X -*15 | .*48 `,
  },

  sections: [
    { name: 'intro', bars: 4,  cutoff: 700,
      play: { arp: 'arpRun', pad: 'padSeven', hat: 'hat16' } },

    { name: 'rise',  bars: 4,  cutoff: 2200,
      play: { arp: 'arpRun', pad: 'padSeven', hat: 'hatRush',
              bass: 'subLine', fx: 'riseLong' } },

    { name: 'drop',  bars: 16, cutoff: 18000,
      play: { kick: 'kickHalf', clap: 'clap3', snr: 'ghostSnr', hat: 'hat16', ohat: 'ohatOff',
              bass: 'subDrive', pad: 'padSeven', lead: 'leadWhistle', cym: 'crashTop' } },

    { name: 'break', bars: 8,  cutoff: 2600, gain: 0.88,
      play: { hat: 'hat16', arp: 'arpRun', bass: 'subLine',
              pad: 'padSeven', down: 'fallOne' } },

    { name: 'drop2', bars: 16, cutoff: 18000,
      play: { kick: 'kickBusy', clap: 'clap3', snr: 'ghostSnr', hat: 'hatRush', ohat: 'ohatOff',
              bass: 'subDrive', pad: 'padSeven', lead: 'leadWhistleHi',
              arp: 'arpRun', cym: 'crashTop' } },

    { name: 'final', bars: 8,  cutoff: 18000, gain: 1.05,
      play: { kick: 'kickBusy', clap: 'clap3', snr: 'ghostSnr', hat: 'hatRush', ohat: 'ohatOff',
              bass: 'subDrive', pad: 'padSeven', lead: 'leadWhistleHi', arp: 'arpRun' } },
  ],
};
