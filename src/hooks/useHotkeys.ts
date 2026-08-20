"use client";

import { useEffect, useRef } from "react";

/**
 * A key sequence and what it does. `keys` is either a single key ("n") or a
 * two-key chord typed in order ("g t"), matching the convention users already
 * know from Gmail, GitHub and Linear.
 */
export interface Hotkey {
  keys: string;
  handler: () => void;
}

/** Chords time out, so a stray "g" does not arm the prefix indefinitely. */
const CHORD_TIMEOUT_MS = 1200;

/**
 * Typing in a field must never trigger a shortcut — the single most common way
 * a keyboard layer goes wrong is "n" creating a task while the user is writing
 * a description.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Registers single-key and two-key-chord shortcuts on the window.
 *
 * Modifier combinations are deliberately out of scope: ⌘K is owned by the
 * command palette, and anything else with a modifier is likely a browser or OS
 * binding this app has no business intercepting.
 */
export function useHotkeys(hotkeys: ReadonlyArray<Hotkey>, enabled = true): void {
  // Held in a ref so a re-created handler array does not re-bind the listener
  // on every render of the component that owns it. Written in an effect rather
  // than during render, which React may discard and re-run.
  const latest = useRef(hotkeys);
  useEffect(() => {
    latest.current = hotkeys;
  }, [hotkeys]);

  useEffect(() => {
    if (!enabled) return;

    let prefix = "";
    let prefixTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPrefix = () => {
      prefix = "";
      if (prefixTimer) {
        clearTimeout(prefixTimer);
        prefixTimer = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const candidate = prefix ? `${prefix} ${key}` : key;

      const match = latest.current.find((hotkey) => hotkey.keys === candidate);
      if (match) {
        event.preventDefault();
        clearPrefix();
        match.handler();
        return;
      }

      // Not a complete match — arm the prefix if any chord starts with this key.
      const startsAChord = latest.current.some((hotkey) => hotkey.keys.startsWith(`${key} `));
      clearPrefix();
      if (startsAChord) {
        prefix = key;
        prefixTimer = setTimeout(clearPrefix, CHORD_TIMEOUT_MS);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPrefix();
    };
  }, [enabled]);
}
