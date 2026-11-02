import { useEffect, useRef } from "react";

/**
 * Live updates from one of the `/api/<resource>/stream` routes, only while the page is visible.
 *
 * Each open stream keeps a server function alive (and billed by the second) for as long as it's
 * connected, even when nothing happens. Streams used to stay open in minimised windows, background
 * tabs and browsers left on overnight. Now the stream closes once the tab has been hidden for a
 * minute, and when it is shown again it reconnects and `onChange` runs once to catch up on whatever
 * changed meanwhile — so what's on screen is never stale, it just isn't being kept live while nobody
 * can see it. A quick look at another tab keeps the stream open, so coming back costs nothing.
 *
 * `onChange` is debounced (a burst of changes, e.g. a group booking, refetches once) and always
 * the latest version, so callers can pass an inline function without reconnecting the stream.
 */
/** How long a hidden tab keeps its stream before closing it. */
const HIDDEN_GRACE_MS = 60_000;

export function useLiveUpdates(url: string, onChange: () => void, debounceMs = 250) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const open = (catchUp: boolean) => {
      if (source) return;
      const es = new EventSource(url);
      let opened = false;
      es.onmessage = schedule;
      // EventSource reconnects by itself after a dropped connection; anything that changed while
      // it was down was missed, so refetch on every reconnect (not on the first open).
      es.onopen = () => {
        if (opened) schedule();
        opened = true;
      };
      es.onerror = () => console.warn(`Live updates (${url}) lost, retrying…`);
      source = es;
      if (catchUp) schedule();
    };

    const close = () => {
      source?.close();
      source = null;
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = null;
      // Still open after a short absence: open() does nothing, and there's nothing to catch up on.
      if (document.visibilityState === "visible") open(true);
      else hiddenTimer = setTimeout(close, HIDDEN_GRACE_MS);
    };

    if (document.visibilityState === "visible") open(false);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      close();
    };
  }, [url, debounceMs]);
}
