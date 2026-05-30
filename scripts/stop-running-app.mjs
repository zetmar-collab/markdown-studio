import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

const root = process.cwd();
const packOutput = join(root, "out", "pack");
const unpackedDirs = [
  join(packOutput, "win-unpacked"),
  join(root, "release", "win-unpacked")
];

function sleepMs(ms) {
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: "ignore" });
}

function stopWindowsProcesses() {
  const imageNames = ["Markdown Studio.exe", "markdown-studio.exe"];
  for (const image of imageNames) {
    try {
      execSync(`taskkill /IM "${image}" /F`, { stdio: "pipe" });
      console.log(`Zamknięto: ${image}`);
    } catch {
      /* nie działa */
    }
  }

  try {
    execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like \'*win-unpacked*\' -or $_.ExecutablePath -like \'*Markdown Studio*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { stdio: "pipe" }
    );
  } catch {
    /* ignore */
  }
}

function removeDirWithRetry(dir, attempts = 6) {
  if (!existsSync(dir)) return true;
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return true;
    } catch (error) {
      if (i < attempts - 1) sleepMs(800);
      else {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Nie usunięto ${dir}: ${msg}`);
        return false;
      }
    }
  }
  return false;
}

if (platform() === "win32") {
  stopWindowsProcesses();
  sleepMs(500);
}

let staleLeft = false;
for (const dir of unpackedDirs) {
  if (!removeDirWithRetry(dir)) staleLeft = true;
}

if (staleLeft && platform() === "win32") {
  console.warn("");
  console.warn("UWAGA: Stary folder buildu jest zablokowany (app.asar).");
  console.warn("Zamknij Markdown Studio, okno Eksploratora w release/ lub out/pack/,");
  console.warn("wyłącz podgląd plików, potem usuń ręcznie:");
  console.warn("  release\\win-unpacked");
  console.warn("Build i tak trafi do: out\\pack\\");
  console.warn("");
}
