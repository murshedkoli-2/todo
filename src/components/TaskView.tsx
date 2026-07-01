"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Todo,
  getDisplayStatus,
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  DisplayStatus,
} from "@/lib/types";

interface TaskViewProps {
  todo: Todo;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_OPTIONS: Array<{ value: Todo["status"]; label: string; color: string }> = [
  { value: "todo",        label: "To Do",       color: "#4493f8" },
  { value: "in_progress", label: "In Progress",  color: "#e3b341" },
  { value: "completed",   label: "Completed",    color: "#3fb950" },
];

export default function TaskView({ todo: initialTodo }: TaskViewProps) {
  const router = useRouter();
  const [todo, setTodo] = useState<Todo>(initialTodo);
  const [activeImage, setActiveImage] = useState<string | null>(
    todo.featureImage || (todo.images.length > 0 ? todo.images[0] : null)
  );
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const displayStatus: DisplayStatus = getDisplayStatus(todo);
  const isPastDue = todo.dueDate && new Date(todo.dueDate) < new Date();

  /* ── Quick Status Change ─────────────────────── */
  const handleStatusChange = async (newStatus: Todo["status"]) => {
    if (todo.status === newStatus) return;
    setIsChangingStatus(true);
    setError("");
    try {
      const res = await fetch(`/api/todos/${todo._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated: Todo = await res.json();
      setTodo(updated);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsChangingStatus(false);
    }
  };

  /* ── Delete Task ────────────────────────────── */
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/todos/${todo._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--bg-primary)" }}>
      {/* ── Top Header Bar ───────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6 h-14"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <Link
          href="/"
          className="btn-ghost w-8 h-8 p-0 rounded-lg flex-shrink-0 flex items-center justify-center"
          aria-label="Back to dashboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <Link
            href="/"
            className="transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            Dashboard
          </Link>
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {todo.title}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/tasks/${todo._id}/edit`}
            className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Link>

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2 border-l pl-3" style={{ borderColor: "var(--border)" }}>
            <div className="relative w-7 h-7 flex-shrink-0">
              <Image src="/logo.png" alt="TaskFlow Logo" fill className="object-contain drop-shadow" />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Container ──────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in"
            style={{ background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.3)", color: "var(--red)" }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left Column: Main Details & Media (2 cols) ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Main Title & Badges */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {/* Task status badge */}
                <span className={`badge-${displayStatus} inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold`}>
                  {STATUS_LABELS[displayStatus]}
                </span>

                {/* Payment status badge */}
                {todo.paymentAmount != null && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: `${PAYMENT_STATUS_COLORS[todo.paymentStatus]}20`,
                      border: `1px solid ${PAYMENT_STATUS_COLORS[todo.paymentStatus]}50`,
                      color: PAYMENT_STATUS_COLORS[todo.paymentStatus],
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: PAYMENT_STATUS_COLORS[todo.paymentStatus] }}
                    />
                    {todo.paymentCurrency} {todo.paymentAmount.toLocaleString()} · {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {todo.title}
              </h1>

              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Created {formatDate(todo.createdAt)}</span>
                <span>•</span>
                <span>Updated {formatTime(todo.updatedAt)}</span>
              </div>
            </div>

            {/* Description Card */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Description
              </h2>
              {todo.description ? (
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {todo.description}
                </div>
              ) : (
                <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                  No description provided for this task.
                </p>
              )}
            </div>

            {/* Image Gallery */}
            {todo.images.length > 0 && (
              <div
                className="rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Attachments ({todo.images.length})
                  </h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Click an image to expand
                  </span>
                </div>

                {/* Main Active Preview */}
                {activeImage && (
                  <div
                    className="relative w-full h-72 sm:h-96 rounded-xl overflow-hidden cursor-pointer group"
                    style={{ background: "var(--bg-primary)" }}
                    onClick={() => setLightboxImage(activeImage)}
                  >
                    <Image
                      src={activeImage}
                      alt="Active attachment preview"
                      fill
                      className="object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.4)" }}
                    >
                      <span className="btn-secondary text-xs gap-1.5 shadow-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                        View Fullscreen
                      </span>
                    </div>
                  </div>
                )}

                {/* Thumbnails grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-2">
                  {todo.images.map((url) => {
                    const isSelected = activeImage === url;
                    const isFeature = todo.featureImage === url;
                    return (
                      <button
                        key={url}
                        onClick={() => setActiveImage(url)}
                        className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150"
                        style={{
                          borderColor: isSelected ? "var(--accent)" : "var(--border)",
                          opacity: isSelected ? 1 : 0.7,
                        }}
                      >
                        <Image src={url} alt="Thumbnail" fill className="object-cover" sizes="100px" />
                        {isFeature && (
                          <div className="absolute top-1 left-1 bg-black/80 text-yellow-400 p-0.5 rounded-full" title="Feature image">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ── Right Column: Sidebar Meta & Quick Controls (1 col) ── */}
          <div className="flex flex-col gap-6">

            {/* Quick Status Control */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Status Control
              </h2>
              <div className="flex flex-col gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const active = todo.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      disabled={isChangingStatus}
                      onClick={() => handleStatusChange(opt.value)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150"
                      style={{
                        background: active ? `${opt.color}22` : "var(--bg-primary)",
                        border: `1px solid ${active ? opt.color + "66" : "var(--border)"}`,
                        color: active ? opt.color : "var(--text-secondary)",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                        {opt.label}
                      </div>
                      {active && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Task Meta Overview */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Task Overview
              </h2>

              {/* Due date */}
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Due Date</span>
                {todo.dueDate ? (
                  <span
                    className="text-sm font-medium flex items-center gap-1.5"
                    style={{ color: isPastDue && todo.status !== "completed" ? "var(--red)" : "var(--text-primary)" }}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(todo.dueDate)}
                    {isPastDue && todo.status !== "completed" && " (Overdue)"}
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>No due date</span>
                )}
              </div>

              {/* Payment Info */}
              <div className="flex flex-col gap-1 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Payment</span>
                {todo.paymentAmount != null ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-bold" style={{ color: PAYMENT_STATUS_COLORS[todo.paymentStatus] }}>
                      {todo.paymentCurrency} {todo.paymentAmount.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium" style={{ color: PAYMENT_STATUS_COLORS[todo.paymentStatus] }}>
                      Status: {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>No payment specified</span>
                )}
              </div>

              {/* Owner */}
              <div className="flex flex-col gap-1 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Assigned To</span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{todo.ownerName}</span>
              </div>
            </div>

            {/* Actions Panel */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <Link
                href={`/tasks/${todo._id}/edit`}
                className="btn-primary justify-center w-full py-2.5 text-sm gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Task
              </Link>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-danger justify-center w-full py-2.5 text-sm gap-2 mt-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isDeleting ? "Deleting..." : "Delete Task"}
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* ── Image Lightbox Modal ─────────────────── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-black/50"
            aria-label="Close lightbox"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <Image
              src={lightboxImage}
              alt="Expanded preview"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
