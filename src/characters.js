/* The roster.

   Both fighters share the frame data in moves.js -- no special abilities yet.
   A character is a look: a build the sprite is drawn to, and one palette per
   player slot so a mirror match still reads as blue versus red. */

export const CHARACTERS = [
  {
    id: 'kai',
    name: 'KAI',
    blurb: 'STRAIGHT ANSWERS',
    build: {
      shoulder: 30, chest: 30, waist: 24,
      arm: 13, leg: 17,
      hair: 'spiky',
      headband: true,
    },
    palettes: {
      p1: {
        gi: '#3f7fd8', giHi: '#8fc0f8', giLo: '#22508f',
        skin: '#f0c090', skinHi: '#ffdcb4', skinLo: '#c08a5c',
        hair: '#241d33', hairHi: '#443a5c',
        band: '#eae6f2', bandLo: '#a9a4bd',
        glove: '#d9403c', gloveHi: '#ff7a6a', gloveLo: '#8f2320',
      },
      p2: {
        gi: '#e2504a', giHi: '#ff9b8c', giLo: '#93262a',
        skin: '#f5cf9e', skinHi: '#ffe8c4', skinLo: '#c4926a',
        hair: '#f0c95e', hairHi: '#fff0b0',
        band: '#2c2436', bandLo: '#171223',
        glove: '#2f2a44', gloveHi: '#5a5478', gloveLo: '#191426',
      },
    },
  },
  {
    id: 'mira',
    name: 'MIRA',
    blurb: 'FAST HANDS',
    build: {
      shoulder: 26, chest: 26, waist: 19,
      arm: 11, leg: 15,
      hair: 'ponytail',
      headband: false,
    },
    palettes: {
      p1: {
        gi: '#2fb0a8', giHi: '#7fe8dc', giLo: '#166b66',
        skin: '#e8b487', skinHi: '#ffd6ab', skinLo: '#b8794f',
        hair: '#2b1f38', hairHi: '#4d3c60',
        band: '#f4e28a', bandLo: '#b8a04a',
        glove: '#3a4a8f', gloveHi: '#7a8ad4', gloveLo: '#1e2a5c',
      },
      p2: {
        gi: '#d9457a', giHi: '#ff8fb4', giLo: '#8c2148',
        skin: '#f2c79a', skinHi: '#ffe2bc', skinLo: '#c08a5e',
        hair: '#b8532a', hairHi: '#e88a4c',
        band: '#2f2a3f', bandLo: '#1a1626',
        glove: '#f0d060', gloveHi: '#fff0a8', gloveLo: '#a88a20',
      },
    },
  },
];

export const byId = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
