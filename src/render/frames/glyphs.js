/* The alphabet hand-drawn frames are written in.

   A frame is an array of equal-length strings, one string per pixel row, one
   character per pixel. Characters name a *material*, never a colour, so the
   same frame data renders in whichever palette the player slot was handed --
   which is what makes a mirror match read as blue versus red.

   Most glyphs resolve through the character's palette. A couple (the eye) are
   fixed, because an eye that palette-swapped would stop reading as an eye. */

export const GLYPHS = {
  '.': null,                  // transparent

  // gi -- the uniform
  o: { key: 'gi' },
  O: { key: 'giHi' },
  q: { key: 'giLo' },

  // skin
  s: { key: 'skin' },
  S: { key: 'skinHi' },
  x: { key: 'skinLo' },

  // hair
  h: { key: 'hair' },
  H: { key: 'hairHi' },

  // headband, belt, wraps
  b: { key: 'band' },
  B: { key: 'bandLo' },

  // gloves
  g: { key: 'glove' },
  G: { key: 'gloveHi' },
  c: { key: 'gloveLo' },

  // fixed: the eye, and the hard shadow line used inside the silhouette
  w: { col: '#ffffff' },
  e: { col: '#241d33' },
};

/** Every glyph that resolves through a palette, for the frame-data tests. */
export const PALETTE_KEYS = [...new Set(
  Object.values(GLYPHS).filter((g) => g && g.key).map((g) => g.key),
)];

export const isGlyph = (ch) => Object.prototype.hasOwnProperty.call(GLYPHS, ch);
