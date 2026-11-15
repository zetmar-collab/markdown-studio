import { mkdtemp, writeFile, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearImageCache, embedLocalImages, resolveLocalImagePath } from "../src/main/imageEmbed";
import { toAssetUrl } from "../src/shared/assetProtocol";
import { allowAssetFolder, clearAssetFolders } from "../src/main/assetAccess";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("resolveLocalImagePath", () => {
  it("decodes asset URLs", () => {
    expect(resolveLocalImagePath(toAssetUrl("C:\\a\\b.png"))).toBe("C:\\a\\b.png");
  });

  it("decodes file:// URLs", () => {
    expect(resolveLocalImagePath("file:///C:/a/b%20c.png")).toBe("C:/a/b c.png");
  });

  it("ignores remote and data URLs", () => {
    expect(resolveLocalImagePath("https://e.com/a.png")).toBeNull();
    expect(resolveLocalImagePath("data:image/png;base64,AA")).toBeNull();
  });

  it("needs a document path to resolve a relative source", () => {
    expect(resolveLocalImagePath("a.png")).toBeNull();
    expect(resolveLocalImagePath("a.png", join("C:", "docs", "n.md"))).toContain("a.png");
  });
});

describe("embedLocalImages", () => {
  let root: string;
  let imagePath: string;
  let docPath: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "ms-img-"));
    // Opening a document is what grants its folder; the tests have to do the
    // same or the export gate refuses every path, as it should.
    clearAssetFolders();
    await allowAssetFolder(root);
    imagePath = join(root, "pic.png");
    docPath = join(root, "note.md");
    await writeFile(imagePath, PNG);
    await writeFile(docPath, "# doc", "utf8");
    clearImageCache();
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("inlines a relative image as a data URI", async () => {
    const out = await embedLocalImages('<img src="pic.png">', docPath);
    expect(out).toContain("data:image/png;base64,");
    expect(out).not.toContain('src="pic.png"');
  });

  it("inlines an asset-scheme image", async () => {
    const out = await embedLocalImages(`<img src="${toAssetUrl(imagePath)}">`, null);
    expect(out).toContain("data:image/png;base64,");
  });

  it("leaves remote images alone", async () => {
    const html = '<img src="https://e.com/a.png">';
    expect(await embedLocalImages(html, docPath)).toBe(html);
  });

  it("keeps the original src when the file is missing", async () => {
    const html = '<img src="missing.png">';
    expect(await embedLocalImages(html, docPath)).toBe(html);
  });

  it("returns the html untouched when there are no images", async () => {
    expect(await embedLocalImages("<p>hi</p>", docPath)).toBe("<p>hi</p>");
  });

  it("handles several images in one pass", async () => {
    const html = '<img src="pic.png"><img src="pic.png"><img src="https://e.com/x.png">';
    const out = await embedLocalImages(html, docPath);
    expect(out.match(/data:image\/png;base64,/g)).toHaveLength(2);
    expect(out).toContain("https://e.com/x.png");
  });

  it("picks up a changed file rather than serving a stale cache entry", async () => {
    const first = await embedLocalImages('<img src="pic.png">', docPath);
    await writeFile(imagePath, Buffer.concat([PNG, Buffer.from([0])]));
    const later = new Date(Date.now() + 2000);
    await utimes(imagePath, later, later);
    const second = await embedLocalImages('<img src="pic.png">', docPath);
    expect(second).not.toBe(first);
  });
});
