/**
 * Which addresses the app is willing to hand to the operating system.
 *
 * Deliberately short. `file:` is missing on purpose: a document containing
 * `[x](file:///C:/Windows/System32/cmd.exe)` would otherwise be one click away
 * from starting a program.
 */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeExternalUrl(url: string): boolean {
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
