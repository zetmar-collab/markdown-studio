import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A path the document chose must not reach the filesystem before it is approved.
 *
 * On Windows `\\serwer\udzial\x.png` is not a local path — the operating system
 * goes and asks that host, and SMB hands it an authentication attempt. Calling
 * `realpath` on whatever a document named therefore turned opening somebody
 * else's Markdown file into an outbound credential leak. These tests watch the
 * call itself, because the return value looks identical either way.
 */
const realpathCalls: string[] = [];

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    realpath: (path: string) => {
      realpathCalls.push(String(path));
      return actual.realpath(path);
    }
  };
});

const { allowAssetFolder, clearAssetFolders, isAllowedAssetPath } =
  await import("../src/main/assetAccess");

const ROOT = process.platform === "win32" ? "C:\\prace\\notatki" : "/prace/notatki";
const sep = process.platform === "win32" ? "\\" : "/";

describe("isAllowedAssetPath — nic nie dotyka dysku przed zgodą", () => {
  beforeEach(async () => {
    realpathCalls.length = 0;
    clearAssetFolders();
    await allowAssetFolder(ROOT);
    realpathCalls.length = 0;
  });

  it("refuses a UNC path without asking the network for it", async () => {
    expect(await isAllowedAssetPath("\\\\serwer\\udzial\\obrazek.png")).toBe(false);
    expect(realpathCalls).toEqual([]);
  });

  it("refuses a forward-slash UNC path the same way", async () => {
    expect(await isAllowedAssetPath("//serwer/udzial/obrazek.png")).toBe(false);
    expect(realpathCalls).toEqual([]);
  });

  it("refuses a Windows device path without touching it", async () => {
    expect(await isAllowedAssetPath("\\\\?\\C:\\Windows\\obrazek.png")).toBe(false);
    expect(realpathCalls).toEqual([]);
  });

  it("refuses an ordinary path outside the folder without touching it", async () => {
    const outside = process.platform === "win32" ? "C:\\inne\\obrazek.png" : "/inne/obrazek.png";
    expect(await isAllowedAssetPath(outside)).toBe(false);
    expect(realpathCalls).toEqual([]);
  });

  it("refuses a non-image before anything else happens", async () => {
    expect(await isAllowedAssetPath(`${ROOT}${sep}sekret.txt`)).toBe(false);
    expect(realpathCalls).toEqual([]);
  });

  it("does resolve links for a path that passed the lexical check", async () => {
    // The symlink check still has to happen for anything inside the folder.
    await isAllowedAssetPath(`${ROOT}${sep}obrazek.png`);
    expect(realpathCalls.length).toBe(1);
  });
});
