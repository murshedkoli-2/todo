"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Todo, SubtaskStatus, TaskService, getDisplayStatus, STATUS_LABELS, STATUS_COLORS,
  STATUS_TEXT_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TEXT_COLORS,
  PAYMENT_STATUS_COLORS, SERVICE_LABELS, SERVICE_COLORS, SERVICE_TEXT_COLORS,
  describeSubtaskFields, isSubtaskDone,
} from "@/lib/types";
import type { TodoStatus } from "@/lib/schemas/todo";
import { formatDueLabel } from "@/lib/dueDate";
import { nextSubtaskStatus } from "@/lib/taskStatus";
import TaskCover from "@/components/ui/TaskCover";
import ServiceIcon from "@/components/ui/ServiceIcon";
import PriorityFlag from "@/components/ui/PriorityFlag";
import Avatar from "@/components/ui/Avatar";
import Money from "@/components/ui/Money";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  CalendarIcon, CheckIcon, ClockIcon, CloseIcon, EditIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

interface TaskDrawerProps {
  todo: Todo | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  onSubtaskStatusChange?: (
    id: string, service: TaskService, status: SubtaskStatus
  ) => Promise<void>;
  onEdit?: (todo: Todo) => void;
}

const STATUS_CHOICES: TodoStatus[] = ["todo", "in_progress", "completed", "canceled"];

