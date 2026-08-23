# SAM FIGHTER

A local 1v1 browser fighting game. Two players, one keyboard, no build step and no
dependencies — plain HTML, CSS and canvas.

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
| `game.js` | Everything else: move data, simulation, rendering, sound |

## How it works

The simulation runs at a fixed 60Hz on an accumulator, decoupled from render, so the
game plays identically regardless of display refresh rate.

Moves are frame data (`MOVES` in `game.js`): `startup`, `active`, `recovery`, damage,
reach and knockback. A hitbox only exists during a move's active frames, so whiffing
and trading work the way they should. Landing a hit triggers hitstop, screen shake and
particles.

Tuning the feel means editing the `MOVES` table and the physics constants at the top of
`game.js` — nothing else needs to change.

## Ideas next

- A second character with different frame data
- Special moves on directional inputs (quarter-circle, charge)
- Combo counter and juggle rules
- Simple AI so one player can practise alone
- Gamepad support via the Gamepad API
