import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearImageCache, embedLocalImages } from "../src/main/imageEmbed";
import { allowAssetFolder, clearAssetFolders } from "../src/main/assetAccess";
import { toAssetUrl } from "../src/shared/assetProtocol";

/**
 * Export used to read whatever path a document named.
 *
 * The preview was confined to the document's own folder, but the export path
 * resolved asset URLs straight back into file reads without the same check —
 * and an unknown extension fell back to image/png, so any file at all was
 * base64-inlined into the exported PDF, HTML or DOCX. A document someone sends
 * you could therefore walk out with a copy of a file you never opened.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("embedLocalImages — ograniczenie dostępu", () => {
  let allowed: string;
  let forbidden: string;
  let docPath: string;

  beforeAll(async () => {
    allowed = await mkdtemp(join(tmpdir(), "ms-gate-ok-"));
    forbidden = await mkdtemp(join(tmpdir(), "ms-gate-no-"));
    docPath = join(allowed, "dokument.md");

    await writeFile(join(allowed, "obrazek.png"), PNG);
    await writeFile(join(forbidden, "cudzy.png"), PNG);
    await writeFile(join(allowed, "sekret.txt"), "SEKRET");
    await writeFile(join(forbidden, "sekret.txt"), "SEKRET");

    clearImageCache();
    clearAssetFolders();
    await allowAssetFolder(allowed);
  });

  afterAll(async () => {
    await rm(allowed, { recursive: true, force: true });
    await rm(forbidden, { recursive: true, force: true });
    clearAssetFolders();
  });

  it("embeds an image from the document's own folder", async () => {
    const html = `<img src="${toAssetUrl(join(allowed, "obrazek.png"))}">`;
    expect(await embedLocalImages(html, docPath)).toContain("data:image/png;base64,");
  });

  it("leaves an image from another folder alone", async () => {
    const html = `<img src="${toAssetUrl(join(forbidden, "cudzy.png"))}">`;
    const result = await embedLocalImages(html, docPath);
    expect(result).not.toContain("base64");
    expect(result).toBe(html);
  });

  it("refuses a file that is not an image, even inside the allowed folder", async () => {
    // The old fallback labelled anything image/png and inlined it.
    const html = `<img src="${toAssetUrl(join(allowed, "sekret.txt"))}">`;
    const result = await embedLocalImages(html, docPath);
    expect(result).not.toContain("base64");
    expect(result).not.toContain("SEKRET");
  });

  it("refuses a file:// source pointing outside the allowed folder", async () => {
    const html = `<img src="file:///${join(forbidden, "cudzy.png").replace(/\\/g, "/")}">`;
    expect(await embedLocalImages(html, docPath)).not.toContain("base64");
  });

  it("refuses a relative source that climbs out of the folder", async () => {
    const html = `<img src="../${join(forbidden, "cudzy.png").split(/[\\/]/).pop()}">`;
    expect(await embedLocalImages(html, docPath)).not.toContain("base64");
  });

  it("refuses a symlink that leaves the allowed folder", async () => {
    // A repository of Markdown files can carry symlinks, so a purely lexical
    // check would pass while the read followed the link somewhere else.
    const link = join(allowed, "podszywka.png");
    try {
      await symlink(join(forbidden, "cudzy.png"), link);
    } catch {
      // Windows refuses symlinks without the right privileges; nothing to test.
      return;
    }
    clearImageCache();
    const html = `<img src="${toAssetUrl(link)}">`;
    expect(await embedLocalImages(html, docPath)).not.toContain("base64");
  });

  it("still serves an image when the folder is registered under a different spelling", async () => {
    // The CI runner reports its temp folder as C:\Users\RUNNER~1\...; once
    // links are followed that becomes runneradmin. The document's own paths use
    // one form and the resolved path the other, so both have to be accepted or
    // a legitimate image is refused at the first, lexical, check.
    const { realpath } = await import("node:fs/promises");
    const real = await realpath(allowed);
    clearAssetFolders();
    clearImageCache();
    await allowAssetFolder(allowed);
    const html = `<img src="${toAssetUrl(join(real, "obrazek.png"))}">`;
    expect(await embedLocalImages(html, docPath)).toContain("data:image/png;base64,");
  });

  it.runIf(process.platform === "win32")(
    "serves an image from a folder registered by its 8.3 short name",
    async () => {
      // This is the CI failure itself: the runner's temp folder arrives as
      // RUNNER~1 and resolves to runneradmin. A folder with a long name has a
      // short alias on any NTFS volume, so the condition can be built here.
      const { execFileSync } = await import("node:child_process");
      const { mkdir } = await import("node:fs/promises");
      const longFolder = join(tmpdir(), `Studio Markdown dlugi folder ${Date.now()}`);
      await mkdir(longFolder, { recursive: true });
      await writeFile(join(longFolder, "obrazek.png"), PNG);
      try {
        const short = execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${longFolder}').ShortPath`
          ],
          { encoding: "utf8" }
        ).trim();
        if (!short || short.toLowerCase() === longFolder.toLowerCase()) return;

        clearAssetFolders();
        clearImageCache();
        await allowAssetFolder(short);
        const html = `<img src="${toAssetUrl(join(short, "obrazek.png"))}">`;
        expect(await embedLocalImages(html, docPath)).toContain("data:image/png;base64,");
      } finally {
        await rm(longFolder, { recursive: true, force: true });
      }
    }
  );

  it("refuses everything when no folder has been granted", async () => {
    clearAssetFolders();
    clearImageCache();
    const html = `<img src="${toAssetUrl(join(allowed, "obrazek.png"))}">`;
    expect(await embedLocalImages(html, docPath)).not.toContain("base64");
    await allowAssetFolder(allowed);
  });
});
