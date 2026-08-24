/* The alphabet hand-drawn frames are written in.

   A frame is an array of equal-length strings, one string per pixel row, one
   character per pixel. Characters name a *material*, never a colour, so the
   same frame data renders in whichever palette the player slot was handed --
   which is what makes a mirror match read as blue versus red.

   The ramps are deep on purpose: each major material runs five or six steps
   from a near-black core shadow to a bright specular, plus a shared cool rim
   tone for the bounce light on the shadow side. That ramp depth -- not the
   pixel count -- is most of what separates a late Neo Geo sprite from a
   16-bit one, so it is a first-class part of the alphabet.

   Most glyphs resolve through the character's palette. A couple (the eye) are
   fixed, because an eye that palette-swapped would stop reading as an eye. */

export const GLYPHS = {
  '.': null,                  // transparent

  // gi -- the uniform, six steps deep
  A: { key: 'giHi2' },        // specular, where the light actually hits
  O: { key: 'giHi' },
  o: { key: 'gi' },
  q: { key: 'giLo' },
  Q: { key: 'giLo2' },        // core shadow, one step off the keyline

  // skin, five steps
  Z: { key: 'skinHi2' },
  S: { key: 'skinHi' },
  s: { key: 'skin' },
  x: { key: 'skinLo' },
  z: { key: 'skinLo2' },

  // hair, four steps
  D: { key: 'hairHi2' },      // the anime sheen band
  H: { key: 'hairHi' },
  h: { key: 'hair' },
  d: { key: 'hairLo' },

  // headband, belt, wraps
  n: { key: 'bandHi' },
  b: { key: 'band' },
  B: { key: 'bandLo' },

  // gloves, five steps
  v: { key: 'gloveHi2' },
  G: { key: 'gloveHi' },
  g: { key: 'glove' },
  c: { key: 'gloveLo' },
  C: { key: 'gloveLo2' },

  // rim -- the cool bounce light along the shadow-side silhouette
  r: { key: 'rim' },

  // fixed: the eye, and the hard shadow line used inside the silhouette
  w: { col: '#ffffff' },
  e: { col: '#241d33' },
};

/** Every glyph that resolves through a palette, for the frame-data tests. */
export const PALETTE_KEYS = [...new Set(
  Object.values(GLYPHS).filter((g) => g && g.key).map((g) => g.key),
)];

export const isGlyph = (ch) => Object.prototype.hasOwnProperty.call(GLYPHS, ch);
