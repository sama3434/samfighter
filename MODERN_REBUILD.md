# Rebuilding Sam Fighter in 3D

A briefing for whoever takes this on next. It assumes you have not seen this repo
before, and it tries to be honest about what is easy, what is expensive, and what an
agent can and cannot realistically produce.

---

## 1. The single most important fact

This project is **15,800 lines**, and they split very unevenly:

| Part | Lines | Ports to 3D? |
|---|---|---|
| Simulation — `config`, `moves`, `fighter`, `combat`, `match`, `input` | ~640 | **Yes, nearly verbatim** |
| Computer opponent — `ai.js` | ~360 | **Yes**, it only reads sim state |
| Screens — `select`, `mode` | ~190 | Concepts only |
| Rendering + sprite art — `render/`, `pixel/` | ~7,360 | **No** |
| Stage art — `stages/` | ~2,960 | **No** |
| Music + audio | ~1,970 | Mostly yes (WebAudio) or replace |
| Tests | ~2,130 | Simulation tests port; art tests do not |

So: **about 1,000 lines are the actual game, and about 12,300 are the picture of it.**
The design — the frame data, the balance, the round flow, the AI, the feel — is done,
tested, and playable. A 3D rebuild is overwhelmingly a *presentation* project, not a
*game design* project. Do not throw away the simulation and start over; it is the part
that took the longest to get right and it is the part that already works.

### Why the simulation ports cleanly

It was written canvas-free on purpose:

- `Fighter` reads input from an injected `{ held: Set, pressed: Set }` and knows nothing
  about drawing. Its position is plain numbers.
- `Match` owns round flow and takes its fighters and stage list by construction.
- Nothing in `fighter.js`, `combat.js`, `match.js` or `ai.js` touches a canvas, an image,
  or the DOM. The entire test suite runs whole matches headlessly in milliseconds.
- It is a **fixed 60 Hz timestep on an accumulator**, decoupled from rendering. That is
  already the correct architecture for a fighting game and is a prerequisite for
  rollback netcode later.

That means you can port the simulation to C# or C++ almost mechanically, or keep it in
JavaScript and hang a 3D renderer off it.

---

## 2. What the game currently is

Two fighters, one plane, best of three 60-second rounds, five stages, a five-level
computer opponent, four synthesized music tracks.

### Frame data (60 Hz frames)

| Move | Startup | Active | Recovery | Damage | Chip | Reach | Notes |
|---|---|---|---|---|---|---|---|
| punch | 4 | 4 | 9 | 5 | 1 | 165 | |
| kick | 8 | 6 | 17 | 10 | 2 | 215 | |
| sweep | 7 | 5 | 21 | 10 | 2 | 205 | knocks down, goes under a standing guard |
| airPunch | 3 | 8 | 6 | 5 | 1 | 155 | air only, one per jump |
| airKick | 5 | 10 | 8 | 12 | 2 | 200 | air only, one per jump |
| spin | 6 | 9 | 20 | 9 | 2 | 215 | costs full meter, hits **both sides**, stuns 42f |

Meter fills 25 per kick-class hit, 12.5 per punch-class — exactly four kicks or eight
punches. Chip damage on a guard pays no meter.

### World constants

```
GROUND 500   WALL 50    BODY_W 140   STAND_H 280   CROUCH_H 190   PUSH_GAP 120
GRAVITY 2.25  JUMP_V -31  MOVE_SPEED 10.5  FRICTION 0.72  BACKWALK 0.72
MAX_HP 100   ROUND_TIME 60s   WINS_NEEDED 2   METER_MAX 100   STUN_FRAMES 42
```

All spatial values are in one consistent scale — a fighter is 280 units tall and reads
as roughly 1.75 m, so **1 m ≈ 160 units**. Multiplying every length, velocity and
acceleration by the same factor rescales the game without changing how it plays. That
has been done twice here.

### Rules worth carrying over

- Blocking works only while grounded and turned toward the attacker; jumping over
  someone holding guard beats it. Sweeps pass under a standing guard.
- Walking backwards is slower than advancing.
- Hitstop freezes the whole simulation for 3–8 frames on contact. This is a large part
  of why hits feel like they land, and it is nearly free to implement.
- On time-out the healthier fighter wins; equal health is a draw.

---

## 3. The design fork you must settle first

**Is this a 2.5D fighter or a true 3D fighter?** Everything downstream depends on it,
and it is a game design decision, not a technical one.

**2.5D — 3D art, movement locked to a plane.** The lineage is Street Fighter IV/V,
Guilty Gear, Mortal Kombat. The existing simulation is *already this game*: you would
keep the rules, the frame data and the AI essentially intact and replace only the
picture. Hitboxes stay as rectangles in a plane and remain trivially debuggable.

**True 3D — free movement, sidesteps, throws with orientation.** The lineage is Tekken,
Soul Calibur, Virtua Fighter. This is a different game. Facing becomes a continuous
angle rather than ±1, spacing becomes two-dimensional, the AI needs rewriting, the
camera becomes a hard problem, and every balance number here becomes a starting guess
rather than a tuned value.

