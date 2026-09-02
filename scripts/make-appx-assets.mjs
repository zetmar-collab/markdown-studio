/**
 * Generates the Microsoft Store tile set into build/appx/.
 *
 * electron-builder copies every file from build/appx into the package's
 * assets\ folder and lets makepri index them, so the scale-200 and
 * targetsize variants below are picked up automatically by Windows.
 *
 * Without this, electron-builder silently ships its own sample tiles, which
 * would fail Store certification (and look like someone else's app).
 *
 * Run: npm run icon:appx
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { renderIcon } from "./lib/appIconArt.mjs";

const OUT = join("build", "appx");
mkdirSync(OUT, { recursive: true });

/**
 * name -> { w, h, fill }
 * `fill` leaves the padding Windows expects around a tile's artwork; the small
 * icons stay edge-to-edge so they remain legible at 16 px.
 */
const TILES = {
  "StoreLogo.png": { w: 50, h: 50, fill: 1 },
  "Square44x44Logo.png": { w: 44, h: 44, fill: 1 },
  "Square150x150Logo.png": { w: 150, h: 150, fill: 0.86 },
  "Wide310x150Logo.png": { w: 310, h: 150, fill: 0.66 },
  "SmallTile.png": { w: 71, h: 71, fill: 0.86 },
  "LargeTile.png": { w: 310, h: 310, fill: 0.86 },
  "SplashScreen.png": { w: 620, h: 300, fill: 0.5 }
};

const written = [];

function emit(name, width, height, fill, glyphOnly = false) {
  writeFileSync(join(OUT, name), renderIcon({ width, height, fill, glyphOnly }));
  written.push(name);
}

for (const [name, { w, h, fill }] of Object.entries(TILES)) {
  emit(name, w, h, fill);
  // 200 % scale for high-DPI displays.
  emit(name.replace(/\.png$/, ".scale-200.png"), w * 2, h * 2, fill);
}

// Taskbar, jump list and search results pick these by target size. The
// "unplated" variants are shown without the system's background plate.
for (const size of [16, 24, 32, 48, 256]) {
  emit(`Square44x44Logo.targetsize-${size}.png`, size, size, 1);
  emit(`Square44x44Logo.targetsize-${size}_altform-unplated.png`, size, size, 1);
}

// Badge logos are treated as a mask: alpha only, no plate.
emit("BadgeLogo.png", 24, 24, 1, true);
emit("BadgeLogo.scale-200.png", 48, 48, 1, true);

console.log(`✓ build/appx: ${written.length} plików`);
