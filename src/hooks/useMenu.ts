"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State and keyboard handling for a small popup menu.
 *
 * The card status dropdown previously opened on click and could only be closed
 * or operated with a pointer — no Escape, no arrow keys, no focus management.
 * This centralises that behaviour so every menu in the app behaves the same.
 */
export function useMenu(itemCount: number) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpen((current) => {
      if (current) setActiveIndex(-1);
      return !current;
    });
  }, []);

  /* Pointer-down outside closes without stealing focus back, which would
     otherwise fight whatever the user just clicked. */
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, close]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!open) {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(true);
          setActiveIndex(0);
        }
        return;
      }

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          close();
          break;
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((current) => (current + 1) % itemCount);
          break;
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((current) => (current - 1 + itemCount) % itemCount);
          break;
        case "Home":
          event.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          event.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
        case "Tab":
          close(false);
          break;
        default:
          break;
      }
    },
    [open, itemCount, close]
  );

  return { open, setOpen, activeIndex, setActiveIndex, close, toggle, handleKeyDown, containerRef, triggerRef };
}