**Recommendation: build 2.5D.** You get the "much more realistic and modern" look the
user asked for, you keep a working, tested, balanced game underneath, and you can ship
something playable in a fraction of the time. True 3D is a from-scratch project that
happens to share a name.

---

## 4. Three ways to do it

### A. Keep the JavaScript simulation, replace the renderer with Three.js/WebGPU

**How:** `src/render/**` and `src/stages/**` are deleted and replaced by a Three.js
scene. `fighter.js`, `combat.js`, `match.js`, `ai.js`, `config.js`, `moves.js` are
untouched. A thin adapter maps each fighter's `{x, y, facing, attack, hitstun, ...}`
onto a rigged model's transform and animation state each frame.

- **Cheapest path by a wide margin.** The game is playable in 3D the day the adapter
  works, because the game already runs.
- Stays a zero-install browser game, which is a real virtue of the current project.
- Modern rendering is genuinely available now: WebGPU, PBR materials, shadow maps,
  post-processing, skeletal animation with blending.
- **Ceiling:** you will not match a current console fighter's fidelity in a browser
  tab. You can comfortably reach "good indie 3D fighter".
- Biggest new work: animation state machine, model/rig pipeline, camera, lighting.

### B. Port the simulation to Unity

**How:** translate ~1,000 lines of simulation to C# (a genuinely mechanical job — it is
plain arithmetic and state machines), then use Unity's animation, physics and asset
tooling for everything else.

- Best **animation tooling** of the three for a small team: Animator state machines,
  blend trees, humanoid retargeting so you can buy or capture animation and apply it to
  your rig.
- Large asset ecosystem — you can buy competent characters, stages and VFX rather than
  authoring them.
- Ships to desktop, console and mobile.
- **Costs:** an install and a build step, and you must keep the simulation deterministic
  and *out* of Unity's physics engine — run your own fixed-step logic and let Unity draw
  it. Fighting games do not use rigid-body physics for gameplay.

### C. Unreal Engine 5

- Highest visual ceiling: Lumen, Nanite, MetaHuman characters out of the box.
- Genuinely the "realistic and modern" answer if that is the priority above all else.
- **Costs:** the steepest learning curve, the heaviest builds, and the most engine to
  fight. Same determinism caveat as Unity, more so.
- MetaHuman is a real shortcut for realistic human characters and worth evaluating
  before committing to a custom character pipeline.

### D. Godot 4 — worth a mention

Lighter than Unity, open source, good 3D now, C# or GDScript. Weaker animation
retargeting and a much smaller asset market. A reasonable middle if you want an engine
without Unity's licensing.

**If forced to pick one:** start with **A** to get a 3D version running against the
existing game in days, and treat it as the prototype that tells you whether you want to
commit to **B** or **C** for the real thing.

---

## 5. The parts that are actually hard

Ranked by how much they will hurt, not by how interesting they are.

### 1. Animation, and its marriage to frame data — this is the project

A 2D sprite fighter and a 3D fighter differ mainly here. Every move has exact startup,
active and recovery frames that the balance depends on. The animation must hit its
contact pose on the *first active frame*, every time, regardless of blending. Get this
wrong and the game feels floaty and unfair even though the numbers are unchanged.

Practically:
- Author or capture clips at 60 fps and mark the active window on the timeline.
- Drive animation from the simulation's frame counter — the sim is authoritative, the
  animation is a slave to it. Never the reverse.
- Blend-in times must be short (2–4 frames) or they eat startup.
- You need a cancel/interrupt policy: getting hit must snap to the hurt animation
  immediately.

Budget more time here than for rendering. **This is where 3D fighting games are won.**

### 2. Hitboxes and hurtboxes in 3D

Two viable approaches:
- **Authored volumes per active frame** (what 2D fighters do, and what this game does):
  most predictable, most work, best feel.
- **Capsules bound to bones**: cheap and automatic, but hit detection then follows
  whatever the animation does, which makes balance drift as animations change.

Start by porting the existing rectangles directly — they are tuned and they work. Move
to authored 3D volumes only where the flat version visibly lies.

Build a **hitbox visualiser on day one.** Every fighting game has one; you cannot debug
this by eye without it.

### 3. Characters and stages — the real budget

An agent can write every system described here. An agent **cannot** produce a
convincing realistic human character, a good rig, or quality mocap. Be honest about
this up front:

- **Buy or generate characters** (MetaHuman, purchased rigged models, Mixamo-style
  libraries) unless someone on the project is a character artist.
- **Retarget purchased animation** rather than hand-keying a fighting set from scratch.
  A complete fighter needs 60–150 clips per character.
