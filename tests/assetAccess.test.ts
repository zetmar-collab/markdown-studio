import { beforeEach, describe, expect, it } from "vitest";
import { allowAssetFolder, clearAssetFolders, isAllowedAssetPath } from "../src/main/assetAccess";

const DOC_FOLDER = process.platform === "win32" ? "C:\\prace\\notatki" : "/prace/notatki";
const inside = (name: string) => `${DOC_FOLDER}${process.platform === "win32" ? "\\" : "/"}${name}`;

describe("isAllowedAssetPath", () => {
  beforeEach(() => {
    clearAssetFolders();
    allowAssetFolder(DOC_FOLDER);
  });

  it("serves an image sitting next to the document", () => {
    expect(isAllowedAssetPath(inside("obrazek.png"))).toBe(true);
  });

  it("serves an image in a subfolder, which is where pasted images land", () => {
    expect(isAllowedAssetPath(inside("assets\\wklejone.png".replace("\\", "/")))).toBe(true);
  });

  it("refuses a file outside every opened folder", () => {
    const outside = process.platform === "win32" ? "C:\\inne\\tajne.png" : "/inne/tajne.png";
    expect(isAllowedAssetPath(outside)).toBe(false);
  });

  it("refuses a climb out of the allowed folder", () => {
    // resolve() collapses the dots first, so the judgement is on where the
    // path actually lands, not on how it is spelled.
    expect(isAllowedAssetPath(inside("..\\..\\Windows\\win.ini"))).toBe(false);
    expect(isAllowedAssetPath(inside("../../Windows/win.ini"))).toBe(false);
  });

  it("refuses anything that is not an image, even inside the folder", () => {
    expect(isAllowedAssetPath(inside("haslo.txt"))).toBe(false);
    expect(isAllowedAssetPath(inside("notatki.md"))).toBe(false);
    expect(isAllowedAssetPath(inside("obrazek.png.exe"))).toBe(false);
  });

  it("refuses everything when no folder has been opened", () => {
    clearAssetFolders();
    expect(isAllowedAssetPath(inside("obrazek.png"))).toBe(false);
  });

  it("refuses an empty path", () => {
    expect(isAllowedAssetPath("")).toBe(false);
  });

  it("does not treat a sibling folder with a shared prefix as inside", () => {
    const sibling =
      process.platform === "win32"
        ? "C:\\prace\\notatki-stare\\x.png"
        : "/prace/notatki-stare/x.png";
    expect(isAllowedAssetPath(sibling)).toBe(false);
  });
});
