import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "dist-electron");
if (existsSync(out)) {
  rmSync(out, { recursive: true, force: true });
  console.log("Wyczyszczono dist-electron/");
}
