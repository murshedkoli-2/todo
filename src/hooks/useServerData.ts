"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Locally mutable state seeded from a server component's props, re-seeded
 * whenever the server sends a new payload.
 *
 * The list pages all follow the same shape: a server component queries the
 * database and hands the rows to a client component, which keeps them in state
 * so a create or a status toggle can be applied optimistically without waiting
 * for a round-trip. Written as a plain `useState(initialTodos)`, that state is
 * seeded exactly once — React ignores the initialiser on every render after the
 * mount — so anything the server sent afterwards was silently dropped.
 *
 * That is what made a task created through the full form invisible until a
 * manual reload. `router.push("/tasks")` can be served from Next's client-side
 * Router Cache, which still holds the list as it was before the task existed;
 * the `router.refresh()` that follows does fetch the current rows and does
 * re-render the client component with them — but the component was keeping its
 * own copy and never looked at the new prop. Only a hard reload, which remounts
 * everything, could get the task on screen.
 *
 * The reset happens during render rather than in an effect, which is the
 * pattern React documents for adjusting state when a prop changes: React
 * re-runs the component immediately with the new state and never commits the
 * intermediate, so there is no frame showing the stale list and no second pass
 * through the DOM.
 *
 * Identity, not deep equality, is the trigger. Every server render deserialises
 * a fresh array out of the RSC payload, so a new reference means "the server
 * has spoken since last time" — which is exactly when local state should yield
 * to it.
 */
export function useServerData<T>(fromServer: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(fromServer);
  const [seed, setSeed] = useState<T>(fromServer);

  if (fromServer !== seed) {
    setSeed(fromServer);
    setValue(fromServer);
  }

  return [value, setValue];
}
