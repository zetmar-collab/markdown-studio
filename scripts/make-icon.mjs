/**
 * Generates build/icon.png (256×256 RGBA) — no external dependencies.
 * Design: blue (#4DA3FF) rounded-rect background, white "M" letter.
 * Run: node scripts/make-icon.mjs
 */
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";

const W = 256, H = 256;

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_T = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_T[n] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_T[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// ── Pixel buffer (RGBA) ────────────────────────────────────────────────────
const px = new Uint8Array(W * H * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}
function alpha(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return 0;
  return px[(y * W + x) * 4 + 3];
}

// ── Blue background with rounded corners (rx≈56 matching SVG rx=14/64*256) ─
const [BR, BG, BB] = [0x4D, 0xA3, 0xFF];
const R = Math.round(14 * W / 64); // 56

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    let inside = true;
    if (cx < R && cy < R)           inside = (cx-R)**2 + (cy-R)**2 <= R**2;
    else if (cx > W-R && cy < R)    inside = (cx-(W-R))**2 + (cy-R)**2 <= R**2;
    else if (cx < R && cy > H-R)    inside = (cx-R)**2 + (cy-(H-R))**2 <= R**2;
    else if (cx > W-R && cy > H-R)  inside = (cx-(W-R))**2 + (cy-(H-R))**2 <= R**2;
    setPixel(x, y, BR, BG, BB, inside ? 255 : 0);
  }
}

// ── White M ────────────────────────────────────────────────────────────────
const [WR, WG, WB] = [255, 255, 255];

function fillBox(x1, y1, x2, y2) {
  for (let y = Math.max(0, Math.round(y1)); y < Math.min(H, Math.round(y2)); y++)
    for (let x = Math.max(0, Math.round(x1)); x < Math.min(W, Math.round(x2)); x++)
      if (alpha(x, y) > 0) setPixel(x, y, WR, WG, WB);
}

/** Draw a thick line (perpendicular distance fill). */
function thickLine(x1, y1, x2, y2, t) {
  const half = t / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const x0 = Math.floor(Math.min(x1, x2) - half);
  const x9 = Math.ceil(Math.max(x1, x2) + half);
  const y0 = Math.floor(Math.min(y1, y2) - half);
  const y9 = Math.ceil(Math.max(y1, y2) + half);
  for (let py = Math.max(0, y0); py <= Math.min(H - 1, y9); py++) {
    for (let px2 = Math.max(0, x0); px2 <= Math.min(W - 1, x9); px2++) {
      let dist;
      if (lenSq === 0) {
        dist = Math.hypot(px2 - x1, py - y1);
      } else {
        const s = Math.max(0, Math.min(1, ((px2 - x1) * dx + (py - y1) * dy) / lenSq));
        dist = Math.hypot(px2 - (x1 + s * dx), py - (y1 + s * dy));
      }
      if (dist <= half && alpha(px2, py) > 0) setPixel(px2, py, WR, WG, WB);
    }
  }
}

// M geometry (matches SVG proportions scaled to 256×256)
// SVG: outer box x=14,y=19, w=36, h=26  →  scaled: x=56,y=76, w=144, h=104
const MX = 56, MY = 76, MW = 144, MH = 104;
const SW = 26; // stroke width

// Left vertical bar
fillBox(MX, MY, MX + SW, MY + MH);
// Right vertical bar
fillBox(MX + MW - SW, MY, MX + MW, MY + MH);
// Left diagonal: top-center of left bar → middle of M
const midX = MX + MW / 2;
const midY = MY + MH * 0.48;
thickLine(MX + SW / 2, MY, midX, midY, SW);
// Right diagonal: middle of M → top-center of right bar
thickLine(midX, midY, MX + MW - SW / 2, MY, SW);

// ── Encode PNG ─────────────────────────────────────────────────────────────
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter: None
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const idat = deflateSync(raw, { level: 6 });

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
mkdirSync("build", { recursive: true });
writeFileSync("build/icon.png", Buffer.concat([
  PNG_SIG,
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", idat),
  pngChunk("IEND", Buffer.alloc(0)),
]));
console.log("✓ build/icon.png generated (256×256 RGBA)");
