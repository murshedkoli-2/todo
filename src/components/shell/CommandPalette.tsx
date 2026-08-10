"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { NAV_SECTIONS } from "@/components/shell/navigation";
import {
  MoonIcon, PlusIcon, SearchIcon, SunIcon,
} from "@/components/ui/icons";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** Case-insensitive subsequence match, so "wl" finds "Wallet". */
function matches(query: string, label: string): boolean {
  if (!query) return true;
  const haystack = label.toLowerCase();
  let cursor = 0;
  for (const character of query.toLowerCase()) {
    cursor = haystack.indexOf(character, cursor);
    if (cursor === -1) return false;
    cursor += 1;
  }
  return true;
}

/**
 * ⌘K / Ctrl+K palette for navigation and the handful of actions worth reaching
 * without the mouse. Mounted once in `AppShell`.
 */
export default function CommandPalette() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = NAV_SECTIONS.map((section) => ({
      id: `nav-${section.href}`,
      label: `Go to ${section.label}`,
      hint: section.description,
      icon: <section.icon className="w-4 h-4" />,
      run: () => router.push(section.href),
    }));

    return [
      {
        id: "new-task",
        label: "New task",
        hint: "Create a task",
        icon: <PlusIcon className="w-4 h-4" />,
        run: () => router.push("/tasks/new"),
      },
      ...navigation,
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon:
          theme === "dark" ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />,
        run: toggleTheme,
      },
    ];
  }, [router, theme, toggleTheme]);

  const visible = useMemo(
    () => commands.filter((command) => matches(query, command.label)),
    [commands, query]
  );

  /* Global shortcut. Registered on the window so it works from any page. */
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const isPaletteKey = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (!isPaletteKey) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Clamp the cursor when filtering shrinks the list under it.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  // Keep the highlighted row in view during arrow-key navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % Math.max(1, visible.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + Math.max(1, visible.length)) % Math.max(1, visible.length)
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = visible[activeIndex];
      if (command) {
        command.run();
        close();
      }
    }
  };

  return (
    <div
      className="palette-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="palette-box"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <SearchIcon className="w-4 h-4 flex-shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands…"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="palette-list"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-ink placeholder:text-ink-muted"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div
          id="palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-y-auto py-1.5"
        >
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-ink-muted">
              No commands match “{query}”.
            </p>
          ) : (
            visible.map((command, index) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-index={index}
                data-active={index === activeIndex}
                className="palette-item"
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => {
                  command.run();
                  close();
                }}
              >
                <span className="flex-shrink-0 text-ink-muted">{command.icon}</span>
                <span className="flex-1 min-w-0 truncate font-medium">{command.label}</span>
                {command.hint && (
                  <span className="text-xs truncate max-w-[45%] text-ink-muted">
                    {command.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
