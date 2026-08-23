# SAM FIGHTER

A local 1v1 pixel-art fighting game for the browser. Two players, one keyboard, no
build step and no dependencies — plain HTML, CSS and canvas.

Pick a fighter, then fight. Four stages rotate as the match goes on: **temple**,
**pyramids**, **city**, **mountain**.

## Roster

| | |
|---|---|
| **KAI** | Headband, spiky hair, heavier build |
| **MIRA** | Ponytail, lighter build, quicker silhouette |

They share the same frame data for now — the difference is look, not moves. Mirror
matches work: the character is palette-swapped so player one is always the cool colours
and player two the warm ones.

## Play

```sh
./serve.sh
```

then open <http://localhost:8123>. The game is ES modules, which browsers refuse to
load over `file://`, so it needs a server even though nothing is compiled.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Browse the roster | `A` / `D` | `←` / `→` |
| Lock in / cancel | `F` / `H` | `,` / `/` |
| Move | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch | `S` | `↓` |
| Punch | `F` | `,` |
| Kick | `G` | `.` |
| Block | `H` | `/` |

- **Crouch + kick** — sweep. Slower, knocks down, and travels under a standing guard.
- **Jump + punch/kick** — air attack. One per jump.
- Blocking cuts a hit to chip damage, but only while grounded and turned toward the
  attacker — jump over someone holding guard and it does not save them.
- Walking backwards is slower than walking forwards.
- First to 2 rounds wins. Rounds are 60 seconds; on time-out the healthier fighter
  takes it, and equal health is a draw.
- `Enter` restarts a match in progress; once someone has won, it returns you to the
  character select.

## Layout

```
index.html          canvas + control legend
style.css           page chrome
serve.sh            local server
src/
  config.js         world constants and tuning
  characters.js     the roster: builds and palettes
  select.js         character select state
  moves.js          frame data for every attack
  fighter.js        physics, stance, attack state machine
  combat.js         hit resolution, blocking, pushing apart
  match.js          round and match flow
  input.js          key state and control schemes
  audio.js          synthesized sound
  pixel/            buffer, primitives, dithering, outline, bitmap font
  render/           poses, fighter sprites, HUD, select screen, frame composition
  stages/           one module per stage, plus the registry
tests/              browser test suite
```

`CONTRIBUTING.md` has the module ownership map and a git-worktree workflow for
working on several parts at once.

## Tests

Open <http://localhost:8123/tests/>. The suite runs on load and prints a pass/fail
list; there is no Node on the toolchain, so the tests run in the browser against the
real modules.

## How it works

**The pixel pipeline.** Everything is drawn into a 480x270 buffer and then blown up 2x
to the 960x540 canvas with smoothing off, so the pixel grid is real rather than a
filter over vector art. 480x270 is exactly half the canvas in each direction, which
keeps the upscale a clean integer and leaves room for fighters about 112px tall —
roughly the proportion of the frame that SF2 gave its cast.

Sky gradients are flat colour bands with an ordered 4x4 Bayer dither only at the seams;
dithering a whole gradient just produces uniform noise. Glows add a hash-based jitter to
the threshold, because a smooth radial falloff run through the bare Bayer matrix steps
in visible squares.

**Fighters** are drawn procedurally rather than from sprite sheets: a posed skeleton
(`render/poses.js`) rendered as tapered limbs in three tones, then given a silhouette
keyline. Every pose returns the same joints, so limb lengths stay consistent between
animations and a new move needs only a pose branch. A character supplies the limb
widths and hair style, so the roster is data rather than a second set of drawing code —
and the select screen draws its portraits with the same function the match uses, so the
art can never drift out of sync with what you actually get.

**Stages** are painted once into a cached canvas; only the animated overlay — petals,
snow, birds, neon flicker — is redrawn per frame.

**The simulation** runs at a fixed 60Hz on an accumulator, decoupled from render, so the
game plays identically regardless of display refresh rate. Moves are frame data
(`startup` / `active` / `recovery`), and a hitbox exists only during active frames, so
whiffing and trading behave the way they should. Landing a hit triggers hitstop, screen
shake and sparks.

The simulation modules never touch a canvas, which is what makes them testable.

## Ideas next

- Hand-authored sprite sheets, for detail beyond what procedural drawing can reach
- A second character with different frame data
- Special moves on directional inputs (quarter-circle, charge)
- Combo counter and juggle rules
- Simple AI so one player can practise alone
- Gamepad support via the Gamepad API
