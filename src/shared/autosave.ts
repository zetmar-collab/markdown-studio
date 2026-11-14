/**
 * The two decisions autosave gets wrong if it is written inline.
 *
 * Autosave writes a snapshot of the tab and then clears the "unsaved" marker.
 * Between those two steps there is an IPC round trip, and the user keeps
 * typing: clearing the marker unconditionally declares characters saved that
 * never reached the disk, the next pass then skips the tab, and the prompt on
 * close never appears. The edits are simply gone.
 */

interface AutosaveTab {
  dirty: boolean;
  filePath: string | null;
}

/** Tabs worth writing: changed, and backed by a file we know the path of. */
export function tabsNeedingAutosave<T extends AutosaveTab>(tabs: readonly T[]): T[] {
  return tabs.filter((tab) => tab.dirty && Boolean(tab.filePath));
}

/**
 * May the "unsaved" marker be cleared after a successful write?
 *
 * Only if the tab still holds exactly what went to disk. `current` is undefined
 * when the tab was closed while the write was in flight — nothing to mark.
 */
export function savedContentIsCurrent(written: string, current: string | undefined): boolean {
  return current !== undefined && current === written;
}
