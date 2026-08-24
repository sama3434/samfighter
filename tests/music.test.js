import { describe, it, expect } from './harness.js';
import { nextTrackKey } from '../src/music.js';
import { MUSIC_KEYS } from '../src/music/ui.js';
import { noteToMidi, midiToFreq, parsePattern } from '../src/music/pattern.js';
import { compileTrack, Sequencer } from '../src/music/sequencer.js';
import { VOICE_KIND, MIX_TRIM, LOOKAHEAD, SCAN_MS } from '../src/music/engine.js';
import { VOICE_NAMES, VOICE_TRIM } from '../src/music/voices.js';
import { TRACKS, ALL_TRACKS, FIGHT_TRACKS, MENU_TRACK } from '../src/music/tracks/index.js';
import { Music } from '../src/music.js';

const throws = (fn) => {
  try { fn(); } catch (err) { return true; }
  return false;
};

describe('music / note names', () => {
  it('puts middle C at MIDI 60', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
  });

  it('reads sharps and flats', () => {
    expect(noteToMidi('G#2')).toBe(44);
    expect(noteToMidi('Ab2')).toBe(44);
    expect(noteToMidi('Bb1')).toBe(34);
  });

  it('converts A4 to 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 0.001);
    expect(midiToFreq(57)).toBeCloseTo(220, 0.001);
  });

  it('rejects a name with no octave', () => {
    expect(throws(() => noteToMidi('C'))).toBeTruthy();
  });
});

describe('music / pattern parsing', () => {
  it('counts one step per token and ignores bar lines', () => {
    const p = parsePattern('X . . . | X . . . | X . . . | X . . .');
    expect(p.length).toBe(16);
    expect(p.events.length).toBe(4);
    expect(p.events[3].step).toBe(12);
  });

  it('turns ties into a note duration', () => {
    const p = parsePattern('C4 - - . F4 -');
    expect(p.events.length).toBe(2);
    expect(p.events[0].dur).toBe(3);
    expect(p.events[1].dur).toBe(2);
    expect(p.events[0].notes[0]).toBe(60);
  });

  it('expands repeats', () => {
    const p = parsePattern('X -*15');
    expect(p.length).toBe(16);
    expect(p.events.length).toBe(1);
    expect(p.events[0].dur).toBe(16);
  });

  it('reads chords and velocities', () => {
    const p = parsePattern('C4+E4+G4 . x:0.25 . D4!');
    expect(p.events[0].notes.length).toBe(3);
    expect(p.events[0].notes[2]).toBe(67);
    expect(p.events[1].vel).toBe(0.25);
    expect(p.events[2].vel).toBe(1);
  });

  it('grades drum symbols loud to soft', () => {
    const p = parsePattern('X x o i');
    const v = p.events.map((e) => e.vel);
    expect(v[0] > v[1] && v[1] > v[2] && v[2] > v[3]).toBeTruthy();
    expect(v[0]).toBe(1);
  });

  it('indexes events by step', () => {
    const p = parsePattern('. . C4 . . E4');
    expect(p.byStep[2].length).toBe(1);
    expect(p.byStep[0]).toBe(undefined);
  });

  it('refuses a tie with nothing before it', () => {
    expect(throws(() => parsePattern('. - C4'))).toBeTruthy();
  });

  it('refuses an unknown token rather than dropping it silently', () => {
    expect(throws(() => parsePattern('X . zz .'))).toBeTruthy();
    expect(throws(() => parsePattern(''))).toBeTruthy();
  });
});

