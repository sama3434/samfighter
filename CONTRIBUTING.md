# Working on Sam Fighter

No build step, no dependencies, no package manager. Edit a file, reload the page.

```sh
./serve.sh              # http://localhost:8123
./serve.sh 8124         # a second port, for a second worktree
```

ES modules will not load over `file://`, so the server is required even though
nothing is compiled.

## Tests

Open <http://localhost:8123/tests/> — the suite runs on load and prints a pass/fail
list. It exercises the simulation against the real modules; nothing is mocked except
the stage list and the input pair.

`window.TEST_RESULT` holds `{passed, failed}` once the run finishes, which is how an
agent or a script can check the result without reading the page.

Add tests next to the module they cover, register the file in `tests/index.html`, and
keep them free of canvas work where you can — `tests/factories.js` builds fighters and
matches that never touch a drawing context.

## Module map

Each module owns one concern. The point of the split is that two people (or two agents)
can work at once without editing the same file.

| Module | Owns | Safe to change alone? |
|---|---|---|
| `src/config.js` | World constants, damage, tuning | No — affects everything |
| `src/characters.js` | The roster: builds and palettes | Yes — pure data |
| `src/select.js` | Character select state | Yes |
| `src/moves.js` | Frame data and hitboxes (not damage) | Yes, but rerun combat tests |
| `src/fighter.js` | Physics, stance, attack state machine | Yes |
| `src/combat.js` | Hit resolution, blocking, pushing apart | Yes |
| `src/match.js` | Round and match flow, effects state | Yes |
| `src/input.js` | Key state and control schemes | Yes |
| `src/audio.js` | Synthesized sound | Yes |
| `src/pixel/*` | Buffer, primitives, dithering, outline, font | Yes |
| `src/render/poses.js` | The fighter skeleton per state | Yes |
| `src/render/sprite.js` | How a fighter is drawn | Yes |
| `src/render/frames/*` | Hand-drawn sprite frames, one file per fighter | Yes — pure data |
| `src/render/hud.js` | Bars, timer, banner | Yes |
| `src/render/select.js` | Character select screen art | Yes |
| `src/render/scene.js` | Frame composition | Rarely |
| `src/stages/props.js` | Shared scenery: buildings, awnings, signs, crowds | Yes |
| `src/stages/<name>.js` | One stage's art | Yes — fully independent |
| `src/stages/index.js` | Stage registry and caching | Only when adding a stage |
| `src/main.js` | Wiring and the game loop | Rarely |

**Low-conflict work**, ideal to run in parallel: a new stage, a new character, a new
move, sprite detail, HUD layout, sound.

**Coordinate first**: `config.js`, `scene.js`, `main.js`, and anything that changes a
module's exported shape.

## Adding a stage

1. Copy `src/stages/temple.js` to `src/stages/yours.js`.
2. Export `paint(c)`, `overlay(c, frame, drifters)`, and a `stage` object with
   `{ key, name, drift, paint, overlay }`.
3. Add it to the `STAGES` array in `src/stages/index.js`.

Nothing else needs to know it exists. `drift` picks the overlay particles
(`snow`, `petals`, `birds`, `none`).

Stages are built in depth layers, each wrapped in `layer()` from `props.js` so its
silhouette gets a keyline before it is composited:

1. sky gradient (no keyline — it is the backdrop)
2. **far** — whatever the street recedes toward
3. ground, via `paving()`
4. **vendors** — anyone who should be occluded by a counter goes down *before* the
   counters exist
5. **mid** — the two side buildings and their shopfronts
6. **crowd** — bystanders at street level
7. **near** — awnings, signage, lanterns, hanging goods, ground clutter

Three things to keep in mind:

- Leave the band the fighters occupy (roughly y 120–235) darker and less busy than the
  rest, or the action stops reading.
- Use `glow()` rather than `ditherDisc()` for lamp and interior light — a jittered
  dither reads as scattered glitter over a dark interior.
- **Give the stage its own shape.** The layer list above is a construction order, not a
  composition. The four existing stages deliberately differ in silhouette: enclosed
  street, open plain, elevated rooftop, asymmetric span. Reusing the same
  building-left / gap / building-right arrangement is what makes stages blur together
  even when the palettes differ.

## Adding a character

1. Add an entry to `src/characters.js`: an `id`, `name`, `blurb`, a `build` (limb
   widths and hair style), and a palette for each player slot.
2. If the look needs something the sprite cannot draw yet — a new hair style, a cape —
   add a branch in `src/render/sprite.js` keyed off `build`.

The select screen sizes itself from the roster length, so nothing else changes. The
roster test checks every palette tone and build field is present, which catches a
half-finished entry before it reaches the canvas.

## Adding a sprite frame

Fighters are drawn from hand-authored frames where one exists and fall back to
the procedural skeleton where one does not, so frames can land one at a time
and the game never stops being playable.

A frame lives in `src/render/frames/<fighter>.js` and is three fields:

