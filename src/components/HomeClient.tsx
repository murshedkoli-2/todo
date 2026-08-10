"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Todo, getDisplayStatus, STATUS_LABELS, STATUS_COLORS, DisplayStatus,
} from "@/lib/types";
import type { TodoStatus } from "@/lib/schemas/todo";
import { api, errorMessage } from "@/lib/apiClient";
import AppShell from "@/components/shell/AppShell";
import TodoCard from "@/components/TodoCard";
import TaskBoard from "@/components/TaskBoard";
import FocusCard from "@/components/FocusCard";
import PageToolbar, { SortOption } from "@/components/ui/PageToolbar";
import SegmentedToggle, { Segment } from "@/components/ui/SegmentedToggle";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import {
  TasksIcon, ClockIcon, CheckIcon, AlertIcon, PlusIcon, GridIcon, BoardIcon,
} from "@/components/ui/icons";

interface HomeClientProps {
  initialTodos: Todo[];
}

type SortKey = "newest" | "oldest" | "due" | "title";
type ViewMode = "grid" | "board";

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "due", label: "Due date" },
  { value: "title", label: "Title" },
];

const VIEW_SEGMENTS: Segment<ViewMode>[] = [
  { value: "grid", label: "Grid", color: "var(--accent)", icon: <GridIcon className="w-3.5 h-3.5" /> },
  { value: "board", label: "Board", color: "var(--accent)", icon: <BoardIcon className="w-3.5 h-3.5" /> },
];

const STAT_ORDER: DisplayStatus[] = ["todo", "in_progress", "completed", "overdue"];

const STAT_ICONS: Record<DisplayStatus, React.ReactNode> = {
  todo: <TasksIcon className="w-5 h-5" />,
  in_progress: <ClockIcon className="w-5 h-5" />,
  completed: <CheckIcon className="w-5 h-5" />,
  overdue: <AlertIcon className="w-5 h-5" />,
};

