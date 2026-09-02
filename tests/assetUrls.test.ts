import { describe, expect, it } from "vitest";
import { dirnameOf, resolveRelativePath, rewriteAssetUrls } from "../src/renderer/utils/assetUrls";
import { fromAssetUrl, isAssetUrl, toAssetUrl } from "../src/shared/assetProtocol";

describe("dirnameOf", () => {
  it("handles Windows and POSIX paths", () => {
    expect(dirnameOf("C:\\docs\\note.md")).toBe("C:\\docs");
    expect(dirnameOf("/home/user/note.md")).toBe("/home/user");
  });
});

describe("resolveRelativePath", () => {
  it("joins a relative path", () => {
    expect(resolveRelativePath("C:\\docs", "assets/img.png")).toBe("C:\\docs\\assets\\img.png");
  });

  it("walks up with ..", () => {
    expect(resolveRelativePath("C:\\docs\\sub", "../img.png")).toBe("C:\\docs\\img.png");
  });

  it("keeps a leading slash on POSIX paths", () => {
    expect(resolveRelativePath("/home/user", "./a/b.png")).toBe("/home/user/a/b.png");
  });
});

describe("asset URLs", () => {
  it("round-trips a path", () => {
    const url = toAssetUrl("C:\\docs\\my image.png");
    expect(isAssetUrl(url)).toBe(true);
    expect(fromAssetUrl(url)).toBe("C:\\docs\\my image.png");
  });

  it("returns null for anything else", () => {
    expect(fromAssetUrl("https://example.com/a.png")).toBeNull();
  });
});

describe("rewriteAssetUrls", () => {
  it("rewrites a relative image against the document folder", () => {
    const html = '<img src="assets/a.png">';
    const out = rewriteAssetUrls(html, "C:\\docs\\note.md");
    expect(out).toContain(toAssetUrl("C:\\docs\\assets\\a.png"));
  });

  it("rewrites file:// URLs", () => {
    const out = rewriteAssetUrls('<img src="file:///C:/x/a.png">', null);
    expect(out).toContain(toAssetUrl("C:/x/a.png"));
  });

  it("leaves remote and data URLs untouched", () => {
    const html = '<img src="https://e.com/a.png"><img src="data:image/png;base64,AA">';
    expect(rewriteAssetUrls(html, "C:\\docs\\note.md")).toBe(html);
  });

  it("leaves relative images alone for an unsaved document", () => {
    const html = '<img src="assets/a.png">';
    expect(rewriteAssetUrls(html, null)).toBe(html);
  });

  it("is idempotent", () => {
    const once = rewriteAssetUrls('<img src="a.png">', "C:\\d\\n.md");
    expect(rewriteAssetUrls(once, "C:\\d\\n.md")).toBe(once);
  });
});