- Stages are more forgiving — modular kits and purchased environment assets get you a
  long way, and the current five stage *concepts* (enclosed street, open dig site,
  rooftop, gorge bridge, ship's deck) are already composed and worth reusing as
  references.

### 4. Camera

2.5D fighters use a constrained camera that tracks the midpoint of the two fighters,
zooms with their separation, and clamps at stage edges. It is not free, but it is a
solved problem — copy the standard behaviour, do not invent one.

### 5. Netcode, if you ever want online

Decide **now**, even if you build it later, because it constrains everything:
- Fighting games need **rollback**, not delay-based netcode.
- Rollback requires the simulation to be deterministic, cheaply serialisable, and
  re-runnable several times per frame.
- The current simulation is *nearly* there: fixed timestep, plain numbers, no rendering
  coupling. Two things would need fixing — it uses `Math.random()` for spark particles
  and the AI seeds from a passed-in value; move all randomness to an explicit seeded
  generator that is part of saved state.
- If you port to an engine, keep the simulation in your own code, not in engine
  components, or rollback becomes impractical.

---

## 6. A phased plan

**Phase 0 — decide.** 2.5D or true 3D (see §3), and which stack (§4). Nothing else
starts until these are settled.

**Phase 1 — grey-box prototype.** One stage, two identical untextured characters, the
existing simulation driving them, a working camera, and a hitbox visualiser. No art.
The goal is a single question: *does it still feel like the 2D game?* If it does not,
the problem is animation timing, and it is cheaper to find that out now.

**Phase 2 — one character, properly.** Full move set, all animations, hit reactions,
VFX on contact, sound. One character done well teaches you the pipeline cost for all
the rest.

**Phase 3 — the second character and the AI.** Port `ai.js` — it reads only simulation
state, so it should come across with its five levels intact. Its spacing constants are
expressed in body widths, so they survive a change of scale.

**Phase 4 — stages, UI, music.** The four existing music tracks are WebAudio and port
directly to a browser build; for an engine build, re-render them or re-implement the
sequencer.

**Phase 5 — polish.** Hitstop, screen shake, impact VFX, camera punch-in on a KO. The
current game gets a great deal of its feel from hitstop and shake alone, and both are
a few lines.

---

## 7. Carry these over verbatim

- **The whole frame data table** (§2). It is balanced and playtested.
- **All of `config.js`.** Every tuning number, including the damage split by move.
- **`ai.js`**, including its five difficulty profiles and its measured win-rate ladder.
- **The testing approach.** The current suite runs whole matches headlessly, including
  ~100 full AI matches, in about two seconds. Recreating that in the new stack is worth
  doing early — it is what will tell you a change to animation broke the balance.
- **The rules in §2** — block direction, sweep vs standing guard, backwalk penalty,
  hitstop, time-over resolution.

---

## 8. Lessons this codebase learned painfully

Each of these cost real rework here. They apply just as much in 3D.

1. **Fix a scale and derive everything from it.** A fighter is 1.75 m; a storey is 3 m;
   a doorway is 2 m. When background objects were sized to *look right* instead, the
   fighters read as giants and it was not obvious why. In 3D, work in metres from the
   first day and model everything to real dimensions.

2. **Make wrong placement impossible, not merely discouraged.** Floating characters were
   fixed for good only when a helper was introduced that takes a ground position and
   *derives* the size, so a figure's scale could not disagree with where it stood.
   Prefer constructions that cannot express the bug.

3. **Verify by measuring, not by asserting.** The most valuable checks here were the
   ones that measured reality: rendering audio offline and inspecting the buffer,
   simulating a hundred matches to prove difficulty levels differ, timing a frame. Code
   that looks right and produces silence is the standard failure.

4. **Keep the simulation free of the renderer.** It is the reason this rebuild is
   feasible at all, and the reason the AI could be written as a synthetic input source
   without touching a single line of fighter or combat code.

5. **The presentation layer is where the time goes.** 12,300 of 15,800 lines here are
   picture. Expect that ratio to get worse in 3D, not better.

---

## 9. Open questions for the user

These are decisions an agent should not make alone:

1. **2.5D or true 3D?** (§3 — this changes everything.)
2. **Browser or engine build?** Keeping it a link someone can just open has been a real
   feature of this project.
3. **Realistic humans, or stylised?** "Realistic" carries a character-art cost that
   dominates the budget; a strong stylised look is cheaper and ages better.
4. **Is online play a goal?** If yes, rollback constrains the architecture from day one.
5. **Keep KAI and MIRA**, or design a new cast for 3D?
6. **Budget for bought assets?** This single answer moves the timeline more than any
   technical choice in this document.

---

## 10. Where things are

```
src/config.js      tuning: damage, speeds, geometry, round rules
src/moves.js       frame data and hitbox geometry
src/fighter.js     physics, stance, attack state machine
src/combat.js      hit resolution, blocking, pushing apart
src/match.js       round and match flow
src/ai.js          five-level computer opponent
src/input.js       key state and control schemes
src/select.js      character select state
src/mode.js        vs-player / vs-computer mode select
src/render/**      2D renderer and sprite frames  (does not port)
src/stages/**      five stages                    (does not port; reuse as reference)
src/music/**       four synthesized tracks        (ports to a browser build)
tests/             179 tests, browser-run, ~2s
```

`CONTRIBUTING.md` documents the module ownership map and the git-worktree workflow used
to run several agents in parallel on this project. That workflow worked well and is
worth repeating: separate worktrees, non-overlapping file scopes, each agent verifying
its own work visually before merge.