/** Sorts a copy so the source list stays untouched. */
function sortTodos(todos: Todo[], key: SortKey): Todo[] {
  const byNewest = (a: Todo, b: Todo) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  switch (key) {
    case "oldest":
      return [...todos].sort((a, b) => -byNewest(a, b));
    case "title":
      return [...todos].sort((a, b) => a.title.localeCompare(b.title));
    case "due":
      return [...todos].sort((a, b) => {
        // Undated work sinks below anything with a deadline.
        if (!a.dueDate && !b.dueDate) return byNewest(a, b);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    default:
      return [...todos].sort(byNewest);
  }
}

/** The one task worth surfacing above everything else. */
function pickFocusTask(todos: Todo[]): Todo | null {
  const open = todos.filter((todo) => todo.status !== "completed" && todo.dueDate);
  if (open.length === 0) return null;
  // Soonest deadline, overdue first — that is what "next" means here.
  return open.sort(
    (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
  )[0]!;
}

export default function HomeClient({ initialTodos }: HomeClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const counts = useMemo(() => {
    const tally: Record<DisplayStatus, number> = {
      todo: 0, in_progress: 0, completed: 0, overdue: 0,
    };
    for (const todo of todos) tally[getDisplayStatus(todo)] += 1;
    return tally;
  }, [todos]);

  const focusTask = useMemo(() => pickFocusTask(todos), [todos]);

  const visibleTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = todos.filter((todo) => {
      const status = getDisplayStatus(todo);
      // Completed work drops out of the default grid so it only shows what is
      // still open. The Completed stat card brings it back, and an active
      // search spans everything so finished tasks stay findable.
      const matchesStatus =
        statusFilter === "all"
          ? Boolean(query) || status !== "completed"
          : status === statusFilter;
      const matchesSearch =
        !query ||
        todo.title.toLowerCase().includes(query) ||
        (todo.description?.toLowerCase().includes(query) ?? false);
      return matchesStatus && matchesSearch;
    });
    return sortTodos(filtered, sortKey);
  }, [todos, search, statusFilter, sortKey]);

  /* The board shows every column, so it must not have completed work filtered
     out from under it — only search and the explicit filter apply. */
  const boardTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return todos.filter(
      (todo) =>
        !query ||
        todo.title.toLowerCase().includes(query) ||
        (todo.description?.toLowerCase().includes(query) ?? false)
    );
  }, [todos, search]);

  const allCaughtUp =
    statusFilter === "all" && !search.trim() && visibleTodos.length === 0 && counts.completed > 0;

  /**
   * Applies the new status immediately and rolls back if the request fails.
   *
   * The previous version awaited the response before touching state, so every
   * status change froze the card for a round trip; a failure was reported in a
   * banner at the top of the page the user had usually scrolled past.
   */
  const handleStatusChange = useCallback(
    async (id: string, status: TodoStatus) => {
      const previous = todos.find((todo) => todo._id === id);
      if (!previous || previous.status === status) return;

      setTodos((current) =>
        current.map((todo) => (todo._id === id ? { ...todo, status } : todo))
      );
      setPendingIds((current) => new Set(current).add(id));

      try {
        const updated = await api<Todo>(`/api/todos/${id}`, {
          method: "PATCH",
          body: { status },
        });
        setTodos((current) =>
          current.map((todo) => (todo._id === id ? updated : todo))
        );
      } catch (error) {
        setTodos((current) =>
          current.map((todo) => (todo._id === id ? previous : todo))
        );
        toast.error(errorMessage(error));
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    },
    [todos, toast]
  );

  const openTask = useCallback(
    (todo: Todo) => router.push(`/tasks/${todo._id}`),
    [router]
  );

  return (
    <AppShell workspace="My Workspace">
      <PageToolbar
        title="Tasks"
        count={view === "board" ? boardTodos.length : visibleTodos.length}
        subtitle={
          view === "grid" && statusFilter === "all" && !search.trim() && counts.completed > 0
            ? `${counts.completed} completed task${counts.completed === 1 ? "" : "s"} hidden — open the Completed card to see ${counts.completed === 1 ? "it" : "them"}.`
            : undefined
        }
        searchValue={search}
        searchPlaceholder="Search tasks…"
        onSearchChange={setSearch}
        sortOptions={view === "grid" ? SORT_OPTIONS : undefined}
        sortValue={sortKey}
        onSortChange={(value) => setSortKey(value as SortKey)}
        actions={
          <>
            <div className="w-[168px] flex-shrink-0">
              <SegmentedToggle
                segments={VIEW_SEGMENTS}
                value={view}
                onChange={setView}
                ariaLabel="Task view"
              />
            </div>
            <button
              onClick={() => router.push("/tasks/new")}
              className="btn-secondary flex-shrink-0"
              id="create-todo-btn"
            >
              <PlusIcon className="w-4 h-4" />
              New task
            </button>
          </>
        }
      />

      {/*
        Bento first row: the single next-due task gets the wide cell, the four
        status tallies share the rest. Previously four equal cards sat above the
        board with nothing distinguishing what mattered.
      */}
      {todos.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 mb-7">
          {focusTask && (
            <div className="xl:col-span-1">
              <FocusCard todo={focusTask} onOpen={openTask} />
            </div>
          )}

          <div
            className={`grid grid-cols-2 gap-3 sm:gap-4 ${
              focusTask ? "xl:col-span-2" : "xl:col-span-3 xl:grid-cols-4"
            }`}
          >
            {STAT_ORDER.map((status) => (
              <StatCard
                key={status}
                icon={STAT_ICONS[status]}
                color={STATUS_COLORS[status]}
                label={STATUS_LABELS[status]}
                value={
                  <span className="text-2xl font-bold tabular-nums leading-none tracking-tight text-ink">
                    {counts[status]}
                  </span>
                }
                hint={`${Math.round((counts[status] / todos.length) * 100)}% of all tasks`}
                progress={(counts[status] / todos.length) * 100}
                active={statusFilter === status}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              />
            ))}
          </div>
        </div>
      )}

      {view === "board" ? (
        boardTodos.length === 0 ? (
          <EmptyState
            icon={<BoardIcon className="w-9 h-9" />}
            title={todos.length === 0 ? "No tasks yet" : "Nothing matches that"}
            description={
              todos.length === 0
                ? "Create your first task and start tracking your work."
                : "Try a different search term."
            }
            action={
              todos.length === 0 ? (
                <button onClick={() => router.push("/tasks/new")} className="btn-primary px-6">
                  <PlusIcon className="w-4 h-4" />
                  Create first task
                </button>
              ) : (
                <button onClick={() => setSearch("")} className="btn-outline">
                  Clear search
                </button>
              )
            }
          />
        ) : (
          <TaskBoard
            todos={boardTodos}
            onView={openTask}
            onStatusChange={handleStatusChange}
            pendingIds={pendingIds}
          />
        )
      ) : visibleTodos.length === 0 ? (
        <EmptyState
          icon={allCaughtUp ? <CheckIcon className="w-9 h-9" /> : <TasksIcon className="w-9 h-9" />}
          title={
            todos.length === 0
              ? "No tasks yet"
              : allCaughtUp
              ? "You're all caught up"
              : "Nothing matches that"
          }
          description={
            todos.length === 0
              ? "Create your first task and start tracking your work."
              : allCaughtUp
              ? `Nothing open right now. All ${counts.completed} of your tasks are done.`
              : "Try a different search term, or clear the active status filter."
          }
          action={
            todos.length === 0 ? (
              <button onClick={() => router.push("/tasks/new")} className="btn-primary px-6">
                <PlusIcon className="w-4 h-4" />
                Create first task
              </button>
            ) : allCaughtUp ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => router.push("/tasks/new")} className="btn-primary px-6">
                  <PlusIcon className="w-4 h-4" />
                  New task
                </button>
                <button onClick={() => setStatusFilter("completed")} className="btn-outline">
                  View completed
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="btn-outline"
              >
                Clear filters
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {visibleTodos.map((todo, index) => (
            <div
              key={todo._id}
              className="animate-fade-in-up flex"
              style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
            >
              <TodoCard
                todo={todo}
                onView={openTask}
                onEdit={(item) => router.push(`/tasks/${item._id}/edit`)}
                onStatusChange={handleStatusChange}
                pending={pendingIds.has(todo._id)}
              />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
