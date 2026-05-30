/**
 * Generates app icons for Markdown Studio (no Electron default).
 * Outputs: build/icon.png, build/icon.ico, public/app-icon.png
 * Run: npm run icon
 */
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync, copyFileSync } from "fs";
import pngToIco from "png-to-ico";

const W = 256,
  H = 256;

const CRC_T = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
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

const px = new Uint8Array(W * H * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}
function alpha(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return 0;
  return px[(y * W + x) * 4 + 3];
}

const [BR, BG, BB] = [0x4d, 0xa3, 0xff];
const R = Math.round(14 * (W / 64));

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = x + 0.5,
      cy = y + 0.5;
    let inside = true;
    if (cx < R && cy < R) inside = (cx - R) ** 2 + (cy - R) ** 2 <= R ** 2;
    else if (cx > W - R && cy < R) inside = (cx - (W - R)) ** 2 + (cy - R) ** 2 <= R ** 2;
    else if (cx < R && cy > H - R) inside = (cx - R) ** 2 + (cy - (H - R)) ** 2 <= R ** 2;
    else if (cx > W - R && cy > H - R) inside = (cx - (W - R)) ** 2 + (cy - (H - R)) ** 2 <= R ** 2;
    setPixel(x, y, BR, BG, BB, inside ? 255 : 0);
  }
}

const [WR, WG, WB] = [255, 255, 255];
function thickLine(x1, y1, x2, y2, t) {
  const half = t / 2;
  const dx = x2 - x1,
    dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const x0 = Math.floor(Math.min(x1, x2) - half);
  const x9 = Math.ceil(Math.max(x1, x2) + half);
  const y0 = Math.floor(Math.min(y1, y2) - half);
  const y9 = Math.ceil(Math.max(y1, y2) + half);
  for (let py = Math.max(0, y0); py <= Math.min(H - 1, y9); py++) {
    for (let px2 = Math.max(0, x0); px2 <= Math.min(W - 1, x9); px2++) {
      let dist;
      if (lenSq === 0) dist = Math.hypot(px2 - x1, py - y1);
      else {
        const t2 = Math.max(0, Math.min(1, ((px2 - x1) * dx + (py - y1) * dy) / lenSq));
        dist = Math.hypot(px2 - (x1 + t2 * dx), py - (y1 + t2 * dy));
      }
      if (dist <= half && alpha(px2, py) > 0) setPixel(px2, py, WR, WG, WB);
    }
  }
}

const MX = Math.round(W * 0.22),
  MY = Math.round(H * 0.2),
  MW = Math.round(W * 0.56),
  MH = Math.round(H * 0.56),
  SW = Math.round(W * 0.09);
thickLine(MX + SW / 2, MY + MH, MX + MW - SW / 2, MY + MH, SW);
const midX = MX + MW / 2,
  midY = MY + MH * 0.48;
thickLine(MX + SW / 2, MY, midX, midY, SW);
thickLine(midX, midY, MX + MW - SW / 2, MY, SW);

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const idat = deflateSync(raw, { level: 6 });
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
mkdirSync("build", { recursive: true });
mkdirSync("public", { recursive: true });

const pngPath = "build/icon.png";
writeFileSync(
  pngPath,
  Buffer.concat([PNG_SIG, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))])
);
copyFileSync(pngPath, "public/app-icon.png");

const ico = await pngToIco(pngPath);
writeFileSync("build/icon.ico", ico);

console.log("✓ build/icon.png, build/icon.ico, public/app-icon.png");
