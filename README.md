# SAM FIGHTER

A local 1v1 pixel-art fighting game for the browser. Two players on one keyboard, or
one player against the computer — no build step and no dependencies, plain HTML, CSS
and canvas.

Pick a mode, pick a fighter, then fight. Five stages rotate as the match goes on, each built around
a different shape rather than a shared template:

| Stage | |
|---|---|
| **Temple** | An enclosed market street at dusk, shopfronts pressing in from both sides |
| **Pyramids** | An open dig site under monumental pyramids, low horizon, a seated colossus |
| **City** | A rooftop at night, the skyline sitting *below* the parapet |
| **Mountain** | A rope bridge strung over a gorge, sheer cliff on one side, open air on the other |
| **Corsair** | A ship's weather deck under a squall, framed by its own rigging |

## Roster

| | |
|---|---|
| **KAI** | Headband, spiky hair, heavier build |
| **MIRA** | Ponytail, lighter build, quicker silhouette |
| **ASH** | Flat-top fade, stubble, and hands that are permanently on fire |

KAI and MIRA share the same frame data — between them the difference is look, not
moves. ASH is the first character with a move set of his own: every hit is a little
lighter than theirs, but his punch **sets the opponent alight** (6 extra damage
burning off over 2 seconds — 3 a second — refreshed rather than stacked by the next
punch), his jab and kick are the fastest in the game, his meter fills in five hits
instead of KAI's four kicks, and his special is a **charged fire beam** — he draws
both hands back, gathers, and thrusts both palms forward to launch a 15-damage bolt
across the stage instead of the spin. Mirror matches work: the character is
palette-swapped so player one is always the cool colours and player two the warm
ones — except ASH, who burns orange as player one and blue as player two.

Each player drives the select screen from their own movement keys — left and right to
choose, up to lock in, down to back out. The attack keys confirm too, out of arcade
habit, but you never have to move your hands.

## Fighting the computer

The first screen offers **VS PLAYER** or **VS COMPUTER**. Choosing the computer opens
a row of five difficulty levels — NOVICE up to CHAMPION, level 5 the hardest. Either
player's movement keys (WASD or the arrows) drive both menus, since a lone player
might have either hand on the keyboard. In the fight you use **Player 1's controls**;
on the character select you pick your fighter and the computer then visibly picks its
own. `Esc` on the select screen returns to the mode screen.

Difficulty is behaviour, never cheating: every level plays the same fighter with the
same health, damage and meter. What rises with the level is how fast the computer
notices what you are doing — reaction time, how reliably it blocks (and whether it
crouches under a sweep), whether it anti-airs a jump-in, whether it punishes a whiffed
move during recovery, its spacing discipline, and whether it spends its meter. Level 1
barely blocks and swings half-heartedly; level 5 walks you down, turtles your strings
and takes its openings. The opponent lives in `src/ai.js`, is driven by a seeded
generator, and writes into the same input structure a human's keys do — so whole
matches replay deterministically in the test suite, which asserts the win rate
actually rises level by level.

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
| Lock in / cancel | `W` / `S` | `↑` / `↓` |
| Move | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch | `S` | `↓` |
| Punch | `F` | `,` |
| Kick | `G` | `.` |
| Block | `H` | `/` |
| Special | `Q` | `M` |

Music is shared: `N` mutes and unmutes it, `[` and `]` move the volume, and the
strip under the game shows the track that is playing.

- **Special** — the bar along the bottom fills as you land hits: four kicks or eight
  punches. When it is full, one press spends the whole bar on a spinning sweep that
  reaches **both ways at once** and leaves whoever it touches **stunned for 0.7
  seconds** — long enough to land something serious. Its reach is the same as a normal
  kick, so what you are buying is the coverage and the stun, not the range. Chip damage
  on a guard pays no meter, and a blocked special stuns nobody.
- **ASH's special** is a charged beam instead: five landed hits fill his bar, and
  one press draws both hands back into a visible charge before both palms thrust
  forward and launch a bolt across the whole stage for 15 damage with a small
  shove. The wind-up is the counterplay — it can be blocked for chip, and it never
  burns; only his punches do that.
- **Crouch + kick** — sweep. Slower, knocks down, and travels under a standing guard.
- **Jump + punch/kick** — air attack. One per jump.
- Blocking cuts a hit to chip damage, but only while grounded and turned toward the
  attacker — jump over someone holding guard and it does not save them.
- Walking backwards is slower than walking forwards.
- First to 2 rounds wins. Rounds are 60 seconds; on time-out the healthier fighter
  takes it, and equal health is a draw.
- `Enter` restarts a match in progress; once someone has won, it returns you to the
  character select.
- **Music** — `N` mutes, `[` and `]` set volume, `T` steps to the next fight track and
  `shift+T` steps back. A track picked by hand sticks until you change it again,
  instead of being rotated away at the next round. All settings persist.

## Layout

```
index.html          canvas + control legend
style.css           page chrome
serve.sh            local server
src/
  config.js         world constants and tuning
  characters.js     the roster: builds and palettes
  mode.js           mode screen state: vs player, or vs computer at a level
  select.js         character select state
  ai.js             the computer opponent, one profile per difficulty level
  moves.js          frame data for every attack
  fighter.js        physics, stance, attack state machine
  combat.js         hit resolution, blocking, pushing apart
  match.js          round and match flow
  input.js          key state and control schemes
  audio.js          synthesized sound effects
  music.js          which track plays, and when
  music/            the music engine: voices, sequencer, one file per track
  pixel/            buffer, primitives, dithering, outline, bitmap font
  render/           poses, fighter sprites, HUD, select screen, frame composition
    frames/         hand-drawn sprite frames, one file per fighter
  stages/           one module per stage, plus shared props and the registry
tools/              sprite lab, for looking at frames while drawing them
tests/              browser test suite
```

