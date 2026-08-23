/* The low-resolution buffer everything is drawn into.

   480x270 is exactly half the 960x540 display canvas, so the upscale is a
   clean integer 2x with no resampling, and it leaves room for fighters about
   112px tall -- roughly the proportion of the frame SF2 gave its cast. */

export const PW = 480, PH = 270, PSCALE = 2;
export const PGROUND = 235;          // GROUND / PSCALE

export const buffer = document.createElement('canvas');
buffer.width = PW;
buffer.height = PH;

export const pctx = buffer.getContext('2d');
pctx.imageSmoothingEnabled = false;

/** world units -> buffer units */
export const wp = (v) => Math.round(v / PSCALE);

/** Blit the buffer onto the visible canvas at 2x, nearest-neighbour. */
export function present(ctx, w, h) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, PW, PH, 0, 0, w, h);
}
