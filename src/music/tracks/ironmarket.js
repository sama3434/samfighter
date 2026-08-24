/* IRON MARKET — 150 BPM, F minor, four-on-the-floor.

   The default fight track and the most straightforward of the three: a hard
   kick on every beat, an open hat on every off-beat, a rolling sixteenth bass
   over i–VI–III–VII, and a four-note lead figure that repeats until it stops
   sounding like a melody and starts sounding like a machine. */

export const track = {
  key: 'ironmarket',
  name: 'IRON MARKET',
  bpm: 150,
  stepsPerBar: 16,
  swing: 0,

  lanes: {
    kick:  { voice: 'kick',   gain: 0.90, pump: 0.42 },
    clap:  { voice: 'clap',   gain: 0.60, send: 0.16 },
    hat:   { voice: 'hat',    gain: 0.30 },
    ohat:  { voice: 'hat',    gain: 0.24, params: { open: true } },
    shk:   { voice: 'shaker', gain: 0.22 },
    cym:   { voice: 'crash',  gain: 0.42, send: 0.2 },
    bass:  { voice: 'bass',   gain: 0.80,
             params: { cutoff: 190, envAmt: 1700, q: 8, decay: 0.1, sustain: 0.5, sub: 0.6 } },
    lead:  { voice: 'lead',   gain: 0.50, send: 0.3,
             params: { cutoff: 850, envAmt: 3000, q: 7, decay: 0.14, sustain: 0.4, detune: 14 } },
    stab:  { voice: 'stab',   gain: 0.38, send: 0.24,
             params: { cutoff: 480, envAmt: 3600, decay: 0.11, sustain: 0.1 } },
    pad:   { voice: 'pad',    gain: 0.30, send: 0.3, params: { cutoff: 950, attack: 0.5 } },
    fx:    { voice: 'riser',  gain: 0.5 },
  },

  patterns: {
    kickMain: `
      X . . . | X . . . | X . . . | X . . .
      X . . . | X . . . | X . . . | X . . .
      X . . . | X . . . | X . . . | X . . .
      X . . . | X . . . | X . . . | X . . o
    `,
    kickDrive: `
      X . . . | X . . . | X . . . | X . . .
      X . . . | X . . . | X . . . | X . . o
      X . . . | X . . . | X . . . | X . . .
      X . . o | X . . . | X . . o | X . o .
    `,
    clap24: `
      . . . . | X . . . | . . . . | X . . .
      . . . . | X . . . | . . . . | X . . .
      . . . . | X . . . | . . . . | X . . .
      . . . . | X . . . | . . . . | X . o o
    `,
    hat16:    ` x i . i | x i . i | x i . i | x i . i `,
    ohatOff:  ` . . o . | . . o . | . . o . | . . o . `,
    shakeRun: ` . i . i | . i . i | . i . i | . i . i `,
    crashTop: ` X .*255 `,

    bassRoots: `
      F1  . . . | . . F1  - | . . . . | . . . .
      Db1 . . . | . . Db1 - | . . . . | . . . .
      Ab1 . . . | . . Ab1 - | . . . . | . . . .
      Eb1 . . . | . . Eb1 - | . . . . | . . . .
    `,
    bassRoll: `
      F1  . F1  - | . F1  . F1  | . . F1  - | F1  . C2  .
      Db1 . Db1 - | . Db1 . Db1 | . . Db1 - | Db1 . Ab1 .
      Ab1 . Ab1 - | . Ab1 . Ab1 | . . Ab1 - | Ab1 . Eb2 .
      Eb1 . Eb1 - | . Eb1 . Eb1 | . . Eb1 - | Eb1 . Bb1 .
    `,

    leadMotif: `
      F4 - . Ab4 | .  C5  -  .   | Bb4 -   . . | Ab4 . F4 -
      .  . C5 -  | .  Db5 .  C5  | .   Bb4 - . | Ab4 . .  .
    `,
    leadHigh: `
      F5 - . Ab5 | .  C6  -  .   | Bb5 -   . . | Ab5 . F5 -
      .  . C6 -  | .  Db6 .  C6  | .   Bb5 - . | Ab5 . .  .
    `,

    stabs: `
      . . . . | . . F3+Ab3+C4  . | . . . . | . . F3+Ab3+C4  .
      . . . . | . . Db3+F3+Ab3 . | . . . . | . . Eb3+G3+Bb3 .
    `,
    padBed: `
      F2+Ab2+C3  -*15
      Db2+F2+Ab2 -*15
      Ab2+C3+Eb3 -*15
      Eb2+G2+Bb2 -*15
    `,
    riseLong: ` X -*63 `,
  },

  sections: [
    { name: 'intro', bars: 4,  cutoff: 780,
      play: { hat: 'hat16', bass: 'bassRoots', pad: 'padBed' } },

    { name: 'rise',  bars: 4,  cutoff: 2400,
      play: { hat: 'hat16', ohat: 'ohatOff', bass: 'bassRoll', pad: 'padBed', fx: 'riseLong' } },

    { name: 'drop',  bars: 16, cutoff: 18000,
      play: { kick: 'kickMain', clap: 'clap24', hat: 'hat16', ohat: 'ohatOff',
              bass: 'bassRoll', lead: 'leadMotif', stab: 'stabs', cym: 'crashTop' } },

    { name: 'break', bars: 8,  cutoff: 2800, gain: 0.9,
      play: { hat: 'hat16', shk: 'shakeRun', bass: 'bassRoots',
              pad: 'padBed', lead: 'leadMotif' } },

    { name: 'drop2', bars: 16, cutoff: 18000,
      play: { kick: 'kickDrive', clap: 'clap24', hat: 'hat16', ohat: 'ohatOff', shk: 'shakeRun',
              bass: 'bassRoll', lead: 'leadHigh', stab: 'stabs', cym: 'crashTop' } },

    { name: 'final', bars: 8,  cutoff: 18000, gain: 1.05,
      play: { kick: 'kickDrive', clap: 'clap24', hat: 'hat16', ohat: 'ohatOff', shk: 'shakeRun',
              bass: 'bassRoll', lead: 'leadHigh', stab: 'stabs' } },
  ],
};
