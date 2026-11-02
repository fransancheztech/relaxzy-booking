import { useMemo, useRef } from "react";

/**
 * Keeps a table's loads in order when a background refresh (live update, returning to the tab)
 * can overlap with a load the user started (page, sort, filter):
 * - only the latest load's answer is applied, so a slow older one can't overwrite newer rows;
 * - a background refresh is skipped while the user's own load is on its way — that one brings
 *   fresh data anyway, and refreshing the old page would undo the page change.
 */
export function useLoadSequence() {
  const latest = useRef(0);
  const userLoading = useRef(false);

  return useMemo(
    () => ({
      /** A number for this load, or null when a background refresh should be skipped. */
      start(silent: boolean): number | null {
        if (silent && userLoading.current) return null;
        if (!silent) userLoading.current = true;
        return ++latest.current;
      },
      /** True while no newer load has started: only then apply the answer. */
      isLatest: (seq: number) => seq === latest.current,
      /** Call when the load ends. True for the latest load: time to hide the loading overlay. */
      finish(seq: number): boolean {
        if (seq !== latest.current) return false;
        userLoading.current = false;
        return true;
      },
    }),
    [],
  );
}
