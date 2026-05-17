"use client";

import { useRef, useState } from "react";

/**
 * Prevents ghost-clicks / double-submits by combining:
 *  - a synchronous `useRef` guard that blocks re-entry before React can re-render
 *  - a `submitting` state for UI feedback (button disabling, spinners)
 *
 * Usage:
 *   const { submitting, guard } = useSubmitGuard();
 *   const onSubmit = (data) => guard(async () => { ... });
 *   <Button disabled={submitting}>Save</Button>
 */
export function useSubmitGuard() {
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const guard = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (submittingRef.current) return undefined;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      return await fn();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return { submitting, guard };
}