`CONTRIBUTING.md` has the module ownership map and a git-worktree workflow for
working on several parts at once. `MODERN_REBUILD.md` is a briefing for rebuilding this
as a 3D game — what carries over, what does not, and what it would cost.

## Tests

Open <http://localhost:8123/tests/>. The suite runs on load and prints a pass/fail
list; there is no Node on the toolchain, so the tests run in the browser against the
real modules.

## How it works

**The pixel pipeline.** Everything is drawn into a 480x270 buffer and then blown up 2x
to the 960x540 canvas with smoothing off, so the pixel grid is real rather than a
filter over vector art. 480x270 is exactly half the canvas in each direction, which
keeps the upscale a clean integer and leaves room for fighters about 140px tall —
roughly half the frame, the proportion the late Neo Geo fighters gave their cast.

Sky gradients are flat colour bands with an ordered 4x4 Bayer dither only at the seams;
dithering a whole gradient just produces uniform noise. Glows add a hash-based jitter to
the threshold, because a smooth radial falloff run through the bare Bayer matrix steps
in visible squares.

**Fighters** are drawn from hand-authored frames (`render/frames/`) wherever one
exists, and from a posed skeleton (`render/poses.js`) wherever one does not. A frame is
a picture written as text — one string per pixel row, one character per pixel, each
character naming a *material* rather than a colour, so the same picture renders in
either player's palette and a mirror match still reads as blue against red. An anchor
in the frame says where the soles meet the floor, which is what keeps a drawing lined
up with a hurtbox it cannot see.

The procedural renderer is still there and still used: tapered limbs in three tones,
given a silhouette keyline. It covers knockdown, stunned and the spinning special,
and it is the reason a half-finished sprite set never blocks anything — an undrawn
pose falls back rather than failing. Both paths stand the same height on the same
floor, and a test asserts it, because a fighter that grew by four pixels on one pose
would be very hard to see and very easy to feel.

Frames are baked once per palette into a canvas with the keyline already applied and
blitted thereafter, so a fighter costs one `drawImage` a tick. The select screen draws
its portraits with the same function the match uses, so the art can never drift out of
sync with what you actually get. `tools/sprite-lab.html` shows every frame in both
palettes beside the procedural figure.

**Stages** are dense the way the arcade ones were — clutter at ground level, detail
filling everything above head height — but each is composed around its own shape rather
than a shared template: an enclosed street, an open plain, an elevated rooftop, a bridge
span, a ship's deck. The band the fighters actually occupy is kept darker and calmer
than the rest so the action still reads against it.

Scenery is drawn with the same construction as the fighters — three tones and a hard
silhouette keyline — and each depth layer is outlined as a whole before being
composited, so a row of shutters merges into one building mass while a lantern hanging
in front of it does not. Background crowds are built by `crowd()`, which takes a per-stage wardrobe — poses,
headgear, garments, carried loads — and rolls the rest deterministically, so a crowd
does not read as one figure repeated. Signage carries abstract marks rather than real writing in any
script: they give a painted sign its density and rhythm without pretending to spell
something.

Each stage is painted once into a cached canvas (about 13ms) and blitted thereafter;
only the animated overlay — petals, snow, birds, neon flicker — is redrawn per frame.

**Music** is synthesized the same way the effects are — no audio files, no
build step. `src/music/engine.js` runs a lookahead scheduler: a 25ms timer asks
the sequencer for every note starting inside the next 200ms and hands them to
WebAudio with absolute `AudioContext` timestamps, so the beat does not drift
when the main thread is busy drawing. The render loop pays nothing for it; the
only per-frame music work is `Music.sync()`, a handful of comparisons against
the match state.

A track is data, not code: sixteenth-step patterns written as text grids, a set
of lanes naming which synth voice plays which pattern, and an arrangement of
sections. Three fight tracks rotate one per round, and the arrangement follows
the match — filtered during the round intro, dropping on FIGHT!, lifting a
little in the last ten seconds, collapsing at a KO.

**Tuning** is split by intent. `config.js` holds the numbers you reach for when the
game feels wrong — damage per attack, chip damage, health, round length, gravity, walk
speed, jump height. `moves.js` holds frame data and hitbox geometry: what a move *does*,
not how hard it lands. Damage is wired from config into the move table by key, and a
test asserts every move is covered, since a missing entry would otherwise turn a
fighter's health into `NaN` on the first hit rather than failing anywhere useful.

**The simulation** runs at a fixed 60Hz on an accumulator, decoupled from render, so the
game plays identically regardless of display refresh rate. Moves are frame data
(`startup` / `active` / `recovery`), and a hitbox exists only during active frames, so
whiffing and trading behave the way they should. Landing a hit triggers hitstop, screen
shake and sparks.

The simulation modules never touch a canvas, which is what makes them testable.

## Ideas next

- Hand-drawn frames for the poses still on the fallback: knockdown, stunned, the
  spinning special
- A second character with different frame data
- Special moves on directional inputs (quarter-circle, charge)
- Combo counter and juggle rules
- Gamepad support via the Gamepad API
