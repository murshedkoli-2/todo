"use client";

import { useState } from "react";
import {
  Todo, SubtaskStatus, TaskService, getDisplayStatus, STATUS_LABELS,
  STATUS_COLORS, STATUS_TEXT_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TEXT_COLORS,
  SERVICE_LABELS, SERVICE_SHORT_LABELS, SERVICE_COLORS, SERVICE_TEXT_COLORS,
  isSubtaskDone, subtaskProgress,
} from "@/lib/types";
import { formatDueLabel } from "@/lib/dueDate";
import { nextSubtaskStatus } from "@/lib/taskStatus";
import type { TodoStatus } from "@/lib/schemas/todo";
import PriorityFlag from "@/components/ui/PriorityFlag";
import Avatar from "@/components/ui/Avatar";
import Money from "@/components/ui/Money";
import TaskCover from "@/components/ui/TaskCover";
import ServiceIcon from "@/components/ui/ServiceIcon";
import { useMenu } from "@/hooks/useMenu";
import {
  CalendarIcon, ClockIcon, ImageIcon, EditIcon, CheckIcon, MoreIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface TodoCardProps {
  todo: Todo;
  onEdit?: (todo: Todo) => void;
  onView?: (todo: Todo) => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  /** Advances one leg. Omitted, the service chips stay plain labels. */
  onSubtaskStatusChange?: (
    id: string, service: TaskService, status: SubtaskStatus
  ) => Promise<void>;
  /** True while a status change for this card is in flight. */
  pending?: boolean;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: TodoStatus; label: string }> = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

/** Soft wash used behind the card's status header. */
const statusTint = (color: string) => `color-mix(in srgb, ${color} 13%, transparent)`;

export default function TodoCard({
  todo, onEdit, onView, onStatusChange, onSubtaskStatusChange, pending = false,
}: TodoCardProps) {
  const menu = useMenu(STATUS_OPTIONS.length);
  const [ticking, setTicking] = useState<TaskService | null>(null);

  const displayStatus = getDisplayStatus(todo);
  const statusColor = STATUS_COLORS[displayStatus];
  const statusInk = STATUS_TEXT_COLORS[displayStatus];
  const isOverdue = displayStatus === "overdue";

  const handleStatusChange = (nextStatus: TodoStatus) => {
    menu.close();
    if (nextStatus !== todo.status) onStatusChange?.(todo._id, nextStatus);
  };

  /*
   * The chips already carry each leg's state; making them the control is
   * cheaper than a second row of switches on a card this dense, and it puts the
   * action where the status it changes is already being read.
   *
   * With three states and room for one control, a press advances the chip
   * rather than picking a state: not started → under way → done → not started.
   * The full three-way control is one click away on the row's own page, and on
   * the list view, which is where a state gets *set* rather than nudged.
   */
  const advanceSubtask = async (service: TaskService, status: SubtaskStatus) => {
    if (!onSubtaskStatusChange) return;
    setTicking(service);
    try {
      await onSubtaskStatusChange(todo._id, service, nextSubtaskStatus(status));
    } finally {
      setTicking(null);
    }
  };

  return (
    <article
      className="card-tile group !p-0 overflow-hidden"
      aria-labelledby={`task-title-${todo._id}`}
    >
      {/*
        Every card carries a cover, falling back to the service-based default cover
        (or multi-service composite cover) when the task has no upload, so the grid
        keeps a single card shape while visually communicating what jobs it covers.
      */}
      <TaskCover src={todo.featureImage} services={todo.services} className="h-32 flex-shrink-0" />

      <header
        className="flex items-center gap-2.5 px-4 h-11 flex-shrink-0 border-b border-line"
        style={{
          // Flat base first so browsers without `color-mix` get a band rather
          // than a transparent strip.
          background: "var(--bg-sunken)",
          backgroundImage: `linear-gradient(${statusTint(statusColor)}, ${statusTint(statusColor)})`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: statusColor }}
        />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.08em] truncate"
          style={{ color: statusInk }}
        >
          {STATUS_LABELS[displayStatus]}
        </span>

        <span className="flex-1" />

        <PriorityFlag priority={todo.priority} className="flex-shrink-0" />

        <Avatar name={todo.ownerName} variant="square" size="sm" solid className="flex-shrink-0" />
      </header>

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        {/*
          The whole card is not a click target any more. A clickable <article>
          containing buttons meant every inner control needed stopPropagation,
          and the card itself was unreachable by keyboard. The title is the
          link; `after:absolute` stretches its hit area over the card while
          leaving the real buttons on top of it.
        */}
        <h3 id={`task-title-${todo._id}`} className="font-bold text-[17px] leading-snug tracking-tight">
          <button
            type="button"
            onClick={() => onView?.(todo)}
            className="text-left line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {todo.title}
          </button>
        </h3>

        {/*
          Services sit directly under the title rather than in the meta row
          below, because on this desk they *are* what the task is — the row
          of due date and attachment counts is context around them.
        */}
        {todo.subtasks.length > 0 && (
          /* `relative z-10` lifts the chips above the title's stretched hit
             area, which otherwise swallows every click meant for one. */
          <div className="relative z-10 flex flex-wrap items-center gap-1.5 mt-2">
            {todo.subtasks.map((subtask) => {
              const { service, status } = subtask;
              const done = isSubtaskDone(subtask);
              const chipStyle = {
                background: `color-mix(in srgb, ${SERVICE_COLORS[service]} 14%, transparent)`,
                color: SERVICE_TEXT_COLORS[service],
                /* A finished leg is struck through rather than dropped: the
                   card has to keep showing everything the customer brought,
                   or a task with two of three collected looks like a
                   different, smaller job than the one they left. */
                textDecoration: done ? "line-through" : undefined,
                opacity: done ? 0.65 : undefined,
              };

              const stateGlyph =
                status === "completed" ? <CheckIcon className="w-2.5 h-2.5 flex-shrink-0" />
                : status === "in_progress" ? <ClockIcon className="w-2.5 h-2.5 flex-shrink-0" />
                : null;

              if (!onSubtaskStatusChange) {
                return (
                  <span key={service} className="pill gap-1" style={chipStyle}>
                    <ServiceIcon service={service} className="w-3 h-3 flex-shrink-0" />
                    {SERVICE_SHORT_LABELS[service]}
                    {stateGlyph}
                  </span>
                );
              }

              return (
                <button
                  key={service}
                  type="button"
                  disabled={ticking !== null}
                  onClick={() => void advanceSubtask(service, status)}
                  /* The label says what the press will do rather than what the
                     chip currently is — a cycling control that announces only
                     its state leaves the next step to guesswork. */
                  aria-label={`${SERVICE_LABELS[service]} on ${todo.title} is ${STATUS_LABELS[status]} — set to ${STATUS_LABELS[nextSubtaskStatus(status)]}`}
                  className="pill gap-1 transition-opacity duration-fast hover:!opacity-100 disabled:opacity-40"
                  style={chipStyle}
                  data-subtask={service}
                  data-status={status}
                  data-done={done}
                >
                  {ticking === service ? (
                    <SpinnerIcon className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <ServiceIcon service={service} className="w-3 h-3 flex-shrink-0" />
                  )}
                  {SERVICE_SHORT_LABELS[service]}
                  {stateGlyph}
                </button>
              );
            })}
            {/* Only once something has actually started — a bare "0/3" on every
                new task is noise on the busiest surface in the app. */}
            {subtaskProgress(todo.subtasks).started > 0 && (
              <span className="text-[11px] font-semibold text-ink-muted">
                {subtaskProgress(todo.subtasks).done}/{todo.subtasks.length} done
              </span>
            )}
          </div>
        )}

        {todo.description && (
          <p className="text-[13px] leading-relaxed line-clamp-2 mt-1.5 text-ink-secondary">
            {todo.description}
          </p>
        )}

        {(todo.dueDate || todo.paymentAmountMinor != null || todo.images.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {todo.dueDate && (
              <span
                className="pill"
                style={{
                  background: isOverdue ? "var(--red-soft)" : "var(--bg-sunken)",
                  color: isOverdue ? "var(--red-ink)" : "var(--text-secondary)",
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {formatDueLabel(todo.dueDate, { relative: displayStatus !== "completed" && displayStatus !== "canceled" })}
              </span>
            )}

            {todo.images.length > 0 && (
              <span className="pill bg-sunken text-ink-secondary">
                <ImageIcon className="w-3.5 h-3.5" />
                {todo.images.length}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 min-h-[12px]" />

        <div className="flex items-center gap-2 pt-3.5 mt-3.5 border-t border-line">
          {todo.paymentAmountMinor != null ? (
            <span className="flex items-baseline gap-2 min-w-0">
              <Money
                minor={todo.paymentAmountMinor}
                currency={todo.paymentCurrency}
                size="md"
                tone="neutral"
                compact
              />
              {/* A part-paid task's useful number is the shortfall, not the
                  word "partial" — the total is already printed beside it. */}
              <span
                className="text-[11px] font-semibold uppercase tracking-wide flex-shrink-0"
                style={{ color: PAYMENT_STATUS_TEXT_COLORS[todo.paymentStatus] }}
              >
                {todo.paymentStatus === "partial" && todo.dueAmountMinor != null ? (
                  <>
                    <Money
                      minor={todo.dueAmountMinor}
                      currency={todo.paymentCurrency}
                      size="sm"
                      tone="inherit"
                      compact
                    />
                    {" due"}
                  </>
                ) : (
                  PAYMENT_STATUS_LABELS[todo.paymentStatus]
                )}
              </span>
            </span>
          ) : (
            <span className="text-xs text-ink-muted">No payment</span>
          )}

          <span className="flex-1" />

          {/* Relative z-index lifts the controls above the title's stretched hit area. */}
          <div className="relative z-10 flex items-center gap-0.5 flex-shrink-0">
            <div className="relative" ref={menu.containerRef}>
              <button
                ref={menu.triggerRef}
                onClick={menu.toggle}
                onKeyDown={menu.handleKeyDown}
                disabled={pending}
                className="btn-ghost w-8 h-8 px-0"
                aria-label={`Change status of ${todo.title}`}
                aria-haspopup="menu"
                aria-expanded={menu.open}
              >
                {pending ? <SpinnerIcon className="w-4 h-4" /> : <MoreIcon className="w-4 h-4" />}
              </button>

              {menu.open && (
                <div
                  role="menu"
                  aria-label="Task status"
                  onKeyDown={menu.handleKeyDown}
                  className="absolute bottom-full right-0 mb-2 w-40 rounded-well overflow-hidden z-20 animate-scale-in bg-surface border border-line shadow-popup"
                >
                  {STATUS_OPTIONS.map((option, index) => {
                    const selected = todo.status === option.value;
                    const highlighted = menu.activeIndex === index;
                    return (
                      <button
                        key={option.value}
                        role="menuitemradio"
                        aria-checked={selected}
                        tabIndex={highlighted ? 0 : -1}
                        ref={(element) => {
                          if (highlighted) element?.focus();
                        }}
                        onClick={() => handleStatusChange(option.value)}
                        onMouseMove={() => menu.setActiveIndex(index)}
                        className="flex items-center justify-between gap-2 w-full text-left px-3.5 py-2.5 text-xs font-medium"
                        style={{
                          color: selected ? "var(--accent-ink)" : "var(--text-primary)",
                          background: highlighted
                            ? "var(--hover-overlay)"
                            : selected
                            ? "var(--accent-soft)"
                            : "transparent",
                        }}
                      >
                        {option.label}
                        {selected && <CheckIcon className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => onEdit?.(todo)}
              className="btn-ghost w-8 h-8 px-0"
              aria-label={`Edit ${todo.title}`}
            >
              <EditIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
