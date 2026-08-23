# SAM FIGHTER

A local 1v1 pixel-art fighting game for the browser. Two players, one keyboard, no
build step and no dependencies — plain HTML, CSS and canvas.

Four stages rotate as the match goes on: **temple**, **pyramids**, **city**, **mountain**.

## Play

Double-click `index.html`, or serve the folder:

```
python3 -m http.server 8123
```

then open <http://localhost:8123>.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch | `S` | `↓` |
| Punch | `F` | `,` |
| Kick | `G` | `.` |
| Block | `H` | `/` |

- **Crouch + kick** — sweep. Slower, knocks down, and goes under a standing guard.
- **Jump + punch/kick** — air attack. One per jump.
- Blocking cuts a hit to chip damage, but you can't block while airborne.
- Walking backwards is slower than walking forwards.
- First to 2 rounds wins. Rounds are 60 seconds; on time-out the healthier fighter takes it.
- `Enter` restarts the match at any time.

## Layout

| File | What's in it |
|---|---|
| `index.html` | Canvas and the on-page control legend |
| `style.css` | Page chrome around the canvas |
| `pixel.js` | Pixel buffer, drawing primitives, dithering, 5x7 bitmap font |
| `backgrounds.js` | The four stages and their animated overlays |
| `game.js` | Move data, simulation, fighter sprites, HUD, sound |

## How it works

**The pixel pipeline.** Everything is drawn into a 320x180 buffer and then blown up 3x
to the 960x540 canvas with smoothing off, so the pixel grid is real rather than a filter
over vector art. Sky gradients are banded with an ordered 4x4 Bayer dither, and each
fighter is composed in a scratch buffer and given a silhouette keyline before being
blitted, which is what gives sprites their hard arcade outline.

Stages are painted once into their own cached canvas; only the small animated overlay
(petals, snow, birds, neon flicker) is redrawn per frame.

**The simulation** runs at a fixed 60Hz on an accumulator, decoupled from render, so the
game plays identically regardless of display refresh rate.

Moves are frame data (`MOVES` in `game.js`): `startup`, `active`, `recovery`, damage,
reach and knockback. A hitbox only exists during a move's active frames, so whiffing
and trading work the way they should. Landing a hit triggers hitstop, screen shake and
particles.

Tuning the feel means editing the `MOVES` table and the physics constants at the top of
`game.js` — nothing else needs to change.

## Ideas next

- Hand-authored sprite sheets at a higher resolution (see below)
- A second character with different frame data
- Special moves on directional inputs (quarter-circle, charge)
- Combo counter and juggle rules
- Simple AI so one player can practise alone
- Gamepad support via the Gamepad API

## On sprite quality

The fighters are drawn procedurally — a posed skeleton rendered as chunky pixel limbs —
rather than from hand-authored sprite sheets. That keeps every pose consistent and makes
animation cheap to change, but it caps how much character detail is possible. A figure
56 pixels tall has no room for facial expression or cloth folds. Getting closer to
arcade-era sprite work means both a larger buffer and drawn-per-frame art; see the notes
in the project history for the resolution maths.
