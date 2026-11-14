import { describe, expect, it } from "vitest";
import { describeSaveFailure, fileNameOf } from "../src/shared/saveFailure";
import { fileErrorCode, fileErrorMessage } from "../src/shared/fileErrors";
import { translate } from "../src/shared/i18n";

describe("describeSaveFailure", () => {
  it("names the real reason for the codes that actually happen", () => {
    expect(describeSaveFailure("EACCES")).toBe("status.saveFailedAccess");
    expect(describeSaveFailure("EROFS")).toBe("status.saveFailedReadOnly");
    expect(describeSaveFailure("EBUSY")).toBe("status.saveFailedBusy");
    expect(describeSaveFailure("ENOSPC")).toBe("status.saveFailedNoSpace");
  });

  it("still says something for an unknown or missing code", () => {
    // Silence is the bug being fixed, so every path has to produce a message.
    expect(describeSaveFailure(null)).toBe("status.saveFailed");
    expect(describeSaveFailure("")).toBe("status.saveFailed");
    expect(describeSaveFailure("EWHATEVER")).toBe("status.saveFailed");
  });

  it("has a translation in both languages for every outcome", () => {
    for (const code of [null, "EACCES", "EPERM", "EROFS", "EBUSY", "ENOSPC", "ENOENT", "EISDIR"]) {
      const key = describeSaveFailure(code);
      expect(translate("pl", key, { name: "a.md" })).not.toBe("");
      expect(translate("en", key, { name: "a.md" })).not.toBe("");
      expect(translate("pl", key, { name: "a.md" })).toContain("a.md");
    }
  });
});

describe("fileErrorCode", () => {
  it("picks the errno out of a Node error", () => {
    const error = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    expect(fileErrorCode(error)).toBe("EACCES");
  });

  it("returns null for anything it has no explanation for", () => {
    expect(fileErrorCode(new Error("boom"))).toBeNull();
    expect(fileErrorCode(Object.assign(new Error("x"), { code: "EXDEV" }))).toBeNull();
    expect(fileErrorCode(null)).toBeNull();
    expect(fileErrorCode("string")).toBeNull();
  });
});

describe("fileErrorMessage", () => {
  it("keeps the original text for the details box", () => {
    expect(fileErrorMessage(new Error("EBUSY: resource busy"))).toBe("EBUSY: resource busy");
    expect(fileErrorMessage("zwykły tekst")).toBe("zwykły tekst");
  });
});

describe("fileNameOf", () => {
  it("takes the last segment of a Windows or POSIX path", () => {
    expect(fileNameOf("C:\\Users\\Marek\\notatki.md")).toBe("notatki.md");
    expect(fileNameOf("/home/marek/notatki.md")).toBe("notatki.md");
  });

  it("survives a trailing separator and a bare name", () => {
    expect(fileNameOf("C:\\Users\\Marek\\")).toBe("Marek");
    expect(fileNameOf("notatki.md")).toBe("notatki.md");
    expect(fileNameOf("")).toBe("");
  });
});
