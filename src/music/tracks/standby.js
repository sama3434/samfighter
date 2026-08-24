/* STANDBY — 124 BPM, A minor. The character select loop.

   Deliberately underwritten: a soft kick, an off-beat hat, one arpeggio and a
   pad. It has to survive being heard every time you come back to the roster,
   so it stays out of the way and never introduces a lead. */

export const track = {
  key: 'standby',
  name: 'STANDBY',
  bpm: 124,
  stepsPerBar: 16,
  swing: 0.08,

  lanes: {
    kick: { voice: 'kick',   gain: 0.58, pump: 0.22 },
    hat:  { voice: 'hat',    gain: 0.24 },
    shk:  { voice: 'shaker', gain: 0.22 },
    bass: { voice: 'bass',   gain: 0.62,
            params: { cutoff: 130, envAmt: 600, q: 3, decay: 0.18, sustain: 0.7, sub: 0.7 } },
    arp:  { voice: 'pluck',  gain: 0.34, send: 0.45, params: { decay: 0.22, cutoff: 2400 } },
    pad:  { voice: 'pad',    gain: 0.28, send: 0.45, params: { cutoff: 700, attack: 0.9 } },
  },

  patterns: {
    kickSoft: ` X . . . | . . . . | X . . . | . . . . `,
    hatOff:   ` . . o . | . . o . | . . o . | . . o . `,
    shakeRun: ` . i . i | . i . i | . i . i | . i . i `,
    bassSlow: `
      A1 - - - | - - - - | - - - - | - - . .
      F1 - - - | - - - - | - - - - | - - . .
      D2 - - - | - - - - | - - - - | - - . .
      E1 - - - | - - - - | - - - - | - - . .
    `,
    arpSoft: `
      A3 . E4 . | C4 . E4 . | A4 . E4 . | C4 . A3 .
      F3 . C4 . | A3 . C4 . | F4 . C4 . | A3 . F3 .
      D3 . A3 . | F3 . A3 . | D4 . A3 . | F3 . D3 .
      E3 . B3 . | G3 . B3 . | E4 . B3 . | G3 . E3 .
    `,
    padBed: `
      A2+C3+E3   -*15
      F2+A2+C3   -*15
      D2+F2+A2   -*15
      E2+G2+B2   -*15
    `,
  },

  sections: [
    { name: 'intro', bars: 4, cutoff: 1400,
      play: { arp: 'arpSoft', pad: 'padBed' } },
    { name: 'drop',  bars: 8, cutoff: 9000,
      play: { kick: 'kickSoft', hat: 'hatOff', shk: 'shakeRun',
              bass: 'bassSlow', arp: 'arpSoft', pad: 'padBed' } },
    { name: 'break', bars: 4, cutoff: 3000, gain: 0.9,
      play: { hat: 'hatOff', arp: 'arpSoft', pad: 'padBed' } },
  ],
};
