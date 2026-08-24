/* The track registry.

   Adding a fourth fight track: copy one of these files, edit the data, import
   it here and push its key into FIGHT_TRACKS. Nothing else needs to know. */

import { track as ironmarket } from './ironmarket.js';
import { track as ghostwire } from './ghostwire.js';
import { track as halflight } from './halflight.js';
import { track as standby } from './standby.js';

export const TRACKS = { ironmarket, ghostwire, halflight, standby };

/** Rotated through, one per round, so a long match is never one loop. */
export const FIGHT_TRACKS = ['ironmarket', 'ghostwire', 'halflight'];

/** Plays on the character select screen. */
export const MENU_TRACK = 'standby';

export const ALL_TRACKS = Object.values(TRACKS);
