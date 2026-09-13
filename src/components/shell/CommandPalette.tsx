"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { NAV_SECTIONS } from "@/components/shell/navigation";
import { api } from "@/lib/apiClient";
import type { Todo } from "@/lib/types";
import {
  BoardIcon, GridIcon, KeyboardIcon, ListIcon, MoonIcon, PlusIcon, SearchIcon,
  SunIcon, TasksIcon,
} from "@/components/ui/icons";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  /** Task results are already server-filtered, so the local filter skips them. */
  alwaysVisible?: boolean;
}

/** Enough to fill the list without turning the palette into a browse view. */
const TASK_RESULT_LIMIT = 6;
const TASK_SEARCH_DEBOUNCE_MS = 180;

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
  const [tasks, setTasks] = useState<Todo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    setTasks([]);
  }, []);

  const commands = useMemo<Command[]>(() => {
    /* Matching tasks lead: once the user has typed something, what they are
       almost always looking for is a specific piece of work, not a setting. */
    const taskResults: Command[] = tasks.map((task) => ({
      id: `task-${task._id}`,
      label: task.title,
      hint: "Task",
      icon: <TasksIcon className="w-4 h-4" />,
      alwaysVisible: true,
      run: () => router.push(`/tasks/${task._id}`),
    }));

    const navigation: Command[] = NAV_SECTIONS.map((section) => ({
      id: `nav-${section.href}`,
      label: `Go to ${section.label}`,
      hint: section.description,
      icon: <section.icon className="w-4 h-4" />,
      run: () => router.push(section.href),
    }));

    const viewActions: Command[] = [
      {
        id: "view-list",
        label: "Switch to List view",
        hint: "View",
        icon: <ListIcon className="w-4 h-4" />,
        run: () => {
          try {
            window.localStorage.setItem("taskflow:tasks:view", "list");
          } catch {}
          window.dispatchEvent(new CustomEvent("taskflow:view", { detail: "list" }));
          router.push("/tasks");
        },
      },
      {
        id: "view-grid",
        label: "Switch to Grid view",
        hint: "View",
        icon: <GridIcon className="w-4 h-4" />,
        run: () => {
          try {
            window.localStorage.setItem("taskflow:tasks:view", "grid");
          } catch {}
          window.dispatchEvent(new CustomEvent("taskflow:view", { detail: "grid" }));
          router.push("/tasks");
        },
      },
      {
        id: "view-board",
        label: "Switch to Board view",
        hint: "View",
        icon: <BoardIcon className="w-4 h-4" />,
        run: () => {
          try {
            window.localStorage.setItem("taskflow:tasks:view", "board");
          } catch {}
          window.dispatchEvent(new CustomEvent("taskflow:view", { detail: "board" }));
          router.push("/tasks");
        },
      },
      {
        id: "density-compact",
        label: "Set density to Compact",
        hint: "Density",
        icon: <ListIcon className="w-4 h-4" />,
        run: () => {
          try {
            window.localStorage.setItem("taskflow:tasks:density", "compact");
          } catch {}
          window.dispatchEvent(new CustomEvent("taskflow:density", { detail: "compact" }));
          router.push("/tasks");
        },
      },
      {
        id: "density-comfortable",
        label: "Set density to Comfortable",
        hint: "Density",
        icon: <GridIcon className="w-4 h-4" />,
        run: () => {
          try {
            window.localStorage.setItem("taskflow:tasks:density", "comfortable");
          } catch {}
          window.dispatchEvent(new CustomEvent("taskflow:density", { detail: "comfortable" }));
          router.push("/tasks");
        },
      },
      {
        id: "filter-in-progress",
        label: "Filter: In Progress tasks",
        hint: "Filter",
        icon: <TasksIcon className="w-4 h-4" />,
        run: () => {
          window.dispatchEvent(new CustomEvent("taskflow:filter", { detail: "in_progress" }));
          router.push("/tasks");
        },
      },
      {
        id: "filter-todo",
        label: "Filter: To Do tasks",
        hint: "Filter",
        icon: <TasksIcon className="w-4 h-4" />,
        run: () => {
          window.dispatchEvent(new CustomEvent("taskflow:filter", { detail: "todo" }));
          router.push("/tasks");
        },
      },
      {
        id: "filter-completed",
        label: "Filter: Completed tasks",
        hint: "Filter",
        icon: <TasksIcon className="w-4 h-4" />,
        run: () => {
          window.dispatchEvent(new CustomEvent("taskflow:filter", { detail: "completed" }));
          router.push("/tasks");
        },
      },
    ];

    return [
      ...taskResults,
      {
        id: "new-task",
        label: "New task",
        hint: "Create a task",
        icon: <PlusIcon className="w-4 h-4" />,
        run: () => router.push("/tasks/new"),
      },
      ...viewActions,
      ...navigation,
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon:
          theme === "dark" ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />,
        run: toggleTheme,
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        icon: <KeyboardIcon className="w-4 h-4" />,
        run: () => window.dispatchEvent(new Event("taskflow:shortcuts")),
      },
    ];
  }, [router, tasks, theme, toggleTheme]);

  const visible = useMemo(
    () => commands.filter((command) => command.alwaysVisible || matches(query, command.label)),
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

  /**
   * Searches tasks server-side while the palette is open.
   *
   * The palette previously only knew about static commands, so the fastest way
   * to reach a task was to leave the palette and use the page's own search —
   * which does not exist on the ledger or wallet pages at all.
   */
  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) {
      setTasks([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const page = await api<{ todos: Todo[] }>(
          `/api/todos?search=${encodeURIComponent(term)}&limit=${TASK_RESULT_LIMIT}`,
          { signal: controller.signal }
        );
        setTasks(page.todos);
      } catch {
        // A failed lookup leaves the static commands usable; surfacing an error
        // inside a palette the user is mid-keystroke in would be noise.
        setTasks([]);
      }
    }, TASK_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

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
            placeholder="Search tasks and commands…"
            aria-label="Search tasks and commands"
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
