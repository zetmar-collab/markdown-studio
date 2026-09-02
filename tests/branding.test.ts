import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANGUAGES, translate } from "../src/shared/i18n";

/**
 * The Microsoft Store name is reserved as "Studio Markdown". The manifest, the
 * installer and the in-app strings all have to agree with it, so this test
 * fails if any of them drifts back to the old order.
 */
const PRODUCT_NAME = "Studio Markdown";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  build: {
    productName: string;
    appx: { displayName: string; identityName: string; publisher: string };
    nsis: { shortcutName: string; uninstallDisplayName: string };
  };
};

describe("branding", () => {
  it("uses the reserved name in every language", () => {
    for (const language of LANGUAGES) {
      expect(translate(language, "app.name")).toBe(PRODUCT_NAME);
      expect(translate(language, "dialog.confirmTitle")).toBe(PRODUCT_NAME);
      expect(translate(language, "menu.about")).toContain(PRODUCT_NAME);
    }
  });

  it("uses the reserved name in the packaging configuration", () => {
    expect(pkg.build.productName).toBe(PRODUCT_NAME);
    expect(pkg.build.appx.displayName).toBe(PRODUCT_NAME);
    expect(pkg.build.nsis.shortcutName).toBe(PRODUCT_NAME);
    expect(pkg.build.nsis.uninstallDisplayName).toBe(PRODUCT_NAME);
  });

  it("keeps the Store identity exactly as reserved in Partner Center", () => {
    expect(pkg.build.appx.identityName).toBe("MarekZettel-zetmar.StudioMarkdown");
    expect(pkg.build.appx.publisher).toBe("CN=15A53D32-C868-48EE-B700-5DBB5449CA1B");
  });

  it("no longer says 'Markdown Studio' anywhere in the dictionary", () => {
    for (const language of LANGUAGES) {
      for (const key of ["app.name", "menu.about", "dialog.confirmTitle"] as const) {
        expect(translate(language, key)).not.toContain("Markdown Studio");
      }
    }
  });
});
