import { execSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";

const root = process.cwd();
const packOutput = join(root, "out", "pack");
const legacyOutput = join(root, "release");

function sleepMs(ms) {
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: "ignore" });
}

function stopWindowsProcesses() {
  const imageNames = ["Markdown Studio.exe", "markdown-studio.exe", "electron.exe"];
  for (const image of imageNames) {
    try {
      execSync(`taskkill /IM "${image}" /F`, { stdio: "pipe" });
      console.log(`Zamknięto: ${image}`);
    } catch {
      /* nie działa */
    }
  }

  const ps = `
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.ExecutablePath -and (
      $_.ExecutablePath -like '*win-unpacked*' -or
      $_.ExecutablePath -like '*Markdown Studio*' -or
      $_.ExecutablePath -like '*markdown-studio*' -or
      $_.ExecutablePath -like '*\\\\out\\\\pack\\\\*' -or
      $_.ExecutablePath -like '*\\Programs\\*Markdown*'
    )
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
`.trim();

  try {
    execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: "pipe" });
  } catch {
    /* ignore */
  }
}

function removeDirWithRetry(dir, attempts = 8) {
  if (!existsSync(dir)) return true;
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return true;
    } catch (error) {
      if (i < attempts - 1) sleepMs(1000);
      else {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Nie usunięto ${dir}: ${msg}`);
        return false;
      }
    }
  }
  return false;
}

function quarantineDir(dir) {
  if (!existsSync(dir)) return true;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const quarantine = `${dir}.stale-${stamp}`;
  try {
    renameSync(dir, quarantine);
    console.log(`Przeniesiono zablokowany folder do: ${quarantine}`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Nie przeniesiono ${dir}: ${msg}`);
    return false;
  }
}

function cleanDir(dir) {
  if (!existsSync(dir)) return true;
  if (removeDirWithRetry(dir)) return true;
  return quarantineDir(dir);
}

if (platform() === "win32") {
  stopWindowsProcesses();
  sleepMs(800);
}

let staleLeft = false;

// Cały out/pack — inaczej zostaje Markdown Studio.exe zamiast electron.exe i build pada na rename
if (!cleanDir(packOutput)) staleLeft = true;
if (!cleanDir(legacyOutput)) staleLeft = true;

if (staleLeft && platform() === "win32") {
  console.error("");
  console.error("BŁĄD: Nie można wyczyścić out\\pack (pliki zablokowane).");
  console.error("Zamknij Markdown Studio, Eksplorator w out\\pack, antywirus skanujący folder.");
  console.error("Usuń ręcznie: out\\pack");
  console.error("");
  process.exit(1);
}

console.log("Wyczyszczono out/pack — gotowe do pakowania.");
