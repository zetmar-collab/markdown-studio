/**
 * Generates app icons for Studio Markdown (no Electron default).
 * Outputs: build/icon.png, build/icon.ico, public/app-icon.png
 * Run: npm run icon
 */
import { writeFileSync, mkdirSync, copyFileSync } from "fs";
import pngToIco from "png-to-ico";
import { renderIcon } from "./lib/appIconArt.mjs";

mkdirSync("build", { recursive: true });
mkdirSync("public", { recursive: true });

const pngPath = "build/icon.png";
writeFileSync(pngPath, renderIcon({ width: 256, height: 256 }));
copyFileSync(pngPath, "public/app-icon.png");

writeFileSync("build/icon.ico", await pngToIco(pngPath));

console.log("✓ build/icon.png, build/icon.ico, public/app-icon.png");
