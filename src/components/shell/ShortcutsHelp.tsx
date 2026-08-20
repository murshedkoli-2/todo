"use client";

import { useEffect, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CloseIcon, KeyboardIcon } from "@/components/ui/icons";

interface ShortcutGroup {
  title: string;
  items: ReadonlyArray<{ keys: string[]; description: string }>;
}

/**
 * The one place shortcuts are documented. Anything bound in `AppShell` should
 * appear here — an undiscoverable shortcut is a shortcut nobody uses.
 */
export const SHORTCUT_GROUPS: ReadonlyArray<ShortcutGroup> = [
  {
    title: "General",
    items: [
      { keys: ["⌘", "K"], description: "Open the command palette" },
      { keys: ["/"], description: "Search the current page" },
      { keys: ["?"], description: "Show this help" },
      { keys: ["Esc"], description: "Close a dialog or clear a field" },
    ],
  },
  {
    title: "Tasks",
    items: [
      { keys: ["N"], description: "Focus quick add" },
      { keys: ["C"], description: "Open the full task form" },
    ],
  },
  {
    title: "Go to",
    items: [
      { keys: ["G", "O"], description: "Overview" },
      { keys: ["G", "T"], description: "Tasks" },
      { keys: ["G", "L"], description: "Ledger" },
      { keys: ["G", "W"], description: "Wallet" },
    ],
  },
];

/**
 * Keyboard reference, opened with `?`.
 *
 * Mounted once in `AppShell` and self-contained: it listens for its own key so
 * a page does not have to remember to wire it up.
 */
export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  /* Exposed as an event so `AppShell` can bind `?` through the same hotkey
     table as everything else, rather than this component owning a second
     keyboard listener with its own idea of what counts as a typing target. */
  useEffect(() => {
    const toggle = () => setOpen((current) => !current);
    window.addEventListener("taskflow:shortcuts", toggle);
    return () => window.removeEventListener("taskflow:shortcuts", toggle);
  }, []);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="modal-box"
      >
        <header className="flex items-center gap-3 px-5 h-14 border-b border-line">
          <span className="text-ink-muted">
            <KeyboardIcon className="w-5 h-5" />
          </span>
          <h2 id="shortcuts-title" className="text-section flex-1">
            Keyboard shortcuts
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost w-8 h-8 px-0"
            aria-label="Close shortcuts"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="mb-5 last:mb-0">
              <h3 className="text-eyebrow mb-2">{group.title}</h3>
              <dl className="flex flex-col">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center gap-3 py-2 border-b border-line last:border-b-0"
                  >
                    <dt className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((key) => (
                        <kbd key={key} className="kbd">
                          {key}
                        </kbd>
                      ))}
                    </dt>
                    <dd className="text-sm text-ink-secondary">{item.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
