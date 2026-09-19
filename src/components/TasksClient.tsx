"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Todo, SubtaskStatus, TaskService, getDisplayStatus, STATUS_LABELS, DisplayStatus,
  PRIORITY_RANK, formatServices, describeSubtaskFields, TASK_SERVICES, SERVICE_LABELS,
  SERVICE_SHORT_LABELS, PAYMENT_STATUS_LABELS,
} from "@/lib/types";
import { redactSecrets } from "@/lib/subtasks";
import { countOverdue, tallyByStatus } from "@/lib/taskInsights";
import type { TodoPriority, TodoStatus } from "@/lib/schemas/todo";
import { api, errorMessage } from "@/lib/apiClient";
import AppShell from "@/components/shell/AppShell";
import TodoCard from "@/components/TodoCard";
import TaskBoard from "@/components/TaskBoard";
import TaskList from "@/components/TaskList";
import TaskDrawer from "@/components/task/TaskDrawer";
import QuickAddBar, { QuickAddHandle } from "@/components/QuickAddBar";
import PageToolbar, { SortOption } from "@/components/ui/PageToolbar";
import SegmentedToggle, { Segment } from "@/components/ui/SegmentedToggle";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { useHotkeys } from "@/hooks/useHotkeys";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useServerData } from "@/hooks/useServerData";
import {
  TasksIcon, CheckIcon, PlusIcon, GridIcon, BoardIcon, ListIcon,
  ChevronDownIcon, CloseIcon,
} from "@/components/ui/icons";

interface TasksClientProps {
  initialTodos: Todo[];
}

type SortKey = "recent" | "priority" | "due" | "newest" | "oldest" | "title";
type ViewMode = "list" | "grid" | "board";

/* Typed against the union rather than `string`, so adding an option the sort
   function cannot handle is a compile error rather than a silent no-op. */
const SORT_OPTIONS: ReadonlyArray<SortOption & { value: SortKey }> = [
  { value: "recent", label: "Recently added / edited" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "Due date" },
  { value: "newest", label: "Creation date" },
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
  "all", "todo", "in_progress", "completed", "canceled", "overdue",
];


/**
 * The text of a task that a search may look inside.
 *
 * Services are matched by their *label*, not their stored key: someone looking
 * for passport work types "passport", not "new_passport". Sub-task values are
 * included because a document number is often the only thing the caller on the
 * phone can give you — but they come from `describeSubtaskFields`, which masks
 * credentials, so a password is never matchable and never assembled into a
 * string that could end up in a log or a URL.
 */
function searchableText(todo: Todo): string {
  const fields = todo.subtasks
    .flatMap((subtask) => describeSubtaskFields(subtask))
    .filter((field) => !field.secret)
    .map((field) => field.value);

  return [
    todo.title,
    todo.description ?? "",
    formatServices(todo.services),
    ...fields,
  ].join(" ").toLowerCase();
}

/** Sorts a copy so the source list stays untouched. */
function sortTodos(todos: Todo[], key: SortKey): Todo[] {
  const byRecent = (a: Todo, b: Todo) => {
    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
    return timeB - timeA || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  };

  const byNewest = (a: Todo, b: Todo) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const byDue = (a: Todo, b: Todo) => {
    // Undated work sinks below anything with a deadline.
    if (!a.dueDate && !b.dueDate) return byRecent(a, b);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  };

  switch (key) {
    case "oldest":
      return [...todos].sort((a, b) => -byNewest(a, b));
    case "newest":
      return [...todos].sort(byNewest);
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
    case "recent":
    default:
      return [...todos].sort(byRecent);
  }
}

type DensityMode = "comfortable" | "compact";
const isDensityMode = (v: string): v is DensityMode => v === "comfortable" || v === "compact";

