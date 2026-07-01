"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Todo, getDisplayStatus, STATUS_LABELS, DisplayStatus } from "@/lib/types";
import TodoCard from "@/components/TodoCard";
import MenuBar from "@/components/MenuBar";

interface HomeClientProps {
  initialTodos: Todo[];
}

const STAT_ICON: Record<string, React.ReactNode> = {
  todo: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  in_progress: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  completed: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  overdue: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const STAT_COLOR: Record<string, string> = {
  todo:        "#4493f8",
  in_progress: "#e3b341",
  completed:   "#3fb950",
  overdue:     "#f85149",
};

export default function HomeClient({ initialTodos }: HomeClientProps) {
  const router = useRouter();
  const [todos, setTodos]           = useState<Todo[]>(initialTodos);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");

  const counts = {
    todo:        todos.filter(t => getDisplayStatus(t) === "todo").length,
    in_progress: todos.filter(t => getDisplayStatus(t) === "in_progress").length,
    completed:   todos.filter(t => getDisplayStatus(t) === "completed").length,
    overdue:     todos.filter(t => getDisplayStatus(t) === "overdue").length,
  };

  const filteredTodos = todos.filter(todo => {
    const ds = getDisplayStatus(todo);
    const matchesStatus = statusFilter === "all" || ds === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      todo.title.toLowerCase().includes(q) ||
      (todo.description?.toLowerCase().includes(q) ?? false);
    return matchesStatus && matchesSearch;
  });

  /* Status quick-change (inline on card — no page nav needed) */
  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update status");
    const updated: Todo = await res.json();
    setTodos(prev => prev.map(t => t._id === updated._id ? { ...updated, ownerName: "Me" } : t));
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <MenuBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              My Dashboard
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Manage your personal tasks and track progress
            </p>
          </div>
          <button
            onClick={() => router.push("/tasks/new")}
            className="btn-primary self-start sm:self-auto"
            id="create-todo-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {(["todo", "in_progress", "completed", "overdue"] as const).map(s => {
            const active = statusFilter === s;
            const color  = STAT_COLOR[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={`stat-${s} rounded-xl border p-4 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]`}
                style={{ outline: active ? `2px solid ${color}` : "none", outlineOffset: "2px" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div style={{ color }}>{STAT_ICON[s]}</div>
                  <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{counts[s]}</span>
                </div>
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {STATUS_LABELS[s]}
                </p>
              </button>
            );
          })}
        </div>

        {/* Task grid */}
        {filteredTodos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--bg-card)" }}>
              <svg className="w-8 h-8" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1" style={{ color: "var(--text-primary)" }}>
              {todos.length === 0 ? "No tasks yet" : "No matching tasks"}
            </h3>
            <p className="text-sm max-w-xs mb-5" style={{ color: "var(--text-secondary)" }}>
              {todos.length === 0
                ? "Click the button below to create your first task."
                : "Try adjusting your search or filter."}
            </p>
            {todos.length === 0 && (
              <button onClick={() => router.push("/tasks/new")} className="btn-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create first task
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTodos.map((todo, i) => (
              <div key={todo._id} style={{ animationDelay: `${i * 35}ms` }}>
                <TodoCard
                  todo={todo}
                  onView={t => router.push(`/tasks/${t._id}`)}
                  onEdit={t => router.push(`/tasks/${t._id}/edit`)}
                  onStatusChange={handleStatusChange}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