describe('music / track data', () => {
  it('registers the tracks the game asks for', () => {
    expect(FIGHT_TRACKS.length >= 3).toBeTruthy();
    for (const key of FIGHT_TRACKS) expect(!!TRACKS[key]).toBeTruthy();
    expect(!!TRACKS[MENU_TRACK]).toBeTruthy();
    expect(FIGHT_TRACKS.indexOf(MENU_TRACK)).toBe(-1);
  });

  it('compiles every track without a bad lane or pattern reference', () => {
    for (const track of ALL_TRACKS) compileTrack(track);
  });

  it('keeps every pattern a whole number of bars', () => {
    for (const track of ALL_TRACKS) {
      const song = compileTrack(track);
      for (const [name, pat] of Object.entries(song.patterns)) {
        if (pat.length % song.stepsPerBar !== 0) {
          throw new Error(`${track.key}/${name} is ${pat.length} steps, not a multiple of ${song.stepsPerBar}`);
        }
      }
    }
  });

  it('gives every voice a dispatch kind and a measured output trim', () => {
    for (const name of VOICE_NAMES) {
      if (!VOICE_KIND[name]) throw new Error(`voice "${name}" has no dispatch kind`);
      const k = VOICE_TRIM[name];
      // a missing trim would silently mis-level a voice rather than fail loudly
      if (!(k > 0 && k <= 12)) throw new Error(`voice "${name}" has trim ${k}`);
    }
    for (const name of Object.keys(VOICE_KIND)) {
      if (VOICE_NAMES.indexOf(name) < 0) throw new Error(`kind for "${name}" but no such voice`);
    }
  });

  it('uses only voices the engine can dispatch', () => {
    for (const track of ALL_TRACKS) {
      for (const [lane, def] of Object.entries(track.lanes)) {
        if (!VOICE_KIND[def.voice]) throw new Error(`${track.key}/${lane}: no kind for "${def.voice}"`);
        if (VOICE_NAMES.indexOf(def.voice) < 0) throw new Error(`${track.key}/${lane}: no voice "${def.voice}"`);
      }
    }
  });

  it('runs every track at a fight tempo and gives it structure', () => {
    for (const track of ALL_TRACKS) {
      if (!(track.bpm >= 110 && track.bpm <= 180)) throw new Error(`${track.key}: bpm ${track.bpm}`);
      if (!(track.sections.length >= 3)) throw new Error(`${track.key}: needs internal variation`);
      const names = track.sections.map((s) => s.name);
      if (names.indexOf('intro') < 0) throw new Error(`${track.key}: no intro section`);
      if (names.indexOf('drop') < 0) throw new Error(`${track.key}: no drop section`);
    }
  });

  it('gives every fight track the sections the match state asks for', () => {
    for (const key of FIGHT_TRACKS) {
      const names = TRACKS[key].sections.map((s) => s.name);
      for (const want of ['intro', 'drop', 'final']) {
        if (names.indexOf(want) < 0) throw new Error(`${key}: missing "${want}"`);
      }
    }
  });

  it('holds every lane gain and section gain under the ceiling', () => {
    for (const track of ALL_TRACKS) {
      for (const [lane, def] of Object.entries(track.lanes)) {
        const g = def.gain == null ? 0.8 : def.gain;
        if (!(g > 0 && g <= 1.0)) throw new Error(`${track.key}/${lane}: gain ${g}`);
        if (def.send != null && !(def.send >= 0 && def.send <= 0.6)) {
          throw new Error(`${track.key}/${lane}: send ${def.send}`);
        }
        if (def.pump != null && !(def.pump > 0 && def.pump <= 0.8)) {
          throw new Error(`${track.key}/${lane}: pump ${def.pump}`);
        }
      }
      for (const s of track.sections) {
        const g = s.gain == null ? 1 : s.gain;
        if (!(g > 0 && g <= 1.1)) throw new Error(`${track.key}/${s.name}: gain ${g}`);
      }
    }
  });

  it('loops each fight track for longer than a round', () => {
    for (const key of FIGHT_TRACKS) {
      const t = TRACKS[key];
      const bars = t.sections.reduce((n, s) => n + s.bars, 0);
      const seconds = bars * 4 * (60 / t.bpm);
      if (!(seconds > 60)) throw new Error(`${key}: arrangement is only ${seconds.toFixed(1)}s`);
    }
  });
});

