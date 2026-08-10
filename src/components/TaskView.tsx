"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Todo, TodoStatus, DisplayStatus, getDisplayStatus,
  STATUS_LABELS, STATUS_COLORS, STATUS_TEXT_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_TEXT_COLORS,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import AppShell from "@/components/shell/AppShell";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Avatar from "@/components/ui/Avatar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Money from "@/components/ui/Money";
import TaskCover from "@/components/ui/TaskCover";
import { useToast } from "@/components/ui/ToastProvider";
import {
  EditIcon, TrashIcon, CalendarIcon, AlertIcon, CheckIcon, CloseIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface TaskViewProps {
  todo: Todo;
}

const STATUS_OPTIONS: TodoStatus[] = ["todo", "in_progress", "completed"];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function TaskView({ todo: initialTodo }: TaskViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [todo, setTodo] = useState<Todo>(initialTodo);
  const [activeImage, setActiveImage] = useState<string | null>(
    initialTodo.featureImage ?? initialTodo.images[0] ?? null
  );
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const displayStatus: DisplayStatus = getDisplayStatus(todo);
  const statusColor = STATUS_COLORS[displayStatus];
  const isPastDue = Boolean(todo.dueDate) && new Date(todo.dueDate!) < new Date();
  const showOverdue = isPastDue && todo.status !== "completed";

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxImage(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxImage]);

  const handleStatusChange = async (newStatus: TodoStatus) => {
    if (todo.status === newStatus) return;
    const previous = todo;
    setChangingStatus(true);
    setError("");
    // Applied immediately, reverted if the request fails.
    setTodo((current) => ({ ...current, status: newStatus }));

    try {
      const updated = await api<Todo>(`/api/todos/${todo._id}`, {
        method: "PATCH",
        body: { status: newStatus },
      });
      setTodo(updated);
      router.refresh();
    } catch (caught: unknown) {
      setTodo(previous);
      toast.error(errorMessage(caught));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await api(`/api/todos/${todo._id}`, { method: "DELETE" });
      toast.success("Task deleted.");
      router.push("/");
      router.refresh();
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <AppShell workspace="My Workspace">
      <Breadcrumb items={[{ label: "Tasks", href: "/" }, { label: todo.title }]} />

      {error && (
        <div className="alert-error mb-5" role="alert">
          <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* ── Main column ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/*
            Cover banner, mirroring the card the user clicked through from —
            the default image keeps that continuity for tasks without an
            upload instead of dropping straight into the title.
          */}
          <TaskCover
            src={todo.featureImage}
            sizes="(max-width: 1024px) 100vw, 60vw"
            priority
            className="h-40 sm:h-52 rounded-panel border border-line"
          />

          <section className="panel">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span
                className="pill"
                style={{
                  background: `color-mix(in srgb, ${statusColor} 14%, transparent)`,
                  color: STATUS_TEXT_COLORS[displayStatus],
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                {showOverdue ? "Overdue" : STATUS_LABELS[displayStatus]}
              </span>

              {todo.paymentAmountMinor != null && (
                <span
                  className="pill"
                  style={{
                    background: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[todo.paymentStatus]} 14%, transparent)`,
                    color: PAYMENT_STATUS_TEXT_COLORS[todo.paymentStatus],
                  }}
                >
                  <Money
                    minor={todo.paymentAmountMinor}
                    currency={todo.paymentCurrency}
                    size="sm"
                    tone="inherit"
                  />
                  {" · "}
                  {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
                </span>
              )}
            </div>

            <h1 className="text-display">{todo.title}</h1>

            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-3"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Created {formatDate(todo.createdAt)}</span>
              <span>Updated {formatDateTime(todo.updatedAt)}</span>
            </div>
          </section>

          <section className="panel">
            <h2 className="text-eyebrow mb-3">Description</h2>
            {todo.description ? (
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--text-secondary)" }}
              >
                {todo.description}
              </p>
            ) : (
              <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                No description was added to this task.
              </p>
            )}
          </section>

          {todo.images.length > 0 && (
            <section className="panel">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-eyebrow">Attachments ({todo.images.length})</h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Click to expand
                </span>
              </div>

              {activeImage && (
                <button
                  className="relative w-full h-64 sm:h-80 rounded-well overflow-hidden group block"
                  style={{ background: "var(--bg-sunken)" }}
                  onClick={() => setLightboxImage(activeImage)}
                  aria-label="Open image full screen"
                >
                  <Image src={activeImage} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-contain" />
                </button>
              )}

              {todo.images.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4">
                  {todo.images.map((url) => {
                    const selected = activeImage === url;
                    return (
                      <button
                        key={url}
                        onClick={() => setActiveImage(url)}
                        className="relative aspect-square rounded-control overflow-hidden"
                        style={{
                          outline: selected ? "2px solid var(--accent)" : "1px solid var(--border)",
                          outlineOffset: selected ? "1px" : "0",
                          opacity: selected ? 1 : 0.65,
                        }}
                        aria-label="Show this attachment"
                        aria-pressed={selected}
                      >
                        <Image src={url} alt="" fill sizes="120px" className="object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Side column ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <section className="panel">
            <h2 className="text-eyebrow mb-3">Status</h2>
            <div className="flex flex-col gap-2">
              {STATUS_OPTIONS.map((option) => {
                const active = todo.status === option;
                const color = STATUS_COLORS[option];
                return (
                  <button
                    key={option}
                    onClick={() => handleStatusChange(option)}
                    disabled={changingStatus}
                    className="flex items-center justify-between gap-2 px-4 h-11 rounded-well text-sm font-semibold"
                    style={{
                      background: active
                        ? `color-mix(in srgb, ${color} 12%, transparent)`
                        : "var(--bg-sunken)",
                      border: `1px solid ${active ? color : "transparent"}`,
                      color: active ? STATUS_TEXT_COLORS[option] : "var(--text-secondary)",
                    }}
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {STATUS_LABELS[option]}
                    </span>
                    {active && <CheckIcon className="w-4 h-4" />}
                    {changingStatus && !active && <SpinnerIcon className="w-4 h-4 opacity-40" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2 className="text-eyebrow mb-4">Overview</h2>

            <dl className="flex flex-col gap-4">
              <div>
                <dt className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Due date</dt>
                <dd
                  className="text-sm font-semibold flex items-center gap-2"
                  style={{ color: showOverdue ? "var(--red)" : "var(--text-primary)" }}
                >
                  {todo.dueDate ? (
                    <>
                      <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                      {formatDate(todo.dueDate)}
                      {showOverdue && " · Overdue"}
                    </>
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>Not set</span>
                  )}
                </dd>
              </div>

              <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <dt className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Payment</dt>
                <dd>
                  {todo.paymentAmountMinor != null ? (
                    <>
                      <Money
                        minor={todo.paymentAmountMinor}
                        currency={todo.paymentCurrency}
                        size="lg"
                        tone="neutral"
                        className="block"
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: PAYMENT_STATUS_TEXT_COLORS[todo.paymentStatus] }}
                      >
                        {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>None</span>
                  )}
                </dd>
              </div>

              <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <dt className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Assigned to</dt>
                <dd className="flex items-center gap-2.5">
                  <Avatar name={todo.ownerName} size="sm" solid />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {todo.ownerName}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel flex flex-col gap-3">
            <Link href={`/tasks/${todo._id}/edit`} className="btn-primary w-full">
              <EditIcon className="w-4 h-4" />
              Edit task
            </Link>
            <button onClick={() => setConfirmDelete(true)} className="btn-danger w-full">
              <TrashIcon className="w-4 h-4" />
              Delete task
            </button>
          </section>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(8,10,22,0.9)", backdropFilter: "blur(10px)" }}
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 btn-icon"
            style={{ background: "rgba(255,255,255,0.1)", borderColor: "transparent", color: "#fff" }}
            aria-label="Close preview"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
          <div className="relative w-full h-full max-w-5xl max-h-[88vh]">
            <Image src={lightboxImage} alt="" fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${todo.title}”?`}
          message="This task and its attachments will be permanently removed. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </AppShell>
  );
}
