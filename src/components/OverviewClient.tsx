"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "@/components/shell/AppShell";
import QuickAddBar from "@/components/QuickAddBar";
import StatCard from "@/components/ui/StatCard";
import TodoCard from "@/components/TodoCard";
import Money from "@/components/ui/Money";
import EmptyState from "@/components/ui/EmptyState";
import ServiceIcon from "@/components/ui/ServiceIcon";
import { useToast } from "@/components/ui/ToastProvider";
import { api, errorMessage } from "@/lib/apiClient";
import { useServerData } from "@/hooks/useServerData";
import { isPastDue } from "@/lib/dueDate";
import type { Todo, TaskService } from "@/lib/types";
import { SERVICE_LABELS, SERVICE_SHORT_LABELS, SERVICE_COLORS } from "@/lib/types";
import type { CreateTodoInput, TodoStatus } from "@/lib/schemas/todo";
import {
  TasksIcon,
  AlertIcon,
  CheckIcon,
  PlusIcon,
  ChevronRightIcon,
  CashIcon,
} from "@/components/ui/icons";

interface OverviewClientProps {
  initialTodos: Todo[];
  taskCounts: Record<string, number>;
}

export default function OverviewClient({
  initialTodos,
  taskCounts,
}: OverviewClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const toast = useToast();

  const [todos, setTodos] = useServerData<Todo[]>(initialTodos);
  const [counts, setCounts] = useState<Record<string, number>>(taskCounts);
  /** Cards whose status change is still in flight, so each can show a spinner. */
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const userName = session?.user?.name ? session.user.name.split(" ")[0] : "there";

  // Task tallies
  const todoCount = counts.todo ?? 0;
  const inProgressCount = counts.in_progress ?? 0;
  const completedCount = counts.completed ?? 0;
  const activeCount = todoCount + inProgressCount;

  /* Every open task for prioritized cards */
  const activeTasks = useMemo(
    () => todos.filter((t) => t.status !== "completed" && t.status !== "canceled"),
    [todos]
  );

  const overdueCount = useMemo(() => {
    return todos.filter(
      (t) => t.status !== "completed" && t.status !== "canceled" && t.dueDate && isPastDue(t.dueDate)
    ).length;
  }, [todos]);

  // Billing statistics from tasks
  const billingStats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    for (const todo of todos) {
      if (todo.paymentAmountMinor != null) {
        totalInvoiced += todo.paymentAmountMinor;
      }
      if (todo.paidAmountMinor != null) {
        totalPaid += todo.paidAmountMinor;
      }
    }
    const totalDue = Math.max(0, totalInvoiced - totalPaid);
    const percent = totalInvoiced > 0 ? Math.min(100, Math.round((totalPaid / totalInvoiced) * 100)) : 100;
    return { totalInvoiced, totalPaid, totalDue, percent };
  }, [todos]);

  // Service distribution among active tasks
  const serviceDistribution = useMemo(() => {
    const countsMap = new Map<TaskService, number>();
    for (const task of activeTasks) {
      for (const s of task.services) {
        countsMap.set(s, (countsMap.get(s) ?? 0) + 1);
      }
    }
    return Array.from(countsMap.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeTasks]);

  // Quick task creation
  const handleQuickAdd = async (
    input: Pick<CreateTodoInput, "title" | "priority"> & { dueDate: Date | null }
  ) => {
    try {
      const created = await api<Todo>("/api/todos", {
        method: "POST",
        body: {
          title: input.title,
          priority: input.priority,
          dueDate: input.dueDate,
          images: [],
        },
      });

      setTodos((current) => [created, ...current]);
      setCounts((curr) => ({ ...curr, todo: (curr.todo ?? 0) + 1 }));
      toast.success("Task added.");
    } catch (caught: unknown) {
      toast.error(errorMessage(caught));
      throw caught;
    }
  };

  const changeTaskStatus = async (id: string, status: TodoStatus) => {
    const task = todos.find((t) => t._id === id);
    if (!task || task.status === status) return;

    const previousTodos = todos;
    const previousStatus = task.status;

    setTodos((current) => {
      const updated = { ...task, status, updatedAt: new Date().toISOString() };
      return [updated, ...current.filter((t) => t._id !== id)];
    });
    setCounts((curr) => ({
      ...curr,
      [previousStatus]: Math.max(0, (curr[previousStatus] ?? 1) - 1),
      [status]: (curr[status] ?? 0) + 1,
    }));
    setPendingIds((curr) => new Set(curr).add(id));

    try {
      const updated = await api<Todo>(`/api/todos/${id}`, { method: "PATCH", body: { status } });
      setTodos((current) => [updated, ...current.filter((t) => t._id !== id)]);
      toast.success(
        status === "completed"
          ? "Task completed."
          : status === "canceled"
            ? "Task canceled."
            : "Task updated."
      );
    } catch (caught: unknown) {
      setTodos(previousTodos);
      setCounts((curr) => ({
        ...curr,
        [previousStatus]: (curr[previousStatus] ?? 0) + 1,
        [status]: Math.max(0, (curr[status] ?? 1) - 1),
      }));
      toast.error(errorMessage(caught));
    } finally {
      setPendingIds((curr) => {
        const next = new Set(curr);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <AppShell workspace="Overview">
      {/* ── Welcome Header ──────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display">Hello, {userName}</h1>
          <p className="text-sm mt-1 text-ink-secondary">
            Here is your task workflow, subtask progress, and active desk operations today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/tasks" className="btn-ghost h-9 px-3 text-xs">
            <TasksIcon className="w-4 h-4" />
            <span>All tasks</span>
          </Link>
        </div>
      </div>

      {/* ── Quick Add Bar ────────────────────────────────────────────────── */}
      <div className="mb-6">
        <QuickAddBar
          onCreate={handleQuickAdd}
          onExpand={(draft) => router.push(`/tasks/new${draft ? `?title=${encodeURIComponent(draft)}` : ""}`)}
        />
      </div>

      {/* ── Top Metric Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-stagger">
        <StatCard
          feature
          icon={<TasksIcon className="w-5 h-5" />}
          label="Active Tasks"
          value={<span className="text-2xl font-bold text-ink">{activeCount}</span>}
          hint={`${todoCount} to-do · ${inProgressCount} in progress`}
          color="var(--accent)"
          onClick={() => router.push("/tasks")}
        />

        <StatCard
          icon={<AlertIcon className="w-5 h-5" />}
          label="Attention Needed"
          value={<span className="text-2xl font-bold text-ink">{overdueCount}</span>}
          hint={overdueCount > 0 ? `${overdueCount} overdue deadline${overdueCount === 1 ? "" : "s"}` : "All deadlines on track"}
          color={overdueCount > 0 ? "var(--red)" : "var(--green)"}
          onClick={() => router.push("/tasks")}
        />

        <StatCard
          icon={<CheckIcon className="w-5 h-5" />}
          label="Completed"
          value={<span className="text-2xl font-bold text-ink">{completedCount}</span>}
          hint="Finished workflow tasks"
          color="var(--green)"
          onClick={() => router.push("/tasks")}
        />

        <StatCard
          icon={<CashIcon className="w-5 h-5" />}
          label="Task Billings"
          value={<Money minor={billingStats.totalInvoiced} size="lg" tone="neutral" />}
          hint={`৳${(billingStats.totalPaid / 100).toLocaleString()} paid · ৳${(billingStats.totalDue / 100).toLocaleString()} due`}
          color="var(--yellow)"
          onClick={() => router.push("/tasks")}
        />
      </div>

      {/* ── Main Layout: Tasks + Desk Operations ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left 2 Cols: Priorities & Up Next ──────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-section">Priorities & Up Next</h2>
                <span className="pill bg-sunken text-ink-muted text-xs font-semibold">
                  {activeTasks.length}
                </span>
              </div>
              <Link
                href="/tasks"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                View all tasks
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activeTasks.length === 0 ? (
              <EmptyState
                icon={<CheckIcon className="w-6 h-6" />}
                title="All caught up!"
                description="You have no pending tasks. Use the quick-add bar above to plan your next work."
                action={
                  <Link href="/tasks/new" className="btn-primary h-8 px-3 text-xs">
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Create task</span>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 animate-stagger">
                {activeTasks.map((task, index) => (
                  <div
                    key={task._id}
                    className="animate-fade-in-up flex"
                    style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                  >
                    <TodoCard
                      todo={task}
                      onView={(item) => router.push(`/tasks/${item._id}`)}
                      onEdit={(item) => router.push(`/tasks/${item._id}/edit`)}
                      onStatusChange={changeTaskStatus}
                      pending={pendingIds.has(task._id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right Col: Desk Services & Financial Status ──────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Services Active */}
          <section className="panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section">Active Services</h2>
              <span className="text-xs text-ink-muted">
                {serviceDistribution.length} active catalogue
              </span>
            </div>

            {serviceDistribution.length === 0 ? (
              <p className="text-sm text-ink-muted py-2">No active service subtasks.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {serviceDistribution.map(({ service, count }) => (
                  <div
                    key={service}
                    className="p-2.5 rounded-card border border-line bg-card flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-7 h-7 rounded-well flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `color-mix(in srgb, ${SERVICE_COLORS[service]} 16%, transparent)`,
                          color: SERVICE_COLORS[service],
                        }}
                      >
                        <ServiceIcon service={service} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">
                          {SERVICE_LABELS[service]}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {SERVICE_SHORT_LABELS[service]}
                        </p>
                      </div>
                    </div>

                    <span className="pill bg-sunken text-xs font-semibold px-2">
                      {count} {count === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Billing & Installments Overview */}
          <section className="panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section">Payment Collection</h2>
              <span className="text-xs font-semibold text-accent">
                {billingStats.percent}% paid
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {/* Progress bar */}
              <div className="w-full bg-sunken rounded-full h-2 overflow-hidden">
                <div
                  className="bg-accent h-full rounded-full transition-all duration-500"
                  style={{ width: `${billingStats.percent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/50">
                <div>
                  <p className="text-xs text-ink-muted">Total Invoiced</p>
                  <p className="text-sm font-bold text-ink mt-0.5">
                    <Money minor={billingStats.totalInvoiced} size="sm" tone="neutral" />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Remaining Balance</p>
                  <p className="text-sm font-bold text-yellow-ink mt-0.5">
                    <Money minor={billingStats.totalDue} size="sm" tone="auto" />
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