export default function TaskDrawer({
  todo,
  open,
  onClose,
  onStatusChange,
  onSubtaskStatusChange,
  onEdit,
}: TaskDrawerProps) {
  const drawerRef = useFocusTrap<HTMLDivElement>(open);
  const [tickingService, setTickingService] = React.useState<TaskService | null>(null);

  /* Lock body scroll when drawer is open and listen for Escape key */
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !todo) return null;

  const displayStatus = getDisplayStatus(todo);
  const isOverdue = displayStatus === "overdue";
  const statusColor = STATUS_COLORS[todo.status];
  const statusInk = STATUS_TEXT_COLORS[todo.status];

  const advanceSubtask = async (service: TaskService, status: SubtaskStatus) => {
    if (!onSubtaskStatusChange) return;
    setTickingService(service);
    try {
      await onSubtaskStatusChange(todo._id, service, nextSubtaskStatus(status));
    } finally {
      setTickingService(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fade-in transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={drawerRef}
        className="relative w-full max-w-xl h-full bg-chrome border-l border-line shadow-2xl flex flex-col z-10 animate-slide-in-left overflow-hidden"
      >
        {/* Header toolbar */}
        <header className="flex items-center justify-between px-4 sm:px-5 h-14 border-b border-line bg-surface flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: statusColor }}
            />
            <span className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: statusInk }}>
              {STATUS_LABELS[todo.status]}
            </span>
            {isOverdue && (
              <span className="pill !px-2 !py-0.5 bg-red-soft text-red-ink text-[10px] font-bold uppercase tracking-wide">
                Overdue
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Link
              href={`/tasks/${todo._id}`}
              className="btn-ghost h-8 px-2.5 text-xs gap-1.5"
              title="Open task on its own page"
            >
              <span>Full Page</span>
              <span className="text-[11px] opacity-60">↗</span>
            </Link>

            <button
              type="button"
              onClick={() => onEdit?.(todo)}
              className="btn-ghost w-8 h-8 px-0"
              aria-label="Edit task"
            >
              <EditIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-8 h-8 px-0"
              aria-label="Close inspector"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto divide-y divide-line">
          {/* Cover Banner */}
          <div className="relative w-full h-40 sm:h-48 flex-shrink-0">
            <TaskCover
              src={todo.featureImage}
              services={todo.services}
              priority
              className="w-full h-full"
            />
          </div>

          {/* Title & Metadata */}
          <div className="p-5 sm:p-6 flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <PriorityFlag priority={todo.priority} />
              <span className="text-xs text-ink-muted">·</span>
              <Avatar name={todo.ownerName} variant="square" size="sm" solid />
              <span className="text-xs text-ink-secondary">{todo.ownerName}</span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-ink leading-snug">
              {todo.title}
            </h2>

            {todo.description && (
              <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                {todo.description}
              </p>
            )}

            {todo.dueDate && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                <CalendarIcon className="w-3.5 h-3.5 text-ink-muted" />
                <span>Due {formatDueLabel(todo.dueDate)}</span>
                {isOverdue && <span className="font-semibold text-red-ink">· overdue</span>}
              </div>
            )}
          </div>

          {/* Quick Status Bar */}
          <div className="p-4 sm:p-5 bg-sunken/40">
            <span className="text-xs font-semibold text-ink-muted block mb-2 uppercase tracking-wide">
              Task Status
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {STATUS_CHOICES.map((choice) => {
                const active = todo.status === choice;
                const color = STATUS_COLORS[choice];
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => onStatusChange?.(todo._id, choice)}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-control text-xs font-semibold border transition-colors duration-fast"
                    style={{
                      background: active ? `color-mix(in srgb, ${color} 15%, transparent)` : "var(--bg-card)",
                      borderColor: active ? color : "var(--border)",
                      color: active ? STATUS_TEXT_COLORS[choice] : "var(--text-secondary)",
                    }}
                  >
                    <span>{STATUS_LABELS[choice]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtasks Checklist */}
          {todo.subtasks.length > 0 && (
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Sub-tasks ({todo.subtasks.length})
                </h3>
                <span className="text-xs text-ink-muted">
                  Click chip to advance state
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {todo.subtasks.map((subtask) => {
                  const { service, status } = subtask;
                  const done = isSubtaskDone(subtask);
                  const color = SERVICE_COLORS[service];
                  const described = describeSubtaskFields(subtask);

                  return (
                    <div
                      key={service}
                      className="well p-3 flex items-start gap-3 border-l-3"
                      style={{ borderLeftColor: color }}
                    >
                      <div
                        className="w-8 h-8 rounded-control flex-shrink-0 flex items-center justify-center border shadow-xs"
                        style={{
                          background: `color-mix(in srgb, ${color} 15%, transparent)`,
                          borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                          color: SERVICE_TEXT_COLORS[service],
                        }}
                      >
                        <ServiceIcon service={service} className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{
                              color: SERVICE_TEXT_COLORS[service],
                              textDecoration: done ? "line-through" : undefined,
                            }}
                          >
                            {SERVICE_LABELS[service]}
                          </span>

                          <button
                            type="button"
                            disabled={tickingService !== null}
                            onClick={() => void advanceSubtask(service, status)}
                            className="pill gap-1 transition-opacity duration-fast hover:!opacity-100 disabled:opacity-40"
                            style={{
                              background: `color-mix(in srgb, ${color} 14%, transparent)`,
                              color: SERVICE_TEXT_COLORS[service],
                            }}
                          >
                            {tickingService === service ? (
                              <SpinnerIcon className="w-3 h-3 flex-shrink-0" />
                            ) : status === "completed" ? (
                              <CheckIcon className="w-3 h-3 flex-shrink-0" />
                            ) : status === "in_progress" ? (
                              <ClockIcon className="w-3 h-3 flex-shrink-0" />
                            ) : null}
                            <span>{STATUS_LABELS[status]}</span>
                          </button>
                        </div>

                        {described.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 text-[11px] text-ink-muted mt-1">
                            {described.map((field) => (
                              <span key={field.key}>
                                {field.label}: {field.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Overview */}
          <div className="p-5 sm:p-6 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Payment Summary
            </h3>

            {todo.paymentAmountMinor != null ? (
              <div className="well p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">Total Cost</span>
                  <Money
                    minor={todo.paymentAmountMinor}
                    currency={todo.paymentCurrency}
                    size="md"
                    tone="neutral"
                  />
                </div>

                {todo.paidAmountMinor != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Paid Amount</span>
                    <Money
                      minor={todo.paidAmountMinor}
                      currency={todo.paymentCurrency}
                      size="sm"
                      tone="positive"
                    />
                  </div>
                )}

                {todo.dueAmountMinor != null && todo.dueAmountMinor > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <span className="text-xs font-semibold text-ink-muted">Remaining Due</span>
                    <Money
                      minor={todo.dueAmountMinor}
                      currency={todo.paymentCurrency}
                      size="md"
                      tone="negative"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-ink-muted">Status</span>
                  <span
                    className="pill text-[11px] font-bold uppercase"
                    style={{
                      background: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[todo.paymentStatus]} 14%, transparent)`,
                      color: PAYMENT_STATUS_TEXT_COLORS[todo.paymentStatus],
                    }}
                  >
                    {PAYMENT_STATUS_LABELS[todo.paymentStatus]}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted italic">No payment recorded for this task.</p>
            )}
          </div>

          {/* Attachments preview */}
          {todo.images.length > 0 && (
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Attachments ({todo.images.length})
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {todo.images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-control overflow-hidden border border-line">
                    <Image src={url} alt="" fill sizes="100px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