export default function TasksClient({ initialTodos }: TasksClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [todos, setTodos] = useServerData<Todo[]>(initialTodos);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [serviceFilter, setServiceFilter] = useState<"all" | TaskService>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [drawerTodo, setDrawerTodo] = useState<Todo | null>(null);

  /* View, sort, and density are preferences that survive navigation */
  const [sortKey, setSortKey] = usePersistentState<SortKey>(
    "taskflow:tasks:sort", "recent", isSortKey
  );
  const [view, setView] = usePersistentState<ViewMode>(
    "taskflow:tasks:view", "list", isViewMode
  );
  const [density, setDensity] = usePersistentState<DensityMode>(
    "taskflow:tasks:density", "comfortable", isDensityMode
  );
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const quickAddRef = useRef<QuickAddHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const drawerTodoId = drawerTodo?._id;
  useEffect(() => {
    if (drawerTodoId) {
      const current = todos.find((t) => t._id === drawerTodoId);
      if (current) setDrawerTodo(current);
    }
  }, [todos, drawerTodoId]);

  /* Listen to external command palette actions */
  useEffect(() => {
    const handleView = (e: Event) => {
      const detail = (e as CustomEvent<ViewMode>).detail;
      if (detail && isViewMode(detail)) setView(detail);
    };
    const handleDensity = (e: Event) => {
      const detail = (e as CustomEvent<DensityMode>).detail;
      if (detail && isDensityMode(detail)) setDensity(detail);
    };
    const handleFilter = (e: Event) => {
      const detail = (e as CustomEvent<DisplayStatus | "all">).detail;
      if (detail && FILTERS.includes(detail)) setStatusFilter(detail);
    };
    window.addEventListener("taskflow:view", handleView);
    window.addEventListener("taskflow:density", handleDensity);
    window.addEventListener("taskflow:filter", handleFilter);
    return () => {
      window.removeEventListener("taskflow:view", handleView);
      window.removeEventListener("taskflow:density", handleDensity);
      window.removeEventListener("taskflow:filter", handleFilter);
    };
  }, [setView, setDensity, setStatusFilter]);

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
  const overdueCount = useMemo(() => countOverdue(todos), [todos]);

  const visibleTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = todos.filter((todo) => {
      const status = getDisplayStatus(todo);
      const matchesStatus =
        statusFilter === "all"
          ? Boolean(query) || (status !== "completed" && status !== "canceled")
          : status === statusFilter;
      const matchesSearch = !query || searchableText(todo).includes(query);
      const matchesService = serviceFilter === "all" || todo.services.includes(serviceFilter);
      const matchesPayment = paymentFilter === "all" || todo.paymentStatus === paymentFilter;
      return matchesStatus && matchesSearch && matchesService && matchesPayment;
    });
    return sortTodos(filtered, sortKey);
  }, [todos, search, statusFilter, serviceFilter, paymentFilter, sortKey]);

  /* The board shows every column, so it must not have completed work filtered
     out from under it — only search, service, and payment filter apply. */
  const boardTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return todos.filter((todo) => {
      const matchesSearch = !query || searchableText(todo).includes(query);
      const matchesService = serviceFilter === "all" || todo.services.includes(serviceFilter);
      const matchesPayment = paymentFilter === "all" || todo.paymentStatus === paymentFilter;
      return matchesSearch && matchesService && matchesPayment;
    });
  }, [todos, search, serviceFilter, paymentFilter]);

  const hasActiveFilters =
    serviceFilter !== "all" || paymentFilter !== "all" || (statusFilter !== "all" && view !== "board") || Boolean(search.trim());

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setServiceFilter("all");
    setPaymentFilter("all");
  }, []);

  const allCaughtUp =
    statusFilter === "all" && serviceFilter === "all" && paymentFilter === "all" && !search.trim() && visibleTodos.length === 0 && counts.completed > 0;

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
              : status === "canceled"
                ? `“${truncate(previous.title)}” canceled`
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
    // `setTodos` comes from `useServerData` rather than `useState` directly, so
    // the linter cannot see that it is a stable setter and asks for it here.
    // Listing it is honest and costs nothing: the identity never changes, so
    // the callback is not rebuilt.
    [toast, setPending, setTodos]
  );

  const handleStatusChange = useCallback(
    (id: string, status: TodoStatus) => void changeStatus(id, status),
    [changeStatus]
  );

  /**
   * Moves one leg of a task along from the list.
   *
   * Not optimistic, unlike a status change: the change can complete the task
   * outright — the checklist drives the status, see `lib/taskStatus.ts` — and
   * guessing at that here would mean reimplementing the derivation in the
   * client and having the row flicker whenever the two disagreed. The response
   * carries the settled task.
   *
   * That response comes from the single-task endpoint, so it still holds any
   * credential the task captured. This page is a list and holds fifty tasks;
   * running the reply back through the same redaction the list endpoint applies
   * keeps the invariant that a password never lives in list state, whatever the
   * user does here.
   */
  const setSubtaskStatus = useCallback(
    async (id: string, service: TaskService, status: SubtaskStatus) => {
      try {
        const updated = await api<Todo>(`/api/todos/${id}/subtasks/${service}`, {
          method: "PATCH",
          body: { status },
        });
        const safe: Todo = { ...updated, subtasks: redactSecrets(updated.subtasks) };
        setTodos((current) => current.map((todo) => (todo._id === id ? safe : todo)));
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [toast, setTodos]
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
    [toast, setTodos]
  );

  const openTask = useCallback(
    (todo: Todo) => setDrawerTodo(todo),
    []
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
            <div className="w-full sm:w-[228px] flex-shrink-0">
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
        Status & multi-predicate filters.
      */}
      {todos.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-5">
          {view !== "board" && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1"
              role="group"
              aria-label="Filter by status"
            >
              {FILTERS.map((filter) => {
                const active = statusFilter === filter;
                const count =
                  filter === "all"
                    ? todos.length
                    : filter === "overdue"
                      ? overdueCount
                      : counts[filter];
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

          {/* Secondary filter selectors and density toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/50">
            <div className="flex flex-wrap items-center gap-2">
              {/* Service filter */}
              <div className="relative">
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value as "all" | TaskService)}
                  className="input-dark !h-8 !py-0 pl-2.5 pr-7 text-xs font-semibold rounded-control bg-surface border-line cursor-pointer appearance-none"
                  aria-label="Filter by service"
                >
                  <option value="all">All Services</option>
                  {TASK_SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {SERVICE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
              </div>

              {/* Payment filter */}
              <div className="relative">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as "all" | "unpaid" | "partial" | "paid")}
                  className="input-dark !h-8 !py-0 pl-2.5 pr-7 text-xs font-semibold rounded-control bg-surface border-line cursor-pointer appearance-none"
                  aria-label="Filter by payment"
                >
                  <option value="all">All Payments</option>
                  <option value="unpaid">{PAYMENT_STATUS_LABELS.unpaid}</option>
                  <option value="partial">{PAYMENT_STATUS_LABELS.partial}</option>
                  <option value="paid">{PAYMENT_STATUS_LABELS.paid}</option>
                </select>
                <ChevronDownIcon className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
              </div>

              {/* Active filter badges and Clear all */}
              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {serviceFilter !== "all" && (
                    <span className="pill text-xs gap-1 bg-accent-soft text-accent-ink font-semibold">
                      Service: {SERVICE_SHORT_LABELS[serviceFilter]}
                      <button
                        type="button"
                        onClick={() => setServiceFilter("all")}
                        className="hover:opacity-75 focus:outline-none"
                        aria-label="Remove service filter"
                      >
                        <CloseIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {paymentFilter !== "all" && (
                    <span className="pill text-xs gap-1 bg-yellow-soft text-yellow-ink font-semibold">
                      Payment: {PAYMENT_STATUS_LABELS[paymentFilter]}
                      <button
                        type="button"
                        onClick={() => setPaymentFilter("all")}
                        className="hover:opacity-75 focus:outline-none"
                        aria-label="Remove payment filter"
                      >
                        <CloseIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs text-accent font-semibold hover:underline px-1 py-0.5"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Density toggle */}
            {view !== "board" && (
              <div className="flex items-center gap-1 bg-sunken p-0.5 rounded-control flex-shrink-0 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDensity("comfortable")}
                  className={`px-2.5 py-1 rounded-[5px] transition-colors ${
                    density === "comfortable" ? "bg-surface shadow-xs text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                  aria-pressed={density === "comfortable"}
                >
                  Cozy
                </button>
                <button
                  type="button"
                  onClick={() => setDensity("compact")}
                  className={`px-2.5 py-1 rounded-[5px] transition-colors ${
                    density === "compact" ? "bg-surface shadow-xs text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                  aria-pressed={density === "compact"}
                >
                  Compact
                </button>
              </div>
            )}
          </div>
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
          onSubtaskStatusChange={setSubtaskStatus}
          pendingIds={pendingIds}
          density={density}
        />
      ) : (
        <div
          className={`grid gap-4 sm:gap-5 animate-stagger ${
            density === "compact"
              ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          }`}
        >
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
                onSubtaskStatusChange={setSubtaskStatus}
                pending={pendingIds.has(todo._id)}
              />
            </div>
          ))}
        </div>
      )}

      <TaskDrawer
        todo={drawerTodo}
        open={drawerTodo !== null}
        onClose={() => setDrawerTodo(null)}
        onStatusChange={handleStatusChange}
        onSubtaskStatusChange={setSubtaskStatus}
        onEdit={(item) => router.push(`/tasks/${item._id}/edit`)}
      />
    </AppShell>
  );
}

/** Keeps a task title from overflowing a toast. */
function truncate(title: string, max = 32): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}
