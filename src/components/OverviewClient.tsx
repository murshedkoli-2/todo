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
import { useToast } from "@/components/ui/ToastProvider";
import { api, errorMessage } from "@/lib/apiClient";
import { useServerData } from "@/hooks/useServerData";
import { isPastDue } from "@/lib/dueDate";
import type { Todo, WalletAccount, LedgerPersonWithBalance } from "@/lib/types";
import type { CreateTodoInput, TodoStatus } from "@/lib/schemas/todo";
import {
  TasksIcon,
  LedgerIcon,
  WalletIcon,
  AlertIcon,
  CheckIcon,
  PlusIcon,
  ChevronRightIcon,
  CashIcon,
  PhoneIcon,
  BankIcon,
} from "@/components/ui/icons";

interface OverviewClientProps {
  initialTodos: Todo[];
  taskCounts: Record<string, number>;
  initialAccounts: WalletAccount[];
  initialPersons: LedgerPersonWithBalance[];
}

function accountIcon(type: string) {
  switch (type) {
    case "mobile_banking":
      return <PhoneIcon className="w-4 h-4" />;
    case "bank":
      return <BankIcon className="w-4 h-4" />;
    default:
      return <CashIcon className="w-4 h-4" />;
  }
}

export default function OverviewClient({
  initialTodos,
  taskCounts,
  initialAccounts,
  initialPersons,
}: OverviewClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const toast = useToast();

  const [todos, setTodos] = useServerData<Todo[]>(initialTodos);
  const [counts, setCounts] = useState<Record<string, number>>(taskCounts);
  /** Cards whose status change is still in flight, so each can show a spinner. */
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const userName = session?.user?.name ? session.user.name.split(" ")[0] : "there";

  // Financial aggregates
  const totalNetWorthMinor = useMemo(
    () => initialAccounts.reduce((sum, acc) => sum + acc.balanceMinor, 0),
    [initialAccounts]
  );

  const totalReceivablesMinor = useMemo(
    () => initialPersons.reduce((sum, p) => sum + p.totalReceivableMinor, 0),
    [initialPersons]
  );

  const totalPayablesMinor = useMemo(
    () => initialPersons.reduce((sum, p) => sum + p.totalPayableMinor, 0),
    [initialPersons]
  );

  const netLedgerPositionMinor = totalReceivablesMinor - totalPayablesMinor;

  // Task tallies
  const todoCount = counts.todo ?? 0;
  const inProgressCount = counts.in_progress ?? 0;
  const completedCount = counts.completed ?? 0;
  const activeCount = todoCount + inProgressCount;

  /*
   * Every task still open, in the order the server sorted them. This was a
   * six-item preview; the overview now carries the full working set as cards,
   * so the page answers "what is on my plate" without a hop to /tasks.
   * Completed work stays out — it is reported by the tally card above.
   */
  const activeTasks = useMemo(
    () => todos.filter((t) => t.status !== "completed"),
    [todos]
  );

  const overdueCount = useMemo(() => {
    return todos.filter(
      (t) => t.status !== "completed" && t.dueDate && isPastDue(t.dueDate)
    ).length;
  }, [todos]);

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

  /*
   * Any of the three states, not just the completed toggle the list row had:
   * a card carries the full status menu, so the handler has to accept whatever
   * it picks. The tallies are adjusted from the task's own previous status
   * rather than recomputed, which keeps the header counts honest mid-flight.
   */
  const changeTaskStatus = async (id: string, status: TodoStatus) => {
    const task = todos.find((t) => t._id === id);
    if (!task || task.status === status) return;

    const previousTodos = todos;
    const previousStatus = task.status;

    setTodos((current) =>
      current.map((t) => (t._id === id ? { ...t, status } : t))
    );
    setCounts((curr) => ({
      ...curr,
      [previousStatus]: Math.max(0, (curr[previousStatus] ?? 1) - 1),
      [status]: (curr[status] ?? 0) + 1,
    }));
    setPendingIds((curr) => new Set(curr).add(id));

    try {
      await api(`/api/todos/${id}`, { method: "PATCH", body: { status } });
      toast.success(
        status === "completed" ? "Task completed." : "Task updated."
      );
    } catch (caught: unknown) {
      // Restore both halves together — a rolled-back list beside adjusted
      // counts would show a tally that no card on the page accounts for.
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
            Here is what is happening across your tasks, ledger, and accounts today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/tasks/new" className="btn-primary h-9 px-3.5 text-xs">
            <PlusIcon className="w-4 h-4" />
            <span>New task</span>
          </Link>
          <Link href="/wallet" className="btn-ghost h-9 px-3 text-xs">
            <WalletIcon className="w-4 h-4" />
            <span>Wallet</span>
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
      {/*
        Five columns, and the headline takes two of them. Four equal cards gave
        the day's net worth exactly as much room as the count of overdue tasks,
        which is a layout with no opinion about what the page is for.
      */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 animate-stagger">
        <StatCard
          feature
          icon={<WalletIcon className="w-5 h-5" />}
          label="Total Net Worth"
          value={<Money minor={totalNetWorthMinor} size="hero" tone="neutral" />}
          hint={`Across ${initialAccounts.length} active account${initialAccounts.length === 1 ? "" : "s"}`}
          color="var(--accent)"
          onClick={() => router.push("/wallet")}
        />

        <StatCard
          icon={<LedgerIcon className="w-5 h-5" />}
          label="Ledger Position"
          value={<Money minor={netLedgerPositionMinor} size="lg" tone="auto" signed />}
          hint={`+৳${(totalReceivablesMinor / 100).toLocaleString()} in · -৳${(totalPayablesMinor / 100).toLocaleString()} out`}
          color={netLedgerPositionMinor >= 0 ? "var(--green)" : "var(--orange)"}
          onClick={() => router.push("/ledger")}
        />

        <StatCard
          icon={<TasksIcon className="w-5 h-5" />}
          label="Active Tasks"
          value={<span className="text-2xl font-bold text-ink">{activeCount}</span>}
          hint={`${completedCount} completed recently`}
          color="var(--purple)"
          onClick={() => router.push("/tasks")}
        />

        <StatCard
          icon={<AlertIcon className="w-5 h-5" />}
          label="Attention Needed"
          value={<span className="text-2xl font-bold text-ink">{overdueCount}</span>}
          hint={overdueCount > 0 ? `${overdueCount} overdue deadline${overdueCount === 1 ? "" : "s"}` : "All schedules on track"}
          color={overdueCount > 0 ? "var(--red)" : "var(--green)"}
          onClick={() => router.push("/tasks")}
        />
      </div>

      {/* ── Main Layout: Tasks + Financial Snapshot ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left 2 Cols: High Priority & Urgent Tasks ──────────────────── */}
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
              /*
               * The same card the tasks page grids, at the column width the
               * overview has to spend: two across from `sm`, three once the
               * viewport is wide enough that two would leave the cards
               * stretched. Reusing TodoCard rather than restyling a row keeps
               * one definition of what a task looks like.
               */
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

        {/* ── Right Col: Financial Overview ──────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Accounts Summary */}
          <section className="panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section">Accounts</h2>
              <Link
                href="/wallet"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                Manage
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>

            {initialAccounts.length === 0 ? (
              <p className="text-sm text-ink-muted py-2">No accounts registered yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {initialAccounts.slice(0, 5).map((account) => (
                  <Link
                    key={account._id}
                    href="/wallet"
                    className="p-3 rounded-card border border-line bg-card hover:border-border-hover transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-7 h-7 rounded-well flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `color-mix(in srgb, ${account.color || "var(--accent)"} 16%, transparent)`,
                          color: account.color || "var(--accent)",
                        }}
                      >
                        {accountIcon(account.accountType)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{account.name}</p>
                        <p className="text-xs text-ink-muted capitalize">
                          {account.provider || account.accountType.replace("_", " ")}
                        </p>
                      </div>
                    </div>

                    <Money minor={account.balanceMinor} size="sm" tone="neutral" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Ledger Counterparties */}
          <section className="panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section">Top Counterparties</h2>
              <Link
                href="/ledger"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                View ledger
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>

            {initialPersons.length === 0 ? (
              <p className="text-sm text-ink-muted py-2">No ledger entries recorded.</p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {initialPersons.slice(0, 4).map((person) => {
                  const net = person.totalReceivableMinor - person.totalPayableMinor;
                  return (
                    <Link
                      key={person._id}
                      href="/ledger"
                      className="py-2.5 flex items-center justify-between gap-3 group hover:bg-hover-overlay rounded-well px-2 -mx-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
                          {person.name}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {person.entryCount} {person.entryCount === 1 ? "entry" : "entries"}
                        </p>
                      </div>

                      <div className="text-right">
                        <Money minor={net} size="sm" tone="auto" signed />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
