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
| `src/config.js` | World constants and tuning | No — affects everything |
| `src/moves.js` | Frame data for every attack | Yes, but rerun combat tests |
| `src/fighter.js` | Physics, stance, attack state machine | Yes |
| `src/combat.js` | Hit resolution, blocking, pushing apart | Yes |
| `src/match.js` | Round and match flow, effects state | Yes |
| `src/input.js` | Key state and control schemes | Yes |
| `src/audio.js` | Synthesized sound | Yes |
| `src/pixel/*` | Buffer, primitives, dithering, outline, font | Yes |
| `src/render/poses.js` | The fighter skeleton per state | Yes |
| `src/render/sprite.js` | How a fighter is drawn | Yes |
| `src/render/hud.js` | Bars, timer, banner | Yes |
| `src/render/scene.js` | Frame composition | Rarely |
| `src/stages/<name>.js` | One stage's art | Yes — fully independent |
| `src/stages/index.js` | Stage registry and caching | Only when adding a stage |
| `src/main.js` | Wiring and the game loop | Rarely |

**Low-conflict work**, ideal to run in parallel: a new stage, a new move, sprite detail,
HUD layout, sound.

**Coordinate first**: `config.js`, `scene.js`, `main.js`, and anything that changes a
module's exported shape.

## Adding a stage

1. Copy `src/stages/temple.js` to `src/stages/yours.js`.
2. Export `paint(c)`, `overlay(c, frame, drifters)`, and a `stage` object with
   `{ key, name, drift, paint, overlay }`.
3. Add it to the `STAGES` array in `src/stages/index.js`.

Nothing else needs to know it exists. `drift` picks the overlay particles
(`snow`, `petals`, `birds`, `none`).

## Adding a move

1. Add an entry to `src/moves.js` with its frame data.
2. Trigger it in `Fighter.update()` in `src/fighter.js`.
3. Give it a pose branch in `src/render/poses.js`.
4. Add a combat test asserting its damage, reach, and how blocking answers it.

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
