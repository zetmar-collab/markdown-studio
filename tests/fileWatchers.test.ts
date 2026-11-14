import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forgetOwnWrite, noteOwnWrite, watchFile } from "../src/main/fileWatchers";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const made: string[] = [];

function tempFile(content = "# Start\n"): string {
  const dir = mkdtempSync(join(tmpdir(), "sm-watch-"));
  made.push(dir);
  const file = join(dir, "notatki.md");
  writeFileSync(file, content, "utf8");
  return file;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("watchFile", () => {
  it("stays quiet about a write the app itself made", async () => {
    // Autosave writes the very file being watched; without this the app told
    // the user their document had "changed on disk" after every save.
    const file = tempFile();
    let changes = 0;
    const handle = watchFile(file, () => {
      changes += 1;
    });
    expect(handle).not.toBeNull();

    writeFileSync(file, "# Zapisane przez aplikację\n", "utf8");
    await noteOwnWrite(file);
    await sleep(700);

    expect(changes).toBe(0);
    handle!.close();
  });

  it("reports a write made by something else", async () => {
    const file = tempFile();
    let changes = 0;
    const handle = watchFile(file, () => {
      changes += 1;
    });
    await noteOwnWrite(file);
    await sleep(100);

    // No noteOwnWrite: this is somebody else's edit.
    writeFileSync(file, "# Zmienione z zewnątrz\n", "utf8");
    await sleep(700);

    expect(changes).toBeGreaterThan(0);
    handle!.close();
  });

  it("collapses the burst of events Windows emits for one write", async () => {
    const file = tempFile();
    let changes = 0;
    const handle = watchFile(file, () => {
      changes += 1;
    });
    await sleep(100);
    writeFileSync(file, "a".repeat(5000), "utf8");
    await sleep(700);

    expect(changes).toBe(1);
    handle!.close();
  });

  it("says nothing more after it is closed", async () => {
    const file = tempFile();
    let changes = 0;
    const handle = watchFile(file, () => {
      changes += 1;
    });
    handle!.close();
    writeFileSync(file, "# Po zamknięciu\n", "utf8");
    await sleep(700);

    expect(changes).toBe(0);
  });

  it("returns null instead of throwing for a path that is not there", () => {
    expect(watchFile(join(tmpdir(), "nie-ma-takiego-pliku-xyz.md"), () => {})).toBeNull();
  });

  it("forgetOwnWrite makes the next write look foreign again", async () => {
    const file = tempFile();
    let changes = 0;
    const handle = watchFile(file, () => {
      changes += 1;
    });
    writeFileSync(file, "# Nasz zapis\n", "utf8");
    await noteOwnWrite(file);
    forgetOwnWrite(file);
    await sleep(700);

    expect(changes).toBeGreaterThan(0);
    handle!.close();
  });
});
