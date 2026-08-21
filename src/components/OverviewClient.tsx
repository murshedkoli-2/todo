"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "@/components/shell/AppShell";
import QuickAddBar from "@/components/QuickAddBar";
import StatCard from "@/components/ui/StatCard";
import Money from "@/components/ui/Money";
import PriorityFlag from "@/components/ui/PriorityFlag";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { api, errorMessage } from "@/lib/apiClient";
import { useServerData } from "@/hooks/useServerData";
import { formatDueLabel, isPastDue } from "@/lib/dueDate";
import type { Todo, WalletAccount, LedgerPersonWithBalance } from "@/lib/types";
import type { CreateTodoInput } from "@/lib/schemas/todo";
import {
  TasksIcon,
  LedgerIcon,
  WalletIcon,
  AlertIcon,
  CheckIcon,
  PlusIcon,
  CalendarIcon,
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

  // Urgent and upcoming tasks: not completed, sorted by urgency & due date
  const urgentTasks = useMemo(() => {
    return todos
      .filter((t) => t.status !== "completed")
      .slice(0, 6);
  }, [todos]);

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

  // Toggle task completion from overview
  const toggleTaskStatus = async (task: Todo) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    const previousTodos = [...todos];

    // Optimistic update
    setTodos((current) =>
      current.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t))
    );
    setCounts((curr) => ({
      ...curr,
      [task.status]: Math.max(0, (curr[task.status] ?? 1) - 1),
      [newStatus]: (curr[newStatus] ?? 0) + 1,
    }));

    try {
      await api(`/api/todos/${task._id}`, {
        method: "PATCH",
        body: { status: newStatus },
      });
      toast.success(newStatus === "completed" ? "Task completed." : "Task reopened.");
    } catch (caught: unknown) {
      setTodos(previousTodos);
      toast.error(errorMessage(caught));
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-stagger">
        <StatCard
          icon={<WalletIcon className="w-5 h-5" />}
          label="Total Net Worth"
          value={<Money minor={totalNetWorthMinor} size="lg" tone="neutral" />}
          hint={`${initialAccounts.length} active account${initialAccounts.length === 1 ? "" : "s"}`}
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
                  {urgentTasks.length}
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

            {urgentTasks.length === 0 ? (
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
              <div className="flex flex-col divide-y divide-line">
                {urgentTasks.map((task) => {
                  const overdue = task.dueDate && isPastDue(task.dueDate);
                  return (
                    <div
                      key={task._id}
                      className="py-3 flex items-center justify-between gap-3 group hover:bg-hover-overlay rounded-well px-2 -mx-2 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleTaskStatus(task)}
                          aria-label={`Complete ${task.title}`}
                          className="w-5 h-5 rounded border border-line flex items-center justify-center text-transparent hover:text-ink-muted hover:border-accent flex-shrink-0 transition-colors"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/tasks/${task._id}`}
                            className="text-sm font-semibold text-ink truncate block hover:text-accent transition-colors"
                          >
                            {task.title}
                          </Link>

                          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-muted flex-wrap">
                            {task.dueDate && (
                              <span
                                className={`flex items-center gap-1 ${
                                  overdue ? "text-red font-semibold" : ""
                                }`}
                              >
                                <CalendarIcon className="w-3 h-3" />
                                {formatDueLabel(task.dueDate)}
                              </span>
                            )}

                            {task.paymentAmountMinor && (
                              <span>
                                • Total: <Money minor={task.paymentAmountMinor} size="sm" tone="neutral" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.priority !== "none" && (
                          <PriorityFlag priority={task.priority} />
                        )}
                      </div>
                    </div>
                  );
                })}
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