describe('music / sequencer', () => {
  const track = TRACKS.ironmarket;

  it('derives step length from the tempo', () => {
    const seq = new Sequencer(track);
    expect(seq.stepDur).toBeCloseTo(60 / track.bpm / 4, 1e-9);
    seq.tempoScale = 2;
    expect(seq.stepDur).toBeCloseTo(60 / (track.bpm * 2) / 4, 1e-9);
  });

  it('emits note times that never go backwards', () => {
    for (const t of Object.values(TRACKS)) {
      const seq = new Sequencer(t, { time: 0 });
      let prev = -1;
      const total = t.sections.reduce((n, s) => n + s.bars, 0) * (t.stepsPerBar || 16);
      for (let i = 0; i < total + 40; i++) {
        const step = seq.collect();
        if (step.time < prev) throw new Error(`${t.key}: step ${i} went backwards`);
        prev = step.time;
        seq.advance();
      }
    }
  });

  it('advances one step per step and wraps the arrangement', () => {
    const seq = new Sequencer(track, { time: 0 });
    const total = track.sections.reduce((n, s) => n + s.bars, 0) * track.stepsPerBar;
    for (let i = 0; i < total; i++) {
      expect(seq.songStep).toBe(i);
      seq.advance();
    }
    expect(seq.loops).toBe(1);
    expect(seq.sectionIndex).toBe(0);
    expect(seq.sectionStep).toBe(0);
    expect(seq.songStep).toBe(total);          // song position keeps counting up
    expect(seq.time).toBeCloseTo(total * seq.stepDur, 1e-6);
  });

  it('crosses into the next section exactly on its bar count', () => {
    const seq = new Sequencer(track, { time: 0 });
    const first = track.sections[0].bars * track.stepsPerBar;
    for (let i = 0; i < first - 1; i++) seq.advance();
    expect(seq.section.name).toBe(track.sections[0].name);
    seq.advance();
    expect(seq.section.name).toBe(track.sections[1].name);
  });

  it('holds a queued section until the next bar line', () => {
    const seq = new Sequencer(track, { time: 0 });
    seq.advance();                       // one step past the downbeat
    seq.queueSection('drop');
    expect(seq.section.name).toBe('intro');
    for (let i = 1; i < track.stepsPerBar; i++) seq.advance();
    expect(seq.section.name).toBe('drop');
    expect(seq.sectionStep).toBe(0);
  });

  it('falls back to the first section when a name is unknown', () => {
    const seq = new Sequencer(track, { startSection: 'nope' });
    expect(seq.sectionIndex).toBe(0);
  });

  it('schedules exactly the steps inside the lookahead window', () => {
    const seq = new Sequencer(track, { time: 0 });
    const seen = [];
    seq.pump(0.35, (s) => seen.push(s.time));      // stepDur is 0.1s at 150bpm
    expect(seen.length).toBe(4);
    expect(seen[0]).toBeCloseTo(0, 1e-9);
    expect(seen[3]).toBeCloseTo(0.3, 1e-9);
    seq.pump(0.35, (s) => seen.push(s.time));      // same window schedules nothing new
    expect(seen.length).toBe(4);
  });

  it('never emits a note the scheduler has already passed', () => {
    const seq = new Sequencer(track, { time: 0 });
    let last = -1;
    for (let clock = 0; clock < 6; clock += SCAN_MS / 1000) {
      seq.pump(clock + LOOKAHEAD, (s) => {
        if (s.time < clock) throw new Error(`step at ${s.time} scheduled after clock ${clock}`);
        last = s.time;
      });
    }
    expect(last).toBeGreaterThan(5);
  });

  it('produces notes on the very first step of a drop', () => {
    const seq = new Sequencer(track, { startSection: 'drop', time: 0 });
    const step = seq.collect();
    expect(step.notes.length).toBeGreaterThan(2);
    expect(step.sectionName).toBe('drop');
  });

  it('never asks a lane for a pattern step outside that pattern', () => {
    for (const t of Object.values(TRACKS)) {
      const seq = new Sequencer(t, { time: 0 });
      const total = t.sections.reduce((n, s) => n + s.bars, 0) * (t.stepsPerBar || 16);
      for (let i = 0; i < total; i++) {
        for (const note of seq.collect().notes) {
          if (!note.def) throw new Error(`${t.key}: note with no lane definition`);
          if (!(note.dur > 0)) throw new Error(`${t.key}: note with duration ${note.dur}`);
          if (!(note.vel > 0 && note.vel <= 1)) throw new Error(`${t.key}: velocity ${note.vel}`);
        }
        seq.advance();
      }
    }
  });
});

