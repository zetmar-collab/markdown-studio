import { describe, expect, it } from "vitest";
import { templateFileName } from "../src/main/userTemplates";

describe("templateFileName", () => {
  it("keeps an ordinary name", () => {
    expect(templateFileName("Notatka ze spotkania")).toBe("Notatka ze spotkania.md");
  });

  it("replaces characters Windows forbids", () => {
    expect(templateFileName("raport: 2026/2027 <wersja>")).toBe("raport- 2026-2027 -wersja.md");
  });

  it("refuses a name that is only whitespace, dots or dashes", () => {
    expect(templateFileName("   ")).toBeNull();
    expect(templateFileName("...")).toBeNull();
    expect(templateFileName("---")).toBeNull();
  });

  it("produces a name that cannot escape the templates folder", () => {
    // The reader refuses any name containing "..", so the writer must never
    // produce one — otherwise a template saves and then cannot be opened.
    const windowsStyle = templateFileName("..\\..\\tajne");
    const posixStyle = templateFileName("../../tajne");
    expect(posixStyle).toBe("tajne.md");
    expect(windowsStyle).toBe("tajne.md");
    expect(posixStyle!.includes("..")).toBe(false);
  });

  it("works around reserved device names", () => {
    // A file literally called con.md cannot be created on Windows.
    expect(templateFileName("con")).toBe("con-szablon.md");
    expect(templateFileName("LPT1")).toBe("LPT1-szablon.md");
    expect(templateFileName("console")).toBe("console.md");
  });

  it("trims a trailing dot or space, which Windows also refuses", () => {
    expect(templateFileName("szablon.")).toBe("szablon.md");
    expect(templateFileName("szablon ")).toBe("szablon.md");
  });

  it("cuts a name that is too long", () => {
    const name = templateFileName("x".repeat(200))!;
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith(".md")).toBe(true);
  });

  it("strips control characters instead of putting them in a path", () => {
    expect(templateFileName(`szablon${String.fromCharCode(9)}pierwszy`)).toBe(
      "szablon-pierwszy.md"
    );
  });
});
