"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Todo, getDisplayStatus, STATUS_LABELS, DisplayStatus, PRIORITY_RANK,
} from "@/lib/types";
import { tallyByStatus } from "@/lib/taskInsights";
import type { TodoPriority, TodoStatus } from "@/lib/schemas/todo";
import { api, errorMessage } from "@/lib/apiClient";
import AppShell from "@/components/shell/AppShell";
import TodoCard from "@/components/TodoCard";
import TaskBoard from "@/components/TaskBoard";
import TaskList from "@/components/TaskList";
import QuickAddBar, { QuickAddHandle } from "@/components/QuickAddBar";
import PageToolbar, { SortOption } from "@/components/ui/PageToolbar";
import SegmentedToggle, { Segment } from "@/components/ui/SegmentedToggle";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { useHotkeys } from "@/hooks/useHotkeys";
import { usePersistentState } from "@/hooks/usePersistentState";
import { TasksIcon, CheckIcon, PlusIcon, GridIcon, BoardIcon, ListIcon } from "@/components/ui/icons";

interface TasksClientProps {
  initialTodos: Todo[];
}

type SortKey = "priority" | "newest" | "oldest" | "due" | "title";
type ViewMode = "list" | "grid" | "board";

/* Typed against the union rather than `string`, so adding an option the sort
   function cannot handle is a compile error rather than a silent no-op. */
const SORT_OPTIONS: ReadonlyArray<SortOption & { value: SortKey }> = [
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title" },
];

const VIEW_SEGMENTS: ReadonlyArray<Segment<ViewMode>> = [
  { value: "list", label: "List", color: "var(--accent)", icon: <ListIcon className="w-3.5 h-3.5" /> },
  { value: "grid", label: "Grid", color: "var(--accent)", icon: <GridIcon className="w-3.5 h-3.5" /> },
  { value: "board", label: "Board", color: "var(--accent)", icon: <BoardIcon className="w-3.5 h-3.5" /> },
];

const SORT_KEYS: readonly string[] = SORT_OPTIONS.map((option) => option.value);
const VIEW_MODES: readonly string[] = VIEW_SEGMENTS.map((segment) => segment.value);

const isSortKey = (value: string): value is SortKey => SORT_KEYS.includes(value);
const isViewMode = (value: string): value is ViewMode => VIEW_MODES.includes(value);

/** Filter chips, in the order work moves through them. */
const FILTERS: ReadonlyArray<"all" | DisplayStatus> = [
  "all", "todo", "in_progress", "completed", "overdue",
];

