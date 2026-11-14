import { describe, expect, it } from "vitest";
import { isSafeExternalUrl } from "../src/shared/externalLinks";

describe("isSafeExternalUrl", () => {
  it("accepts the schemes a document legitimately links to", () => {
    expect(isSafeExternalUrl("https://example.com/")).toBe(true);
    expect(isSafeExternalUrl("http://example.com/a?b=1#c")).toBe(true);
    expect(isSafeExternalUrl("mailto:kto@example.com")).toBe(true);
  });

  it("refuses file:, which would hand an executable to the shell", () => {
    expect(isSafeExternalUrl("file:///C:/Windows/System32/cmd.exe")).toBe(false);
  });

  it("refuses schemes that run code or reach the system", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeExternalUrl("ms-settings:regionlanguage")).toBe(false);
    expect(isSafeExternalUrl("smb://host/share")).toBe(false);
  });

  it("refuses anything that is not a URL at all", () => {
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl("nie adres")).toBe(false);
    expect(isSafeExternalUrl("//example.com")).toBe(false);
  });

  it("is not fooled by case or leading whitespace", () => {
    expect(isSafeExternalUrl("HTTPS://example.com/")).toBe(true);
    expect(isSafeExternalUrl("  javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("JaVaScRiPt:alert(1)")).toBe(false);
  });
});
