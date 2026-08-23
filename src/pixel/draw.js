/* Integer-only drawing primitives. Nothing here anti-aliases, which is the
   whole point: a shape either covers a pixel or it doesn't. */

export function pxRect(c, x, y, w, h, col) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function pxDot(c, x, y, col) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Bresenham with a square brush, so diagonals stay chunky. */
export function pxLine(c, x0, y0, x1, y1, thick, col) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const t = Math.max(1, Math.round(thick));
  const off = Math.floor(t / 2);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (;;) {
    c.fillRect(x0 - off, y0 - off, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/* A limb segment whose width changes along its length. Uniform-width strokes
   are exactly what make a procedural figure read as a stick assembly, so
   every limb tapers instead. */
export function pxTaper(c, x0, y0, x1, y1, w0, w1, col) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.max(1, Math.hypot(dx, dy));
  const steps = Math.ceil(len);
  const nx = -dy / len, ny = dx / len;
  c.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + dx * t, cy = y0 + dy * t;
    const w = (w0 + (w1 - w0) * t) / 2;
    let ax = Math.round(cx - nx * w), ay = Math.round(cy - ny * w);
    const bx = Math.round(cx + nx * w), by = Math.round(cy + ny * w);
    const sdx = Math.abs(bx - ax), sdy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = sdx - sdy;
    for (;;) {
      c.fillRect(ax, ay, 1, 1);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 > -sdy) { err -= sdy; ax += sx; }
      if (e2 < sdx) { err += sdx; ay += sy; }
    }
  }
}

export function pxCircle(c, cx, cy, r, col) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
    c.fillRect(cx - span, cy + y, span * 2 + 1, 1);
  }
}

export function pxEllipse(c, cx, cy, rx, ry, col) {
  cx = Math.round(cx); cy = Math.round(cy);
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.5);
    if (span > 0) c.fillRect(cx - span, cy + y, span * 2 + 1, 1);
  }
}

export function pxTri(c, x0, y0, x1, y1, x2, y2, col) {
  const minY = Math.round(Math.min(y0, y1, y2));
  const maxY = Math.round(Math.max(y0, y1, y2));
  const edges = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
  c.fillStyle = col;
  for (let y = minY; y <= maxY; y++) {
    let lo = Infinity, hi = -Infinity;
    for (const [ax, ay, bx, by] of edges) {
      if ((y >= ay && y <= by) || (y >= by && y <= ay)) {
        const t = by === ay ? 0 : (y - ay) / (by - ay);
        const x = ax + (bx - ax) * t;
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    }
    if (lo <= hi) c.fillRect(Math.round(lo), y, Math.max(1, Math.round(hi - lo)), 1);
  }
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