/** Sorts a copy so the source list stays untouched. */
function sortTodos(todos: Todo[], key: SortKey): Todo[] {
  const byNewest = (a: Todo, b: Todo) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const byDue = (a: Todo, b: Todo) => {
    // Undated work sinks below anything with a deadline.
    if (!a.dueDate && !b.dueDate) return byNewest(a, b);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  };

  switch (key) {
    case "oldest":
      return [...todos].sort((a, b) => -byNewest(a, b));
    case "title":
      return [...todos].sort((a, b) => a.title.localeCompare(b.title));
    case "due":
      return [...todos].sort(byDue);
    case "priority":
      // Urgent first, then the nearest deadline within a level — priority alone
      // would leave a dozen "high" tasks in arbitrary order, which is not a
      // triage order at all.
      return [...todos].sort(
        (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || byDue(a, b)
      );
    default:
      return [...todos].sort(byNewest);
  }
}

export default function TasksClient({ initialTodos }: TasksClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  /* View and sort are preferences, not page state: they survive navigating to
     a task and back. */
  const [sortKey, setSortKey] = usePersistentState<SortKey>(
    "taskflow:tasks:sort", "priority", isSortKey
  );
  const [view, setView] = usePersistentState<ViewMode>(
    "taskflow:tasks:view", "list", isViewMode
  );
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const quickAddRef = useRef<QuickAddHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /*
   * `changeStatus` reads the task list through this rather than closing over
   * `todos` directly. The undo action lives inside a toast that outlives the
   * render that created it: with a captured list, undo looked up the task in
   * its pre-change state, found the status it was being asked to restore
   * already set, and returned without doing anything.
   */
  const todosRef = useRef(todos);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const counts = useMemo(() => tallyByStatus(todos), [todos]);

  const visibleTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = todos.filter((todo) => {
      const status = getDisplayStatus(todo);
      // Completed work drops out of the default view so it only shows what is
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

  const setPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Applies the new status immediately and rolls back if the request fails.
   *
   * `silent` suppresses the undo toast for the reverting call itself —
   * otherwise undoing raises a toast offering to undo the undo, which is a
   * loop rather than a safety net.
   */
  const changeStatus = useCallback(
    async (id: string, status: TodoStatus, { silent = false } = {}) => {
      const previous = todosRef.current.find((todo) => todo._id === id);
      if (!previous || previous.status === status) return;

      setTodos((current) =>
        current.map((todo) => (todo._id === id ? { ...todo, status } : todo))
      );
      setPending(id, true);

      try {
        const updated = await api<Todo>(`/api/todos/${id}`, {
          method: "PATCH",
          body: { status },
        });
        setTodos((current) => current.map((todo) => (todo._id === id ? updated : todo)));

        if (!silent) {
          toast.toast(
            status === "completed"
              ? `“${truncate(previous.title)}” completed`
              : `“${truncate(previous.title)}” moved to ${STATUS_LABELS[status]}`,
            "success",
            {
              label: "Undo",
              onClick: () => void changeStatus(id, previous.status, { silent: true }),
            }
          );
        }
      } catch (error) {
        setTodos((current) => current.map((todo) => (todo._id === id ? previous : todo)));
        toast.error(errorMessage(error));
      } finally {
        setPending(id, false);
      }
    },
    [toast, setPending]
  );

  const handleStatusChange = useCallback(
    (id: string, status: TodoStatus) => void changeStatus(id, status),
    [changeStatus]
  );

  const handleQuickAdd = useCallback(
    async (input: { title: string; priority: TodoPriority; dueDate: Date | null }) => {
      const created = await api<Todo>("/api/todos", {
        method: "POST",
        body: {
          title: input.title,
          priority: input.priority,
          dueDate: input.dueDate ? input.dueDate.toISOString() : null,
        },
      }).catch((error) => {
        toast.error(errorMessage(error));
        // Rethrown so the bar keeps the draft rather than clearing it.
        throw error;
      });

      setTodos((current) => [created, ...current]);
    },
    [toast]
  );

  const openTask = useCallback(
    (todo: Todo) => router.push(`/tasks/${todo._id}`),
    [router]
  );

  useHotkeys(
    useMemo(
      () => [
        { keys: "n", handler: () => quickAddRef.current?.focus() },
        { keys: "/", handler: () => searchRef.current?.focus() },
      ],
      []
    )
  );

  const listCount = view === "board" ? boardTodos.length : visibleTodos.length;

  return (
    <AppShell workspace="My Workspace">
      <PageToolbar
        title="Tasks"
        count={listCount}
        searchRef={searchRef}
        subtitle={
          view !== "board" && statusFilter === "all" && !search.trim() && counts.completed > 0
            ? `${counts.completed} completed task${counts.completed === 1 ? "" : "s"} hidden — open the Completed card to see ${counts.completed === 1 ? "it" : "them"}.`
            : undefined
        }
        searchValue={search}
        searchPlaceholder="Search tasks…"
        onSearchChange={setSearch}
        sortOptions={view === "board" ? undefined : SORT_OPTIONS}
        sortValue={sortKey}
        onSortChange={(value) => setSortKey(value as SortKey)}
        actions={
          <>
            <div className="w-[228px] flex-shrink-0">
              <SegmentedToggle
                segments={VIEW_SEGMENTS}
                value={view}
                onChange={setView}
                ariaLabel="Task view"
              />
            </div>
            <button
              onClick={() => router.push("/tasks/new")}
              className="btn-outline flex-shrink-0"
              id="create-todo-btn"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Full form</span>
            </button>
          </>
        }
      />

      {/*
        Status filter. The four stat cards used to carry this, which meant the
        only way to filter was through a block of dashboard furniture the page
        did not otherwise need. The overview owns the tallies now; what belongs
        here is the control.
      */}
      {todos.length > 0 && view !== "board" && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 mb-5"
          role="group"
          aria-label="Filter by status"
        >
          {FILTERS.map((filter) => {
            const active = statusFilter === filter;
            const count = filter === "all" ? todos.length : counts[filter];
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className="chip"
                data-active={active}
                aria-pressed={active}
              >
                {filter === "all" ? "All" : STATUS_LABELS[filter]}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Capture sits above everything: adding work is the primary verb here. */}
      <div className="mb-6">
        <QuickAddBar
          ref={quickAddRef}
          onCreate={handleQuickAdd}
          onExpand={(draftTitle) =>
            router.push(
              draftTitle
                ? `/tasks/new?title=${encodeURIComponent(draftTitle)}`
                : "/tasks/new"
            )
          }
        />
      </div>

      {view === "board" ? (
        boardTodos.length === 0 ? (
          <EmptyState
            icon={<BoardIcon className="w-9 h-9" />}
            title={todos.length === 0 ? "No tasks yet" : "Nothing matches that"}
            description={
              todos.length === 0
                ? "Add your first task in the bar above — try “Draft the proposal friday !high”."
                : "Try a different search term."
            }
            action={
              todos.length === 0 ? (
                <button onClick={() => quickAddRef.current?.focus()} className="btn-primary px-6">
                  <PlusIcon className="w-4 h-4" />
                  Add a task
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
              ? "Add your first task in the bar above — try “Draft the proposal friday !high”."
              : allCaughtUp
              ? `Nothing open right now. All ${counts.completed} of your tasks are done.`
              : "Try a different search term, or clear the active status filter."
          }
          action={
            todos.length === 0 ? (
              <button onClick={() => quickAddRef.current?.focus()} className="btn-primary px-6">
                <PlusIcon className="w-4 h-4" />
                Add a task
              </button>
            ) : allCaughtUp ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => quickAddRef.current?.focus()} className="btn-primary px-6">
                  <PlusIcon className="w-4 h-4" />
                  Add a task
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
      ) : view === "list" ? (
        <TaskList
          todos={visibleTodos}
          onView={openTask}
          onStatusChange={handleStatusChange}
          pendingIds={pendingIds}
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

/** Keeps a task title from overflowing a toast. */
function truncate(title: string, max = 32): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}
