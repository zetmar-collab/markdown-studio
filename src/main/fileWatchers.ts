import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";

/**
 * File watching with own-write suppression.
 *
 * Autosave (and every Ctrl+S) writes the file the watcher is watching, so the
 * app used to notify itself that the file "changed on disk" and prompt the user
 * to reload after each of its own saves. Every write goes through
 * `noteOwnWrite`, and the watcher ignores an event whose mtime matches what we
 * just wrote.
 */
const ownWrites = new Map<string, number>();

/** Windows emits several events per write; collapse them. */
const DEBOUNCE_MS = 250;

export async function noteOwnWrite(filePath: string): Promise<void> {
  try {
    const info = await stat(filePath);
    ownWrites.set(filePath, info.mtimeMs);
  } catch {
    ownWrites.delete(filePath);
  }
}

export function forgetOwnWrite(filePath: string): void {
  ownWrites.delete(filePath);
}

export interface WatchHandle {
  close(): void;
}

export function watchFile(filePath: string, onChange: () => void): WatchHandle | null {
  let watcher: FSWatcher;
  try {
    watcher = watch(filePath, () => {
      schedule();
    });
  } catch {
    return null;
  }

  let timer: NodeJS.Timeout | null = null;
  let closed = false;

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void check();
    }, DEBOUNCE_MS);
  }

  async function check() {
    if (closed) return;
    let mtimeMs: number;
    try {
      mtimeMs = (await stat(filePath)).mtimeMs;
    } catch {
      // File vanished or is momentarily locked - nothing useful to report.
      return;
    }
    const own = ownWrites.get(filePath);
    if (own != null && own === mtimeMs) return;
    ownWrites.delete(filePath);
    onChange();
  }

  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      try {
        watcher.close();
      } catch {
        /* already closed */
      }
    }
  };
}