```js
const BLOCK = {
  ax: 28, ay: 118,          // where the soles meet the floor, inside the picture
  rows: [
    '..........hhhhh.........',   // one string per pixel row
    '.........hhsssshh.......',   // one character per pixel
    ...
  ],
};
```

Characters name a **material**, never a colour — see `frames/glyphs.js` for the
alphabet (`o O q` gi, `s S x` skin, `h H` hair, `b B` belt and headband,
`g G c` glove, `.` transparent). That is what lets one picture render in both
players' palettes, which is what makes a mirror match legible.

1. Draw the frame and add it to the sheet's export at the bottom of the file.
   Single-frame poses take the frame directly (`block: BLOCK`); cycles take an
   array (`idle: [IDLE0, IDLE1]`); attacks take phases
   (`kick: { startup: KICK_S, active: KICK_A }`).
2. If the pose is not already wired, add a `case` to `frameFor()` in
   `frames/index.js` keyed off `pose.kind`.
3. Open <http://localhost:8123/tools/sprite-lab.html> and look at it. The lab
   renders every frame in both palettes, next to the procedural figure, at any
   zoom — the procedural figure is there so you can check the new frame stands
   the same height.

Three rules the tests enforce, because none of them fail loudly on their own:

- **Every row is the same length.** A row one character short shears the
  picture.
- **Feet on the anchor.** `ay` is the floor line: the lowest drawn row must be
  `ay - 1`. A frame that floats or sinks desynchronises from the hurtbox, which
  is fixed at `STAND_H` and cannot move to meet it.
- **No pinholes.** A transparent pixel walled in on all four sides gets filled
  by the keyline pass and comes out as a black speck inside the figure.

An attack's reach has to match `moves.js`: `reach` is in world units, and the
buffer is half that, so a punch at `reach: 132` wants its fist about 66 pixels
in front of `ax`.

## Adding a move

1. Add its damage to `DAMAGE` and `CHIP_DAMAGE` in `src/config.js`, keyed by the move
   name.
2. Add an entry to `src/moves.js` with its frame data and geometry, taking `dmg` and
   `chip` from those config maps.
3. Trigger it in `Fighter.update()` in `src/fighter.js`.
4. Give it a pose branch in `src/render/poses.js`.
5. Add a combat test asserting its damage, reach, and how blocking answers it.

Steps 1 and 2 are separate on purpose: `config.js` is where you tune how hard things
hit, `moves.js` is where you change how a move behaves. `tests/tuning.test.js` fails if
a move has no damage entry, or an entry has no move.

## Tuning the game's feel

| Want to change | Edit |
|---|---|
| How hard attacks hit | `DAMAGE` / `CHIP_DAMAGE` in `config.js` |
| How long a round lasts | `ROUND_TIME`, `MAX_HP` in `config.js` |
| How fast fighters move | `MOVE_SPEED`, `FRICTION`, `BACKWALK` in `config.js` |
| Jump height and weight | `JUMP_V`, `GRAVITY`, `AIR_DRIFT` in `config.js` |
| How fast a move comes out | `startup` / `active` / `recovery` in `moves.js` |
| How far a move reaches | `reach` / `top` / `h` in `moves.js` |
| How much a hit staggers | `hitstun` / `blockstun` / `kb` in `moves.js` |
| How fast the special charges | `meterGain` in `moves.js`, `METER_MAX` in `config.js` |

## Working concurrently with git worktrees

A worktree is a second checkout of the same repository on its own branch, in its own
directory — so two sessions can build at once without touching each other's files.

```sh
# from the main checkout
git worktree add ../samfighter-city   -b stage/city
git worktree add ../samfighter-sprite -b art/sprite-detail
```

Then run a session in each directory, each on its own port:

```sh
cd ../samfighter-city   && ./serve.sh 8124 &   # session A
cd ../samfighter-sprite && ./serve.sh 8125 &   # session B
```

Give each session a task that stays inside its own modules — one on `src/stages/`,
another on `src/render/sprite.js`, a third on `src/moves.js` plus its tests. Conflicts
then only happen in `src/stages/index.js` (one line per stage) or `config.js`.

When a branch is done:

```sh
git -C ../samfighter-city  add -A && git -C ../samfighter-city commit -m "..."
git checkout main && git merge stage/city
git worktree remove ../samfighter-city
git branch -d stage/city
```

Run the test page once after each merge — it is fast, and it is the only thing that
checks the modules still agree with each other.

## Conventions

- **Integer pixels only.** Everything draws through `src/pixel/draw.js` into the
  480x270 buffer. No fractional coordinates, no anti-aliasing, no canvas `text`.
- **Stages are pure paint functions.** They draw into a context handed to them and hold
  no state; the registry caches the result.
- **The simulation never touches a canvas.** `fighter.js`, `combat.js`, and `match.js`
  are plain logic, which is what keeps them testable.
- **Tune through `config.js` and `moves.js`.** Every spatial constant scales together,
  so multiplying the lengths, velocities and accelerations in `config.js` by the same
  factor resizes the fighters without changing how the game plays.