describe('music / mix and controls', () => {
  it('trims the music well below the sound effects', () => {
    expect(MIX_TRIM).toBeLessThan(0.4);
    expect(MIX_TRIM).toBeGreaterThan(0);
  });

  it('schedules further ahead than the scan interval', () => {
    expect(LOOKAHEAD).toBeGreaterThan((SCAN_MS / 1000) * 2);
  });

  it('clamps the volume control at both ends', () => {
    const before = Music.volume;
    Music.setVolume(5);
    expect(Music.volume).toBe(1);
    Music.setVolume(-3);
    expect(Music.volume).toBe(0);
    Music.nudgeVolume(0.1);
    expect(Music.volume).toBeCloseTo(0.1, 1e-6);
    Music.setVolume(before);
  });

  it('toggles mute without needing an audio context', () => {
    const before = Music.muted;
    Music.setMuted(true);
    expect(Music.muted).toBeTruthy();
    Music.toggleMute();
    expect(Music.muted).toBeFalsy();
    Music.setMuted(before);
  });

  it('ignores a cue when no engine has been attached', () => {
    Music.cue('punch');
    Music.cue('nonsense');
  });
});

describe('track switching', () => {
  it('steps forward through every fight track and wraps', () => {
    const seen = [];
    let key = FIGHT_TRACKS[0];
    for (let i = 0; i < FIGHT_TRACKS.length; i++) {
      seen.push(key);
      key = nextTrackKey(key, 1);
    }
    expect(new Set(seen).size).toBe(FIGHT_TRACKS.length);
    expect(key).toBe(FIGHT_TRACKS[0]);
  });

  it('steps backwards too', () => {
    const first = FIGHT_TRACKS[0];
    expect(nextTrackKey(first, -1)).toBe(FIGHT_TRACKS[FIGHT_TRACKS.length - 1]);
  });

  it('starts at the top when the current track is the menu loop or unknown', () => {
    expect(nextTrackKey(MENU_TRACK, 1)).toBe(FIGHT_TRACKS[0]);
    expect(nextTrackKey(undefined, 1)).toBe(FIGHT_TRACKS[0]);
    expect(nextTrackKey(null, 1)).toBe(FIGHT_TRACKS[0]);
  });

  it('never lands on the menu track', () => {
    let key = FIGHT_TRACKS[0];
    for (let i = 0; i < FIGHT_TRACKS.length * 3; i++) {
      key = nextTrackKey(key, 1);
      expect(key === MENU_TRACK).toBeFalsy();
    }
  });
});

describe('music keys', () => {
  it('are all distinct', () => {
    const keys = Object.values(MUSIC_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('do not collide with anything a fighter uses', () => {
    // both control schemes, plus the match-level restart key
    const gameplay = new Set([
      'a', 'd', 'w', 's', 'f', 'g', 'h', 'q',
      'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ',', '.', '/', 'm',
      'enter',
    ]);
    for (const k of Object.values(MUSIC_KEYS)) {
      if (gameplay.has(k)) throw new Error(`music key "${k}" is already a gameplay key`);
    }
  });
});
