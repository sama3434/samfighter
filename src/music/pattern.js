/* Pattern notation.

   A pattern is a whitespace-separated list of step tokens, one token per
   sixteenth by default. `|` is a bar separator and is ignored, so a pattern
   can be laid out to read like a drum grid:

     kick:  'X . . . | X . . . | X . . . | X . . .'
     bass:  'F1 . F1 -  . F1 . F1  . . F1 -  F1 . C2 .'

   Tokens:

     .            rest
     -            tie — extends the previous note by one step
     X x o i      drum hits, loud to ghost (1.0 / 0.72 / 0.45 / 0.28)
     F2  Ab1  C#4 a pitched note; octave 4 holds middle C
     F2+Ab2+C3    a chord — one voice, several pitches
     C4!          accent (velocity 1.0)
     C4:0.35      explicit velocity
     .*15         repeat the previous form 15 times — `X -*15` is a whole note,
                  `. *31` two empty bars, without a wall of dots

   Parsing turns that into note events with a duration in steps, so a voice
   knows how long to hold a note without the scheduler tracking ties. */

const SEMITONE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const DRUM_VELOCITY = { X: 1, x: 0.72, o: 0.45, i: 0.28 };
const NOTE_RE = /^([a-gA-G])([#b]?)(-?\d+)$/;

/** Middle C ("C4") is MIDI 60, matching the usual tracker convention. */
export function noteToMidi(name) {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`bad note name "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + SEMITONE[m[1].toLowerCase()] + acc;
}

export const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const isNoteToken = (tok) => NOTE_RE.test(tok);

/** Split a token into its body and velocity, honouring `!` and `:v`. */
function splitVelocity(tok) {
  const colon = tok.indexOf(':');
  if (colon >= 0) {
    const vel = parseFloat(tok.slice(colon + 1));
    if (!Number.isFinite(vel)) throw new Error(`bad velocity in "${tok}"`);
    return { body: tok.slice(0, colon), vel: Math.max(0, Math.min(1, vel)) };
  }
  if (tok.length > 1 && tok.endsWith('!')) return { body: tok.slice(0, -1), vel: 1 };
  return { body: tok, vel: null };
}

/**
 * Parse a pattern string.
 * @returns {{length:number, events:Array, byStep:Array}} events carry
 *   `{step, notes, vel, dur}`; `notes` is empty for unpitched drum voices.
 *   `byStep` indexes the same events by their start step for O(1) lookup.
 */
const REPEAT_RE = /^(.+)\*(\d+)$/;

/** Expand `x*4` into four `x` tokens. Applied before anything else parses. */
function expand(tokens) {
  const out = [];
  for (const tok of tokens) {
    const m = REPEAT_RE.exec(tok);
    if (!m) { out.push(tok); continue; }
    const n = parseInt(m[2], 10);
    if (!(n >= 1 && n <= 4096)) throw new Error(`bad repeat count in "${tok}"`);
    for (let i = 0; i < n; i++) out.push(m[1]);
  }
  return out;
}

export function parsePattern(src) {
  const tokens = expand(String(src).split(/[\s|]+/).filter(Boolean));
  if (tokens.length === 0) throw new Error('empty pattern');

  const events = [];
  let held = null;

  tokens.forEach((tok, step) => {
    if (tok === '.') { held = null; return; }
    if (tok === '-') {
      if (!held) throw new Error(`tie at step ${step} with nothing to extend`);
      held.dur++;
      return;
    }

    const { body, vel } = splitVelocity(tok);

    if (Object.prototype.hasOwnProperty.call(DRUM_VELOCITY, body)) {
      held = { step, notes: [], vel: vel == null ? DRUM_VELOCITY[body] : vel, dur: 1 };
      events.push(held);
      return;
    }

    const parts = body.split('+');
    if (!parts.every(isNoteToken)) throw new Error(`unknown pattern token "${tok}" at step ${step}`);
    held = { step, notes: parts.map(noteToMidi), vel: vel == null ? 0.8 : vel, dur: 1 };
    events.push(held);
  });

  const byStep = new Array(tokens.length);
  for (const e of events) {
    (byStep[e.step] || (byStep[e.step] = [])).push(e);
  }

  return { length: tokens.length, events, byStep };
}
