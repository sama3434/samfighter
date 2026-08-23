/* Three tones per material: a shadow the whole limb is cut from, a base, and
   a highlight. Light is treated as coming from the fighter's front-top, which
   flips with the sprite -- the same convention arcade sprite sheets used. */
export const PALETTES = {
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
};

export const OUTLINE = '#140b16';
