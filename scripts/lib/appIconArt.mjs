/**
 * Shared drawing code for the Studio Markdown icon.
 *
 * The artwork is generated procedurally (no image library, no binary assets in
 * the repo) so the desktop icon and the whole Microsoft Store tile set always
 * come from one source of truth.
 */
import { deflateSync } from "zlib";

const CRC_T = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_T[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_T[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Brand blue used for the rounded-square plate. */
export const BRAND = [0x4d, 0xa3, 0xff];
const GLYPH = [255, 255, 255];

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.px = new Uint8Array(width * height * 4);
  }

  set(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.px[i] = r;
    this.px[i + 1] = g;
    this.px[i + 2] = b;
    this.px[i + 3] = a;
  }

  alphaAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.px[(y * this.width + x) * 4 + 3];
  }

  toPng() {
    const { width: w, height: h } = this;
    const raw = Buffer.alloc(h * (1 + w * 4));
    for (let y = 0; y < h; y++) {
      raw[y * (1 + w * 4)] = 0;
      Buffer.from(this.px.buffer, y * w * 4, w * 4).copy(raw, y * (1 + w * 4) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
      PNG_SIG,
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", deflateSync(raw, { level: 9 })),
      pngChunk("IEND", Buffer.alloc(0))
    ]);
  }
}

/** Anti-aliasing-free rounded rectangle, matching the original icon shape. */
function roundedPlate(canvas, ox, oy, side, color) {
  const radius = side * (14 / 64);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let inside = true;
      if (cx < radius && cy < radius)
        inside = (cx - radius) ** 2 + (cy - radius) ** 2 <= radius ** 2;
      else if (cx > side - radius && cy < radius)
        inside = (cx - (side - radius)) ** 2 + (cy - radius) ** 2 <= radius ** 2;
      else if (cx < radius && cy > side - radius)
        inside = (cx - radius) ** 2 + (cy - (side - radius)) ** 2 <= radius ** 2;
      else if (cx > side - radius && cy > side - radius)
        inside = (cx - (side - radius)) ** 2 + (cy - (side - radius)) ** 2 <= radius ** 2;
      if (inside) canvas.set(ox + x, oy + y, color[0], color[1], color[2], 255);
    }
  }
}

/**
 * Draws a thick line. `mask` limits drawing to pixels that already have alpha,
 * which is what keeps the glyph inside the rounded plate.
 */
function thickLine(canvas, x1, y1, x2, y2, thickness, color, mask) {
  const half = thickness / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const xStart = Math.floor(Math.min(x1, x2) - half);
  const xEnd = Math.ceil(Math.max(x1, x2) + half);
  const yStart = Math.floor(Math.min(y1, y2) - half);
  const yEnd = Math.ceil(Math.max(y1, y2) + half);

  for (let y = Math.max(0, yStart); y <= Math.min(canvas.height - 1, yEnd); y++) {
    for (let x = Math.max(0, xStart); x <= Math.min(canvas.width - 1, xEnd); x++) {
      let dist;
      if (lenSq === 0) {
        dist = Math.hypot(x - x1, y - y1);
      } else {
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
        dist = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      }
      if (dist > half) continue;
      if (mask && canvas.alphaAt(x, y) === 0) continue;
      canvas.set(x, y, color[0], color[1], color[2], 255);
    }
  }
}

/** The "M" mark: a peak over a baseline, drawn inside a `side`-sized box. */
function drawGlyph(canvas, ox, oy, side, color, mask) {
  const mx = ox + side * 0.22;
  const my = oy + side * 0.2;
  const mw = side * 0.56;
  const mh = side * 0.56;
  const sw = Math.max(1, side * 0.09);

  thickLine(canvas, mx + sw / 2, my + mh, mx + mw - sw / 2, my + mh, sw, color, mask);
  const midX = mx + mw / 2;
  const midY = my + mh * 0.48;
  thickLine(canvas, mx + sw / 2, my, midX, midY, sw, color, mask);
  thickLine(canvas, midX, midY, mx + mw - sw / 2, my, sw, color, mask);
}

/**
 * Render the icon.
 *
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.fill] Fraction of the shorter side the plate occupies.
 * @param {boolean} [options.glyphOnly] Monochrome glyph on transparency (badge logo).
 * @returns {Buffer} PNG bytes
 */
export function renderIcon({ width, height, fill = 1, glyphOnly = false }) {
  const canvas = new Canvas(width, height);
  const side = Math.max(1, Math.round(Math.min(width, height) * fill));
  const ox = Math.round((width - side) / 2);
  const oy = Math.round((height - side) / 2);

  if (glyphOnly) {
    // Badge logos are used as a mask: only the alpha channel matters, so the
    // glyph is drawn white on transparency with no plate behind it.
    drawGlyph(canvas, ox, oy, side, GLYPH, false);
  } else {
    roundedPlate(canvas, ox, oy, side, BRAND);
    drawGlyph(canvas, ox, oy, side, GLYPH, true);
  }

  return canvas.toPng();
}
