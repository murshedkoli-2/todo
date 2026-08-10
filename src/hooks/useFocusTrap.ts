"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // `offsetParent` is null for anything `display: none`; a trap that lands on
    // a hidden control looks to the user like focus vanished.
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}

/**
 * Confines Tab and Shift+Tab to `container` while `active`, and restores focus
 * to whatever was focused before on unmount.
 *
 * Without this, tabbing out of an open dialog walks the page behind it — the
 * user is interacting with content they cannot see, and screen readers read
 * out the wrong context.
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus in, preferring the first real control over the container.
    const initial = focusableWithin(container);
    (initial[0] ?? container).focus({ preventScroll: true });
    if (initial.length === 0) container.tabIndex = -1;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = focusableWithin(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      // Returning focus to the trigger is what makes closing a dialog with the
      // keyboard leave the user where they started.
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return containerRef;
}
