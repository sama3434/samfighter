/* The roster.

   Both fighters share the frame data in moves.js -- no special abilities yet.
   A character is a look: a build the sprite is drawn to, and one palette per
   player slot so a mirror match still reads as blue versus red.

   Palettes are deep ramps in the late Neo Geo manner: each material runs from
   a near-black core shadow (`*Lo2`) up to a bright specular (`*Hi2`), with
   the darks hue-shifted cool rather than merely darker, and a shared `rim`
   tone -- the cool bounce light painted along the shadow-side silhouette.
   Builds are in buffer pixels and were scaled x1.25 with the world. */

export const CHARACTERS = [
  {
    id: 'kai',
    name: 'KAI',
    blurb: 'STRAIGHT ANSWERS',
    build: {
      shoulder: 38, chest: 38, waist: 30,
      arm: 16, leg: 21,
      hair: 'spiky',
      headband: true,
    },
    palettes: {
      p1: {
        gi: '#3f7fd8', giHi: '#8fc0f8', giHi2: '#cfe8ff',
        giLo: '#22508f', giLo2: '#132f5c',
        skin: '#f0c090', skinHi: '#ffdcb4', skinHi2: '#fff2da',
        skinLo: '#c08a5c', skinLo2: '#8a5a38',
        face: '#f0c090', faceHi: '#ffdcb4', faceHi2: '#fff2da',
        faceLo: '#c08a5c', faceLo2: '#8a5a38',
        hair: '#241d33', hairHi: '#443a5c', hairHi2: '#7a6aa0', hairLo: '#120e1e',
        band: '#eae6f2', bandHi: '#ffffff', bandLo: '#a9a4bd',
        glove: '#d9403c', gloveHi: '#ff7a6a', gloveHi2: '#ffb49e',
        gloveLo: '#8f2320', gloveLo2: '#571114',
        rim: '#8cc4e4',
      },
      p2: {
        gi: '#e2504a', giHi: '#ff9b8c', giHi2: '#ffc9b8',
        giLo: '#93262a', giLo2: '#571318',
        skin: '#f5cf9e', skinHi: '#ffe8c4', skinHi2: '#fff4d8',
        skinLo: '#c4926a', skinLo2: '#8e6242',
        face: '#f5cf9e', faceHi: '#ffe8c4', faceHi2: '#fff4d8',
        faceLo: '#c4926a', faceLo2: '#8e6242',
        hair: '#f0c95e', hairHi: '#fff0b0', hairHi2: '#fffbe2', hairLo: '#b98a34',
        band: '#2c2436', bandHi: '#4a3f5c', bandLo: '#171223',
        glove: '#2f2a44', gloveHi: '#5a5478', gloveHi2: '#8a84b0',
        gloveLo: '#191426', gloveLo2: '#0d0a18',
        rim: '#8fa8d4',
      },
    },
  },
  {
    id: 'mira',
    name: 'MIRA',
    blurb: 'FAST HANDS',
    build: {
      // close enough to KAI that neither reads as the smaller fighter;
      // the difference is silhouette, not scale
      shoulder: 35, chest: 35, waist: 28,
      arm: 15, leg: 20,
      hair: 'ponytail',
      headband: false,
    },
    palettes: {
      p1: {
        gi: '#2fb0a8', giHi: '#7fe8dc', giHi2: '#c8fff0',
        giLo: '#166b66', giLo2: '#0b403e',
        skin: '#e8b487', skinHi: '#ffd6ab', skinHi2: '#fff0d6',
        skinLo: '#b8794f', skinLo2: '#845433',
        face: '#e8b487', faceHi: '#ffd6ab', faceHi2: '#fff0d6',
        faceLo: '#b8794f', faceLo2: '#845433',
        hair: '#2b1f38', hairHi: '#4d3c60', hairHi2: '#7c66a0', hairLo: '#150e20',
        band: '#f4e28a', bandHi: '#fff8c8', bandLo: '#b8a04a',
        glove: '#3a4a8f', gloveHi: '#7a8ad4', gloveHi2: '#b0bcf0',
        gloveLo: '#1e2a5c', gloveLo2: '#101838',
        rim: '#92ccdc',
      },
      p2: {
        gi: '#d9457a', giHi: '#ff8fb4', giHi2: '#ffd0e0',
        giLo: '#8c2148', giLo2: '#521028',
        skin: '#f2c79a', skinHi: '#ffe2bc', skinHi2: '#fff2d8',
        skinLo: '#c08a5e', skinLo2: '#8a5c3a',
        face: '#f2c79a', faceHi: '#ffe2bc', faceHi2: '#fff2d8',
        faceLo: '#c08a5e', faceLo2: '#8a5c3a',
        hair: '#b8532a', hairHi: '#e88a4c', hairHi2: '#ffc890', hairLo: '#752f18',
        band: '#2f2a3f', bandHi: '#4c4560', bandLo: '#1a1626',
        glove: '#f0d060', gloveHi: '#fff0a8', gloveHi2: '#fff8d0',
        gloveLo: '#a88a20', gloveLo2: '#6a5410',
        rim: '#96afd8',
      },
    },
  },
  {
    id: 'ash',
    name: 'ASH',
    blurb: 'BURNS ON CONTACT',
    /* ASH's moves are his own: a lighter punch that sets the opponent
       alight and pays 20 meter (five hits fill the bar), an 8-damage kick,
       and a projectile super instead of the spin. Slots not named here fall
       through to the shared table -- but every slot IS named, so his frame
       data never silently borrows KAI's numbers. */
    moves: {
      punch: 'firePunch',
      kick: 'fireKick',
      sweep: 'fireSweep',
      airPunch: 'fireAirPunch',
      airKick: 'fireAirKick',
      special: 'fireball',
    },
    meterTicks: 5,        // the HUD meter is countable: five hits, five cells
    build: {
      shoulder: 37, chest: 37, waist: 29,
      arm: 16, leg: 20,
      hair: 'crop',
      headband: false,
    },
    /* The fire-hands trick: the *skin* and *glove* ramps are flame ramps, so
       every pixel of hand and forearm burns and no bare skin can show
       through. His face stays human because his frames draw the head, neck,
       chest and feet in the separate face ramp. Player one burns orange,
       player two burns blue, so a mirror match still reads at a glance. */
    palettes: {
      p1: {
        gi: '#6b1f1a', giHi: '#9c3a24', giHi2: '#d06038',
        giLo: '#3a1010', giLo2: '#20080a',
        skin: '#ff7a14', skinHi: '#ffc44c', skinHi2: '#fff0b0',
        skinLo: '#c23a08', skinLo2: '#7a1c04',
        face: '#c08050', faceHi: '#e8a870', faceHi2: '#ffd0a0',
        faceLo: '#8a5638', faceLo2: '#5c3520',
        hair: '#241418', hairHi: '#3c2420', hairHi2: '#5c3830', hairLo: '#120a0c',
        band: '#4a241c', bandHi: '#6b3828', bandLo: '#2a1410',
        glove: '#ff9c1e', gloveHi: '#ffe07c', gloveHi2: '#fff6d0',
        gloveLo: '#e04a10', gloveLo2: '#8c1c06',
        rim: '#ff5a2a',
      },
      p2: {
        gi: '#243050', giHi: '#3a4c70', giHi2: '#5c7494',
        giLo: '#141c38', giLo2: '#0a0e20',
        skin: '#3f7ae8', skinHi: '#7ac8ff', skinHi2: '#d8f4ff',
        skinLo: '#2a3ab0', skinLo2: '#1a1660',
        face: '#c48354', faceHi: '#eab078', faceHi2: '#ffd8a8',
        faceLo: '#8a583a', faceLo2: '#5a3826',
        hair: '#1c1c28', hairHi: '#30303f', hairHi2: '#4a4a5c', hairLo: '#0c0c14',
        band: '#20283f', bandHi: '#38445c', bandLo: '#12182a',
        glove: '#54a0f0', gloveHi: '#a0e0ff', gloveHi2: '#e8fbff',
        gloveLo: '#3a50cc', gloveLo2: '#20206b',
        rim: '#6ab8ff',
      },
    },
  },
];

export const byId = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
