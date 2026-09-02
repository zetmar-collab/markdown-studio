import type { Theme } from "../renderer-types";

/**
 * Mermaid is ~3 MB, so it is imported on first use rather than at startup:
 * most documents contain no diagrams and should not pay for the parser.
 */
type MermaidApi = typeof import("mermaid").default;

let loading: Promise<MermaidApi | null> | null = null;
let initializedTheme: Theme | null = null;
let diagramSeq = 0;

/** How long to wait for the module and for a single diagram before giving up. */
const LOAD_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 15000;

/**
 * Resolve to `timeoutValue` if `promise` has not settled in time.
 *
 * Both the dynamic import and `mermaid.render` can stall indefinitely instead
 * of rejecting. Without a deadline that showed up as a silently empty gap in
 * the preview, which is indistinguishable from "the diagram is missing".
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutValue: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(timeoutValue);
    }, ms);
    void promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(timeoutValue);
      }
    );
  });
}

async function loadMermaid(theme: Theme): Promise<MermaidApi | null> {
  if (!loading) {
    loading = import("mermaid")
      .then((mod) => mod.default)
      .catch((error: unknown) => {
        // A failed import must not stay cached. Keeping the rejected promise
        // poisoned `loading` for the rest of the session, so a single transient
        // failure disabled every diagram until the app restarted.
        loading = null;
        console.error("Mermaid: nie udalo sie zaladowac modulu", error);
        return null;
      });
  }
  const mermaid = await withTimeout(loading, LOAD_TIMEOUT_MS, null);
  if (!mermaid) {
    // Allow a later attempt to try again rather than caching the stall.
    loading = null;
    return null;
  }
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default"
    });
    initializedTheme = theme;
  }
  return mermaid;
}

/** Replace a placeholder with a visible, plain-text error message. */
function showError(node: HTMLElement, message: string): void {
  node.innerHTML = "";
  const box = document.createElement("div");
  box.className = "mermaid-error";
  // textContent, never innerHTML: the message can echo user input.
  box.textContent = `Mermaid: ${message}`;
  node.appendChild(box);
}

/** Marker combining source and theme, so a theme switch forces a re-render. */
function renderKey(encodedSource: string, theme: Theme): string {
  return `${theme}:${encodedSource}`;
}

/**
 * Replace `.mermaid-diagram` placeholders emitted by the markdown renderer with
 * rendered SVG. Safe to call on every preview update: nodes already rendered
 * from the same source and theme are skipped.
 */
export async function renderMermaidDiagrams(
  container: HTMLElement | null,
  theme: Theme
): Promise<void> {
  if (!container) return;
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(".mermaid-diagram[data-mermaid-source]")
  );
  const pending = nodes.filter((node) => {
    const encoded = node.dataset.mermaidSource ?? "";
    return node.dataset.mermaidDone !== renderKey(encoded, theme);
  });
  if (!pending.length) return;

  const mermaid = await loadMermaid(theme);
  if (!mermaid) {
    // Never leave an empty box behind: a silent failure looked exactly like
    // "the diagram simply did not appear".
    for (const node of pending) showError(node, "nie udalo sie zaladowac modulu diagramow");
    return;
  }

  await Promise.all(
    pending.map(async (node) => {
      const encoded = node.dataset.mermaidSource ?? "";
      let source: string;
      try {
        source = decodeURIComponent(encoded);
      } catch {
        return;
      }
      diagramSeq += 1;
      try {
        const result = await withTimeout(
          mermaid.render(`ms-mermaid-${diagramSeq}`, source),
          RENDER_TIMEOUT_MS,
          null
        );
        if (result?.svg) {
          node.innerHTML = result.svg;
        } else {
          console.error("Mermaid: renderowanie przekroczylo limit czasu");
          showError(node, "renderowanie diagramu przekroczylo limit czasu");
        }
      } catch (error) {
        console.error("Mermaid: blad renderowania diagramu", error);
        showError(node, error instanceof Error ? error.message : String(error));
      }
      node.dataset.mermaidDone = renderKey(encoded, theme);
    })
  );
}
