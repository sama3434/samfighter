/* The sequencer: track data in, timed note events out.

   Deliberately free of WebAudio. It knows nothing but numbers, which is what
   lets the test suite drive it with a fake clock, and what lets the same code
   render a track offline for measurement and play it live. */

import { parsePattern } from './pattern.js';

/** Turn authored track data into the indexed form the sequencer walks. */
export function compileTrack(track) {
  const stepsPerBar = track.stepsPerBar || 16;
  if (!track.lanes) throw new Error(`track "${track.key}" has no lanes`);
  if (!track.sections || !track.sections.length) throw new Error(`track "${track.key}" has no sections`);

  const patterns = {};
  for (const [name, src] of Object.entries(track.patterns || {})) {
    try {
      patterns[name] = parsePattern(src);
    } catch (err) {
      throw new Error(`${track.key}/${name}: ${err.message}`);
    }
  }

  const sections = track.sections.map((s, i) => {
    if (!(s.bars > 0)) throw new Error(`${track.key}: section ${s.name || i} needs bars > 0`);
    const lanes = Object.entries(s.play || {}).map(([lane, patternName]) => {
      if (!track.lanes[lane]) throw new Error(`${track.key}/${s.name}: unknown lane "${lane}"`);
      if (!patterns[patternName]) throw new Error(`${track.key}/${s.name}: unknown pattern "${patternName}"`);
      return { lane, def: track.lanes[lane], pattern: patterns[patternName], name: patternName };
    });
    return {
      name: s.name || `section${i}`,
      bars: s.bars,
      steps: s.bars * stepsPerBar,
      cutoff: s.cutoff == null ? 16000 : s.cutoff,
      gain: s.gain == null ? 1 : s.gain,
      lanes,
    };
  });

  return {
    key: track.key,
    name: track.name,
    bpm: track.bpm,
    swing: track.swing || 0,
    stepsPerBar,
    patterns,
    lanes: track.lanes,
    sections,
  };
}

export class Sequencer {
  constructor(track, { startSection = 0, time = 0 } = {}) {
    this.song = compileTrack(track);
    this.reset(startSection, time);
  }

  reset(startSection = 0, time = 0) {
    this.sectionIndex = this.indexOfSection(startSection);
    this.sectionStep = 0;
    this.songStep = 0;         // monotonic, never resets while playing
    this.time = time;          // context time of the *next* step
    this.tempoScale = 1;
    this.queued = null;
    this.loops = 0;
  }

  indexOfSection(nameOrIndex) {
    if (typeof nameOrIndex === 'number') {
      return Math.max(0, Math.min(this.song.sections.length - 1, nameOrIndex | 0));
    }
    const i = this.song.sections.findIndex((s) => s.name === nameOrIndex);
    return i < 0 ? 0 : i;
  }

  get section() { return this.song.sections[this.sectionIndex]; }
  get stepsPerBar() { return this.song.stepsPerBar; }
  get bpm() { return this.song.bpm * this.tempoScale; }
  get stepDur() { return 60 / this.bpm / (this.song.stepsPerBar / 4); }
  get atBarStart() { return this.sectionStep % this.song.stepsPerBar === 0; }

  /** Ask to jump to a named section; it takes effect on the next bar line. */
  queueSection(name) {
    const i = this.indexOfSection(name);
    if (i === this.sectionIndex && this.queued == null) return;
    this.queued = i;
  }

  /** Collect everything that sounds on the current step. */
  collect() {
    const section = this.section;
    const swingOffset = (this.songStep % 2 === 1 ? this.song.swing * this.stepDur : 0);
    const notes = [];
    for (const { lane, def, pattern } of section.lanes) {
      const events = pattern.byStep[this.sectionStep % pattern.length];
      if (!events) continue;
      for (const e of events) {
        notes.push({
          lane,
          def,
          notes: e.notes,
          vel: e.vel,
          dur: e.dur * this.stepDur,
          steps: e.dur,
        });
      }
    }
    return {
      time: this.time + swingOffset,
      section,
      sectionName: section.name,
      songStep: this.songStep,
      sectionStep: this.sectionStep,
      barStart: this.atBarStart,
      notes,
    };
  }

  /** Move to the next step, crossing section and arrangement boundaries. */
  advance() {
    this.time += this.stepDur;
    this.songStep++;
    this.sectionStep++;

    const len = this.section.steps;
    if (this.sectionStep >= len) {
      this.sectionStep = 0;
      if (this.queued != null) {
        this.sectionIndex = this.queued;
        this.queued = null;
      } else {
        this.sectionIndex++;
        if (this.sectionIndex >= this.song.sections.length) {
          this.sectionIndex = 0;
          this.loops++;
        }
      }
    } else if (this.queued != null && this.atBarStart) {
      this.sectionIndex = this.queued;
      this.queued = null;
      this.sectionStep = 0;
    }
  }

  /**
   * Schedule every step that starts before `until`.
   * The guard keeps a pathological call (a huge window, a stalled tab) from
   * locking the thread; it drops notes rather than freezing the page.
   */
  pump(until, emit) {
    let guard = 0;
    while (this.time < until && guard++ < 4096) {
      emit(this.collect());
      this.advance();
    }
    return guard;
  }
}
