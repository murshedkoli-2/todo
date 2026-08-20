"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * State backed by `localStorage`.
 *
 * Used for view preferences — which of list/grid/board the task page opens in,
 * and how it is sorted. Those reset on every navigation when they live in
 * component state alone, so a user who works in the board had to reselect it
 * each time they came back from a task.
 *
 * The initial render always uses `fallback`, and the stored value is adopted in
 * an effect. Reading `localStorage` during render would make the server and
 * client markup disagree and produce a hydration mismatch.
 */
export function usePersistentState<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => value is T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null && isValid(stored)) setValue(stored);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). The
      // fallback is already in state, so there is nothing to recover from.
    }
    // `isValid` is a module-level predicate at every call site; re-running this
    // when it changes identity would clobber a choice the user just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // A preference that cannot be saved is not worth interrupting anyone
        // over — the choice still applies for this session.
      }
    },
    [key]
  );

  return [value, update];
}
